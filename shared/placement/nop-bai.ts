/**
 * POST /api/placement — học sinh nộp bài: chấm điểm ở server rồi ghi 1 dòng vào tab
 * PlacementTest của Google Sheet (qua Apps Script, action "nopBaiTest").
 * Dùng chung giữa Netlify Function và Vite dev server.
 */
import type { CauHinh } from "../nguon-du-lieu";
import { MOI_CAU } from "./de-thi";
import { chamBai, DAP_AN } from "./dap-an";

export const TAB_PLACEMENT = "PlacementTest";

/** Netlify cắt function ở 10 s. */
const TIMEOUT_MS = 9_000;

const KY_HIEU = { dung: "✓", sai: "✗", trong: "", "chua-co-dap-an": "?", "gv-cham": "" } as const;

/** Cột giáo viên nhập điểm Writing Part 2. */
const COT_GV = "diem_writing_p2_gv";

/**
 * Cột tính bằng công thức trên sheet: giáo viên gõ điểm Part 2 là tổng tự cập nhật.
 * {ten_cot} = ô của cột đó trên cùng dòng — Apps Script đổi thành địa chỉ A1 thật.
 */
const CONG_THUC: Record<string, string> = {
  diem_writing: `=IF({${COT_GV}}="","",{diem_writing_p1}+{${COT_GV}})`,
  tong_diem: `=IF({${COT_GV}}="","",{diem_listening}+{diem_reading}+{diem_writing})`,
  trang_thai: `=IF({${COT_GV}}="","Chờ GV chấm Writing P2","Đã chấm xong")`,
};

type BaiNop = {
  maBai: string;
  hoTen: string;
  ngaySinh: string;
  batDau: number;
  traLoi: Record<string, string>;
  hetGio?: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function kiemTra(b: Partial<BaiNop>): string | null {
  if (!b || typeof b !== "object") return "Dữ liệu không hợp lệ.";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(String(b.maBai ?? ""))) return "Thiếu mã bài làm.";
  if (!String(b.hoTen ?? "").trim()) return "Vui lòng nhập họ tên.";
  if (!String(b.ngaySinh ?? "").trim()) return "Vui lòng nhập ngày sinh.";
  if (!b.traLoi || typeof b.traLoi !== "object") return "Thiếu bài làm.";
  return null;
}

/** Giờ Việt Nam dạng dd/MM/yyyy HH:mm:ss — không phụ thuộc múi giờ của server. */
function gioVN(ms: number) {
  const d = new Date(ms + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** Một dòng của tab PlacementTest. Thứ tự key = thứ tự cột khi tab được tạo mới. */
export function taoDong(b: BaiNop, bayGio = Date.now()) {
  const kq = chamBai(b.traLoi);
  const phut = Math.max(0, Math.round((bayGio - Number(b.batDau || bayGio)) / 6000) / 10);
  const ghiChu = [
    b.hetGio ? "Hết giờ, tự nộp" : "",
    kq.chuaCoDapAn.length ? `Chưa có đáp án: ${kq.chuaCoDapAn.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const cauGv = kq.chiTiet.filter((c) => c.trangThai === "gv-cham");

  // Thứ tự cột khi tab được tạo mới: thông tin → điểm → phần GV chấm (bài viết đặt ngay cạnh
  // ô nhập điểm) → chi tiết từng câu máy chấm.
  const dong: Record<string, string | number> = {
    ma_bai: b.maBai,
    thoi_gian_nop: gioVN(bayGio),
    ho_ten: String(b.hoTen).trim().slice(0, 120),
    ngay_sinh: String(b.ngaySinh).trim().slice(0, 20),
    trang_thai: "",
    diem_listening: kq.listening,
    diem_reading: kq.reading,
    diem_writing_p1: kq.writing, // chỉ phần máy chấm (Part 1)
    [COT_GV]: "",
    diem_writing: "",
    tong_diem: "",
    ...Object.fromEntries(cauGv.map((c) => [`cau_${c.id}`, c.traLoi])),
    thoi_gian_lam_phut: phut,
    ghi_chu: ghiChu,
  };
  // Câu máy chấm: "E ✓", "B ✗", "park ?" (chưa có đáp án)
  for (const c of kq.chiTiet) {
    if (c.trangThai === "gv-cham") continue;
    dong[`cau_${c.id}`] = `${c.traLoi} ${KY_HIEU[c.trangThai]}`.trim();
  }

  /** Ghi chú trên ô tiêu đề — giáo viên rê chuột vào là thấy đáp án gợi ý. */
  const chuThich: Record<string, string> = {
    [COT_GV]: `Giáo viên nhập điểm Writing Part 2: 0–${kq.toiDaGv} (${cauGv.length} câu × ${cauGv[0]?.toiDa ?? 0} điểm). Nhập xong, diem_writing và tong_diem tự tính.`,
    diem_writing_p1: "Writing Part 1 (sắp xếp chữ) — máy chấm.",
  };
  for (const c of cauGv) {
    const da = DAP_AN[c.id];
    if (da && "goiY" in da) chuThich[`cau_${c.id}`] = `Gợi ý: ${da.goiY} (tối đa ${c.toiDa} điểm)`;
  }

  return { dong, kq, congThuc: CONG_THUC, chuThich, rangBuoc: { [COT_GV]: [0, kq.toiDaGv] as [number, number] } };
}

/** Bộ nhớ tạm khi chưa có Apps Script — để chạy thử giao diện. */
export const BAI_NOP_MAU: Record<string, string | number>[] = [];

async function ghiQuaAppsScript(ch: CauHinh, banGhi: Omit<ReturnType<typeof taoDong>, "kq">) {
  const res = await fetch(ch.appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: ch.appsScriptToken, action: "nopBaiTest", tab: TAB_PLACEMENT, ...banGhi }),
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let j: { ok?: boolean; error?: string; message?: string; trung?: boolean };
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`Apps Script không trả về JSON (${res.status}).`);
  }
  if (j.error === "UNKNOWN_ACTION") {
    throw new Error("Apps Script chưa có chức năng nộp bài — dán Code.gs mới rồi triển khai phiên bản mới.");
  }
  if (j.error) throw new Error(j.message || `Apps Script báo lỗi: ${j.error}`);
  return { trung: Boolean(j.trung) };
}

export async function xuLyNopBai(req: Request, ch: CauHinh, log: (m: string) => void = console.log) {
  if (req.method !== "POST") return json({ error: "METHOD", message: "Chỉ nhận POST." }, 405);

  let b: BaiNop;
  try {
    b = (await req.json()) as BaiNop;
  } catch {
    return json({ error: "BAD_REQUEST", message: "Dữ liệu không hợp lệ." }, 400);
  }
  const loi = kiemTra(b);
  if (loi) return json({ error: "INVALID", message: loi }, 400);

  // Chỉ nhận đúng các câu có trong đề.
  const traLoi: Record<string, string> = {};
  for (const c of MOI_CAU) traLoi[c.id] = String(b.traLoi[c.id] ?? "").slice(0, 300);
  const { kq, ...banGhi } = taoDong({ ...b, traLoi });
  const { dong } = banGhi;
  const tomTat = `L ${kq.listening} · R ${kq.reading} · W-P1 ${kq.writing} · chờ GV chấm W-P2`;

  try {
    if (ch.chiDungMau || !ch.appsScriptUrl) {
      if (!BAI_NOP_MAU.some((d) => d.ma_bai === dong.ma_bai)) BAI_NOP_MAU.push(dong);
      log(`[placement] (chưa nối sheet) ${dong.ho_ten} → ${tomTat}`);
    } else {
      const { trung } = await ghiQuaAppsScript(ch, banGhi);
      log(`[placement] ${dong.ho_ten} → ${tomTat}${trung ? " (đã có, bỏ qua)" : ""}`);
    }
  } catch (err) {
    const timeout = (err as Error).name === "TimeoutError";
    log(`[placement] LỖI ghi sheet: ${(err as Error).message}`);
    return json(
      {
        error: "WRITE_FAILED",
        message: timeout ? "Máy chủ phản hồi chậm, vui lòng bấm Nộp lại." : "Chưa lưu được bài, vui lòng bấm Nộp lại.",
      },
      timeout ? 504 : 502
    );
  }

  return json({
    ok: true,
    diem: { listening: kq.listening, reading: kq.reading, writing: kq.writing, tong: kq.tong },
  });
}

/** Đếm cho chắc biểu điểm khớp 20/20/15 — gọi trong kiểm thử. */
export function tongDiemToiDa() {
  const t = { listening: 0, reading: 0, writing: 0 };
  for (const c of MOI_CAU) t[c.kyNang] += DAP_AN[c.id]?.diem ?? 0;
  return t;
}
