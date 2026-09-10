import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { SiteFooter, Topbar } from "../components/Layout";
import Report from "../components/Report";
import type { BaoCao } from "../types";

type TrangThai =
  | { loai: "dang-tai" }
  | { loai: "xong"; baoCao: BaoCao }
  | { loai: "loi"; message: string };

export default function Result() {
  const [params] = useSearchParams();
  const ma = (params.get("ma") ?? "").trim();
  const location = useLocation();
  // Dữ liệu được trang tra cứu truyền sang -> hiển thị ngay, khỏi gọi API lại.
  const sanCo = (location.state as { baoCao?: BaoCao } | null)?.baoCao;

  const [tt, setTt] = useState<TrangThai>(
    sanCo ? { loai: "xong", baoCao: sanCo } : { loai: "dang-tai" }
  );

  useEffect(() => {
    if (sanCo) return;
    if (!ma) {
      setTt({ loai: "loi", message: "Thiếu mã học sinh trong đường dẫn." });
      return;
    }

    let huy = false;
    (async () => {
      try {
        // Mở bằng link trực tiếp thì không có bước gõ mã để đọc sẵn, nên đọc mới tại đây.
        const res = await fetch(`/api/result?code=${encodeURIComponent(ma)}&refresh=1`);
        const json = (await res.json()) as { data?: BaoCao; message?: string };
        if (huy) return;

        if (!res.ok || !json.data) {
          setTt({
            loai: "loi",
            message: json.message || "Không tìm thấy kết quả cho mã học sinh này.",
          });
          return;
        }
        setTt({ loai: "xong", baoCao: json.data });
      } catch {
        if (!huy) setTt({ loai: "loi", message: "Không kết nối được máy chủ." });
      }
    })();

    return () => {
      huy = true;
    };
  }, [ma, sanCo]);

  useEffect(() => {
    if (tt.loai === "xong") document.title = `Kết quả học tập — ${tt.baoCao.hoTen}`;
  }, [tt]);

  return (
    <div className="page">
      <Topbar />
      <main className="report">
        <div className="container">
          <Link to="/" className="back-link">
            ← Tra cứu mã khác
          </Link>

          {tt.loai === "dang-tai" ? (
            <div className="state">
              <div className="spinner" />
              Đang tải kết quả...
            </div>
          ) : null}

          {tt.loai === "loi" ? (
            <div className="state">
              <p style={{ fontSize: 16, color: "var(--ink-2)" }}>{tt.message}</p>
              <Link to="/" className="btn-ghost" style={{ display: "inline-block", marginTop: 12 }}>
                Quay lại tra cứu
              </Link>
            </div>
          ) : null}

          {tt.loai === "xong" ? (
            <>
              <Report bc={tt.baoCao} />
              <div className="actions">
                <button className="btn-ghost" onClick={() => window.print()}>
                  In / Lưu PDF
                </button>
                <Link to="/" className="btn-ghost">
                  Tra cứu mã khác
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
