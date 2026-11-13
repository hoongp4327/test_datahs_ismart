/**
 * Đọc khung điểm iLEAD từ file Excel của trung tâm, ghi ra data/khung-ilead.json.
 *   node scripts/doc-khung-ilead.mjs "D:/.../2627_Online Placement Test Results.xlsx"
 * Sau đó chạy `npm run tao-template` để sinh lại template, CSV và dữ liệu mẫu.
 *
 * Cấu trúc tab " iLead" (tab có dấu cách ở đầu tên):
 *   - Dòng kỹ năng:   A = LISTENING / READING / WRITING / SPEAKING, B = điểm tối đa
 *   - Dòng khoảng:    B = "0-5", D = mô tả tóm tắt (nội bộ), F = Option 1
 *     2 dòng kế tiếp: F = Option 2, Option 3
 *   - Bảng "THANG XẾP LỚP": A = "0 - 18", B = lớp xếp, C = CEFR, D = kỹ năng,
 *     E = mô tả năng lực đầu vào (dòng đầu), F = mô tả năng lực đầu ra theo kỹ năng
 */
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const nguon = process.argv[2];
if (!nguon) {
  console.error('Thiếu đường dẫn file Excel. Ví dụ: node scripts/doc-khung-ilead.mjs "D:/.../2627_Online Placement Test Results.xlsx"');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(nguon)); // ESM build của xlsx không có readFile
const tenTab = wb.SheetNames.find((n) => n.trim().toLowerCase() === "ilead");
if (!tenTab) throw new Error(`Không thấy tab iLead. Các tab: ${wb.SheetNames.join(", ")}`);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[tenTab], { header: 1, defval: "", raw: false });
const o = (r, c) => String(rows[r]?.[c] ?? "").replace(/\s+/g, " ").trim();

const TEN_KY_NANG = { LISTENING: "Listening", READING: "Reading", WRITING: "Writing", SPEAKING: "Speaking" };
const khoangRe = /^(\d+)\s*-\s*(\d+)$/;

/** Lỗi gõ trong file gốc — sửa ở đây để chạy lại script không mất bản đã sửa. */
const suaLoiGo = (s) => s.replace(/^ó khả năng/, "Có khả năng");

const kyNang = [];
let i = 0;
for (; i < rows.length; i++) {
  if (/THANG XẾP LỚP/i.test(o(i, 0))) break;
  const ten = TEN_KY_NANG[o(i, 0).toUpperCase()];
  if (ten) {
    kyNang.push({ ten, toiDa: Number(o(i, 1)), khoang: [] });
    continue;
  }
  const m = khoangRe.exec(o(i, 1));
  if (m && kyNang.length) {
    const options = [o(i, 5), o(i + 1, 5), o(i + 2, 5)].filter(Boolean).map(suaLoiGo);
    kyNang.at(-1).khoang.push({ tu: Number(m[1]), den: Number(m[2]), tomTat: o(i, 3), options });
  }
}

const level = [];
for (; i < rows.length; i++) {
  const m = khoangRe.exec(o(i, 0));
  if (m) {
    level.push({ tu: Number(m[1]), den: Number(m[2]), lop: o(i, 1), cefr: o(i, 2), dauVao: o(i, 4), dauRa: {} });
  }
  const kn = TEN_KY_NANG[o(i, 3).toUpperCase()];
  if (kn && level.length) level.at(-1).dauRa[kn] = o(i, 5);
}

// Kiểm tra: khoảng liền nhau từ 0 tới tối đa, mỗi khoảng đủ 3 option.
const loi = [];
for (const k of kyNang) {
  let ke = 0;
  for (const kh of k.khoang) {
    if (kh.tu !== ke) loi.push(`${k.ten}: khoảng ${kh.tu}-${kh.den} không nối tiếp (mong đợi bắt đầu từ ${ke})`);
    if (kh.options.length !== 3) loi.push(`${k.ten} ${kh.tu}-${kh.den}: có ${kh.options.length} option, cần 3`);
    ke = kh.den + 1;
  }
  if (ke - 1 !== k.toiDa) loi.push(`${k.ten}: khoảng cuối kết thúc ở ${ke - 1}, tối đa là ${k.toiDa}`);
}
const tong = kyNang.reduce((s, k) => s + k.toiDa, 0);
if (level.at(-1)?.den !== tong) loi.push(`Thang xếp lớp kết thúc ở ${level.at(-1)?.den}, tổng điểm là ${tong}`);
if (loi.length) {
  console.error("File Excel có chỗ chưa khớp:\n  " + loi.join("\n  "));
  process.exit(1);
}

const out = join(ROOT, "data", "khung-ilead.json");
writeFileSync(out, JSON.stringify({ nguon: "2627_Online Placement Test Results.xlsx / tab iLead", tong, kyNang, level }, null, 2) + "\n");
console.log(`Đã ghi ${out}`);
for (const k of kyNang) console.log(`  ${k.ten.padEnd(9)} /${k.toiDa}: ${k.khoang.map((x) => `${x.tu}-${x.den}`).join(" · ")}`);
console.log(`  Tổng /${tong}: ${level.map((l) => `${l.tu}-${l.den} ${l.lop}`).join(" · ")}`);
