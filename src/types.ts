import type { buildReport } from "../shared/bao-cao";

/**
 * Kiểu báo cáo lấy thẳng từ hàm server dựng ra (shared/bao-cao.ts), nên thêm hay
 * đổi trường ở server thì frontend tự biết — không còn hai bản định nghĩa lệch nhau.
 */
export type BaoCao = ReturnType<typeof buildReport>;
export type KyNangKetQua = BaoCao["kyNang"][number];
