import React, { useState } from "react";
import type { BaoCao, MucNhanXet } from "../types";
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

function getGradeMeta(hocLuc: string) {
  const letter = String(hocLuc ?? "").trim()[0]?.toUpperCase() || "B";
  const map: Record<string, { cls: string; label: string; score: number }> = {
    A: { cls: "g-a", label: "Xuất sắc", score: 9.2 },
    B: { cls: "g-b", label: "Khá - Tốt", score: 7.8 },
    C: { cls: "g-c", label: "Trung bình", score: 6.2 },
    D: { cls: "g-d", label: "Cần cố gắng", score: 4.8 },
  };
  return map[letter] || { cls: "g-b", label: "Khá", score: 7.5 };
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

/* --------------------------- Biểu đồ 4 kỹ năng Chuyên Nghiệp (Solid) --------------------------- */

/** Biểu đồ mạng nhện (Radar Chart) + Thước đo năng lực 4 kỹ năng dạng Solid */
function SkillsDashboardChart({
  skills,
  hocLuc,
}: {
  skills: MucNhanXet[];
  hocLuc: string;
}) {
  const baseGrade = getGradeMeta(hocLuc);

  const skillMeta: Record<
    string,
    { key: string; icon: string; solidColor: string; defaultOffset: number }
  > = {
    "từ vựng": { key: "tu-vung", icon: "📚", solidColor: "#2563eb", defaultOffset: 0.3 },
    "cấu trúc / ngữ pháp": { key: "ngu-phap", icon: "📐", solidColor: "#7c3aed", defaultOffset: -0.2 },
    "phát âm": { key: "phat-am", icon: "🎙️", solidColor: "#059669", defaultOffset: -0.4 },
    "phản xạ": { key: "phan-xa", icon: "⚡", solidColor: "#d97706", defaultOffset: 0.1 },
  };

  const chartData = skills.map((item) => {
    const rawTitle = item.tieuDe.toLowerCase().trim();
    const meta =
      skillMeta[rawTitle] || {
        key: "khac",
        icon: "✨",
        solidColor: "#2563eb",
        defaultOffset: 0,
      };

    const score =
      item.diem !== undefined && !isNaN(item.diem)
        ? Math.min(10, Math.max(0, item.diem))
        : Math.min(10, Math.max(2, Number((baseGrade.score + meta.defaultOffset).toFixed(1))));

    let levelLabel = "Đạt";
    let levelClass = "badge-c";
    if (score >= 9.0) {
      levelLabel = "Xuất sắc ★";
      levelClass = "badge-a";
    } else if (score >= 7.5) {
      levelLabel = "Tốt";
      levelClass = "badge-b";
    } else if (score >= 6.0) {
      levelLabel = "Khá";
      levelClass = "badge-c";
    } else {
      levelLabel = "Cần luyện thêm";
      levelClass = "badge-d";
    }

    return {
      title: item.tieuDe,
      score,
      meta,
      levelLabel,
      levelClass,
    };
  });

  if (!chartData.length) return null;

  // Tọa độ Radar 4 trục (Top, Right, Bottom, Left) với không gian đệm rộng rãi
  const cx = 175;
  const cy = 135;
  const maxR = 74;

  // Lấy điểm 4 trục (fallback 0 nếu thiếu)
  const s0 = chartData[0] ? chartData[0].score : 7.5;
  const s1 = chartData[1] ? chartData[1].score : 7.5;
  const s2 = chartData[2] ? chartData[2].score : 7.5;
  const s3 = chartData[3] ? chartData[3].score : 7.5;

  const r0 = (s0 / 10) * maxR;
  const r1 = (s1 / 10) * maxR;
  const r2 = (s2 / 10) * maxR;
  const r3 = (s3 / 10) * maxR;

  const polyPoints = `${cx},${cy - r0} ${cx + r1},${cy} ${cx},${cy + r2} ${cx - r3},${cy}`;

  return (
    <div className="skills-dashboard-box">
      <div className="skills-box-header">
        <div className="skills-box-title">
          <span className="skills-box-icon">📊</span>
          <span>Phân tích Năng lực 4 Kỹ năng Tiếng Anh</span>
        </div>
        <div className="chart-scale-pill">Thang điểm 10.0</div>
      </div>

      <div className="skills-dual-view">
        {/* Phần 1: Biểu đồ Radar 4 trục SVG Solid */}
        <div className="radar-col">
          <svg viewBox="0 0 350 270" className="radar-svg" role="img" aria-label="Biểu đồ đa giác 4 kỹ năng">
            {/* Các vòng mạng nhện đồng tâm (2.5, 5.0, 7.5, 10.0) */}
            {[2.5, 5.0, 7.5, 10.0].map((level) => {
              const r = (level / 10) * maxR;
              return (
                <polygon
                  key={level}
                  points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
                  className="radar-grid-ring"
                />
              );
            })}

            {/* 2 trục vuông góc */}
            <line x1={cx - maxR - 8} y1={cy} x2={cx + maxR + 8} y2={cy} className="radar-axis-line" />
            <line x1={cx} y1={cy - maxR - 8} x2={cx} y2={cy + maxR + 8} className="radar-axis-line" />

            {/* Vùng đa giác điểm của học sinh (Solid) */}
            <polygon points={polyPoints} className="radar-polygon-fill" />
            <polygon points={polyPoints} className="radar-polygon-stroke" />

            {/* 4 điểm mốc (Vertex Points) */}
            <circle cx={cx} cy={cy - r0} r="4.5" className="radar-point point-top" />
            <circle cx={cx + r1} cy={cy} r="4.5" className="radar-point point-right" />
            <circle cx={cx} cy={cy + r2} r="4.5" className="radar-point point-bottom" />
            <circle cx={cx - r3} cy={cy} r="4.5" className="radar-point point-left" />

            {/* Nhãn 4 đỉnh trục */}
            <text x={cx} y={cy - maxR - 16} textAnchor="middle" className="radar-label label-top">
              📚 Từ vựng ({s0.toFixed(1)})
            </text>
            <text x={cx + maxR + 12} y={cy + 4} textAnchor="start" className="radar-label label-right">
              📐 Cấu trúc ({s1.toFixed(1)})
            </text>
            <text x={cx} y={cy + maxR + 24} textAnchor="middle" className="radar-label label-bottom">
              🎙️ Phát âm ({s2.toFixed(1)})
            </text>
            <text x={cx - maxR - 12} y={cy + 4} textAnchor="end" className="radar-label label-left">
              ⚡ Phản xạ ({s3.toFixed(1)})
            </text>
          </svg>
          <div className="radar-caption">Mô hình cân bằng năng lực ngoại ngữ</div>
        </div>

        {/* Phần 2: Thước đo thanh ngang chi tiết với màu Solid */}
        <div className="gauges-col">
          {chartData.map((d) => (
            <div className="skill-gauge-row" key={d.title}>
              <div className="skill-gauge-header">
                <div className="skill-gauge-name">
                  <span className="skill-gauge-icon">{d.meta.icon}</span>
                  <strong>{d.title}</strong>
                </div>
                <div className="skill-gauge-score-wrap">
                  <span className="skill-gauge-score">{d.score.toFixed(1)}</span>
                  <span className="skill-gauge-max">/10</span>
                  <span className={`solid-tag ${d.levelClass}`}>{d.levelLabel}</span>
                </div>
              </div>

              <div className="skill-gauge-track">
                <div
                  className="skill-gauge-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (d.score / 10) * 100))}%`,
                    backgroundColor: d.meta.solidColor,
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

/* ------------------------ Thước đo Tinh thần học tập (Solid) ------------------------ */

function SpiritMeters({
  tinhThan,
}: {
  tinhThan: { soCup: string; gioTay: string; traLoiDung: string };
}) {
  const cups = parseInt(tinhThan.soCup || "0", 10) || 0;
  const hands = parseInt(tinhThan.gioTay || "0", 10) || 0;

  let accuracyPct = 70;
  if (tinhThan.traLoiDung && tinhThan.traLoiDung.includes("/")) {
    const parts = tinhThan.traLoiDung.split("/");
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den > 0) accuracyPct = Math.round((num / den) * 100);
  }

  const cupPct = Math.min(100, Math.round((cups / 80) * 100));

  return (
    <div className="spirit-meters-grid">
      {/* 1. Cúp khen thưởng */}
      <div className="spirit-card spirit-cup">
        <div className="spirit-top">
          <div className="spirit-icon-box">🏆</div>
          <div className="spirit-title-box">
            <span className="spirit-label">Cúp khen thưởng</span>
            <span className="spirit-badge">Tích lũy</span>
          </div>
        </div>
        <div className="spirit-val-row">
          <span className="spirit-value">{tinhThan.soCup || "0"}</span>
          <span className="spirit-unit">cúp</span>
        </div>
        <div className="spirit-progress-track">
          <div
            className="spirit-progress-bar cup-bar-solid"
            style={{ width: `${Math.max(15, cupPct)}%` }}
          />
        </div>
        <span className="spirit-hint">
          {cups >= 50 ? "Thuộc nhóm năng nổ nhất" : "Tích cực thu thập phần thưởng"}
        </span>
      </div>

      {/* 2. Giơ tay phát biểu */}
      <div className="spirit-card spirit-hand">
        <div className="spirit-top">
          <div className="spirit-icon-box">✋</div>
          <div className="spirit-title-box">
            <span className="spirit-label">Giơ tay phát biểu</span>
            <span className="spirit-badge">Chủ động</span>
          </div>
        </div>
        <div className="spirit-val-row">
          <span className="spirit-value">{tinhThan.gioTay || "0"}</span>
          <span className="spirit-unit">lượt</span>
        </div>
        <div className="spirit-dots">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className={`spirit-dot ${i <= hands ? "active" : ""}`}
              title={`Lượt ${i}`}
            >
              ★
            </span>
          ))}
        </div>
        <span className="spirit-hint">
          {hands >= 4 ? "Tự tin phát biểu xây dựng bài" : "Sẵn sàng tương tác cùng giáo viên"}
        </span>
      </div>

      {/* 3. Tỷ lệ trả lời đúng */}
      <div className="spirit-card spirit-accuracy">
        <div className="spirit-top">
          <div className="spirit-icon-box">🎯</div>
          <div className="spirit-title-box">
            <span className="spirit-label">Độ chính xác</span>
            <span className="spirit-badge">Trả lời đúng</span>
          </div>
        </div>
        <div className="spirit-val-row">
          <span className="spirit-value">{tinhThan.traLoiDung || "—"}</span>
          <span className="spirit-unit">({accuracyPct}%)</span>
        </div>
        <div className="spirit-progress-track">
          <div
            className="spirit-progress-bar accuracy-bar-solid"
            style={{ width: `${accuracyPct}%` }}
          />
        </div>
        <span className="spirit-hint">
          {accuracyPct >= 80 ? "Nắm chắc bài, độ chính xác cao" : "Tiếp thu tốt kiến thức bài học"}
        </span>
      </div>
    </div>
  );
}

/* -------------------------- Biểu đồ Lộ trình (Solid) -------------------------- */

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
          <div className="road-desc">Nắm vững 100% từ vựng & cấu trúc cốt lõi</div>
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

      {/* Thanh đo thị giác Solid */}
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
  const { tinhThan, ketQua, loTrinh, nangLucDauRa } = bc;
  const coNangLuc =
    nangLucDauRa.nghe.length ||
    nangLucDauRa.noi.length ||
    nangLucDauRa.doc.length ||
    nangLucDauRa.viet.length;

  const gradeMeta = getGradeMeta(ketQua.hocLuc);

  const skillDomains = [
    { ten: "Nghe", icon: "🎧", colorClass: "domain-nghe", items: nangLucDauRa.nghe },
    { ten: "Nói", icon: "🗣️", colorClass: "domain-noi", items: nangLucDauRa.noi },
    { ten: "Đọc", icon: "📖", colorClass: "domain-doc", items: nangLucDauRa.doc },
    { ten: "Viết", icon: "✍️", colorClass: "domain-viet", items: nangLucDauRa.viet },
  ];

  return (
    <>
      <div className="report-title">
        <div className="report-pretitle">{ORG.ten.toUpperCase()}</div>
        <h1>Báo Cáo Đánh Giá Năng Lực Học Viên</h1>
        <div className="rule-solid" />
      </div>

      {/* Thông tin học sinh kèm Avatar minh họa 3D */}
      <section className="card student-card">
        <div className="card-body">
          <div className="student">
            <StudentAvatar name={bc.hoTen} code={bc.maHocSinh} />

            <div className="student-info-main">
              <div className="student-name-row">
                <div className="student-name">{bc.hoTen}</div>
                <span className={`grade-tag ${gradeMeta.cls}`}>
                  {ketQua.hocLuc || "Đang cập nhật"}
                </span>
              </div>

              <div className="meta-grid">
                <Meta icon="🆔" k="Mã học sinh" v={bc.maHocSinh} />
                <Meta icon="🏫" k="Lớp" v={bc.lop} />
                <Meta icon="👩‍🏫" k="Giáo viên" v={bc.giaoVien} />
                <Meta icon="🗓️" k="Lịch học" v={bc.lichHoc} />
                {bc.videoUrl ? (
                  <div className="meta-item video-meta">
                    <span className="meta-icon">🎥</span>
                    <span className="k">Xem:</span>
                    <a className="v video-link" href={bc.videoUrl} target="_blank" rel="noreferrer">
                      Xem video buổi học ↗
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bố cục chia 2 cột rộng rãi trên Desktop (Dashboard Layout) */}
      <div className="report-dashboard-grid">
        {/* CỘT TRÁI (CHÍNH): Tinh thần học tập & Kết quả 4 kỹ năng */}
        <div className="dashboard-col-left">
          {/* I. Tinh thần học tập */}
          <Card
            num="I"
            title="Tinh thần học tập"
            subtitle="Mức độ tương tác và tính chủ động trong buổi học"
          >
            <SpiritMeters tinhThan={tinhThan} />
            {tinhThan.nhanXet ? (
              <div className="quote-box-solid">
                <span className="quote-icon">💬</span>
                <p className="quote">{tinhThan.nhanXet}</p>
              </div>
            ) : null}
          </Card>

          {/* II. Kết quả học tập */}
          <Card
            num="II"
            title="Kết quả học tập"
            subtitle="Đánh giá tổng thể và phân tích trực quan 4 kỹ năng ngôn ngữ"
          >
            <div className="grade-highlight-box-solid">
              <div className="grade-left">
                <span className="k">Xếp loại học lực:</span>
                <span className={`badge ${gradeMeta.cls}`}>{ketQua.hocLuc || "Đang cập nhật"}</span>
              </div>
              <div className="grade-right">
                <span className="grade-status-pill">
                  Đánh giá: <strong>{gradeMeta.label}</strong>
                </span>
              </div>
            </div>

            {ketQua.nhanXetTongQuan ? (
              <div className="quote-box-solid">
                <span className="quote-icon">📝</span>
                <p className="quote">{ketQua.nhanXetTongQuan}</p>
              </div>
            ) : null}

            {/* Biểu đồ đo lường 4 kỹ năng Solid (Radar + Thước đo ngang) */}
            {ketQua.chiTiet.length ? (
              <SkillsDashboardChart skills={ketQua.chiTiet} hocLuc={ketQua.hocLuc} />
            ) : null}

            {/* Nhận xét chi tiết 4 kỹ năng */}
            {ketQua.chiTiet.length ? (
              <>
                <div className="sub-title">Nhận xét chi tiết từng kỹ năng</div>
                <div className="detail-list">
                  {ketQua.chiTiet.map((m) => (
                    <div className="detail-solid" key={m.tieuDe}>
                      <div className="detail-header">
                        <h3>{m.tieuDe}</h3>
                        {m.diem !== undefined && (
                          <span className="detail-score-badge">
                            Điểm: <strong>{m.diem.toFixed(1)}</strong>/10
                          </span>
                        )}
                      </div>
                      <p>{m.noiDung}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </Card>
        </div>

        {/* CỘT PHẢI: Lộ trình phát triển & Khung chuẩn 6 bậc */}
        <div className="dashboard-col-right">
          {/* III. Lộ trình học tập */}
          <Card
            num="III"
            title="Lộ trình học tập"
            subtitle="Định hướng cá nhân hóa và tiêu chí chuẩn đầu ra"
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

            {coNangLuc ? (
              <>
                <div className="sub-title">Chuẩn năng lực đầu ra dự kiến</div>
                <div className="level-head">
                  <span className="level-badge-solid">{nangLucDauRa.bac}</span>
                  <span className="level-note">
                    Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam (KNLNNVN)
                  </span>
                </div>

                <div className="skills-stack">
                  {skillDomains.map(
                    (dom) =>
                      dom.items.length > 0 && (
                        <div className={`skill-card-solid ${dom.colorClass}`} key={dom.ten}>
                          <div className="skill-card-head-solid">
                            <span className="skill-icon">{dom.icon}</span>
                            <h4>Kỹ năng {dom.ten}</h4>
                          </div>
                          <ul>
                            {dom.items.map((it, i) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      )
                  )}
                </div>
              </>
            ) : null}
          </Card>

          {/* Khối xác nhận & ký tên */}
          <div className="sign-card-solid">
            {bc.ngayCap ? <div className="date">{bc.ngayCap}</div> : null}
            <div className="org-role">{ORG.hoiDong}</div>
            <div className="org-name">{ORG.ten}</div>
          </div>
        </div>
      </div>
    </>
  );
}
