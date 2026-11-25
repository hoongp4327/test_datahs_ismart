/**
 * Logic chuyển dữ liệu thô của Google Sheet thành báo cáo cho frontend.
 * Dùng chung giữa Netlify Function (production) và Vite dev server (chạy thử).
 *
 * Sheet gồm 3 tab:
 *   KetQua      — mỗi dòng một học sinh: điểm 4 kỹ năng, option mô tả, lộ trình
 *   MoTaKyNang  — mỗi kỹ năng chia nhiều khoảng điểm (diem_tu), mỗi khoảng có vài option
 *                 = vài cách diễn đạt cùng một mức năng lực, kèm gợi ý luyện tập
 *   ThangLevel  — danh sách lớp từ thấp tới cao. Lớp gợi ý = mức của kỹ năng THẤP NHẤT
 *                 (khoảng điểm thứ mấy trong MoTaKyNang thì ứng với lớp thứ mấy)
 *
 * Khung điểm theo chương trình iLEAD (data/khung-ilead.json):
 *   Listening 20 · Reading 20 · Writing 15 · Speaking 20 = 75
 */

export type Row = Record<string, string>;

export type SheetData = {
  ketQua: Row[];
  moTa: Row[];
  thangLevel: Row[];
};

/**
 * Thứ tự kỹ năng trên báo cáo. `key` là hậu tố tên cột trong tab KetQua.
 * `toiDa` = điểm tối đa của kỹ năng — phải khớp DIEM_TOI_DA trong apps-script/Code.gs.
 */
export const KY_NANG = [
  { key: "listening", ten: "Listening", tenViet: "Nghe", toiDa: 20 },
  { key: "reading", ten: "Reading", tenViet: "Đọc", toiDa: 20 },
  { key: "writing", ten: "Writing", tenViet: "Viết", toiDa: 15 },
  { key: "speaking", ten: "Speaking", tenViet: "Nói", toiDa: 20 },
] as const;

export type KeyKyNang = (typeof KY_NANG)[number]["key"];

/** Điểm tối đa của một kỹ năng theo key ("writing" → 15). */
export function toiDaCua(key: string): number {
  return KY_NANG.find((k) => k.key === key)?.toiDa ?? 20;
}

/** Option mặc định khi giáo viên để trống hoặc chọn option không có trong khoảng điểm. */
export const OPTION_MAC_DINH = "Option 1";

/** Biến mảng 2 chiều của Sheets thành mảng object, key lấy từ hàng đầu tiên. */
export function toObjects(rows: string[][] | undefined): Row[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h ?? "").trim());
  return rows.slice(1).map((row) => {
    const obj: Row = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = String(row[i] ?? "").trim();
    });
    return obj;
  });
}

/**
 * Chuẩn hoá mã học sinh: chỉ giữ chữ và số, viết hoa.
 * Phụ huynh gõ "hs-7k3m9q", "HS 7K3M9Q" hay "HS7K3M9Q" đều ra cùng một mã.
 */
export function normalizeCode(v: string): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** So khớp không phân biệt hoa thường, khoảng trắng, dấu gạch: "Option 2" = "option2". */
function cungKhoa(a: string, b: string): boolean {
  const chuan = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return chuan(a) !== "" && chuan(a) === chuan(b);
}

/**
 * Tìm học sinh theo mã, **lấy dòng cuối cùng** khớp mã.
 *
 * Khi nhập tay thì mỗi mã chỉ có một dòng nên lấy dòng nào cũng như nhau.
 * Nhưng nếu dữ liệu được ghi thêm (Google Form, trang admin lưu bản mới), dòng
 * cuối là bản mới nhất. Đừng đổi lại thành find().
 */
export function timHocSinh(ketQua: Row[], code: string): Row | undefined {
  const target = normalizeCode(code);
  if (!target) return undefined;
  for (let i = ketQua.length - 1; i >= 0; i--) {
    if (normalizeCode(ketQua[i].ma_hoc_sinh) === target) return ketQua[i];
  }
  return undefined;
}

/**
 * Đọc một ô điểm. Ngoài khoảng 0..max hoặc không phải số thì coi như **chưa có điểm**
 * — thà hiện "—" còn hơn hiện một con số sai cho phụ huynh.
 * Chấp nhận dấu phẩy thập phân vì sheet đặt vùng Việt Nam sẽ hiện "12,5".
 */
export function docDiem(v: string | undefined, max: number): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
}

/**
 * Trong các dòng có cột `diem_tu`, lấy dòng có `diem_tu` lớn nhất mà vẫn ≤ điểm.
 * Chỉ dùng mốc dưới nên không có khe hở giữa các khoảng, và điểm lẻ như 24,5
 * vẫn rơi đúng vào một mức.
 */
function theoMocDiem(rows: Row[], diem: number): Row | undefined {
  let tot: Row | undefined;
  let mocTot = -Infinity;
  for (const r of rows) {
    const moc = docDiem(r.diem_tu, Number.POSITIVE_INFINITY);
    if (moc !== null && moc <= diem && moc > mocTot) {
      tot = r;
      mocTot = moc;
    }
  }
  return tot;
}

/**
 * Tìm nội dung mô tả của một kỹ năng.
 *   1. Khoảng điểm luôn do ĐIỂM quyết định (dòng có diem_tu lớn nhất ≤ điểm).
 *   2. Trong khoảng đó, option = cách diễn đạt giáo viên chọn. Để trống, hoặc chọn option
 *      khoảng này không có → lấy Option 1 (dòng đầu của khoảng).
 * Chưa có điểm thì không xác định được khoảng → không có mô tả.
 */
export function timMoTa(
  moTa: Row[],
  kyNang: string,
  option: string,
  diem: number | null
): Row | undefined {
  if (diem === null) return undefined;
  const cungKyNang = moTa.filter((r) => cungKhoa(r.ky_nang, kyNang));
  const moc = theoMocDiem(cungKyNang, diem);
  if (!moc) return undefined;
  const cungKhoang = cungKyNang.filter((r) => r.diem_tu === moc.diem_tu);
  return (
    (option && cungKhoang.find((r) => cungKhoa(r.option, option))) ||
    cungKhoang.find((r) => cungKhoa(r.option, OPTION_MAC_DINH)) ||
    cungKhoang[0]
  );
}

/** Danh sách option (cách diễn đạt) của một kỹ năng, theo thứ tự trên sheet, không trùng. */
export function cacOption(moTa: Row[], kyNang: string): string[] {
  const ds: string[] = [];
  for (const r of moTa) {
    if (cungKhoa(r.ky_nang, kyNang) && r.option && !ds.some((o) => cungKhoa(o, r.option))) ds.push(r.option);
  }
  return ds;
}

/** Các lớp từ thấp tới cao. Cột `diem_tu` của ThangLevel giờ chỉ còn dùng để sắp thứ tự này. */
export function cacLevel(thangLevel: Row[]): Row[] {
  return thangLevel
    .filter((r) => r.level && docDiem(r.diem_tu, Number.POSITIVE_INFINITY) !== null)
    .sort(
      (a, b) =>
        docDiem(a.diem_tu, Number.POSITIVE_INFINITY)! - docDiem(b.diem_tu, Number.POSITIVE_INFINITY)!
    );
}

/** Điểm từng kỹ năng, theo key ("listening" → 14). */
export type DiemKyNang = Partial<Record<string, number | null>>;

/**
 * Một kỹ năng đang ở mức lớp nào: khoảng điểm thứ mấy trong MoTaKyNang thì ứng với lớp thứ mấy
 * trong ThangLevel (khoảng 1 → iLEAD 1 … khoảng 4 → iLEAD 4). Dùng đúng khoảng mô tả phụ huynh
 * đọc trên báo cáo, nên lớp và lời nhận xét không bao giờ lệch nhau; sửa mốc trên sheet là đổi cả hai.
 * Thứ tự trả về: 0 = lớp thấp nhất. Thiếu điểm hoặc sheet chưa có khoảng nào → null.
 */
export function mucKyNang(thangLevel: Row[], moTa: Row[], kyNang: string, diem: number | null): number | null {
  if (diem === null) return null;
  const soLop = cacLevel(thangLevel).length;
  const moc = new Set<number>();
  for (const r of moTa) {
    const m = cungKhoa(r.ky_nang, kyNang) ? docDiem(r.diem_tu, Number.POSITIVE_INFINITY) : null;
    if (m !== null) moc.add(m);
  }
  const qua = [...moc].filter((m) => m <= diem).length;
  return qua && soLop ? Math.min(qua, soLop) - 1 : null;
}

/**
 * Xếp lớp: hệ thống chỉ GỢI Ý, theo kỹ năng có mức THẤP NHẤT (không theo tổng điểm — điểm cao ở
 * kỹ năng này không bù được kỹ năng kia). Giáo viên là người chốt (cột `lop_xep` của KetQua);
 * ô đó trống hay ghi một lớp không có trong ThangLevel → dùng gợi ý.
 * Thiếu mức của bất kỳ kỹ năng nào thì không gợi ý.
 */
export function xepLop(
  data: { thangLevel: Row[]; moTa: Row[] },
  diem: DiemKyNang,
  lopGiaoVien: string | undefined
) {
  const thang = cacLevel(data.thangLevel);
  const muc = KY_NANG.map((k) => ({
    ten: k.ten as string,
    key: k.key as string,
    muc: mucKyNang(data.thangLevel, data.moTa, k.ten, diem[k.key] ?? null),
  }));
  const thapNhat = muc.every((m) => m.muc !== null) ? Math.min(...muc.map((m) => m.muc!)) : null;
  const goiY = thapNhat === null ? undefined : thang[thapNhat];
  const gvChot = thang.find((r) => cungKhoa(r.lop_xep, lopGiaoVien ?? ""));
  return {
    /** Lớp ứng với từng kỹ năng, theo key. */
    lopKyNang: Object.fromEntries(
      muc.map((m) => [m.key, m.muc === null ? "" : thang[m.muc].lop_xep ?? ""])
    ) as Record<string, string>,
    /** Kỹ năng quyết định lớp gợi ý (có thể nhiều kỹ năng cùng mức). Rỗng nếu cả 4 cùng mức. */
    kyNangThap:
      thapNhat === null || muc.every((m) => m.muc === thapNhat)
        ? []
        : muc.filter((m) => m.muc === thapNhat).map((m) => m.ten),
    /** Dòng ThangLevel của lớp cuối cùng hiện trên báo cáo. */
    chot: gvChot ?? goiY,
    goiY,
    daChot: Boolean(gvChot),
    /** Giáo viên xếp khác gợi ý. */
    khacGoiY: Boolean(gvChot && gvChot !== goiY),
  };
}

/** Học sinh đã có điểm kỹ năng nào chưa — mã mới cấp, chưa làm bài thì chưa có điểm nào. */
export function coDiemNao(row: Row): boolean {
  return KY_NANG.some((k) => docDiem(row[`diem_${k.key}`], k.toiDa) !== null);
}

/**
 * Mã có trên sheet nhưng CHƯA đủ để ra báo cáo:
 *   - "chua-lam"     mã giáo viên vừa cấp, học sinh chưa làm bài (chưa có điểm nào)
 *   - "cho-speaking" đã làm bài trên máy, giáo viên chưa chấm Speaking (chấm gom sau)
 * Trả null = dựng báo cáo như bình thường.
 */
export function ketQuaDangCho(row: Row): { loai: "chua-lam" | "cho-speaking"; hoTen: string; message: string } | null {
  const hoTen = String(row.ho_ten ?? "").trim();
  if (!coDiemNao(row)) {
    return {
      loai: "chua-lam",
      hoTen,
      message: hoTen
        ? `Học sinh ${hoTen} chưa làm bài kiểm tra nên chưa có kết quả.`
        : "Mã này đã được cấp nhưng học sinh chưa làm bài kiểm tra nên chưa có kết quả.",
    };
  }
  if (docDiem(row.diem_speaking, toiDaCua("speaking")) === null) {
    return {
      loai: "cho-speaking",
      hoTen,
      message: `Học sinh ${hoTen || "này"} chưa làm xong bài Speaking nên chưa đánh giá được. Vui lòng tra cứu lại sau khi giáo viên chấm Speaking.`,
    };
  }
  return null;
}

export function buildReport(row: Row, data: SheetData) {
  const kyNang = KY_NANG.map((kn) => {
    const diem = docDiem(row[`diem_${kn.key}`], kn.toiDa);
    const option = row[`option_${kn.key}`] ?? "";
    const moTa = timMoTa(data.moTa, kn.ten, option, diem);
    return {
      key: kn.key,
      ten: kn.ten,
      tenViet: kn.tenViet,
      diem,
      toiDa: kn.toiDa as number,
      /** Khoảng điểm đang áp dụng, vd "6–10". */
      khoang: moTa?.khoang ?? "",
      option: moTa?.option ?? option,
      moTa: moTa?.mo_ta ?? "",
      goiY: moTa?.goi_y ?? "",
      // Chỉ Speaking có mô tả riêng; các kỹ năng khác cột này không tồn tại.
      moTaRieng: row[`mo_ta_rieng_${kn.key}`] ?? "",
    };
  });

  // Thiếu bất kỳ điểm nào thì không xếp Level: một Level dựa trên
  // 3/4 kỹ năng sẽ sai mà phụ huynh không có cách nào nhận ra.
  const duDiem = kyNang.every((k) => k.diem !== null);
  const level = duDiem
    ? xepLop(data, Object.fromEntries(kyNang.map((k) => [k.key, k.diem])), row.lop_xep).chot
    : undefined;

  return {
    maHocSinh: row.ma_hoc_sinh,
    hoTen: row.ho_ten,
    giaoVien: row.giao_vien,
    lop: row.lop,
    ngayCham: row.ngay_cham,
    kyNang,
    // Không trả tổng điểm: lớp xếp theo kỹ năng thấp nhất nên con số tổng chỉ gây hiểu lầm.
    duDiem,
    // Cột `level` trên sheet là trình độ ĐẦU RA của lớp (mục tiêu sau khoá học), không phải
    // trình độ hiện tại. Kết quả của bài placement là `lop` (lớp xếp); `moTa` là năng lực đầu vào.
    level: level ? { ten: level.level, lop: level.lop_xep ?? "", moTa: level.mo_ta ?? "" } : null,
    // Các lớp từ thấp tới cao, để vẽ thanh lớp trên báo cáo.
    thangLevel: cacLevel(data.thangLevel).map((r) => ({ ten: r.level, lop: r.lop_xep ?? "" })),
    loTrinh: {
      phanTramCoBan: row.pct_co_ban || "100%",
      phanTramNangCao: row.pct_nang_cao || "10%",
      nhanXet: row.nhan_xet_lo_trinh,
    },
  };
}
