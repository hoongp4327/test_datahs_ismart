/**
 * Apps Script gắn trong Google Sheet:
 *   - doGet:             trả dữ liệu 3 tab dạng JSON cho website
 *   - doPost:            trang quản trị lưu điểm / thêm học sinh vào tab KetQua;
 *                        giáo viên TẠO MÃ LÀM BÀI trước (taoMa) → gửi mã cho học sinh;
 *                        học sinh nộp bài placement test vào tab PlacementTest — chỉ nhận mã
 *                        đã cấp và chưa làm bài, điểm máy chấm ghi luôn vào dòng của mã đó;
 *                        trang quản trị đọc bài chờ chấm, chấm Writing Part 2 / Speaking
 *                        (chấm riêng từng phần được — Speaking thường chấm gom sau)
 *   - taoTabGiaoVien:    chạy tay MỘT lần để tạo tab GiaoVien (danh sách giáo viên chấm điểm)
 *   - thietLapRangBuoc:  chạy tay MỘT lần để sheet tự chặn điểm sai và tạo dropdown option
 *   - kiemTra:           chạy tay để xem sheet có đúng cấu trúc không
 *
 * CÁCH DÙNG
 *  1. Mở Google Sheet → Tiện ích mở rộng (Extensions) → Apps Script
 *  2. Xoá hết code cũ, dán toàn bộ file này vào, bấm Lưu
 *  3. Đổi TOKEN bên dưới thành một chuỗi ngẫu nhiên của riêng bạn
 *  4. Triển khai (Deploy) → Tuỳ chọn triển khai mới → loại "Ứng dụng web"
 *       - Thực thi với tư cách:      Tôi
 *       - Người có quyền truy cập:   Bất kỳ ai   (KHÔNG chọn "Bất kỳ ai có Tài khoản Google")
 *     → Triển khai → Uỷ quyền truy cập → chọn tài khoản → Nâng cao → Chuyển đến... → Cho phép
 *  5. Copy "URL ứng dụng web" (đuôi /exec), dán cùng TOKEN vào biến môi trường của website
 *
 *  Script vừa ĐỌC vừa GHI vào sheet (trang quản trị). Ai có cả URL lẫn TOKEN là sửa được
 *  điểm — giữ TOKEN bí mật, chỉ để trong biến môi trường Netlify.
 *
 * LƯU Ý: mỗi lần sửa code phải Triển khai → Quản lý các lần triển khai → Chỉnh sửa →
 *        Phiên bản: Phiên bản mới, thì URL cũ mới chạy code mới. Chỉ bấm Lưu là chưa đủ.
 */

/** Chuỗi bí mật — PHẢI đổi, và phải trùng với APPS_SCRIPT_TOKEN của website. */
var TOKEN = 'DOI-CHUOI-NAY-THANH-CHUOI-NGAU-NHIEN-CUA-BAN';

/**
 * Các tab website được phép đọc. Đổi tên tab trên sheet thì sửa cả ở đây lẫn biến
 * SHEET_TAB_* của website. Tab nào không có trong danh sách thì website không đọc được.
 */
var TAB_KET_QUA = 'KetQua';
var TAB_MO_TA = 'MoTaKyNang';
var TAB_THANG_LEVEL = 'ThangLevel';
/** Danh sách giáo viên chấm điểm — chỉ trang quản trị đọc, không trả ra trang tra cứu. */
var TAB_GIAO_VIEN = 'GiaoVien';
var CAC_TAB = [TAB_KET_QUA, TAB_MO_TA, TAB_THANG_LEVEL];

/** Điểm tối đa từng kỹ năng (khung iLEAD) — khớp KY_NANG trong shared/bao-cao.ts. */
var DIEM_TOI_DA = { listening: 20, reading: 20, writing: 15, speaking: 20 };
var KY_NANG = ['listening', 'reading', 'writing', 'speaking'];

function doGet(e) {
  var token = (e && e.parameter && e.parameter.token) || '';
  if (!khopToken(token, TOKEN)) {
    return traVeJson({ error: 'UNAUTHORIZED' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = {};
  for (var i = 0; i < CAC_TAB.length; i++) {
    tabs[CAC_TAB[i]] = docTab(ss, CAC_TAB[i]);
  }
  return traVeJson({ tabs: tabs });
}

/** Mảng 2 chiều đúng như hiển thị trên sheet (giữ nguyên "100%", định dạng ngày...). */
function docTab(ss, ten) {
  var sh = ss.getSheetByName(ten);
  if (!sh) return [];
  var range = sh.getDataRange();
  return range ? range.getDisplayValues() : [];
}

/** So sánh không dừng sớm, để thời gian phản hồi không lộ token đúng được mấy ký tự. */
function khopToken(a, b) {
  if (a.length !== b.length) return false;
  var khac = 0;
  for (var i = 0; i < a.length; i++) {
    khac |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return khac === 0;
}

function traVeJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * CHẠY TAY MỘT LẦN (chọn hàm này trên thanh công cụ → Chạy).
 * Chạy lại bất cứ lúc nào — ví dụ sau khi thêm option mới vào tab MoTaKyNang.
 *
 *   - Cột diem_*:   chỉ nhận số 0 → điểm tối đa của kỹ năng (Writing 15, còn lại 20)
 *   - Cột option_*: dropdown lấy đúng danh sách option của kỹ năng đó trong MoTaKyNang
 *   - Cố định hàng tiêu đề và 2 cột đầu (mã, tên) khi cuộn
 */
/* ============================== GHI (trang quản trị) ============================== */

/**
 * Các cột trang quản trị được ghi. Cột khác (kể cả cột công thức bạn tự thêm) không
 * bao giờ bị đụng tới. Phải khớp COT_SUA trong shared/hoc-sinh-sua.ts.
 */
var COT_GHI = [
  'ho_ten', 'lop', 'giao_vien', 'ngay_cham',
  'diem_listening', 'diem_reading', 'diem_writing', 'diem_speaking', 'lop_xep',
  'option_listening', 'option_reading', 'option_writing', 'option_speaking',
  'mo_ta_rieng_speaking', 'pct_co_ban', 'pct_nang_cao', 'nhan_xet_lo_trinh'
];

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (x) {
    return traVeJson({ error: 'BAD_REQUEST' });
  }
  if (!khopToken(String(body.token || ''), TOKEN)) {
    return traVeJson({ error: 'UNAUTHORIZED' });
  }
  if (body.action === 'luu') {
    return traVeJson(luuHocSinh(body.hocSinh || {}, body.truoc || null));
  }
  if (body.action === 'docPlacement') {
    // phienBan: website dựa vào đây để biết Code.gs làm được gì.
    //   2 = mã cấp trước + chấm Speaking sau;  3 = lưu lớp giáo viên chốt (cột lop_xep)
    //   4 = kèm danh sách giáo viên (tab GiaoVien; chưa có tab thì mảng rỗng)
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return traVeJson({ ok: true, phienBan: 4, rows: docTab(ss, TAB_PLACEMENT), giaoVien: docTab(ss, TAB_GIAO_VIEN) });
  }
  if (body.action === 'chamPlacement2') {
    return traVeJson(chamPlacement(String(body.maBai || ''), body.hocSinh || {}, body.cham || {}));
  }
  if (body.action === 'taoMa') {
    return traVeJson(taoMa(body.ma || [], String(body.lop || ''), String(body.giao_vien || '')));
  }
  if (body.action === 'nopBaiTest') {
    return traVeJson(nopBaiTest(body.dong || {}, body.congThuc || {}, body.chuThich || {}, body.rangBuoc || {}));
  }
  return traVeJson({ error: 'UNKNOWN_ACTION' });
}

/* ============================== PLACEMENT TEST ============================== */

var TAB_PLACEMENT = 'PlacementTest';

/**
 * Thêm một dòng bài làm vào tab PlacementTest (tự tạo tab + hàng tiêu đề nếu chưa có).
 *
 * CHỐNG DỮ LIỆU RÁC: dong.ma_hoc_sinh phải là mã giáo viên đã cấp (có trong KetQua) và chưa
 * làm bài lần nào — sai thì trả MA_KHONG_CO / MA_DA_DUNG, không ghi gì. Hợp lệ thì ngoài dòng
 * bài làm, điểm Listening + Reading (máy chấm) được ghi luôn vào dòng của mã đó trong KetQua;
 * Writing và Speaking chờ giáo viên chấm (chamPlacement).
 *
 * Cột tìm theo TÊN ở hàng 1: đổi thứ tự cột thoải mái; cột mới website gửi lên mà sheet
 * chưa có thì tự thêm vào cuối. Cùng ma_bai gửi 2 lần (bấm Nộp lại) chỉ ghi 1 dòng.
 *
 * Writing Part 2 do giáo viên chấm: website gửi kèm
 *   congThuc  { ten_cot: '=IF({cot_a}="",...)' }  — {cot_a} đổi thành ô cùng dòng (vd H5),
 *             để giáo viên gõ điểm vào diem_writing_p2_gv là diem_writing, tong_diem tự tính.
 *   chuThich  { ten_cot: 'ghi chú' }   — gắn vào ô tiêu đề (đáp án gợi ý cho giáo viên).
 *   rangBuoc  { ten_cot: [min, max] }  — cột chỉ nhận số trong khoảng này.
 * Chú thích và ràng buộc chỉ gắn lúc cột vừa được tạo, sửa tay trên sheet sẽ được giữ nguyên.
 */
function nopBaiTest(dong, congThuc, chuThich, rangBuoc) {
  var maBai = String(dong.ma_bai || '');
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(maBai)) return { error: 'INVALID', message: 'Thiếu mã bài làm.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { error: 'BUSY', message: 'Máy chủ đang bận, vui lòng nộp lại.' };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(TAB_PLACEMENT);
    var cacKhoa = Object.keys(dong);
    var cotMoi = [];
    if (!sh) {
      sh = ss.insertSheet(TAB_PLACEMENT);
      sh.getRange(1, 1, 1, cacKhoa.length).setValues([cacKhoa]).setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.setFrozenColumns(3);
      cotMoi = cacKhoa.slice();
    }
    var tieuDe = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) {
      return String(h).trim();
    });
    for (var i = 0; i < cacKhoa.length; i++) {
      if (tieuDe.indexOf(cacKhoa[i]) < 0) {
        tieuDe.push(cacKhoa[i]);
        sh.getRange(1, tieuDe.length).setValue(cacKhoa[i]).setFontWeight('bold');
        cotMoi.push(cacKhoa[i]);
      }
    }

    // Cột vừa tạo: gắn chú thích, ràng buộc điểm và tô vàng cột giáo viên nhập.
    for (var m = 0; m < cotMoi.length; m++) {
      var ten = cotMoi[m];
      var cot = tieuDe.indexOf(ten) + 1;
      if (chuThich[ten]) sh.getRange(1, cot).setNote(String(chuThich[ten]));
      var khoang = rangBuoc[ten];
      if (khoang && khoang.length === 2) {
        var luat = SpreadsheetApp.newDataValidation()
          .requireNumberBetween(Number(khoang[0]), Number(khoang[1]))
          .setAllowInvalid(false)
          .setHelpText('Nhập điểm từ ' + khoang[0] + ' đến ' + khoang[1] + '.')
          .build();
        var vung = sh.getRange(2, cot, Math.max(sh.getMaxRows() - 1, 1), 1);
        vung.setDataValidation(luat);
        vung.setBackground('#fff7d6');
        sh.getRange(1, cot).setBackground('#ffe08a');
      }
    }

    var cotMa = tieuDe.indexOf('ma_bai');
    var cuoi = sh.getLastRow();
    if (cotMa >= 0 && cuoi >= 2) {
      var cacMa = sh.getRange(2, cotMa + 1, cuoi - 1, 1).getDisplayValues();
      for (var r = 0; r < cacMa.length; r++) {
        if (cacMa[r][0] === maBai) return { ok: true, trung: true };
      }
    }

    // Mã học sinh: phải do giáo viên cấp và chưa dùng. Kiểm tra SAU bước trùng ma_bai ở trên,
    // để học sinh bấm "Nộp lại" (bài đã ghi rồi) không bị báo nhầm là mã đã dùng.
    var hsKq = timTrongKetQua(ss, dong.ma_hoc_sinh);
    if (!hsKq) return { error: 'MA_KHONG_CO', message: 'Mã học sinh không đúng.' };
    var daDung = false;
    for (var d = 0; d < KY_NANG.length; d++) {
      if (String(hsKq.hang['diem_' + KY_NANG[d]] || '').trim() !== '') daDung = true;
    }
    var cotMaHs = tieuDe.indexOf('ma_hoc_sinh');
    if (!daDung && cotMaHs >= 0 && cuoi >= 2) {
      var cacMaHs = sh.getRange(2, cotMaHs + 1, cuoi - 1, 1).getDisplayValues();
      for (var q = 0; q < cacMaHs.length; q++) {
        if (chuanMa(cacMaHs[q][0]) === chuanMa(hsKq.ma)) daDung = true;
      }
    }
    if (daDung) return { error: 'MA_DA_DUNG', message: 'Mã học sinh này đã được dùng để làm bài.' };
    dong.ma_hoc_sinh = hsKq.ma; // ghi đúng cách viết trên KetQua, không phải kiểu học sinh gõ

    var dongMoi = cuoi + 1;
    if (dongMoi > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 100);
    /** '{ten_cot}' → địa chỉ ô của cột đó trên dòng mới, vd 'H5'. */
    var diaChi = function (_, ten) {
      var c = tieuDe.indexOf(ten);
      return c < 0 ? '0' : sh.getRange(dongMoi, c + 1).getA1Notation();
    };
    var hang = tieuDe.map(function (h) {
      if (congThuc[h] || !(h in dong)) return '';
      var v = dong[h];
      if (typeof v === 'number') return v;
      var s = String(v == null ? '' : v);
      // Chữ ghi dạng chữ: ngày sinh không bị đổi kiểu Mỹ, "=..." không thành công thức.
      return s === '' ? '' : "'" + s;
    });
    sh.getRange(dongMoi, 1, 1, hang.length).setValues([hang]);

    // Công thức ghi riêng bằng setFormula: hàm này LUÔN hiểu cú pháp tiếng Anh (dấu phẩy),
    // bất kể vùng của sheet. Ghi qua setValues thì sheet đặt vùng Việt Nam (dùng dấu ;)
    // đọc sai cú pháp và báo #ERROR!.
    for (var f = 0; f < tieuDe.length; f++) {
      var ct = congThuc[tieuDe[f]];
      if (ct) sh.getRange(dongMoi, f + 1).setFormula(String(ct).replace(/\{([a-zA-Z0-9_-]+)\}/g, diaChi));
    }

    // Kết quả lưu vào mã học sinh: điểm máy chấm vào thẳng dòng của mã trong KetQua.
    // Tên giáo viên đã nhập sẵn thì giữ; chưa có thì lấy tên học sinh tự gõ.
    var capNhat = { diem_listening: dong.diem_listening, diem_reading: dong.diem_reading };
    if (String(hsKq.hang.ho_ten || '').trim() === '') capNhat.ho_ten = String(dong.ho_ten || '');
    var kqGhi = ghiHocSinh(ss, capNhat, null, hsKq.ma);
    SpreadsheetApp.flush();
    return { ok: true, trung: false, daGhiKetQua: !kqGhi.error, ma_hoc_sinh: hsKq.ma };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Giáo viên chấm bài placement trên trang quản trị → trong MỘT lần khoá:
 *   1. Tìm bài theo ma_bai. Bài đã có đủ điểm Writing Part 2 + Speaking thì báo DA_CHAM.
 *   2. Hai phần chấm ĐỘC LẬP: gửi phần nào ghi phần đó (Speaking thường chấm gom sau).
 *      Phần đã có điểm trên dòng bài làm thì giữ nguyên, không ghi đè.
 *   3. Lấy điểm Listening, Reading, Writing Part 1 từ CHÍNH dòng bài làm (không tin số trình
 *      duyệt gửi) rồi ghi vào dòng của MÃ HỌC SINH trong tab KetQua. Mã lấy từ dòng bài làm
 *      (học sinh nhập lúc làm bài). Bài nộp kiểu cũ chưa có mã → dùng mã trình duyệt tạo và
 *      thêm học sinh mới như trước.
 *   4. Ghi lại vào dòng bài làm: điểm GV vừa chấm, người chấm. Cột trang_thai là công thức,
 *      tự đổi "Chờ chấm Speaking" → "Đã chấm xong".
 * cham = { w2: tổng điểm Writing Part 2 (0–12) hoặc null nếu lần này chưa chấm phần viết }
 * hs.diem_speaking trống = lần này chưa chấm Speaking.
 */
function chamPlacement(maBai, hs, cham) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(maBai)) return { error: 'INVALID', message: 'Thiếu mã bài làm.' };
  var coW2 = cham.w2 !== null && cham.w2 !== undefined && String(cham.w2).trim() !== '';
  var w2 = coW2 ? Number(cham.w2) : null;
  if (coW2 && (!isFinite(w2) || w2 < 0 || w2 > 12)) return { error: 'INVALID', loi: { w2: 'Writing Part 2 từ 0 đến 12.' } };
  var coNoi = hs.diem_speaking !== null && hs.diem_speaking !== undefined && String(hs.diem_speaking).trim() !== '';

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { error: 'BUSY', message: 'Có người khác đang lưu, thử lại sau vài giây.' };
  try {
    var sh = ss.getSheetByName(TAB_PLACEMENT);
    if (!sh) return { error: 'NO_TAB', message: 'Chưa có tab ' + TAB_PLACEMENT + '.' };
    var duLieu = sh.getDataRange().getDisplayValues();
    var tieuDe = duLieu[0].map(function (h) { return String(h).trim(); });
    var c = function (ten) { return tieuDe.indexOf(ten); };
    var dong = -1;
    for (var r = 1; r < duLieu.length; r++) {
      if (duLieu[r][c('ma_bai')] === maBai) { dong = r; break; }
    }
    if (dong < 0) return { error: 'GONE', message: 'Không tìm thấy bài làm này trên sheet (có thể đã bị xoá).' };
    var hang = duLieu[dong];
    var chu = function (ten) { return c(ten) >= 0 ? String(hang[c(ten)]).trim() : ''; };
    var so = function (ten) {
      var v = chu(ten).replace(',', '.');
      return v === '' ? 0 : Number(v);
    };

    var w2Cu = chu('diem_writing_p2_gv');
    var noiCu = chu('diem_speaking');
    if (w2Cu !== '' && noiCu !== '') {
      return { error: 'DA_CHAM', message: 'Bài này đã được chấm xong cả Writing Part 2 và Speaking.' };
    }
    var ghiW2 = w2Cu === '' && coW2;
    var ghiNoi = noiCu === '' && coNoi;
    if (!ghiW2 && !ghiNoi) {
      return { error: 'DA_CHAM', message: 'Phần bạn vừa chấm đã có điểm trên sheet (người khác vừa chấm). Bấm Tải lại.' };
    }

    // Mã: ưu tiên mã học sinh đã nhập lúc làm bài. Bài kiểu cũ chưa có → mã trình duyệt tạo.
    var maDong = chu('ma_hoc_sinh');
    var ma = (maDong || String(hs.ma_hoc_sinh || '')).trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(ma)) {
      return { error: 'INVALID', loi: { ma_hoc_sinh: 'Mã học sinh không hợp lệ.' } };
    }
    if (!maDong) {
      // Mã mới phải chưa có trong KetQua — ghiHocSinh gặp mã đã có sẽ GHI ĐÈ học sinh đó.
      if (timTrongKetQua(ss, ma)) return { error: 'MA_TRUNG', message: 'Mã ' + ma + ' đã có, bấm Lưu lại để tạo mã khác.' };
    }

    var w2Moi = w2Cu !== '' ? Number(w2Cu.replace(',', '.')) : w2; // null = chưa chấm phần viết
    var xong = w2Moi !== null && (noiCu !== '' || ghiNoi);

    // Chỉ gửi cột nào có giá trị: ghiHocSinh bỏ qua cột không có trong object, nên thông tin
    // giáo viên đã nhập sẵn cho mã này (lớp, tên…) không bị xoá trắng.
    var hocSinh = { ma_hoc_sinh: ma, diem_listening: so('diem_listening'), diem_reading: so('diem_reading') };
    var ten0 = String(hs.ho_ten || '').trim() || (maDong ? '' : chu('ho_ten'));
    if (ten0) hocSinh.ho_ten = ten0;
    if (hs.lop) hocSinh.lop = String(hs.lop);
    if (hs.giao_vien) hocSinh.giao_vien = String(hs.giao_vien);
    if (w2Moi !== null) hocSinh.diem_writing = Math.min(DIEM_TOI_DA.writing, so('diem_writing_p1') + w2Moi);
    if (ghiNoi) {
      hocSinh.diem_speaking = hs.diem_speaking;
      if (hs.mo_ta_rieng_speaking) hocSinh.mo_ta_rieng_speaking = String(hs.mo_ta_rieng_speaking);
    }
    if (xong && hs.lop_xep) hocSinh.lop_xep = String(hs.lop_xep);
    if (xong) hocSinh.ngay_cham = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');

    var loi = kiemTraTruocKhiGhi(ss, hocSinh);
    if (Object.keys(loi).length) return { error: 'INVALID', loi: loi };

    var kq = ghiHocSinh(ss, hocSinh, null, ma);
    if (kq.error) return kq;

    // Ghi phần vừa chấm vào dòng bài làm (thêm cột còn thiếu ở cuối). KHÔNG đụng trang_thai:
    // đó là công thức, tự chuyển "Chờ chấm Speaking" → "Đã chấm xong" theo hai ô điểm.
    var ghi = {};
    if (ghiW2) ghi.diem_writing_p2_gv = w2;
    if (ghiNoi) ghi.diem_speaking = Number(String(hs.diem_speaking).replace(',', '.'));
    if (!maDong) ghi.ma_hoc_sinh = "'" + ma;
    if (hs.giao_vien) ghi.nguoi_cham = "'" + hs.giao_vien;
    for (var ten in ghi) {
      var cot = tieuDe.indexOf(ten);
      if (cot < 0) {
        tieuDe.push(ten);
        cot = tieuDe.length - 1;
        sh.getRange(1, cot + 1).setValue(ten).setFontWeight('bold');
      }
      sh.getRange(dong + 1, cot + 1).setValue(ghi[ten]);
    }
    SpreadsheetApp.flush();
    return {
      ok: true,
      ma_hoc_sinh: ma,
      xong: xong,
      hocSinh: hocSinh,
      bai: {
        ma_hoc_sinh: ma,
        diem_writing_p2_gv: w2Moi === null ? '' : w2Moi,
        diem_speaking: ghiNoi ? hs.diem_speaking : noiCu
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Dòng CUỐI CÙNG trùng mã trong tab KetQua (giống cách website đọc).
 * Trả { ma: cách viết trên sheet, hang: { ten_cot: giá trị hiển thị } } hoặc null.
 */
function timTrongKetQua(ss, maTim) {
  var khoa = chuanMa(maTim);
  if (!khoa) return null;
  var bang = docTab(ss, TAB_KET_QUA);
  var tieuDe = (bang[0] || []).map(function (h) { return String(h).trim(); });
  var cMa = tieuDe.indexOf('ma_hoc_sinh');
  if (cMa < 0) return null;
  for (var i = bang.length - 1; i >= 1; i--) {
    if (chuanMa(bang[i][cMa]) !== khoa) continue;
    var hang = {};
    for (var j = 0; j < tieuDe.length; j++) if (tieuDe[j]) hang[tieuDe[j]] = bang[i][j];
    return { ma: String(bang[i][cMa]).trim(), hang: hang };
  }
  return null;
}

/**
 * Giáo viên tạo mã làm bài TRƯỚC khi học sinh thi: thêm mỗi mã một dòng vào KetQua, chỉ có
 * mã + thông tin lớp + giáo viên (họ tên, điểm để trống — điền dần khi học sinh làm bài và
 * giáo viên chấm). Mã lỡ trùng mã đã có thì bỏ qua. Trả về danh sách mã ĐÃ tạo.
 */
function taoMa(dsMa, lop, giaoVien) {
  if (!dsMa || !dsMa.length || dsMa.length > 60) return { error: 'INVALID', message: 'Số lượng mã từ 1 đến 60.' };
  for (var i = 0; i < dsMa.length; i++) {
    if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(String(dsMa[i]))) return { error: 'INVALID', message: 'Mã không hợp lệ: ' + dsMa[i] };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { error: 'BUSY', message: 'Có người khác đang lưu, thử lại sau vài giây.' };
  try {
    var sh = ss.getSheetByName(TAB_KET_QUA);
    if (!sh) return { error: 'NO_TAB', message: 'Không tìm thấy tab "' + TAB_KET_QUA + '".' };
    var soCot = sh.getLastColumn();
    var tieuDe = sh.getRange(1, 1, 1, soCot).getValues()[0].map(function (h) { return String(h).trim(); });
    var cotMa = tieuDe.indexOf('ma_hoc_sinh');
    if (cotMa < 0) return { error: 'NO_CODE_COLUMN', message: 'Tab KetQua thiếu cột ma_hoc_sinh.' };

    var dongCuoi = sh.getLastRow();
    var daCo = {};
    if (dongCuoi >= 2) {
      var cacMa = sh.getRange(2, cotMa + 1, dongCuoi - 1, 1).getDisplayValues();
      for (var r = 0; r < cacMa.length; r++) daCo[chuanMa(cacMa[r][0])] = true;
    }

    var tao = [];
    var cacHang = [];
    for (var k = 0; k < dsMa.length; k++) {
      var ma = String(dsMa[k]);
      if (daCo[chuanMa(ma)]) continue;
      daCo[chuanMa(ma)] = true;
      tao.push(ma);
      cacHang.push(tieuDe.map(function (h) {
        if (h === 'ma_hoc_sinh') return "'" + ma;
        if (h === 'lop') return giaTriO(h, lop);
        if (h === 'giao_vien') return giaTriO(h, giaoVien);
        return '';
      }));
    }
    if (cacHang.length) {
      var thieuDong = dongCuoi + cacHang.length - sh.getMaxRows();
      if (thieuDong > 0) sh.insertRowsAfter(sh.getMaxRows(), thieuDong + 50);
      // Ghi từng ô có giá trị thay vì cả hàng: không đè công thức/cột tự thêm ở các cột khác.
      for (var n = 0; n < cacHang.length; n++) {
        for (var cc = 0; cc < tieuDe.length; cc++) {
          if (cacHang[n][cc] !== '') sh.getRange(dongCuoi + 1 + n, cc + 1).setValue(cacHang[n][cc]);
        }
      }
      SpreadsheetApp.flush();
    }
    return { ok: true, ma: tao };
  } finally {
    lock.releaseLock();
  }
}

function chuanMa(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function chuanKhoa(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Cập nhật học sinh theo mã (dòng CUỐI CÙNG trùng mã — giống cách website đọc),
 * chưa có thì thêm dòng mới. Khoá script để hai giáo viên lưu cùng lúc không ghi đè
 * lên cùng một dòng trống.
 *
 * truoc = giá trị các ô LÚC GIÁO VIÊN MỞ học sinh này. Ô nào trên sheet giờ đã khác
 * (người khác vừa sửa) thì KHÔNG ghi gì cả, trả CONFLICT kèm giá trị hiện tại để trang
 * quản trị hỏi lại giáo viên.
 */
function luuHocSinh(hs, truoc) {
  var ma = String(hs.ma_hoc_sinh || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(ma)) {
    return { error: 'INVALID', loi: { ma_hoc_sinh: 'Mã học sinh không hợp lệ.' } };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var loi = kiemTraTruocKhiGhi(ss, hs);
  if (Object.keys(loi).length) return { error: 'INVALID', loi: loi };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { error: 'BUSY', message: 'Có người khác đang lưu, thử lại sau vài giây.' };
  }
  try {
    return ghiHocSinh(ss, hs, truoc, ma);
  } finally {
    lock.releaseLock();
  }
}

/** Phần ghi của luuHocSinh — người gọi PHẢI đang giữ khoá script. */
function ghiHocSinh(ss, hs, truoc, ma) {
  {
    var sh = ss.getSheetByName(TAB_KET_QUA);
    if (!sh) return { error: 'NO_TAB', message: 'Không tìm thấy tab "' + TAB_KET_QUA + '".' };

    var soCot = sh.getLastColumn();
    var tieuDe = sh.getRange(1, 1, 1, soCot).getValues()[0].map(function (h) {
      return String(h).trim();
    });
    var cotMa = tieuDe.indexOf('ma_hoc_sinh');
    if (cotMa < 0) return { error: 'NO_CODE_COLUMN', message: 'Tab KetQua thiếu cột ma_hoc_sinh.' };

    var dongCuoi = sh.getLastRow();
    var dong = -1;
    if (dongCuoi >= 2) {
      var cacMa = sh.getRange(2, cotMa + 1, dongCuoi - 1, 1).getDisplayValues();
      for (var i = cacMa.length - 1; i >= 0; i--) {
        if (chuanMa(cacMa[i][0]) === chuanMa(ma)) {
          dong = i + 2;
          break;
        }
      }
    }
    var moi = dong < 0;

    if (truoc) {
      // Đang sửa học sinh có sẵn mà dòng đã biến mất → có người xoá, đừng tạo lại dòng thiếu.
      if (moi) return { error: 'GONE' };
      var hang = sh.getRange(dong, 1, 1, soCot).getDisplayValues()[0];
      var xungDot = {};
      for (var k = 0; k < COT_GHI.length; k++) {
        var tenCot = COT_GHI[k];
        if (!(tenCot in hs) || !(tenCot in truoc)) continue;
        var viTri = tieuDe.indexOf(tenCot);
        if (viTri < 0) continue;
        var hienTai = hang[viTri];
        // Sheet vẫn như lúc mở, hoặc người kia đổi đúng thành giá trị mình định ghi → không xung đột.
        if (giongNhau(tenCot, hienTai, truoc[tenCot]) || giongNhau(tenCot, hienTai, hs[tenCot])) continue;
        xungDot[tenCot] = hienTai;
      }
      if (Object.keys(xungDot).length) return { error: 'CONFLICT', xungDot: xungDot };
    }

    if (moi) {
      dong = dongCuoi + 1;
      sh.getRange(dong, cotMa + 1).setValue("'" + ma);
    }

    for (var c = 0; c < COT_GHI.length; c++) {
      var ten = COT_GHI[c];
      if (!(ten in hs)) continue;
      var cot = tieuDe.indexOf(ten);
      if (cot < 0 && ten === 'lop_xep' && String(hs[ten] || '').trim() !== '') {
        // Sheet tạo trước khi có tính năng xếp lớp → tự thêm cột ở cuối, không bắt ai làm tay.
        cot = soCot;
        tieuDe.push(ten);
        if (sh.getMaxColumns() < cot + 1) sh.insertColumnAfter(sh.getMaxColumns());
        sh.getRange(1, cot + 1).setValue(ten).setFontWeight('bold');
      }
      if (cot < 0) continue;
      sh.getRange(dong, cot + 1).setValue(giaTriO(ten, hs[ten]));
    }
    SpreadsheetApp.flush();
    return { ok: true, moi: moi, dong: dong };
  }
}

/** So hai giá trị ô: điểm so theo số ("12,5" = "12.5"), còn lại so chuỗi đã cắt khoảng trắng. */
function giongNhau(ten, a, b) {
  var x = String(a == null ? '' : a).trim();
  var y = String(b == null ? '' : b).trim();
  if (x === y) return true;
  if (ten.indexOf('diem_') === 0 && x !== '' && y !== '') {
    return Number(x.replace(',', '.')) === Number(y.replace(',', '.'));
  }
  return false;
}

/**
 * Điểm ghi dạng số. Mọi thứ khác ghi dạng chữ (thêm dấu ' phía trước): ngày "05/11/2026"
 * không bị sheet đổi thành ngày kiểu Mỹ, và chữ bắt đầu bằng = không thành công thức.
 */
function giaTriO(ten, v) {
  var s = String(v == null ? '' : v).trim();
  if (s === '') return '';
  if (ten.indexOf('diem_') === 0) return Number(s);
  return "'" + s;
}

function kiemTraTruocKhiGhi(ss, hs) {
  var loi = {};
  for (var i = 0; i < KY_NANG.length; i++) {
    var kn = KY_NANG[i];
    var d = hs['diem_' + kn];
    if (d != null && String(d).trim() !== '') {
      var n = Number(String(d).replace(',', '.'));
      if (!isFinite(n) || n < 0 || n > DIEM_TOI_DA[kn]) loi['diem_' + kn] = 'Điểm từ 0 đến ' + DIEM_TOI_DA[kn] + '.';
    }
  }

  // Option phải có trong tab MoTaKyNang của đúng kỹ năng đó.
  var moTa = docTab(ss, TAB_MO_TA);
  var td = moTa[0] || [];
  var cKn = td.indexOf('ky_nang');
  var cOpt = td.indexOf('option');
  for (var j = 0; j < KY_NANG.length; j++) {
    var ten = 'option_' + KY_NANG[j];
    var opt = String(hs[ten] == null ? '' : hs[ten]).trim();
    if (!opt) continue;
    var co = false;
    for (var r = 1; r < moTa.length && cKn >= 0 && cOpt >= 0; r++) {
      if (chuanKhoa(moTa[r][cKn]) === KY_NANG[j] && chuanKhoa(moTa[r][cOpt]) === chuanKhoa(opt)) co = true;
    }
    if (!co) loi[ten] = 'Option không có trong tab ' + TAB_MO_TA + '.';
  }

  // Lớp giáo viên chốt phải là một lớp trong tab ThangLevel.
  var lopXep = String(hs.lop_xep == null ? '' : hs.lop_xep).trim();
  if (lopXep && cacLop(ss).map(chuanKhoa).indexOf(chuanKhoa(lopXep)) < 0) {
    loi.lop_xep = 'Lớp không có trong tab ' + TAB_THANG_LEVEL + '.';
  }
  return loi;
}

/** Tên các lớp (iLEAD 1…4) theo thứ tự trên tab ThangLevel. */
function cacLop(ss) {
  var bang = docTab(ss, TAB_THANG_LEVEL);
  var cot = (bang[0] || []).map(function (h) { return String(h).trim(); }).indexOf('lop_xep');
  if (cot < 0) return [];
  return bang.slice(1).map(function (r) { return String(r[cot]).trim(); }).filter(String);
}

/* ============================== THIẾT LẬP ============================== */

/**
 * CHẠY TAY MỘT LẦN: tạo tab GiaoVien (chọn hàm này trên thanh công cụ → Chạy).
 * Đã có tab thì chỉ thêm cột còn thiếu và dropdown, KHÔNG xoá hay sửa tên đã nhập.
 * Xong thì mỗi giáo viên gõ một dòng; trang chấm điểm bấm Tải lại là thấy.
 */
function taoTabGiaoVien() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_GIAO_VIEN) || ss.insertSheet(TAB_GIAO_VIEN);
  var soCot = sh.getLastColumn();
  var tieuDe = soCot ? sh.getRange(1, 1, 1, soCot).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  var can = ['ho_ten', 'co_so', 'trang_thai'];
  for (var i = 0; i < can.length; i++) {
    if (tieuDe.indexOf(can[i]) >= 0) continue;
    tieuDe.push(can[i]);
    sh.getRange(1, tieuDe.length).setValue(can[i]).setFontWeight('bold');
  }
  sh.getRange(2, tieuDe.indexOf('trang_thai') + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Đang dạy', 'Nghỉ'], true)
      .setAllowInvalid(false)
      .setHelpText('Để trống = Đang dạy. Chọn Nghỉ thì tên không còn trong ô chọn giáo viên.')
      .build()
  );
  sh.setFrozenRows(1);
  Logger.log('Tab %s đã sẵn sàng: mỗi giáo viên một dòng, cột %s.', TAB_GIAO_VIEN, can.join(', '));
}

function thietLapRangBuoc() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_KET_QUA);
  if (!sh) throw new Error('Không tìm thấy tab "' + TAB_KET_QUA + '".');

  var tieuDe = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var soDong = Math.max(sh.getMaxRows() - 1, 1);

  var moTa = docTab(ss, TAB_MO_TA);
  var tdMoTa = moTa[0] || [];
  var cotKyNang = tdMoTa.indexOf('ky_nang');
  var cotOption = tdMoTa.indexOf('option');

  var daLam = [];
  for (var i = 0; i < KY_NANG.length; i++) {
    var kn = KY_NANG[i];

    var cotDiem = tieuDe.indexOf('diem_' + kn);
    if (cotDiem >= 0) {
      var luatDiem = SpreadsheetApp.newDataValidation()
        .requireNumberBetween(0, DIEM_TOI_DA[kn])
        .setAllowInvalid(false)
        .setHelpText('Nhập điểm ' + kn + ' từ 0 đến ' + DIEM_TOI_DA[kn] + '.')
        .build();
      sh.getRange(2, cotDiem + 1, soDong, 1).setDataValidation(luatDiem);
      daLam.push('diem_' + kn + ': 0–' + DIEM_TOI_DA[kn]);
    }

    var cotOpt = tieuDe.indexOf('option_' + kn);
    if (cotOpt >= 0 && cotKyNang >= 0 && cotOption >= 0) {
      var dsOption = [];
      for (var r = 1; r < moTa.length; r++) {
        var tenOpt = String(moTa[r][cotOption]).trim();
        // Mỗi khoảng điểm đều có Option 1–3 → chỉ lấy mỗi tên một lần.
        if (String(moTa[r][cotKyNang]).trim().toLowerCase() === kn && tenOpt && dsOption.indexOf(tenOpt) < 0) {
          dsOption.push(tenOpt);
        }
      }
      if (dsOption.length) {
        var luatOption = SpreadsheetApp.newDataValidation()
          .requireValueInList(dsOption, true)
          .setAllowInvalid(false)
          .setHelpText('Chọn cách diễn đạt cho ' + kn + '. Khoảng điểm do điểm quyết định; để trống = Option 1.')
          .build();
        sh.getRange(2, cotOpt + 1, soDong, 1).setDataValidation(luatOption);
        daLam.push('option_' + kn + ': ' + dsOption.join(', '));
      }
    }
  }

  var cotLopXep = tieuDe.indexOf('lop_xep');
  var dsLop = cacLop(ss);
  if (cotLopXep >= 0 && dsLop.length) {
    sh.getRange(2, cotLopXep + 1, soDong, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(dsLop, true)
        .setAllowInvalid(false)
        .setHelpText('Lớp giáo viên chốt. Để trống = báo cáo dùng lớp gợi ý theo tổng điểm.')
        .build()
    );
    daLam.push('lop_xep: ' + dsLop.join(', '));
  }

  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  Logger.log('Đã thiết lập ràng buộc cho ' + daLam.length + ' cột:\n  ' + daLam.join('\n  '));
}

/**
 * Chạy thử trong trình soạn thảo: chọn hàm kiemTra → Chạy → xem Nhật ký thực thi.
 */
function kiemTra() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < CAC_TAB.length; i++) {
    var rows = docTab(ss, CAC_TAB[i]);
    if (!rows.length) {
      Logger.log('LOI: khong tim thay tab "%s"', CAC_TAB[i]);
    } else {
      Logger.log('Tab %s: %s dong, cot: %s', CAC_TAB[i], rows.length - 1, rows[0].join(', '));
    }
  }
  if (TOKEN.indexOf('DOI-CHUOI-NAY') === 0) {
    Logger.log('CANH BAO: ban chua doi TOKEN.');
  }
}
