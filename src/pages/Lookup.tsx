import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteFooter, Topbar } from "../components/Layout";
import type { BaoCao } from "../types";

export default function Lookup() {
  const [ma, setMa] = useState("");
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/result?code=__warmup&refresh=1").catch(() => {});
  }, []);

  async function thucHienTraCuu(codeToSearch: string) {
    const code = codeToSearch.trim();
    if (!code) {
      setLoi("Vui lòng nhập mã học sinh.");
      inputRef.current?.focus();
      return;
    }

    setDangTai(true);
    setLoi("");
    try {
      const res = await fetch(`/api/result?code=${encodeURIComponent(code)}`);
      const json = (await res.json()) as { data?: BaoCao; message?: string };

      if (!res.ok || !json.data) {
        setLoi(json.message || "Không tìm thấy kết quả cho mã học sinh này.");
        return;
      }
      navigate(`/ket-qua?ma=${encodeURIComponent(code)}`, { state: { baoCao: json.data } });
    } catch {
      setLoi("Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setDangTai(false);
    }
  }

  function tim(e: React.FormEvent) {
    e.preventDefault();
    thucHienTraCuu(ma);
  }

  return (
    <div className="page">
      <Topbar />
      <main className="lookup-wrap">
        <div className="container lookup-wide-container">
          {/* Cấu trúc chia cột hiện đại, không co cụm */}
          <div className="lookup-grid">
            {/* Cột trái: Form tra cứu chính */}
            <div className="lookup-panel-left">
              <div className="lookup-header-tag">HỆ THỐNG TRA CỨU TRỰC TUYẾN</div>
              <h1 className="lookup-main-title">Kết quả học tập</h1>
              <p className="lookup-description">
                Tra cứu chi tiết báo cáo kết quả buổi trải nghiệm, biểu đồ phân tích 4 kỹ năng ngôn ngữ và lộ trình cá nhân hóa dành cho học viên.
              </p>

              <form onSubmit={tim} noValidate className="lookup-form">
                <div className="field">
                  <label htmlFor="ma">MÃ HỌC SINH</label>
                  <div className="input-with-icon">
                    <span className="input-icon">🔍</span>
                    <input
                      id="ma"
                      ref={inputRef}
                      value={ma}
                      onChange={(e) => {
                        setMa(e.target.value);
                        if (loi) setLoi("");
                      }}
                      placeholder=""
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                    {ma && (
                      <button
                        type="button"
                        className="btn-clear"
                        onClick={() => {
                          setMa("");
                          inputRef.current?.focus();
                        }}
                        title="Xóa mã"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                <button className="btn btn-lookup" type="submit" disabled={dangTai}>
                  {dangTai ? (
                    <span className="btn-loading">
                      <span className="btn-spinner" /> Đang tra cứu kết quả...
                    </span>
                  ) : (
                    <span>Xem Báo Cáo Kết Quả ➜</span>
                  )}
                </button>
              </form>

              {loi ? (
                <div className="alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{loi}</span>
                </div>
              ) : null}

              <p className="hint">
                Chưa có mã học sinh? Vui lòng liên hệ giáo viên phụ trách hoặc bộ phận học vụ để được cấp mã tra cứu.
              </p>
            </div>

            {/* Cột phải: Các khối thông tin nổi bật dạng Solid Card */}
            <div className="lookup-panel-right">
              <div className="preview-features-grid">
                <div className="preview-card">
                  <div className="preview-icon-box icon-cup">🏆</div>
                  <div className="preview-info">
                    <h3>Tinh thần & Tương tác</h3>
                    <p>Đo lường số cúp khen thưởng, lượt giơ tay phát biểu và tỷ lệ trả lời câu hỏi chính xác.</p>
                  </div>
                </div>

                <div className="preview-card">
                  <div className="preview-icon-box icon-chart">📊</div>
                  <div className="preview-info">
                    <h3>Đánh giá 4 Kỹ năng</h3>
                    <p>Phân tích trực quan năng lực Từ vựng, Cấu trúc, Phát âm và Tốc độ phản xạ theo thang điểm 10.</p>
                  </div>
                </div>

                <div className="preview-card">
                  <div className="preview-icon-box icon-roadmap">🎯</div>
                  <div className="preview-info">
                    <h3>Lộ trình & Chuẩn đầu ra</h3>
                    <p>Kế hoạch cá nhân hóa và tiêu chí năng lực đầu ra theo Khung ngoại ngữ 6 bậc Việt Nam.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
