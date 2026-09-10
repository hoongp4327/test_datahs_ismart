/**
 * Gọi web app Apps Script gắn trong Google Sheet.
 * Dùng chung giữa Netlify Function (production) và Vite dev server.
 */
import { toObjects, type Row } from "./bao-cao";

export type SheetData = { results: Row[]; levels: Row[] };

/**
 * Apps Script thường trả lời trong ~3 giây nhưng đo được những lần vọt lên 14-31 giây.
 * Netlify Function mặc định bị cắt ở 10 giây, nên phải tự bỏ cuộc sớm hơn để còn kịp
 * trả dữ liệu cũ trong cache thay vì để cả request chết.
 */
const TIMEOUT_MS = 8_000;

export async function docQuaAppsScript(url: string, token: string): Promise<SheetData> {
  let res: Response;
  try {
    res = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      throw new Error(`Apps Script không phản hồi trong ${TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Apps Script lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const text = await res.text();
  if (text.includes("accounts.google.com/ServiceLogin")) {
    throw new Error(
      'Apps Script yêu cầu đăng nhập — Deploy lại với "Người có quyền truy cập" = Bất kỳ ai.'
    );
  }

  let json: { error?: string; results?: string[][]; levels?: string[][] };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Apps Script không trả về JSON: ${text.slice(0, 150)}`);
  }

  if (json.error === "UNAUTHORIZED") {
    throw new Error("APPS_SCRIPT_TOKEN không khớp TOKEN trong Code.gs.");
  }
  if (json.error) {
    throw new Error(`Apps Script báo lỗi: ${json.error}`);
  }

  return { results: toObjects(json.results), levels: toObjects(json.levels) };
}
