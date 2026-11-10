import { useEffect, useRef, useState } from "react";

/**
 * Ngôn ngữ chuyển động của báo cáo — điềm đạm, không nảy, đúng giọng thương hiệu
 * "chuyên nghiệp, đáng tin". Thời lượng và đường cong khai báo một chỗ trong
 * report.css (--bc-ease, --bc-dur-*); file này chỉ lo phần cần JavaScript.
 */

/** Người dùng bật "giảm chuyển động" trong hệ điều hành → hiện ngay trạng thái cuối. */
export function giamChuyenDong(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Đếm từ 0 lên `dich`. Trả về số đang chạy; `null` thì trả `null` (chưa có điểm).
 * Chạy cùng nhịp với đa giác radar nở ra để con số và hình dạng "đến" cùng lúc.
 */
export function useDemSo(dich: number | null, treMs = 0, thoiGianMs = 900): number | null {
  const [giaTri, setGiaTri] = useState<number | null>(() =>
    dich === null ? null : giamChuyenDong() ? dich : 0
  );

  useEffect(() => {
    if (dich === null) {
      setGiaTri(null);
      return;
    }
    if (giamChuyenDong()) {
      setGiaTri(dich);
      return;
    }
    let raf = 0;
    const batDau = performance.now() + treMs;
    const buoc = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - batDau) / thoiGianMs));
      setGiaTri(dich * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(buoc);
    };
    raf = requestAnimationFrame(buoc);
    return () => cancelAnimationFrame(raf);
  }, [dich, treMs, thoiGianMs]);

  return giaTri;
}

/** Hiển thị số đang đếm: đích là số nguyên thì làm tròn, có lẻ thì 1 chữ số thập phân. */
export function hienSoDem(dangChay: number | null, dich: number | null): string {
  if (dangChay === null || dich === null) return "—";
  return Number.isInteger(dich) ? String(Math.round(dangChay)) : dangChay.toFixed(1).replace(".", ",");
}

/**
 * Gắn vào một khối để nó hiện dần khi cuộn tới (một lần duy nhất).
 * Không có IntersectionObserver hoặc đang giảm chuyển động → hiện ngay.
 * Bản in luôn hiện đủ nhờ quy tắc @media print trong report.css.
 */
export function useHienKhiCuon<T extends HTMLElement>(nguong = 0.15) {
  const ref = useRef<T>(null);
  const [daHien, setDaHien] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || giamChuyenDong() || typeof IntersectionObserver === "undefined") {
      setDaHien(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDaHien(true);
          io.disconnect();
        }
      },
      { threshold: nguong }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nguong]);

  return [ref, daHien] as const;
}
