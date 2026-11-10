import type { Context } from "@netlify/functions";
import { cauHinhTuEnv } from "../../shared/nguon-du-lieu";
import { xuLyQuanTri } from "../../shared/quan-tri";

/** /api/admin — đọc danh sách và lưu điểm cho trang quản trị. Logic nằm ở shared/quan-tri.ts. */
const CAU_HINH = cauHinhTuEnv(process.env);

export default (req: Request, _context: Context) => xuLyQuanTri(req, CAU_HINH, process.env.ADMIN_KEY ?? "");
