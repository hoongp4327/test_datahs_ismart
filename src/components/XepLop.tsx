import { KY_NANG, cacLevel, xepLop, type DiemKyNang, type Row } from "../../shared/bao-cao";

const hienSo = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/**
 * Ô xếp lớp cuối cùng: hệ thống gợi ý theo kỹ năng có mức thấp nhất, giáo viên giữ hoặc bấm lớp khác.
 * `chon` trống = giáo viên chưa bấm gì, lúc lưu sẽ chốt đúng lớp gợi ý đang hiện.
 * Dùng chung cho tab Chờ chấm và tab Học sinh.
 */
export default function XepLop({
  thangLevel,
  moTa,
  diem,
  chon,
  onChon,
  coTheGhi,
}: {
  thangLevel: Row[];
  moTa: Row[];
  /** Điểm từng kỹ năng, để giáo viên cân nhắc ngay tại chỗ. */
  diem: DiemKyNang;
  chon: string;
  onChon: (lop: string) => void;
  /** Code.gs trên sheet đã lưu được cột lop_xep. */
  coTheGhi: boolean;
}) {
  if (KY_NANG.some((k) => diem[k.key] == null)) return <p className="qt-nho">Chấm đủ 4 kỹ năng để xếp lớp.</p>;

  const xep = xepLop({ thangLevel, moTa }, diem, coTheGhi ? chon : "");
  const goiY = xep.goiY?.lop_xep ?? "";
  const cacLop = cacLevel(thangLevel).filter((r) => r.lop_xep);

  return (
    <div className="qt-xl">
      <p className="qt-xl-diem">
        {KY_NANG.map((k) => {
          const d = diem[k.key];
          return (
            <span key={k.key} className={xep.kyNangThap.includes(k.ten) ? "is-thap" : ""}>
              {k.ten} <b>{d == null ? "—" : hienSo(d)}</b>/{k.toiDa}
              <small>{xep.lopKyNang[k.key] || "—"}</small>
            </span>
          );
        })}
      </p>
      <p className="qt-xl-ghi-chu">
        {!goiY
          ? "Chưa gợi ý được lớp: tab MoTaKyNang trên sheet thiếu khoảng điểm của một kỹ năng. Giáo viên vẫn chọn lớp được."
          : xep.kyNangThap.length
            ? `Gợi ý ${goiY} theo kỹ năng thấp nhất: ${xep.kyNangThap.join(", ")}.`
            : `Cả 4 kỹ năng cùng ở mức ${goiY}.`}
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
      ) : !goiY ? null : xep.khacGoiY ? (
        <p className="qt-xl-ghi-chu is-khac">
          Giáo viên xếp <b>{xep.chot?.lop_xep}</b>, khác gợi ý <b>{goiY}</b>. Báo cáo sẽ hiện{" "}
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
