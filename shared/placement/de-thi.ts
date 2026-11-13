/**
 * Đề iLEAD Online Placement Test — phần HIỂN THỊ (không có đáp án).
 * File này được đóng gói vào trình duyệt. Đáp án nằm riêng ở dap-an.ts, chỉ server đọc.
 *
 * Sửa câu chữ → sửa ở đây. Thêm/bớt câu → sửa cả dap-an.ts (id phải khớp).
 */

export type KyNangTest = "listening" | "reading" | "writing";

export type LuaChon = { gt: string; nhan?: string; anh?: string };

export type Cau =
  /** Chọn một đáp án (chữ cái, Yes/No, hoặc câu trả lời có hình). */
  | { id: string; kieu: "chon"; de?: string; anh?: string; luaChon: LuaChon[]; hang?: boolean }
  /** Điền một từ / một số vào chỗ trống: truoc ____ sau. */
  | { id: string; kieu: "dien"; de?: string; truoc?: string; sau?: string }
  /** Sắp xếp chữ cái thành từ, có hình gợi ý. */
  | { id: string; kieu: "sap-xep"; chu: string; anh: string }
  /** Trả lời bằng một câu hoàn chỉnh. */
  | { id: string; kieu: "cau"; de: string };

export type Phan = {
  id: string;
  kyNang: KyNangTest;
  tieuDe: string;
  huongDan: string;
  /** Video YouTube chứa audio của phần nghe. */
  youtube?: string;
  /** Bảng hình A–F dùng chung cho các câu chọn chữ cái. */
  luoiAnh?: { chu: string; anh: string }[];
  /** Một hình lớn dùng chung cho cả phần. */
  anhChung?: string;
  doanVan?: { tieuDe: string; doan: string[] };
  viDu?: { hoi: string; traLoi: string };
  cauHoi: Cau[];
};

const A = (ten: string) => `/images/placement/${ten}.webp`;
const CHU_AF = ["A", "B", "C", "D", "E", "F"].map((c) => ({ gt: c }));

export const DE_THI = {
  ten: "iLEAD Online Placement Test",
  moTa: "Bài kiểm tra xếp lớp đầu vào chương trình iLEAD",
  thoiGianPhut: 35,
  youtubeKiemTraLoa: "BoiOoVqfbdI",
  tongKet: [
    { kyNang: "listening" as const, ten: "Listening", soCau: 10, diem: 20 },
    { kyNang: "reading" as const, ten: "Reading", soCau: 9, diem: 20 },
    { kyNang: "writing" as const, ten: "Writing", soCau: 7, diem: 15 },
  ],
  phan: [
    {
      id: "L1",
      kyNang: "listening",
      tieuDe: "Listening – Part 1",
      huongDan: "Look at the pictures. Listen and choose the correct letter (A–F). You will hear the audio twice.",
      youtube: "sIg5eAUGlvk",
      luoiAnh: ["a", "b", "c", "d", "e", "f"].map((c) => ({ chu: c.toUpperCase(), anh: A(`l1-${c}`) })),
      cauHoi: [1, 2, 3].map((n) => ({ id: `L1-${n}`, kieu: "chon" as const, de: `Question ${n}`, luaChon: CHU_AF, hang: true })),
    },
    {
      id: "L2",
      kyNang: "listening",
      tieuDe: "Listening – Part 2",
      huongDan: "Look at the pictures. Listen and choose the correct answer. You will hear the audio twice.",
      youtube: "lSpETdnVL_c",
      cauHoi: [
        ["What can he/she do?", ["dance", "ride a bike", "swim"]],
        ["What is her favourite food?", ["eggs", "chicken", "rice"]],
        ["What subject does she have on Tuesday?", ["Science", "English", "Maths"]],
        ["What is she wearing today?", ["a red dress", "black trousers", "a blue T-shirt"]],
      ].map(([de, chon], i) => ({
        id: `L2-${i + 1}`,
        kieu: "chon" as const,
        de: `Question ${i + 1}: ${de}`,
        luaChon: (chon as string[]).map((nhan, j) => ({
          gt: "ABC"[j],
          nhan,
          anh: A(`l2-${i + 1}-${"abc"[j]}`),
        })),
      })),
    },
    {
      id: "L3",
      kyNang: "listening",
      tieuDe: "Listening – Part 3",
      huongDan: "Listen and write ONE WORD or A NUMBER to complete the notes. You will hear the audio twice.",
      youtube: "qIe0UG93E8Y",
      cauHoi: [
        { id: "L3-1", kieu: "dien", de: "Question 1", truoc: "Picnic place: National" },
        { id: "L3-2", kieu: "dien", de: "Question 2", truoc: "Clothes:" },
        { id: "L3-3", kieu: "dien", de: "Question 3", truoc: "Time:", sau: "a.m." },
      ],
    },
    {
      id: "R1",
      kyNang: "reading",
      tieuDe: "Reading – Part 1",
      huongDan: "Look at the pictures. Read and choose the correct letter.",
      luoiAnh: ["a", "b", "c", "d", "e", "f"].map((c) => ({ chu: c.toUpperCase(), anh: A(`r1-${c}`) })),
      cauHoi: [
        { id: "R1-1", kieu: "chon", de: "1. Rabbit", luaChon: CHU_AF, hang: true },
        { id: "R1-2", kieu: "chon", de: "2. Helicopter", luaChon: CHU_AF, hang: true },
      ],
    },
    {
      id: "R2",
      kyNang: "reading",
      tieuDe: "Reading – Part 2",
      huongDan: "Look at the pictures, read the statements, and choose Yes or No.",
      cauHoi: ["It is a spider.", "They are walking in the jungle.", "The ground is muddy."].map((de, i) => ({
        id: `R2-${i + 1}`,
        kieu: "chon" as const,
        de,
        anh: A(`r2-${i + 1}`),
        luaChon: [{ gt: "Yes" }, { gt: "No" }],
        hang: true,
      })),
    },
    {
      id: "R3",
      kyNang: "reading",
      tieuDe: "Reading – Part 3",
      huongDan: "Read the article and choose the correct answer.",
      doanVan: {
        tieuDe: "Helping Animals at the National Park",
        doan: [
          "My name is Nina, and I live near a large national park. The park has beautiful forests, rivers, and many different animals. My mother works at a small animal center near the park. She helps animals that are sick or hurt.",
          "Last Saturday, I went to the center with her. First, we helped a young monkey that had a hurt leg. My mother cleaned its leg and gave it some medicine. Then, we looked after two small birds. One bird had a broken wing, so it could not fly. The other bird was very weak because it was hungry.",
          "In the afternoon, a man brought a baby deer to the center. He found it near the road and was worried about it. My mother checked the deer carefully. Luckily, it was not badly hurt. We gave it some water and food and kept it in a quiet room.",
          "Some animals stay at the center for a few days, but others need more time before they can return to the park. I really enjoyed helping my mother. I want to learn more about animals because I hope to work with them in the future.",
        ],
      },
      cauHoi: [
        ["Where does Nina live?", ["Near a national park", "Near an animal center", "Near a farm"]],
        ["What did the monkey have?", ["A broken wing", "A hurt leg", "A weak body"]],
        ["Where did the man find the baby deer?", ["In the forest", "At the animal center", "Near the road"]],
        ["What does Nina want to do in the future?", ["Work with animals", "Work at a park", "Become a doctor"]],
      ].map(([de, chon], i) => ({
        id: `R3-${i + 1}`,
        kieu: "chon" as const,
        de: `${i + 1}. ${de}`,
        luaChon: (chon as string[]).map((nhan, j) => ({ gt: "ABC"[j], nhan })),
      })),
    },
    {
      id: "W1",
      kyNang: "writing",
      tieuDe: "Writing – Part 1",
      huongDan: "Look and write. Put the letters in the correct order.",
      cauHoi: [
        { id: "W1-1", kieu: "sap-xep", chu: "p l h e n t e a", anh: A("w1-1") },
        { id: "W1-2", kieu: "sap-xep", chu: "m t a r", anh: A("w1-2") },
        { id: "W1-3", kieu: "sap-xep", chu: "f y j i e l l h s", anh: A("w1-3") },
      ],
    },
    {
      id: "W2",
      kyNang: "writing",
      tieuDe: "Writing – Part 2",
      huongDan: "Look at the picture. Write your answer in A COMPLETE SENTENCE. There is one example.",
      anhChung: A("w2-park"),
      viDu: { hoi: "Where are the children?", traLoi: "They are in the park." },
      cauHoi: [
        "How many ducks are there in the park?",
        "What is the man doing?",
        "Can children run in the park?",
        "Where do you put your trash when you are at the park?",
      ].map((de, i) => ({ id: `W2-${i + 1}`, kieu: "cau" as const, de })),
    },
  ] satisfies Phan[] as Phan[],
};

/** Danh sách id mọi câu, theo đúng thứ tự trong đề. */
export const MOI_CAU = DE_THI.phan.flatMap((p) => p.cauHoi.map((c) => ({ id: c.id, phan: p.id, kyNang: p.kyNang })));
