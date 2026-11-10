import { JWT } from "google-auth-library";
import type { Context } from "@netlify/functions";
import { buildReport, normalizeCode, timHocSinh, toObjects, type SheetData } from "../../shared/bao-cao";
import { cauHinhTuEnv, docDuLieu } from "../../shared/nguon-du-lieu";

/* ------------------------------------------------------------------ *
 * Cấu hình
 * ------------------------------------------------------------------ */
const CAU_HINH = cauHinhTuEnv(process.env);
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

/**
 * Thời gian giữ cache trong bộ nhớ của function (giây).
 *
 * Độ tươi dữ liệu do `refresh=1` lo (trang web gửi mỗi lần tải trang). Cache ở đây
 * chỉ phục vụ các lượt tra cứu tiếp theo trong cùng phiên xem và gộp request khi
 * nhiều phụ huynh tra cùng lúc. Đặt 0 để mỗi lượt đều đọc thẳng Google (~3 s/lượt).
 */
const TTL_GIAY = Number(process.env.CACHE_TTL_SECONDS ?? 60);
const MEMORY_TTL = TTL_GIAY * 1000;

/**
 * Request có `refresh=1` bỏ qua cache và đọc mới. Vẫn giữ một mức sàn để F5 liên
 * tục không bắn hàng loạt lượt gọi vào Google — và để React StrictMode gọi effect
 * hai lần chỉ tốn một lượt đọc.
 */
const SAN_LAM_MOI = 3_000;

/** Cache sống cùng warm container. */
let cache: { at: number; data: SheetData } | null = null;

/* ------------------------------------------------------------------ *
 * Service account (tùy chọn) — chỉ function có, dev server không có
 * ------------------------------------------------------------------ */
function coServiceAccount() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && CAU_HINH.sheetId
  );
}

async function docQuaSheetsApi(): Promise<SheetData> {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Netlify lưu env var một dòng nên ký tự xuống dòng bị escape thành "\n".
    key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
  const { token } = await auth.getAccessToken();

  const { tab } = CAU_HINH;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CAU_HINH.sheetId}/values:batchGet` +
    [tab.ketQua, tab.moTa, tab.thangLevel]
      .map((t, i) => `${i ? "&" : "?"}ranges=${encodeURIComponent(t)}`)
      .join("") +
    `&majorDimension=ROWS`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Google Sheets API lỗi ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { valueRanges: { values?: string[][] }[] };
  return {
    ketQua: toObjects(json.valueRanges?.[0]?.values),
    moTa: toObjects(json.valueRanges?.[1]?.values),
    thangLevel: toObjects(json.valueRanges?.[2]?.values),
  };
}

async function fetchSheet(lamMoi = false): Promise<SheetData> {
  const nguong = lamMoi ? SAN_LAM_MOI : MEMORY_TTL;
  if (cache && Date.now() - cache.at < nguong) return cache.data;

  try {
    const { data } = await docDuLieu(CAU_HINH, {
      sheetsApi: coServiceAccount() ? docQuaSheetsApi : undefined,
    });
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    // Google chậm hoặc lỗi: thà trả dữ liệu cũ một chút còn hơn hiện trang lỗi.
    if (cache) {
      const tuoi = Math.round((Date.now() - cache.at) / 1000);
      console.warn(`[result] ${(err as Error).message} — dùng cache cũ ${tuoi}s.`);
      return cache.data;
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Không cache ở trình duyệt lẫn CDN: CDN lưu theo từng URL nên mỗi mã học sinh
      // là một bản riêng — với lưu lượng một trung tâm thì hầu như lần nào cũng trượt
      // cache, gần như không nhanh hơn mà lại giữ dữ liệu cũ.
      "Netlify-CDN-Cache-Control": "no-store",
      "Cache-Control": "no-store",
    },
  });

export default async (req: Request, _context: Context) => {
  const params = new URL(req.url).searchParams;
  const code = normalizeCode(params.get("code") ?? "");
  // Trang web gửi refresh=1 mỗi lần tải trang -> đọc lại dữ liệu mới nhất.
  const lamMoi = params.has("refresh");

  if (!code) {
    return json({ error: "MISSING_CODE", message: "Vui lòng nhập mã học sinh." }, 400);
  }

  try {
    const data = await fetchSheet(lamMoi);
    const row = timHocSinh(data.ketQua, code);

    if (!row) {
      return json(
        {
          error: "NOT_FOUND",
          message: "Không tìm thấy kết quả cho mã học sinh này. Vui lòng kiểm tra lại.",
        },
        404
      );
    }

    return json({ data: buildReport(row, data) }, 200);
  } catch (err) {
    console.error("[result]", err);
    return json(
      { error: "SERVER_ERROR", message: "Hệ thống đang bận, vui lòng thử lại sau ít phút." },
      500
    );
  }
};
