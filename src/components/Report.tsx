import { useState } from "react";
import type { BaoCao, KyNangKetQua } from "../types";
import Icon from "./Icon";
import { ORG } from "./Layout";
import SkillHero from "./SkillHero";
import { giaoDienKyNang } from "./kyNangGiaoDien";
import { hienSoDem, useDemSo, useHienKhiCuon } from "./motion";

/* ---------------------------------- Tiện ích ---------------------------------- */

const so = (n: number) => String(n).replace(".", ",");

function chuCaiDau(ten: string) {
  const p = String(ten ?? "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p.length > 1 ? p[p.length - 2][0] : "") + p[p.length - 1][0]).toUpperCase();
}

/** Đoán ảnh đại diện theo tên cuối thường gặp của nữ; không chắc thì dùng ảnh nam. */
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
    <span className="bc-avatar bc-avatar-chu" aria-hidden="true">
      {chuCaiDau(ten)}
    </span>
  ) : (
    <img src={anhDaiDien(ten)} alt="" className="bc-avatar" onError={() => setLoi(true)} />
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
    <article className={`bc-skill is-${k.key} bc-hien-dan`} style={{ ["--tre" as string]: `${thuTu * 70}ms` }}>
      <img src={`/images/bao-cao/${k.key}.webp`} className="bc-skill-visual" alt="" aria-hidden="true" />
      <div className="bc-card-head">
        <span className="bc-skill-icon">
          <Icon ten={gd.icon} size={25} />
        </span>
        <div className="bc-skill-heading">
          <h3>{k.ten}</h3>
          <p>{k.tenViet}</p>
        </div>
        <div className="bc-skill-score">
          <span>{hienSoDem(dangDem, k.diem)}</span>
          <small>/{diemToiDa}</small>
        </div>
      </div>

      <div
        className="bc-progress"
        role="meter"
        aria-label={k.ten}
        aria-valuemin={0}
        aria-valuemax={diemToiDa}
        aria-valuenow={k.diem ?? undefined}
      >
        <span style={{ ["--ti-le" as string]: String(tiLe) }} />
      </div>

      <p className={`bc-feedback${k.moTa ? "" : " is-trong"}`}>{k.moTa || "Giáo viên đang cập nhật nhận xét."}</p>

      {k.moTaRieng ? (
        <div className="bc-rieng">
          <span>Nhận xét riêng của giáo viên</span>
          <p>{k.moTaRieng}</p>
        </div>
      ) : null}
    </article>
  );
}

/** Kỹ năng điểm cao nhất / thấp nhất — chỉ khi đủ 4 điểm. */
function DiemNoiBat({ kyNang, diemToiDa }: { kyNang: KyNangKetQua[]; diemToiDa: number }) {
  if (kyNang.some((k) => k.diem === null)) return null;
  const cao = kyNang.reduce((a, b) => ((b.diem ?? 0) > (a.diem ?? 0) ? b : a));
  const thap = kyNang.reduce((a, b) => ((b.diem ?? 0) < (a.diem ?? 0) ? b : a));

  if (cao.diem === thap.diem) {
    return (
      <section className="bc-insights is-mot" aria-label="Điểm nổi bật">
        <div className="bc-insight">
          <span className="bc-badge" aria-hidden="true">
            ★
          </span>
          <div>
            <small>Đồng đều</small>
            <strong>
              Cả 4 kỹ năng cùng đạt {so(cao.diem ?? 0)}/{diemToiDa}
            </strong>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bc-insights" aria-label="Điểm nổi bật">
      <div className="bc-insight">
        <span className="bc-badge" aria-hidden="true">
          ★
        </span>
        <div>
          <small>Điểm cao nhất</small>
          <strong>
            {cao.ten} · {so(cao.diem ?? 0)}/{diemToiDa} — kỹ năng nổi bật trong bài đánh giá
          </strong>
        </div>
      </div>
      <div className="bc-insight is-cam">
        <span className="bc-badge" aria-hidden="true">
          ↗
        </span>
        <div>
          <small>Ưu tiên cải thiện</small>
          <strong>
            {thap.ten} · {so(thap.diem ?? 0)}/{diemToiDa} — kỹ năng có điểm thấp nhất
          </strong>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- Báo cáo ---------------------------------- */

export default function Report({ bc }: { bc: BaoCao }) {
  const { kyNang, loTrinh } = bc;
  const coGoiY = kyNang.some((k) => k.goiY);
  const [refKyNang, hienKyNang] = useHienKhiCuon<HTMLElement>();
  const [refDuoi, hienDuoi] = useHienKhiCuon<HTMLDivElement>();

  return (
    <>
      {/* Tiêu đề */}
      <section className="bc-heading" aria-label="Tiêu đề báo cáo">
        <span className="bc-dot-matrix" aria-hidden="true" />
        <span className="bc-star is-a" aria-hidden="true">
          ✦
        </span>
        <span className="bc-star is-b" aria-hidden="true">
          ✦
        </span>
        <img className="bc-title-art" src="/images/bao-cao/mu-tot-nghiep.webp" alt="" aria-hidden="true" />
        <div className="bc-overline">iSMART EDUCATION</div>
        <h1>
          <span>Báo cáo đánh giá</span>
          <span className="bc-grad">Năng lực học viên</span>
        </h1>
        <div className="bc-underline" aria-hidden="true" />
      </section>

      {/* Học sinh */}
      <section className="bc-student bc-vao" aria-label="Thông tin học viên">
        <div className="bc-student-person">
          <AnhDaiDien ten={bc.hoTen} />
          <div>
            <h2>{bc.hoTen}</h2>
            <p>Mã học sinh: {bc.maHocSinh}</p>
          </div>
        </div>
        <dl className="bc-fact-list">
          {[
            { icon: "layers" as const, k: "Lớp", v: bc.lop },
            { icon: "user" as const, k: "Giáo viên", v: bc.giaoVien },
            { icon: "calendar" as const, k: "Ngày chấm", v: bc.ngayCham },
          ].map((m) =>
            m.v ? (
              <div key={m.k} className="bc-fact">
                <span className="bc-fact-icon">
                  <Icon ten={m.icon} size={28} net={1.7} />
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

      <div className="bc-vao" style={{ ["--tre" as string]: "80ms" }}>
        <SkillHero bc={bc} />
      </div>

      {/* Nhận xét từng kỹ năng */}
      <h2 className="bc-section-title">
        <span>Nhận xét từng kỹ năng</span>
      </h2>
      <section ref={refKyNang} className={`bc-cards${hienKyNang ? " da-hien" : ""}`} aria-label="Nhận xét kỹ năng">
        {kyNang.map((k, i) => (
          <TheKyNang key={k.key} k={k} diemToiDa={bc.diemToiDa} daHien={hienKyNang} thuTu={i} />
        ))}
      </section>

      <DiemNoiBat kyNang={kyNang} diemToiDa={bc.diemToiDa} />

      {/* Lộ trình + gợi ý */}
      <div ref={refDuoi} className={`bc-hai-cot${hienDuoi ? " da-hien" : ""}`}>
        <section className="bc-glass bc-hien-dan" style={{ ["--tre" as string]: "0ms" }}>
          <h2 className="bc-glass-title">Lộ trình học tập</h2>
          <div className="bc-lo-trinh">
            <div className="bc-lo-trinh-o">
              <b>{loTrinh.phanTramCoBan}</b>
              <span>Kiến thức cơ bản</span>
            </div>
            <span className="bc-lo-trinh-cong" aria-hidden="true">
              +
            </span>
            <div className="bc-lo-trinh-o is-nang-cao">
              <b>{loTrinh.phanTramNangCao}</b>
              <span>Kiến thức nâng cao</span>
            </div>
          </div>
          {loTrinh.nhanXet ? <p className="bc-doan">{loTrinh.nhanXet}</p> : null}
        </section>

        {coGoiY ? (
          <section className="bc-glass bc-hien-dan" style={{ ["--tre" as string]: "80ms" }}>
            <h2 className="bc-glass-title">Gợi ý luyện tập ở nhà</h2>
            <ul className="bc-goi-y">
              {kyNang.map((k) =>
                k.goiY ? (
                  <li key={k.key} className={`is-${k.key}`}>
                    <span className="bc-skill-icon is-nho">
                      <Icon ten={giaoDienKyNang(k.key).icon} size={18} />
                    </span>
                    <div>
                      <strong>{k.ten}</strong>
                      <p>{k.goiY}</p>
                    </div>
                  </li>
                ) : null
              )}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="bc-footer">
        <span>
          © {new Date().getFullYear()} {ORG.ten} · Hotline {ORG.hotline} · {ORG.website}
        </span>
        <span className="bc-ky-ten">
          {bc.ngayCham ? <>{dongKyTen(bc.ngayCham)} · </> : null}
          <strong>{ORG.hoiDong}</strong>
        </span>
      </footer>
    </>
  );
}
