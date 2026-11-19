/**
 * Xuất trang hướng dẫn sử dụng lên website: huong-dan/*.html → public/huong-dan/
 *
 *   node scripts/xuat-huong-dan.mjs
 *
 * File trong huong-dan/ là nguồn (cũng dùng để đăng bản xem trước), viết dạng "thân trang"
 * không có <!doctype>/<head>. Script bọc thành trang HTML đầy đủ, đổi đường dẫn ảnh sang
 * /huong-dan/hinh/ (trang mở ở /huong-dan/hoc-sinh, không có đuôi .html, nên đường dẫn tương đối
 * sẽ trỏ sai), và chép ảnh.
 *
 * Hai link riêng biệt, không có trang chọn chung:
 *   /huong-dan/hoc-sinh   → public/huong-dan/hoc-sinh.html
 *   /huong-dan/giao-vien  → public/huong-dan/giao-vien.html
 * (luật chuyển hướng nằm trong netlify.toml, đặt TRƯỚC luật SPA fallback).
 */
import fs from "node:fs";
import path from "node:path";

const NGUON = "huong-dan";
const DICH = "public/huong-dan";
const TRANG = [
  ["hoc-sinh.html", "hoc-sinh.html"],
  ["giao-vien.html", "giao-vien.html"],
];

fs.mkdirSync(path.join(DICH, "hinh"), { recursive: true });

for (const [vao, ra] of TRANG) {
  let than = fs.readFileSync(path.join(NGUON, vao), "utf8");
  // <meta charset> đã có trong khung bên dưới.
  than = than.replace(/<meta charset="utf-8">\s*/i, "");
  than = than.replaceAll('src="hinh/', 'src="/huong-dan/hinh/');
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
