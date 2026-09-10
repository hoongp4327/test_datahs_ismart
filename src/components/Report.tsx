import type { BaoCao } from "../types";
import { ORG } from "./Layout";

/* ---------------------------- Tiện ích nhỏ ---------------------------- */

/** Lấy chữ cái đầu của tên để làm avatar chữ. */
function initials(name: string) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const last = parts[parts.length - 1][0];
  const first = parts.length > 1 ? parts[parts.length - 2][0] : "";
  return (first + last).toUpperCase();
}

/** Học lực "C - Trung Bình" -> class màu g-c. */
function gradeClass(hocLuc: string) {
  const letter = String(hocLuc ?? "").trim()[0]?.toUpperCase();
  return letter && "ABCD".includes(letter) ? `badge g-${letter.toLowerCase()}` : "badge";
}

function Meta({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="meta-item">
      <span className="k">{k}:</span>
      <span className="v">{v}</span>
    </div>
  );
}

function Card({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <span className="num">{num}</span>
        <h2>{title}</h2>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Skill({ ten, items }: { ten: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="skill">
      <h4>{ten}</h4>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Báo cáo ------------------------------ */

export default function Report({ bc }: { bc: BaoCao }) {
  const { tinhThan, ketQua, loTrinh, nangLucDauRa } = bc;
  const coNangLuc =
    nangLucDauRa.nghe.length ||
    nangLucDauRa.noi.length ||
    nangLucDauRa.doc.length ||
    nangLucDauRa.viet.length;

  return (
    <>
      <div className="report-title">
        <h1>Kết quả buổi trải nghiệm</h1>
        <div className="rule" />
      </div>

      {/* Thông tin học sinh */}
      <section className="card">
        <div className="card-body">
          <div className="student">
            <div className="avatar">{initials(bc.hoTen)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="student-name">{bc.hoTen}</div>
              <div className="meta-grid">
                <Meta k="Mã học sinh" v={bc.maHocSinh} />
                <Meta k="Lớp" v={bc.lop} />
                <Meta k="Giáo viên" v={bc.giaoVien} />
                <Meta k="Lịch học" v={bc.lichHoc} />
                {bc.videoUrl ? (
                  <div className="meta-item">
                    <span className="k">Xem:</span>
                    <a className="v" href={bc.videoUrl} target="_blank" rel="noreferrer">
                      Video buổi học
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* I. Tinh thần học tập */}
      <Card num="I" title="Tinh thần học tập">
        <div className="stats">
          <div className="stat">
            <div className="k">Số cúp</div>
            <div className="v">{tinhThan.soCup || "—"}</div>
          </div>
          <div className="stat">
            <div className="k">Giơ tay</div>
            <div className="v">{tinhThan.gioTay || "—"}</div>
          </div>
          <div className="stat">
            <div className="k">Trả lời đúng</div>
            <div className="v">{tinhThan.traLoiDung || "—"}</div>
          </div>
        </div>
        {tinhThan.nhanXet ? <p className="quote">{tinhThan.nhanXet}</p> : null}
      </Card>

      {/* II. Kết quả học tập */}
      <Card num="II" title="Kết quả học tập">
        <div className="grade-row">
          <span className="k">Học lực hiện tại</span>
          <span className={gradeClass(ketQua.hocLuc)}>{ketQua.hocLuc || "Đang cập nhật"}</span>
        </div>
        {ketQua.nhanXetTongQuan ? <p className="quote">{ketQua.nhanXetTongQuan}</p> : null}

        {ketQua.chiTiet.length ? (
          <>
            <div className="sub-title">Nhận xét chi tiết</div>
            <div className="detail-list">
              {ketQua.chiTiet.map((m) => (
                <div className="detail" key={m.tieuDe}>
                  <h3>{m.tieuDe}</h3>
                  <p>{m.noiDung}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </Card>

      {/* III. Lộ trình học tập */}
      <Card num="III" title="Lộ trình học tập">
        <div className="roadmap">
          <div className="road-block">
            <div className="pct">{loTrinh.phanTramCoBan}</div>
            <div className="lbl">Kiến thức cơ bản</div>
          </div>
          <div className="road-plus">+</div>
          <div className="road-block">
            <div className="pct">{loTrinh.phanTramNangCao}</div>
            <div className="lbl">Kiến thức nâng cao</div>
          </div>
        </div>
        {loTrinh.nhanXet ? <p className="quote">{loTrinh.nhanXet}</p> : null}

        {coNangLuc ? (
          <>
            <div className="sub-title">Năng lực đầu ra</div>
            <div className="level-head">
              <span className="badge">{nangLucDauRa.bac}</span>
              <span className="level-note" style={{ margin: 0 }}>
                Chuẩn đầu ra theo Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam
              </span>
            </div>
            <div style={{ height: 12 }} />
            <div className="skills">
              <Skill ten="Nghe" items={nangLucDauRa.nghe} />
              <Skill ten="Nói" items={nangLucDauRa.noi} />
              <Skill ten="Đọc" items={nangLucDauRa.doc} />
              <Skill ten="Viết" items={nangLucDauRa.viet} />
            </div>
          </>
        ) : null}
      </Card>

      {/* Ký tên */}
      <div className="sign">
        {bc.ngayCap ? <div className="date">{bc.ngayCap}</div> : null}
        <div className="org">{ORG.hoiDong}</div>
      </div>
    </>
  );
}
