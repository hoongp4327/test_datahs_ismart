/**
 * Apps Script gắn trong Google Sheet:
 *   - doGet:             trả dữ liệu 3 tab dạng JSON cho website
 *   - doPost:            trang quản trị lưu điểm / thêm học sinh vào tab KetQua;
 *                        học sinh nộp bài placement test vào tab PlacementTest;
 *                        trang quản trị đọc bài chờ chấm và chấm xong → chuyển sang KetQua
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
  'diem_listening', 'diem_reading', 'diem_writing', 'diem_speaking',
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
    return traVeJson({ ok: true, rows: docTab(SpreadsheetApp.getActiveSpreadsheet(), TAB_PLACEMENT) });
  }
  if (body.action === 'chamPlacement') {
    return traVeJson(chamPlacement(String(body.maBai || ''), body.hocSinh || {}, body.cham || {}));
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
    SpreadsheetApp.flush();
    return { ok: true, trung: false };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Giáo viên chấm xong bài placement trên trang quản trị → trong MỘT lần khoá:
 *   1. Tìm bài theo ma_bai; bài đã chuyển rồi (có ma_hoc_sinh) thì báo DA_CHAM, không tạo trùng.
 *   2. Lấy điểm Listening, Reading, Writing Part 1 từ CHÍNH dòng bài làm (không tin số trình duyệt
 *      gửi), cộng điểm Writing Part 2 giáo viên chấm → tạo học sinh mới trong tab KetQua.
 *   3. Ghi lại vào dòng bài làm: điểm GV chấm, mã học sinh, trạng thái "Đã chuyển".
 * cham = { w2: tổng điểm Writing Part 2 (0–12), speaking: 0–20 }
 */
function chamPlacement(maBai, hs, cham) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(maBai)) return { error: 'INVALID', message: 'Thiếu mã bài làm.' };
  var ma = String(hs.ma_hoc_sinh || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(ma)) {
    return { error: 'INVALID', loi: { ma_hoc_sinh: 'Mã học sinh không hợp lệ.' } };
  }
  var w2 = Number(cham.w2);
  if (!isFinite(w2) || w2 < 0 || w2 > 12) return { error: 'INVALID', loi: { w2: 'Writing Part 2 từ 0 đến 12.' } };

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
    var daCo = c('ma_hoc_sinh') >= 0 ? String(hang[c('ma_hoc_sinh')]).trim() : '';
    if (daCo) return { error: 'DA_CHAM', ma_hoc_sinh: daCo, message: 'Bài này đã được chấm và chuyển sang ' + daCo + '.' };

    var so = function (ten) {
      var v = c(ten) >= 0 ? String(hang[c(ten)]).replace(',', '.').trim() : '';
      return v === '' ? 0 : Number(v);
    };
    var hocSinh = {
      ma_hoc_sinh: ma,
      ho_ten: String(hs.ho_ten || hang[c('ho_ten')] || '').trim(),
      lop: hs.lop || '',
      giao_vien: hs.giao_vien || '',
      ngay_cham: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy'),
      diem_listening: so('diem_listening'),
      diem_reading: so('diem_reading'),
      diem_writing: Math.min(DIEM_TOI_DA.writing, so('diem_writing_p1') + w2),
      diem_speaking: hs.diem_speaking,
      mo_ta_rieng_speaking: hs.mo_ta_rieng_speaking || ''
    };
    var loi = kiemTraTruocKhiGhi(ss, hocSinh);
    if (Object.keys(loi).length) return { error: 'INVALID', loi: loi };

    // Mã mới phải chưa có trong KetQua — ghiHocSinh gặp mã đã có sẽ GHI ĐÈ học sinh đó.
    var kqTab = docTab(ss, TAB_KET_QUA);
    var cMa = (kqTab[0] || []).indexOf('ma_hoc_sinh');
    for (var k = 1; k < kqTab.length && cMa >= 0; k++) {
      if (chuanMa(kqTab[k][cMa]) === chuanMa(ma)) return { error: 'MA_TRUNG', message: 'Mã ' + ma + ' đã có, bấm Xác nhận lại để tạo mã khác.' };
    }

    var kq = ghiHocSinh(ss, hocSinh, null, ma);
    if (kq.error) return kq;

    // Đánh dấu bài làm: thêm cột còn thiếu ở cuối, ghi giá trị (trạng thái ghi đè công thức).
    var ghi = {
      diem_writing_p2_gv: w2,
      diem_speaking: Number(hs.diem_speaking),
      ma_hoc_sinh: "'" + ma,
      nguoi_cham: hocSinh.giao_vien ? "'" + hocSinh.giao_vien : '',
      trang_thai: "'Đã chuyển → " + ma
    };
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
    return { ok: true, ma_hoc_sinh: ma, hocSinh: hocSinh };
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
  return loi;
}

/* ============================== THIẾT LẬP ============================== */

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
