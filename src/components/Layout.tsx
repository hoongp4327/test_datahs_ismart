import { Link } from "react-router-dom";
import Icon from "./Icon";

/** Thông tin đơn vị — hiện ở chân trang và phần ký báo cáo. */
export const ORG = {
  ten: "iSMART Education",
  hoiDong: "Hội đồng kiểm soát chất lượng",
  /** Địa danh ở dòng ký tên: "Hà Nội, ngày ... tháng ... năm ..." */
  diaDiem: "Hà Nội",
  hotline: "1900 636 109",
  website: "ismart.edu.vn",
};

/** Thanh đầu trang. Ở trang tra cứu thì ẩn nút "Tra cứu kết quả" vì đang ở đó rồi. */
export function Topbar({ trangTraCuu = false }: { trangTraCuu?: boolean }) {
  return (
    <header className="topbar">
      <Link to="/" className="topbar-brand" aria-label="Về trang tra cứu">
        <img src="/images/ismart-logo.png" alt="iSMART Education" className="topbar-logo" />
        <span className="topbar-divider" aria-hidden="true" />
        <span className="topbar-title">
          Tra cứu Kết quả <em>học tập</em>
        </span>
      </Link>
      {!trangTraCuu && (
        <Link to="/" className="btn-pill">
          <Icon ten="search" size={18} />
          Tra cứu kết quả
        </Link>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
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
