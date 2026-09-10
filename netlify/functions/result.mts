import { JWT } from "google-auth-library";
import type { Context } from "@netlify/functions";
import { buildReport, normalizeCode, timHocSinh, toObjects } from "../../shared/bao-cao";
import { docQuaAppsScript, type SheetData } from "../../shared/apps-script";
import duLieuMau from "../../shared/du-lieu-mau";

/* ------------------------------------------------------------------ *
 * Cấu hình
 * ------------------------------------------------------------------ */
const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "";
const TAB_RESULTS = process.env.SHEET_TAB_RESULTS ?? "KetQua";
const TAB_LEVELS = process.env.SHEET_TAB_LEVELS ?? "BacNangLuc";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? "";
const APPS_SCRIPT_TOKEN = process.env.APPS_SCRIPT_TOKEN ?? "";

/**
 * Thời gian giữ cache trong bộ nhớ của function (giây).
 * Apps Script mất ~2-5s cho lần gọi nguội, nên để dài hơn Sheets API.
 * Đây cũng chính là độ trễ tối đa từ lúc sửa sheet đến lúc web hiện dữ liệu mới.
 */
const TTL_GIAY = Number(process.env.CACHE_TTL_SECONDS || 300);
const MEMORY_TTL = TTL_GIAY * 1000;

/** Cache sống cùng warm container -> bỏ qua vòng gọi Google Sheets API. */
let cache: { at: number; data: SheetData } | null = null;

/* ------------------------------------------------------------------ *
 * Google Sheets
 * ------------------------------------------------------------------ */
function coAppsScript() {
  return Boolean(APPS_SCRIPT_URL);
}

function coServiceAccount() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && SHEET_ID
  );
}

/** Cách 2: gọi thẳng Google Sheets API bằng service account. */
async function docQuaSheetsApi(): Promise<SheetData> {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Netlify lưu env var một dòng nên ký tự xuống dòng bị escape thành "\n".
    key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
  const { token } = await auth.getAccessToken();

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet` +
    `?ranges=${encodeURIComponent(TAB_RESULTS)}` +
    `&ranges=${encodeURIComponent(TAB_LEVELS)}` +
    `&majorDimension=ROWS`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Google Sheets API lỗi ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { valueRanges: { values?: string[][] }[] };
  return {
    results: toObjects(json.valueRanges?.[0]?.values),
    levels: toObjects(json.valueRanges?.[1]?.values),
  };
}

/**
 * Thứ tự ưu tiên nguồn dữ liệu:
 *   1. Apps Script  (chỉ cần dán URL — không cần Google Cloud)
 *   2. Sheets API   (service account)
 *   3. Dữ liệu mẫu  (chưa cấu hình gì — để xem giao diện)
 */
async function fetchSheet(): Promise<SheetData> {
  if (cache && Date.now() - cache.at < MEMORY_TTL) return cache.data;

  if (!coAppsScript() && !coServiceAccount()) {
    console.warn("[result] Chưa cấu hình nguồn dữ liệu — đang dùng dữ liệu mẫu.");
    return duLieuMau as SheetData;
  }

  try {
    const data = coAppsScript()
      ? await docQuaAppsScript(APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN)
      : await docQuaSheetsApi();
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    // Google chậm hoặc lỗi: thà trả dữ liệu cũ còn hơn báo lỗi cho phụ huynh.
    // Cache hết hạn vẫn dùng được — dữ liệu chỉ cũ vài phút.
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
const json = (body: unknown, status: number, cacheable: boolean) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // CDN của Netlify giữ bản sao ở edge -> request sau gần như tức thì.
      // stale-while-revalidate: hết hạn vẫn trả bản cũ ngay rồi làm mới ngầm,
      // nên người dùng không bao giờ phải chờ Apps Script khởi động.
      "Netlify-CDN-Cache-Control": cacheable
        ? `public, max-age=${TTL_GIAY}, stale-while-revalidate=${TTL_GIAY * 4}`
        : "no-store",
      "Cache-Control": cacheable ? `public, max-age=${Math.round(TTL_GIAY / 2)}` : "no-store",
    },
  });

export default async (req: Request, _context: Context) => {
  const code = normalizeCode(new URL(req.url).searchParams.get("code") ?? "");

  if (!code) {
    return json({ error: "MISSING_CODE", message: "Vui lòng nhập mã học sinh." }, 400, false);
  }

  try {
    const { results, levels } = await fetchSheet();
    const row = timHocSinh(results, code);

    if (!row) {
      return json(
        {
          error: "NOT_FOUND",
          message: "Không tìm thấy kết quả cho mã học sinh này. Vui lòng kiểm tra lại.",
        },
        404,
        false
      );
    }

    return json({ data: buildReport(row, levels) }, 200, true);
  } catch (err) {
    console.error("[result]", err);
    return json(
      { error: "SERVER_ERROR", message: "Hệ thống đang bận, vui lòng thử lại sau ít phút." },
      500,
      false
    );
  }
};
