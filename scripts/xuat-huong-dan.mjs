/**
 * Xuất trang hướng dẫn sử dụng lên website: huong-dan/*.html → public/huong-dan/
 *
 *   node scripts/xuat-huong-dan.mjs
 *
 * File trong huong-dan/ là nguồn (cũng dùng để đăng bản xem trước), viết dạng "thân trang"
 * không có <!doctype>/<head>. Script bọc thành trang HTML đầy đủ, đổi đường dẫn ảnh sang
 * /huong-dan/hinh/ (trang được mở ở /huong-dan và /huong-dan/hoc-sinh nên đường dẫn tương đối
 * sẽ trỏ sai), thêm link quay lại trang chọn, và chép ảnh.
 *
 * Website phục vụ:  /huong-dan            → public/huong-dan/index.html
 *                   /huong-dan/hoc-sinh   → public/huong-dan/hoc-sinh.html
 *                   /huong-dan/giao-vien  → public/huong-dan/giao-vien.html
 * (luật chuyển hướng nằm trong netlify.toml, đặt TRƯỚC luật SPA fallback).
 */
import fs from "node:fs";
import path from "node:path";

const NGUON = "huong-dan";
const DICH = "public/huong-dan";
const TRANG = [
  ["trang-chu.html", "index.html", false],
  ["hoc-sinh.html", "hoc-sinh.html", true],
  ["giao-vien.html", "giao-vien.html", true],
];

fs.mkdirSync(path.join(DICH, "hinh"), { recursive: true });

const NUT_VE = `<a class="ve-trang-chon" href="/huong-dan">← Tất cả hướng dẫn</a>`;
const CSS_NUT_VE = `<style>.ve-trang-chon{display:inline-block;margin-bottom:20px;font:600 15px/1.4 "Be Vietnam Pro","Segoe UI",system-ui,sans-serif;color:var(--navy);text-decoration:none}.ve-trang-chon:hover,.ve-trang-chon:focus-visible{text-decoration:underline}</style>`;

for (const [vao, ra, coNutVe] of TRANG) {
  let than = fs.readFileSync(path.join(NGUON, vao), "utf8");
  // <meta charset> đã có trong khung bên dưới.
  than = than.replace(/<meta charset="utf-8">\s*/i, "");
  than = than.replaceAll('src="hinh/', 'src="/huong-dan/hinh/');
  if (coNutVe) than = than.replace('<div class="wrap">', `<div class="wrap">\n  ${NUT_VE}`) + CSS_NUT_VE;
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/images/ismart-logo.png">
</head>
<body>
${than}
</body>
</html>
`;
  fs.writeFileSync(path.join(DICH, ra), html);
  console.log("đã xuất", path.join(DICH, ra));
}

// Chỉ chép ảnh mà các trang thật sự dùng, để ảnh nháp không lọt lên web.
const dungToi = new Set();
for (const [vao] of TRANG) {
  for (const m of fs.readFileSync(path.join(NGUON, vao), "utf8").matchAll(/src="hinh\/([^"]+)"/g)) dungToi.add(m[1]);
}
for (const f of fs.readdirSync(path.join(DICH, "hinh"))) {
  if (!dungToi.has(f)) fs.rmSync(path.join(DICH, "hinh", f));
}
for (const f of dungToi) fs.copyFileSync(path.join(NGUON, "hinh", f), path.join(DICH, "hinh", f));
console.log(`đã chép ${dungToi.size} ảnh`);
