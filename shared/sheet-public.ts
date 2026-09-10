/**
 * Đọc trực tiếp từ Google Sheet công khai qua giao diện CSV / gviz của Google.
 * Không cần Google Cloud, không cần Service Account, không phụ thuộc quyền hạn Apps Script.
 */
import { toObjects, type Row } from "./bao-cao";
import type { SheetData } from "./apps-script";

export function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let entry = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push(entry);
      entry = "";
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      row.push(entry);
      entry = "";
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) lines.push(row);
      row = [];
    } else {
      entry += c;
    }
  }
  if (entry || row.length > 0) {
    row.push(entry);
    lines.push(row);
  }
  return lines;
}

const TIMEOUT_MS = 8_000;

export async function docQuaGoogleSheetPublic(
  sheetId: string,
  tabResults = "KetQua",
  tabLevels = "BacNangLuc"
): Promise<SheetData> {
  const urlKetQua = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    tabResults
  )}`;
  const urlLevels = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    tabLevels
  )}`;

  let resKetQua: Response;
  let resLevels: Response;

  try {
    [resKetQua, resLevels] = await Promise.all([
      fetch(urlKetQua, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) }),
      fetch(urlLevels, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) }),
    ]);
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      throw new Error(`Google Sheet không phản hồi trong ${TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  }

  if (!resKetQua.ok) {
    throw new Error(`Không đọc được tab "${tabResults}" từ Google Sheet: HTTP ${resKetQua.status}`);
  }
  if (!resLevels.ok) {
    throw new Error(`Không đọc được tab "${tabLevels}" từ Google Sheet: HTTP ${resLevels.status}`);
  }

  const textKetQua = await resKetQua.text();
  const textLevels = await resLevels.text();

  if (textKetQua.includes("<html") && textKetQua.includes("accounts.google.com")) {
    throw new Error(
      "Google Sheet chưa mở quyền xem công khai. Hãy mở Sheet → Chia sẻ (Share) → Bất kỳ ai có đường liên kết → Người xem."
    );
  }

  const rawKetQua = parseCsv(textKetQua);
  const rawLevels = parseCsv(textLevels);

  return {
    results: toObjects(rawKetQua),
    levels: toObjects(rawLevels),
  };
}
