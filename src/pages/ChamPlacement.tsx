import { useEffect, useMemo, useState } from "react";
import { KY_NANG, TONG_TOI_DA, docDiem, normalizeCode, timLevel, type Row } from "../../shared/bao-cao";
import { KY_TU_MA } from "../../shared/hoc-sinh-sua";
import { DE_THI } from "../../shared/placement/de-thi";
import Icon from "../components/Icon";

/**
 * Tab "Chờ chấm" của trang quản trị: bài placement học sinh đã nộp nhưng CÒN THIẾU điểm
 * giáo viên chấm. Hai phần chấm độc lập:
 *   - Writing Part 2 (từng câu) — chấm được ngay khi học sinh nộp bài
 *   - Speaking — thường tổ chức thi riêng, chấm gom sau; trong lúc chờ bài vẫn nằm ở đây
 *     với nhãn "Chờ Speaking", và phụ huynh tra cứu sẽ thấy thông báo chưa đánh giá được.
 * Điểm ghi vào đúng MÃ HỌC SINH em đã nhập lúc làm bài (mã do giáo viên cấp trước).
 *
 * Điểm Listening / Reading / Writing Part 1 lấy từ sheet ở phía Apps Script, không lấy
 * số hiển thị ở đây — trình duyệt chỉ gửi phần giáo viên chấm.
 */

export type CauW2 = { id: string; de: string; goiY: string; toiDa: number };
export type ChoCham = { bai: Row[]; loi?: string; cauW2: CauW2[]; toiDaW2: number };
/** Server trả sau mỗi lần lưu điểm — xem KetQuaCham trong shared/placement/cham.ts. */
export type DaLuuCham = { hocSinh: Row; xong: boolean; bai: Record<string, string> };

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
const coGiaTri = (v: string | undefined) => String(v ?? "").trim() !== "";
/** Bài còn chờ phần nào: nhãn hiện ở danh sách và đầu khung chấm. */
function nhanCho(r: Row) {
  const w2 = coGiaTri(r.diem_writing_p2_gv);
  const noi = coGiaTri(r.diem_speaking);
  return w2 ? "Chờ Speaking" : noi ? "Chờ Writing P2" : "Chờ Writing + Speaking";
}
const hienSo = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default function ChamPlacement({
  choCham,
  thangLevel,
  daCoMa,
  hocSinhTheoMa,
  goiY,
  coTheGhi,
  gui,
  onDaLuu,
  onChon,
}: {
  choCham: ChoCham;
  thangLevel: Row[];
  daCoMa: Set<string>;
  /** Dòng KetQua theo mã đã chuẩn hoá — lấy tên, lớp giáo viên đã nhập sẵn cho mã đó. */
  hocSinhTheoMa: Map<string, Row>;
  goiY: { lop: string[]; gv: string[] };
  coTheGhi: boolean;
  gui: (body: unknown) => Promise<KetQuaGoi>;
  /** Đã lưu điểm → trang cha cập nhật danh sách; chấm đủ cả hai phần thì mở học sinh đó. */
  onDaLuu: (maBai: string, kq: DaLuuCham) => void;
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
    return q
      ? choCham.bai.filter((r) => `${r.ho_ten} ${r.ngay_sinh} ${r.ma_hoc_sinh ?? ""}`.toLowerCase().includes(q))
      : choCham.bai;
  }, [choCham.bai, tim]);

  const bai = chon ? choCham.bai.find((r) => r.ma_bai === chon) ?? null : null;

  const mo = (r: Row) => {
    if (form && chon !== r.ma_bai && !window.confirm("Bài đang chấm dở sẽ mất phần đã nhập. Tiếp tục?")) return;
    setChon(r.ma_bai);
    // Thông tin giáo viên đã nhập cho mã này (lúc tạo mã / sửa ở tab Học sinh) được ưu tiên
    // hơn tên học sinh tự gõ lúc làm bài.
    const hs = hocSinhTheoMa.get(normalizeCode(r.ma_hoc_sinh ?? ""));
    setForm({
      ho_ten: hs?.ho_ten || r.ho_ten || "",
      lop: hs?.lop ?? "",
      giao_vien: hs?.giao_vien ?? "",
      diem_speaking: coGiaTri(r.diem_speaking) ? "" : hs?.diem_speaking ?? "",
      mo_ta_rieng_speaking: hs?.mo_ta_rieng_speaking ?? "",
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
    // Phần đã chấm lần trước (có điểm trên dòng bài làm) thì khoá, lấy điểm đã lưu.
    const daCoW2 = coGiaTri(bai.diem_writing_p2_gv);
    const daCoNoi = coGiaTri(bai.diem_speaking);
    const w2 = form.w2.map((v, i) => docDiem(v, choCham.cauW2[i].toiDa));
    /** Lần này có chấm phần viết không: đã bấm điểm ít nhất một câu. */
    const chamW2 = !daCoW2 && form.w2.some((v) => v !== "");
    const duW2 = daCoW2 || w2.every((x) => x !== null);
    const tongW2 = daCoW2 ? so(bai.diem_writing_p2_gv) : w2.reduce<number>((s, x) => s + (x ?? 0), 0);
    const writing = Math.min(TOI_DA.writing, so(bai.diem_writing_p1) + tongW2);
    const chamNoi = !daCoNoi && form.diem_speaking.trim() !== "";
    const speaking = daCoNoi ? so(bai.diem_speaking) : docDiem(form.diem_speaking, TOI_DA.speaking);
    const tong = duW2 && speaking !== null ? so(bai.diem_listening) + so(bai.diem_reading) + writing + speaking : null;
    const lv = tong !== null ? timLevel(thangLevel, tong) : undefined;
    return { daCoW2, daCoNoi, chamW2, chamNoi, tongW2, duW2, writing, speaking, tong, level: lv?.level ?? null, lop: lv?.lop_xep ?? "" };
  }, [bai, form, choCham.cauW2, thangLevel]);

  const xacNhan = async () => {
    if (!bai || !form || !tinh) return;
    const loiMoi: Record<string, string> = {};
    // Writing Part 2: đã bắt đầu chấm thì phải chấm đủ 4 câu; chưa đụng tới thì để lần sau.
    if (tinh.chamW2) {
      form.w2.forEach((v, i) => {
        if (docDiem(v, choCham.cauW2[i].toiDa) === null) loiMoi[`w2_${i}`] = `0–${choCham.cauW2[i].toiDa}`;
      });
    }
    if (tinh.chamNoi && tinh.speaking === null) loiMoi.diem_speaking = `Điểm từ 0 đến ${TOI_DA.speaking}.`;
    if (!form.ho_ten.trim()) loiMoi.ho_ten = "Cần nhập họ tên.";
    if (Object.keys(loiMoi).length) {
      setLoi(loiMoi);
      setThongBao({ loai: "loi", chu: "Kiểm tra lại các ô được đánh dấu đỏ." });
      return;
    }
    if (!tinh.chamW2 && !tinh.chamNoi) {
      setThongBao({ loai: "loi", chu: "Chấm Writing Part 2 hoặc nhập điểm Speaking rồi mới lưu." });
      return;
    }
    // Chỉ hỏi lại khi lần lưu này chốt kết quả cuối (đủ cả hai phần) — phụ huynh sẽ tra cứu được.
    if (
      tinh.tong !== null &&
      !window.confirm(
        `Xác nhận kết quả của ${form.ho_ten}: ${hienSo(tinh.tong)}/${TONG_TOI_DA} · ${tinh.level ?? "—"}?\n` +
          "Sau khi xác nhận, phụ huynh tra cứu bằng mã học sinh sẽ xem được báo cáo."
      )
    )
      return;

    setDang(true);
    setThongBao(null);
    try {
      const r = await gui({
        action: "chamPlacement",
        maBai: bai.ma_bai,
        w2: tinh.chamW2 ? form.w2 : [],
        hocSinh: {
          // Bài nộp kiểu cũ chưa có mã → tạo mã mới; còn lại server dùng mã trên dòng bài làm.
          ma_hoc_sinh: bai.ma_hoc_sinh || taoMa(daCoMa),
          ho_ten: form.ho_ten,
          lop: form.lop,
          giao_vien: form.giao_vien,
          ...(tinh.chamNoi
            ? { diem_speaking: form.diem_speaking, mo_ta_rieng_speaking: form.mo_ta_rieng_speaking }
            : {}),
        },
      });
      if (!r.ok) {
        if (r.json.loi) setLoi(r.json.loi);
        const daCham = r.json.error === "DA_CHAM";
        setThongBao({ loai: "loi", chu: (r.json.message ?? "Chưa lưu được.") + (daCham ? " Bấm Tải lại." : "") });
        return;
      }
      const kq = r.json as unknown as DaLuuCham;
      if (kq.xong) {
        setChon(null);
        setForm(null);
      } else {
        // Mới chấm một phần: giữ khung chấm, phần vừa lưu chuyển sang trạng thái đã chấm.
        setForm((f) => (f ? { ...f, w2: f.w2.map(() => "") } : f));
        setLoi({});
        setThongBao({
          loai: "ok",
          chu: tinh.chamW2
            ? "Đã lưu điểm Writing Part 2. Bài vẫn nằm ở Chờ chấm tới khi có điểm Speaking."
            : "Đã lưu điểm Speaking. Bài vẫn nằm ở Chờ chấm tới khi chấm Writing Part 2.",
        });
      }
      onDaLuu(bai.ma_bai, kq);
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
                  {r.ma_hoc_sinh ? `${r.ma_hoc_sinh} · ` : ""}
                  {r.ngay_sinh} · nộp {r.thoi_gian_nop?.slice(0, 16)}
                </span>
                <span className="qt-chip is-thieu">{nhanCho(r)}</span>
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
            <p className="qt-nho">
              Listening, Reading và Writing Part 1 máy đã chấm sẵn. Speaking chấm sau cũng được — bài nằm ở đây với nhãn
              “Chờ Speaking” cho tới khi có điểm.
            </p>
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
                  {bai.ma_hoc_sinh ? `Mã ${bai.ma_hoc_sinh} · ` : "Bài nộp kiểu cũ, chưa có mã — sẽ tạo mã khi lưu · "}
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
                <h2>Writing Part 2 — {tinh.daCoW2 ? "đã chấm" : "giáo viên chấm"}</h2>
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
                    <div className="qt-cc-chon" role="radiogroup" aria-label={`Điểm câu ${i + 1}`} hidden={tinh.daCoW2}>
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
              {tinh.daCoW2 ? (
                <p className="qt-nho">Phần viết đã chấm xong. Muốn sửa điểm Writing, mở học sinh ở tab Học sinh.</p>
              ) : null}
            </section>

            {/* Speaking + thông tin */}
            <section className="qt-the">
              <h2>Speaking &amp; thông tin học sinh</h2>
              <div className="qt-luoi-2">
                <label className={`qt-o${loi.diem_speaking ? " co-loi" : ""}`}>
                  <span className="qt-o-nhan">Điểm Speaking (0–{TOI_DA.speaking})</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={TOI_DA.speaking}
                    step={0.5}
                    value={tinh.daCoNoi ? bai.diem_speaking : form.diem_speaking}
                    disabled={tinh.daCoNoi}
                    onChange={(e) => sua("diem_speaking", e.target.value)}
                  />
                  {loi.diem_speaking ? (
                    <span className="qt-o-loi">{loi.diem_speaking}</span>
                  ) : (
                    <span className="qt-o-goi-y">
                      {tinh.daCoNoi ? "Đã chấm." : "Chưa thi nói thì để trống — chấm sau, bài vẫn nằm ở Chờ chấm."}
                    </span>
                  )}
                </label>
                <label className={`qt-o${loi.ho_ten ? " co-loi" : ""}`}>
                  <span className="qt-o-nhan">
                    Họ và tên<i>*</i>
                  </span>
                  <input value={form.ho_ten} onChange={(e) => sua("ho_ten", e.target.value)} />
                  {loi.ho_ten ? <span className="qt-o-loi">{loi.ho_ten}</span> : null}
                </label>
                <label className="qt-o">
                  <span className="qt-o-nhan">Thông tin (lớp, trường…)</span>
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
                    <Icon ten={thongBao.loai === "ok" ? "check" : "alert"} size={16} /> {thongBao.chu}
                  </>
                ) : tinh.tong !== null ? (
                  <>
                    Tổng <b className="qt-cc-tong">{hienSo(tinh.tong)}</b>/{TONG_TOI_DA}
                    <span className="qt-level">{tinh.level ?? "—"}</span>
                    {tinh.lop ? <span className="qt-nho">· {tinh.lop}</span> : null}
                  </>
                ) : tinh.duW2 && (tinh.daCoW2 || tinh.chamW2) ? (
                  "Chưa có điểm Speaking — lưu được, bài sẽ nằm ở Chờ chấm Speaking"
                ) : (
                  "Chấm đủ Writing Part 2 và Speaking để xem tổng điểm"
                )}
              </span>
              <button type="submit" className="qt-nut qt-nut-chinh" disabled={dang || !coTheGhi}>
                {dang ? <span className="qt-spinner qt-spinner-nho" aria-hidden="true" /> : <Icon ten="check" size={16} />}
                {dang ? "Đang lưu…" : tinh.tong !== null ? "Xác nhận kết quả" : "Lưu điểm"}
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
