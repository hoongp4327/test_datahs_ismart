import { useState } from "react";
import type { BaoCao, KyNangKetQua } from "../types";
import { ORG } from "./Layout";
import SkillHero from "./SkillHero";
import { giaoDienKyNang } from "./kyNangGiaoDien";
import { hienSoDem, useDemSo, useHienKhiCuon } from "./motion";
import "./report.css";

/* ---------------------------- Tiện ích & Avatar ---------------------------- */

function initials(name: string) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const last = parts[parts.length - 1][0];
  const first = parts.length > 1 ? parts[parts.length - 2][0] : "";
  return (first + last).toUpperCase();
}

function getStudentAvatarInfo(name: string, code: string): { url: string; isGirl: boolean } {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const lastName = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : "";
  const girlNames = [
    "anh", "chi", "mai", "linh", "dương", "hạ", "ngân", "hân", "my", "trúc",
    "diệp", "yến", "trang", "huyền", "châu", "vy", "lan", "hoa", "phương", "thảo",
    "hương", "ngọc", "tú", "quỳnh", "nhi"
  ];
  const isGirl = girlNames.includes(lastName) || (code ? Number(code.replace(/\D/g, "")) % 2 === 1 : false);
  return {
    url: isGirl ? "/avatars/girl.jpg" : "/avatars/boy.jpg",
    isGirl,
  };
}

function StudentAvatar({ name, code }: { name: string; code: string }) {
  const [imgError, setImgError] = useState(false);
  const { url, isGirl } = getStudentAvatarInfo(name, code);
  const mon = initials(name);

  return (
    <div className="student-avatar-wrap">
      {!imgError ? (
        <img
          src={url}
          alt={`Avatar của ${name}`}
          className="student-avatar-img"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`avatar-fallback ${isGirl ? "girl" : "boy"}`}>{mon}</div>
      )}
      <span className="avatar-monogram" title={name}>
        {mon}
      </span>
    </div>
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

function Meta({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="bc-meta">
      <span className="bc-meta-k">{k}</span>
      <span className="bc-meta-v">{v}</span>
    </div>
  );
}

/** Ô ký hiệu kỹ năng (L / R / W / S) — thay emoji, đúng tinh thần icon phẳng của thương hiệu. */
function KyHieu({ k }: { k: KyNangKetQua }) {
  const gd = giaoDienKyNang(k.key);
  return (
    <span className="bc-ky-hieu" style={{ background: gd.mau, color: gd.chu }} aria-hidden="true">
      {gd.kyHieu}
    </span>
  );
}

/* --------------------------- Thẻ chi tiết kỹ năng --------------------------- */

function TheKyNang({
  k,
  diemToiDa,
  daHien,
  thuTu,
}: {
  k: KyNangKetQua;
  diemToiDa: number;
  daHien: boolean;
  thuTu: number;
}) {
  const gd = giaoDienKyNang(k.key);
  // Chỉ đếm khi thẻ đã hiện trên màn hình, để phụ huynh kịp thấy số chạy.
  const dich = k.diem === null ? null : daHien ? k.diem : 0;
  const dangDem = useDemSo(dich, 120 + thuTu * 60, 700);
  const tiLe = k.diem === null ? 0 : k.diem / diemToiDa;

  return (
    <article
      className="bc-the"
      style={{ ["--mau" as string]: gd.mau, ["--tre" as string]: `${thuTu * 60}ms` }}
    >
      <header className="bc-the-dau">
        <KyHieu k={k} />
        <div className="bc-the-ten">
          <h3>{k.ten}</h3>
          <span>{k.tenViet}</span>
        </div>
        <div className="bc-the-diem">
          <span className="bc-the-so">{hienSoDem(dangDem, k.diem)}</span>
          <span className="bc-the-max">/{diemToiDa}</span>
        </div>
      </header>

      <div className="bc-the-thanh" aria-hidden="true">
        <span style={{ ["--ti-le" as string]: String(tiLe) }} />
      </div>

      <p className="bc-the-mo-ta">{k.moTa || "Giáo viên đang cập nhật nhận xét."}</p>

      {k.moTaRieng ? (
        <div className="bc-the-rieng">
          <span>Nhận xét riêng của giáo viên</span>
          <p>{k.moTaRieng}</p>
        </div>
      ) : null}
    </article>
  );
}

/* -------------------------- Biểu đồ Lộ trình -------------------------- */

function RoadmapVisual({
  phanTramCoBan,
  phanTramNangCao,
}: {
  phanTramCoBan: string;
  phanTramNangCao: string;
}) {
  return (
    <div className="roadmap-visual-box">
      <div className="roadmap-stats-row">
        <div className="road-stat-item core">
          <div className="road-stat-header">
            <span className="dot" />
            <span>Kiến thức cơ bản chuẩn</span>
          </div>
          <div className="road-pct">{phanTramCoBan}</div>
          <div className="road-desc">Nắm vững từ vựng & cấu trúc cốt lõi</div>
        </div>

        <div className="road-stat-item advanced">
          <div className="road-stat-header">
            <span className="dot" />
            <span>Kiến thức mở rộng nâng cao</span>
          </div>
          <div className="road-pct">+{phanTramNangCao}</div>
          <div className="road-desc">Bứt phá phản xạ giao tiếp & mở rộng chủ đề</div>
        </div>
      </div>

      <div className="dual-progress-container">
        <div className="dual-progress-bar-solid">
          <div
            className="dual-progress-segment-solid core-seg-solid"
            style={{ width: "75%" }}
            title={`Kiến thức cơ bản: ${phanTramCoBan}`}
          >
            Nền tảng {phanTramCoBan}
          </div>
          <div
            className="dual-progress-segment-solid adv-seg-solid"
            style={{ width: "25%" }}
            title={`Nâng cao: ${phanTramNangCao}`}
          >
            Mở rộng +{phanTramNangCao}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Báo cáo chính ------------------------------ */

export default function Report({ bc }: { bc: BaoCao }) {
  const { kyNang, loTrinh } = bc;
  const coGoiY = kyNang.some((k) => k.goiY);
  const [refKyNang, hienKyNang] = useHienKhiCuon<HTMLElement>();
  const [refDuoi, hienDuoi] = useHienKhiCuon<HTMLDivElement>();

  return (
    <div className="bc-bao-cao">
      <div className="report-title">
        <div className="report-pretitle">{ORG.ten.toUpperCase()}</div>
        <h1>Báo Cáo Đánh Giá Năng Lực Học Viên</h1>
        <div className="rule-solid" />
      </div>

      {/* Thông tin học sinh — gọn một dải, nhường chỗ cho biểu đồ */}
      <section className="bc-hoc-sinh">
        <StudentAvatar name={bc.hoTen} code={bc.maHocSinh} />
        <div className="bc-hoc-sinh-ten">
          <h2>{bc.hoTen}</h2>
          <span>Mã học sinh {bc.maHocSinh}</span>
        </div>
        <div className="bc-hoc-sinh-meta">
          <Meta k="Lớp" v={bc.lop} />
          <Meta k="Giáo viên" v={bc.giaoVien} />
          <Meta k="Ngày chấm" v={bc.ngayCham} />
        </div>
      </section>

      <SkillHero bc={bc} />

      {/* Chi tiết từng kỹ năng */}
      <section ref={refKyNang} className={`bc-khu${hienKyNang ? " is-hien" : ""}`}>
        <h2 className="bc-khu-tieu-de">Nhận xét từng kỹ năng</h2>
        <div className="bc-luoi-the">
          {kyNang.map((k, i) => (
            <TheKyNang key={k.key} k={k} diemToiDa={bc.diemToiDa} daHien={hienKyNang} thuTu={i} />
          ))}
        </div>
      </section>

      {/* Lộ trình + gợi ý luyện tập */}
      <div ref={refDuoi} className={`bc-hang-duoi${hienDuoi ? " is-hien" : ""}`}>
        <section className="bc-khoi bc-reveal" style={{ ["--tre" as string]: "0ms" }}>
          <h2 className="bc-khu-tieu-de">Lộ trình học tập</h2>
          <RoadmapVisual phanTramCoBan={loTrinh.phanTramCoBan} phanTramNangCao={loTrinh.phanTramNangCao} />
          {loTrinh.nhanXet ? <p className="bc-lo-trinh-nx">{loTrinh.nhanXet}</p> : null}
        </section>

        {coGoiY ? (
          <section className="bc-khoi bc-reveal" style={{ ["--tre" as string]: "80ms" }}>
            <h2 className="bc-khu-tieu-de">Gợi ý luyện tập ở nhà</h2>
            <ul className="bc-goi-y">
              {kyNang.map((k) =>
                k.goiY ? (
                  <li key={k.key}>
                    <KyHieu k={k} />
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

      <div className="sign-card-solid">
        {bc.ngayCham ? <div className="date">{dongKyTen(bc.ngayCham)}</div> : null}
        <div className="org-role">{ORG.hoiDong}</div>
        <div className="org-name">{ORG.ten}</div>
        <div className="bc-tagline">Transforming Education</div>
      </div>
    </div>
  );
}
