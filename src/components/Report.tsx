import { useState } from "react";
import type { BaoCao, KyNangKetQua } from "../types";
import Icon from "./Icon";
import { MayBayGiay, ORG } from "./Layout";
import SkillHero from "./SkillHero";
import { giaoDienKyNang } from "./kyNangGiaoDien";
import { hienSoDem, useDemSo, useHienKhiCuon } from "./motion";

/* ---------------------------------- Tiện ích ---------------------------------- */

function chuCaiDau(ten: string) {
  const p = String(ten ?? "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p.length > 1 ? p[p.length - 2][0] : "") + p[p.length - 1][0]).toUpperCase();
}

/** Đoán ảnh đại diện theo tên đệm/tên cuối thường gặp của nữ; không chắc thì dùng ảnh nam. */
const TEN_NU = [
  "anh", "chi", "mai", "linh", "dương", "hạ", "ngân", "hân", "my", "trúc", "diệp", "yến",
  "trang", "huyền", "châu", "vy", "lan", "hoa", "phương", "thảo", "hương", "ngọc", "quỳnh", "nhi",
];
function anhDaiDien(ten: string) {
  const cuoi = String(ten ?? "").trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  return TEN_NU.includes(cuoi) ? "/avatars/girl.jpg" : "/avatars/boy.jpg";
}

function AnhDaiDien({ ten }: { ten: string }) {
  const [loi, setLoi] = useState(false);
  return loi ? (
    <span className="avatar avatar-chu" aria-hidden="true">
      {chuCaiDau(ten)}
    </span>
  ) : (
    <img src={anhDaiDien(ten)} alt="" className="avatar" onError={() => setLoi(true)} />
  );
}

/**
 * "05/11/2026" hoặc "2026-11-05" → "Hà Nội, ngày 5 tháng 11 năm 2026".
 * Không nhận ra định dạng thì trả nguyên văn để không hiện sai ngày.
 */
function dongKyTen(ngayCham: string) {
  const s = String(ngayCham ?? "").trim();
  if (!s) return "";
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const [d, m, y] = dmy ? [dmy[1], dmy[2], dmy[3]] : ymd ? [ymd[3], ymd[2], ymd[1]] : [];
  if (!d) return `Ngày chấm: ${s}`;
  return `${ORG.diaDiem}, ngày ${Number(d)} tháng ${Number(m)} năm ${y}`;
}

/* --------------------------------- Thẻ kỹ năng --------------------------------- */

function TheKyNang({ k, diemToiDa, daHien, thuTu }: { k: KyNangKetQua; diemToiDa: number; daHien: boolean; thuTu: number }) {
  const gd = giaoDienKyNang(k.key);
  // Chỉ đếm khi thẻ đã lên màn hình, để phụ huynh kịp thấy số chạy.
  const dangDem = useDemSo(k.diem === null ? null : daHien ? k.diem : 0, thuTu * 70, 700);
  const tiLe = k.diem === null ? 0 : k.diem / diemToiDa;

  return (
    <article className="the-ky-nang" style={{ ["--mau" as string]: gd.mau, ["--tre" as string]: `${thuTu * 70}ms` }}>
      {/* Icon lớn mờ ở góc — trang trí, không mang thông tin */}
      <span className="the-trang-tri" aria-hidden="true">
        <Icon ten={gd.icon} size={96} net={1.5} />
      </span>

      <header className="the-dau">
        <span className="o-icon o-icon-lon" style={{ background: gd.nen, color: gd.mau }}>
          <Icon ten={gd.icon} size={30} />
        </span>
        <div className="the-ten">
          <h3>{k.ten}</h3>
          <span>{k.tenViet}</span>
        </div>
        <div className="the-diem">
          <b style={{ color: gd.mau }}>{hienSoDem(dangDem, k.diem)}</b>
          <span>/{diemToiDa}</span>
        </div>
      </header>

      <div className="the-thanh" aria-hidden="true">
        <span style={{ ["--ti-le" as string]: String(tiLe) }} />
      </div>

      <p className="the-mo-ta">{k.moTa || "Giáo viên đang cập nhật nhận xét."}</p>

      {k.moTaRieng ? (
        <div className="the-rieng">
          <span>Nhận xét riêng của giáo viên</span>
          <p>{k.moTaRieng}</p>
        </div>
      ) : null}
    </article>
  );
}

/* ---------------------------------- Báo cáo ---------------------------------- */

export default function Report({ bc }: { bc: BaoCao }) {
  const { kyNang, loTrinh } = bc;
  const coGoiY = kyNang.some((k) => k.goiY);
  const [refKyNang, hienKyNang] = useHienKhiCuon<HTMLElement>();
  const [refDuoi, hienDuoi] = useHienKhiCuon<HTMLDivElement>();

  return (
    <div className="bao-cao">
      {/* Tiêu đề + linh vật */}
      <header className="tieu-de">
        <MayBayGiay className="tieu-de-may-bay" />
        <span className="eyebrow-pill">iSMART EDUCATION</span>
        <h1>
          <span className="t-navy">Báo cáo đánh giá</span>
          <span className="t-orange">Năng lực học viên</span>
        </h1>
        <svg className="swoosh" viewBox="0 0 120 14" aria-hidden="true">
          <path d="M4 10C34 2 86 2 116 10" />
        </svg>
        <img src="/images/mascot-doc-sach.webp" alt="" className="tieu-de-mascot" />
      </header>

      {/* Học sinh */}
      <section className="the-hoc-sinh vao">
        <AnhDaiDien ten={bc.hoTen} />
        <div className="hs-ten">
          <h2>{bc.hoTen}</h2>
          <span>Mã học sinh: {bc.maHocSinh}</span>
        </div>
        <dl className="hs-meta">
          {[
            { icon: "layers" as const, k: "Lớp", v: bc.lop },
            { icon: "user" as const, k: "Giáo viên", v: bc.giaoVien },
            { icon: "calendar" as const, k: "Ngày chấm", v: bc.ngayCham },
          ].map((m) =>
            m.v ? (
              <div key={m.k} className="hs-meta-muc">
                <span className="hs-meta-icon">
                  <Icon ten={m.icon} size={28} net={1.75} />
                </span>
                <div>
                  <dt>{m.k}</dt>
                  <dd>{m.v}</dd>
                </div>
              </div>
            ) : null
          )}
        </dl>
      </section>

      <div className="vao" style={{ ["--tre" as string]: "80ms" }}>
        <SkillHero bc={bc} />
      </div>

      {/* Nhận xét từng kỹ năng */}
      <section ref={refKyNang} className={`khu${hienKyNang ? " da-hien" : ""}`}>
        <h2 className="khu-tieu-de">Nhận xét từng kỹ năng</h2>
        <div className="luoi-the">
          {kyNang.map((k, i) => (
            <TheKyNang key={k.key} k={k} diemToiDa={bc.diemToiDa} daHien={hienKyNang} thuTu={i} />
          ))}
        </div>
      </section>

      {/* Lộ trình + gợi ý */}
      <div ref={refDuoi} className={`khu hai-cot${hienDuoi ? " da-hien" : ""}`}>
        <section className="the hien-dan" style={{ ["--tre" as string]: "0ms" }}>
          <h2 className="khu-tieu-de">Lộ trình học tập</h2>
          <div className="lo-trinh">
            <div className="lo-trinh-o">
              <b>{loTrinh.phanTramCoBan}</b>
              <span>Kiến thức cơ bản</span>
            </div>
            <span className="lo-trinh-cong" aria-hidden="true">+</span>
            <div className="lo-trinh-o is-nang-cao">
              <b>{loTrinh.phanTramNangCao}</b>
              <span>Kiến thức nâng cao</span>
            </div>
          </div>
          {loTrinh.nhanXet ? <p className="doan">{loTrinh.nhanXet}</p> : null}
        </section>

        {coGoiY ? (
          <section className="the hien-dan" style={{ ["--tre" as string]: "80ms" }}>
            <h2 className="khu-tieu-de">Gợi ý luyện tập ở nhà</h2>
            <ul className="goi-y">
              {kyNang.map((k) => {
                const gd = giaoDienKyNang(k.key);
                return k.goiY ? (
                  <li key={k.key}>
                    <span className="o-icon" style={{ background: gd.nen, color: gd.mau }}>
                      <Icon ten={gd.icon} size={20} />
                    </span>
                    <div>
                      <strong>{k.ten}</strong>
                      <p>{k.goiY}</p>
                    </div>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="ky-ten">
        {bc.ngayCham ? <span>{dongKyTen(bc.ngayCham)}</span> : null}
        <strong>{ORG.hoiDong}</strong>
        <span>{ORG.ten}</span>
      </footer>
    </div>
  );
}
