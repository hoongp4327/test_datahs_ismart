import { Link } from "react-router-dom";

/** Tên tổ chức & thông tin thương hiệu iSMART Education */
export const ORG = {
  ten: "iSMART Education",
  vietTat: "iSMART",
  hoiDong: "Hội đồng kiểm soát chất lượng",
  slogan: "Hệ thống báo cáo & đánh giá năng lực học viên",
  diaChi: "Hệ thống tra cứu trực tuyến dành cho phụ huynh",
  hotline: "1900 636 109",
  website: "ismart.edu.vn",
};

export function Topbar() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link to="/" className="brand-header-link" title="iSMART Education - Tra cứu kết quả học tập">
          <img
            src="/images/ismart-logo.png"
            alt="iSMART Education"
            className="brand-logo-img"
          />
          <span className="brand-header-divider">|</span>
          <span className="brand-header-text">
            <span className="text-navy">Tra cứu&nbsp;</span>
            <span className="text-navy">Kết quả&nbsp;</span>
            <span className="text-orange">học tập</span>
          </span>
        </Link>
        <Link to="/" className="topbar-link">
          Tra cứu kết quả
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-brand-line">
          <span className="footer-brand-title">{ORG.ten}</span> — {ORG.slogan}
        </div>
        {ORG.diaChi ? <div className="footer-sub">{ORG.diaChi} • Hotline: {ORG.hotline}</div> : null}
      </div>
    </footer>
  );
}

