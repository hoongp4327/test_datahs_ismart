import type { GiaoVien } from "../../shared/giao-vien";

/**
 * Ô giáo viên, dùng chung cho tab Chờ chấm, tab Học sinh và hộp Tạo mã.
 * Có danh sách (tab GiaoVien trên sheet) → chọn tên. Chưa có danh sách → gõ tự do kèm gợi ý
 * các tên đã từng nhập, như trước.
 */
export default function ChonGiaoVien({
  id,
  ds,
  goiY,
  value,
  onChange,
}: {
  /** Riêng cho từng nơi dùng, để <datalist> không trùng id. */
  id: string;
  ds: GiaoVien[];
  goiY: string[];
  value: string;
  onChange: (ten: string) => void;
}) {
  if (!ds.length) {
    return (
      <>
        <input list={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} />
        <datalist id={id}>
          {goiY.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </>
    );
  }

  const coSo = [...new Set(ds.map((g) => g.coSo))];
  const cacMuc = (c: string) =>
    ds
      .filter((g) => g.coSo === c)
      .map((g) => (
        <option key={g.ten} value={g.ten}>
          {g.ten}
        </option>
      ));

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Chọn giáo viên —</option>
      {/* Tên đã lưu từ trước (gõ tay, hoặc giáo viên đã nghỉ): giữ nguyên, không tự xoá. */}
      {value && !ds.some((g) => g.ten === value) ? <option value={value}>{value} (ngoài danh sách)</option> : null}
      {coSo.map((c) =>
        c ? (
          <optgroup key={c} label={c}>
            {cacMuc(c)}
          </optgroup>
        ) : (
          cacMuc(c)
        )
      )}
    </select>
  );
}
