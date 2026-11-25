import { KY_NANG, TONG_TOI_DA, xepLop, type Row } from "../../shared/bao-cao";

const hienSo = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/**
 * Ô xếp lớp cuối cùng: hệ thống gợi ý theo tổng điểm, giáo viên giữ hoặc bấm lớp khác.
 * `chon` trống = giáo viên chưa bấm gì, lúc lưu sẽ chốt đúng lớp gợi ý đang hiện.
 * Dùng chung cho tab Chờ chấm và tab Học sinh.
 */
export default function XepLop({
  thangLevel,
  tong,
  diem,
  chon,
  onChon,
  coTheGhi,
}: {
  thangLevel: Row[];
  tong: number | null;
  /** Điểm từng kỹ năng, để giáo viên cân nhắc ngay tại chỗ. */
  diem: Record<string, number | null>;
  chon: string;
  onChon: (lop: string) => void;
  /** Code.gs trên sheet đã lưu được cột lop_xep. */
  coTheGhi: boolean;
}) {
  if (tong === null) return <p className="qt-nho">Chấm đủ 4 kỹ năng để xếp lớp.</p>;

  const xep = xepLop(thangLevel, tong, coTheGhi ? chon : "");
  const goiY = xep.goiY?.lop_xep ?? "";
  const cacLop = thangLevel.filter((r) => r.lop_xep);

  return (
    <div className="qt-xl">
      <p className="qt-xl-diem">
        {KY_NANG.map((k) => {
          const d = diem[k.key];
          return (
            <span key={k.key}>
              {k.ten} <b>{d == null ? "—" : hienSo(d)}</b>/{k.toiDa}
            </span>
          );
        })}
        <span>
          Tổng <b>{hienSo(tong)}</b>/{TONG_TOI_DA}
        </span>
      </p>

      <div className="qt-xl-lop" role="group" aria-label="Lớp xếp cuối cùng">
        {cacLop.map((r) => (
          <button
            type="button"
            key={r.lop_xep}
            aria-pressed={r === xep.chot}
            className={r === xep.chot ? "is-chon" : ""}
            disabled={!coTheGhi}
            onClick={() => onChon(r.lop_xep)}
          >
            {r.lop_xep}
            {r === xep.goiY ? <small>Hệ thống gợi ý</small> : null}
          </button>
        ))}
      </div>

      {!coTheGhi ? (
        <p className="qt-o-loi">
          Chưa chọn lớp được: cần cập nhật Code.gs trên Google Sheet rồi triển khai phiên bản mới. Tạm thời báo cáo
          dùng lớp gợi ý.
        </p>
      ) : xep.khacGoiY ? (
        <p className="qt-xl-ghi-chu is-khac">
          Giáo viên xếp <b>{xep.chot?.lop_xep}</b>, khác gợi ý <b>{goiY}</b> theo tổng điểm. Báo cáo sẽ hiện{" "}
          {xep.chot?.lop_xep}.{" "}
          <button type="button" className="qt-xl-ve" onClick={() => onChon(goiY)}>
            Dùng lớp gợi ý
          </button>
        </p>
      ) : xep.daChot ? (
        <p className="qt-xl-ghi-chu">Giáo viên chọn {goiY}, trùng với gợi ý.</p>
      ) : (
        <p className="qt-xl-ghi-chu">
          Đang theo gợi ý {goiY}. Giữ nguyên nếu đồng ý, hoặc bấm lớp khác nếu thấy phù hợp hơn.
        </p>
      )}
    </div>
  );
}
