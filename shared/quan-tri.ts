/**
 * Trang quản trị: giáo viên xem danh sách, nhập điểm, thêm học sinh.
 * Google Sheet vẫn là nơi lưu — trang này chỉ đọc qua Apps Script (doGet) và ghi
 * qua Apps Script (doPost). Dùng chung giữa Netlify Function và Vite dev server.
 *
 * Bảo vệ — tuỳ biến môi trường ADMIN_KEY:
 *   - KHÔNG đặt  → trang mở tự do, ai biết đường dẫn /quan-tri cũng sửa được điểm.
 *   - Có đặt     → bắt buộc link /quan-tri#<ADMIN_KEY>. Phần sau # không gửi lên server
 *                  hay lọt vào log; trình duyệt gửi khoá qua header x-admin-key.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeCode, type Row } from "./bao-cao";
import { COT_SUA, kiemTraHocSinh, lamSachTruoc, timXungDot, type CotSua, type HocSinhSua } from "./hoc-sinh-sua";
import { docDuLieu, type CauHinh } from "./nguon-du-lieu";
import duLieuMau from "./du-lieu-mau";

/* ------------------------------------------------------------------ *
 * Khoá quản trị
 * ------------------------------------------------------------------ */

/** So sánh qua SHA-256 để hai chuỗi luôn cùng độ dài, thời gian so không lộ gì. */
function dungKhoa(guiLen: string, khoa: string) {
  if (!khoa || khoa.length < 16 || !guiLen) return false;
  const a = createHash("sha256").update(guiLen).digest();
  const b = createHash("sha256").update(khoa).digest();
  return timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ *
 * Ghi qua Apps Script
 * ------------------------------------------------------------------ */

/** Netlify cắt function ở 10 s — phải tự dừng trước để còn trả lời được. */
const TIMEOUT_GHI_MS = 9_000;

type Truoc = Partial<Record<CotSua, string>> | null;

class LoiGhi extends Error {
  constructor(
    message: string,
    public trangThai = 502,
    public chiTiet?: Record<string, string>,
    public ma = "WRITE_FAILED",
    public xungDot?: Partial<Record<string, string>>
  ) {
    super(message);
  }
}

const LOI_XUNG_DOT = "Trong lúc bạn sửa, người khác đã đổi một số ô của học sinh này.";
const LOI_DA_XOA = "Học sinh này không còn trên sheet (có thể vừa bị xoá). Bấm Tải lại danh sách.";

async function ghiQuaAppsScript(ch: CauHinh, hs: HocSinhSua, truoc: Truoc) {
  let res: Response;
  try {
    res = await fetch(ch.appsScriptUrl, {
      method: "POST",
      // text/plain để Apps Script nhận nguyên chuỗi trong e.postData.contents
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: ch.appsScriptToken, action: "luu", hocSinh: hs, truoc }),
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_GHI_MS),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      throw new LoiGhi(
        "Google phản hồi quá chậm. Có thể đã lưu — bấm Tải lại danh sách để kiểm tra trước khi lưu lại.",
        504
      );
    }
    throw err;
  }

  const text = await res.text();
  let json: {
    ok?: boolean;
    error?: string;
    message?: string;
    loi?: Record<string, string>;
    xungDot?: Record<string, string>;
    moi?: boolean;
  };
  try {
    json = JSON.parse(text);
  } catch {
    // Bản triển khai cũ không có hàm doPost: Google trả trang HTML báo "không tìm thấy hàm".
    if (/doPost/.test(text)) {
      throw new LoiGhi("Apps Script chưa có chức năng ghi — dán Code.gs mới rồi triển khai phiên bản mới.");
    }
    throw new LoiGhi(`Apps Script không trả về JSON (${res.status}): ${text.slice(0, 120)}`);
  }

  if (json.error === "UNAUTHORIZED") throw new LoiGhi("APPS_SCRIPT_TOKEN không khớp TOKEN trong Code.gs.");
  if (json.error === "UNKNOWN_ACTION" || (!json.ok && !json.error)) {
    throw new LoiGhi("Apps Script chưa có chức năng ghi — dán Code.gs mới rồi triển khai phiên bản mới.");
  }
  if (json.error === "INVALID") throw new LoiGhi("Dữ liệu chưa hợp lệ.", 400, json.loi);
  if (json.error === "CONFLICT") throw new LoiGhi(LOI_XUNG_DOT, 409, undefined, "CONFLICT", json.xungDot);
  if (json.error === "GONE") throw new LoiGhi(LOI_DA_XOA, 409, undefined, "GONE");
  if (json.error) throw new LoiGhi(json.message || `Apps Script báo lỗi: ${json.error}`);
  return { moi: Boolean(json.moi) };
}

/** Chế độ dữ liệu mẫu: ghi vào bộ nhớ để thử giao diện, tắt server là mất. */
function ghiVaoMau(hs: HocSinhSua, truoc: Truoc) {
  const ds = (duLieuMau as { ketQua: Row[] }).ketQua;
  const ma = normalizeCode(hs.ma_hoc_sinh);
  for (let i = ds.length - 1; i >= 0; i--) {
    if (normalizeCode(ds[i].ma_hoc_sinh) === ma) {
      if (truoc) {
        const xd = timXungDot(ds[i], hs, truoc);
        if (Object.keys(xd).length) throw new LoiGhi(LOI_XUNG_DOT, 409, undefined, "CONFLICT", xd);
      }
      ds[i] = { ...ds[i], ...(hs as Row) };
      return { moi: false };
    }
  }
  if (truoc) throw new LoiGhi(LOI_DA_XOA, 409, undefined, "GONE");
  ds.push({ ...(Object.fromEntries(COT_SUA.map((c) => [c, ""])) as Row), ...(hs as Row) });
  return { moi: true };
}

/* ------------------------------------------------------------------ *
 * Handler — nhận Request chuẩn web, trả Response
 * ------------------------------------------------------------------ */

const traJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Netlify-CDN-Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });

export async function xuLyQuanTri(req: Request, ch: CauHinh, adminKey: string): Promise<Response> {
  if (adminKey && adminKey.length < 16) {
    return traJson({ error: "WEAK_KEY", message: "ADMIN_KEY quá ngắn (cần ít nhất 16 ký tự)." }, 503);
  }
  if (adminKey && !dungKhoa(req.headers.get("x-admin-key") ?? "", adminKey)) {
    return traJson({ error: "UNAUTHORIZED", message: "Link quản trị không đúng hoặc đã được đổi." }, 401);
  }

  const dungMau = ch.chiDungMau || (!ch.appsScriptUrl && !ch.sheetId);

  try {
    if (req.method === "GET") {
      // Không cache: giáo viên vừa sửa trên sheet thì mở trang là phải thấy ngay.
      const { data, nguon } = await docDuLieu(ch);
      return traJson({
        nguon,
        coTheGhi: dungMau || Boolean(ch.appsScriptUrl),
        hocSinh: data.ketQua,
        moTa: data.moTa.map((r) => ({
          ky_nang: r.ky_nang,
          option: r.option,
          diem_tu: r.diem_tu,
          mo_ta: r.mo_ta,
        })),
        thangLevel: data.thangLevel.map((r) => ({ level: r.level, diem_tu: r.diem_tu })),
      });
    }

    if (req.method === "POST") {
      let body: { hocSinh?: unknown; truoc?: unknown };
      try {
        const text = await req.text();
        if (text.length > 20_000) return traJson({ error: "TOO_LARGE", message: "Dữ liệu quá lớn." }, 413);
        body = JSON.parse(text);
      } catch {
        return traJson({ error: "BAD_REQUEST", message: "Dữ liệu gửi lên không đọc được." }, 400);
      }

      const { loi, sach } = kiemTraHocSinh(body.hocSinh);
      if (Object.keys(loi).length) {
        return traJson({ error: "INVALID", message: "Dữ liệu chưa hợp lệ.", loi }, 400);
      }

      if (!dungMau && !ch.appsScriptUrl) {
        return traJson(
          { error: "READ_ONLY", message: "Chưa cấu hình APPS_SCRIPT_URL nên chưa lưu vào sheet được." },
          501
        );
      }
      const truoc = lamSachTruoc(body.truoc);
      const { moi } = dungMau ? ghiVaoMau(sach, truoc) : await ghiQuaAppsScript(ch, sach, truoc);
      return traJson({ ok: true, moi, ma_hoc_sinh: sach.ma_hoc_sinh, nguon: dungMau ? "dữ liệu mẫu" : "Apps Script" });
    }

    return traJson({ error: "METHOD_NOT_ALLOWED" }, 405);
  } catch (err) {
    if (err instanceof LoiGhi) {
      return traJson({ error: err.ma, message: err.message, loi: err.chiTiet, xungDot: err.xungDot }, err.trangThai);
    }
    console.error("[quan-tri]", err);
    return traJson({ error: "SERVER_ERROR", message: (err as Error).message || "Lỗi máy chủ." }, 500);
  }
}
