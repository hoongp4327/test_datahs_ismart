/**
 * Cột giáo viên được sửa trên trang quản trị và quy tắc kiểm tra.
 * File này KHÔNG dùng API riêng của Node — trình duyệt và server dùng chung.
 */
import { DIEM_TOI_DA, KY_NANG, docDiem } from "./bao-cao";

/** Thứ tự cũng là thứ tự cột khi tạo tab KetQua mới. Đổi ở đây nhớ đổi COT_GHI trong Code.gs. */
export const COT_SUA = [
  "ho_ten",
  "lop",
  "giao_vien",
  "ngay_cham",
  ...KY_NANG.map((k) => `diem_${k.key}`),
  ...KY_NANG.map((k) => `option_${k.key}`),
  "mo_ta_rieng_speaking",
  "pct_co_ban",
  "pct_nang_cao",
  "nhan_xet_lo_trinh",
] as const;

export type CotSua = (typeof COT_SUA)[number];
export type HocSinhSua = { ma_hoc_sinh: string } & Partial<Record<CotSua, string>>;

const DO_DAI_TOI_DA: Partial<Record<CotSua, number>> = {
  ho_ten: 80,
  lop: 60,
  giao_vien: 80,
  mo_ta_rieng_speaking: 1500,
  nhan_xet_lo_trinh: 1500,
};

/** Bộ ký tự mã học sinh — giống scripts/tao-template.mjs: bỏ 0/O, 1/I/L. */
export const KY_TU_MA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function hopLeMa(ma: string) {
  return /^[A-Z0-9][A-Z0-9-]{3,19}$/.test(ma);
}

/** "5/9/2026" → "05/09/2026"; không phải ngày thật thì trả null. */
export function chuanNgay(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, t, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ngay = new Date(n, t - 1, d);
  if (ngay.getFullYear() !== n || ngay.getMonth() !== t - 1 || ngay.getDate() !== d) return null;
  return `${String(d).padStart(2, "0")}/${String(t).padStart(2, "0")}/${n}`;
}

/**
 * Làm sạch + kiểm tra một học sinh gửi lên.
 * `loi` rỗng nghĩa là hợp lệ; `sach` chỉ chứa các cột trong COT_SUA và mã.
 * Option không kiểm tra ở đây vì cần danh sách MoTaKyNang — Apps Script kiểm tra.
 */
export function kiemTraHocSinh(dauVao: unknown): { loi: Record<string, string>; sach: HocSinhSua } {
  const vao = (dauVao && typeof dauVao === "object" ? dauVao : {}) as Record<string, unknown>;
  // Bỏ ký tự điều khiển (trừ xuống dòng) để không lọt ký tự lạ vào sheet.
  const chu = (v: unknown) =>
    String(v ?? "")
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
      .trim();

  const loi: Record<string, string> = {};
  const ma = chu(vao.ma_hoc_sinh).toUpperCase();
  if (!hopLeMa(ma)) loi.ma_hoc_sinh = "Mã học sinh không hợp lệ.";
  const sach: HocSinhSua = { ma_hoc_sinh: ma };

  for (const cot of COT_SUA) {
    if (!(cot in vao)) continue; // không gửi cột nào thì không đụng cột đó
    let v = chu(vao[cot]);
    const toiDa = DO_DAI_TOI_DA[cot] ?? 40;
    if (v.length > toiDa) loi[cot] = `Tối đa ${toiDa} ký tự.`;

    if (cot.startsWith("diem_") && v) {
      const d = docDiem(v);
      if (d === null) loi[cot] = `Điểm từ 0 đến ${DIEM_TOI_DA}.`;
      else v = String(d);
    }
    if (cot === "ngay_cham" && v) {
      const n = chuanNgay(v);
      if (!n) loi[cot] = "Ngày không hợp lệ (dd/mm/yyyy).";
      else v = n;
    }
    if (cot.startsWith("pct_") && v) {
      const m = v.replace(/\s/g, "").match(/^(\d{1,3})%?$/);
      if (!m || Number(m[1]) > 100) loi[cot] = "Phần trăm từ 0 đến 100.";
      else v = `${Number(m[1])}%`;
    }
    sach[cot] = v;
  }

  if ("ho_ten" in vao && !sach.ho_ten) loi.ho_ten = "Cần nhập họ tên.";
  return { loi, sach };
}
