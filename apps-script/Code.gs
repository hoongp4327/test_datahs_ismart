/**
 * Apps Script đọc dữ liệu từ chính Google Sheet này và trả về JSON.
 *
 * CÁCH DÙNG
 *  1. Mở Google Sheet → Extensions (Tiện ích mở rộng) → Apps Script
 *  2. Xoá hết code mẫu, dán toàn bộ file này vào
 *  3. Đổi TOKEN bên dưới thành một chuỗi ngẫu nhiên của riêng bạn
 *  4. Deploy → New deployment → chọn type "Web app"
 *       - Execute as:      Me (địa chỉ email của bạn)
 *       - Who has access:  Anyone
 *     → Deploy → Authorize access → chọn tài khoản → Advanced → Go to ... (unsafe) → Allow
 *  5. Copy "Web app URL" (dạng https://script.google.com/macros/s/..../exec)
 *  6. Dán URL và TOKEN vào file .env của website
 *
 * LƯU Ý: mỗi lần sửa code phải Deploy → Manage deployments → Edit → Version: New version
 *        thì URL cũ mới nhận code mới.
 */

/** Chuỗi bí mật — PHẢI đổi, và phải trùng với APPS_SCRIPT_TOKEN trong .env */
var TOKEN = 'DOI-CHUOI-NAY-THANH-CHUOI-NGAU-NHIEN-CUA-BAN';

var TAB_KET_QUA = 'KetQua';
var TAB_BAC_NANG_LUC = 'BacNangLuc';

function doGet(e) {
  var token = (e && e.parameter && e.parameter.token) || '';

  // So sánh có độ dài cố định để tránh lộ thông tin qua thời gian phản hồi.
  if (!khopToken(token, TOKEN)) {
    return traVeJson({ error: 'UNAUTHORIZED' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return traVeJson({
    results: docTab(ss, TAB_KET_QUA),
    levels: docTab(ss, TAB_BAC_NANG_LUC)
  });
}

/** Trả về mảng 2 chiều đúng như hiển thị trên sheet (giữ nguyên "100%", định dạng ngày...). */
function docTab(ss, ten) {
  var sh = ss.getSheetByName(ten);
  if (!sh) return [];
  var range = sh.getDataRange();
  return range ? range.getDisplayValues() : [];
}

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
 * Chạy thử ngay trong trình soạn thảo Apps Script:
 * chọn hàm kiemTra ở thanh công cụ → Run → xem kết quả ở Execution log.
 */
function kiemTra() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var kq = docTab(ss, TAB_KET_QUA);
  var bac = docTab(ss, TAB_BAC_NANG_LUC);

  if (!kq.length) {
    Logger.log('LOI: khong tim thay tab "%s"', TAB_KET_QUA);
    return;
  }
  if (!bac.length) {
    Logger.log('LOI: khong tim thay tab "%s"', TAB_BAC_NANG_LUC);
    return;
  }
  Logger.log('Tab %s: %s hoc sinh', TAB_KET_QUA, kq.length - 1);
  Logger.log('Tab %s: %s bac nang luc', TAB_BAC_NANG_LUC, bac.length - 1);
  Logger.log('Cot: %s', kq[0].join(', '));
  Logger.log('Ma dau tien: %s', kq[1] && kq[1][0]);
  if (TOKEN.indexOf('DOI-CHUOI-NAY') === 0) {
    Logger.log('CANH BAO: ban chua doi TOKEN.');
  }
}
