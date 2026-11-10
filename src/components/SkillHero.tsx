import { useEffect, useState } from "react";
import type { BaoCao, KyNangKetQua } from "../types";
import { giaoDienKyNang } from "./kyNangGiaoDien";
import { hienSoDem, useDemSo } from "./motion";

/**
 * Khối mở đầu của báo cáo: Level + thang Level bên trái, radar 4 kỹ năng cỡ lớn bên phải.
 *
 * Kịch bản chuyển động khi mở trang (thời điểm tính từ lúc trang hiện ra):
 *     0 ms   khối nền trượt lên
 *   120 ms   các vòng lưới radar hiện dần từ trong ra
 *   300 ms   đa giác điểm nở từ tâm  ←  chuyển động chính
 *   300 ms   tổng điểm đếm lên, cùng nhịp với đa giác
 *   500 ms   kim trên thang Level trượt tới tổng điểm
 *   650 ms   4 đỉnh và nhãn kỹ năng hiện lần lượt, cách nhau 70 ms
 * Liên tục: quầng sáng nền trôi rất chậm, quầng quanh mỗi đỉnh "thở".
 */

/* ------------------------------ Radar ------------------------------ */

/* Bán kính lớn, lề vừa đủ cho nhãn — radar chiếm phần lớn khung vẽ. */
const R = 182;
const LE_NGANG = 122; // chỗ cho nhãn trái/phải (tên kỹ năng dài nhất ~95px)
const LE_DOC = 78; // chỗ cho nhãn trên/dưới (2 dòng)
const CX = R + LE_NGANG;
const CY = R + LE_DOC;
const RONG = 2 * CX;
const CAO = 2 * CY;
/** Hướng 4 trục: trên, phải, dưới, trái — theo thứ tự Listening, Reading, Writing, Speaking. */
const HUONG: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function viTriNhan(i: number) {
  switch (i) {
    case 0:
      return { x: CX, y: CY - R - 46, anchor: "middle" as const };
    case 1:
      return { x: CX + R + 26, y: CY - 6, anchor: "start" as const };
    case 2:
      return { x: CX, y: CY + R + 42, anchor: "middle" as const };
    default:
      return { x: CX - R - 26, y: CY - 6, anchor: "end" as const };
  }
}

/**
 * Màn hình hẹp: SVG co lại thì chữ nhãn bên trong cũng co theo, xuống còn ~8px. Nên trên
 * điện thoại radar cắt sát vòng tròn để to hết cỡ, nhãn chuyển ra chú thích HTML bên dưới.
 */
function useManHinhHep(px = 600) {
  const q = `(max-width: ${px}px)`;
  const [hep, setHep] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(q);
    const capNhat = () => setHep(m.matches);
    capNhat();
    m.addEventListener("change", capNhat);
    return () => m.removeEventListener("change", capNhat);
  }, [q]);
  return hep;
}

const LE_GON = 30; // lề quanh vòng tròn ở chế độ gọn

function RadarLon({ kyNang, diemToiDa, gon }: { kyNang: KyNangKetQua[]; diemToiDa: number; gon: boolean }) {
  const dinh = kyNang.map((k, i) => {
    const r = ((k.diem ?? 0) / diemToiDa) * R;
    return [CX + HUONG[i][0] * r, CY + HUONG[i][1] * r] as const;
  });
  const points = dinh.map((p) => p.join(",")).join(" ");
  const moTaCho = kyNang.map((k) => `${k.ten} ${k.diem ?? "chưa có"}/${diemToiDa}`).join(", ");

  return (
    <svg
      className="bc-radar"
      viewBox={
        gon
          ? `${CX - R - LE_GON} ${CY - R - LE_GON} ${2 * (R + LE_GON)} ${2 * (R + LE_GON)}`
          : `0 0 ${RONG} ${CAO}`
      }
      style={{ ["--cx" as string]: `${CX}px`, ["--cy" as string]: `${CY}px` }}
      role="img"
      aria-label={`Biểu đồ radar 4 kỹ năng: ${moTaCho}`}
    >
      <defs>
        <radialGradient id="bc-radar-to" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8501B" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#E8501B" stopOpacity="0.28" />
        </radialGradient>
        <filter id="bc-radar-sang" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* Lưới: 4 vòng tròn ứng với 5 / 10 / 15 / 20 điểm */}
      {[0.25, 0.5, 0.75, 1].map((k, i) => (
        <g key={k} className="bc-vong" style={{ ["--tre" as string]: `${120 + i * 60}ms` }}>
          {/* Mỗi vòng phủ một lớp mờ — chồng lên nhau thành các dải sáng dần về tâm */}
          <circle cx={CX} cy={CY} r={R * k} className="bc-vong-dai" />
          <circle cx={CX} cy={CY} r={R * k} className={k === 1 ? "bc-vong-ngoai" : "bc-vong-trong"} />
          <text x={CX + R * k * 0.7071 + 4} y={CY - R * k * 0.7071 - 4} className="bc-vong-so">
            {diemToiDa * k}
          </text>
        </g>
      ))}

      {HUONG.map(([dx, dy], i) => (
        <line key={i} x1={CX} y1={CY} x2={CX + dx * (R + 10)} y2={CY + dy * (R + 10)} className="bc-truc" />
      ))}

      {/* Đa giác điểm: một lớp quầng sáng mờ phía sau + lớp chính */}
      <g className="bc-da-giac">
        <polygon points={points} className="bc-da-giac-sang" filter="url(#bc-radar-sang)" />
        <polygon points={points} className="bc-da-giac-chinh" fill="url(#bc-radar-to)" />
      </g>

      {kyNang.map((k, i) => {
        const gd = giaoDienKyNang(k.key);
        const [x, y] = dinh[i];
        const nhan = viTriNhan(i);
        const tre = { ["--tre" as string]: `${650 + i * 70}ms` };
        return (
          <g key={k.key}>
            <g className="bc-dinh" style={tre}>
              <circle cx={x} cy={y} r="15" fill={gd.mau} className="bc-dinh-quang" />
              <circle cx={x} cy={y} r="7.5" fill={gd.mau} className="bc-dinh-diem" />
            </g>
            {gon ? (
              // Chế độ gọn: chỉ ký hiệu L/R/W/S ở đầu trục; tên và điểm nằm trong chú thích bên dưới
              <text
                x={CX + HUONG[i][0] * (R + 18)}
                y={CY + HUONG[i][1] * (R + 18) + 7}
                textAnchor="middle"
                className="bc-radar-chu bc-radar-nhan"
                style={{ ...tre, fill: gd.tenToi }}
              >
                {gd.kyHieu}
              </text>
            ) : (
              <g className="bc-radar-nhan" style={tre}>
                <text x={nhan.x} y={nhan.y} textAnchor={nhan.anchor} className="bc-radar-ten">
                  {k.ten}
                </text>
                <text x={nhan.x} y={nhan.y + 27} textAnchor={nhan.anchor} className="bc-radar-diem">
                  <tspan fill={gd.tenToi}>{k.diem ?? "—"}</tspan>
                  <tspan className="bc-radar-max">/{diemToiDa}</tspan>
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------- Thang Level ---------------------------- */

/**
 * Thanh 0–80 chia đúng theo các mốc trong tab ThangLevel của sheet, kim chỉ vào tổng
 * điểm. Cho phụ huynh thấy con đang ở đâu trong mức, còn cách mức sau bao xa.
 */
function ThangLevelBar({
  thang,
  tong,
  tongToiDa,
  levelHienTai,
  tongDangDem,
}: {
  thang: BaoCao["thangLevel"];
  tong: number | null;
  tongToiDa: number;
  levelHienTai: string | undefined;
  tongDangDem: string;
}) {
  if (!thang.length) return null;
  const phanTram = (d: number) => Math.min(100, Math.max(0, (d / tongToiDa) * 100));
  const doan = thang.map((m, i) => {
    const den = Math.min(thang[i + 1]?.tu ?? tongToiDa, tongToiDa);
    return { ...m, trai: phanTram(m.tu), rong: phanTram(den) - phanTram(m.tu) };
  });
  const moc = [...thang.map((m) => m.tu), tongToiDa].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="bc-thang">
      <div className="bc-thang-ray">
        <div className="bc-thang-cac-doan">
          {doan.map((d) => (
            <div
              key={d.ten}
              className={`bc-thang-doan${d.ten === levelHienTai ? " is-hien-tai" : ""}`}
              style={{ left: `${d.trai}%`, width: `${d.rong}%` }}
              title={`${d.ten}: từ ${d.tu} điểm`}
            >
              <span>{d.ten}</span>
            </div>
          ))}
        </div>
        {tong !== null ? (
          <div className="bc-thang-kim" style={{ left: `${phanTram(tong)}%` }} aria-hidden="true">
            <span className="bc-thang-kim-so">{tongDangDem}</span>
          </div>
        ) : null}
      </div>
      <div className="bc-thang-moc" aria-hidden="true">
        {moc.map((m) => (
          <span key={m} style={{ left: `${phanTram(m)}%` }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Hero ------------------------------- */

export default function SkillHero({ bc }: { bc: BaoCao }) {
  const duDiem = bc.tongDiem !== null;
  const gon = useManHinhHep();
  const tongDem = hienSoDem(useDemSo(bc.tongDiem, 300, 900), bc.tongDiem);

  return (
    <section className="bc-hero" aria-label="Kết quả 4 kỹ năng và Level tương ứng">
      <div className="bc-hero-nen" aria-hidden="true" />

      <div className="bc-hero-trai">
        <div className="bc-eyebrow">Level tương ứng</div>
        <div className={`bc-level${bc.level ? "" : " is-chua-co"}`}>
          {bc.level?.ten ?? "Đang cập nhật"}
        </div>
        <div className="bc-tong">
          <span className="bc-tong-so">{tongDem}</span>
          <span className="bc-tong-max">/ {bc.tongToiDa} điểm</span>
        </div>
        {bc.level?.moTa ? <p className="bc-level-mo-ta">{bc.level.moTa}</p> : null}

        <ThangLevelBar
          thang={bc.thangLevel}
          tong={bc.tongDiem}
          tongToiDa={bc.tongToiDa}
          levelHienTai={bc.level?.ten}
          tongDangDem={tongDem}
        />
      </div>

      <div className="bc-hero-phai">
        {duDiem ? (
          <div className="bc-radar-khung">
            <RadarLon kyNang={bc.kyNang} diemToiDa={bc.diemToiDa} gon={gon} />
            {gon ? (
              <ul className="bc-chu-giai">
                {bc.kyNang.map((k) => {
                  const gd = giaoDienKyNang(k.key);
                  return (
                    <li key={k.key}>
                      <span className="bc-chu-giai-ky-hieu" style={{ color: gd.tenToi }}>
                        {gd.kyHieu}
                      </span>
                      <span className="bc-chu-giai-ten">{k.ten}</span>
                      <b style={{ color: gd.tenToi }}>
                        {k.diem ?? "—"}
                        <small>/{bc.diemToiDa}</small>
                      </b>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="bc-chua-du">
            <strong>Chưa đủ điểm cả 4 kỹ năng</strong>
            <span>Biểu đồ và Level sẽ hiện khi giáo viên chấm xong. Trung tâm sẽ cập nhật sớm.</span>
          </div>
        )}
      </div>
    </section>
  );
}
