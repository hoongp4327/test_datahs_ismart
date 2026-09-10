# Bối cảnh dự án — Website tra cứu kết quả học sinh

> Tài liệu này để dán vào Antigravity (hoặc bất kỳ AI coding agent nào) làm ngữ cảnh.
> Nó mô tả **hệ thống đang có, các quyết định đã chốt và lý do đằng sau** — đọc hết
> trước khi sửa code, vì nhiều lựa chọn trông "lạ" nhưng có nguyên nhân đo đạc cụ thể.
>
> Không có bí mật nào trong file này. Token và URL thật nằm ở `.env` (đã gitignore).

---

## 1. Bài toán

Trung tâm Anh ngữ cần một trang web để phụ huynh **nhập mã học sinh** và xem
**báo cáo kết quả buổi học**. Dữ liệu do giáo viên nhập vào **Google Sheet**.

Tham chiếu thiết kế: `https://student.edupiatutor.vn/demo-result?dealId=11583656`
(đã phân tích và mô phỏng cấu trúc, không sao chép giao diện).

Trang kết quả gồm 3 phần, đúng theo bản tham chiếu:

1. **Tinh thần học tập** — số cúp, giơ tay, trả lời đúng + nhận xét
2. **Kết quả học tập** — học lực tổng thể + nhận xét chi tiết 4 kỹ năng
   (Từ vựng, Cấu trúc/Ngữ pháp, Phát âm, Phản xạ)
3. **Lộ trình học tập** — % cơ bản/nâng cao + Năng lực đầu ra theo Khung 6 bậc

Kèm header thông tin học sinh và phần ký của hội đồng chất lượng.

---

## 2. Kiến trúc

```
Trình duyệt  ──►  /api/result?code=HS001  ──►  Netlify Function  ──►  Google Sheet
   (React)          (Netlify redirect)         (cache + giữ bí mật)    (2 tab dữ liệu)
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

Website chỉ đòi hỏi **một tab tên `KetQua`, hàng 1 là 21 tên cột dưới đây**.
Dữ liệu vào tab đó bằng cách nào (gõ tay, Google Form, công thức, import) đều được.

### Tab `KetQua` — mỗi dòng một học sinh

| Cột | Ý nghĩa |
|---|---|
| `ma_hoc_sinh` | Mã tra cứu, không phân biệt hoa thường, bỏ khoảng trắng |
| `ho_ten` | Họ tên học sinh |
| `giao_vien` | Giáo viên phụ trách |
| `lich_hoc` | Giờ và ngày học, dạng chuỗi tự do |
| `lop` | Mã lớp |
| `video_url` | Link video buổi học, để trống thì ẩn dòng "Xem" |
| `so_cup` | Số cúp |
| `gio_tay` | Số lần giơ tay |
| `tra_loi_dung` | Dạng "6/10", chuỗi tự do |
| `nhan_xet_tinh_than` | Nhận xét phần I |
| `hoc_luc` | Ví dụ "C - Trung Bình". **Ký tự đầu A/B/C/D quyết định màu nhãn** |
| `nhan_xet_tong_quan` | Nhận xét chung phần II |
| `nx_tu_vung` | Nhận xét chi tiết — Từ vựng |
| `nx_ngu_phap` | Nhận xét chi tiết — Cấu trúc/Ngữ pháp |
| `nx_phat_am` | Nhận xét chi tiết — Phát âm |
| `nx_phan_xa` | Nhận xét chi tiết — Phản xạ |
| `pct_co_ban` | Ví dụ "100%" |
| `pct_nang_cao` | Ví dụ "10%" |
| `nhan_xet_lo_trinh` | Mô tả lộ trình cá nhân hoá |
| `bac_nang_luc` | **Phải khớp cột `bac` ở tab 2**, ví dụ "Bậc 1-" |
| `ngay_cap` | Dòng ngày tháng ở phần ký |

Ô nhận xét để trống → phần tương ứng **tự ẩn** trên giao diện.

### Tab `BacNangLuc` — chuẩn đầu ra Khung 6 bậc, dùng chung mọi học sinh

| Cột | Ý nghĩa |
|---|---|
| `bac` | Tên bậc: "Bậc 1-", "Bậc 1", "Bậc 2", "Bậc 3" |
| `nghe` / `noi` / `doc` / `viet` | Nhiều gạch đầu dòng, ngăn bằng xuống dòng trong ô hoặc `" \| "` |

### Muốn thêm một trường mới hiển thị trên web → sửa đúng 3 chỗ

1. `shared/bao-cao.ts` → hàm `buildReport` (đọc cột mới)
2. `src/types.ts` → khai kiểu
3. `src/components/Report.tsx` → hiển thị

Đổi tên tab, đổi thứ tự cột, thêm cột không dùng đến — **không** cần sửa code.
Tên tab đọc từ env `SHEET_TAB_RESULTS` / `SHEET_TAB_LEVELS`.

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
- Mã dạng `HS001` dễ đoán. Nếu dữ liệu nhạy cảm, đổi sang mã ngẫu nhiên — chỉ sửa
  cột `ma_hoc_sinh` trong sheet, code không đổi.

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
| `SHEET_TAB_RESULTS` | Mặc định `KetQua` |
| `SHEET_TAB_LEVELS` | Mặc định `BacNangLuc` |
| `CACHE_TTL_SECONDS` | Mặc định `60` |
| `DEV_CACHE_TTL_SECONDS` | Mặc định `60` |

---

## 10. Trạng thái hiện tại

### Đã xong

- Toàn bộ frontend, 3 phần báo cáo, responsive, CSS in ấn (nút "In / Lưu PDF")
- Netlify Function với 2 nguồn dữ liệu + fallback dữ liệu mẫu
- Cache và độ tươi dữ liệu (mục 5)
- Xử lý lỗi Apps Script (mục 6)
- Template Google Sheet + 20 dòng dữ liệu ảo, sheet thật đã kết nối và chạy
- Script chẩn đoán `npm run kiem-tra`
- Đã push GitHub: `hoongp4327/test_datahs_ismart` (repo **PUBLIC**)

### Chưa xong — bắt buộc trước khi dùng thật

1. **Google Sheet vẫn đang công khai.** Share → General access → **Restricted**.
   Apps Script chạy bằng quyền chủ sheet nên đóng lại web vẫn chạy.
2. **Chưa deploy Netlify.** Import repo từ GitHub, điền `APPS_SCRIPT_URL`,
   `APPS_SCRIPT_TOKEN`, `CACHE_TTL_SECONDS` trước khi bấm Deploy.
3. **Tên trung tâm còn là placeholder** — hằng `ORG` trong `src/components/Layout.tsx`
   đang là "Trung tâm Anh ngữ", "Hotline: 0000.000.000", "website.vn".

### Đang chờ quyết định nghiệp vụ

- **Biểu đồ cột 4 kỹ năng** (bản tham chiếu có). Đã phân tích: thang 0–10, trục Y
  max 12 để chừa chỗ nhãn chữ trên cột, màu nhạt dần theo điểm, nhãn "Khá"/"Trung
  bình" suy ra từ điểm theo mức A/B/C/D. **Chặn ở chỗ chưa có rubric chấm điểm** —
  không có tiêu chí thì hai giáo viên chấm 7 điểm không cùng nghĩa, mà biểu đồ lại
  trông như một phép đo chính xác. Cần thêm 4 cột điểm và quyết định `hoc_luc` tính
  tự động hay gõ tay (để cả hai gõ tay sẽ có ngày trang tự mâu thuẫn).
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
