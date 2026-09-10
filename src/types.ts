export type MucNhanXet = { tieuDe: string; noiDung: string };

export type BaoCao = {
  maHocSinh: string;
  hoTen: string;
  giaoVien: string;
  lichHoc: string;
  lop: string;
  videoUrl: string;
  tinhThan: {
    soCup: string;
    gioTay: string;
    traLoiDung: string;
    nhanXet: string;
  };
  ketQua: {
    hocLuc: string;
    nhanXetTongQuan: string;
    chiTiet: MucNhanXet[];
  };
  loTrinh: {
    phanTramCoBan: string;
    phanTramNangCao: string;
    nhanXet: string;
  };
  nangLucDauRa: {
    bac: string;
    nghe: string[];
    noi: string[];
    doc: string[];
    viet: string[];
  };
  ngayCap: string;
};
