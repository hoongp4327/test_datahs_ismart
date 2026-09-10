import { Link } from "react-router-dom";

/** Tên tổ chức hiển thị trên header / footer / phần ký. Sửa tại đây. */
export const ORG = {
  ten: "Trung tâm Anh ngữ",
  vietTat: "TT",
  hoiDong: "Hội đồng kiểm soát chất lượng",
  slogan: "Đồng hành cùng sự phát triển của con",
  diaChi: "Địa chỉ: (điền địa chỉ đơn vị)",
  hotline: "Hotline: 0000.000.000",
  website: "website.vn",
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
        <strong>
          {ORG.ten} — {ORG.slogan}
        </strong>
        <div>{ORG.diaChi}</div>
        <div>
          {ORG.hotline} · {ORG.website}
        </div>
      </div>
    </footer>
  );
}
