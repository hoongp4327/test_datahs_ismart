import { Link } from "react-router-dom";
import Icon from "./Icon";
import { ORG } from "./Layout";

/**
 * Thanh đầu trang, chân trang và hình trang trí — CHỈ dùng cho trang kết quả.
 * Trang tra cứu dùng Topbar / SiteFooter trong Layout.tsx, giữ nguyên thiết kế gốc.
 */

export function KqTopbar() {
  return (
    <header className="kq-topbar">
      <Link to="/" className="kq-topbar-brand" aria-label="Về trang tra cứu">
        <img src="/images/ismart-logo.png" alt="iSMART Education" className="kq-topbar-logo" />
        <span className="kq-topbar-divider" aria-hidden="true" />
        <span className="kq-topbar-title">
          Tra cứu Kết quả <em>học tập</em>
        </span>
      </Link>
      <Link to="/" className="btn-pill">
        <Icon ten="search" size={18} />
        Tra cứu kết quả
      </Link>
    </header>
  );
}

export function KqFooter() {
  return (
    <footer className="kq-footer">
      <strong>{ORG.ten}</strong>
      <span>Hotline {ORG.hotline}</span>
      <a href={`https://${ORG.website}`} target="_blank" rel="noreferrer">
        {ORG.website}
      </a>
    </footer>
  );
}

/** Máy bay giấy + đường bay nét đứt — hình trang trí góc trái tiêu đề. */
export function MayBayGiay({ className = "" }: { className?: string }) {
  return (
    <svg className={`may-bay ${className}`} viewBox="0 0 220 120" aria-hidden="true">
      <path
        d="M8 108c22-4 34-20 30-34-4-13-22-11-21 1 2 16 32 14 52-2 18-14 36-34 58-46"
        fill="none"
        stroke="#F5B731"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="6 8"
      />
      <path d="M212 8 128 40l30 10z" fill="#F7A23A" />
      <path d="M212 8 158 50l6 26z" fill="#F07A1E" />
      <path d="M158 50l6 26 12-18z" fill="#D9620F" />
    </svg>
  );
}
