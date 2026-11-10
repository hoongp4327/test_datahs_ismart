import type { TenIcon } from "./Icon";

/**
 * Màu và icon của 4 kỹ năng, dùng chung cho nhãn radar, thẻ kỹ năng và gợi ý.
 *   mau: màu chính (số điểm, thanh điểm, icon)
 *   nen: nền nhạt của ô icon
 */
export const GIAO_DIEN_KY_NANG: Record<string, { mau: string; nen: string; icon: TenIcon }> = {
  listening: { mau: "#2B8CEE", nen: "#E4F1FE", icon: "headphones" },
  reading: { mau: "#5DB52F", nen: "#E9F6DF", icon: "book" },
  writing: { mau: "#F5A21B", nen: "#FFF3DB", icon: "pencil" },
  speaking: { mau: "#F2603A", nen: "#FFE9E2", icon: "chat" },
};

export const giaoDienKyNang = (key: string) =>
  GIAO_DIEN_KY_NANG[key] ?? { mau: "#2B8CEE", nen: "#E4F1FE", icon: "book" as TenIcon };
