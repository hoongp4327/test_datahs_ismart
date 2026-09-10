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
    // Đọc sẵn dữ liệu mới nhất ngay khi vừa mở trang, trong lúc người dùng còn
    // đang gõ mã. Nhờ vậy lượt tra cứu vừa tức thì vừa không bao giờ là dữ liệu cũ.
    fetch("/api/result?code=__warmup&refresh=1").catch(() => {});
  }, []);

  async function tim(e: React.FormEvent) {
    e.preventDefault();
    const code = ma.trim();
    if (!code) {
      setLoi("Vui lòng nhập mã học sinh.");
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
      // Truyền sẵn dữ liệu sang trang kết quả để không phải gọi API lần hai.
      navigate(`/ket-qua?ma=${encodeURIComponent(code)}`, { state: { baoCao: json.data } });
    } catch {
      setLoi("Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setDangTai(false);
    }
  }

  return (
    <div className="page">
      <Topbar />
      <main className="lookup-wrap">
        <div className="container" style={{ display: "grid", placeItems: "center" }}>
          <div className="lookup-card">
            <h1>Tra cứu kết quả học tập</h1>
            <p className="sub">
              Nhập mã học sinh được trung tâm cung cấp để xem báo cáo kết quả buổi học.
            </p>

            <form onSubmit={tim} noValidate>
              <div className="field">
                <label htmlFor="ma">Mã học sinh</label>
                <input
                  id="ma"
                  ref={inputRef}
                  value={ma}
                  onChange={(e) => {
                    setMa(e.target.value);
                    if (loi) setLoi("");
                  }}
                  placeholder="Ví dụ: HS001"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </div>

              <button className="btn" type="submit" disabled={dangTai}>
                {dangTai ? "Đang tra cứu..." : "Xem kết quả"}
              </button>
            </form>

            {loi ? (
              <div className="alert" role="alert">
                {loi}
              </div>
            ) : null}

            <p className="hint">
              Chưa có mã học sinh? Vui lòng liên hệ giáo viên chủ nhiệm hoặc ban giáo vụ.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
