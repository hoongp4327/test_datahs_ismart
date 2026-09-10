/**
 * Kiểm tra kết nối tới Google Sheet và chẩn đoán lỗi bằng tiếng Việt.
 *   npm run kiem-tra
 *
 * Tự nhận biết đang dùng Apps Script hay service account dựa trên file .env.
 */
import { JWT } from "google-auth-library";

const OK = "\x1b[32m✓\x1b[0m";
const X = "\x1b[31m✗\x1b[0m";
const WARN = "\x1b[33m!\x1b[0m";

const env = (k) => process.env[k]?.trim().replace(/^["']|["']$/g, "") || "";

const appsScriptUrl = env("APPS_SCRIPT_URL");
const appsScriptToken = env("APPS_SCRIPT_TOKEN");
const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const rawKey = env("GOOGLE_PRIVATE_KEY");
const sheetId = env("GOOGLE_SHEET_ID");
const tabResults = env("SHEET_TAB_RESULTS") || "KetQua";
const tabLevels = env("SHEET_TAB_LEVELS") || "BacNangLuc";

function thoat(msg, goiY) {
  console.log(`\n${X} ${msg}`);
  if (goiY) console.log(`  → ${goiY}`);
  process.exit(1);
}

console.log("\n=== Kiểm tra kết nối Google Sheet ===\n");

/* ------------------------------------------------------------------ *
 * Cách 1: Apps Script
 * ------------------------------------------------------------------ */
async function quaAppsScript() {
  console.log(`${OK} Chế độ: Apps Script`);

  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(appsScriptUrl)) {
    console.log(`${WARN} URL không đúng dạng .../exec — kiểm tra lại "Web app URL" khi Deploy.`);
  }
  console.log(`${OK} URL: ${appsScriptUrl}`);

  if (!appsScriptToken) {
    thoat("Thiếu APPS_SCRIPT_TOKEN.", "Điền đúng chuỗi TOKEN bạn đặt trong file Code.gs.");
  }
  if (appsScriptToken.startsWith("DOI-CHUOI-NAY")) {
    thoat(
      "APPS_SCRIPT_TOKEN vẫn là chuỗi mặc định.",
      "Đổi TOKEN trong Code.gs thành chuỗi ngẫu nhiên, rồi điền chuỗi đó vào .env."
    );
  }

  let res;
  try {
    res = await fetch(`${appsScriptUrl}?token=${encodeURIComponent(appsScriptToken)}`, {
      redirect: "follow",
    });
  } catch (err) {
    thoat(`Không gọi được Apps Script: ${err.message}`, "Kiểm tra URL và kết nối mạng.");
  }

  const text = await res.text();

  if (text.includes("<title>Sign in") || text.includes("accounts.google.com/ServiceLogin")) {
    throw new Error(
      'Apps Script yêu cầu đăng nhập — Deploy lại với "Who has access" = Anyone.'
    );
  }
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("Apps Script trả về lỗi 403 (Chưa phân quyền 'Anyone' hoặc bị quản trị viên Workspace chặn)");
    }
    throw new Error(`Apps Script trả về lỗi ${res.status}: ${text.slice(0, 100)}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      "Apps Script không trả về JSON: " + text.slice(0, 120)
    );
  }

  if (json.error === "UNAUTHORIZED") {
    throw new Error(
      "APPS_SCRIPT_TOKEN trong .env không khớp chuỗi TOKEN trong Code.gs."
    );
  }
  if (json.error) {
    throw new Error(`Apps Script báo lỗi: ${json.error}`);
  }

  return { results: json.results ?? [], levels: json.levels ?? [] };
}

/* ------------------------------------------------------------------ *
 * Cách 1b: Google Sheet trực tiếp (Public Sheet qua ID)
 * ------------------------------------------------------------------ */
function parseCsv(text) {
  const lines = [];
  let row = [];
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

async function quaGoogleSheetPublic() {
  console.log(`${OK} Chế độ: Đọc trực tiếp Google Sheet ID (Public Sheet)`);
  console.log(`${OK} GOOGLE_SHEET_ID: ${sheetId}`);

  const urlKq = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabResults)}`;
  const urlBac = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabLevels)}`;

  let resKq, resBac;
  try {
    [resKq, resBac] = await Promise.all([
      fetch(urlKq, { redirect: "follow" }),
      fetch(urlBac, { redirect: "follow" }),
    ]);
  } catch (err) {
    thoat(`Không kết nối được Google Sheet: ${err.message}`);
  }

  if (!resKq.ok) {
    thoat(`Không đọc được tab "${tabResults}": HTTP ${resKq.status}`);
  }
  if (!resBac.ok) {
    thoat(`Không đọc được tab "${tabLevels}": HTTP ${resBac.status}`);
  }

  const textKq = await resKq.text();
  const textBac = await resBac.text();

  if (textKq.includes("<html") && textKq.includes("accounts.google.com")) {
    thoat("Sheet chưa mở quyền xem công khai.", "Vào Google Sheet → Share → Bất kỳ ai có liên kết → Người xem.");
  }

  return { results: parseCsv(textKq), levels: parseCsv(textBac) };
}

/* ------------------------------------------------------------------ *
 * Cách 2: Service account + Sheets API
 * ------------------------------------------------------------------ */
async function quaSheetsApi() {
  console.log(`${OK} Chế độ: Service account (Google Sheets API)`);

  if (!sheetId) thoat("Thiếu GOOGLE_SHEET_ID.", "Kiểm tra file .env ở thư mục gốc.");
  console.log(`${OK} GOOGLE_SHEET_ID: ${sheetId}`);

  if (!email) {
    thoat(
      "Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL.",
      'Mở file JSON service account, copy giá trị "client_email" vào .env.'
    );
  }
  if (!email.endsWith(".iam.gserviceaccount.com")) {
    console.log(`${WARN} Email không có đuôi .iam.gserviceaccount.com — có thể dán nhầm email cá nhân.`);
  }
  console.log(`${OK} Service account: ${email}`);

  if (!rawKey) {
    thoat(
      "Thiếu GOOGLE_PRIVATE_KEY.",
      'Copy nguyên giá trị "private_key" trong file JSON (giữ nguyên các ký tự \\n) vào .env.'
    );
  }
  const key = rawKey.replace(/\\n/g, "\n");
  if (!key.includes("BEGIN PRIVATE KEY")) {
    thoat(
      "GOOGLE_PRIVATE_KEY không đúng định dạng.",
      'Chuỗi phải bắt đầu bằng "-----BEGIN PRIVATE KEY-----".'
    );
  }
  console.log(`${OK} Private key: đúng định dạng (${key.length} ký tự)`);

  let token;
  try {
    const auth = new JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    ({ token } = await auth.getAccessToken());
    console.log(`${OK} Xác thực Google: thành công`);
  } catch (err) {
    thoat(
      `Xác thực thất bại: ${err.message}`,
      "Thường do private key bị copy thiếu, hoặc service account đã bị xoá."
    );
  }

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet` +
    `?ranges=${encodeURIComponent(tabResults)}` +
    `&ranges=${encodeURIComponent(tabLevels)}` +
    `&majorDimension=ROWS`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 403) {
    const body = await res.text();
    if (body.includes("SERVICE_DISABLED") || body.includes("has not been used")) {
      thoat(
        "Google Sheets API chưa được bật cho project này.",
        "Google Cloud Console → APIs & Services → Library → Google Sheets API → Enable."
      );
    }
    thoat(
      "Không có quyền đọc sheet (403).",
      `Mở Google Sheet → Share → dán ${email} → quyền Viewer → Send.`
    );
  }
  if (res.status === 404) {
    thoat("Không tìm thấy sheet (404).", "GOOGLE_SHEET_ID sai. Lấy lại ID từ URL của sheet.");
  }
  if (!res.ok) {
    thoat(`Google Sheets API trả về lỗi ${res.status}.`, (await res.text()).slice(0, 300));
  }

  const { valueRanges } = await res.json();
  return { results: valueRanges?.[0]?.values ?? [], levels: valueRanges?.[1]?.values ?? [] };
}

/* ------------------------------------------------------------------ *
 * Chạy
 * ------------------------------------------------------------------ */
if (!appsScriptUrl && !sheetId && (!email || !rawKey)) {
  thoat(
    "Chưa cấu hình nguồn dữ liệu nào trong .env.",
    "Điền GOOGLE_SHEET_ID (cách đọc trực tiếp từ link công khai), hoặc APPS_SCRIPT_URL (cách Apps Script)."
  );
}

let duLieu;
if (appsScriptUrl) {
  try {
    duLieu = await quaAppsScript();
  } catch (err) {
    if (sheetId) {
      console.log(`\n${WARN} Apps Script chưa truy cập được (${err.message}).`);
      console.log(`${WARN} Chuyển sang kiểm tra đọc trực tiếp qua GOOGLE_SHEET_ID...\n`);
      duLieu = await quaGoogleSheetPublic();
    } else {
      thoat(err.message);
    }
  }
} else if (email && rawKey) {
  duLieu = await quaSheetsApi();
} else if (sheetId) {
  duLieu = await quaGoogleSheetPublic();
}

const { results, levels } = duLieu;

/* --- Kiểm tra cấu trúc sheet --- */
if (!results.length) {
  thoat(`Tab "${tabResults}" trống hoặc không tồn tại.`, "Kiểm tra lại tên tab trong sheet.");
}
if (!levels.length) {
  thoat(`Tab "${tabLevels}" trống hoặc không tồn tại.`, "Kiểm tra lại tên tab trong sheet.");
}

const headers = results[0].map((h) => String(h).trim());
const CAN_CO = [
  "ma_hoc_sinh", "ho_ten", "giao_vien", "lich_hoc", "lop", "video_url",
  "so_cup", "gio_tay", "tra_loi_dung", "nhan_xet_tinh_than",
  "hoc_luc", "nhan_xet_tong_quan",
  "nx_tu_vung", "nx_ngu_phap", "nx_phat_am", "nx_phan_xa",
  "pct_co_ban", "pct_nang_cao", "nhan_xet_lo_trinh",
  "bac_nang_luc", "ngay_cap",
];
const thieu = CAN_CO.filter((c) => !headers.includes(c));

console.log(`${OK} Tab "${tabResults}": ${results.length - 1} học sinh`);
console.log(`${OK} Tab "${tabLevels}": ${levels.length - 1} bậc năng lực`);

if (thieu.length) {
  console.log(`${WARN} Thiếu cột: ${thieu.join(", ")} — các phần này sẽ để trống trên web.`);
} else {
  console.log(`${OK} Đủ ${CAN_CO.length} cột theo đúng template`);
}

/* --- Đối chiếu bậc năng lực giữa 2 tab --- */
const iBac = headers.indexOf("bac_nang_luc");
const iMa = headers.indexOf("ma_hoc_sinh");
const danhSachBac = new Set(levels.slice(1).map((r) => String(r[0] ?? "").trim().toUpperCase()));
const lech = results
  .slice(1)
  .filter((r) => r[iBac] && !danhSachBac.has(String(r[iBac]).trim().toUpperCase()))
  .map((r) => `${r[iMa]} (${r[iBac]})`);

if (lech.length) {
  console.log(
    `${WARN} ${lech.length} học sinh có bac_nang_luc không khớp tab "${tabLevels}": ` +
      lech.slice(0, 5).join(", ") + (lech.length > 5 ? " ..." : "")
  );
  console.log(`  → Phần "Năng lực đầu ra" của các em này sẽ bị ẩn.`);
} else {
  console.log(`${OK} Mọi bậc năng lực đều khớp giữa 2 tab`);
}

console.log(`\n${OK} Kết nối thành công. Thử tra cứu mã: ${results[1]?.[iMa]}\n`);
