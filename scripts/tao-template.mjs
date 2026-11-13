/**
 * Tạo file template Google Sheet (.xlsx, 3 tab) kèm 20 học sinh ảo.
 *   npm run tao-template
 *
 * Kết quả:
 *   data/Template_KetQua_HocSinh.xlsx   — upload lên Google Drive, mở bằng Google Sheets
 *   data/*.csv                          — bản dự phòng từng tab
 *   shared/du-lieu-mau.ts               — dữ liệu chạy thử khi chưa nối Google Sheet
 */
import * as XLSX from "xlsx";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data");
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ *
 * Sinh ngẫu nhiên có seed — chạy lại script vẫn ra đúng bộ dữ liệu cũ,
 * nên mã học sinh mẫu không đổi giữa các lần chạy.
 * ------------------------------------------------------------------ */
function taoRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = taoRandom(20261110);

/**
 * Bộ ký tự cho mã học sinh: bỏ 0/O, 1/I/L vì đọc qua điện thoại hay bị nhầm.
 * 6 ký tự từ 31 ký tự ≈ 887 triệu tổ hợp — không dò được.
 */
const KY_TU_MA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function taoMaHocSinh(daCo) {
  for (;;) {
    let ma = "HS-";
    for (let i = 0; i < 6; i++) ma += KY_TU_MA[Math.floor(rand() * KY_TU_MA.length)];
    if (!daCo.has(ma)) {
      daCo.add(ma);
      return ma;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Tab MoTaKyNang — lấy từ khung iLEAD (data/khung-ilead.json, sinh bởi
 * scripts/doc-khung-ilead.mjs từ file Excel của trung tâm):
 *   mỗi kỹ năng 4 khoảng điểm × 3 option (3 cách diễn đạt cùng một mức năng lực).
 *
 * goi_y (gợi ý luyện tập) để TRỐNG: file Excel chưa có, trung tâm sẽ tự viết thẳng trên sheet.
 * Báo cáo tự ẩn mục gợi ý khi cột này trống.
 * ------------------------------------------------------------------ */
const KHUNG = JSON.parse(readFileSync(join(OUT, "khung-ilead.json"), "utf8"));

const moTaRows = KHUNG.kyNang.flatMap((kn) =>
  kn.khoang.flatMap((kh, i) =>
    kh.options.map((mo_ta, j) => ({
      ky_nang: kn.ten,
      khoang: `${kh.tu}–${kh.den}`,
      diem_tu: kh.tu,
      option: `Option ${j + 1}`,
      mo_ta,
      goi_y: "",
    }))
  )
);

/** Điểm tối đa từng kỹ năng, key thường: { listening: 20, ..., writing: 15 } */
const TOI_DA = Object.fromEntries(KHUNG.kyNang.map((k) => [k.ten.toLowerCase(), k.toiDa]));

/* ------------------------------------------------------------------ *
 * Tab ThangLevel — tổng điểm (0–${KHUNG.tong}) từ bao nhiêu thì đạt Level nào, xếp lớp nào.
 * Tên Level theo tab Template của file Excel (Pre-A1 / A1 / A2 / Pre-B1); CEFR đầy đủ
 * của mức 4 trong file là "A2+ / tiệm cận B1". mo_ta = mô tả năng lực đầu vào.
 * ------------------------------------------------------------------ */
const TEN_LEVEL = ["Pre-A1", "A1", "A2", "Pre-B1"];
const thangLevelRows = KHUNG.level.map((l, i) => ({
  level: TEN_LEVEL[i] ?? l.cefr,
  diem_tu: l.tu,
  lop_xep: l.lop,
  mo_ta: l.dauVao,
}));

/* ------------------------------------------------------------------ *
 * Tab KetQua — 20 học sinh ảo
 * ------------------------------------------------------------------ */
const HOC_SINH = [
  "Nguyễn Minh Anh", "Trần Gia Bảo", "Lê Khánh Chi", "Phạm Đức Duy", "Hoàng Thuỳ Dương",
  "Vũ Nhật Hạ", "Đặng Quang Huy", "Bùi Thảo Linh", "Đỗ Bảo Long", "Ngô Phương Mai",
  "Dương Tuấn Kiệt", "Lý Ngọc Diệp", "Trịnh Hoàng Nam", "Cao Bảo Ngân", "Đinh Gia Hân",
  "Phan Minh Khôi", "Võ Hà My", "Tạ Đăng Khoa", "Lương Thanh Trúc", "Chu Nhật Minh",
];

const GIAO_VIEN = [
  "Nguyễn Thu Trang", "Trần Hoàng Mai", "Lê Ngọc Ánh", "Phạm Hải Yến",
  "Đỗ Thanh Huyền", "Hoàng Minh Châu",
];

const LOP = ["Starter 1", "Starter 2", "Movers 1", "Movers 2", "Flyers 1"];

const MO_TA_RIENG_SPEAKING = [
  "Con phát âm rõ các âm đầu nhưng hay nuốt âm cuối /s/, /t/. Khi được khen con nói to và tự tin hơn hẳn.",
  "Con có phản xạ tốt với câu hỏi Yes/No, cần luyện thêm câu hỏi Wh- để trả lời thành câu đầy đủ.",
  "Con còn ngại nói trước lớp nhưng khi nói riêng với cô thì diễn đạt khá trôi chảy.",
  "Con dùng được nhiều từ vựng chủ đề gia đình và trường học, ngữ điệu còn đều, chưa nhấn câu.",
  "Con chủ động hỏi lại khi chưa hiểu câu hỏi — thói quen rất tốt cần phát huy.",
  "Con hay chen tiếng Việt khi thiếu từ. Cô khuyến khích con diễn đạt vòng bằng từ đã biết.",
];

const NX_LO_TRINH = [
  "Trung tâm gợi ý con bắt đầu từ lớp nền tảng, củng cố phát âm và từ vựng cốt lõi trong 8 tuần đầu, sau đó tăng dần tỷ trọng luyện nói.",
  "Lộ trình đề xuất: 2 buổi/tuần, ưu tiên mở rộng vốn từ theo chủ đề và luyện phản xạ giao tiếp.",
  "Con phù hợp lộ trình tăng tốc: học song song kiến thức cơ bản và mở rộng chủ đề nâng cao để chuẩn bị cho các kỳ thi trong năm học.",
  "Trung tâm đề xuất con học nhóm nhỏ 1 kèm 3 để vừa có bạn tương tác, vừa được cô theo sát kỹ năng nói.",
];

const at = (arr, i) => arr[i % arr.length];
const kep = (n, max) => Math.max(0, Math.min(max, Math.round(n)));

// Mức trung bình mỗi kỹ năng của từng học sinh, trải đều từ Pre-A1 đến Pre-B1.
const MUC_TB = [4, 7, 9, 12, 14, 17, 19, 5, 10, 13, 15, 18, 8, 11, 6, 16, 12, 9, 14, 18];

const maDaCo = new Set();
const ketQuaRows = HOC_SINH.map((ten, i) => {
  const tb = MUC_TB[i];
  // Mỗi kỹ năng lệch -3..+3 quanh mức trung bình để biểu đồ có hình dạng thật.
  const [l, r, w, s] = ["listening", "reading", "writing", "speaking"].map((k) =>
    kep(((tb + Math.floor(rand() * 7) - 3) * TOI_DA[k]) / 20, TOI_DA[k])
  );
  // Option = cách diễn đạt trong khoảng điểm; để trống một số học sinh để thử mặc định Option 1.
  const opt = () => (rand() < 0.25 ? "" : `Option ${1 + Math.floor(rand() * 3)}`);
  const ngay = ((i * 3) % 28) + 1;
  return {
    ma_hoc_sinh: taoMaHocSinh(maDaCo),
    ho_ten: ten,
    giao_vien: at(GIAO_VIEN, i),
    lop: at(LOP, i),
    ngay_cham: `${String(ngay).padStart(2, "0")}/${i < 10 ? "10" : "11"}/2026`,
    diem_listening: l,
    diem_reading: r,
    diem_writing: w,
    diem_speaking: s,
    option_listening: opt(),
    option_reading: opt(),
    option_writing: opt(),
    option_speaking: opt(),
    mo_ta_rieng_speaking: at(MO_TA_RIENG_SPEAKING, i),
    pct_co_ban: "100%",
    pct_nang_cao: `${10 + (i % 4) * 5}%`,
    nhan_xet_lo_trinh: at(NX_LO_TRINH, i),
  };
});

const COT_KET_QUA = Object.keys(ketQuaRows[0]);
const COT_MO_TA = ["ky_nang", "khoang", "diem_tu", "option", "mo_ta", "goi_y"];
const COT_THANG_LEVEL = ["level", "diem_tu", "lop_xep", "mo_ta"];

/* ------------------------------------------------------------------ *
 * Xuất file
 * ------------------------------------------------------------------ */
const wb = XLSX.utils.book_new();

const wsKetQua = XLSX.utils.json_to_sheet(ketQuaRows, { header: COT_KET_QUA });
wsKetQua["!cols"] = COT_KET_QUA.map((c) =>
  c === "mo_ta_rieng_speaking" || c === "nhan_xet_lo_trinh" ? { wch: 60 } : { wch: 16 }
);
wsKetQua["!freeze"] = { xSplit: 2, ySplit: 1 };
XLSX.utils.book_append_sheet(wb, wsKetQua, "KetQua");

const wsMoTa = XLSX.utils.json_to_sheet(moTaRows, { header: COT_MO_TA });
wsMoTa["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 80 }, { wch: 80 }];
XLSX.utils.book_append_sheet(wb, wsMoTa, "MoTaKyNang");

const wsLevel = XLSX.utils.json_to_sheet(thangLevelRows, { header: COT_THANG_LEVEL });
wsLevel["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 100 }];
XLSX.utils.book_append_sheet(wb, wsLevel, "ThangLevel");

const xlsxPath = join(OUT, "Template_KetQua_HocSinh.xlsx");
try {
  XLSX.writeFile(wb, xlsxPath);
} catch (err) {
  if (err.code !== "EBUSY") throw err;
  const alt = join(OUT, "Template_KetQua_HocSinh_Moi.xlsx");
  XLSX.writeFile(wb, alt);
  console.warn(`File chính đang mở trong ứng dụng khác. Đã lưu tại: ${alt}`);
}

// CSV dự phòng (UTF-8 BOM để Excel/Sheets đọc đúng tiếng Việt)
const BOM = "﻿";
writeFileSync(join(OUT, "KetQua.csv"), BOM + XLSX.utils.sheet_to_csv(wsKetQua), "utf8");
writeFileSync(join(OUT, "MoTaKyNang.csv"), BOM + XLSX.utils.sheet_to_csv(wsMoTa), "utf8");
writeFileSync(join(OUT, "ThangLevel.csv"), BOM + XLSX.utils.sheet_to_csv(wsLevel), "utf8");

// Dữ liệu mẫu dạng giống hệt khi đọc từ sheet: mọi ô đều là chuỗi.
const thanhChuoi = (rows) =>
  rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));

writeFileSync(
  join(ROOT, "shared", "du-lieu-mau.ts"),
  [
    "// TỰ ĐỘNG SINH RA bởi scripts/tao-template.mjs — không sửa tay.",
    "// Dùng làm dữ liệu chạy thử khi chưa nối Google Sheet, hoặc khi NGUON_DU_LIEU=mau.",
    "export default " +
      JSON.stringify(
        {
          ketQua: thanhChuoi(ketQuaRows),
          moTa: thanhChuoi(moTaRows),
          thangLevel: thanhChuoi(thangLevelRows),
        },
        null,
        2
      ) +
      ";",
    "",
  ].join("\n"),
  "utf8"
);

console.log(`Đã tạo: ${xlsxPath}`);
console.log(`  - KetQua:     ${ketQuaRows.length} học sinh`);
console.log(`  - MoTaKyNang: ${moTaRows.length} dòng (4 kỹ năng × 4 khoảng điểm × 3 option)`);
console.log(`  - ThangLevel: ${thangLevelRows.length} mức`);
console.log(`  Mã mẫu: ${ketQuaRows.slice(0, 3).map((r) => r.ma_hoc_sinh).join(", ")} ...`);
