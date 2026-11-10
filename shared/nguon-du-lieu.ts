/**
 * Chọn nguồn dữ liệu và đọc 3 tab của Google Sheet.
 * Dùng chung giữa Netlify Function và Vite dev server — trước đây logic này bị
 * chép ở hai nơi và lệch nhau.
 *
 * Thứ tự ưu tiên:
 *   1. NGUON_DU_LIEU=mau   → luôn dùng dữ liệu mẫu (xem giao diện, không cần mạng)
 *   2. Apps Script         → lỗi thì rơi xuống (4) nếu có GOOGLE_SHEET_ID
 *   3. Service account     → chỉ Netlify Function truyền vào, dev server không có
 *   4. Sheet công khai     → đọc thẳng qua GOOGLE_SHEET_ID
 *   5. Dữ liệu mẫu         → chưa cấu hình gì
 */
import type { Row, SheetData } from "./bao-cao";
import { docQuaAppsScript } from "./apps-script";
import { docQuaGoogleSheetPublic } from "./sheet-public";
import duLieuMau from "./du-lieu-mau";

export type TenTab = { ketQua: string; moTa: string; thangLevel: string };

export type CauHinh = {
  chiDungMau: boolean;
  appsScriptUrl: string;
  appsScriptToken: string;
  sheetId: string;
  tab: TenTab;
};

export function cauHinhTuEnv(env: Record<string, string | undefined>): CauHinh {
  return {
    chiDungMau: (env.NGUON_DU_LIEU ?? "").trim().toLowerCase() === "mau",
    appsScriptUrl: env.APPS_SCRIPT_URL ?? "",
    appsScriptToken: env.APPS_SCRIPT_TOKEN ?? "",
    sheetId: env.GOOGLE_SHEET_ID ?? "",
    tab: {
      ketQua: env.SHEET_TAB_KET_QUA || "KetQua",
      moTa: env.SHEET_TAB_MO_TA || "MoTaKyNang",
      thangLevel: env.SHEET_TAB_THANG_LEVEL || "ThangLevel",
    },
  };
}

/** Cột nhận diện của mỗi tab. */
const COT_NHAN_DIEN: Record<keyof SheetData, string> = {
  ketQua: "ma_hoc_sinh",
  moTa: "ky_nang",
  thangLevel: "level",
};

/**
 * Bỏ những tab đọc về mà thiếu cột nhận diện.
 *
 * Lý do có hàm này: hỏi Google một tab **không tồn tại**, nó không báo lỗi mà lặng lẽ
 * trả về tab đầu tiên của sheet. Không chặn thì bảng điểm sẽ bị đọc nhầm làm bảng Level.
 */
function boTabSai(data: SheetData, tab: TenTab, canhBao: (m: string) => void): SheetData {
  const ketQua = { ...data };
  for (const k of Object.keys(COT_NHAN_DIEN) as (keyof SheetData)[]) {
    const rows: Row[] = data[k];
    if (rows.length && !(COT_NHAN_DIEN[k] in rows[0])) {
      canhBao(`Tab "${tab[k]}" không có cột "${COT_NHAN_DIEN[k]}" — sai tên tab hoặc sai cấu trúc, bỏ qua.`);
      ketQua[k] = [];
    }
  }
  return ketQua;
}

export async function docDuLieu(
  ch: CauHinh,
  opts: {
    sheetsApi?: () => Promise<SheetData>;
    canhBao?: (m: string) => void;
  } = {}
): Promise<{ data: SheetData; nguon: string }> {
  const canhBao = opts.canhBao ?? ((m: string) => console.warn(`[du-lieu] ${m}`));
  const mau = { data: duLieuMau as SheetData, nguon: "dữ liệu mẫu" };

  if (ch.chiDungMau) return mau;

  if (ch.appsScriptUrl) {
    try {
      const data = await docQuaAppsScript(ch.appsScriptUrl, ch.appsScriptToken, ch.tab);
      return { data: boTabSai(data, ch.tab, canhBao), nguon: "Apps Script" };
    } catch (err) {
      if (!ch.sheetId) throw err;
      canhBao(`Apps Script lỗi (${(err as Error).message}) — chuyển sang đọc sheet công khai.`);
    }
  } else if (opts.sheetsApi) {
    return { data: boTabSai(await opts.sheetsApi(), ch.tab, canhBao), nguon: "Sheets API" };
  }

  if (ch.sheetId) {
    const data = await docQuaGoogleSheetPublic(ch.sheetId, ch.tab);
    return { data: boTabSai(data, ch.tab, canhBao), nguon: "sheet công khai" };
  }

  canhBao("Chưa cấu hình nguồn dữ liệu — đang dùng dữ liệu mẫu.");
  return mau;
}
