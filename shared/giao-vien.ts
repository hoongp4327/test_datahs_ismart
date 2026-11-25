/**
 * Danh sách giáo viên chấm điểm — tab GiaoVien trên Google Sheet, phòng vận hành tự thêm/bớt:
 *   ho_ten · co_so · trang_thai (trống hoặc "Đang dạy" = hiện; "Nghỉ" = ẩn khỏi ô chọn)
 * Ẩn một giáo viên không đụng tới tên đã lưu trên các bài đã chấm.
 * Dùng chung trình duyệt và server.
 */
import type { Row } from "./bao-cao";

/** `ten` = giá trị lưu vào cột giao_vien và hiện trên báo cáo. */
export type GiaoVien = { ten: string; coSo: string };

const gon = (v: unknown) => String(v ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

export function docGiaoVien(rows: Row[]): GiaoVien[] {
  const ds: GiaoVien[] = [];
  for (const r of rows) {
    const ten = gon(r.ho_ten);
    if (!ten || gon(r.trang_thai).toLowerCase().startsWith("nghỉ")) continue;
    const coSo = gon(r.co_so);
    if (!ds.some((g) => g.ten === ten && g.coSo === coSo)) ds.push({ ten, coSo });
  }
  // Hai người trùng tên khác cơ sở: lưu kèm cơ sở để phân biệt được ai chấm.
  const dem = new Map<string, number>();
  for (const g of ds) dem.set(g.ten, (dem.get(g.ten) ?? 0) + 1);
  return ds
    .map((g) => ((dem.get(g.ten) ?? 0) > 1 && g.coSo ? { ...g, ten: `${g.ten} (${g.coSo})` } : g))
    .sort((a, b) => a.coSo.localeCompare(b.coSo, "vi") || a.ten.localeCompare(b.ten, "vi"));
}
