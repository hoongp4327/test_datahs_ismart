/**
 * Đọc trực tiếp từ Google Sheet công khai qua giao diện CSV / gviz của Google.
 * Không cần Google Cloud, không cần Service Account, không phụ thuộc quyền hạn Apps Script.
 *
 * ⚠ Chỉ chạy được khi sheet để chế độ "Bất kỳ ai có đường liên kết" — tức là ai biết
 * Sheet ID cũng tải được toàn bộ dữ liệu. Chỉ nên là đường dự phòng.
 */
import { toObjects, type SheetData } from "./bao-cao";
import type { TenTab } from "./nguon-du-lieu";

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

async function docMotTab(sheetId: string, ten: string): Promise<string[][]> {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv` +
    `&sheet=${encodeURIComponent(ten)}`;

  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      throw new Error(`Google Sheet không phản hồi trong ${TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Không đọc được tab "${ten}" từ Google Sheet: HTTP ${res.status}`);
  }

  const text = await res.text();
  if (text.includes("<html") && text.includes("accounts.google.com")) {
    throw new Error(
      "Google Sheet chưa mở quyền xem công khai, nên không đọc trực tiếp được."
    );
  }
  return parseCsv(text);
}

export async function docQuaGoogleSheetPublic(sheetId: string, tab: TenTab): Promise<SheetData> {
  const [ketQua, moTa, thangLevel] = await Promise.all([
    docMotTab(sheetId, tab.ketQua),
    docMotTab(sheetId, tab.moTa),
    docMotTab(sheetId, tab.thangLevel),
  ]);
  return {
    ketQua: toObjects(ketQua),
    moTa: toObjects(moTa),
    thangLevel: toObjects(thangLevel),
  };
}
