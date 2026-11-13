import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DE_THI, MOI_CAU, type Cau, type Phan } from "../../shared/placement/de-thi";
import "../placement.css";

/**
 * Trang làm bài iLEAD Online Placement Test — /placement-test
 *
 * Bài làm lưu liên tục vào localStorage: lỡ tải lại trang hay mất mạng thì làm tiếp
 * được, đồng hồ vẫn tính từ lúc bắt đầu. Đáp án KHÔNG có ở trình duyệt — server chấm.
 */

const KHO = "ilead-placement-v1";
const THOI_GIAN_MS = DE_THI.thoiGianPhut * 60_000;
/** Có hiện điểm cho học sinh sau khi nộp không. Placement test thường để giáo viên báo. */
const HIEN_DIEM = false;

type Buoc = "gioi-thieu" | number | "xem-lai" | "xong";
type TrangThai = {
  maBai: string;
  hoTen: string;
  ngaySinh: string;
  batDau: number | null;
  buoc: Buoc;
  traLoi: Record<string, string>;
};

function maMoi() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, "");
}

function docKho(): TrangThai {
  const macDinh: TrangThai = { maBai: maMoi(), hoTen: "", ngaySinh: "", batDau: null, buoc: "gioi-thieu", traLoi: {} };
  try {
    const s = JSON.parse(localStorage.getItem(KHO) || "null");
    if (s && typeof s === "object" && s.maBai) return { ...macDinh, ...s, buoc: s.buoc === "xong" ? "gioi-thieu" : s.buoc };
  } catch {
    /* trình duyệt chặn lưu trữ: vẫn làm bài được, chỉ là không khôi phục */
  }
  return macDinh;
}

function ghiKho(t: TrangThai) {
  try {
    localStorage.setItem(KHO, JSON.stringify(t));
  } catch {
    /* bỏ qua */
  }
}

function xoaKho() {
  try {
    localStorage.removeItem(KHO);
  } catch {
    /* bỏ qua */
  }
}

/** Tự chèn dấu / khi gõ ngày sinh: 05062016 → 05/06/2016. */
function dinhDangNgay(v: string) {
  const so = v.replace(/\D/g, "").slice(0, 8);
  return [so.slice(0, 2), so.slice(2, 4), so.slice(4)].filter(Boolean).join("/");
}

function ngayHopLe(v: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const [d, t, n] = [+m[1], +m[2], +m[3]];
  const date = new Date(n, t - 1, d);
  return date.getDate() === d && date.getMonth() === t - 1 && n >= 1990 && n <= new Date().getFullYear();
}

function dongHo(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const daTraLoi = (traLoi: Record<string, string>, id: string) => Boolean(traLoi[id]?.trim());

/* ================================================================== */

export default function PlacementTest() {
  const [tt, setTt] = useState<TrangThai>(docKho);
  const [bayGio, setBayGio] = useState(Date.now());
  const [dangNop, setDangNop] = useState(false);
  const [loiNop, setLoiNop] = useState("");
  const [diem, setDiem] = useState<Record<string, number> | null>(null);
  const daTuNop = useRef(false);
  const dauTrang = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tt.buoc !== "xong") ghiKho(tt);
  }, [tt]);

  useEffect(() => {
    document.title = DE_THI.ten;
    const id = setInterval(() => setBayGio(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const conLai = tt.batDau ? tt.batDau + THOI_GIAN_MS - bayGio : THOI_GIAN_MS;
  const dangLam = typeof tt.buoc === "number" || tt.buoc === "xem-lai";

  const chuyen = (buoc: Buoc) => {
    setTt((t) => ({ ...t, buoc }));
    requestAnimationFrame(() => dauTrang.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const traLoi = (id: string, gt: string) => setTt((t) => ({ ...t, traLoi: { ...t.traLoi, [id]: gt } }));

  const nopBai = useCallback(
    async (hetGio = false) => {
      setDangNop(true);
      setLoiNop("");
      try {
        const res = await fetch("/api/placement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maBai: tt.maBai,
            hoTen: tt.hoTen,
            ngaySinh: tt.ngaySinh,
            batDau: tt.batDau,
            traLoi: tt.traLoi,
            hetGio,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; diem?: Record<string, number> };
        if (!res.ok || !j.ok) throw new Error(j.message || "Chưa lưu được bài, vui lòng bấm Nộp lại.");
        xoaKho();
        setDiem(j.diem ?? null);
        setTt((t) => ({ ...t, buoc: "xong" }));
      } catch (e) {
        setLoiNop(
          e instanceof TypeError ? "Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Nộp lại — bài làm vẫn được giữ." : (e as Error).message
        );
        setTt((t) => ({ ...t, buoc: "xem-lai" }));
      } finally {
        setDangNop(false);
      }
    },
    [tt]
  );

  // Hết giờ → tự nộp một lần.
  useEffect(() => {
    if (dangLam && tt.batDau && conLai <= 0 && !daTuNop.current) {
      daTuNop.current = true;
      nopBai(true);
    }
  }, [conLai, dangLam, tt.batDau, nopBai]);

  return (
    <div className="plc" ref={dauTrang}>
      <header className="plc-top">
        <div className="plc-wrap plc-top-inner">
          <div className="plc-brand">
            <img src="/images/ismart-logo.png" alt="iSMART Education" />
            <span className="plc-brand-sep" />
            <span className="plc-brand-name">
              iLEAD <b>Placement Test</b>
            </span>
          </div>
          {dangLam && (
            <div className={"plc-timer" + (conLai < 5 * 60_000 ? " is-low" : "")} aria-live="polite">
              <span className="plc-timer-dot" />
              {dongHo(conLai)}
            </div>
          )}
        </div>
        {typeof tt.buoc === "number" && <TienDo phanHienTai={tt.buoc} traLoi={tt.traLoi} onChon={chuyen} />}
      </header>

      <main className="plc-wrap plc-main">
        {tt.buoc === "gioi-thieu" && (
          <GioiThieu
            tt={tt}
            onDoi={(p) => setTt((t) => ({ ...t, ...p }))}
            onBatDau={() => {
              setTt((t) => ({ ...t, batDau: t.batDau ?? Date.now() }));
              chuyen(0);
            }}
          />
        )}

        {typeof tt.buoc === "number" && (
          <PhanThi
            key={tt.buoc}
            phan={DE_THI.phan[tt.buoc]}
            soThuTu={tt.buoc}
            traLoi={tt.traLoi}
            onTraLoi={traLoi}
            onTruoc={() => chuyen(tt.buoc === 0 ? "gioi-thieu" : (tt.buoc as number) - 1)}
            onSau={() => chuyen((tt.buoc as number) + 1 < DE_THI.phan.length ? (tt.buoc as number) + 1 : "xem-lai")}
          />
        )}

        {tt.buoc === "xem-lai" && (
          <XemLai
            traLoi={tt.traLoi}
            hetGio={conLai <= 0}
            dangNop={dangNop}
            loi={loiNop}
            onQuayLai={chuyen}
            onNop={() => nopBai(conLai <= 0)}
          />
        )}

        {tt.buoc === "xong" && (
          <section className="plc-card plc-done">
            <div className="plc-done-icon">✓</div>
            <h1>Nộp bài thành công!</h1>
            <p>
              Cảm ơn <b>{tt.hoTen}</b> đã hoàn thành bài kiểm tra. Thầy cô sẽ xem bài và liên hệ với phụ huynh để thông báo
              kết quả xếp lớp.
            </p>
            {HIEN_DIEM && diem && (
              <div className="plc-done-score">
                <div>Listening {diem.listening}/20</div>
                <div>Reading {diem.reading}/20</div>
                <div>Writing {diem.writing}/15</div>
                <div className="tong">Tổng {diem.tong}/55</div>
              </div>
            )}
            <p className="plc-muted">Con có thể đóng trang này.</p>
          </section>
        )}
      </main>

      {dangNop && tt.buoc !== "xem-lai" && <div className="plc-overlay">Đang nộp bài…</div>}
    </div>
  );
}

/* ================================================================== */

function GioiThieu({
  tt,
  onDoi,
  onBatDau,
}: {
  tt: TrangThai;
  onDoi: (p: Partial<TrangThai>) => void;
  onBatDau: () => void;
}) {
  const [daThu, setDaThu] = useState(false);
  const loiTen = !tt.hoTen.trim() ? "Vui lòng nhập họ tên." : "";
  const loiNgay = !ngayHopLe(tt.ngaySinh) ? "Nhập ngày sinh dạng ngày/tháng/năm, ví dụ 05/06/2016." : "";
  const dangLamDo = tt.batDau !== null;

  return (
    <>
      <section className="plc-hero">
        <div>
          <p className="plc-eyebrow">Bài kiểm tra xếp lớp đầu vào</p>
          <h1>{DE_THI.ten}</h1>
          <p className="plc-hero-sub">{DE_THI.moTa}</p>
        </div>
        <div className="plc-hero-stats">
          <div className="plc-stat">
            <b>{DE_THI.thoiGianPhut}</b>
            <span>phút</span>
          </div>
          <div className="plc-stat">
            <b>3</b>
            <span>phần thi</span>
          </div>
          <div className="plc-stat">
            <b>55</b>
            <span>điểm</span>
          </div>
        </div>
      </section>

      <div className="plc-intro-grid">
        <section className="plc-card">
          <h2 className="plc-h2">Thông tin học sinh</h2>
          <label className="plc-field">
            <span>
              Name <i>Họ và tên</i>
            </span>
            <input
              value={tt.hoTen}
              onChange={(e) => onDoi({ hoTen: e.target.value })}
              placeholder="Nguyễn Minh Anh"
              autoComplete="name"
              maxLength={120}
            />
            {daThu && loiTen && <small className="plc-err">{loiTen}</small>}
          </label>
          <label className="plc-field">
            <span>
              Date of birth <i>Ngày sinh (dd/mm/yyyy)</i>
            </span>
            <input
              value={tt.ngaySinh}
              onChange={(e) => onDoi({ ngaySinh: dinhDangNgay(e.target.value) })}
              placeholder="05/06/2016"
              inputMode="numeric"
              maxLength={10}
            />
            {daThu && loiNgay && <small className="plc-err">{loiNgay}</small>}
          </label>

          <h2 className="plc-h2 mt">Cấu trúc bài thi</h2>
          <ul className="plc-format">
            {DE_THI.tongKet.map((k) => (
              <li key={k.kyNang} className={`kn-${k.kyNang}`}>
                <b>{k.ten}</b>
                <span>{k.soCau} questions</span>
                <em>{k.diem} points</em>
              </li>
            ))}
          </ul>
        </section>

        <section className="plc-card">
          <h2 className="plc-h2">Kiểm tra loa / tai nghe</h2>
          <p className="plc-muted">
            Bấm phát audio bên dưới. Nếu nghe rõ, con bấm <b>Bắt đầu làm bài</b>. Nếu không nghe được, hãy kiểm tra loa
            hoặc tai nghe.
          </p>
          <Audio id={DE_THI.youtubeKiemTraLoa} />
          <ul className="plc-rules">
            <li>Đồng hồ {DE_THI.thoiGianPhut} phút bắt đầu chạy khi bấm Bắt đầu và không dừng lại.</li>
            <li>Mỗi audio nghe 2 lần. Có thể chuyển qua lại giữa các phần trước khi nộp.</li>
            <li>Hết giờ, bài sẽ tự động nộp.</li>
          </ul>
          <button
            className="plc-btn plc-btn-primary plc-btn-lg"
            onClick={() => {
              setDaThu(true);
              if (!loiTen && !loiNgay) onBatDau();
            }}
          >
            {dangLamDo ? "Làm tiếp bài đang dở →" : "Bắt đầu làm bài →"}
          </button>
        </section>
      </div>
    </>
  );
}

/* ================================================================== */

function TienDo({
  phanHienTai,
  traLoi,
  onChon,
}: {
  phanHienTai: number;
  traLoi: Record<string, string>;
  onChon: (b: Buoc) => void;
}) {
  return (
    <nav className="plc-wrap plc-steps" aria-label="Các phần thi">
      {DE_THI.phan.map((p, i) => {
        const xong = p.cauHoi.every((c) => daTraLoi(traLoi, c.id));
        return (
          <button
            key={p.id}
            className={`plc-step kn-${p.kyNang}` + (i === phanHienTai ? " is-on" : "") + (xong ? " is-done" : "")}
            onClick={() => onChon(i)}
            title={p.tieuDe}
          >
            {p.id}
          </button>
        );
      })}
    </nav>
  );
}

function PhanThi({
  phan,
  soThuTu,
  traLoi,
  onTraLoi,
  onTruoc,
  onSau,
}: {
  phan: Phan;
  soThuTu: number;
  traLoi: Record<string, string>;
  onTraLoi: (id: string, gt: string) => void;
  onTruoc: () => void;
  onSau: () => void;
}) {
  const cuoi = soThuTu === DE_THI.phan.length - 1;
  return (
    <section className={`plc-part kn-${phan.kyNang}`}>
      <div className="plc-card plc-part-head">
        <span className="plc-chip">{phan.kyNang}</span>
        <h1>{phan.tieuDe}</h1>
        <p>{phan.huongDan}</p>
      </div>

      {phan.youtube && (
        <div className="plc-card">
          <p className="plc-muted">Bấm phát audio, rồi kéo xuống trả lời câu hỏi.</p>
          <Audio id={phan.youtube} />
        </div>
      )}

      {phan.doanVan && (
        <article className="plc-card plc-passage">
          <h2>{phan.doanVan.tieuDe}</h2>
          {phan.doanVan.doan.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </article>
      )}

      {phan.anhChung && (
        <div className="plc-card">
          <img className="plc-scene" src={phan.anhChung} alt="" />
          {phan.viDu && (
            <div className="plc-example">
              <span>Example</span>
              <p>{phan.viDu.hoi}</p>
              <p className="plc-example-a">{phan.viDu.traLoi}</p>
            </div>
          )}
        </div>
      )}

      {phan.luoiAnh ? (
        <div className="plc-card">
          <div className="plc-gallery">
            {phan.luoiAnh.map((a) => (
              <figure key={a.chu}>
                <img src={a.anh} alt={`Picture ${a.chu}`} loading="lazy" />
                <figcaption>{a.chu}</figcaption>
              </figure>
            ))}
          </div>
          <div className="plc-matrix">
            {phan.cauHoi.map((c) => (
              <CauHoi key={c.id} cau={c} gt={traLoi[c.id] ?? ""} onTraLoi={onTraLoi} gon />
            ))}
          </div>
        </div>
      ) : (
        phan.cauHoi.map((c) => (
          <div className="plc-card" key={c.id}>
            <CauHoi cau={c} gt={traLoi[c.id] ?? ""} onTraLoi={onTraLoi} />
          </div>
        ))
      )}

      <div className="plc-nav">
        <button className="plc-btn" onClick={onTruoc}>
          ← Back
        </button>
        <button className="plc-btn plc-btn-primary" onClick={onSau}>
          {cuoi ? "Review & Submit →" : "Next →"}
        </button>
      </div>
    </section>
  );
}

function CauHoi({
  cau,
  gt,
  onTraLoi,
  gon,
}: {
  cau: Cau;
  gt: string;
  onTraLoi: (id: string, gt: string) => void;
  gon?: boolean;
}) {
  if (cau.kieu === "chon") {
    const coAnh = cau.luaChon.some((l) => l.anh);
    return (
      <div className={"plc-q" + (gon ? " is-row" : "")}>
        {cau.de && <h3 className="plc-q-title">{cau.de}</h3>}
        {cau.anh && <img className="plc-q-img" src={cau.anh} alt="" loading="lazy" />}
        <div className={coAnh ? "plc-pics" : cau.hang ? "plc-pills" : "plc-opts"} role="radiogroup" aria-label={cau.de}>
          {cau.luaChon.map((l) => {
            const chon = gt === l.gt;
            return (
              <button
                key={l.gt}
                type="button"
                role="radio"
                aria-checked={chon}
                className={"plc-opt" + (chon ? " is-on" : "")}
                onClick={() => onTraLoi(cau.id, l.gt)}
              >
                {l.anh && <img src={l.anh} alt="" loading="lazy" />}
                <span className="plc-opt-key">{l.gt.length === 1 ? l.gt : ""}</span>
                <span className="plc-opt-text">{l.nhan ?? (l.gt.length > 1 ? l.gt : "")}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (cau.kieu === "dien") {
    return (
      <div className="plc-q">
        {cau.de && <h3 className="plc-q-title">{cau.de}</h3>}
        <p className="plc-fill">
          {cau.truoc && <span>{cau.truoc}</span>}
          <input
            value={gt}
            onChange={(e) => onTraLoi(cau.id, e.target.value)}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label={cau.de}
          />
          {cau.sau && <span>{cau.sau}</span>}
        </p>
      </div>
    );
  }

  if (cau.kieu === "sap-xep") {
    return (
      <div className="plc-q plc-unscramble">
        <img className="plc-q-img" src={cau.anh} alt="" loading="lazy" />
        <div>
          <h3 className="plc-q-title">Question {cau.id.split("-")[1]}</h3>
          <div className="plc-tiles">
            {cau.chu.split(" ").map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <input
            className="plc-input"
            value={gt}
            onChange={(e) => onTraLoi(cau.id, e.target.value)}
            placeholder="Write the word"
            maxLength={30}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plc-q">
      <h3 className="plc-q-title">
        Question {cau.id.split("-")[1]}: <span>{cau.de}</span>
      </h3>
      <input
        className="plc-input"
        value={gt}
        onChange={(e) => onTraLoi(cau.id, e.target.value)}
        placeholder="Write a complete sentence"
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

function XemLai({
  traLoi,
  hetGio,
  dangNop,
  loi,
  onQuayLai,
  onNop,
}: {
  traLoi: Record<string, string>;
  hetGio: boolean;
  dangNop: boolean;
  loi: string;
  onQuayLai: (b: Buoc) => void;
  onNop: () => void;
}) {
  const conTrong = useMemo(() => MOI_CAU.filter((c) => !daTraLoi(traLoi, c.id)), [traLoi]);
  return (
    <section className="plc-card plc-review">
      <h1>{hetGio ? "Hết giờ làm bài" : "Kiểm tra lại trước khi nộp"}</h1>
      <p className="plc-muted">
        Đã trả lời <b>{MOI_CAU.length - conTrong.length}</b>/{MOI_CAU.length} câu.
        {conTrong.length > 0 && !hetGio && " Bấm vào một phần để làm tiếp câu còn trống."}
      </p>
      <div className="plc-review-grid">
        {DE_THI.phan.map((p, i) => {
          const tong = p.cauHoi.length;
          const xong = p.cauHoi.filter((c) => daTraLoi(traLoi, c.id)).length;
          return (
            <button
              key={p.id}
              className={`plc-review-item kn-${p.kyNang}` + (xong === tong ? " is-done" : "")}
              onClick={() => onQuayLai(i)}
              disabled={hetGio}
            >
              <b>{p.tieuDe}</b>
              <span>
                {xong}/{tong}
              </span>
            </button>
          );
        })}
      </div>
      {loi && <p className="plc-alert">{loi}</p>}
      <button className="plc-btn plc-btn-primary plc-btn-lg" disabled={dangNop} onClick={onNop}>
        {dangNop ? "Đang nộp bài…" : loi ? "Nộp lại" : "Nộp bài"}
      </button>
    </section>
  );
}

/** Audio của đề nằm trong video YouTube (giống bản Google Form). */
function Audio({ id }: { id: string }) {
  return (
    <div className="plc-audio">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`}
        title="Audio"
        allow="autoplay; encrypted-media; picture-in-picture"
        loading="lazy"
        allowFullScreen
      />
    </div>
  );
}
