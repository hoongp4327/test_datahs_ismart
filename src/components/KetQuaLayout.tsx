import { Link } from "react-router-dom";
import Icon from "./Icon";

/**
 * Thanh đầu trang — CHỈ dùng cho trang kết quả.
 * Trang tra cứu dùng Topbar / SiteFooter trong Layout.tsx, giữ nguyên thiết kế gốc.
 */
export function KqTopbar({ coIn = false }: { coIn?: boolean }) {
  return (
    <header className="bc-topbar">
      <div className="bc-topbar-trong">
        <Link to="/" className="bc-brand" aria-label="Về trang tra cứu">
          <img src="/images/ismart-logo.png" alt="iSMART Education" className="bc-logo" />
          <span className="bc-brand-vach" aria-hidden="true" />
          <span className="bc-brand-ten">
            Tra cứu Kết quả <em>học tập</em>
          </span>
        </Link>
        <div className="bc-topbar-nut">
          {coIn ? (
            <button type="button" className="bc-btn" onClick={() => window.print()}>
              <Icon ten="printer" size={16} />
              In báo cáo
            </button>
          ) : null}
          <Link to="/" className="bc-btn bc-btn-chinh">
            <Icon ten="search" size={16} />
            Tra cứu kết quả
          </Link>
        </div>
      </div>
    </header>
  );
}
