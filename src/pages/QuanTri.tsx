import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIEM_TOI_DA, KY_NANG, TONG_TOI_DA, docDiem, normalizeCode, timLevel, timMoTa, type Row } from "../../shared/bao-cao";
import { COT_SUA, KY_TU_MA, kiemTraHocSinh, type CotSua, type HocSinhSua } from "../../shared/hoc-sinh-sua";
import Icon from "../components/Icon";
import { giaoDienKyNang } from "../components/kyNangGiaoDien";
import "../quan-tri.css";

/**
 * Trang quản trị — giáo viên chọn học sinh, nhập điểm, lưu thẳng vào Google Sheet.
 *
 * Link dạng /quan-tri#<ADMIN_KEY>. Phần sau # không gửi lên server, trang tự đọc rồi
 * gửi qua header x-admin-key. Sai khoá thì server từ chối mọi thao tác.
 */

type MoTaOption = { ky_nang: string; option: string; diem_tu: string; mo_ta: string };
type DuLieu = {
  nguon: string;
  coTheGhi: boolean;
  hocSinh: Row[];
  moTa: MoTaOption[];
  thangLevel: { level: string; diem_tu: string }[];
};
type Form = Record<"ma_hoc_sinh" | CotSua, string>;

const formTrong = (ma: string): Form =>
  ({ ma_hoc_sinh: ma, ...Object.fromEntries(COT_SUA.map((c) => [c, ""])) }) as Form;

const tuRow = (r: Row): Form =>
  ({ ma_hoc_sinh: r.ma_hoc_sinh ?? "", ...Object.fromEntries(COT_SUA.map((c) => [c, r[c] ?? ""])) }) as Form;

function homNay() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Mã ngẫu nhiên bằng crypto của trình duyệt, không trùng mã đã có trong danh sách. */
function taoMa(daCo: Set<string>) {
  for (;;) {
    const so = crypto.getRandomValues(new Uint32Array(6));
    const ma = "HS-" + Array.from(so, (n) => KY_TU_MA[n % KY_TU_MA.length]).join("");
    if (!daCo.has(normalizeCode(ma))) return ma;
  }
}

function tongVaLevel(f: Form, d: DuLieu | null) {
  const diem = KY_NANG.map((k) => docDiem(f[`diem_${k.key}` as CotSua]));
  const thieu = diem.filter((x) => x === null).length;
  if (thieu || !d) return { tong: null, level: null, thieu };
  const tong = diem.reduce<number>((s, x) => s + (x ?? 0), 0);
  return { tong, level: timLevel(d.thangLevel, tong)?.level ?? null, thieu };
}

/* ---------------------------------- API ---------------------------------- */

async function goiApi<T>(khoa: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T }> {
  const res = await fetch("/api/admin", {
    ...init,
    headers: { "x-admin-key": khoa, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let json: T;
  try {
    json = await res.json();
  } catch {
    json = { message: `Máy chủ trả lỗi ${res.status}.` } as T;
  }
  return { ok: res.ok, status: res.status, json };
}

/* --------------------------------- Trang --------------------------------- */

export default function QuanTri() {
  const [khoa] = useState(() => decodeURIComponent(window.location.hash.replace(/^#/, "")));
  const [duLieu, setDuLieu] = useState<DuLieu | null>(null);
  const [trangThai, setTrangThai] = useState<"dang-tai" | "xong" | "khoa-sai" | "loi">("dang-tai");
  const [loiTai, setLoiTai] = useState("");
  const [dangTaiLai, setDangTaiLai] = useState(false);

  const [tim, setTim] = useState("");
  const [chon, setChon] = useState<string | null>(null); // mã đã chuẩn hoá, hoặc null
  const [laMoi, setLaMoi] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [goc, setGoc] = useState<Form | null>(null);
  const [loi, setLoi] = useState<Record<string, string>>({});
  const [dangLuu, setDangLuu] = useState(false);
  const [thongBao, setThongBao] = useState<{ loai: "ok" | "loi"; chu: string } | null>(null);

  useEffect(() => {
    document.title = "Quản trị kết quả — iSMART";
    // Khoá chỉ đọc một lần lúc mở trang; dán link khác (đổi phần sau #) thì tải lại từ đầu.
    const doiKhoa = () => window.location.reload();
    window.addEventListener("hashchange", doiKhoa);
    return () => window.removeEventListener("hashchange", doiKhoa);
  }, []);

  const taiDuLieu = useCallback(async () => {
    if (!khoa) {
      setTrangThai("khoa-sai");
      return;
    }
    setDangTaiLai(true);
    try {
      const r = await goiApi<DuLieu & { message?: string }>(khoa);
      if (r.status === 401 || r.status === 503) {
        setLoiTai(r.json.message ?? "");
        setTrangThai("khoa-sai");
      } else if (!r.ok) {
        setLoiTai(r.json.message ?? "Không tải được dữ liệu.");
        setTrangThai("loi");
      } else {
        setDuLieu(r.json);
        setTrangThai("xong");
      }
    } catch {
      setLoiTai("Không kết nối được máy chủ.");
      setTrangThai("loi");
    } finally {
      setDangTaiLai(false);
    }
  }, [khoa]);

  useEffect(() => {
    taiDuLieu();
  }, [taiDuLieu]);

  /* Mỗi mã một dòng — trùng mã thì lấy dòng cuối, giống trang kết quả. */
  const danhSach = useMemo(() => {
    const theoMa = new Map<string, Row>();
    for (const r of duLieu?.hocSinh ?? []) {
      const ma = normalizeCode(r.ma_hoc_sinh);
      if (ma) theoMa.set(ma, r);
    }
    return [...theoMa.entries()].map(([ma, r]) => ({ ma, r }));
  }, [duLieu]);

  const daCoMa = useMemo(() => new Set(danhSach.map((x) => x.ma)), [danhSach]);

  const locDanhSach = useMemo(() => {
    const q = tim.trim().toLowerCase();
    if (!q) return danhSach;
    const qMa = normalizeCode(q);
    return danhSach.filter(
      ({ ma, r }) =>
        (qMa && ma.includes(qMa)) ||
        `${r.ho_ten} ${r.lop} ${r.giao_vien}`.toLowerCase().includes(q)
    );
  }, [danhSach, tim]);

  const goiY = useMemo(() => {
    const lop = new Set<string>();
    const gv = new Set<string>();
    for (const { r } of danhSach) {
      if (r.lop) lop.add(r.lop);
      if (r.giao_vien) gv.add(r.giao_vien);
    }
    return { lop: [...lop].sort(), gv: [...gv].sort() };
  }, [danhSach]);

  const doiChua = useMemo(
    () => Boolean(form && goc && COT_SUA.some((c) => (form[c] ?? "") !== (goc[c] ?? ""))),
    [form, goc]
  );

  // Đóng tab khi chưa lưu thì trình duyệt hỏi lại.
  useEffect(() => {
    if (!doiChua) return;
    const chan = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", chan);
    return () => window.removeEventListener("beforeunload", chan);
  }, [doiChua]);

  const boQuaThayDoi = () => !doiChua || window.confirm("Thay đổi chưa lưu sẽ mất. Tiếp tục?");

  const moHocSinh = (ma: string, r: Row) => {
    if (!boQuaThayDoi()) return;
    setChon(ma);
    setLaMoi(false);
    window.scrollTo(0, 0);
    setForm(tuRow(r));
    setGoc(tuRow(r));
    setLoi({});
    setThongBao(null);
  };

  const themMoi = () => {
    if (!boQuaThayDoi()) return;
    const ma = taoMa(daCoMa);
    const f = { ...formTrong(ma), ngay_cham: homNay() };
    setChon(normalizeCode(ma));
    setLaMoi(true);
    window.scrollTo(0, 0);
    setForm(f);
    setGoc(formTrong(ma));
    setLoi({});
    setThongBao(null);
  };

  const dong = () => {
    if (!boQuaThayDoi()) return;
    setChon(null);
    setForm(null);
    setGoc(null);
  };

  const sua = (cot: CotSua, v: string) => {
    setForm((f) => (f ? { ...f, [cot]: v } : f));
    if (loi[cot]) setLoi(({ [cot]: _, ...con }) => con);
  };

  const luu = async () => {
    if (!form) return;
    // Mới thì gửi đủ cột; đang sửa thì chỉ gửi cột đã đổi, để không ghi đè
    // những gì người khác vừa sửa ở cột khác trên sheet.
    const gui: Record<string, string> = { ma_hoc_sinh: form.ma_hoc_sinh };
    for (const c of COT_SUA) if (laMoi || form[c] !== goc?.[c]) gui[c] = form[c];
    if (laMoi) gui.ho_ten = form.ho_ten;

    const { loi: loiKt, sach } = kiemTraHocSinh(gui);
    if (Object.keys(loiKt).length) {
      setLoi(loiKt);
      setThongBao({ loai: "loi", chu: "Kiểm tra lại các ô được đánh dấu đỏ." });
      return;
    }

    setDangLuu(true);
    setThongBao(null);
    try {
      const r = await goiApi<{ ok?: boolean; nguon?: string; message?: string; loi?: Record<string, string> }>(khoa, {
        method: "POST",
        body: JSON.stringify({ hocSinh: sach }),
      });
      if (!r.ok) {
        if (r.json.loi) setLoi(r.json.loi);
        setThongBao({ loai: "loi", chu: r.json.message ?? "Chưa lưu được." });
        return;
      }
      // Cập nhật danh sách tại chỗ, khỏi chờ đọc lại cả sheet.
      const daLuu = { ...form } as Form;
      for (const [k, v] of Object.entries(sach)) if (v !== undefined) daLuu[k as keyof Form] = v;
      setDuLieu((d) => {
        if (!d) return d;
        const ds = d.hocSinh.slice();
        let i = ds.length - 1;
        while (i >= 0 && normalizeCode(ds[i].ma_hoc_sinh) !== normalizeCode(daLuu.ma_hoc_sinh)) i--;
        if (i >= 0) ds[i] = { ...ds[i], ...daLuu };
        else ds.push(daLuu);
        return { ...d, hocSinh: ds };
      });
      setForm(daLuu);
      setGoc(daLuu);
      setLaMoi(false);
      const noi = r.json.nguon === "dữ liệu mẫu" ? "dữ liệu mẫu (chỉ trong bộ nhớ)" : "Google Sheet";
      setThongBao({ loai: "ok", chu: laMoi ? `Đã thêm ${daLuu.ho_ten} vào ${noi}.` : `Đã lưu vào ${noi}.` });
    } catch {
      setThongBao({ loai: "loi", chu: "Mất kết nối. Chưa lưu được — thử lại." });
    } finally {
      setDangLuu(false);
    }
  };

  /* ------------------------------ Trạng thái chặn ------------------------------ */

  if (trangThai === "dang-tai") {
    return (
      <div className="qt qt-chan">
        <span className="qt-spinner" aria-hidden="true" />
        <p>Đang tải danh sách học sinh…</p>
      </div>
    );
  }
  if (trangThai === "khoa-sai") {
    return (
      <div className="qt qt-chan">
        <span className="qt-chan-icon">
          <Icon ten="lock" size={28} />
        </span>
        <h1>Không mở được trang quản trị</h1>
        <p>{loiTai || "Link thiếu khoá truy cập."} Hãy mở đúng link quản trị được gửi qua email.</p>
      </div>
    );
  }
  if (trangThai === "loi" || !duLieu) {
    return (
      <div className="qt qt-chan">
        <h1>Chưa tải được dữ liệu</h1>
        <p>{loiTai}</p>
        <button className="qt-nut qt-nut-chinh" onClick={taiDuLieu}>
          <Icon ten="refresh" size={16} /> Thử lại
        </button>
      </div>
    );
  }

  /* ---------------------------------- Giao diện ---------------------------------- */

  const tl = form ? tongVaLevel(form, duLieu) : null;

  return (
    <div className={`qt qt-trang${form ? " dang-sua" : ""}`}>
      <header className="qt-dau">
        <img src="/images/ismart-logo.png" alt="iSMART Education" className="qt-logo" />
        <span className="qt-dau-ten">Chấm điểm học viên</span>
        <span className={`qt-nguon${duLieu.nguon === "dữ liệu mẫu" ? " is-mau" : ""}`}>
          {duLieu.nguon === "dữ liệu mẫu" ? "Dữ liệu mẫu — không lưu vào sheet" : `Google Sheet · ${duLieu.nguon}`}
        </span>
        <button className="qt-nut qt-nut-phu qt-tai-lai" onClick={taiDuLieu} disabled={dangTaiLai}>
          <span className={dangTaiLai ? "qt-quay" : ""}>
            <Icon ten="refresh" size={16} />
          </span>
          <span className="qt-an-hep">Tải lại</span>
        </button>
      </header>

      {!duLieu.coTheGhi ? (
        <p className="qt-canh-bao">
          Chưa cấu hình APPS_SCRIPT_URL — trang chỉ xem được, chưa lưu vào sheet được.
        </p>
      ) : null}

      <div className="qt-than">
        {/* --------------------------- Danh sách --------------------------- */}
        <aside className="qt-ds" aria-label="Danh sách học sinh">
          <div className="qt-ds-dau">
            <label className="qt-tim">
              <Icon ten="search" size={16} />
              <input
                type="search"
                placeholder="Tìm tên, mã, lớp…"
                value={tim}
                onChange={(e) => setTim(e.target.value)}
              />
            </label>
            <button className="qt-nut qt-nut-chinh" onClick={themMoi} disabled={!duLieu.coTheGhi}>
              <Icon ten="plus" size={16} /> Thêm
            </button>
          </div>
          <p className="qt-ds-dem">
            {locDanhSach.length === danhSach.length
              ? `${danhSach.length} học sinh`
              : `${locDanhSach.length} / ${danhSach.length} học sinh`}
          </p>
          <ul className="qt-ds-muc">
            {laMoi && form ? (
              <li>
                <button className="qt-hs is-chon" aria-current="true">
                  <span className="qt-hs-ten">{form.ho_ten || "Học sinh mới"}</span>
                  <span className="qt-hs-phu">{form.ma_hoc_sinh} · chưa lưu</span>
                </button>
              </li>
            ) : null}
            {locDanhSach.map(({ ma, r }) => {
              const t = tongVaLevel(tuRow(r), duLieu);
              return (
                <li key={ma}>
                  <button
                    className={`qt-hs${chon === ma && !laMoi ? " is-chon" : ""}`}
                    aria-current={chon === ma && !laMoi ? "true" : undefined}
                    onClick={() => moHocSinh(ma, r)}
                  >
                    <span className="qt-hs-ten">{r.ho_ten || "(chưa có tên)"}</span>
                    <span className="qt-hs-phu">
                      {r.ma_hoc_sinh}
                      {r.lop ? ` · ${r.lop}` : ""}
                    </span>
                    {t.tong !== null ? (
                      <span className="qt-chip is-du">
                        {t.tong} · {t.level ?? "—"}
                      </span>
                    ) : (
                      <span className="qt-chip is-thieu">Thiếu {t.thieu} điểm</span>
                    )}
                  </button>
                </li>
              );
            })}
            {!locDanhSach.length && !laMoi ? <li className="qt-ds-trong">Không có học sinh khớp.</li> : null}
          </ul>
        </aside>

        {/* ----------------------------- Biểu mẫu ----------------------------- */}
        <main className="qt-form-khung">
          {!form ? (
            <div className="qt-chua-chon">
              <p>Chọn một học sinh bên trái để nhập điểm, hoặc bấm <b>Thêm</b> để tạo học sinh mới.</p>
              <p className="qt-nho">Mã học sinh được tạo ngẫu nhiên khi thêm mới, không sửa được.</p>
            </div>
          ) : (
            <form
              key={form.ma_hoc_sinh} /* đổi học sinh = dựng lại form, để autoFocus chạy lại */
              className="qt-form"
              onSubmit={(e) => {
                e.preventDefault();
                luu();
              }}
            >
              <div className="qt-form-dau">
                <button type="button" className="qt-nut qt-nut-phu qt-quay-lai" onClick={dong}>
                  <Icon ten="arrowLeft" size={16} />
                  <span className="qt-an-hep">Danh sách</span>
                </button>
                <div className="qt-form-ten">
                  <h1>{form.ho_ten || (laMoi ? "Học sinh mới" : "(chưa có tên)")}</h1>
                  <MaHocSinh ma={form.ma_hoc_sinh} />
                </div>
                {!laMoi ? (
                  <a
                    className="qt-nut qt-nut-phu"
                    href={`/ket-qua?ma=${encodeURIComponent(form.ma_hoc_sinh)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon ten="external" size={16} />
                    <span className="qt-an-hep">Xem báo cáo</span>
                  </a>
                ) : null}
              </div>

              <section className="qt-the">
                <h2>Thông tin</h2>
                <div className="qt-luoi-2">
                  <O nhan="Họ và tên" loi={loi.ho_ten} batBuoc>
                    <input value={form.ho_ten} onChange={(e) => sua("ho_ten", e.target.value)} autoFocus={laMoi} />
                  </O>
                  <O nhan="Lớp" loi={loi.lop}>
                    <input list="qt-ds-lop" value={form.lop} onChange={(e) => sua("lop", e.target.value)} />
                  </O>
                  <O nhan="Giáo viên" loi={loi.giao_vien}>
                    <input list="qt-ds-gv" value={form.giao_vien} onChange={(e) => sua("giao_vien", e.target.value)} />
                  </O>
                  <O nhan="Ngày chấm" loi={loi.ngay_cham} goiY="dd/mm/yyyy">
                    <div className="qt-o-ghep">
                      <input
                        value={form.ngay_cham}
                        inputMode="numeric"
                        placeholder="dd/mm/yyyy"
                        onChange={(e) => sua("ngay_cham", e.target.value)}
                      />
                      <button type="button" className="qt-nut qt-nut-nho" onClick={() => sua("ngay_cham", homNay())}>
                        Hôm nay
                      </button>
                    </div>
                  </O>
                </div>
                <datalist id="qt-ds-lop">
                  {goiY.lop.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <datalist id="qt-ds-gv">
                  {goiY.gv.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </section>

              <section className="qt-the">
                <div className="qt-the-dau">
                  <h2>Điểm 4 kỹ năng</h2>
                  <div className="qt-tong" aria-live="polite">
                    {tl && tl.tong !== null ? (
                      <>
                        <b>{tl.tong}</b>/{TONG_TOI_DA}
                        <span className="qt-level">{tl.level ?? "—"}</span>
                      </>
                    ) : (
                      <span className="qt-nho">Tổng và Level hiện khi đủ 4 điểm</span>
                    )}
                  </div>
                </div>
                <div className="qt-ky-nang-ds">
                  {KY_NANG.map((k) => (
                    <DongKyNang
                      key={k.key}
                      kn={k}
                      form={form}
                      moTa={duLieu.moTa}
                      loi={loi}
                      sua={sua}
                    />
                  ))}
                </div>
              </section>

              <section className="qt-the">
                <h2>Lộ trình học tập</h2>
                <div className="qt-luoi-2">
                  <O nhan="Kiến thức cơ bản" loi={loi.pct_co_ban} goiY="Để trống = 100%">
                    <input
                      value={form.pct_co_ban}
                      placeholder="100%"
                      onChange={(e) => sua("pct_co_ban", e.target.value)}
                    />
                  </O>
                  <O nhan="Kiến thức nâng cao" loi={loi.pct_nang_cao} goiY="Để trống = 10%">
                    <input
                      value={form.pct_nang_cao}
                      placeholder="10%"
                      onChange={(e) => sua("pct_nang_cao", e.target.value)}
                    />
                  </O>
                </div>
                <O nhan="Nhận xét lộ trình" loi={loi.nhan_xet_lo_trinh}>
                  <textarea
                    rows={3}
                    value={form.nhan_xet_lo_trinh}
                    onChange={(e) => sua("nhan_xet_lo_trinh", e.target.value)}
                  />
                </O>
              </section>

              <div className="qt-thanh-luu">
                <span className={`qt-thong-bao${thongBao ? ` is-${thongBao.loai}` : ""}`} role="status">
                  {thongBao ? (
                    <>
                      {thongBao.loai === "ok" ? <Icon ten="check" size={16} /> : <Icon ten="alert" size={16} />}
                      {thongBao.chu}
                    </>
                  ) : doiChua ? (
                    "Có thay đổi chưa lưu"
                  ) : laMoi ? (
                    "Học sinh mới — chưa lưu"
                  ) : (
                    "Không có thay đổi"
                  )}
                </span>
                {doiChua && !laMoi ? (
                  <button
                    type="button"
                    className="qt-nut qt-nut-phu"
                    onClick={() => {
                      setForm(goc);
                      setLoi({});
                      setThongBao(null);
                    }}
                  >
                    Hoàn tác
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="qt-nut qt-nut-chinh"
                  disabled={dangLuu || !duLieu.coTheGhi || (!doiChua && !laMoi)}
                >
                  {dangLuu ? <span className="qt-spinner qt-spinner-nho" aria-hidden="true" /> : <Icon ten="check" size={16} />}
                  {dangLuu ? "Đang lưu…" : "Lưu vào sheet"}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------- Thành phần nhỏ ------------------------------- */

function O({
  nhan,
  loi,
  goiY,
  batBuoc,
  children,
}: {
  nhan: string;
  loi?: string;
  goiY?: string;
  batBuoc?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`qt-o${loi ? " co-loi" : ""}`}>
      <span className="qt-o-nhan">
        {nhan}
        {batBuoc ? <i aria-hidden="true">*</i> : null}
      </span>
      {children}
      {loi ? <span className="qt-o-loi">{loi}</span> : goiY ? <span className="qt-o-goi-y">{goiY}</span> : null}
    </label>
  );
}

function MaHocSinh({ ma }: { ma: string }) {
  const [daChep, setDaChep] = useState(false);
  const hen = useRef<number>();
  useEffect(() => () => window.clearTimeout(hen.current), []);
  return (
    <button
      type="button"
      className="qt-ma"
      title="Chép mã để gửi phụ huynh"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(ma);
          setDaChep(true);
          window.clearTimeout(hen.current);
          hen.current = window.setTimeout(() => setDaChep(false), 1500);
        } catch {
          /* trình duyệt chặn clipboard — bỏ qua */
        }
      }}
    >
      {ma}
      <Icon ten={daChep ? "check" : "copy"} size={14} />
      <span className="sr-only">{daChep ? "Đã chép" : "Chép mã"}</span>
    </button>
  );
}

function DongKyNang({
  kn,
  form,
  moTa,
  loi,
  sua,
}: {
  kn: (typeof KY_NANG)[number];
  form: Form;
  moTa: MoTaOption[];
  loi: Record<string, string>;
  sua: (c: CotSua, v: string) => void;
}) {
  const gd = giaoDienKyNang(kn.key);
  const cotDiem = `diem_${kn.key}` as CotSua;
  const cotOpt = `option_${kn.key}` as CotSua;
  const diem = docDiem(form[cotDiem]);
  const tuChon = form[cotOpt];

  const cacOption = useMemo(
    () =>
      moTa
        .filter((m) => m.ky_nang.trim().toLowerCase() === kn.ten.toLowerCase() && m.option)
        .sort((a, b) => Number(a.diem_tu) - Number(b.diem_tu)),
    [moTa, kn.ten]
  );

  // Option website sẽ dùng: chọn tay, hoặc tự động theo điểm.
  const dangDung = timMoTa(moTa as unknown as Row[], kn.ten, tuChon, diem);
  const tuDong = diem !== null ? timMoTa(moTa as unknown as Row[], kn.ten, "", diem) : undefined;
  // Giáo viên chọn option khác với khoảng điểm → nhắc nhẹ, không chặn.
  const lech = Boolean(tuChon && tuDong && dangDung && tuDong.option !== dangDung.option);

  return (
    <div className="qt-kn" style={{ ["--mau" as string]: gd.mau, ["--nen" as string]: gd.nen }}>
      <div className="qt-kn-ten">
        <span className="qt-kn-icon">
          <Icon ten={gd.icon} size={20} />
        </span>
        <div>
          <strong>{kn.ten}</strong>
          <span>{kn.tenViet}</span>
        </div>
      </div>

      <label className={`qt-diem${loi[cotDiem] ? " co-loi" : ""}`}>
        <span className="sr-only">Điểm {kn.ten}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={DIEM_TOI_DA}
          step={0.5}
          value={form[cotDiem]}
          onChange={(e) => sua(cotDiem, e.target.value)}
          placeholder="—"
        />
        <span>/{DIEM_TOI_DA}</span>
      </label>

      <div className="qt-kn-thanh" aria-hidden="true">
        <span style={{ width: `${((diem ?? 0) / DIEM_TOI_DA) * 100}%` }} />
      </div>

      <label className={`qt-o qt-kn-opt${loi[cotOpt] ? " co-loi" : ""}`}>
        <span className="qt-o-nhan">Mô tả chung</span>
        <select value={tuChon} onChange={(e) => sua(cotOpt, e.target.value)}>
          <option value="">Tự động theo điểm{tuDong ? ` (${tuDong.option})` : ""}</option>
          {cacOption.map((m) => (
            <option key={m.option} value={m.option}>
              {m.option} — từ {m.diem_tu} điểm
            </option>
          ))}
        </select>
        {loi[cotOpt] ? <span className="qt-o-loi">{loi[cotOpt]}</span> : null}
      </label>

      <p className={`qt-kn-mo-ta${dangDung ? "" : " is-trong"}`}>
        {lech ? (
          <span className="qt-lech">
            Điểm {diem} thường ứng với {tuDong?.option}. Kiểm tra lại nếu chọn nhầm.
          </span>
        ) : null}
        {dangDung?.mo_ta || "Nhập điểm hoặc chọn option để xem mô tả phụ huynh sẽ thấy."}
      </p>

      {kn.key === "speaking" ? (
        <label className="qt-o qt-kn-rieng">
          <span className="qt-o-nhan">Nhận xét riêng của giáo viên</span>
          <textarea
            rows={3}
            value={form.mo_ta_rieng_speaking}
            onChange={(e) => sua("mo_ta_rieng_speaking", e.target.value)}
            placeholder="Nhận xét cụ thể về phát âm, phản xạ, sự tự tin của con…"
          />
          {loi.mo_ta_rieng_speaking ? <span className="qt-o-loi">{loi.mo_ta_rieng_speaking}</span> : null}
        </label>
      ) : null}
    </div>
  );
}
