/**
 * Chụp lại ảnh cho trang hướng dẫn GIÁO VIÊN (huong-dan/hinh/gv-*.webp) và xuất PDF.
 *
 *   npm run dev:mau -- --port 5181        (cửa sổ khác — chạy MỚI, vì script thêm học sinh thử)
 *   node scripts/chup-huong-dan.mjs       chụp ảnh từ dữ liệu mẫu
 *   node scripts/xuat-huong-dan.mjs       chép sang public/
 *   node scripts/chup-huong-dan.mjs pdf   xuất huong-dan/Huong-dan-giao-vien.pdf
 *
 * Cần Chrome và ffmpeg trên máy, không cần cài thêm gói npm. Đề thi (tranh, câu hỏi, câu trả
 * lời, gợi ý của Writing Part 2) luôn được làm mờ vì trang hướng dẫn là công khai.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WEB = process.env.WEB ?? "http://localhost:5181";
const HINH = path.resolve("huong-dan/hinh");
const CHROME =
  process.env.CHROME ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((f) =>
    fs.existsSync(f)
  );

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const tam = fs.mkdtempSync(path.join(os.tmpdir(), "chup-hd-"));

/* ------------------------------- Chrome qua CDP ------------------------------- */

const chrome = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${path.join(tam, "ho-so")}`,
  "--hide-scrollbars", "--no-first-run", "--lang=vi", "about:blank",
]);
let trang;
for (let i = 0; i < 50 && !trang; i++) {
  await cho(200);
  trang = await fetch("http://127.0.0.1:9333/json").then((r) => r.json()).then((d) => d.find((t) => t.type === "page")).catch(() => null);
}
const ws = new WebSocket(trang.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let so = 0;
const doi = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (doi.has(m.id)) (m.error ? doi.get(m.id)[1](new Error(m.error.message)) : doi.get(m.id)[0](m.result)), doi.delete(m.id);
};
const cdp = (method, params = {}) =>
  new Promise((ok, loi) => {
    doi.set(++so, [ok, loi]);
    ws.send(JSON.stringify({ id: so, method, params }));
  });
const js = async (code) => {
  const r = await cdp("Runtime.evaluate", { expression: `(async()=>{${code}})()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "Lỗi trên trang");
  return r.result.value;
};
const mo = async (url, ms = 2500) => {
  await cdp("Page.navigate", { url });
  await cho(ms);
};

/** Ảnh cả màn hình (1600px) hoặc một khung trên trang (1320px). */
async function chup(ten, boChon) {
  let clip;
  if (boChon) {
    // Đầu trang và thanh lưu dính màn hình sẽ che khung → ẩn lúc chụp.
    await js(`document.documentElement.classList.add("dang-chup")`);
    await cho(250);
    clip = await js(`const r=(${boChon}).getBoundingClientRect();return{x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scale:1}`);
  }
  await cho(400);
  const { data } = await cdp("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  if (boChon) await js(`document.documentElement.classList.remove("dang-chup")`);
  const png = path.join(tam, ten + ".png");
  fs.writeFileSync(png, Buffer.from(data, "base64"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=${boChon ? 1320 : 1600}:-1:flags=lanczos`, "-quality", "86", path.join(HINH, ten + ".webp")]);
  console.log("đã chụp", ten);
}

const CHUAN_BI = `
  window.confirm=()=>true;
  const s=document.createElement("style");
  s.textContent=\`
    *{transition:none!important;animation:none!important;caret-color:transparent!important}
    .qt-cc-cau-de,.qt-cc-tra-loi,.qt-cc-goi-y,.qt-cc-chi-tiet{filter:blur(13px);overflow:hidden}
    .qt-cc-tranh{filter:blur(24px);clip-path:inset(0)}
    .dang-chup .qt-dau,.dang-chup .qt-thanh-luu{visibility:hidden!important}\`;
  document.head.append(s);
  // Nhãn nguồn dữ liệu như bản chạy thật.
  const n=document.querySelector(".qt-nguon");n.className="qt-nguon";n.textContent="Google Sheet · Apps Script";
  window.cho=ms=>new Promise(r=>setTimeout(r,ms));
  window.nhap=(el,v)=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),"value").set.call(el,v);
    el.dispatchEvent(new Event(el.tagName==="SELECT"?"change":"input",{bubbles:true}))};
  window.nut=(chu,goc=document)=>[...goc.querySelectorAll("button")].find(b=>b.innerText.trim().startsWith(chu));
  window.o=(nhan,goc=document)=>[...goc.querySelectorAll(".qt-o")].find(l=>l.querySelector(".qt-o-nhan")?.innerText.startsWith(nhan)).querySelector("input,select,textarea");
  window.khung=td=>[...document.querySelectorAll(".qt-the")].find(t=>t.querySelector("h2")?.innerText.startsWith(td));
`;
const khung = (td) => `khung(${JSON.stringify(td)})`;

/* ----------------------------------- Chụp ----------------------------------- */

async function chupAnh() {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 2, mobile: false });
  await mo(`${WEB}/quan-tri`, 3500);
  await js(CHUAN_BI);

  await chup("gv-01-trang-quan-tri");

  await js(`document.querySelector(".qt-tao-ma").click();await cho(300);const h=document.querySelector(".qt-hop");
    nhap(o("Số lượng",h),"3");nhap(o("Thông tin",h),"Lớp tiếng Anh thiếu nhi - Cơ sở 1");nhap(o("Giáo viên",h),"Nguyễn Thu Trang");document.activeElement.blur()`);
  await chup("gv-02-hop-tao-ma");

  await js(`nut("Tạo mã",document.querySelector(".qt-hop form")).click();await cho(800)`);
  await chup("gv-03-da-tao-ma");
  const ma = await js(`return document.querySelector(".qt-hop").innerText.match(/HS-[A-Z0-9]{6}/)[0]`);

  await js(`nut("Xong").click();await cho(300);nhap(document.querySelector(".qt-tim input"),"${ma}");await cho(300);
    document.querySelector(".qt-ds-muc .qt-hs").click();await cho(400);document.activeElement.blur()`);
  await chup("gv-05-mo-ma-chua-lam");

  // Học sinh nộp bài: L 14 · R 12,5 · W-P1 2 (tổng sau khi chấm 49,5 → gợi ý iLEAD 3).
  const traLoi = {
    "L1-1": "D", "L1-2": "A", "L1-3": "E", "L2-1": "C", "L2-2": "A", "L2-3": "C", "L2-4": "C",
    "R1-1": "E", "R1-2": "B", "R2-1": "No", "R2-2": "No", "R2-3": "No", "R3-1": "A", "W1-1": "elephant", "W1-2": "tram",
    "W2-1": "Sample answer one.", "W2-2": "Sample answer number two.", "W2-3": "Sample answer three.", "W2-4": "Sample answer.",
  };
  const nop = await fetch(`${WEB}/api/placement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maBai: "chup-huong-dan-" + Date.now(), maHocSinh: ma, hoTen: "Nguyễn Khánh An", ngaySinh: "05/06/2016", batDau: Date.now() - 38 * 60000, traLoi }),
  }).then((r) => r.json());
  if (!nop.ok) throw new Error("Nộp bài thử không được: " + JSON.stringify(nop));

  await mo(`${WEB}/quan-tri`, 3000);
  await js(CHUAN_BI);
  await js(`nut("Chờ chấm").click();await cho(400)`);
  await chup("gv-06-tab-cho-cham");

  await js(`document.querySelector(".qt-ds-muc .qt-hs").click();await cho(900)`);
  await chup("gv-08-may-da-cham", khung("Máy đã chấm"));

  await js(`[...document.querySelectorAll(".qt-cc-chon")].forEach((g,i)=>g.querySelectorAll("button")[[3,3,2,2][i]].click());await cho(300)`);
  await chup("gv-09-cham-writing-p2", khung("Writing Part 2"));

  await js(`nut("Lưu điểm").click();await cho(1200);scrollTo(0,document.body.scrollHeight)`);
  await chup("gv-11-da-luu-writing");

  await js(`nhap(o("Điểm Speaking"),"11");
    nhap(o("Nhận xét riêng"),"Con phát âm rõ, trả lời tự tin các câu hỏi về bản thân. Cần luyện thêm cách nói câu dài hơn.");
    document.activeElement.blur();await cho(300)`);
  await chup("gv-13-cham-speaking", khung("Speaking"));

  await js(`scrollTo(0,document.body.scrollHeight)`);
  await chup("gv-14-xac-nhan-ket-qua");

  await js(`nut("iLEAD 2").click();document.activeElement.blur();await cho(300)`);
  await chup("gv-17-doi-lop", khung("Xếp lớp"));

  await js(`nut("Xác nhận kết quả").click();await cho(1500);nhap(document.querySelector(".qt-tim input"),"Khánh An");await cho(300);scrollTo(0,0);document.activeElement.blur()`);
  await chup("gv-15-mo-hoc-sinh-sau-cham");
  await chup("gv-16-form-1", khung("Điểm 4 kỹ năng"));
  await js(`nhap(o("Nhận xét lộ trình"),"Con nên bắt đầu ở lớp iLEAD 2 để củng cố phản xạ nói, sau đó chuyển lên iLEAD 3.");document.activeElement.blur();await cho(200)`);
  await chup("gv-16-form-2", khung("Lộ trình học tập"));
  await js(`nut("Lưu vào sheet").click();await cho(1200)`);

  await mo(`${WEB}/ket-qua?ma=${ma}`, 6000);
  await chup("gv-18-bao-cao");
}

async function xuatPdf() {
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await mo(pathToFileURL(path.resolve("huong-dan/giao-vien.html")).href, 3000);
  await js(`document.querySelectorAll("details").forEach(d=>d.open=true);document.querySelectorAll("img").forEach(i=>i.loading="eager");
    const s=document.createElement("style");s.textContent="figure,.ghi-chu,details,tr{break-inside:avoid}h2,h3{break-after:avoid}.phan{margin-top:36px;display:block}.phan>*+*{margin-top:18px}.phan>h2{display:block}.phan>h2 .so{display:inline-block;margin-right:12px}.buoc{display:block}.buoc>*+*{margin-top:12px}body{background:#fff}.wrap{padding-block:0}figure img{max-height:225mm;width:auto;max-width:100%}";
    document.head.append(s);await document.fonts.ready;
    await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))`);
  const { data } = await cdp("Page.printToPDF", {
    printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.5, marginBottom: 0.5, marginLeft: 0.4, marginRight: 0.4, scale: 0.82,
  });
  fs.writeFileSync("huong-dan/Huong-dan-giao-vien.pdf", Buffer.from(data, "base64"));
  console.log("đã xuất huong-dan/Huong-dan-giao-vien.pdf");
}

try {
  await cdp("Page.enable");
  await (process.argv[2] === "pdf" ? xuatPdf() : chupAnh());
} finally {
  ws.close();
  chrome.kill();
  await cho(800);
  fs.rmSync(tam, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
