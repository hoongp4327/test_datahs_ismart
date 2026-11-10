import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildReport, normalizeCode, timHocSinh, type SheetData } from "./shared/bao-cao";
import { cauHinhTuEnv, docDuLieu } from "./shared/nguon-du-lieu";

/**
 * Giả lập Netlify Function ngay trong Vite dev server, dùng chung cách chọn nguồn
 * dữ liệu với function thật (shared/nguon-du-lieu.ts).
 *
 * Chế độ service account chỉ chạy qua Netlify Function thật (`npm run dev`),
 * vì cần private key và thư viện google-auth-library.
 */
function apiGiaLap(env: Record<string, string>): Plugin {
  const cauHinh = cauHinhTuEnv(env);

  /**
   * Độ tươi của dữ liệu do refresh=1 lo (trang web gửi mỗi lần tải trang), nên
   * TTL ở đây chỉ còn giữ dữ liệu trong một phiên xem — để ngắn chỉ làm chậm
   * mà không tươi hơn. Đặt bằng production.
   */
  const TTL = Number(env.DEV_CACHE_TTL_SECONDS ?? 60) * 1000;
  let cache: { at: number; data: Promise<{ data: SheetData; nguon: string }> } | null = null;

  return {
    name: "api-gia-lap",
    apply: "serve",
    configureServer(server) {
      const log = server.config.logger;
      const moTaNguon = cauHinh.chiDungMau
        ? "dữ liệu mẫu (NGUON_DU_LIEU=mau)"
        : cauHinh.appsScriptUrl
          ? "Apps Script"
          : cauHinh.sheetId
            ? "sheet công khai"
            : "dữ liệu mẫu";
      log.info(`  ➜  API:      ${moTaNguon}, cache ${TTL / 1000}s`);

      /** Trả về [dữ liệu, mô tả] để log cho biết đang đọc mới hay lấy từ cache. */
      const layDuLieu = (boQuaCache: boolean) => {
        if (!boQuaCache && cache && Date.now() - cache.at < TTL) {
          return [cache.data, `cache ${Math.round((Date.now() - cache.at) / 1000)}s`] as const;
        }
        const data = docDuLieu(cauHinh, { canhBao: (m) => log.warn(`  [api] ${m}`) });
        // Lỗi thì bỏ cache để lần sau thử lại thay vì nhớ mãi lỗi cũ.
        data.catch(() => (cache = null));
        cache = { at: Date.now(), data };
        return [data, "nạp mới"] as const;
      };

      server.middlewares.use("/api/result", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const code = normalizeCode(url.searchParams.get("code") ?? "");
        // refresh=1 (trang web gửi mỗi lần tải trang) hoặc nocache=1 (gõ tay để thử).
        const boQuaCache = url.searchParams.has("refresh") || url.searchParams.has("nocache");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        // Giống production: trình duyệt không được giữ lại kết quả tra cứu.
        res.setHeader("Cache-Control", "no-store");

        if (!code) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "MISSING_CODE", message: "Vui lòng nhập mã học sinh." }));
          return;
        }

        try {
          const batDau = Date.now();
          const [cho, trangThai] = layDuLieu(boQuaCache);
          const { data, nguon } = await cho;
          const row = timHocSinh(data.ketQua, code);

          // In ra để thấy rõ nguồn, đọc mới hay cache, và sheet có bao nhiêu dòng.
          log.info(
            `  [api] ${code}  ${row ? "→ " + row.ho_ten : "→ KHÔNG THẤY"}` +
              `  (${nguon}, ${trangThai}, ${data.ketQua.length} dòng, ${Date.now() - batDau} ms)`
          );

          if (!row) {
            res.statusCode = 404;
            res.end(
              JSON.stringify({
                error: "NOT_FOUND",
                message: "Không tìm thấy kết quả cho mã học sinh này. Vui lòng kiểm tra lại.",
              })
            );
            return;
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ data: buildReport(row, data) }));
        } catch (err) {
          log.error(`  [api] ${(err as Error).message}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "SERVER_ERROR", message: (err as Error).message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Chuỗi rỗng = nạp mọi biến trong .env, không chỉ biến có tiền tố VITE_.
  // `vite --mode mau` nạp thêm .env.mau (NGUON_DU_LIEU=mau) để xem bằng dữ liệu mẫu.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), apiGiaLap(env)],
    build: {
      target: "es2020",
      cssCodeSplit: false,
    },
  };
});
