import { useEffect, useRef } from "react";
import type { BaoCao, KyNangKetQua } from "../types";
import { ORG } from "./Layout";
import { HIEN_PHAN_TRAM_LO_TRINH } from "./Report";

/**
 * Bản in A4 của báo cáo — KHÔNG phải trang web in ra.
 *
 * Trên màn hình bản này nằm ngoài khung nhìn (để đo được chiều cao); khi in, mọi thứ
 * khác ẩn đi và chỉ bản này hiện. Thiết kế cho máy in trắng đen: chữ đen trên nền
 * trắng, phân cấp bằng cỡ chữ, độ đậm và đường kẻ, không dựa vào màu.
 *
 * Luôn vừa MỘT trang A4: trước khi in, đo chiều cao thật; dài hơn trang thì thu nhỏ
 * cả bản bằng `zoom` (biến --bi-zoom) thay vì để tràn sang trang 2.
 */

const so = (n: number) => String(n).replace(".", ",");

/** Vùng in của A4 với lề 12 mm (khớp @page trong ban-in.css), đổi ra px CSS.
 *  Chừa 2% phòng chữ khi in xuống dòng khác trên màn hình một chút. */
const MM = 96 / 25.4;
const CAO_VUNG_IN = (297 - 24) * MM * 0.98;

function DiemNoiBat({ kyNang }: { kyNang: KyNangKetQua[] }) {
  if (kyNang.some((k) => k.diem === null)) return null;
  const tiLe = (k: KyNangKetQua) => (k.diem ?? 0) / k.toiDa;
  const cao = kyNang.reduce((a, b) => (tiLe(b) > tiLe(a) ? b : a));
  const thap = kyNang.reduce((a, b) => (tiLe(b) < tiLe(a) ? b : a));
  if (tiLe(cao) === tiLe(thap)) {
    return <p className="bi-noi-bat">Cả 4 kỹ năng cùng đạt {Math.round(tiLe(cao) * 100)}% số điểm.</p>;
  }
  return (
    <p className="bi-noi-bat">
      <b>Điểm mạnh:</b> {cao.ten} {so(cao.diem ?? 0)}/{cao.toiDa}
      <span className="bi-cham">·</span>
      <b>Cần ưu tiên cải thiện:</b> {thap.ten} {so(thap.diem ?? 0)}/{thap.toiDa}
    </p>
  );
}

export default function BanIn({ bc }: { bc: BaoCao }) {
  const ref = useRef<HTMLDivElement>(null);
  const { kyNang, loTrinh, level } = bc;
  const coGoiY = kyNang.some((k) => k.goiY);
  const coLoTrinh = HIEN_PHAN_TRAM_LO_TRINH || Boolean(loTrinh.nhanXet);

  // Thu nhỏ cho vừa một trang. Đo lại mỗi lần in vì dữ liệu hoặc font có thể đã đổi.
  useEffect(() => {
    const vuaTrang = () => {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty("--bi-zoom", "1");
      const cao = el.scrollHeight;
      el.style.setProperty("--bi-zoom", String(cao > CAO_VUNG_IN ? Math.floor((CAO_VUNG_IN / cao) * 1000) / 1000 : 1));
    };
    vuaTrang();
    window.addEventListener("beforeprint", vuaTrang);
    return () => window.removeEventListener("beforeprint", vuaTrang);
  }, [bc]);

  return (
    <div ref={ref} className="bi" aria-hidden="true">
      {/* Đầu trang */}
      <header className="bi-dau">
        <img src="/images/ismart-logo.png" alt="" className="bi-logo" />
        <div className="bi-tieu-de">
          <h1>Báo cáo đánh giá năng lực học viên</h1>
          <p>Bài kiểm tra xếp lớp đầu vào · Chương trình iLEAD</p>
        </div>
      </header>

      {/* Thông tin học sinh */}
      <table className="bi-thong-tin">
        <tbody>
          <tr>
            <th>Học viên</th>
            <td className="bi-ten">{bc.hoTen}</td>
            <th>Mã học sinh</th>
            <td>{bc.maHocSinh}</td>
          </tr>
          <tr>
            <th>Thông tin</th>
            <td>{bc.lop || "—"}</td>
            <th>Ngày chấm</th>
            <td>{bc.ngayCham || "—"}</td>
          </tr>
          <tr>
            <th>Giáo viên chấm</th>
            <td colSpan={3}>{bc.giaoVien || "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* Kết quả chính */}
      <section className="bi-ket-qua">
        <div className="bi-o">
          <span className="bi-nhan">Lớp phù hợp</span>
          <strong className="bi-lop">{level?.lop || level?.ten || "Chưa xếp"}</strong>
        </div>
        <div className="bi-o">
          <span className="bi-nhan">Tổng điểm</span>
          <strong className="bi-tong">
            {bc.tongDiem === null ? "—" : so(bc.tongDiem)}
            <small> / {bc.tongToiDa}</small>
          </strong>
        </div>
        <div className="bi-o bi-o-rong">
          {level?.lop && level.ten ? (
            <p className="bi-muc-tieu">
              Mục tiêu đầu ra: <b>{level.ten}</b>
            </p>
          ) : null}
          <p className="bi-mo-ta">
            {level?.moTa ||
              (bc.tongDiem === null
                ? "Chưa đủ điểm cả 4 kỹ năng nên chưa xếp lớp."
                : "")}
          </p>
        </div>
      </section>

      {bc.thangLevel.length ? (
        <div className="bi-thang" aria-hidden="true">
          {bc.thangLevel.map((m, i) => {
            const den = (bc.thangLevel[i + 1]?.tu ?? bc.tongToiDa + 1) - 1;
            const dat = m.ten === level?.ten;
            return (
              <span key={m.ten} className={dat ? "is-dat" : ""}>
                {m.lop || m.ten}
                {/* Giáo viên xếp khác tổng điểm: ghi khoảng điểm cạnh lớp sẽ mâu thuẫn với tổng. */}
                {bc.lopKhacGoiY ? null : (
                  <small>
                    {m.tu}–{Math.min(den, bc.tongToiDa)} điểm
                  </small>
                )}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Bốn kỹ năng */}
      <h2 className="bi-muc">Kết quả từng kỹ năng</h2>
      <table className="bi-ky-nang">
        <colgroup>
          <col style={{ width: "17%" }} />
          <col style={{ width: "19%" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Kỹ năng</th>
            <th>Điểm</th>
            <th>Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          {kyNang.map((k) => (
            <tr key={k.key}>
              <td>
                <b>{k.ten}</b>
                <span className="bi-phu">{k.tenViet}</span>
              </td>
              <td>
                <span className="bi-diem">
                  <b>{k.diem === null ? "—" : so(k.diem)}</b>/{k.toiDa}
                </span>
                <span className="bi-vach">
                  <span style={{ width: `${k.diem === null ? 0 : (k.diem / k.toiDa) * 100}%` }} />
                </span>
              </td>
              <td>
                {k.moTa || "Giáo viên đang cập nhật nhận xét."}
                {k.moTaRieng ? (
                  <span className="bi-rieng">
                    <b>Nhận xét riêng của giáo viên:</b> {k.moTaRieng}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <DiemNoiBat kyNang={kyNang} />

      {/* Lộ trình và gợi ý */}
      {coLoTrinh || coGoiY ? (
        <div className={`bi-hai-cot${coLoTrinh && coGoiY ? "" : " is-mot"}`}>
          {coLoTrinh ? (
            <section>
              <h2 className="bi-muc">Lộ trình học tập</h2>
              {HIEN_PHAN_TRAM_LO_TRINH ? (
                <p className="bi-doan">
                  Kiến thức cơ bản <b>{loTrinh.phanTramCoBan}</b> · Kiến thức nâng cao{" "}
                  <b>{loTrinh.phanTramNangCao}</b>
                </p>
              ) : null}
              {loTrinh.nhanXet ? <p className="bi-doan">{loTrinh.nhanXet}</p> : null}
            </section>
          ) : null}
          {coGoiY ? (
            <section>
              <h2 className="bi-muc">Gợi ý luyện tập ở nhà</h2>
              <ul className="bi-goi-y">
                {kyNang.map((k) =>
                  k.goiY ? (
                    <li key={k.key}>
                      <b>{k.ten}:</b> {k.goiY}
                    </li>
                  ) : null
                )}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* Ký tên */}
      <section className="bi-ky">
        <div>
          <p className="bi-ky-vai">Giáo viên chấm</p>
          <p className="bi-ky-ten">{bc.giaoVien}</p>
        </div>
        <div>
          <p className="bi-ky-ngay">{ORG.diaDiem}, ngày ..... tháng ..... năm 20.....</p>
          <p className="bi-ky-vai">{ORG.hoiDong}</p>
        </div>
      </section>

      <footer className="bi-chan">
        {ORG.ten} · Hotline {ORG.hotline}
        {ORG.website ? ` · ${ORG.website}` : ""}
      </footer>
    </div>
  );
}
