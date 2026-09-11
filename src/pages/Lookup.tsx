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
    <div className="page page-lookup-theme">
      <Topbar />
      <main className="lookup-hero-scene">
        <div className="container lookup-scene-container">
          <div className="lookup-stage-layout">
            {/* Thẻ tra cứu chính — đặt phía bên trái để nhường không gian cho Mascot iSMART phía bên phải */}
            <div className="lookup-card-solid">
              <div className="lookup-badge-pill">
                <span className="badge-dot">●</span>
                <span>CỔNG TRA CỨU HỌC TẬP iSMART</span>
              </div>

              <h1 className="lookup-card-title">
                Tra cứu <span className="text-navy">Kết quả </span>
                <span className="text-orange">học tập</span>
              </h1>

              <p className="lookup-card-desc">
                Nhập mã học sinh để xem báo cáo toàn diện buổi học, biểu đồ phân tích 4 kỹ năng Tiếng Anh và lộ trình phát triển cá nhân hóa.
              </p>

              <form onSubmit={tim} noValidate className="lookup-card-form">
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

                <button className="btn btn-ismart-action" type="submit" disabled={dangTai}>
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
                <div className="alert alert-solid" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{loi}</span>
                </div>
              ) : null}

              {/* 3 tính năng tóm tắt dạng pill solid sinh động */}
              <div className="lookup-feature-pills">
                <div className="pill-item">
                  <span className="pill-icon">🏆</span>
                  <span>Điểm cúp & Tương tác</span>
                </div>
                <div className="pill-item">
                  <span className="pill-icon">📊</span>
                  <span>Biểu đồ 4 Kỹ năng</span>
                </div>
                <div className="pill-item">
                  <span className="pill-icon">🎯</span>
                  <span>Chuẩn KNLNNVN</span>
                </div>
              </div>

              <div className="lookup-card-footer-hint">
                Chưa có mã học sinh? Vui lòng liên hệ Giáo viên phụ trách hoặc bộ phận Học vụ iSMART để được hỗ trợ.
              </div>
            </div>

            {/* Khối lời chào tương tác sinh động bên cạnh mascot */}
            <div className="mascot-greeting-zone">
              <div className="mascot-speech-bubble">
                <span className="bubble-icon">✨</span>
                <span>Chào mừng ba mẹ và học viên đến với hệ thống đánh giá năng lực iSMART!</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Phần giới thiệu các tính năng chuyên sâu trong báo cáo */}
      <section className="lookup-features-section">
        <div className="container">
          <div className="section-head-center">
            <h2 className="section-title">Báo Cáo Năng Lực Toàn Diện Cung Cấp Những Gì?</h2>
            <p className="section-subtitle">Đồng hành cùng học viên iSMART trên từng chặng đường phát triển ngôn ngữ</p>
          </div>

          <div className="features-showcase-grid">
            <div className="feature-showcase-card card-trophy">
              <div className="feature-icon-box">🏆</div>
              <h3>Tinh Thần & Tương Tác</h3>
              <p>Ghi nhận số cúp khen thưởng, tần suất giơ tay phát biểu và mức độ tập trung chủ động của con trong suốt buổi học.</p>
            </div>

            <div className="feature-showcase-card card-radar">
              <div className="feature-icon-box">📊</div>
              <h3>Đo Lường 4 Kỹ Năng Ngôn Ngữ</h3>
              <p>Biểu đồ mạng nhện Radar và thước đo chuẩn hóa chi tiết cho Từ vựng, Cấu trúc / Ngữ pháp, Phát âm chuẩn IPA và Phản xạ.</p>
            </div>

            <div className="feature-showcase-card card-path">
              <div className="feature-icon-box">🎯</div>
              <h3>Lộ Trình & Chuẩn Đầu Ra</h3>
              <p>Phân tích tỷ trọng kiến thức nền tảng và nâng cao, đối chiếu chuẩn xác với Khung năng lực ngoại ngữ 6 bậc Việt Nam.</p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
