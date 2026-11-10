/**
 * Màu của 4 kỹ năng — lấy từ bảng màu chính thức của iSmart.
 *
 * Cam (#E8501B) dành cho đa giác điểm của học sinh trên radar, vì đó là chuỗi dữ liệu
 * chính và cam là màu ưu tiên số 1 cho biểu đồ. Xanh đậm (#1B3A6B) là nền của khối
 * biểu đồ nên không dùng cho kỹ năng. 4 kỹ năng nhận 4 màu còn lại.
 *
 * `chu`: màu chữ đặt trên nền màu kỹ năng — chữ trắng trên xanh da trời / xanh lá /
 * vàng không đủ tương phản nên dùng xanh đậm.
 *
 * `tenToi`: màu khi viết CHỮ trên nền xanh đậm của khối biểu đồ. Cam chuẩn trên nền đó
 * chỉ đạt tương phản ~2,9:1 nên chữ cam dùng bản sáng hơn; chấm và nét vẫn dùng màu chuẩn.
 */
export const GIAO_DIEN_KY_NANG: Record<string, { mau: string; chu: string; tenToi: string; kyHieu: string }> = {
  listening: { mau: "#4AACCE", chu: "#1B3A6B", tenToi: "#4AACCE", kyHieu: "L" },
  reading: { mau: "#7AB648", chu: "#1B3A6B", tenToi: "#7AB648", kyHieu: "R" },
  writing: { mau: "#F5A623", chu: "#1B3A6B", tenToi: "#F5A623", kyHieu: "W" },
  speaking: { mau: "#E8501B", chu: "#FFFFFF", tenToi: "#FF8A5C", kyHieu: "S" },
};

export const giaoDienKyNang = (key: string) =>
  GIAO_DIEN_KY_NANG[key] ?? { mau: "#4AACCE", chu: "#1B3A6B", tenToi: "#4AACCE", kyHieu: "?" };
