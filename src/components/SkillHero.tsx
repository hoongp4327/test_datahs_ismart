import type { BaoCao, KyNangKetQua } from "../types";
import Icon from "./Icon";
import { giaoDienKyNang } from "./kyNangGiaoDien";
import { hienSoDem, useDemSo } from "./motion";

/**
 * Khối kết quả chính: bên trái Level + tổng điểm + thang Level (nền xanh), bên phải
 * radar 4 kỹ năng trong khung sáng.
 *
 * Nhãn kỹ năng quanh radar là HTML (lưới 3×3), không phải chữ trong SVG — SVG co lại
 * trên điện thoại thì chữ bên trong cũng co theo tới mức không đọc được.
 *
 * Kịch bản chuyển động khi mở trang:
 *   0–500 ms   các vòng lưới hiện dần từ trong ra
 *   300 ms     đa giác điểm nở từ tâm, tổng điểm đếm lên cùng nhịp
 *   400 ms     huy hiệu Level bật lên
 *   500 ms     kim trên thang Level trượt tới tổng điểm
 *   650 ms     4 đỉnh và 4 nhãn kỹ năng hiện lần lượt
 */

/* ---------------------------------- Radar ---------------------------------- */

const C = 200; // tâm
const R = 168; // bán kính vòng ngoài = điểm tối đa
/** Trên, phải, dưới, trái — theo thứ tự Listening, Reading, Writing, Speaking. */
const HUONG: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const VI_TRI_NHAN = ["top", "right", "bottom", "left"];

function Radar({ kyNang, diemToiDa }: { kyNang: KyNangKetQua[]; diemToiDa: number }) {
  const dinh = kyNang.map((k, i) => {
    const r = ((k.diem ?? 0) / diemToiDa) * R;
    return [C + HUONG[i][0] * r, C + HUONG[i][1] * r] as const;
  });
  const points = dinh.map((p) => p.join(",")).join(" ");

  return (
    <svg className="radar-svg" viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <linearGradient id="radar-to" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB067" />
          <stop offset="100%" stopColor="#F2603A" />
        </linearGradient>
        <filter id="radar-bong" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#F2603A" floodOpacity="0.35" />
        </filter>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((k, i) => (
        <g key={k} className="radar-vong" style={{ ["--tre" as string]: `${i * 70}ms` }}>
          <circle cx={C} cy={C} r={R * k} className={k === 1 ? "vong-ngoai" : "vong-trong"} />
          <text x={C + R * k * 0.7071 + 6} y={C - R * k * 0.7071 - 4} className="vong-so">
            {diemToiDa * k}
          </text>
        </g>
      ))}

      {HUONG.map(([dx, dy], i) => (
        <line key={i} x1={C - dx * (R + 8)} y1={C - dy * (R + 8)} x2={C} y2={C} className="radar-truc" />
      ))}

      <g className="radar-da-giac">
        <polygon points={points} fill="url(#radar-to)" filter="url(#radar-bong)" className="da-giac" />
      </g>

      {dinh.map(([x, y], i) => (
        <circle
          key={kyNang[i].key}
          cx={x}
          cy={y}
          r="8"
          className="radar-dinh"
          style={{ ["--tre" as string]: `${650 + i * 70}ms` }}
        />
      ))}
    </svg>
  );
}

function NhanKyNang({ k, diemToiDa, thuTu }: { k: KyNangKetQua; diemToiDa: number; thuTu: number }) {
  const gd = giaoDienKyNang(k.key);
  return (
    <div
      className={`radar-nhan radar-nhan-${VI_TRI_NHAN[thuTu]}`}
      style={{ ["--tre" as string]: `${650 + thuTu * 70}ms` }}
    >
      <span className="o-icon" style={{ background: gd.nen, color: gd.mau }}>
        <Icon ten={gd.icon} size={24} />
      </span>
      <span className="radar-nhan-chu">
        <strong>{k.ten}</strong>
        <span className="radar-nhan-diem">
          <b style={{ color: gd.mau }}>{k.diem ?? "—"}</b>/{diemToiDa}
        </span>
      </span>
    </div>
  );
}

/* -------------------------------- Huy hiệu Level -------------------------------- */

function HuyHieu({ ten }: { ten: string | undefined }) {
  const chu = ten ?? "—";
  return (
    <div className="huy-hieu">
      <img src="/images/nguyet-que.webp" alt="" className="nguyet-que nguyet-que-trai" />
      <div className="huy-hieu-khien">
        <svg viewBox="0 0 200 150" aria-hidden="true">
          <defs>
            <linearGradient id="khien-to" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF9A3D" />
              <stop offset="100%" stopColor="#EE5A1F" />
            </linearGradient>
          </defs>
          <path
            d="M24 8h152q16 0 16 16v66q0 12-10 18l-74 36q-8 4-16 0l-74-36Q8 102 8 90V24Q8 8 24 8Z"
            fill="url(#khien-to)"
            stroke="#FFD08A"
            strokeWidth="4"
          />
        </svg>
        <span className={`huy-hieu-chu${chu.length > 3 ? " is-dai" : ""}`}>{chu}</span>
      </div>
      <img src="/images/nguyet-que.webp" alt="" className="nguyet-que nguyet-que-phai" />
    </div>
  );
}

/* --------------------------------- Thang Level --------------------------------- */

function ThangLevel({ bc, tongDangDem }: { bc: BaoCao; tongDangDem: string }) {
  const thang = bc.thangLevel;
  if (!thang.length) return null;
  const pt = (d: number) => Math.min(100, Math.max(0, (d / bc.tongToiDa) * 100));
  const moc = [...thang.map((m) => m.tu), bc.tongToiDa].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="thang">
      <div className="thang-ray">
        <div className="thang-cac-doan">
          {thang.map((m, i) => {
            const den = Math.min(thang[i + 1]?.tu ?? bc.tongToiDa, bc.tongToiDa);
            return (
              <span
                key={m.ten}
                className={`thang-doan${m.ten === bc.level?.ten ? " is-hien-tai" : ""}`}
                style={{ left: `${pt(m.tu)}%`, width: `${pt(den) - pt(m.tu)}%` }}
                title={`${m.ten}: từ ${m.tu} điểm`}
              >
                {m.ten}
              </span>
            );
          })}
        </div>
        {bc.tongDiem !== null ? (
          <span className="thang-kim" style={{ left: `${pt(bc.tongDiem)}%` }} aria-hidden="true">
            <span className="thang-kim-so">{tongDangDem}</span>
          </span>
        ) : null}
      </div>
      <div className="thang-moc" aria-hidden="true">
        {moc.map((m) => (
          <span key={m} style={{ left: `${pt(m)}%` }}>
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
  const moTaRadar = bc.kyNang.map((k) => `${k.ten} ${k.diem ?? "chưa có"}/${bc.diemToiDa}`).join(", ");

  return (
    <section className="hero" aria-label="Kết quả 4 kỹ năng và Level tương ứng">
      <div className="hero-trai">
        <div className="hero-nhan">
          LEVEL TƯƠNG ỨNG
          <svg viewBox="0 0 30 30" className="tia" aria-hidden="true">
            <path d="M8 22 14 6M16 24l10-12" />
          </svg>
        </div>

        <HuyHieu ten={bc.level?.ten} />

        <div className="hero-tong">
          <b>{tongDangDem}</b>
          <span>/ {bc.tongToiDa} điểm</span>
        </div>

        <p className="hero-mo-ta">
          {bc.level?.moTa ??
            (duDiem ? "" : "Chưa đủ điểm cả 4 kỹ năng nên chưa xếp Level. Trung tâm sẽ cập nhật khi giáo viên chấm xong.")}
        </p>

        <ThangLevel bc={bc} tongDangDem={tongDangDem} />

        <svg className="hero-song" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70C70 40 130 95 210 80S330 30 400 60V120H0Z" fill="#2B7BD8" opacity="0.55" />
          <path d="M0 92C60 70 120 110 190 100S300 72 360 90 400 96 400 96V120H0Z" fill="#F7A23A" />
        </svg>
      </div>

      <div className="hero-phai">
        <img src="/images/chong-sach.webp" alt="" className="hero-sach" />
        {duDiem ? (
          <div className="radar" role="img" aria-label={`Biểu đồ 4 kỹ năng: ${moTaRadar}`}>
            <div className="radar-chart">
              <Radar kyNang={bc.kyNang} diemToiDa={bc.diemToiDa} />
            </div>
            {bc.kyNang.map((k, i) => (
              <NhanKyNang key={k.key} k={k} diemToiDa={bc.diemToiDa} thuTu={i} />
            ))}
          </div>
        ) : (
          <div className="radar-trong">
            <strong>Biểu đồ sẽ hiện khi đủ điểm 4 kỹ năng</strong>
            <span>Giáo viên đang hoàn tất phần chấm điểm.</span>
          </div>
        )}
      </div>
    </section>
  );
}
