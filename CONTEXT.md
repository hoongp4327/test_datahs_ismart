# Bối cảnh dự án — Website tra cứu kết quả học sinh

> Tài liệu này để dán vào Antigravity (hoặc bất kỳ AI coding agent nào) làm ngữ cảnh.
> Nó mô tả **hệ thống đang có, các quyết định đã chốt và lý do đằng sau** — đọc hết
> trước khi sửa code, vì nhiều lựa chọn trông "lạ" nhưng có nguyên nhân đo đạc cụ thể.
>
> Không có bí mật nào trong file này. Token và URL thật nằm ở `.env` (đã gitignore).

---

## 1. Bài toán

Trung tâm Anh ngữ cần một trang web để phụ huynh **nhập mã học sinh** và xem
**báo cáo kết quả kiểm tra năng lực**. Dữ liệu do giáo viên nhập vào **Google Sheet**.

Tham chiếu thiết kế: `https://student.edupiatutor.vn/demo-result?dealId=11583656`
(đã phân tích và mô phỏng cấu trúc, không sao chép giao diện).

Trang kết quả gồm 2 phần:

1. **Kết quả học tập** — điểm 4 kỹ năng **Listening, Reading, Writing, Speaking** (0–20 mỗi
   kỹ năng, tổng 80), **Level tương ứng** (Pre-A1 / A1 / A2 / Pre-B1), biểu đồ radar, mô tả chung
   từng kỹ năng, và nhận xét riêng của giáo viên cho Speaking
2. **Lộ trình học tập** — % cơ bản/nâng cao + **gợi ý luyện tập** cho từng kỹ năng

Đã **bỏ** so với bản đầu: Tinh thần học tập (số cúp, giơ tay), Xếp loại A/B/C/D, Khung năng
lực 6 bậc Việt Nam, lịch học, link video.

Kèm header thông tin học sinh và phần ký của hội đồng chất lượng.

---

## 2. Kiến trúc

```
Trình duyệt  ──►  /api/result?code=HS-7K3M9Q  ──►  Netlify Function  ──►  Google Sheet
   (React)          (Netlify redirect)            (cache + giữ bí mật)    (3 tab dữ liệu)
```

**Vì sao phải có Netlify Function, không gọi Google thẳng từ frontend:**
credentials (token Apps Script hoặc private key service account) không được để lộ
trong bundle frontend. Function là nơi duy nhất giữ chúng.

### Stack

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18 + Vite 5 + react-router-dom 6, TypeScript |
| CSS | Thuần, một file `src/styles.css`, biến CSS trong `:root` |
| Backend | Netlify Functions v2 (`.mts`, Request/Response chuẩn Web) |
| Nguồn dữ liệu | Google Sheet, đọc qua Apps Script Web App **hoặc** Sheets API |
| Hosting | Netlify (build từ GitHub) |

Build hiện tại: **173 KB JS (56 KB gzip) + 8 KB CSS**. Không dùng UI library.

### Cấu trúc thư mục

```
├─ src/
│  ├─ main.tsx                 Router: "/" -> Lookup, "/ket-qua" -> Result
│  ├─ types.ts                 Kiểu BaoCao trả về cho frontend
│  ├─ styles.css               Toàn bộ CSS + CSS cho in ấn (@media print)
│  ├─ pages/Lookup.tsx         Trang nhập mã học sinh
│  ├─ pages/Result.tsx         Trang kết quả
│  └─ components/
│     ├─ Layout.tsx            Topbar, footer, hằng ORG (tên trung tâm...)
│     └─ Report.tsx            Toàn bộ nội dung báo cáo 3 phần
├─ netlify/functions/
│  └─ result.mts               API: chọn nguồn dữ liệu, cache, xử lý lỗi
├─ shared/                     Dùng chung giữa function và Vite dev server
│  ├─ bao-cao.ts               toObjects, toBullets, timHocSinh, buildReport
│  ├─ apps-script.ts           Client gọi Apps Script (timeout 8s)
│  └─ du-lieu-mau.ts           Dữ liệu chạy thử (tự sinh, đừng sửa tay)
├─ apps-script/Code.gs         Script dán vào Google Sheet
├─ scripts/
│  ├─ tao-template.mjs         Sinh template .xlsx + dữ liệu ảo + du-lieu-mau.ts
│  └─ kiem-tra-ket-noi.mjs     Chẩn đoán lỗi kết nối, không qua cache
├─ data/                       Template .xlsx và .csv (dữ liệu ảo)
├─ netlify.toml                Build, redirect /api/* , SPA fallback
└─ README.md                   Hướng dẫn vận hành đầy đủ
```

---

## 3. Hợp đồng dữ liệu — phần quan trọng nhất

Sheet có **3 tab**. **Không đổi tên tab và không đổi tên cột ở hàng 1** — website tìm cột theo tên.

### Tab `KetQua` — mỗi dòng một học sinh

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `ma_hoc_sinh` | **Mã tra cứu**, ngẫu nhiên, không trùng | `HS-7K3M9Q` |
| `ho_ten` | Họ tên học sinh | `Nguyễn Minh Anh` |
| `giao_vien` | Giáo viên chấm | `Nguyễn Thu Trang` |
| `lop` | Lớp | `Movers 1` |
| `ngay_cham` | Ngày chấm, dạng **ngày/tháng/năm** | `05/11/2026` |
| `diem_listening` | Điểm Listening, **0–20** | `14` |
| `diem_reading` | Điểm Reading, 0–20 | `12` |
| `diem_writing` | Điểm Writing, 0–20 | `11` |
| `diem_speaking` | Điểm Speaking, 0–20 | `15` |
| `option_listening` | Mô tả chung Listening — chọn từ tab `MoTaKyNang` | `Option 3` |
| `option_reading` | Mô tả chung Reading | `Option 3` |
| `option_writing` | Mô tả chung Writing | `Option 3` |
| `option_speaking` | Mô tả chung Speaking | `Option 3` |
| `mo_ta_rieng_speaking` | Nhận xét riêng của giáo viên — **chỉ Speaking có**, gõ tự do | (đoạn văn) |
| `pct_co_ban` | % kiến thức cơ bản | `100%` |
| `pct_nang_cao` | % kiến thức nâng cao | `10%` |
| `nhan_xet_lo_trinh` | Mô tả lộ trình cá nhân hoá | (đoạn văn) |

**Tổng điểm và Level không có cột** — website tự cộng 4 điểm (tối đa 80) rồi tra tab
`ThangLevel`. Nhờ vậy không bao giờ có chuyện tổng 70 mà ghi A1.

Quy tắc khi dữ liệu không đủ:

- **Điểm để trống, ngoài 0–20 hoặc không phải số** → hiện "—". Thà trống còn hơn hiện số sai.
- **Thiếu bất kỳ điểm nào trong 4 kỹ năng** → chưa xếp Level, chưa vẽ biểu đồ. Một Level tính
  trên 3/4 kỹ năng sẽ sai mà phụ huynh không có cách nào nhận ra.
- **Ô option để trống** → website **tự chọn option theo khoảng điểm**. Giáo viên chỉ cần nhập
  điểm cũng ra báo cáo đầy đủ; chỉ chọn tay khi muốn mô tả khác với mặc định.
- **Một mã có nhiều dòng** → lấy dòng **dưới cùng** (bản mới nhất).
- Mã tra cứu không phân biệt hoa thường, dấu gạch, khoảng trắng: `hs7k3m9q` = `HS-7K3M9Q`.

### Tab `MoTaKyNang` — nội dung mô tả và gợi ý (dùng chung mọi học sinh)

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `ky_nang` | `Listening` / `Reading` / `Writing` / `Speaking` | `Listening` |
| `option` | Tên option — giáo viên chọn đúng chữ này ở tab `KetQua` | `Option 1` |
| `diem_tu` | Option này hợp với điểm **từ bao nhiêu trở lên** | `0` |
| `mo_ta` | Mô tả chung — hiện ở mục *Kết quả học tập* | (đoạn văn) |
| `goi_y` | Gợi ý luyện tập — hiện ở mục *Lộ trình học tập* | (đoạn văn) |

Mặc định mỗi kỹ năng 4 option: Option 1 từ 0, Option 2 từ 6, Option 3 từ 11, Option 4 từ 16.

**Sửa câu chữ ở đây là mọi báo cáo — cũ lẫn mới — đổi theo ngay**, vì `KetQua` chỉ lưu tên
option chứ không lưu nguyên văn. Thêm option thứ 5 cũng chỉ cần thêm một dòng.

### Tab `ThangLevel` — tổng điểm từ bao nhiêu thì đạt Level nào

| `level` | `diem_tu` | `mo_ta` |
|---|---|---|
| Pre-A1 | 0 | Mô tả năng lực, hiện dưới Level trên báo cáo |
| A1 | 25 | … |
| A2 | 50 | … |
| Pre-B1 | 70 | … |

Mỗi Level áp dụng **từ `diem_tu` trở lên cho tới mốc của Level kế tiếp**. Chỉ cần mốc dưới nên
không bao giờ có khe hở giữa hai khoảng, và điểm lẻ như 24,5 vẫn rơi đúng một Level.

Mốc được chia để khớp với 4 dòng mẫu ban đầu của trung tâm khi quy từ thang 60 lên thang 80
(17/60 → Pre-A1, 36/60 → A1, 52/60 → A2, 60/60 → Pre-B1). **Muốn đổi thì sửa thẳng cột
`diem_tu` trên sheet** — không cần sửa code, không cần deploy lại. Thêm Level mới (ví dụ B1)
cũng chỉ là thêm một dòng.

### Ràng buộc nhập liệu ngay trên sheet

Chạy hàm `thietLapRangBuoc` trong Apps Script **một lần** (chọn hàm trên thanh công cụ →
Chạy). Sau đó:

- Cột `diem_*` chỉ nhận số 0–20 — gõ 25 là sheet từ chối.
- Cột `option_*` thành dropdown, lấy đúng danh sách option của kỹ năng đó trong `MoTaKyNang`.

Thêm option mới vào `MoTaKyNang` thì chạy lại hàm này để dropdown cập nhật.

`npm run kiem-tra` báo thêm những lỗi sheet không chặn được: option chọn lệch với khoảng điểm,
học sinh thiếu điểm, mã trùng, mã kiểu số thứ tự dễ đoán.

### Muốn thêm một trường mới hiển thị trên web → sửa đúng 2 chỗ

1. `shared/bao-cao.ts` → hàm `buildReport` (đọc cột mới)
2. `src/components/Report.tsx` → hiển thị

Kiểu dữ liệu frontend (`src/types.ts`) suy thẳng từ `buildReport` nên tự cập nhật.
Đổi thứ tự cột hay thêm cột không dùng đến — **không** cần sửa code.

---

## 4. Hai cách kết nối Google Sheet

Function tự chọn theo biến môi trường, thứ tự ưu tiên:

1. `APPS_SCRIPT_URL` có giá trị → **Apps Script** (đang dùng)
2. Đủ bộ service account → **Google Sheets API**
3. Không có gì → **dữ liệu mẫu** trong `shared/du-lieu-mau.ts` (kèm cảnh báo log)

Fallback (3) là chủ ý: người mới clone repo chạy được ngay để xem giao diện.

| | A. Apps Script (đang dùng) | B. Service account |
|---|---|---|
| Cần Google Cloud | Không | Có |
| Cần private key | Không | Có |
| Sheet share cho ai | Không ai — script chạy bằng quyền chủ sheet | Service account, quyền Viewer |
| Số bước cài đặt | 5 | 12 |
| **Tốc độ gọi trực tiếp** | **~3 s, có lúc 7–31 s, thỉnh thoảng timeout** | ~0,5 s (ước lượng, **chưa đo**) |
| Giới hạn | ~20.000 lượt/ngày | Hạn mức Sheets API, cao hơn nhiều |

**Đổi qua lại chỉ là thay biến môi trường, không sửa code.**

`apps-script/Code.gs` nhận `?token=...`, so sánh với hằng `TOKEN` trong script
(so sánh độ dài cố định), rồi trả về JSON `{ results, levels }` — mảng 2 chiều
lấy bằng `getDataRange().getDisplayValues()`.

> **Cạm bẫy Apps Script:** mỗi lần sửa `Code.gs` phải
> **Deploy → Manage deployments → Edit → Version: New version**.
> Chỉ bấm Save thì URL cũ vẫn chạy code cũ. Đây là lỗi hay gặp nhất.
>
> Khi deploy phải chọn **"Người có quyền truy cập" = Bất kỳ ai**, không phải
> "Bất kỳ ai có Tài khoản Google" — chọn nhầm thì server nhận về trang đăng nhập
> thay vì JSON.

---

## 5. Cache và độ tươi dữ liệu — đọc kỹ trước khi sửa

Đây là phần đã đi qua **ba lần thiết kế sai**, đừng quay lại các bản cũ.

### Hành vi hiện tại

| Lớp | Trạng thái |
|---|---|
| Trình duyệt | `Cache-Control: no-store` — không cache |
| CDN Netlify | `Netlify-CDN-Cache-Control: no-store` — không cache |
| RAM của function | 60 giây (`CACHE_TTL_SECONDS`) |
| Mỗi lần tải trang | Gửi `refresh=1` → bỏ qua cache RAM, đọc lại sheet |
| Sàn chống F5 | 3 giây (`SAN_LAM_MOI` trong `result.mts`) |

**Kết quả:** dữ liệu sửa 1 giây trước cũng hiện ra, mà lượt tra cứu vẫn tức thì.

```
warm-up (refresh=1) : 4.6 s     <- chạy nền lúc người dùng đang gõ mã
tra cứu HS022       : 0.002 s
tra cứu HS001       : 0.026 s
```

### Vì sao thiết kế như vậy

- **Bỏ cache CDN.** CDN lưu theo từng URL, mỗi mã học sinh là một bản riêng. Với
  lưu lượng một trung tâm thì hầu như lần nào cũng trượt cache — gần như không
  nhanh hơn mà lại giữ dữ liệu cũ tới 5 phút. Trả giá mà không được gì.
- **Không đặt `CACHE_TTL_SECONDS=0`.** Đo thực tế: mỗi lượt tra cứu 2,8–4 giây,
  và warm-up mất tác dụng. Chậm mà không tươi hơn cách hiện tại.
- **`refresh=1` chỉ gửi khi tải trang**, không gửi khi bấm nút tra cứu. Lượt đọc
  rơi vào lúc người dùng đang gõ mã nên không ai phải chờ.
- **Cache RAM 60 giây** giờ chỉ phục vụ các lượt tra cứu tiếp theo trong cùng
  phiên xem và gộp request khi đông người — không còn ảnh hưởng độ tươi.

### Nơi gửi `refresh=1`

- `src/pages/Lookup.tsx` — warm-up khi vừa mở trang tra cứu
- `src/pages/Result.tsx` — khi mở bằng link trực tiếp `/ket-qua?ma=...`

---

## 6. Xử lý lỗi và giới hạn đã biết

### Apps Script không ổn định — đã đo nhiều lần

```
Đợt 1:  3.5  3.6  3.2  2.9  4.6                    giây
Đợt 2:  31.7  3.6  3.6  3.2  2.9                   giây
Đợt 3:  7.3  4.1  3.4  2.6  3.0  2.8  3.3  3.3     giây
```

Có **2 lần timeout thật** trong khoảng 30 phút test. Ba cơ chế đỡ:

1. **Timeout 8 giây** (`TIMEOUT_MS` trong `shared/apps-script.ts`). Netlify Function
   mặc định bị cắt ở 10 giây — tự bỏ cuộc sớm hơn để còn kịp xử lý.
2. **Trả dữ liệu cũ khi lỗi.** Google chậm/sập mà RAM còn dữ liệu → dùng bản cũ,
   không hiện trang lỗi cho phụ huynh. Đã test bằng cách giả lập Google sập.
3. **Xoá cache khi promise lỗi** để lần sau thử lại, không nhớ mãi lỗi cũ.

**Nếu Apps Script timeout thường xuyên trong thực tế → chuyển sang service account.**
Đó là cách xử lý đúng, không phải tăng timeout.

### Lấy dòng cuối cùng khớp mã

`timHocSinh()` trong `shared/bao-cao.ts` **quét ngược từ dưới lên**. Lý do: nếu sau
này dữ liệu đến từ Google Form, giáo viên nộp nhiều lần cho cùng một học sinh và
Form luôn ghi thêm xuống dưới — dòng cuối là bản mới nhất. **Đừng đổi lại `find()`.**

### Bảo mật

- Function chỉ trả về **một** học sinh khớp mã, không bao giờ trả toàn bộ danh sách.
- Trang đặt `noindex, nofollow`.
- Web app Apps Script để "Anyone" nên URL là endpoint công khai — `TOKEN` là thứ
  bảo vệ nó.
- `.env` và file JSON service account **không bao giờ commit**.
- Mã học sinh ngẫu nhiên `HS-XXXXXX` (bỏ 0/O, 1/I/L). Không dùng số thứ tự — đoán được.
  Không sinh bằng `RANDBETWEEN` — công thức tính lại thì mã tự đổi, link phụ huynh chết.

---

## 7. Quy ước code

- **Tên biến, hàm, comment bằng tiếng Việt không dấu hoặc có dấu** — bám theo code
  hiện có (`timHocSinh`, `layDuLieu`, `boQuaCache`, `nguonDuLieu`). Giữ nhất quán.
- Comment giải thích **vì sao**, không phải **cái gì**. Nhiều đoạn ghi rõ lý do đo
  đạc — đừng xoá.
- Không thêm UI library. CSS thuần, biến trong `:root`, giao diện trung tính
  (xanh `#1d4ed8` trên nền trắng/xám, font Be Vietnam Pro).
- Logic chia sẻ giữa function và dev server đặt ở `shared/`, không nhân bản.
- `shared/du-lieu-mau.ts` **tự sinh** từ `scripts/tao-template.mjs`, đừng sửa tay.

---

## 8. Lệnh thường dùng

```bash
npm install
npm run dev:vite     # dev server, đọc dữ liệu thật nếu .env có APPS_SCRIPT_URL
npm run dev          # netlify dev (chỉ cần khi dùng service account)
npm run build
npm run kiem-tra     # chẩn đoán kết nối Google, KHÔNG qua cache
npm run tao-template # sinh lại template .xlsx + dữ liệu ảo
npx tsc --noEmit     # typecheck
```

Dev server in log mỗi lượt tra cứu — dùng nó để chẩn đoán:

```
[api] HS022  → Quả Nho       (nạp mới, 22 dòng, 5087 ms)
[api] HS999  → KHÔNG THẤY    (cache 4s, 22 dòng, 1 ms)
```

- **số dòng** → sheet đã ra dữ liệu mới chưa
- **nạp mới / cache Ns** → có phải cache đang giữ bản cũ
- **thời gian** → Apps Script đang nhanh hay chậm

---

## 9. Biến môi trường

Local ở `.env`, production ở Netlify → Site settings → Environment variables.

| Biến | Dùng khi |
|---|---|
| `APPS_SCRIPT_URL` | Cách A — Web app URL dạng `.../exec` |
| `APPS_SCRIPT_TOKEN` | Cách A — trùng hằng `TOKEN` trong `Code.gs` |
| `GOOGLE_SHEET_ID` | Cách B |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Cách B |
| `GOOGLE_PRIVATE_KEY` | Cách B — giữ nguyên ký tự `\n` |
| `SHEET_TAB_KET_QUA` | Mặc định `KetQua` |
| `SHEET_TAB_MO_TA` | Mặc định `MoTaKyNang` |
| `SHEET_TAB_THANG_LEVEL` | Mặc định `ThangLevel` |
| `NGUON_DU_LIEU` | Đặt `mau` để luôn dùng dữ liệu mẫu, bỏ qua Google |
| `CACHE_TTL_SECONDS` | Mặc định `60` |
| `DEV_CACHE_TTL_SECONDS` | Mặc định `60` |

---

## 10. Trạng thái hiện tại

### Đã xong

- Trang tra cứu + báo cáo theo cấu trúc mới (L/R/W/S, Level, gợi ý), responsive, in PDF
- Nhận diện iSMART: logo, mascot, `ORG` đã điền thông tin thật
- 3 nguồn dữ liệu dùng chung một module (`shared/nguon-du-lieu.ts`) + dữ liệu mẫu
- Template sheet 3 tab + 20 học sinh ảo mã ngẫu nhiên; `npm run dev:mau` để xem bằng dữ liệu mẫu
- `Code.gs`: đọc 3 tab + `thietLapRangBuoc()` tạo ràng buộc nhập liệu ngay trên sheet
- `npm run kiem-tra` kiểm cả cấu trúc lẫn chất lượng dữ liệu nhập

### Chưa xong — bắt buộc trước khi dùng thật

1. **Sheet thật vẫn còn cấu trúc cũ.** Import `data/Template_KetQua_HocSinh.xlsx` (3 tab).
2. **Apps Script đang trả 403.** Dán `Code.gs` mới, đổi `TOKEN`, triển khai phiên bản mới với
   "Bất kỳ ai". Hiện web chạy bằng đường dự phòng đọc sheet công khai.
3. **Sheet đang công khai, Sheet ID + token cũ từng bị commit** vào `.env.example` trên repo
   public (đã gỡ, nhưng còn trong lịch sử git). Sau khi Apps Script chạy: đổi `TOKEN` mới và
   đóng sheet về **Restricted**.
4. **Chưa deploy Netlify.**

### Đang chờ quyết định nghiệp vụ

- **Trang /admin cho giáo viên nhập điểm** — đã chốt hướng: link bí mật (không đăng nhập),
  mã bí mật nằm sau `#` trong URL, **kiểm tra ở server** (không phải ở đường dẫn trang),
  lưu trong biến môi trường `ADMIN_KEY`. Server ghi vào sheet qua Apps Script `doPost`. Gom
  kiểm tra quyền vào một hàm để sau này đổi sang đăng nhập Google mà không sửa giao diện.
- **Google Form cho giáo viên nhập liệu.** Form tạo tab riêng với tiêu đề là nguyên
  văn câu hỏi. Hai cách khớp về `KetQua`: công thức `FILTER({...})` trong sheet, hoặc
  bảng ánh xạ trong `Code.gs`. Chi tiết ở README mục 10.
- **Lịch sử nhiều buổi.** Hiện chỉ hiện buổi mới nhất. Muốn xem tiến bộ theo thời
  gian thì API phải trả danh sách và trang kết quả cần thêm phần chọn buổi. **Quyết
  định sớm vì ảnh hưởng cách thiết kế Form** — nếu Form luôn ghi thêm dòng mới thì
  dữ liệu lịch sử tự nhiên có sẵn; nếu ghi đè thì mất vĩnh viễn.

---

## 11. Những lỗi đã gặp — đừng lặp lại

| Lỗi | Nguyên nhân | Cách tránh |
|---|---|---|
| Sửa sheet mà web không đổi | Cache dev server không có TTL, giữ dữ liệu vĩnh viễn | Cache phải có mốc thời gian; xem log `nạp mới / cache Ns` |
| Thêm dòng mới mà tra cứu báo không thấy | Dev server chạy code cũ từ trước khi sửa | Khởi động lại dev server |
| Tra cứu chậm 5–7 giây | TTL dev đặt 5 giây, ngắn hơn thời gian người dùng gõ mã nên cache hết hạn trước khi bấm nút | TTL phải dài hơn thời gian thao tác; độ tươi để `refresh=1` lo |
| Deploy hỏng | `google-auth-library` nằm ở `devDependencies` nhưng function cần lúc chạy | Đã chuyển sang `dependencies` |
| Apps Script trả trang đăng nhập | Deploy chọn "Bất kỳ ai có Tài khoản Google" | Phải chọn "Bất kỳ ai" |
| Sửa `Code.gs` không có tác dụng | Chỉ bấm Save, chưa deploy version mới | Deploy → Manage deployments → Edit → New version |

Thêm dòng mới vào sheet phải **liền ngay dưới dòng cuối**, không để dòng trống ở
giữa — Apps Script đọc theo vùng dữ liệu liền mạch.

---

## 12. Prompt gợi ý cho việc tiếp theo

**Đổi thông tin trung tâm:**
> Sửa hằng `ORG` trong `src/components/Layout.tsx` thành: tên "...", viết tắt "...",
> địa chỉ "...", hotline "...", website "...". Giữ nguyên cấu trúc.

**Thêm biểu đồ cột 4 kỹ năng:**
> Thêm 4 cột `diem_tu_vung`, `diem_ngu_phap`, `diem_phat_am`, `diem_phan_xa` (thang
> 0–10) vào hợp đồng dữ liệu. Vẽ biểu đồ cột trong mục II của `Report.tsx` bằng SVG
> thuần (không thêm thư viện): trục Y 0–10 nhưng vùng vẽ cao tới 12 để chừa chỗ nhãn
> chữ trên cột, số điểm nằm trong cột, nhãn mức chữ nằm trên cột, màu nhạt dần theo
> điểm. Ngưỡng quy đổi điểm → mức chữ đọc từ một tab `ThangDiem` trong sheet, không
> hard-code. **Thiếu bất kỳ điểm nào thì ẩn cả biểu đồ**, giữ nguyên phần nhận xét chữ.
> Cập nhật `buildReport`, `types.ts`, `scripts/tao-template.mjs` và README.

**Hiện lịch sử nhiều buổi:**
> Đổi API trả về mảng tất cả các buổi khớp mã (đang chỉ trả buổi cuối qua
> `timHocSinh`). Trang kết quả thêm phần chọn buổi, mặc định buổi mới nhất. Giữ
> nguyên cơ chế cache và `refresh=1`.

**Chuyển sang service account:**
> Không cần sửa code — code đã hỗ trợ. Chỉ cần bỏ `APPS_SCRIPT_URL` và điền
> `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, rồi chạy
> `npm run kiem-tra` để xác nhận. Sau đó đo lại độ trễ thật và cập nhật con số ước
> lượng "~0,5 s" trong README mục 4.
