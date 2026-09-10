/**
 * Tạo file template Google Sheet (.xlsx, 2 tab) kèm 20 dòng dữ liệu ảo.
 *   node scripts/tao-template.mjs
 * Kết quả: data/Template_KetQua_HocSinh.xlsx  +  2 file .csv dự phòng
 */
import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data");
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ *
 * Tab 2: BacNangLuc — mô tả chuẩn đầu ra theo Khung 6 bậc
 * ------------------------------------------------------------------ */
const BAC_NANG_LUC = [
  {
    bac: "Bậc 1-",
    nghe: [
      "Nghe hiểu các cụm từ quen thuộc, đơn giản. Nghe hiểu và làm theo hướng dẫn rất đơn giản trong lớp học.",
      "Nghe hiểu và trả lời các câu hỏi rất đơn giản nếu nói chậm và rõ ràng.",
      "Nghe hiểu đoạn hội thoại ngắn 20-30 từ về chủ đề đã học nếu nói chậm và rõ ràng.",
    ],
    noi: [
      "Nói các cụm từ đơn giản, quen thuộc, ngắn và dễ phát âm.",
      "Hỏi và trả lời câu hỏi đơn giản về bản thân và người khác.",
      "Nói được về chủ đề đã học một cách đơn giản bằng cụm từ và từ đơn.",
    ],
    doc: [
      "Đọc đúng chữ cái trong bảng chữ cái, chữ cái trong từ.",
      "Đọc hiểu nghĩa các từ và cụm từ quen thuộc, rất đơn giản.",
      "Đọc hiểu các văn bản ngắn 30-40 từ về chủ đề đã học.",
    ],
    viet: [
      "Viết các từ, cụm từ rất đơn giản.",
      "Điền thông tin cá nhân vào các mẫu rất đơn giản (tên, địa chỉ...).",
      "Viết theo mẫu để hoàn thành đoạn văn 10-20 từ.",
    ],
  },
  {
    bac: "Bậc 1",
    nghe: [
      "Nghe hiểu câu và cụm từ thông dụng liên quan tới bản thân, gia đình, trường lớp.",
      "Nghe hiểu ý chính của đoạn hội thoại 40-60 từ nói với tốc độ chậm.",
      "Nghe và làm theo chuỗi 2-3 hướng dẫn đơn giản trong lớp.",
    ],
    noi: [
      "Giới thiệu bản thân và người thân bằng các câu đơn hoàn chỉnh.",
      "Đặt và trả lời câu hỏi về nhu cầu, sở thích quen thuộc.",
      "Mô tả ngắn về đồ vật, con vật, hoạt động hằng ngày (4-5 câu).",
    ],
    doc: [
      "Đọc hiểu đoạn văn 50-70 từ về chủ đề quen thuộc.",
      "Xác định thông tin cụ thể trong bảng biểu, thời khoá biểu đơn giản.",
      "Đọc trôi chảy câu đơn với ngữ điệu cơ bản.",
    ],
    viet: [
      "Viết câu đơn hoàn chỉnh về bản thân và môi trường xung quanh.",
      "Viết đoạn 25-40 từ theo gợi ý cho sẵn.",
      "Sử dụng đúng dấu câu và viết hoa cơ bản.",
    ],
  },
  {
    bac: "Bậc 2",
    nghe: [
      "Nghe hiểu ý chính của bài nói rõ ràng về chủ đề quen thuộc trong học tập, giải trí.",
      "Nghe hiểu hội thoại 80-100 từ và nắm được chi tiết quan trọng.",
      "Nhận biết được thái độ, cảm xúc của người nói qua ngữ điệu.",
    ],
    noi: [
      "Trao đổi thông tin trong các tình huống giao tiếp quen thuộc hằng ngày.",
      "Kể lại một sự việc, trải nghiệm bằng chuỗi câu có liên kết.",
      "Trình bày ý kiến cá nhân ngắn gọn kèm lý do đơn giản.",
    ],
    doc: [
      "Đọc hiểu văn bản 100-150 từ về chủ đề quen thuộc.",
      "Suy luận nghĩa của từ mới dựa vào ngữ cảnh.",
      "Nắm được ý chính và ý chi tiết của đoạn văn ngắn.",
    ],
    viet: [
      "Viết đoạn văn 50-80 từ có mở - thân - kết đơn giản.",
      "Viết tin nhắn, email ngắn cho bạn bè, thầy cô.",
      "Sử dụng từ nối cơ bản (and, but, because, so) để liên kết ý.",
    ],
  },
  {
    bac: "Bậc 3",
    nghe: [
      "Nghe hiểu bài nói dài về chủ đề học thuật quen thuộc với tốc độ tự nhiên.",
      "Nghe hiểu và ghi chép ý chính của bài giảng ngắn.",
      "Nghe hiểu các đoạn hội thoại có nhiều người tham gia.",
    ],
    noi: [
      "Thảo luận, bảo vệ quan điểm cá nhân về chủ đề quen thuộc.",
      "Thuyết trình 2-3 phút có cấu trúc rõ ràng.",
      "Sử dụng linh hoạt cấu trúc câu phức trong giao tiếp.",
    ],
    doc: [
      "Đọc hiểu văn bản 200-250 từ ở nhiều thể loại khác nhau.",
      "Phân tích được ý đồ và quan điểm của tác giả.",
      "Đọc lướt lấy thông tin và đọc kỹ lấy chi tiết.",
    ],
    viet: [
      "Viết bài luận 120-150 từ có bố cục và lập luận rõ ràng.",
      "Viết thư trang trọng và không trang trọng đúng văn phong.",
      "Sử dụng đa dạng cấu trúc câu và từ vựng học thuật cơ bản.",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Tab 1: KetQua — 20 dòng dữ liệu ảo
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

const HOC_LUC = [
  "A - Giỏi", "B - Khá", "C - Trung Bình", "B - Khá", "A - Giỏi", "C - Trung Bình", "D - Cần cố gắng",
];

const NX_TINH_THAN = [
  "Con học ngoan, tập trung suốt buổi, chủ động giơ tay phát biểu và giữ được năng lượng vui vẻ đến cuối giờ.",
  "Con có ý thức học tập tốt, tiếp thu từ vựng và cấu trúc mới khá nhanh, tuy nhiên còn hơi rụt rè khi được gọi trả lời.",
  "Con hợp tác tốt với cô, làm theo hướng dẫn đầy đủ. Nửa sau buổi học con có dấu hiệu mất tập trung nhẹ, cô đã dùng trò chơi để kéo con trở lại bài.",
  "Con rất hào hứng với các hoạt động tương tác, chủ động đặt câu hỏi khi chưa hiểu — đây là điểm mạnh cần duy trì.",
  "Con ngồi học nghiêm túc nhưng còn ít phát biểu. Cô sẽ tăng các câu hỏi mở để con tự tin hơn trong các buổi tới.",
  "Con tiếp thu bài ổn, ghi chép đầy đủ và hoàn thành hết các bài tập trong buổi.",
];

const NX_TONG_QUAN = [
  "Nhìn chung con có nền tảng tốt và khả năng tiếp thu nhanh. Cô định hướng con tập trung cải thiện: (1) Phát âm âm cuối và trọng âm từ; (2) Phản xạ nói cả câu thay vì trả lời bằng từ đơn.",
  "Con nắm được kiến thức trong buổi học ở mức khá. Để tiến bộ nhanh hơn, con cần: (1) Luyện nghe chép chính tả 10 phút mỗi ngày; (2) Tăng thời lượng nói để quen phản xạ.",
  "Con có ý thức học tập nhưng nền từ vựng còn mỏng. Cô sẽ ưu tiên: (1) Củng cố bộ từ vựng nền theo chủ đề; (2) Hướng dẫn lại nguyên tắc phát âm chuẩn IPA để con đọc đúng ngay từ đầu.",
  "Con thể hiện tốt ở kỹ năng nghe và đọc, nhưng nói còn thiếu tự tin. Lộ trình tiếp theo sẽ tăng tỷ trọng hoạt động giao tiếp cặp đôi để con mạnh dạn hơn.",
  "Con tiếp thu nhanh nhưng còn thiếu tính chính xác về ngữ pháp. Cô sẽ bổ sung bài tập vận dụng có kiểm soát trước khi cho con nói tự do.",
  "Con cần thêm thời gian để làm quen với môi trường học tiếng Anh. Cô định hướng đi chậm và chắc: học kỹ từng nhóm từ vựng, kết hợp trò chơi để con thấy hứng thú.",
];

const NX_TU_VUNG = [
  "Con tiếp thu từ vựng rất nhanh, hôm nay con học được 6/6 từ về chủ đề sức khoẻ và ghi nhớ tốt khi được nhắc lại cuối giờ.",
  "Con nhớ được khoảng 4/6 từ mới. Với các từ dài, con còn nhầm lẫn thứ tự âm tiết nên cô sẽ chia nhỏ từ theo âm để con dễ ghi nhớ.",
  "Con nắm nghĩa từ vựng tốt qua hình ảnh nhưng chưa vận dụng được vào câu. Cô sẽ tạo thêm nhiều ngữ cảnh để con dùng lại từ đã học.",
  "Vốn từ của con khá phong phú so với bạn cùng lứa, con còn chủ động dùng từ đã học ở buổi trước vào bài hôm nay.",
  "Con cần thêm thời gian ôn từ vựng ở nhà. Cô đề xuất phụ huynh cho con ôn 5-7 phút mỗi tối bằng flashcard.",
  "Con nhận diện mặt chữ tốt, đọc lại được hầu hết từ mới sau 2 lần nghe mẫu.",
];

const NX_NGU_PHAP = [
  'Con nắm được cấu trúc "Would you like some...?" và cách trả lời "Yes, please / No, thanks", tuy nhiên chưa chủ động dùng lại khi giao tiếp tự do.',
  "Con phân biệt được câu khẳng định và câu hỏi, nhưng còn quên chia động từ số ít ngôi thứ ba.",
  "Con áp dụng đúng cấu trúc trong bài tập có sẵn khung. Khi phải tự đặt câu, con còn cần cô gợi ý từ đầu tiên.",
  "Con sử dụng thành thạo thì hiện tại đơn và bắt đầu dùng đúng thì hiện tại tiếp diễn trong ngữ cảnh phù hợp.",
  "Cô sẽ củng cố lại trật tự từ trong câu hỏi Wh- vì con còn đảo sai vị trí trợ động từ.",
  "Con hiểu quy tắc nhưng tốc độ vận dụng còn chậm. Cô sẽ tăng bài tập phản xạ nhanh để rút ngắn thời gian con nghĩ câu trả lời.",
];

const NX_PHAT_AM = [
  'Con nghe và phát âm theo cô tốt. Khi không có mẫu, con còn quên âm cuối ở các từ như "like", "rice". Cô sẽ củng cố nguyên tắc IPA và chỉnh khẩu hình cho con.',
  "Con phát âm rõ ràng, trọng âm từ khá chuẩn. Cô sẽ nâng dần lên luyện ngữ điệu câu.",
  "Khẩu hình của con với một số nguyên âm đôi chưa chính xác. Cô sẽ dùng gương và video đối chiếu để con tự chỉnh.",
  "Con còn ảnh hưởng cách đọc tiếng Việt khi phát âm phụ âm đầu. Cô ưu tiên sửa nhóm âm /θ/, /ð/ và /s/ - /ʃ/ trong các buổi tới.",
  "Con bắt chước ngữ điệu của cô rất tốt, nói câu nghe tự nhiên và có nhịp.",
  "Phát âm của con ở mức ổn. Cần chú ý nối âm khi nói cả câu để nghe trôi chảy hơn.",
];

const NX_PHAN_XA = [
  "Con còn rụt rè và có tâm lý sợ sai. Càng về cuối giờ con cởi mở hơn, đã trả lời được cả câu \"I'm happy\" khi cô hỏi.",
  "Con phản xạ nhanh với câu hỏi quen thuộc, thời gian nghĩ trung bình dưới 3 giây.",
  "Con thường trả lời bằng từ đơn. Cô sẽ khuyến khích con mở rộng thành câu đầy đủ bằng cách hỏi thêm \"Why?\" sau mỗi câu trả lời.",
  "Con chủ động hỏi lại cô khi chưa nghe rõ — đây là thói quen rất tốt cần duy trì.",
  "Con cần tăng môi trường giao tiếp để bớt phụ thuộc vào việc dịch sang tiếng Việt trong đầu trước khi nói.",
  "Con tự tin tương tác, dám nói dù chưa chắc đúng. Cô đánh giá cao tinh thần này.",
];

const NX_LO_TRINH = [
  "Dựa trên kết quả buổi học, trung tâm gợi ý con theo lộ trình cá nhân hoá: củng cố nền tảng phát âm trong 4 buổi đầu, sau đó tăng dần tỷ trọng luyện nói.",
  "Lộ trình đề xuất cho con: 2 buổi/tuần, ưu tiên mở rộng vốn từ theo chủ đề và luyện phản xạ giao tiếp.",
  "Con phù hợp với lộ trình tăng tốc: học song song kiến thức cơ bản và mở rộng chủ đề nâng cao để chuẩn bị cho các kỳ thi trong năm học.",
  "Trung tâm đề xuất con học nhóm nhỏ 1 kèm 3 để vừa có bạn tương tác, vừa được cô theo sát khi phát âm.",
];

const LICH = [
  "18:00 02/03/2026", "19:00 03/03/2026", "17:30 04/03/2026", "20:00 05/03/2026",
  "18:30 06/03/2026", "09:00 07/03/2026", "10:30 08/03/2026",
];

const BAC = ["Bậc 1-", "Bậc 1", "Bậc 2", "Bậc 1", "Bậc 3", "Bậc 1-", "Bậc 2"];

const at = (arr, i) => arr[i % arr.length];

const rows = HOC_SINH.map((ten, i) => ({
  ma_hoc_sinh: `HS${String(i + 1).padStart(3, "0")}`,
  ho_ten: ten,
  giao_vien: at(GIAO_VIEN, i),
  lich_hoc: at(LICH, i),
  lop: `D.${(i % 5) + 1}C.${310000 + i * 137}`,
  video_url: `https://example.com/video/buoi-hoc-${i + 1}`,
  so_cup: String(28 + ((i * 7) % 45)),
  gio_tay: String((i * 3) % 9),
  tra_loi_dung: `${(i % 8) + 2}/${10}`,
  nhan_xet_tinh_than: at(NX_TINH_THAN, i),
  hoc_luc: at(HOC_LUC, i),
  nhan_xet_tong_quan: at(NX_TONG_QUAN, i),
  nx_tu_vung: at(NX_TU_VUNG, i),
  nx_ngu_phap: at(NX_NGU_PHAP, i),
  nx_phat_am: at(NX_PHAT_AM, i),
  nx_phan_xa: at(NX_PHAN_XA, i),
  pct_co_ban: "100%",
  pct_nang_cao: `${10 + (i % 4) * 5}%`,
  nhan_xet_lo_trinh: at(NX_LO_TRINH, i),
  bac_nang_luc: at(BAC, i),
  ngay_cap: `Hà Nội, ngày ${(i % 28) + 1} tháng 3 năm 2026`,
}));

const COT_KETQUA = [
  "ma_hoc_sinh", "ho_ten", "giao_vien", "lich_hoc", "lop", "video_url",
  "so_cup", "gio_tay", "tra_loi_dung", "nhan_xet_tinh_than",
  "hoc_luc", "nhan_xet_tong_quan",
  "nx_tu_vung", "nx_ngu_phap", "nx_phat_am", "nx_phan_xa",
  "pct_co_ban", "pct_nang_cao", "nhan_xet_lo_trinh",
  "bac_nang_luc", "ngay_cap",
];

const levelRows = BAC_NANG_LUC.map((b) => ({
  bac: b.bac,
  nghe: b.nghe.join("\n"),
  noi: b.noi.join("\n"),
  doc: b.doc.join("\n"),
  viet: b.viet.join("\n"),
}));

/* ------------------------------------------------------------------ *
 * Xuất file
 * ------------------------------------------------------------------ */
const wb = XLSX.utils.book_new();

const wsKetQua = XLSX.utils.json_to_sheet(rows, { header: COT_KETQUA });
wsKetQua["!cols"] = COT_KETQUA.map((c) => ({
  wch: c.startsWith("nhan_xet") || c.startsWith("nx_") ? 60 : 18,
}));
XLSX.utils.book_append_sheet(wb, wsKetQua, "KetQua");

const wsBac = XLSX.utils.json_to_sheet(levelRows, { header: ["bac", "nghe", "noi", "doc", "viet"] });
wsBac["!cols"] = [{ wch: 12 }, { wch: 70 }, { wch: 70 }, { wch: 70 }, { wch: 70 }];
XLSX.utils.book_append_sheet(wb, wsBac, "BacNangLuc");

const xlsxPath = join(OUT, "Template_KetQua_HocSinh.xlsx");
XLSX.writeFile(wb, xlsxPath);

// CSV dự phòng (UTF-8 BOM để Excel/Sheets đọc đúng tiếng Việt)
const BOM = "﻿";
writeFileSync(join(OUT, "KetQua.csv"), BOM + XLSX.utils.sheet_to_csv(wsKetQua), "utf8");
writeFileSync(join(OUT, "BacNangLuc.csv"), BOM + XLSX.utils.sheet_to_csv(wsBac), "utf8");

// Dữ liệu mẫu cho chế độ chạy thử khi chưa cấu hình Google Sheets
mkdirSync(join(ROOT, "shared"), { recursive: true });
writeFileSync(
  join(ROOT, "shared", "du-lieu-mau.ts"),
  [
    "// TỰ ĐỘNG SINH RA bởi scripts/tao-template.mjs — không sửa tay.",
    "// Dùng làm dữ liệu chạy thử khi chưa cấu hình Google Sheets.",
    "export default " + JSON.stringify({ results: rows, levels: levelRows }, null, 2) + ";",
    "",
  ].join("\n"),
  "utf8"
);

console.log(`Đã tạo: ${xlsxPath}`);
console.log(`  - Tab KetQua: ${rows.length} học sinh (HS001 -> HS0${rows.length})`);
console.log(`  - Tab BacNangLuc: ${levelRows.length} bậc`);
