import { Link } from "react-router-dom";

/** Tên tổ chức hiển thị trên header / footer / phần ký. Sửa tại đây. */
export const ORG = {
  ten: "Kết quả học tập",
  vietTat: "KQ",
  hoiDong: "Hội đồng kiểm soát chất lượng",
  slogan: "Hệ thống báo cáo & đánh giá năng lực học viên",
  diaChi: "Hệ thống tra cứu trực tuyến dành cho phụ huynh",
  hotline: "",
  website: "",
};

export function Topbar() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link to="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark">{ORG.vietTat}</span>
          <span>{ORG.ten}</span>
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
        <strong>{ORG.ten}</strong>
        <div>{ORG.slogan}</div>
        {ORG.diaChi ? <div className="footer-sub">{ORG.diaChi}</div> : null}
      </div>
    </footer>
  );
}
