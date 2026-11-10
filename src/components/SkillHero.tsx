import type { BaoCao, KyNangKetQua } from "../types";
import Icon from "./Icon";
import { giaoDienKyNang } from "./kyNangGiaoDien";
import { hienSoDem, useDemSo } from "./motion";

/**
 * Khối kết quả chính trên nền xanh đậm: bên trái Level chữ lớn + tổng điểm + thang
 * Level, bên phải radar 4 kỹ năng.
 *
 * Kịch bản chuyển động khi mở trang:
 *   0–500 ms   vòng lưới hiện dần
 *   300 ms     đa giác nở từ tâm, tổng điểm đếm lên cùng nhịp
 *   500 ms     kim trên thang Level trượt tới tổng điểm
 *   650 ms     4 đỉnh và 4 nhãn kỹ năng hiện lần lượt
 */

/** "12.5" → "12,5" cho người đọc Việt. */
const so = (n: number) => String(n).replace(".", ",");

/* ---------------------------------- Radar ---------------------------------- */

const W = 600;
const H = 482;
const CX = 300;
const CY = 235;
const R = 150;
/** Trên, phải, dưới, trái — theo thứ tự Listening, Reading, Writing, Speaking. */
const HUONG: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
/** Màu đỉnh sáng trên nền tối — sáng hơn màu kỹ năng thường để nổi trên xanh đậm. */
const MAU_DINH = ["#2fe1ff", "#9dea75", "#ffbc4d", "#ff7446"];

/** Vị trí nhãn quanh radar: icon, tên, điểm. */
const NHAN = [
  { x: CX, y: 0, neo: "middle" as const }, // trên
  { x: CX + R + 30, y: 190, neo: "start" as const }, // phải
  { x: CX, y: CY + R + 8, neo: "middle" as const }, // dưới
  { x: CX - R - 30, y: 190, neo: "end" as const }, // trái
];

function Radar({ kyNang, diemToiDa }: { kyNang: KyNangKetQua[]; diemToiDa: number }) {
  const dinh = kyNang.map((k, i) => {
    const r = (Math.min(diemToiDa, Math.max(0, k.diem ?? 0)) / diemToiDa) * R;
    return { x: CX + HUONG[i][0] * r, y: CY + HUONG[i][1] * r };
  });
  const diem = dinh.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg className="bc-radar-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id="bc-to" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffb165" stopOpacity=".96" />
          <stop offset="52%" stopColor="#ff743b" stopOpacity=".82" />
          <stop offset="100%" stopColor="#f85e5e" stopOpacity=".52" />
        </linearGradient>
        <radialGradient id="bc-hao-quang">
          <stop offset="0%" stopColor="#70b0ff" stopOpacity=".30" />
          <stop offset="100%" stopColor="#70b0ff" stopOpacity="0" />
        </radialGradient>
        <filter id="bc-mo-dinh" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="bc-mo-da-giac" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <circle cx={CX} cy={CY} r={R + 34} fill="url(#bc-hao-quang)" />

      {/* Lưới */}
      {[0.25, 0.5, 0.75, 1].map((k, i) => (
        <circle
          key={k}
          cx={CX}
          cy={CY}
          r={R * k}
          className={`bc-radar-luoi${k === 1 ? " is-ngoai" : " is-dut"}`}
          style={{ ["--tre" as string]: `${i * 70}ms` }}
        />
      ))}
      <path d={`M ${CX - R} ${CY} H ${CX + R} M ${CX} ${CY - R} V ${CY + R}`} className="bc-radar-truc" />
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <text key={k} x={CX + 9} y={CY - R * k + 4} className="bc-radar-so">
          {so(diemToiDa * k)}
        </text>
      ))}

      {/* Đa giác điểm */}
      <g className="bc-radar-da-giac">
        <polygon points={diem} fill="#ff653f" fillOpacity=".52" filter="url(#bc-mo-da-giac)" />
        <polygon points={diem} fill="url(#bc-to)" stroke="#ffb477" strokeWidth="2.3" strokeLinejoin="round" />
      </g>

      {/* Đỉnh */}
      {dinh.map((p, i) => (
        <g key={kyNang[i].key} className="bc-radar-dinh" style={{ ["--tre" as string]: `${650 + i * 70}ms` }}>
          <circle cx={p.x} cy={p.y} r="10" fill={MAU_DINH[i]} opacity=".83" filter="url(#bc-mo-dinh)" />
          <circle cx={p.x} cy={p.y} r="6.5" fill={MAU_DINH[i]} stroke="#fff" strokeWidth="2.4" />
        </g>
      ))}

      {/* Nhãn */}
      {kyNang.map((k, i) => {
        const n = NHAN[i];
        const gd = giaoDienKyNang(k.key);
        const xIcon = n.neo === "middle" ? n.x - 13 : n.neo === "start" ? n.x : n.x - 26;
        return (
          <g key={k.key} className="bc-radar-nhan" style={{ ["--tre" as string]: `${650 + i * 70}ms` }}>
            <svg x={xIcon} y={n.y} width="26" height="26" viewBox="0 0 26 26" className="bc-radar-icon">
              <g transform="translate(1 1)" style={{ color: MAU_DINH[i] }}>
                <Icon ten={gd.icon} size={24} />
              </g>
            </svg>
            <text x={n.x} y={n.y + 50} textAnchor={n.neo} className="bc-radar-ten">
              {k.ten}
            </text>
            <text x={n.x} y={n.y + 79} textAnchor={n.neo} className="bc-radar-diem" fill={MAU_DINH[i]}>
              <tspan>{k.diem === null ? "—" : so(k.diem)}</tspan>
              <tspan className="bc-radar-mau">/{diemToiDa}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------- Thang Level --------------------------------- */

function ThangLevel({ bc, tongDangDem }: { bc: BaoCao; tongDangDem: string }) {
  const thang = bc.thangLevel;
  if (!thang.length) return null;
  const pt = (d: number) => Math.min(100, Math.max(0, (d / bc.tongToiDa) * 100));
  const moc = [...thang.map((m) => m.tu), bc.tongToiDa].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div
      className="bc-meter"
      role="img"
      aria-label={
        bc.tongDiem === null
          ? "Thang Level — chưa đủ điểm để xếp"
          : `Điểm ${so(bc.tongDiem)} trên tổng ${bc.tongToiDa}, cấp độ ${bc.level?.ten ?? "chưa xếp"}`
      }
    >
      {bc.tongDiem !== null ? (
        <span className="bc-meter-kim" style={{ ["--vi-tri" as string]: `${pt(bc.tongDiem)}%` }} aria-hidden="true">
          <b>{tongDangDem}</b>
        </span>
      ) : null}
      <div className="bc-meter-thanh" aria-hidden="true">
        {thang.map((m, i) => {
          const den = Math.min(thang[i + 1]?.tu ?? bc.tongToiDa, bc.tongToiDa);
          return (
            <span
              key={m.ten}
              className={`bc-meter-doan${m.ten === bc.level?.ten ? " is-hien-tai" : ""}`}
              style={{ flexGrow: Math.max(den - m.tu, 0.0001) }}
            >
              {m.ten}
            </span>
          );
        })}
      </div>
      <div className="bc-meter-moc" aria-hidden="true">
        {moc.map((m, i) => (
          <span
            key={m}
            style={{ left: `${pt(m)}%` }}
            className={i === 0 ? "is-dau" : i === moc.length - 1 ? "is-cuoi" : ""}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Khối chính ---------------------------------- */

export default function SkillHero({ bc }: { bc: BaoCao }) {
  const tongDangDem = hienSoDem(useDemSo(bc.tongDiem, 300, 900), bc.tongDiem);
  const duDiem = bc.tongDiem !== null;
  const level = bc.level?.ten ?? "—";
  const moTaRadar = bc.kyNang.map((k) => `${k.ten} ${k.diem ?? "chưa có"}/${bc.diemToiDa}`).join(", ");

  return (
    <section className="bc-hero" aria-label="Kết quả tổng quan">
      <span className="bc-hero-vach" aria-hidden="true" />
      <span className="bc-hero-loe" aria-hidden="true" />
      <span className="bc-hero-luoi" aria-hidden="true" />
      <span className="bc-hero-vong is-1" aria-hidden="true" />
      <span className="bc-hero-vong is-2" aria-hidden="true" />
      <span className="bc-hero-vong is-3" aria-hidden="true" />

      <div className="bc-level-col">
        <div className="bc-eyebrow">Level tương ứng</div>
        <div className="bc-level-visual">
          <span className={`bc-big-level${level.length > 3 ? " is-dai" : ""}`}>{level}</span>
          <span className="bc-orbit" aria-hidden="true" />
          <span className="bc-orbit-sao" aria-hidden="true">
            ✦
          </span>
        </div>
        <div className="bc-points">
          <strong>{tongDangDem}</strong>
          <span>/ {bc.tongToiDa} điểm</span>
        </div>
        <p className="bc-description">
          {bc.level?.moTa ||
            (duDiem ? "" : "Chưa đủ điểm cả 4 kỹ năng nên chưa xếp Level. Trung tâm sẽ cập nhật khi giáo viên chấm xong.")}
        </p>
        <ThangLevel bc={bc} tongDangDem={tongDangDem} />
      </div>

      <div className="bc-radar-col">
        {duDiem ? (
          <div className="bc-radar" role="img" aria-label={`Biểu đồ 4 kỹ năng: ${moTaRadar}`}>
            <Radar kyNang={bc.kyNang} diemToiDa={bc.diemToiDa} />
          </div>
        ) : (
          <div className="bc-radar-trong">
            <strong>Biểu đồ sẽ hiện khi đủ điểm 4 kỹ năng</strong>
            <span>Giáo viên đang hoàn tất phần chấm điểm.</span>
          </div>
        )}
      </div>
    </section>
  );
}
