# Website tra cứu kết quả học sinh

Học sinh / phụ huynh nhập **mã học sinh** → website trả về trang báo cáo kết quả buổi học.
Dữ liệu lấy trực tiếp từ **Google Sheet**.

---

## 1. Kiến trúc

```
Trình duyệt  ──►  /api/result?code=HS001  ──►  Netlify Function  ──►  Google Sheet
   (React)          (Netlify redirect)         (cache + giữ bí mật)    (2 tab dữ liệu)
```

Netlify Function đọc sheet theo một trong hai cách — **Apps Script** (khuyến nghị) hoặc
**service account + Sheets API** — xem mục 4. Dù chọn cách nào, thông tin bí mật (token
hoặc private key) đều nằm trong biến môi trường trên Netlify, không bao giờ lộ ra frontend.

**Tối ưu tốc độ.** Apps Script chậm và **không ổn định** — đo 10 lần: đa số ~3 giây, nhưng có
lần vọt lên **14 s** và **31,7 s** (Sheets API ổn định ~0,5 s). Netlify Function mặc định bị
cắt ở 10 giây, nên hai cơ chế bảo vệ:

- Client tự bỏ cuộc sau **8 giây** thay vì để Netlify cắt ngang request.
- Gọi Google thất bại mà trong cache còn dữ liệu cũ → **trả dữ liệu cũ**, không báo lỗi cho
  phụ huynh. Dữ liệu cũ một chút vẫn tốt hơn nhiều so với một trang lỗi.

Cách xử lý: **không cache kết quả**, thay vào đó đọc dữ liệu sẵn trong lúc người dùng
chưa cần đến:

| Lớp | Cơ chế | Tác dụng |
|---|---|---|
| Warm-up | Trang tra cứu ping API ngay khi vừa mở | Đọc dữ liệu mới trong lúc người dùng đang gõ mã — đo được **3,4 s chạy nền**, rồi lượt tra cứu thật chỉ **1 ms** |
| Function memory | Giữ dữ liệu vừa đọc trong RAM, mặc định 60 giây | Gộp request khi nhiều phụ huynh tra cùng lúc |
| Frontend | Gọi API **trước** khi chuyển trang, truyền data qua router state | Trang kết quả hiện tức thì, không gọi API lần hai |
| Trả dữ liệu cũ khi lỗi | Google chậm/sập mà RAM còn dữ liệu → dùng tạm bản cũ | Không hiện trang lỗi cho phụ huynh |

> **Không cache ở trình duyệt và CDN** (`Cache-Control: no-store`). Mỗi lần tải trang đều
> hỏi lại máy chủ, nên sửa sheet xong là tra cứu ra ngay — chỉ còn cache RAM 60 giây,
> đổi bằng `CACHE_TTL_SECONDS` (mục 5).
>
> Bản đầu có cache CDN 5 phút nhưng đã bỏ: CDN lưu theo từng URL nên mỗi mã học sinh là
> một bản riêng, với lưu lượng của một trung tâm thì hầu như lần nào cũng trượt cache —
> gần như không nhanh hơn mà lại giữ dữ liệu cũ.
>
> Nếu sau này thấy Apps Script chậm, chuyển sang service account chỉ là đổi biến môi
> trường — code hỗ trợ sẵn cả hai (mục 4).

---

## 2. Chạy thử

```bash
npm install
npm run dev:vite
```

Mở http://localhost:5173 và nhập `HS001` … `HS020`.

Dev server tự chọn nguồn dữ liệu và in ra khi khởi động:

- Đã khai `APPS_SCRIPT_URL` trong `.env` → **đọc dữ liệu thật** từ Google Sheet
- Chưa khai gì → dùng **dữ liệu mẫu** trong `shared/du-lieu-mau.ts`

Nhờ vậy không cần cài `netlify-cli` vẫn thử được với dữ liệu thật. Chỉ khi dùng
service account (mục 4B) mới phải chạy `npm run dev` để có Netlify Function thật.

---

## 3. Tạo Google Sheet từ template

File template đã sinh sẵn tại **`data/Template_KetQua_HocSinh.xlsx`** (2 tab, 20 học sinh ảo).

1. Vào [drive.google.com](https://drive.google.com) → **New → File upload** → chọn file `.xlsx`.
2. Click chuột phải file vừa upload → **Open with → Google Sheets**.
3. **File → Save as Google Sheets** để chuyển hẳn sang định dạng Sheets.
4. Copy `SHEET_ID` từ URL:
   `https://docs.google.com/spreadsheets/d/`**`SHEET_ID_Ở_ĐÂY`**`/edit`

Sheet có 2 tab, **không đổi tên tab và không đổi tên cột ở hàng 1**:

### Tab `KetQua` — mỗi dòng là một học sinh

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `ma_hoc_sinh` | **Mã tra cứu** (duy nhất, không phân biệt hoa thường) | `HS001` |
| `ho_ten` | Họ tên học sinh | `Nguyễn Minh Anh` |
| `giao_vien` | Giáo viên phụ trách | `Nguyễn Thu Trang` |
| `lich_hoc` | Giờ và ngày học | `19:00 03/03/2026` |
| `lop` | Mã lớp | `D.3C.319611` |
| `video_url` | Link video buổi học (để trống nếu không có) | `https://...` |
| `so_cup` | Số cúp đạt được | `44` |
| `gio_tay` | Số lần giơ tay | `3` |
| `tra_loi_dung` | Số câu đúng / tổng số câu | `6/10` |
| `nhan_xet_tinh_than` | Nhận xét phần I | (đoạn văn) |
| `hoc_luc` | Học lực — bắt đầu bằng A/B/C/D để tự đổi màu nhãn | `C - Trung Bình` |
| `nhan_xet_tong_quan` | Nhận xét chung phần II | (đoạn văn) |
| `nx_tu_vung` | Nhận xét chi tiết — Từ vựng | (đoạn văn) |
| `nx_ngu_phap` | Nhận xét chi tiết — Cấu trúc / Ngữ pháp | (đoạn văn) |
| `nx_phat_am` | Nhận xét chi tiết — Phát âm | (đoạn văn) |
| `nx_phan_xa` | Nhận xét chi tiết — Phản xạ | (đoạn văn) |
| `pct_co_ban` | % kiến thức cơ bản | `100%` |
| `pct_nang_cao` | % kiến thức nâng cao | `10%` |
| `nhan_xet_lo_trinh` | Mô tả lộ trình cá nhân hoá | (đoạn văn) |
| `bac_nang_luc` | Bậc năng lực — **phải khớp** cột `bac` ở tab 2 | `Bậc 1-` |
| `ngay_cap` | Dòng ngày tháng ở phần ký | `Hà Nội, ngày 5 tháng 3 năm 2026` |

Ô nhận xét để trống → phần đó tự ẩn trên website.

### Tab `BacNangLuc` — mô tả chuẩn đầu ra theo Khung 6 bậc

| Cột | Ý nghĩa |
|---|---|
| `bac` | Tên bậc, ví dụ `Bậc 1-`, `Bậc 1`, `Bậc 2`, `Bậc 3` |
| `nghe` / `noi` / `doc` / `viet` | Các gạch đầu dòng, **mỗi ý một dòng** trong ô (Alt + Enter), hoặc ngăn cách bằng ` \| ` |

Bảng này dùng chung cho mọi học sinh — chỉ cần khai báo một lần.

---

## 4. Kết nối dữ liệu — chọn 1 trong 2 cách

Function hỗ trợ cả hai. Nếu khai `APPS_SCRIPT_URL` thì cách A được ưu tiên, cách B bị bỏ qua.

| | A. Apps Script | B. Service account |
|---|---|---|
| Cần Google Cloud | Không | Có |
| Cần private key | Không | Có |
| Sheet phải share cho ai | Không ai | Service account |
| Số bước cài đặt | 5 | 12 |
| Tốc độ gọi trực tiếp | ~3 s, có lúc vọt 14–31 s | ~0,5 s, ổn định |
| Tốc độ người dùng cảm nhận | ~1–2 ms | ~1–2 ms |
| Giới hạn | ~20.000 lượt gọi/ngày | Hạn mức Sheets API, cao hơn nhiều |

Apps Script chậm hơn hẳn khi gọi trực tiếp, nhưng nhờ cơ chế warm-up ở mục 1, độ chậm đó
rơi vào lúc người dùng đang gõ mã — không phản ánh vào trải nghiệm thật.

Với một trung tâm, **cách A là đủ và đơn giản hơn nhiều**. Chỉ chọn B khi lưu lượng rất lớn
hoặc công ty bắt buộc quản lý credentials tập trung.

### A. Apps Script (khuyến nghị)

1. Mở Google Sheet → **Extensions → Apps Script**
2. Xoá code mẫu, dán toàn bộ nội dung file [`apps-script/Code.gs`](apps-script/Code.gs)
3. Sửa dòng `var TOKEN = '...'` thành một chuỗi ngẫu nhiên của riêng bạn
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** *(không phải "Anyone with Google account")*
   - → **Deploy** → **Authorize access** → chọn tài khoản → **Advanced** → **Go to … (unsafe)** → **Allow**
5. Copy **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`), dán vào `.env`
   cùng với TOKEN vừa đặt

> Mỗi lần sửa `Code.gs` phải **Deploy → Manage deployments → Edit → Version: New version**
> thì URL cũ mới nhận code mới. Quên bước này là lỗi hay gặp nhất.

Muốn thử ngay trong trình soạn thảo Apps Script: chọn hàm `kiemTra` trên thanh công cụ →
**Run** → xem **Execution log**.

### B. Service account + Google Sheets API

1. Vào [console.cloud.google.com](https://console.cloud.google.com) → tạo project mới
   (ví dụ `tra-cuu-ket-qua`).
2. **APIs & Services → Library** → tìm **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Đặt tên bất kỳ, các bước phân quyền tiếp theo bấm **Continue / Done** (không cần role).
4. Click vào service account vừa tạo → tab **Keys → Add key → Create new key → JSON** →
   tải file JSON về (**giữ bí mật, không commit lên GitHub**).
5. Mở file JSON, lấy 2 giá trị: `client_email` và `private_key`.
6. Quay lại Google Sheet → **Share** → dán `client_email` vào → quyền **Viewer** → Send.
   *(Bước này bắt buộc, thiếu là API báo lỗi 403.)*

---

## 5. Biến môi trường

Chạy local: copy `.env.example` thành `.env` rồi điền.
Trên Netlify: **Site settings → Environment variables** → thêm từng biến.

**Cách A — Apps Script** (chỉ cần 2 biến):

| Biến | Giá trị |
|---|---|
| `APPS_SCRIPT_URL` | Web app URL, dạng `https://script.google.com/macros/s/.../exec` |
| `APPS_SCRIPT_TOKEN` | Đúng chuỗi `TOKEN` bạn đặt trong `Code.gs` |

**Cách B — Service account:**

| Biến | Giá trị |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` trong file JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` trong file JSON — copy **nguyên chuỗi**, giữ nguyên các ký tự `\n` |
| `GOOGLE_SHEET_ID` | ID lấy từ URL của sheet |
| `SHEET_TAB_RESULTS` | `KetQua` (mặc định, có thể bỏ qua) |
| `SHEET_TAB_LEVELS` | `BacNangLuc` (mặc định, có thể bỏ qua) |

**Dùng chung cho cả hai cách:**

| Biến | Giá trị |
|---|---|
| `CACHE_TTL_SECONDS` | Cache RAM của function, mặc định `60`. Đặt `0` để mỗi lượt tra cứu đều đọc thẳng Google — đúng tuyệt đối nhưng mỗi lượt chậm ~3 s |
| `DEV_CACHE_TTL_SECONDS` | Cache của dev server, mặc định `5` |

> Nếu không khai gì cả, function tự động chạy bằng dữ liệu mẫu và ghi cảnh báo vào log —
> website vẫn hoạt động, chỉ là không lấy dữ liệu thật.

**Kiểm tra kết nối trước khi deploy:**

```bash
npm run kiem-tra
```

Script tự nhận biết bạn đang dùng cách nào, thử đọc sheet thật rồi báo chính xác đang sai ở đâu:
chưa Deploy đúng quyền, token không khớp, quên Deploy version mới, private key sai định dạng,
chưa bật Sheets API, chưa share sheet, sai Sheet ID, sai tên tab, thiếu cột, hoặc
`bac_nang_luc` không khớp giữa 2 tab.

Chạy local kèm function thật:

```bash
npm i -g netlify-cli
npm run dev
```

---

## 6. Deploy: GitHub → Netlify

```bash
git init
git add .
git commit -m "Website tra cứu kết quả học sinh"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/<tên-repo>.git
git push -u origin main
```

Trên [app.netlify.com](https://app.netlify.com):

1. **Add new site → Import an existing project → GitHub** → chọn repo.
2. Build settings Netlify tự đọc từ `netlify.toml`, không cần sửa:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
3. Trước khi bấm Deploy, mở **Add environment variables** và điền các biến ở mục 5
   (dùng Apps Script thì chỉ cần `APPS_SCRIPT_URL` và `APPS_SCRIPT_TOKEN`).
4. **Deploy site**. Sau đó **Domain settings** để đổi tên miền phụ hoặc gắn domain riêng.

Mỗi lần `git push` lên `main`, Netlify tự build và deploy lại.

---

## 7. Tuỳ chỉnh

| Muốn đổi | Sửa ở |
|---|---|
| Tên trung tâm, logo chữ, địa chỉ, hotline, footer | `src/components/Layout.tsx` → hằng `ORG` |
| Màu sắc, bo góc, font | `src/styles.css` → khối `:root` |
| Bố cục và nội dung các phần báo cáo | `src/components/Report.tsx` |
| Thêm / bớt cột dữ liệu | `shared/bao-cao.ts` (hàm `buildReport`) + `src/types.ts` |
| Tạo lại dữ liệu ảo | `node scripts/tao-template.mjs` |

Trang kết quả có nút **In / Lưu PDF** — CSS in ấn đã ẩn header, footer và các nút điều hướng.

---

## 8. Lưu ý bảo mật

- **Đóng chế độ chia sẻ công khai của sheet**: Share → *General access* đổi từ
  *Anyone with the link* về **Restricted**. Nếu để công khai, bất kỳ ai có link đều tải
  được toàn bộ danh sách học sinh. Website vẫn chạy bình thường sau khi đóng — Apps Script
  đọc bằng quyền của chính chủ sheet, còn service account thì đã được cấp quyền riêng.
- Web app Apps Script để **Anyone** truy cập được, nên URL của nó là một endpoint công khai.
  `TOKEN` chính là thứ bảo vệ nó — đặt chuỗi dài, ngẫu nhiên, và không đưa URL cho ai.
- Mã học sinh dạng `HS001` rất dễ đoán. Nếu báo cáo chứa thông tin nhạy cảm, nên đổi sang
  mã ngẫu nhiên (ví dụ `HS-7K3M9Q2X`) — chỉ cần sửa cột `ma_hoc_sinh` trong sheet, code không đổi.
- Function chỉ trả về đúng một học sinh khớp mã, không bao giờ trả toàn bộ danh sách.
- Trang đã đặt `noindex, nofollow` để không bị Google lập chỉ mục.
- **Không commit** file JSON service account hoặc file `.env` (đã có trong `.gitignore`).

---

## 9. Cấu trúc thư mục

```
├─ src/                     Frontend React
│  ├─ pages/Lookup.tsx      Trang nhập mã học sinh
│  ├─ pages/Result.tsx      Trang kết quả
│  ├─ components/Report.tsx Nội dung báo cáo (3 phần)
│  ├─ components/Layout.tsx Header, footer, thông tin tổ chức
│  └─ styles.css            Toàn bộ CSS + CSS in ấn
├─ netlify/functions/
│  └─ result.mts            API đọc dữ liệu (Apps Script hoặc Sheets API)
├─ shared/
│  ├─ bao-cao.ts            Logic chuyển sheet → báo cáo (dùng chung)
│  ├─ apps-script.ts        Client gọi web app Apps Script (dùng chung)
│  └─ du-lieu-mau.ts        Dữ liệu chạy thử (tự sinh)
├─ apps-script/Code.gs      Script dán vào Google Sheet (cách A)
├─ scripts/
│  ├─ tao-template.mjs      Sinh file template + dữ liệu ảo
│  └─ kiem-tra-ket-noi.mjs  Chẩn đoán lỗi kết nối
├─ data/                    Template .xlsx và .csv
└─ netlify.toml             Cấu hình build, redirect, cache
```

---

## 10. Sau này đổi cách nhập liệu (Google Form, nhập từ phần mềm khác…)

### Hợp đồng duy nhất giữa sheet và website

Website chỉ cần **một tab tên `KetQua`, hàng 1 là 21 tên cột ở mục 3**. Dữ liệu vào tab đó
bằng cách nào — gõ tay, Google Form, công thức, Apps Script, import từ CRM — đều không quan
trọng. Giữ đúng hợp đồng này thì **không phải sửa một dòng code nào**.

### Vấn đề khi dùng Google Form

Form tự tạo một tab riêng (mặc định `Câu trả lời biểu mẫu 1`) với hàng 1 là **nguyên văn câu
hỏi** — `Họ tên học sinh`, `Nhận xét về phát âm`… Không khớp tên cột website cần.

Đừng sửa trực tiếp hàng tiêu đề của tab đó: Form ghi theo vị trí cột, mỗi lần bạn thêm/bớt
câu hỏi là cột dịch chuyển và có thể ghi đè lại tiêu đề. Hãy thêm một lớp trung gian.

### Cách A — Tab `KetQua` là công thức (không đụng code)

1. Giữ nguyên tab Form tự tạo, **không sửa gì trong đó**.
2. Tạo tab mới tên `KetQua`. Hàng 1 gõ đúng 21 tên cột.
3. Ô `A2` đặt một công thức duy nhất, xếp lại cột theo đúng thứ tự website cần:

```
=FILTER(
  {'Câu trả lời biểu mẫu 1'!C2:C,
   'Câu trả lời biểu mẫu 1'!B2:B,
   'Câu trả lời biểu mẫu 1'!E2:E},
  'Câu trả lời biểu mẫu 1'!A2:A <> ""
)
```

Mỗi dòng trong `{...}` là một cột của `KetQua`, trỏ tới cột tương ứng bên tab Form —
đổi chữ cái cột cho khớp form của bạn. `FILTER` loại các dòng trống ở cuối.

Cột nào form không hỏi (ví dụ `video_url`) thì thay bằng
`ARRAYFORMULA(IF('Câu trả lời biểu mẫu 1'!A2:A="","",""))` để giữ đúng số cột.

Ưu điểm: không cần lập trình, sửa được ngay trên trình duyệt.
Nhược điểm: công thức dài, dễ sai khi thêm câu hỏi mới.

### Cách B — Ánh xạ trong `Code.gs` (gọn hơn khi form hay thay đổi)

Sửa `apps-script/Code.gs`: đọc tab Form rồi đổi tên cột theo một bảng ánh xạ.

```js
var TAB_KET_QUA = 'Câu trả lời biểu mẫu 1';

/** Tên câu hỏi trong Form  ->  tên cột website cần */
var ANH_XA = {
  'Mã học sinh': 'ma_hoc_sinh',
  'Họ và tên học sinh': 'ho_ten',
  'Giáo viên phụ trách': 'giao_vien',
  'Nhận xét về phát âm': 'nx_phat_am'
  // ... khai nốt các cột còn lại
};

function docTab(ss, ten) {
  var sh = ss.getSheetByName(ten);
  if (!sh) return [];
  var rows = sh.getDataRange().getDisplayValues();
  if (!rows.length) return rows;
  rows[0] = rows[0].map(function (h) {
    return ANH_XA[String(h).trim()] || String(h).trim();
  });
  return rows;
}
```

Sửa xong nhớ **Deploy → Manage deployments → Edit → Version: New version**.

Ưu điểm: thêm câu hỏi mới chỉ cần thêm một dòng vào `ANH_XA`, không phụ thuộc vị trí cột.
Nhược điểm: phải sửa code và deploy lại.

### Giáo viên nộp nhiều lần cho cùng một học sinh

Form luôn ghi thêm xuống dưới, nên một mã học sinh sẽ có nhiều dòng. Website **lấy dòng cuối
cùng khớp mã** (xem `timHocSinh` trong `shared/bao-cao.ts`) — tức là bản nộp mới nhất.
Giáo viên nộp lại để sửa sai thì bản sau tự động thay bản trước, không cần xoá dòng cũ.

Nếu muốn phụ huynh xem được **lịch sử nhiều buổi** thay vì chỉ buổi mới nhất thì đó là một
tính năng khác: cần đổi API trả về danh sách, và thêm giao diện chọn buổi ở trang kết quả.

### Khi nào thì buộc phải sửa code

Chỉ khi **thêm một trường mới cần hiển thị** trên trang kết quả. Lúc đó sửa 3 chỗ:

| Chỗ | Việc |
|---|---|
| `shared/bao-cao.ts` → `buildReport` | Đọc cột mới từ dòng dữ liệu |
| `src/types.ts` | Khai báo kiểu cho trường mới |
| `src/components/Report.tsx` | Hiển thị nó ra giao diện |

Đổi tên tab, đổi thứ tự cột, thêm cột không dùng đến, đổi cách nhập liệu — đều **không** cần
sửa code.

---

## 11. Sửa Google Sheet mà website không đổi

Sửa sheet xong thì tra cứu ra ngay — trình duyệt và CDN đều không cache (`no-store`).
Chỉ còn **cache RAM 60 giây** trong function, và request warm-up của trang tra cứu đã làm
mới nó trong lúc bạn gõ mã, nên thực tế gần như không bao giờ gặp dữ liệu cũ.

Nếu vẫn thấy dữ liệu cũ, chẩn đoán theo thứ tự:

**Bước 1 — dữ liệu đã ra khỏi Google chưa?**

```bash
npm run kiem-tra
```

Script gọi thẳng Apps Script, **không qua cache**, nên nó luôn cho thấy dữ liệu thật.

- **Thấy dữ liệu mới** → vấn đề ở phía website, sang bước 2.
- **Thấy dữ liệu cũ** → vấn đề ở phía Google:
  - Sửa nhầm file sheet khác — đối chiếu ID trong `.env` với URL sheet đang mở.
  - Vừa sửa `Code.gs` nhưng chưa **Deploy → Manage deployments → Edit → Version: New version**.
  - Dữ liệu nằm ở tab khác `KetQua`.
  - Dòng mới nằm dưới một dòng trống — Apps Script đọc theo vùng liền mạch, đừng để cách quãng.

**Bước 2 — chờ hết cache RAM.**

| Nơi chạy | Cache RAM | Cách lấy mới ngay |
|---|---|---|
| `npm run dev:vite` | 5 giây | Thêm `&nocache=1` vào URL API |
| Netlify | `CACHE_TTL_SECONDS`, mặc định 60 giây | Chờ 1 phút, hoặc **Deploys → Trigger deploy** để khởi động lại function |

Muốn tuyệt đối không bao giờ có dữ liệu cũ: đặt `CACHE_TTL_SECONDS=0`. Đổi lại mỗi lượt
tra cứu đều phải chờ Apps Script ~3 giây (và có lúc lâu hơn), warm-up không còn tác dụng.
Chỉ nên làm nếu độ chính xác tuyệt đối quan trọng hơn tốc độ.
