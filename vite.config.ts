import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildReport, normalizeCode, timHocSinh } from "./shared/bao-cao";
import { docQuaAppsScript, type SheetData } from "./shared/apps-script";
import { docQuaGoogleSheetPublic } from "./shared/sheet-public";
import duLieuMau from "./shared/du-lieu-mau";

/**
 * Giả lập Netlify Function ngay trong Vite dev server.
 * Có APPS_SCRIPT_URL trong .env thì đọc dữ liệu thật, không thì dùng dữ liệu mẫu.
 *
 * Chế độ service account chỉ chạy qua Netlify Function thật (`npm run dev`),
 * vì cần private key và thư viện google-auth-library.
 */
function apiGiaLap(env: Record<string, string>): Plugin {
  /**
   * Độ tươi của dữ liệu do refresh=1 lo (trang web gửi mỗi lần tải trang), nên
   * TTL ở đây chỉ còn giữ dữ liệu trong một phiên xem — để ngắn chỉ làm chậm
   * mà không tươi hơn. Đặt bằng production.
   */
  const TTL = Number(env.DEV_CACHE_TTL_SECONDS ?? 60) * 1000;
  let cache: { at: number; data: Promise<SheetData> } | null = null;

  /** Trả về [dữ liệu, mô tả nguồn] để log cho biết đang đọc mới hay lấy từ cache. */
  const layDuLieu = (boQuaCache: boolean, server: any): [Promise<SheetData>, string] => {
    if (!boQuaCache && cache && Date.now() - cache.at < TTL) {
      return [cache.data, `cache ${Math.round((Date.now() - cache.at) / 1000)}s`];
    }

    const docDuLieu = async (): Promise<SheetData> => {
      if (env.APPS_SCRIPT_URL) {
        try {
          return await docQuaAppsScript(env.APPS_SCRIPT_URL, env.APPS_SCRIPT_TOKEN ?? "");
        } catch (err) {
          if (env.GOOGLE_SHEET_ID) {
            server.config.logger.warn(
              `  [api] Apps Script trả về lỗi (${(err as Error).message}), chuyển sang nạp từ Google Sheet ID: ${env.GOOGLE_SHEET_ID}`
            );
            return await docQuaGoogleSheetPublic(
              env.GOOGLE_SHEET_ID,
              env.SHEET_TAB_RESULTS || "KetQua",
              env.SHEET_TAB_LEVELS || "BacNangLuc"
            );
          }
          throw err;
        }
      }
      if (env.GOOGLE_SHEET_ID) {
        return await docQuaGoogleSheetPublic(
          env.GOOGLE_SHEET_ID,
          env.SHEET_TAB_RESULTS || "KetQua",
          env.SHEET_TAB_LEVELS || "BacNangLuc"
        );
      }
      return duLieuMau as SheetData;
    };

    const data = docDuLieu();
    // Lỗi thì bỏ cache để lần sau thử lại thay vì nhớ mãi lỗi cũ.
    data.catch(() => (cache = null));
    cache = { at: Date.now(), data };
    return [data, "nạp mới"];
  };

  return {
    name: "api-gia-lap",
    apply: "serve",
    configureServer(server) {
      const nguon = env.APPS_SCRIPT_URL ? "Apps Script (dữ liệu thật)" : "dữ liệu mẫu";
      server.config.logger.info(`  ➜  API:      ${nguon}, cache ${TTL / 1000}s`);

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
          const [choDuLieu, nguonDuLieu] = layDuLieu(boQuaCache, server);
          const { results, levels } = await choDuLieu;
          const row = timHocSinh(results, code);

          // In ra để thấy rõ đang đọc mới hay lấy từ cache, và sheet có bao nhiêu dòng.
          server.config.logger.info(
            `  [api] ${code}  ${row ? "→ " + row.ho_ten : "→ KHÔNG THẤY"}` +
              `  (${nguonDuLieu}, ${results.length} dòng, ${Date.now() - batDau} ms)`
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
          res.end(JSON.stringify({ data: buildReport(row, levels) }));
        } catch (err) {
          server.config.logger.error(`[api] ${(err as Error).message}`);
          res.statusCode = 500;
          res.end(
            JSON.stringify({ error: "SERVER_ERROR", message: (err as Error).message })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Chuỗi rỗng = nạp mọi biến trong .env, không chỉ biến có tiền tố VITE_.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), apiGiaLap(env)],
    build: {
      target: "es2020",
      cssCodeSplit: false,
    },
  };
});
