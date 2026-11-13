import type { Context } from "@netlify/functions";
import { cauHinhTuEnv } from "../../shared/nguon-du-lieu";
import { xuLyNopBai } from "../../shared/placement/nop-bai";

/** /api/placement — học sinh nộp bài placement test. Logic ở shared/placement/nop-bai.ts. */
const CAU_HINH = cauHinhTuEnv(process.env);

export default (req: Request, _context: Context) => xuLyNopBai(req, CAU_HINH);
