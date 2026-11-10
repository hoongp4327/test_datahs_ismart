/**
 * Apps Script gắn trong Google Sheet:
 *   - doGet:             trả dữ liệu 3 tab dạng JSON cho website
 *   - doPost:            trang quản trị lưu điểm / thêm học sinh vào tab KetQua
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

var DIEM_TOI_DA = 20;
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
 *   - Cột diem_*:   chỉ nhận số 0–20, gõ sai sheet từ chối
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
    return traVeJson(luuHocSinh(body.hocSinh || {}));
  }
  return traVeJson({ error: 'UNKNOWN_ACTION' });
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
 */
function luuHocSinh(hs) {
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
  } finally {
    lock.releaseLock();
  }
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
      if (!isFinite(n) || n < 0 || n > DIEM_TOI_DA) loi['diem_' + kn] = 'Điểm từ 0 đến ' + DIEM_TOI_DA + '.';
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
        .requireNumberBetween(0, DIEM_TOI_DA)
        .setAllowInvalid(false)
        .setHelpText('Nhập điểm ' + kn + ' từ 0 đến ' + DIEM_TOI_DA + '.')
        .build();
      sh.getRange(2, cotDiem + 1, soDong, 1).setDataValidation(luatDiem);
      daLam.push('diem_' + kn + ': 0–' + DIEM_TOI_DA);
    }

    var cotOpt = tieuDe.indexOf('option_' + kn);
    if (cotOpt >= 0 && cotKyNang >= 0 && cotOption >= 0) {
      var dsOption = [];
      for (var r = 1; r < moTa.length; r++) {
        if (String(moTa[r][cotKyNang]).trim().toLowerCase() === kn && moTa[r][cotOption]) {
          dsOption.push(String(moTa[r][cotOption]).trim());
        }
      }
      if (dsOption.length) {
        var luatOption = SpreadsheetApp.newDataValidation()
          .requireValueInList(dsOption, true)
          .setAllowInvalid(false)
          .setHelpText('Chọn mô tả chung cho ' + kn + '. Để trống thì website tự chọn theo điểm.')
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
