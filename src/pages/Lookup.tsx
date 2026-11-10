import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MayBayGiay, SiteFooter, Topbar } from "../components/Layout";
import Icon from "../components/Icon";
import type { BaoCao } from "../types";

/**
 * Trang tra cứu: cùng ngôn ngữ hình ảnh với trang báo cáo — nền trời, tiêu đề hai màu,
 * linh vật — nhưng chỉ có đúng một việc: gõ mã.
 */
export default function Lookup() {
  const [ma, setMa] = useState("");
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Đọc sẵn dữ liệu mới nhất trong lúc phụ huynh còn đang gõ mã.
    fetch("/api/result?code=__warmup&refresh=1").catch(() => {});
  }, []);

  async function traCuu(e: React.FormEvent) {
    e.preventDefault();
    const code = ma.trim();
    if (!code) {
      setLoi("Nhập mã học sinh để xem kết quả.");
      inputRef.current?.focus();
      return;
    }

    setDangTai(true);
    setLoi("");
    try {
      const res = await fetch(`/api/result?code=${encodeURIComponent(code)}`);
      const json = (await res.json()) as { data?: BaoCao; message?: string };
      if (!res.ok || !json.data) {
        setLoi(
          res.status === 404
            ? "Không tìm thấy mã này. Kiểm tra lại từng ký tự trong tin nhắn trung tâm gửi."
            : json.message || "Chưa tải được kết quả. Thử lại sau ít phút."
        );
        return;
      }
      navigate(`/ket-qua?ma=${encodeURIComponent(code)}`, { state: { baoCao: json.data } });
    } catch {
      setLoi("Không kết nối được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setDangTai(false);
    }
  }

  return (
    <div className="page">
      <Topbar trangTraCuu />

      <main className="lookup">
        <MayBayGiay className="lookup-plane" />
        <img src="/images/mascot-doc-sach.webp" alt="" className="lookup-mascot" />

        <div className="hero-title">
          <span className="eyebrow-pill">iSMART EDUCATION</span>
          <h1>
            <span className="t-navy">Tra cứu</span>
            <span className="t-orange">Kết quả học tập</span>
          </h1>
          <svg className="swoosh" viewBox="0 0 120 14" aria-hidden="true">
            <path d="M4 10C34 2 86 2 116 10" />
          </svg>
        </div>

        <form className="lookup-card" onSubmit={traCuu} noValidate>
          <label htmlFor="ma" className="lookup-label">
            Mã học sinh
          </label>
          <div className={`lookup-input${loi ? " has-error" : ""}`}>
            <Icon ten="search" />
            <input
              id="ma"
              ref={inputRef}
              value={ma}
              onChange={(e) => {
                setMa(e.target.value);
                if (loi) setLoi("");
              }}
              placeholder="Ví dụ: HS-7K3M9Q"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={Boolean(loi)}
              aria-describedby={loi ? "loi-ma" : "goi-y-ma"}
            />
            {ma ? (
              <button
                type="button"
                className="lookup-clear"
                onClick={() => {
                  setMa("");
                  setLoi("");
                  inputRef.current?.focus();
                }}
                aria-label="Xoá mã"
              >
                <Icon ten="close" size={18} />
              </button>
            ) : null}
          </div>

          {loi ? (
            <p id="loi-ma" className="lookup-error" role="alert">
              <Icon ten="alert" size={16} />
              {loi}
            </p>
          ) : (
            <p id="goi-y-ma" className="lookup-hint">
              Mã học sinh có trong tin nhắn trung tâm gửi phụ huynh.
            </p>
          )}

          <button className="btn-cam" type="submit" disabled={dangTai}>
            {dangTai ? <span className="btn-spinner" aria-hidden="true" /> : null}
            {dangTai ? "Đang tìm…" : "Xem báo cáo"}
          </button>
        </form>
      </main>

      <SiteFooter />
    </div>
  );
}
