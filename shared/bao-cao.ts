/**
 * Logic chuyển dữ liệu thô của Google Sheet thành báo cáo cho frontend.
 * Dùng chung giữa Netlify Function (production) và Vite dev server (chạy thử).
 */

export type Row = Record<string, string>;

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

/** Tách gạch đầu dòng: xuống dòng trong ô hoặc dấu " | ". */
export function toBullets(value: string): string[] {
  return String(value ?? "")
    .split(/\r?\n|\s\|\s/)
    .map((s) => s.replace(/^[-•–]\s*/, "").trim())
    .filter(Boolean);
}

export function normalizeCode(v: string): string {
  return String(v ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Tìm học sinh theo mã, **lấy dòng cuối cùng** khớp mã.
 *
 * Khi nhập tay thì mỗi mã chỉ có một dòng nên lấy dòng nào cũng như nhau.
 * Nhưng nếu sau này dữ liệu đến từ Google Form, giáo viên nộp nhiều lần cho
 * cùng một học sinh và Form luôn ghi thêm xuống dưới — dòng cuối là bản mới nhất.
 */
export function timHocSinh(results: Row[], code: string): Row | undefined {
  const target = normalizeCode(code);
  for (let i = results.length - 1; i >= 0; i--) {
    if (normalizeCode(results[i].ma_hoc_sinh) === target) return results[i];
  }
  return undefined;
}

export function buildReport(row: Row, levels: Row[]) {
  const level = levels.find((l) => normalizeCode(l.bac) === normalizeCode(row.bac_nang_luc));

  return {
    maHocSinh: row.ma_hoc_sinh,
    hoTen: row.ho_ten,
    giaoVien: row.giao_vien,
    lichHoc: row.lich_hoc,
    lop: row.lop,
    videoUrl: row.video_url,
    tinhThan: {
      soCup: row.so_cup,
      gioTay: row.gio_tay,
      traLoiDung: row.tra_loi_dung,
      nhanXet: row.nhan_xet_tinh_than,
    },
    ketQua: {
      hocLuc: row.hoc_luc,
      nhanXetTongQuan: row.nhan_xet_tong_quan,
      chiTiet: [
        {
          tieuDe: "Từ vựng",
          noiDung: row.nx_tu_vung,
          diem: row.diem_tu_vung ? Number(row.diem_tu_vung) : undefined,
        },
        {
          tieuDe: "Cấu trúc / Ngữ pháp",
          noiDung: row.nx_ngu_phap,
          diem: row.diem_ngu_phap ? Number(row.diem_ngu_phap) : undefined,
        },
        {
          tieuDe: "Phát âm",
          noiDung: row.nx_phat_am,
          diem: row.diem_phat_am ? Number(row.diem_phat_am) : undefined,
        },
        {
          tieuDe: "Phản xạ",
          noiDung: row.nx_phan_xa,
          diem: row.diem_phan_xa ? Number(row.diem_phan_xa) : undefined,
        },
      ].filter((m) => m.noiDung),
    },
    loTrinh: {
      phanTramCoBan: row.pct_co_ban || "100%",
      phanTramNangCao: row.pct_nang_cao || "10%",
      nhanXet: row.nhan_xet_lo_trinh,
    },
    nangLucDauRa: {
      bac: row.bac_nang_luc,
      nghe: toBullets(level?.nghe ?? ""),
      noi: toBullets(level?.noi ?? ""),
      doc: toBullets(level?.doc ?? ""),
      viet: toBullets(level?.viet ?? ""),
    },
    ngayCap: row.ngay_cap,
  };
}
