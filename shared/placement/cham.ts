/**
 * Chấm bài placement trên trang quản trị (tab "Chờ chấm").
 *
 *   docBaiChoCham  — đọc tab PlacementTest, trả các bài CHƯA chuyển sang KetQua
 *   chamBaiPlacement — giáo viên chấm Writing Part 2 + Speaking → Apps Script tạo học sinh
 *                      trong KetQua và đánh dấu bài đã chuyển (trong một lần khoá)
 *
 * Chạy ở server (Netlify Function / Vite dev server). Gợi ý đáp án Writing Part 2 lấy từ
 * dap-an.ts nên file này KHÔNG được import từ src/.
 */
import { toObjects, type Row } from "../bao-cao";
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

const CAN_CAP_NHAT_SCRIPT = "Apps Script chưa có chức năng chấm bài — dán Code.gs mới rồi triển khai phiên bản mới.";

/** Bài chờ chấm = có ma_bai mà chưa có ma_hoc_sinh. Mới nộp xếp trên. */
export async function docBaiChoCham(ch: CauHinh, dungMau: boolean): Promise<{ bai: Row[]; loi?: string }> {
  let rows: Row[];
  if (dungMau) {
    rows = BAI_NOP_MAU.map((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)])));
  } else {
    const j = await goiAppsScript(ch, { action: "docPlacement" });
    if (j.error === "UNKNOWN_ACTION") return { bai: [], loi: CAN_CAP_NHAT_SCRIPT };
    if (j.error) return { bai: [], loi: String(j.message || j.error) };
    rows = toObjects(j.rows as string[][]);
  }
  const bai = rows.filter((r) => r.ma_bai && !String(r.ma_hoc_sinh ?? "").trim()).reverse();
  return { bai };
}

type DauVaoCham = {
  maBai?: unknown;
  hocSinh?: unknown;
  /** Điểm từng câu Writing Part 2, theo thứ tự CAU_GV_CHAM. */
  w2?: unknown;
};

/** Kiểm tra dữ liệu giáo viên gửi lên. Trả lỗi theo từng ô để hiện ngay dưới ô đó. */
export function kiemTraCham(vao: DauVaoCham) {
  const loi: Record<string, string> = {};
  const maBai = String(vao.maBai ?? "");
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(maBai)) loi.maBai = "Thiếu mã bài làm.";

  const diemW2 = Array.isArray(vao.w2) ? vao.w2 : [];
  let w2 = 0;
  CAU_GV_CHAM.forEach((c, i) => {
    const n = Number(String(diemW2[i] ?? "").replace(",", "."));
    if (String(diemW2[i] ?? "").trim() === "" || !Number.isFinite(n) || n < 0 || n > c.toiDa) {
      loi[`w2_${i}`] = `0–${c.toiDa}`;
    } else w2 += n;
  });

  const { loi: loiHs, sach } = kiemTraHocSinh(vao.hocSinh);
  Object.assign(loi, loiHs);
  if (!sach.diem_speaking) loi.diem_speaking = "Cần chấm Speaking.";
  if (!sach.ho_ten) loi.ho_ten = "Cần nhập họ tên.";
  return { loi, maBai, w2, hocSinh: sach };
}

export async function chamBaiPlacement(
  ch: CauHinh,
  dungMau: boolean,
  vao: DauVaoCham,
  ghiVaoMau: (hs: HocSinhSua) => void
): Promise<{ ma_hoc_sinh: string; hocSinh: Row }> {
  const { loi, maBai, w2, hocSinh } = kiemTraCham(vao);
  if (Object.keys(loi).length) throw new LoiCham("Dữ liệu chưa hợp lệ.", 400, "INVALID", loi);

  const chiGui = {
    ma_hoc_sinh: hocSinh.ma_hoc_sinh,
    ho_ten: hocSinh.ho_ten,
    lop: hocSinh.lop ?? "",
    giao_vien: hocSinh.giao_vien ?? "",
    diem_speaking: hocSinh.diem_speaking,
    mo_ta_rieng_speaking: hocSinh.mo_ta_rieng_speaking ?? "",
  };

  if (dungMau) {
    const bai = BAI_NOP_MAU.find((d) => d.ma_bai === maBai);
    if (!bai) throw new LoiCham("Không tìm thấy bài làm này.", 409, "GONE");
    if (bai.ma_hoc_sinh) throw new LoiCham(`Bài này đã chuyển sang ${bai.ma_hoc_sinh}.`, 409, "DA_CHAM");
    const d = new Date(Date.now() + 7 * 3600_000);
    const p = (n: number) => String(n).padStart(2, "0");
    const hs: Row = {
      ...chiGui,
      ngay_cham: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
      diem_listening: String(bai.diem_listening),
      diem_reading: String(bai.diem_reading),
      diem_writing: String(Math.min(15, Number(bai.diem_writing_p1) + w2)),
    } as Row;
    ghiVaoMau(hs as HocSinhSua);
    Object.assign(bai, {
      diem_writing_p2_gv: w2,
      diem_speaking: chiGui.diem_speaking ?? "",
      ma_hoc_sinh: hs.ma_hoc_sinh,
      nguoi_cham: hs.giao_vien,
      trang_thai: `Đã chuyển → ${hs.ma_hoc_sinh}`,
    });
    return { ma_hoc_sinh: hs.ma_hoc_sinh, hocSinh: hs };
  }

  const j = await goiAppsScript(ch, { action: "chamPlacement", maBai, hocSinh: chiGui, cham: { w2 } });
  if (j.error === "UNKNOWN_ACTION") throw new LoiCham(CAN_CAP_NHAT_SCRIPT);
  if (j.error === "UNAUTHORIZED") throw new LoiCham("APPS_SCRIPT_TOKEN không khớp TOKEN trong Code.gs.");
  if (j.error === "INVALID") throw new LoiCham("Dữ liệu chưa hợp lệ.", 400, "INVALID", j.loi as Record<string, string>);
  if (j.error) {
    const trangThai = ["DA_CHAM", "GONE", "MA_TRUNG"].includes(j.error) ? 409 : 502;
    throw new LoiCham(String(j.message || j.error), trangThai, j.error);
  }
  const hs = Object.fromEntries(Object.entries((j.hocSinh as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v ?? "")]));
  return { ma_hoc_sinh: String(j.ma_hoc_sinh), hocSinh: hs as Row };
}

export { TAB_PLACEMENT };
