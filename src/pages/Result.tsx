import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { KqTopbar } from "../components/KetQuaLayout";
import Icon from "../components/Icon";
import BanIn from "../components/BanIn";
import Report from "../components/Report";
import type { BaoCao } from "../types";
import "../ket-qua.css";
import "../ban-in.css";

type TrangThai =
  | { loai: "dang-tai" }
  | { loai: "xong"; baoCao: BaoCao }
  /** Mã có thật nhưng chưa đánh giá được: chưa làm bài, hoặc đang chờ giáo viên chấm Speaking. */
  | { loai: "cho"; message: string }
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
      setTt({ loai: "loi", message: "Đường dẫn thiếu mã học sinh." });
      return;
    }

    let huy = false;
    (async () => {
      try {
        // Mở bằng link trực tiếp thì không có bước gõ mã để đọc sẵn, nên đọc mới tại đây.
        const res = await fetch(`/api/result?code=${encodeURIComponent(ma)}&refresh=1`);
        const json = (await res.json()) as { data?: BaoCao; message?: string; cho?: { message: string } };
        if (huy) return;
        if (res.ok && json.cho) {
          setTt({ loai: "cho", message: json.cho.message });
          return;
        }
        if (!res.ok || !json.data) {
          setTt({
            loai: "loi",
            message:
              res.status === 404
                ? "Không tìm thấy mã học sinh này."
                : json.message || "Chưa tải được kết quả. Thử lại sau ít phút.",
          });
          return;
        }
        setTt({ loai: "xong", baoCao: json.data });
      } catch {
        if (!huy) setTt({ loai: "loi", message: "Không kết nối được. Kiểm tra mạng rồi thử lại." });
      }
    })();

    return () => {
      huy = true;
    };
  }, [ma, sanCo]);

  useEffect(() => {
    if (tt.loai === "xong") document.title = `${tt.baoCao.hoTen} — Báo cáo năng lực`;
  }, [tt]);

  return (
    <div className="kq">
      <KqTopbar coIn={tt.loai === "xong"} />
      <main className="bc-main">
        <div className="bc-wrap">
          <Link to="/" className="bc-back">
            <Icon ten="arrowLeft" size={15} />
            Tra cứu mã khác
          </Link>

          {tt.loai === "dang-tai" ? (
            <div className="bc-state" role="status">
              <span className="bc-spinner" aria-hidden="true" />
              Đang tải kết quả…
            </div>
          ) : null}

          {tt.loai === "cho" ? (
            <div className="bc-state" role="status">
              <span className="bc-state-icon" aria-hidden="true">⏳</span>
              <p>{tt.message}</p>
              <Link to="/" className="bc-btn bc-btn-chinh">
                <Icon ten="arrowLeft" size={16} />
                Về trang tra cứu
              </Link>
            </div>
          ) : null}

          {tt.loai === "loi" ? (
            <div className="bc-state">
              <p>{tt.message}</p>
              <Link to="/" className="bc-btn bc-btn-chinh">
                <Icon ten="arrowLeft" size={16} />
                Nhập lại mã
              </Link>
            </div>
          ) : null}

          {tt.loai === "xong" ? <Report bc={tt.baoCao} /> : null}
        </div>

        <div className="bc-waves" aria-hidden="true" />
      </main>

      {/* Bản in A4 trắng đen: chỉ hiện khi in, trang web ở trên bị ẩn đi. */}
      {tt.loai === "xong" ? <BanIn bc={tt.baoCao} /> : null}
    </div>
  );
}
