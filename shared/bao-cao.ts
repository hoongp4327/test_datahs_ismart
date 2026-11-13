/**
 * Logic chuyển dữ liệu thô của Google Sheet thành báo cáo cho frontend.
 * Dùng chung giữa Netlify Function (production) và Vite dev server (chạy thử).
 *
 * Sheet gồm 3 tab:
 *   KetQua      — mỗi dòng một học sinh: điểm 4 kỹ năng, option mô tả, lộ trình
 *   MoTaKyNang  — mỗi kỹ năng chia nhiều khoảng điểm (diem_tu), mỗi khoảng có vài option
 *                 = vài cách diễn đạt cùng một mức năng lực, kèm gợi ý luyện tập
 *   ThangLevel  — tổng điểm từ bao nhiêu thì đạt Level nào, xếp lớp nào
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

export const TONG_TOI_DA = KY_NANG.reduce((s, k) => s + k.toiDa, 0);

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

export function timLevel(thangLevel: Row[], tong: number): Row | undefined {
  return theoMocDiem(thangLevel, tong);
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

  // Thiếu bất kỳ điểm nào thì không tính tổng và Level: một Level dựa trên
  // 3/4 kỹ năng sẽ sai mà phụ huynh không có cách nào nhận ra.
  const duDiem = kyNang.every((k) => k.diem !== null);
  const tongDiem = duDiem ? kyNang.reduce((s, k) => s + (k.diem ?? 0), 0) : null;
  const level = tongDiem !== null ? timLevel(data.thangLevel, tongDiem) : undefined;

  return {
    maHocSinh: row.ma_hoc_sinh,
    hoTen: row.ho_ten,
    giaoVien: row.giao_vien,
    lop: row.lop,
    ngayCham: row.ngay_cham,
    kyNang,
    tongDiem,
    tongToiDa: TONG_TOI_DA,
    level: level ? { ten: level.level, lop: level.lop_xep ?? "", moTa: level.mo_ta ?? "" } : null,
    // Toàn bộ thang Level để vẽ thanh 0–75 trên báo cáo; sửa mốc trên sheet là thanh đổi theo.
    thangLevel: data.thangLevel
      .map((r) => ({ ten: r.level, tu: docDiem(r.diem_tu, Number.POSITIVE_INFINITY) }))
      .filter((r): r is { ten: string; tu: number } => Boolean(r.ten) && r.tu !== null)
      .sort((a, b) => a.tu - b.tu),
    loTrinh: {
      phanTramCoBan: row.pct_co_ban || "100%",
      phanTramNangCao: row.pct_nang_cao || "10%",
      nhanXet: row.nhan_xet_lo_trinh,
    },
  };
}
