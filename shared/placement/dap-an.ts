/**
 * ĐÁP ÁN + BIỂU ĐIỂM — chỉ server đọc file này (Netlify Function / Vite dev server).
 * KHÔNG import file này từ src/ — làm vậy là đáp án lộ ra trình duyệt.
 *
 * Câu có `dung: null` = CHƯA CÓ ĐÁP ÁN: bài vẫn nộp được, câu trả lời vẫn ghi vào sheet,
 * nhưng câu đó tạm tính 0 điểm và cột ghi_chu báo "chưa có đáp án".
 *
 * Tổng: Listening 20 + Reading 20 + Writing 15 = 55.
 */
import { MOI_CAU, type KyNangTest } from "./de-thi";

type DapAnCau =
  /** Một trong các đáp án đúng (so sánh không phân biệt hoa thường, dấu câu, khoảng trắng). */
  | { diem: number; dung: string[] | null }
  /** Giáo viên chấm tay trên sheet. goiY hiện ở ghi chú tiêu đề cột cho giáo viên tham khảo. */
  | { diem: number; giaoVienCham: true; goiY: string };

export const DAP_AN: Record<string, DapAnCau> = {
  // ---------- LISTENING (10 câu × 2 điểm = 20) ----------
  // TODO: điền đáp án nghe theo audio gốc. Part 1 & 2: chữ cái A–F / A–C.
  "L1-1": { diem: 2, dung: null },
  "L1-2": { diem: 2, dung: null },
  "L1-3": { diem: 2, dung: null },
  "L2-1": { diem: 2, dung: null }, // A dance · B ride a bike · C swim
  "L2-2": { diem: 2, dung: null }, // A eggs · B chicken · C rice
  "L2-3": { diem: 2, dung: null }, // A Science · B English · C Maths
  "L2-4": { diem: 2, dung: null }, // A a red dress · B black trousers · C a blue T-shirt
  // Part 3: liệt kê mọi cách viết chấp nhận được, ví dụ ["8", "eight"].
  "L3-1": { diem: 2, dung: null },
  "L3-2": { diem: 2, dung: null },
  "L3-3": { diem: 2, dung: null },

  // ---------- READING (20) ----------
  // Part 1: 2 câu × 2 = 4. Hình: A xe đạp, B trực thăng, C giá sách, D áo khoác, E thỏ, F bác sĩ
  "R1-1": { diem: 2, dung: ["E"] },
  "R1-2": { diem: 2, dung: ["B"] },
  // Part 2: 3 câu × 2 = 6
  "R2-1": { diem: 2, dung: ["No"] },
  "R2-2": { diem: 2, dung: ["No"] },
  "R2-3": { diem: 2, dung: ["No"] },
  // Part 3: 4 câu × 2,5 = 10
  "R3-1": { diem: 2.5, dung: ["A"] },
  "R3-2": { diem: 2.5, dung: ["B"] },
  "R3-3": { diem: 2.5, dung: ["C"] },
  "R3-4": { diem: 2.5, dung: ["A"] },

  // ---------- WRITING (15) ----------
  // Part 1: 3 câu × 1 = 3
  "W1-1": { diem: 1, dung: ["elephant"] },
  "W1-2": { diem: 1, dung: ["tram"] },
  "W1-3": { diem: 1, dung: ["jellyfish"] },
  // Part 2: 4 câu × 3 = 12 — GIÁO VIÊN CHẤM, nhập vào cột diem_writing_p2_gv trên sheet.
  "W2-1": { diem: 3, giaoVienCham: true, goiY: "There are three ducks." },
  "W2-2": { diem: 3, giaoVienCham: true, goiY: "He is selling snacks." },
  "W2-3": { diem: 3, giaoVienCham: true, goiY: "No, they can't. They must walk." },
  "W2-4": { diem: 3, giaoVienCham: true, goiY: "I take it home. / I put it in the bin." },
};

/** Chữ thường, bỏ dấu câu, gộp khoảng trắng: " Tram. " → "tram", "can't" → "can t". */
export function chuanHoa(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type KetQuaCau = {
  id: string;
  kyNang: KyNangTest;
  traLoi: string;
  diem: number;
  toiDa: number;
  /** dung / sai / trong / chua-co-dap-an / gv-cham (giáo viên chấm tay, máy tính 0 điểm) */
  trangThai: "dung" | "sai" | "trong" | "chua-co-dap-an" | "gv-cham";
};

function chamCau(id: string, traLoiGoc: string): Omit<KetQuaCau, "kyNang"> {
  const da = DAP_AN[id];
  const traLoi = String(traLoiGoc ?? "").trim().slice(0, 300);
  const toiDa = da?.diem ?? 0;
  if (!da) return { id, traLoi, diem: 0, toiDa, trangThai: "chua-co-dap-an" };
  if ("giaoVienCham" in da) return { id, traLoi, diem: 0, toiDa, trangThai: "gv-cham" };
  if (!traLoi) return { id, traLoi, diem: 0, toiDa, trangThai: "trong" };

  if (!da.dung) return { id, traLoi, diem: 0, toiDa, trangThai: "chua-co-dap-an" };
  const dung = da.dung.some((d) => chuanHoa(d) === chuanHoa(traLoi));
  return { id, traLoi, diem: dung ? toiDa : 0, toiDa, trangThai: dung ? "dung" : "sai" };
}

export function chamBai(traLoi: Record<string, string>) {
  const chiTiet: KetQuaCau[] = MOI_CAU.map((c) => ({ ...chamCau(c.id, traLoi[c.id] ?? ""), kyNang: c.kyNang }));
  const tong = (kn?: KyNangTest) =>
    chiTiet.filter((c) => !kn || c.kyNang === kn).reduce((s, c) => s + c.diem, 0);
  const chuaCoDapAn = chiTiet.filter((c) => c.trangThai === "chua-co-dap-an").map((c) => c.id);
  /** Điểm tối đa phần giáo viên chấm (Writing Part 2 = 12). */
  const toiDaGv = chiTiet.filter((c) => c.trangThai === "gv-cham").reduce((s, c) => s + c.toiDa, 0);
  return {
    listening: tong("listening"),
    reading: tong("reading"),
    writing: tong("writing"),
    tong: tong(),
    chiTiet,
    chuaCoDapAn,
    toiDaGv,
  };
}
