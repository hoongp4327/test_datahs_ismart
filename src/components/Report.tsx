import React, { useState } from "react";
import type { BaoCao, KyNangKetQua } from "../types";
import { ORG } from "./Layout";

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
      <span className="avatar-badge-status" title="Học viên tích cực">
        ★
      </span>
    </div>
  );
}

/** Hiển thị điểm: số nguyên thì không kèm ",0"; chưa có điểm thì "—". */
function hienDiem(d: number | null) {
  if (d === null) return "—";
  return Number.isInteger(d) ? String(d) : d.toFixed(1).replace(".", ",");
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

function Meta({ k, v, icon }: { k: string; v?: string; icon?: string }) {
  if (!v) return null;
  return (
    <div className="meta-item">
      {icon && <span className="meta-icon">{icon}</span>}
      <span className="k">{k}:</span>
      <span className="v">{v}</span>
    </div>
  );
}

function Card({
  num,
  title,
  subtitle,
  children,
  className = "",
}: {
  num: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <span className="num">{num}</span>
        <div className="card-head-titles">
          <h2>{title}</h2>
          {subtitle && <span className="card-sub">{subtitle}</span>}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

/* --------------------------- Giao diện từng kỹ năng --------------------------- */

const GIAO_DIEN_KY_NANG: Record<string, { icon: string; mau: string; domain: string }> = {
  listening: { icon: "🎧", mau: "#2563eb", domain: "domain-nghe" },
  reading: { icon: "📖", mau: "#7c3aed", domain: "domain-doc" },
  writing: { icon: "✍️", mau: "#d97706", domain: "domain-viet" },
  speaking: { icon: "🗣️", mau: "#059669", domain: "domain-noi" },
};
const giaoDien = (key: string) =>
  GIAO_DIEN_KY_NANG[key] ?? { icon: "✨", mau: "#2563eb", domain: "domain-nghe" };

/* --------------------------- Biểu đồ 4 kỹ năng --------------------------- */

/**
 * Radar 4 trục + thanh đo ngang. Chỉ vẽ khi có đủ điểm cả 4 kỹ năng: biểu đồ thiếu
 * một trục sẽ trông như kỹ năng đó bằng 0, phụ huynh sẽ hiểu sai.
 */
function SkillsDashboardChart({ kyNang, diemToiDa }: { kyNang: KyNangKetQua[]; diemToiDa: number }) {
  const cx = 175;
  const cy = 135;
  const maxR = 74;
  const r = kyNang.map((k) => ((k.diem ?? 0) / diemToiDa) * maxR);
  const [top, right, bottom, left] = kyNang;
  const polyPoints = `${cx},${cy - r[0]} ${cx + r[1]},${cy} ${cx},${cy + r[2]} ${cx - r[3]},${cy}`;
  const nhan = (k: KyNangKetQua) => `${giaoDien(k.key).icon} ${k.ten} (${hienDiem(k.diem)})`;

  return (
    <div className="skills-dashboard-box">
      <div className="skills-box-header">
        <div className="skills-box-title">
          <span className="skills-box-icon">📊</span>
          <span>Phân tích Năng lực 4 Kỹ năng Tiếng Anh</span>
        </div>
        <div className="chart-scale-pill">Thang điểm 0–{diemToiDa}</div>
      </div>

      <div className="skills-dual-view">
        <div className="radar-col">
          <svg viewBox="0 0 350 270" className="radar-svg" role="img" aria-label="Biểu đồ đa giác 4 kỹ năng">
            {[0.25, 0.5, 0.75, 1].map((tiLe) => {
              const rr = tiLe * maxR;
              return (
                <polygon
                  key={tiLe}
                  points={`${cx},${cy - rr} ${cx + rr},${cy} ${cx},${cy + rr} ${cx - rr},${cy}`}
                  className="radar-grid-ring"
                />
              );
            })}

            <line x1={cx - maxR - 8} y1={cy} x2={cx + maxR + 8} y2={cy} className="radar-axis-line" />
            <line x1={cx} y1={cy - maxR - 8} x2={cx} y2={cy + maxR + 8} className="radar-axis-line" />

            <polygon points={polyPoints} className="radar-polygon-fill" />
            <polygon points={polyPoints} className="radar-polygon-stroke" />

            <circle cx={cx} cy={cy - r[0]} r="4.5" className="radar-point point-top" />
            <circle cx={cx + r[1]} cy={cy} r="4.5" className="radar-point point-right" />
            <circle cx={cx} cy={cy + r[2]} r="4.5" className="radar-point point-bottom" />
            <circle cx={cx - r[3]} cy={cy} r="4.5" className="radar-point point-left" />

            <text x={cx} y={cy - maxR - 16} textAnchor="middle" className="radar-label label-top">
              {nhan(top)}
            </text>
            <text x={cx + maxR + 12} y={cy + 4} textAnchor="start" className="radar-label label-right">
              {nhan(right)}
            </text>
            <text x={cx} y={cy + maxR + 24} textAnchor="middle" className="radar-label label-bottom">
              {nhan(bottom)}
            </text>
            <text x={cx - maxR - 12} y={cy + 4} textAnchor="end" className="radar-label label-left">
              {nhan(left)}
            </text>
          </svg>
          <div className="radar-caption">Mô hình cân bằng năng lực ngoại ngữ</div>
        </div>

        <div className="gauges-col">
          {kyNang.map((k) => (
            <div className="skill-gauge-row" key={k.key}>
              <div className="skill-gauge-header">
                <div className="skill-gauge-name">
                  <span className="skill-gauge-icon">{giaoDien(k.key).icon}</span>
                  <strong>{k.ten}</strong>
                  <span className="skill-gauge-viet">{k.tenViet}</span>
                </div>
                <div className="skill-gauge-score-wrap">
                  <span className="skill-gauge-score">{hienDiem(k.diem)}</span>
                  <span className="skill-gauge-max">/{diemToiDa}</span>
                </div>
              </div>
              <div className="skill-gauge-track">
                <div
                  className="skill-gauge-bar"
                  style={{
                    width: `${((k.diem ?? 0) / diemToiDa) * 100}%`,
                    backgroundColor: giaoDien(k.key).mau,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  const { kyNang, loTrinh, level } = bc;
  const duDiem = bc.tongDiem !== null;
  const coGoiY = kyNang.some((k) => k.goiY);
  const tenLevel = level?.ten || "Đang cập nhật";

  return (
    <>
      <div className="report-title">
        <div className="report-pretitle">{ORG.ten.toUpperCase()}</div>
        <h1>Báo Cáo Đánh Giá Năng Lực Học Viên</h1>
        <div className="rule-solid" />
      </div>

      {/* Thông tin học sinh */}
      <section className="card student-card">
        <div className="card-body">
          <div className="student">
            <StudentAvatar name={bc.hoTen} code={bc.maHocSinh} />

            <div className="student-info-main">
              <div className="student-name-row">
                <div className="student-name">{bc.hoTen}</div>
                <span className={`grade-tag ${level ? "g-b" : "g-c"}`}>Level {tenLevel}</span>
              </div>

              <div className="meta-grid">
                <Meta icon="🆔" k="Mã học sinh" v={bc.maHocSinh} />
                <Meta icon="🏫" k="Lớp" v={bc.lop} />
                <Meta icon="👩‍🏫" k="Giáo viên" v={bc.giaoVien} />
                <Meta icon="🗓️" k="Ngày chấm" v={bc.ngayCham} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="report-dashboard-grid">
        {/* CỘT TRÁI: Kết quả 4 kỹ năng */}
        <div className="dashboard-col-left">
          <Card
            num="I"
            title="Kết quả học tập"
            subtitle={`Điểm 4 kỹ năng Listening, Reading, Writing, Speaking — thang 0–${bc.diemToiDa} mỗi kỹ năng`}
          >
            <div className="grade-highlight-box-solid">
              <div className="grade-left">
                <span className="k">Level tương ứng:</span>
                <span className="badge g-b">{tenLevel}</span>
              </div>
              <div className="grade-right">
                <span className="grade-status-pill">
                  Tổng điểm:{" "}
                  <strong>
                    {duDiem ? hienDiem(bc.tongDiem) : "—"}/{bc.tongToiDa}
                  </strong>
                </span>
              </div>
            </div>

            {level?.moTa ? (
              <div className="quote-box-solid">
                <span className="quote-icon">🎓</span>
                <p className="quote">{level.moTa}</p>
              </div>
            ) : null}

            {duDiem ? (
              <SkillsDashboardChart kyNang={kyNang} diemToiDa={bc.diemToiDa} />
            ) : (
              <div className="skills-missing-note">
                Chưa đủ điểm cả 4 kỹ năng nên chưa xếp Level và chưa vẽ biểu đồ. Trung tâm sẽ cập
                nhật sớm.
              </div>
            )}

            <div className="sub-title">Nhận xét từng kỹ năng</div>
            <div className="detail-list">
              {kyNang.map((k) => (
                <div className="detail-solid" key={k.key}>
                  <div className="detail-header">
                    <h3>
                      {giaoDien(k.key).icon} {k.ten}
                      <span className="detail-viet"> · {k.tenViet}</span>
                    </h3>
                    <span className="detail-score-badge">
                      Điểm: <strong>{hienDiem(k.diem)}</strong>/{bc.diemToiDa}
                    </span>
                  </div>
                  <p>{k.moTa || "Giáo viên đang cập nhật nhận xét."}</p>
                  {k.moTaRieng ? (
                    <div className="mo-ta-rieng">
                      <span className="mo-ta-rieng-label">Nhận xét riêng của giáo viên</span>
                      <p>{k.moTaRieng}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* CỘT PHẢI: Lộ trình & gợi ý luyện tập */}
        <div className="dashboard-col-right">
          <Card
            num="II"
            title="Lộ trình học tập"
            subtitle="Định hướng cá nhân hoá và gợi ý luyện tập cho từng kỹ năng"
          >
            <RoadmapVisual
              phanTramCoBan={loTrinh.phanTramCoBan}
              phanTramNangCao={loTrinh.phanTramNangCao}
            />

            {loTrinh.nhanXet ? (
              <div className="quote-box-solid">
                <span className="quote-icon">🎯</span>
                <p className="quote">{loTrinh.nhanXet}</p>
              </div>
            ) : null}

            {coGoiY ? (
              <>
                <div className="sub-title">Gợi ý luyện tập 4 kỹ năng</div>
                <div className="skills-stack">
                  {kyNang.map(
                    (k) =>
                      k.goiY && (
                        <div className={`skill-card-solid ${giaoDien(k.key).domain}`} key={k.key}>
                          <div className="skill-card-head-solid">
                            <span className="skill-icon">{giaoDien(k.key).icon}</span>
                            <h4>
                              {k.ten} · {k.tenViet}
                            </h4>
                          </div>
                          <p className="skill-card-text">{k.goiY}</p>
                        </div>
                      )
                  )}
                </div>
              </>
            ) : null}
          </Card>

          <div className="sign-card-solid">
            {bc.ngayCham ? <div className="date">{dongKyTen(bc.ngayCham)}</div> : null}
            <div className="org-role">{ORG.hoiDong}</div>
            <div className="org-name">{ORG.ten}</div>
          </div>
        </div>
      </div>
    </>
  );
}
