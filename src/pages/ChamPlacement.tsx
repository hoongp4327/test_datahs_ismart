import { useEffect, useMemo, useState } from "react";
import { KY_NANG, TONG_TOI_DA, docDiem, normalizeCode, timLevel, type Row } from "../../shared/bao-cao";
import { KY_TU_MA } from "../../shared/hoc-sinh-sua";
import { DE_THI } from "../../shared/placement/de-thi";
import Icon from "../components/Icon";

/**
 * Tab "Chờ chấm" của trang quản trị: bài placement học sinh đã nộp nhưng chưa chuyển sang
 * KetQua. Giáo viên chấm Writing Part 2 (từng câu) + Speaking, bấm Xác nhận → server tạo
 * học sinh mới trong KetQua (có mã tra cứu) và đánh dấu bài đã chuyển.
 *
 * Điểm Listening / Reading / Writing Part 1 lấy từ sheet ở phía Apps Script, không lấy
 * số hiển thị ở đây — trình duyệt chỉ gửi phần giáo viên chấm.
 */

export type CauW2 = { id: string; de: string; goiY: string; toiDa: number };
export type ChoCham = { bai: Row[]; loi?: string; cauW2: CauW2[]; toiDaW2: number };

type KetQuaGoi = { ok: boolean; status: number; json: Record<string, unknown> & { message?: string; loi?: Record<string, string>; error?: string } };

type FormCham = {
  ho_ten: string;
  lop: string;
  giao_vien: string;
  diem_speaking: string;
  mo_ta_rieng_speaking: string;
  w2: string[];
};

const TOI_DA = Object.fromEntries(KY_NANG.map((k) => [k.key, k.toiDa])) as Record<string, number>;

function taoMa(daCo: Set<string>) {
  for (;;) {
    const so = crypto.getRandomValues(new Uint32Array(6));
    const ma = "HS-" + Array.from(so, (n) => KY_TU_MA[n % KY_TU_MA.length]).join("");
    if (!daCo.has(normalizeCode(ma))) return ma;
  }
}

const so = (v: string | undefined) => docDiem(v, Number.POSITIVE_INFINITY) ?? 0;
const hienSo = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default function ChamPlacement({
  choCham,
  thangLevel,
  daCoMa,
  goiY,
  coTheGhi,
  gui,
  onDaChuyen,
  onChon,
}: {
  choCham: ChoCham;
  thangLevel: Row[];
  daCoMa: Set<string>;
  goiY: { lop: string[]; gv: string[] };
  coTheGhi: boolean;
  gui: (body: unknown) => Promise<KetQuaGoi>;
  /** Đã tạo học sinh trong KetQua → trang cha thêm vào danh sách và mở học sinh đó. */
  onDaChuyen: (maBai: string, hocSinh: Row) => void;
  onChon: (dangChon: boolean) => void;
}) {
  const [tim, setTim] = useState("");
  const [chon, setChon] = useState<string | null>(null);
  const [form, setForm] = useState<FormCham | null>(null);
  const [loi, setLoi] = useState<Record<string, string>>({});
  const [dang, setDang] = useState(false);
  const [thongBao, setThongBao] = useState<{ loai: "ok" | "loi"; chu: string } | null>(null);
  const [moChiTiet, setMoChiTiet] = useState(false);

  useEffect(() => onChon(Boolean(chon)), [chon, onChon]);

  const ds = useMemo(() => {
    const q = tim.trim().toLowerCase();
    return q ? choCham.bai.filter((r) => `${r.ho_ten} ${r.ngay_sinh}`.toLowerCase().includes(q)) : choCham.bai;
  }, [choCham.bai, tim]);

  const bai = chon ? choCham.bai.find((r) => r.ma_bai === chon) ?? null : null;

  const mo = (r: Row) => {
    if (form && chon !== r.ma_bai && !window.confirm("Bài đang chấm dở sẽ mất phần đã nhập. Tiếp tục?")) return;
    setChon(r.ma_bai);
    setForm({
      ho_ten: r.ho_ten ?? "",
      lop: "",
      giao_vien: "",
      diem_speaking: "",
      mo_ta_rieng_speaking: "",
      w2: choCham.cauW2.map(() => ""),
    });
    setLoi({});
    setThongBao(null);
    setMoChiTiet(false);
    window.scrollTo(0, 0);
  };

  const dong = () => {
    setChon(null);
    setForm(null);
  };

  const sua = (k: keyof FormCham, v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    if (loi[k]) setLoi(({ [k]: _, ...con }) => con);
    setThongBao(null); // nhập tiếp thì ẩn báo lỗi cũ, hiện lại phần xem trước tổng điểm
  };
  const suaW2 = (i: number, v: string) => {
    setForm((f) => (f ? { ...f, w2: f.w2.map((x, j) => (j === i ? v : x)) } : f));
    if (loi[`w2_${i}`]) setLoi(({ [`w2_${i}`]: _, ...con }) => con);
    setThongBao(null);
  };

  /* ---- Tính trước tổng điểm để giáo viên thấy Level trước khi xác nhận ---- */
  const tinh = useMemo(() => {
    if (!bai || !form) return null;
    const w2 = form.w2.map((v, i) => docDiem(v, choCham.cauW2[i].toiDa));
    const duW2 = w2.every((x) => x !== null);
    const tongW2 = w2.reduce<number>((s, x) => s + (x ?? 0), 0);
    const writing = Math.min(TOI_DA.writing, so(bai.diem_writing_p1) + tongW2);
    const speaking = docDiem(form.diem_speaking, TOI_DA.speaking);
    const tong = duW2 && speaking !== null ? so(bai.diem_listening) + so(bai.diem_reading) + writing + speaking : null;
    const lv = tong !== null ? timLevel(thangLevel, tong) : undefined;
    return { tongW2, duW2, writing, speaking, tong, level: lv?.level ?? null, lop: lv?.lop_xep ?? "" };
  }, [bai, form, choCham.cauW2, thangLevel]);

  const xacNhan = async () => {
    if (!bai || !form || !tinh) return;
    const loiMoi: Record<string, string> = {};
    form.w2.forEach((v, i) => {
      if (docDiem(v, choCham.cauW2[i].toiDa) === null) loiMoi[`w2_${i}`] = `0–${choCham.cauW2[i].toiDa}`;
    });
    if (tinh.speaking === null) loiMoi.diem_speaking = `Điểm từ 0 đến ${TOI_DA.speaking}.`;
    if (!form.ho_ten.trim()) loiMoi.ho_ten = "Cần nhập họ tên.";
    if (Object.keys(loiMoi).length) {
      setLoi(loiMoi);
      setThongBao({ loai: "loi", chu: "Chấm đủ các ô được đánh dấu đỏ trước khi xác nhận." });
      return;
    }
    if (
      !window.confirm(
        `Xác nhận kết quả của ${form.ho_ten}: ${hienSo(tinh.tong ?? 0)}/${TONG_TOI_DA} · ${tinh.level ?? "—"}?\n` +
          "Học sinh sẽ được tạo mã tra cứu và chuyển sang danh sách học sinh."
      )
    )
      return;

    setDang(true);
    setThongBao(null);
    try {
      const r = await gui({
        action: "chamPlacement",
        maBai: bai.ma_bai,
        w2: form.w2,
        hocSinh: {
          ma_hoc_sinh: taoMa(daCoMa),
          ho_ten: form.ho_ten,
          lop: form.lop,
          giao_vien: form.giao_vien,
          diem_speaking: form.diem_speaking,
          mo_ta_rieng_speaking: form.mo_ta_rieng_speaking,
        },
      });
      if (!r.ok) {
        if (r.json.loi) setLoi(r.json.loi);
        const daCham = r.json.error === "DA_CHAM";
        setThongBao({ loai: "loi", chu: (r.json.message ?? "Chưa lưu được.") + (daCham ? " Bấm Tải lại." : "") });
        return;
      }
      const hs = r.json.hocSinh as Row;
      setChon(null);
      setForm(null);
      onDaChuyen(bai.ma_bai, hs);
    } catch {
      setThongBao({ loai: "loi", chu: "Mất kết nối. Chưa lưu được — thử lại." });
    } finally {
      setDang(false);
    }
  };

  return (
    <div className="qt-than">
      {/* ------------------------------ Danh sách bài ------------------------------ */}
      <aside className="qt-ds" aria-label="Bài placement chờ chấm">
        <div className="qt-ds-dau">
          <label className="qt-tim">
            <Icon ten="search" size={16} />
            <input type="search" placeholder="Tìm tên, ngày sinh…" value={tim} onChange={(e) => setTim(e.target.value)} />
          </label>
        </div>
        <p className="qt-ds-dem">{choCham.bai.length} bài chờ chấm</p>
        {choCham.loi ? <p className="qt-cc-loi">{choCham.loi}</p> : null}
        <ul className="qt-ds-muc">
          {ds.map((r) => (
            <li key={r.ma_bai}>
              <button
                className={`qt-hs${chon === r.ma_bai ? " is-chon" : ""}`}
                aria-current={chon === r.ma_bai ? "true" : undefined}
                onClick={() => mo(r)}
              >
                <span className="qt-hs-ten">{r.ho_ten || "(chưa có tên)"}</span>
                <span className="qt-hs-phu">
                  {r.ngay_sinh} · nộp {r.thoi_gian_nop?.slice(0, 16)}
                </span>
                <span className="qt-chip is-thieu">Chờ chấm</span>
              </button>
            </li>
          ))}
          {!ds.length ? (
            <li className="qt-ds-trong">{choCham.bai.length ? "Không có bài khớp." : "Chưa có bài nào chờ chấm."}</li>
          ) : null}
        </ul>
      </aside>

      {/* ------------------------------ Khung chấm ------------------------------ */}
      <main className="qt-form-khung">
        {!bai || !form || !tinh ? (
          <div className="qt-chua-chon">
            <p>
              Chọn một bài bên trái để chấm <b>Writing Part 2</b> và <b>Speaking</b>.
            </p>
            <p className="qt-nho">Listening, Reading và Writing Part 1 máy đã chấm sẵn.</p>
          </div>
        ) : (
          <form
            key={bai.ma_bai}
            className="qt-form"
            onSubmit={(e) => {
              e.preventDefault();
              xacNhan();
            }}
          >
            <div className="qt-form-dau">
              <button type="button" className="qt-nut qt-nut-phu qt-quay-lai" onClick={dong}>
                <Icon ten="arrowLeft" size={16} />
                <span className="qt-an-hep">Danh sách</span>
              </button>
              <div className="qt-form-ten">
                <h1>{bai.ho_ten}</h1>
                <p className="qt-nho">
                  Sinh {bai.ngay_sinh} · nộp {bai.thoi_gian_nop} · làm {bai.thoi_gian_lam_phut} phút
                  {bai.ghi_chu ? ` · ${bai.ghi_chu}` : ""}
                </p>
              </div>
            </div>

            {/* Máy đã chấm */}
            <section className="qt-the">
              <div className="qt-the-dau">
                <h2>Máy đã chấm</h2>
                <button type="button" className="qt-nut qt-nut-nho" onClick={() => setMoChiTiet((x) => !x)}>
                  {moChiTiet ? "Ẩn bài làm" : "Xem bài làm từng câu"}
                </button>
              </div>
              <div className="qt-cc-diem">
                <DiemO ten="Listening" diem={so(bai.diem_listening)} toiDa={TOI_DA.listening} />
                <DiemO ten="Reading" diem={so(bai.diem_reading)} toiDa={TOI_DA.reading} />
                <DiemO ten="Writing Part 1" diem={so(bai.diem_writing_p1)} toiDa={TOI_DA.writing - choCham.toiDaW2} />
              </div>
              {moChiTiet ? <ChiTietBaiLam bai={bai} /> : null}
            </section>

            {/* Writing Part 2 */}
            <section className="qt-the">
              <div className="qt-the-dau">
                <h2>Writing Part 2 — giáo viên chấm</h2>
                <span className="qt-tong">
                  <b>{hienSo(tinh.tongW2)}</b>/{choCham.toiDaW2}
                </span>
              </div>
              <img className="qt-cc-tranh" src="/images/placement/w2-park.webp" alt="Tranh công viên của đề" />
              {choCham.cauW2.map((c, i) => {
                const traLoi = bai[`cau_${c.id}`] ?? "";
                return (
                  <div className={`qt-cc-cau${loi[`w2_${i}`] ? " co-loi" : ""}`} key={c.id}>
                    <div className="qt-cc-cau-de">
                      <b>Câu {i + 1}.</b> {c.de}
                    </div>
                    <div className={`qt-cc-tra-loi${traLoi ? "" : " is-trong"}`}>{traLoi || "(bỏ trống)"}</div>
                    <div className="qt-cc-goi-y">Gợi ý: {c.goiY}</div>
                    <div className="qt-cc-chon" role="radiogroup" aria-label={`Điểm câu ${i + 1}`}>
                      {Array.from({ length: c.toiDa + 1 }, (_, d) => String(d)).map((d) => (
                        <button
                          type="button"
                          key={d}
                          role="radio"
                          aria-checked={form.w2[i] === d}
                          className={form.w2[i] === d ? "is-chon" : ""}
                          onClick={() => suaW2(i, d)}
                        >
                          {d}
                        </button>
                      ))}
                      <span className="qt-nho">/ {c.toiDa}</span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Speaking + thông tin */}
            <section className="qt-the">
              <h2>Speaking &amp; thông tin học sinh</h2>
              <div className="qt-luoi-2">
                <label className={`qt-o${loi.diem_speaking ? " co-loi" : ""}`}>
                  <span className="qt-o-nhan">
                    Điểm Speaking (0–{TOI_DA.speaking})<i>*</i>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={TOI_DA.speaking}
                    step={0.5}
                    value={form.diem_speaking}
                    onChange={(e) => sua("diem_speaking", e.target.value)}
                  />
                  {loi.diem_speaking ? <span className="qt-o-loi">{loi.diem_speaking}</span> : null}
                </label>
                <label className={`qt-o${loi.ho_ten ? " co-loi" : ""}`}>
                  <span className="qt-o-nhan">
                    Họ và tên<i>*</i>
                  </span>
                  <input value={form.ho_ten} onChange={(e) => sua("ho_ten", e.target.value)} />
                  {loi.ho_ten ? <span className="qt-o-loi">{loi.ho_ten}</span> : null}
                </label>
                <label className="qt-o">
                  <span className="qt-o-nhan">Lớp</span>
                  <input list="qt-cc-lop" value={form.lop} onChange={(e) => sua("lop", e.target.value)} />
                </label>
                <label className="qt-o">
                  <span className="qt-o-nhan">Giáo viên chấm</span>
                  <input list="qt-cc-gv" value={form.giao_vien} onChange={(e) => sua("giao_vien", e.target.value)} />
                </label>
              </div>
              <label className="qt-o">
                <span className="qt-o-nhan">Nhận xét riêng Speaking (hiện trên báo cáo)</span>
                <textarea
                  rows={3}
                  value={form.mo_ta_rieng_speaking}
                  onChange={(e) => sua("mo_ta_rieng_speaking", e.target.value)}
                  placeholder="Phát âm, phản xạ, sự tự tin của con…"
                />
              </label>
              <datalist id="qt-cc-lop">
                {goiY.lop.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="qt-cc-gv">
                {goiY.gv.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </section>

            <div className="qt-thanh-luu">
              <span className={`qt-thong-bao${thongBao ? ` is-${thongBao.loai}` : ""}`} role="status">
                {thongBao ? (
                  <>
                    <Icon ten="alert" size={16} /> {thongBao.chu}
                  </>
                ) : tinh.tong !== null ? (
                  <>
                    Tổng <b className="qt-cc-tong">{hienSo(tinh.tong)}</b>/{TONG_TOI_DA}
                    <span className="qt-level">{tinh.level ?? "—"}</span>
                    {tinh.lop ? <span className="qt-nho">· {tinh.lop}</span> : null}
                  </>
                ) : (
                  "Chấm đủ Writing Part 2 và Speaking để xem tổng điểm"
                )}
              </span>
              <button type="submit" className="qt-nut qt-nut-chinh" disabled={dang || !coTheGhi}>
                {dang ? <span className="qt-spinner qt-spinner-nho" aria-hidden="true" /> : <Icon ten="check" size={16} />}
                {dang ? "Đang chuyển…" : "Xác nhận"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function DiemO({ ten, diem, toiDa }: { ten: string; diem: number; toiDa: number }) {
  return (
    <div className="qt-cc-o">
      <span>{ten}</span>
      <b>
        {hienSo(diem)}
        <small>/{toiDa}</small>
      </b>
    </div>
  );
}

/** Câu trả lời từng câu máy chấm, theo phần của đề: "E ✓", "B ✗". */
function ChiTietBaiLam({ bai }: { bai: Row }) {
  return (
    <div className="qt-cc-chi-tiet">
      {DE_THI.phan
        .filter((p) => p.id !== "W2")
        .map((p) => (
          <div key={p.id}>
            <b>{p.tieuDe}</b>
            <ul>
              {p.cauHoi.map((c, i) => {
                const v = bai[`cau_${c.id}`] ?? "";
                const kq = v.endsWith("✓") ? "dung" : v.endsWith("✗") ? "sai" : "trong";
                return (
                  <li key={c.id} className={`is-${kq}`}>
                    {i + 1}. {v || "—"}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}
