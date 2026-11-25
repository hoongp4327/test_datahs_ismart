/**
 * Chấm bài placement trên trang quản trị (tab "Chờ chấm").
 *
 *   docBaiChoCham  — đọc tab PlacementTest, trả các bài CÒN THIẾU điểm giáo viên chấm
 *                    (Writing Part 2 hoặc Speaking)
 *   chamBaiPlacement — giáo viên chấm Writing Part 2 và/hoặc Speaking → Apps Script ghi điểm
 *                      vào đúng mã học sinh của bài trong KetQua (trong một lần khoá)
 *
 * Hai phần chấm ĐỘC LẬP: Speaking thường tổ chức riêng nên giáo viên chấm Writing Part 2
 * trước, bài vẫn nằm ở "Chờ chấm Speaking" tới khi nhập điểm nói. Phần nào đã chấm thì
 * không ghi đè ở đây nữa (muốn sửa → tab Học sinh).
 *
 * Bài nộp theo luồng cũ (chưa có ma_hoc_sinh trên dòng bài làm) vẫn chấm được: lúc đó mã do
 * trình duyệt tạo và học sinh được thêm mới vào KetQua như trước.
 *
 * Chạy ở server (Netlify Function / Vite dev server). Gợi ý đáp án Writing Part 2 lấy từ
 * dap-an.ts nên file này KHÔNG được import từ src/.
 */
import { toObjects, type Row } from "../bao-cao";
import duLieuMau from "../du-lieu-mau";
import { docGiaoVien, type GiaoVien } from "../giao-vien";
import { kiemTraHocSinh, type HocSinhSua } from "../hoc-sinh-sua";
import type { CauHinh } from "../nguon-du-lieu";
import { DAP_AN } from "./dap-an";
import { DE_THI } from "./de-thi";
import { BAI_NOP_MAU, TAB_PLACEMENT } from "./nop-bai";

const TIMEOUT_MS = 9_000;

/** Câu hỏi Writing Part 2 + gợi ý đáp án + điểm tối đa — để giáo viên chấm từng câu. */
export const CAU_GV_CHAM = DE_THI.phan
  .flatMap((p) => p.cauHoi)
  .filter((c) => {
    const da = DAP_AN[c.id];
    return da && "giaoVienCham" in da;
  })
  .map((c) => {
    const da = DAP_AN[c.id] as { diem: number; goiY: string };
    return { id: c.id, de: "de" in c ? c.de ?? "" : "", goiY: da.goiY, toiDa: da.diem };
  });

export const TOI_DA_W2 = CAU_GV_CHAM.reduce((s, c) => s + c.toiDa, 0);

export class LoiCham extends Error {
  constructor(message: string, public trangThai = 502, public ma = "FAILED", public chiTiet?: Record<string, string>) {
    super(message);
  }
}

async function goiAppsScript(ch: CauHinh, body: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(ch.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: ch.appsScriptToken, ...body }),
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      throw new LoiCham("Google phản hồi quá chậm. Bấm Tải lại để xem đã lưu chưa trước khi thử lại.", 504);
    }
    throw err;
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown> & { error?: string; message?: string };
  } catch {
    throw new LoiCham(`Apps Script không trả về JSON (${res.status}).`);
  }
}

const CAN_CAP_NHAT_SCRIPT =
  "Code.gs trên sheet là bản cũ, chưa hỗ trợ mã học sinh cấp trước và chấm Speaking sau — dán Code.gs mới rồi triển khai phiên bản mới.";

const coGiaTri = (v: unknown) => String(v ?? "").trim() !== "";

/** Bài còn chờ chấm = đã nộp mà thiếu điểm Writing Part 2 hoặc Speaking. */
export const conChoCham = (r: Record<string, unknown>) => !coGiaTri(r.diem_writing_p2_gv) || !coGiaTri(r.diem_speaking);

/** Mới nộp xếp trên. Kèm danh sách giáo viên (Code.gs trả chung một lượt gọi). */
export async function docBaiChoCham(
  ch: CauHinh,
  dungMau: boolean
): Promise<{ bai: Row[]; loi?: string; coXepLop: boolean; giaoVien: GiaoVien[] }> {
  let giaoVien: GiaoVien[] = [];
  let rows: Row[];
  let loi: string | undefined;
  // Code.gs bản cũ nhận lop_xep nhưng lặng lẽ bỏ qua → phải khoá ô xếp lớp, kẻo giáo viên
  // tưởng đã chốt lớp mà thật ra chưa lưu.
  let coXepLop = true;
  if (dungMau) {
    giaoVien = docGiaoVien(duLieuMau.giaoVien);
    rows = BAI_NOP_MAU.map((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)])));
  } else {
    const j = await goiAppsScript(ch, { action: "docPlacement" });
    if (j.error === "UNKNOWN_ACTION") return { bai: [], loi: CAN_CAP_NHAT_SCRIPT, coXepLop: false, giaoVien };
    if (j.error) return { bai: [], loi: String(j.message || j.error), coXepLop: false, giaoVien };
    rows = toObjects(j.rows as string[][]);
    // Code.gs bản cũ hoặc sheet chưa có tab GiaoVien → danh sách rỗng, ô giáo viên gõ tự do.
    giaoVien = docGiaoVien(toObjects(j.giaoVien as string[][] | undefined));
    // Bản Code.gs mới trả kèm phienBan; thiếu = bản cũ → vẫn xem được bài nhưng chưa chấm được.
    if (Number(j.phienBan ?? 0) < 2) loi = CAN_CAP_NHAT_SCRIPT;
    coXepLop = Number(j.phienBan ?? 0) >= 3;
  }
  const bai = rows.filter((r) => r.ma_bai && conChoCham(r)).reverse();
  return { bai, loi, coXepLop, giaoVien };
}

type DauVaoCham = {
  maBai?: unknown;
  hocSinh?: unknown;
  /** Điểm từng câu Writing Part 2, theo thứ tự CAU_GV_CHAM. Bỏ trống hết = lần này chưa chấm phần viết. */
  w2?: unknown;
};

export type KetQuaCham = {
  ma_hoc_sinh: string;
  /** Các cột KetQua vừa ghi (không phải cả dòng) — trang quản trị trộn vào danh sách đang hiện. */
  hocSinh: Row;
  /** Đã đủ Writing Part 2 + Speaking → bài rời khỏi "Chờ chấm". */
  xong: boolean;
  /** Điểm giáo viên chấm đang có trên dòng bài làm sau lần lưu này. */
  bai: { diem_writing_p2_gv: string; diem_speaking: string; ma_hoc_sinh: string };
};

/** Kiểm tra dữ liệu giáo viên gửi lên. Trả lỗi theo từng ô để hiện ngay dưới ô đó. */
export function kiemTraCham(vao: DauVaoCham) {
  const loi: Record<string, string> = {};
  const maBai = String(vao.maBai ?? "");
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(maBai)) loi.maBai = "Thiếu mã bài làm.";

  // Writing Part 2: hoặc bỏ trống cả 4 câu (lần này chưa chấm phần viết), hoặc chấm đủ cả 4.
  const diemW2 = (Array.isArray(vao.w2) ? vao.w2 : []).map((v) => String(v ?? "").trim());
  const coW2 = CAU_GV_CHAM.some((_, i) => diemW2[i]);
  let tongW2 = 0;
  if (coW2) {
    CAU_GV_CHAM.forEach((c, i) => {
      const n = Number((diemW2[i] ?? "").replace(",", "."));
      if (!diemW2[i] || !Number.isFinite(n) || n < 0 || n > c.toiDa) loi[`w2_${i}`] = `0–${c.toiDa}`;
      else tongW2 += n;
    });
  }
  const w2: number | null = coW2 ? tongW2 : null;

  const { loi: loiHs, sach } = kiemTraHocSinh(vao.hocSinh);
  Object.assign(loi, loiHs);
  if (!coW2 && !sach.diem_speaking) loi.diem_speaking = "Chấm Writing Part 2 hoặc Speaking rồi mới lưu.";
  if (!sach.ho_ten) loi.ho_ten = "Cần nhập họ tên.";
  return { loi, maBai, w2, hocSinh: sach };
}

const LOI_DA_CHAM = "Bài này đã được chấm xong cả Writing Part 2 và Speaking.";
const LOI_PHAN_DA_CHAM = "Phần bạn vừa chấm đã có điểm trên sheet (người khác vừa chấm). Bấm Tải lại.";

export async function chamBaiPlacement(
  ch: CauHinh,
  dungMau: boolean,
  vao: DauVaoCham,
  ghiVaoMau: (hs: HocSinhSua) => void
): Promise<KetQuaCham> {
  const { loi, maBai, w2, hocSinh } = kiemTraCham(vao);
  if (Object.keys(loi).length) throw new LoiCham("Dữ liệu chưa hợp lệ.", 400, "INVALID", loi);

  const chiGui = {
    ma_hoc_sinh: hocSinh.ma_hoc_sinh,
    ho_ten: hocSinh.ho_ten,
    lop: hocSinh.lop ?? "",
    giao_vien: hocSinh.giao_vien ?? "",
    diem_speaking: hocSinh.diem_speaking,
    mo_ta_rieng_speaking: hocSinh.mo_ta_rieng_speaking ?? "",
    /** Lớp giáo viên chốt — chỉ ghi khi bài đã đủ điểm. */
    lop_xep: hocSinh.lop_xep ?? "",
  };

  if (dungMau) {
    const bai = BAI_NOP_MAU.find((d) => d.ma_bai === maBai);
    if (!bai) throw new LoiCham("Không tìm thấy bài làm này.", 409, "GONE");
    // Bản sao logic chamPlacement trong Code.gs, để chạy thử không cần sheet.
    const w2Cu = String(bai.diem_writing_p2_gv ?? "").trim();
    const noiCu = String(bai.diem_speaking ?? "").trim();
    if (w2Cu && noiCu) throw new LoiCham(LOI_DA_CHAM, 409, "DA_CHAM");
    const ghiW2 = !w2Cu && w2 !== null;
    const ghiNoi = !noiCu && coGiaTri(chiGui.diem_speaking);
    if (!ghiW2 && !ghiNoi) throw new LoiCham(LOI_PHAN_DA_CHAM, 409, "DA_CHAM");

    const ma = String(bai.ma_hoc_sinh ?? "").trim() || chiGui.ma_hoc_sinh;
    const w2Moi = w2Cu ? Number(w2Cu) : w2;
    const xong = w2Moi !== null && (Boolean(noiCu) || ghiNoi);
    const hs: Row = {
      ma_hoc_sinh: ma,
      ho_ten: chiGui.ho_ten ?? "",
      diem_listening: String(bai.diem_listening),
      diem_reading: String(bai.diem_reading),
    };
    if (chiGui.lop) hs.lop = chiGui.lop;
    if (chiGui.giao_vien) hs.giao_vien = chiGui.giao_vien;
    if (w2Moi !== null) hs.diem_writing = String(Math.min(15, Number(bai.diem_writing_p1) + w2Moi));
    if (ghiNoi) {
      hs.diem_speaking = String(chiGui.diem_speaking);
      if (chiGui.mo_ta_rieng_speaking) hs.mo_ta_rieng_speaking = chiGui.mo_ta_rieng_speaking;
    }
    if (xong) {
      if (chiGui.lop_xep) hs.lop_xep = chiGui.lop_xep;
      const d = new Date(Date.now() + 7 * 3600_000);
      const p = (n: number) => String(n).padStart(2, "0");
      hs.ngay_cham = `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    }
    ghiVaoMau(hs as HocSinhSua);
    if (ghiW2) bai.diem_writing_p2_gv = w2 as number;
    if (ghiNoi) bai.diem_speaking = String(chiGui.diem_speaking);
    bai.ma_hoc_sinh = ma;
    if (chiGui.giao_vien) bai.nguoi_cham = chiGui.giao_vien;
    return {
      ma_hoc_sinh: ma,
      hocSinh: hs,
      xong,
      bai: { diem_writing_p2_gv: String(bai.diem_writing_p2_gv ?? ""), diem_speaking: String(bai.diem_speaking ?? ""), ma_hoc_sinh: ma },
    };
  }

  // Tên action mới ("…2"): Code.gs bản cũ hiểu w2 trống là 0 điểm, nên phải để nó báo
  // UNKNOWN_ACTION thay vì âm thầm ghi sai.
  const j = await goiAppsScript(ch, { action: "chamPlacement2", maBai, hocSinh: chiGui, cham: { w2 } });
  if (j.error === "UNKNOWN_ACTION") throw new LoiCham(CAN_CAP_NHAT_SCRIPT);
  if (j.error === "UNAUTHORIZED") throw new LoiCham("APPS_SCRIPT_TOKEN không khớp TOKEN trong Code.gs.");
  if (j.error === "INVALID") throw new LoiCham("Dữ liệu chưa hợp lệ.", 400, "INVALID", j.loi as Record<string, string>);
  if (j.error) {
    const trangThai = ["DA_CHAM", "GONE", "MA_TRUNG"].includes(j.error) ? 409 : 502;
    throw new LoiCham(String(j.message || j.error), trangThai, j.error);
  }
  const chuoi = (o: unknown) =>
    Object.fromEntries(Object.entries((o as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v ?? "")]));
  return {
    ma_hoc_sinh: String(j.ma_hoc_sinh),
    hocSinh: chuoi(j.hocSinh) as Row,
    xong: Boolean(j.xong),
    bai: chuoi(j.bai) as KetQuaCham["bai"],
  };
}

export { TAB_PLACEMENT };
