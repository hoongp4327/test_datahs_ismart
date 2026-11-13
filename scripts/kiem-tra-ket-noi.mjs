/**
 * Kiểm tra kết nối tới Google Sheet, cấu trúc 3 tab, và chất lượng dữ liệu nhập.
 *   npm run kiem-tra
 *
 * Đọc thẳng Google, KHÔNG qua cache — nên luôn cho thấy dữ liệu thật đang có trên sheet.
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
const TAB = {
  ketQua: env("SHEET_TAB_KET_QUA") || "KetQua",
  moTa: env("SHEET_TAB_MO_TA") || "MoTaKyNang",
  thangLevel: env("SHEET_TAB_THANG_LEVEL") || "ThangLevel",
};

/** Điểm tối đa từng kỹ năng — khớp KY_NANG trong shared/bao-cao.ts (khung iLEAD). */
const DIEM_TOI_DA = { listening: 20, reading: 20, writing: 15, speaking: 20 };
const KY_NANG = Object.keys(DIEM_TOI_DA);

function thoat(msg, goiY) {
  console.log(`\n${X} ${msg}`);
  if (goiY) console.log(`  → ${goiY}`);
  process.exit(1);
}

console.log("\n=== Kiểm tra kết nối Google Sheet ===\n");

/* ------------------------------------------------------------------ *
 * Nguồn 1: Apps Script
 * ------------------------------------------------------------------ */
async function quaAppsScript() {
  console.log(`${OK} Chế độ: Apps Script`);
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(appsScriptUrl)) {
    console.log(`${WARN} URL không đúng dạng .../exec — kiểm tra lại "URL ứng dụng web" khi triển khai.`);
  }
  if (!appsScriptToken) throw new Error("Thiếu APPS_SCRIPT_TOKEN.");
  if (appsScriptToken.startsWith("DOI-CHUOI-NAY")) {
    throw new Error("APPS_SCRIPT_TOKEN vẫn là chuỗi mặc định — đổi TOKEN trong Code.gs rồi điền vào .env.");
  }

  const res = await fetch(`${appsScriptUrl}?token=${encodeURIComponent(appsScriptToken)}`, {
    redirect: "follow",
  });
  const text = await res.text();

  if (text.includes("accounts.google.com/ServiceLogin")) {
    throw new Error('Apps Script yêu cầu đăng nhập — triển khai lại với "Người có quyền truy cập" = Bất kỳ ai.');
  }
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? 'Apps Script trả 403 — triển khai chưa đặt "Bất kỳ ai", hoặc bị quản trị Workspace chặn.'
        : `Apps Script trả lỗi ${res.status}: ${text.slice(0, 100)}`
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Apps Script không trả về JSON: " + text.slice(0, 120));
  }
  if (json.error === "UNAUTHORIZED") throw new Error("APPS_SCRIPT_TOKEN không khớp TOKEN trong Code.gs.");
  if (json.error) throw new Error(`Apps Script báo lỗi: ${json.error}`);
  if (!json.tabs) {
    throw new Error("Apps Script đang chạy Code.gs phiên bản cũ — dán Code.gs mới và triển khai phiên bản mới.");
  }

  return {
    ketQua: json.tabs[TAB.ketQua] ?? [],
    moTa: json.tabs[TAB.moTa] ?? [],
    thangLevel: json.tabs[TAB.thangLevel] ?? [],
  };
}

/* ------------------------------------------------------------------ *
 * Nguồn 2: Sheet công khai
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

async function quaSheetCongKhai() {
  console.log(`${OK} Chế độ: đọc sheet công khai qua GOOGLE_SHEET_ID`);
  const doc = async (ten) => {
    const url =
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv` +
      `&sheet=${encodeURIComponent(ten)}`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) thoat(`Không đọc được tab "${ten}": HTTP ${res.status}`);
    const text = await res.text();
    if (text.includes("<html") && text.includes("accounts.google.com")) {
      thoat("Sheet không mở công khai nên không đọc trực tiếp được.", "Sửa Apps Script, hoặc dùng service account.");
    }
    return parseCsv(text);
  };
  const [ketQua, moTa, thangLevel] = await Promise.all([doc(TAB.ketQua), doc(TAB.moTa), doc(TAB.thangLevel)]);
  return { ketQua, moTa, thangLevel };
}

/* ------------------------------------------------------------------ *
 * Nguồn 3: Service account + Sheets API
 * ------------------------------------------------------------------ */
async function quaSheetsApi() {
  console.log(`${OK} Chế độ: Service account (Google Sheets API)`);
  if (!sheetId) thoat("Thiếu GOOGLE_SHEET_ID.");
  if (!email.endsWith(".iam.gserviceaccount.com")) {
    console.log(`${WARN} Email không có đuôi .iam.gserviceaccount.com — có thể dán nhầm email cá nhân.`);
  }
  const key = rawKey.replace(/\\n/g, "\n");
  if (!key.includes("BEGIN PRIVATE KEY")) {
    thoat("GOOGLE_PRIVATE_KEY không đúng định dạng.", 'Chuỗi phải bắt đầu bằng "-----BEGIN PRIVATE KEY-----".');
  }

  let token;
  try {
    const auth = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
    ({ token } = await auth.getAccessToken());
  } catch (err) {
    thoat(`Xác thực thất bại: ${err.message}`, "Private key bị copy thiếu, hoặc service account đã bị xoá.");
  }

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet` +
    [TAB.ketQua, TAB.moTa, TAB.thangLevel].map((t, i) => `${i ? "&" : "?"}ranges=${encodeURIComponent(t)}`).join("") +
    `&majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 403) {
    const body = await res.text();
    if (body.includes("SERVICE_DISABLED") || body.includes("has not been used")) {
      thoat("Google Sheets API chưa được bật.", "Google Cloud Console → APIs & Services → Library → Google Sheets API → Enable.");
    }
    thoat("Không có quyền đọc sheet (403).", `Share sheet cho ${email} với quyền Viewer.`);
  }
  if (res.status === 400) thoat("Sai tên tab (400).", `Sheet phải có đủ 3 tab: ${Object.values(TAB).join(", ")}.`);
  if (res.status === 404) thoat("Không tìm thấy sheet (404).", "GOOGLE_SHEET_ID sai.");
  if (!res.ok) thoat(`Google Sheets API lỗi ${res.status}.`, (await res.text()).slice(0, 300));

  const { valueRanges } = await res.json();
  return {
    ketQua: valueRanges?.[0]?.values ?? [],
    moTa: valueRanges?.[1]?.values ?? [],
    thangLevel: valueRanges?.[2]?.values ?? [],
  };
}

/* ------------------------------------------------------------------ *
 * Đọc dữ liệu
 * ------------------------------------------------------------------ */
if (!appsScriptUrl && !sheetId) {
  thoat("Chưa cấu hình nguồn dữ liệu nào trong .env.", "Điền APPS_SCRIPT_URL + APPS_SCRIPT_TOKEN, hoặc GOOGLE_SHEET_ID.");
}

let raw;
if (appsScriptUrl) {
  try {
    raw = await quaAppsScript();
  } catch (err) {
    if (!sheetId) thoat(err.message);
    console.log(`${WARN} ${err.message}`);
    console.log(`${WARN} Chuyển sang đọc sheet công khai — đường dự phòng, website đang chạy bằng đường này.\n`);
    raw = await quaSheetCongKhai();
  }
} else if (email && rawKey) {
  raw = await quaSheetsApi();
} else {
  raw = await quaSheetCongKhai();
}

/* ------------------------------------------------------------------ *
 * Kiểm tra cấu trúc 3 tab
 * ------------------------------------------------------------------ */
const thanhObject = (rows) => {
  if (!rows.length) return { cot: [], dong: [] };
  const cot = rows[0].map((h) => String(h).trim());
  const dong = rows.slice(1).map((r) => Object.fromEntries(cot.map((c, i) => [c, String(r[i] ?? "").trim()])));
  return { cot, dong };
};

const kq = thanhObject(raw.ketQua);
const mt = thanhObject(raw.moTa);
const lv = thanhObject(raw.thangLevel);

console.log("\n--- Cấu trúc ---");

// Google trả về tab đầu tiên khi hỏi tab không tồn tại, nên kiểm bằng cột chứ không bằng số dòng.
if (kq.cot.includes("bac_nang_luc") || kq.cot.includes("nx_tu_vung")) {
  thoat(
    `Tab "${TAB.ketQua}" còn cấu trúc CŨ (Từ vựng / Ngữ pháp / Phát âm / Phản xạ).`,
    "Import data/Template_KetQua_HocSinh.xlsx vào sheet để có cấu trúc Listening / Reading / Writing / Speaking."
  );
}

const COT_KET_QUA = [
  "ma_hoc_sinh", "ho_ten", "giao_vien", "lop", "ngay_cham",
  ...KY_NANG.map((k) => `diem_${k}`),
  ...KY_NANG.map((k) => `option_${k}`),
  "mo_ta_rieng_speaking", "pct_co_ban", "pct_nang_cao", "nhan_xet_lo_trinh",
];
const kiemCot = (ten, cot, canCo) => {
  if (!cot.length) {
    console.log(`${X} Tab "${ten}": không tìm thấy hoặc trống.`);
    return false;
  }
  const thieu = canCo.filter((c) => !cot.includes(c));
  if (thieu.length) {
    console.log(`${X} Tab "${ten}": thiếu cột ${thieu.join(", ")}`);
    return false;
  }
  console.log(`${OK} Tab "${ten}": đủ ${canCo.length} cột`);
  return true;
};

const okKq = kiemCot(TAB.ketQua, kq.cot, COT_KET_QUA);
const okMt = kiemCot(TAB.moTa, mt.cot, ["ky_nang", "option", "diem_tu", "mo_ta", "goi_y"]);
const okLv = kiemCot(TAB.thangLevel, lv.cot, ["level", "diem_tu", "mo_ta"]);
if (!okKq || !okMt || !okLv) {
  thoat("Sheet chưa đúng cấu trúc.", "So với data/Template_KetQua_HocSinh.xlsx — tên tab và tên cột ở hàng 1 phải khớp.");
}

/* ------------------------------------------------------------------ *
 * Kiểm tra nội dung
 * ------------------------------------------------------------------ */
console.log("\n--- Nội dung ---");
let soCanhBao = 0;
const canhBao = (msg, chiTiet = []) => {
  soCanhBao++;
  console.log(`${WARN} ${msg}`);
  chiTiet.slice(0, 5).forEach((d) => console.log(`    ${d}`));
  if (chiTiet.length > 5) console.log(`    ... và ${chiTiet.length - 5} dòng nữa`);
};
const docSo = (v) => {
  const s = String(v ?? "").trim().replace(",", ".");
  return s === "" ? null : Number(s);
};
const cung = (a, b) => String(a).toLowerCase().replace(/[^a-z0-9]/g, "") === String(b).toLowerCase().replace(/[^a-z0-9]/g, "");

// ThangLevel
const mocLevel = lv.dong.map((r) => ({ level: r.level, tu: docSo(r.diem_tu) })).filter((r) => r.level);
const mocSai = mocLevel.filter((m) => m.tu === null || !Number.isFinite(m.tu));
if (mocSai.length) canhBao(`ThangLevel: ${mocSai.length} mức có diem_tu không phải số`, mocSai.map((m) => m.level));
const mocHopLe = mocLevel.filter((m) => Number.isFinite(m.tu)).sort((a, b) => a.tu - b.tu);
if (mocHopLe.length && mocHopLe[0].tu > 0) {
  canhBao(`ThangLevel: mức thấp nhất bắt đầu từ ${mocHopLe[0].tu} — học sinh dưới ${mocHopLe[0].tu} điểm sẽ không có Level`);
}
console.log(`${OK} ThangLevel: ${mocHopLe.map((m) => `${m.level} từ ${m.tu}`).join(" · ")}`);

// MoTaKyNang
for (const kn of KY_NANG) {
  const n = mt.dong.filter((r) => cung(r.ky_nang, kn)).length;
  if (!n) canhBao(`MoTaKyNang: kỹ năng ${kn} chưa có option nào — mô tả và gợi ý sẽ trống`);
}
console.log(`${OK} MoTaKyNang: ${mt.dong.length} option`);

// KetQua
const hs = kq.dong.filter((r) => r.ma_hoc_sinh);
console.log(`${OK} KetQua: ${hs.length} học sinh`);

const diemSai = [];
const optionKhongCo = [];
for (const r of hs) {
  for (const kn of KY_NANG) {
    let d = docSo(r[`diem_${kn}`]);
    if (d !== null && (!Number.isFinite(d) || d < 0 || d > DIEM_TOI_DA[kn])) {
      diemSai.push(`${r.ma_hoc_sinh} ${kn} = "${r[`diem_${kn}`]}" (tối đa ${DIEM_TOI_DA[kn]})`);
      d = null;
    }
    const opt = r[`option_${kn}`];
    if (!opt || d === null || !Number.isFinite(d)) continue;
    // Khoảng điểm do điểm quyết định; option phải là một cách diễn đạt có trong khoảng đó.
    const cacOpt = mt.dong.filter((m) => cung(m.ky_nang, kn) && Number.isFinite(docSo(m.diem_tu)));
    const moc = Math.max(...cacOpt.map((m) => docSo(m.diem_tu)).filter((x) => x <= d));
    if (!cacOpt.some((m) => docSo(m.diem_tu) === moc && cung(m.option, opt))) {
      optionKhongCo.push(`${r.ma_hoc_sinh} ${kn}: ${d} điểm, "${opt}" không có trong khoảng này`);
    }
  }
}
if (diemSai.length) canhBao(`${diemSai.length} ô điểm vượt điểm tối đa của kỹ năng — website sẽ hiện "—"`, diemSai);
if (optionKhongCo.length) {
  canhBao(`${optionKhongCo.length} ô option không có trong khoảng điểm tương ứng — website dùng Option 1`, optionKhongCo);
}

const thieuDiem = hs.filter((r) => KY_NANG.some((kn) => docSo(r[`diem_${kn}`]) === null));
if (thieuDiem.length) {
  canhBao(`${thieuDiem.length} học sinh chưa đủ điểm 4 kỹ năng — chưa có Level, chưa vẽ biểu đồ`, thieuDiem.map((r) => r.ma_hoc_sinh));
}

const demMa = {};
hs.forEach((r) => (demMa[r.ma_hoc_sinh] = (demMa[r.ma_hoc_sinh] ?? 0) + 1));
const trung = Object.entries(demMa).filter(([, n]) => n > 1);
if (trung.length) {
  canhBao(`${trung.length} mã xuất hiện nhiều dòng — website lấy dòng DƯỚI CÙNG`, trung.map(([m, n]) => `${m}: ${n} dòng`));
}

// Mã kiểu HS001, HS002... đoán được: biết mã mình là ra mã người khác.
const deDoan = hs.filter((r) => /^HS-?\d+$/i.test(r.ma_hoc_sinh));
if (deDoan.length) {
  canhBao(`${deDoan.length} mã dạng số thứ tự (vd ${deDoan[0].ma_hoc_sinh}) — phụ huynh đoán được mã của học sinh khác`);
}

console.log(
  soCanhBao
    ? `\n${WARN} Kết nối được, có ${soCanhBao} cảnh báo cần xem.\n`
    : `\n${OK} Kết nối thành công, dữ liệu sạch. Thử tra cứu mã: ${hs[0]?.ma_hoc_sinh}\n`
);
