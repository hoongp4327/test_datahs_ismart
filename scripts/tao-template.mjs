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
 * File Excel chưa có gợi ý luyện tập → GOI_Y dưới đây giữ nguyên nội dung đang dùng,
 * ghép theo thứ tự khoảng điểm (khoảng 1 ↔ gợi ý 1...). Dùng chung cho cả 3 option.
 * ------------------------------------------------------------------ */
const GOI_Y_CU = {
  Listening: [
    {
      mo_ta: "Con nhận ra được một số từ quen thuộc khi nghe chậm, nhưng chưa theo kịp câu hoàn chỉnh. Con thường cần nghe lại 2–3 lần mới nắm được yêu cầu.",
      goi_y: "Nghe bài hát thiếu nhi và truyện tranh có audio 10 phút mỗi ngày. Ba mẹ cho con chỉ tay vào hình khi nghe thấy từ quen để luyện phản ứng.",
    },
    {
      mo_ta: "Con hiểu được câu ngắn và hướng dẫn đơn giản về chủ đề quen thuộc. Với đoạn hội thoại dài hơn, con nắm được ý chính nhưng hay bỏ sót chi tiết.",
      goi_y: "Luyện nghe hội thoại ngắn 1–2 phút, sau khi nghe hỏi con 2–3 câu về chi tiết (ai, ở đâu, làm gì) để tập nghe có chủ đích.",
    },
    {
      mo_ta: "Con theo được hội thoại tự nhiên về chủ đề quen thuộc và nắm khá đầy đủ chi tiết. Con còn lúng túng khi người nói nhanh hoặc dùng từ mới.",
      goi_y: "Xem video hoạt hình tiếng Anh có phụ đề tiếng Anh, sau đó tắt phụ đề xem lại. Tập ghi chú từ khoá khi nghe.",
    },
    {
      mo_ta: "Con nghe hiểu tốt cả ý chính lẫn chi tiết, kể cả khi tốc độ nói gần tự nhiên. Con suy luận được nghĩa từ mới qua ngữ cảnh.",
      goi_y: "Nâng độ khó bằng podcast thiếu nhi hoặc bản tin dành cho trẻ em. Tập tóm tắt lại nội dung bằng tiếng Anh sau khi nghe.",
    },
  ],
  Reading: [
    {
      mo_ta: "Con nhận diện được chữ cái và một số từ đơn giản có hình minh hoạ. Con chưa tự đọc được câu hoàn chỉnh.",
      goi_y: "Đọc sách tranh song ngữ cùng con mỗi tối. Dùng flashcard có hình để củng cố mặt chữ của các từ thường gặp.",
    },
    {
      mo_ta: "Con đọc hiểu được câu ngắn và đoạn văn rất đơn giản về chủ đề quen thuộc. Con còn đọc chậm và hay đánh vần từng từ.",
      goi_y: "Cho con đọc to các đoạn ngắn 3–5 câu mỗi ngày. Khuyến khích con đoán nghĩa từ dựa vào hình và câu xung quanh trước khi tra từ điển.",
    },
    {
      mo_ta: "Con đọc hiểu được đoạn văn ngắn, tìm được thông tin cụ thể. Với câu dài nhiều mệnh đề, con còn hiểu chưa trọn ý.",
      goi_y: "Luyện đọc truyện ngắn phân cấp (graded readers) đúng trình độ. Sau mỗi chương, cho con kể lại ý chính bằng 2–3 câu.",
    },
    {
      mo_ta: "Con đọc trôi chảy, hiểu cả ý chính, chi tiết và ý ngầm của văn bản. Con đọc lướt tìm thông tin nhanh và chính xác.",
      goi_y: "Mở rộng sang nhiều thể loại: báo thiếu nhi, văn bản thông tin, truyện dài. Tập nêu ý kiến của con về nội dung vừa đọc.",
    },
  ],
  Writing: [
    {
      mo_ta: "Con chép lại được từ và cụm từ đơn giản theo mẫu. Con chưa tự viết được câu, chính tả còn sai nhiều.",
      goi_y: "Luyện chép chính tả 5 từ mới mỗi ngày. Cho con viết nhãn tên tiếng Anh cho đồ vật quen thuộc trong nhà.",
    },
    {
      mo_ta: "Con viết được câu đơn ngắn theo gợi ý, đúng cấu trúc cơ bản. Con còn quên viết hoa đầu câu và dấu câu.",
      goi_y: "Mỗi tối viết 3 câu về một việc trong ngày theo mẫu \"Today I...\". Ba mẹ cùng con kiểm tra viết hoa và dấu chấm cuối câu.",
    },
    {
      mo_ta: "Con viết được đoạn văn ngắn có liên kết đơn giản (and, but, because). Ý tưởng rõ ràng nhưng từ vựng còn lặp lại nhiều.",
      goi_y: "Luyện viết nhật ký ngắn 4–6 câu. Mỗi tuần chọn 5 từ mới và thử dùng chúng trong bài viết của con.",
    },
    {
      mo_ta: "Con viết đoạn văn mạch lạc, đúng ngữ pháp, dùng từ vựng đa dạng. Con biết sắp xếp ý theo trình tự hợp lý.",
      goi_y: "Thử các dạng bài dài hơn: kể chuyện, viết thư, mô tả. Khuyến khích con tự đọc lại và sửa bài trước khi nộp.",
    },
  ],
  Speaking: [
    {
      mo_ta: "Con trả lời được bằng từ đơn hoặc cụm từ ngắn khi được hỏi. Con còn rụt rè và cần gợi ý nhiều để bắt đầu nói.",
      goi_y: "Tạo thói quen chào hỏi, cảm ơn bằng tiếng Anh ở nhà. Khen ngợi khi con dám nói, không sửa lỗi ngay lúc con đang nói.",
    },
    {
      mo_ta: "Con giới thiệu được bản thân và trả lời câu hỏi đơn giản bằng câu ngắn. Phát âm còn ảnh hưởng tiếng Việt ở âm cuối.",
      goi_y: "Luyện nói theo chủ đề 1 phút mỗi ngày (gia đình, sở thích, trường học). Nghe và nhại lại câu mẫu để sửa âm cuối.",
    },
    {
      mo_ta: "Con giao tiếp được trong tình huống quen thuộc, nói thành câu có liên kết. Con còn ngập ngừng khi cần diễn đạt ý mới.",
      goi_y: "Đóng vai các tình huống thực tế (mua hàng, hỏi đường). Ghi âm con nói rồi cùng nghe lại để con tự nhận ra lỗi.",
    },
    {
      mo_ta: "Con nói lưu loát, tự tin, phát âm rõ và tự nhiên. Con trình bày và bảo vệ được ý kiến cá nhân.",
      goi_y: "Tham gia hoạt động thuyết trình, kể chuyện, tranh luận nhỏ. Khuyến khích con nói về chủ đề con yêu thích trong 2–3 phút.",
    },
  ],
};

const KHUNG = JSON.parse(readFileSync(join(OUT, "khung-ilead.json"), "utf8"));

const moTaRows = KHUNG.kyNang.flatMap((kn) =>
  kn.khoang.flatMap((kh, i) =>
    kh.options.map((mo_ta, j) => ({
      ky_nang: kn.ten,
      khoang: `${kh.tu}–${kh.den}`,
      diem_tu: kh.tu,
      option: `Option ${j + 1}`,
      mo_ta,
      goi_y: GOI_Y_CU[kn.ten]?.[i]?.goi_y ?? "",
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
