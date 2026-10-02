import { BRAND } from "@/lib/brand";

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, background: BRAND.green }}
      className="inline-flex shrink-0 items-center justify-center rounded-md text-[12px] font-bold text-black"
    >
      L
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-[14px] font-semibold text-text">{BRAND.name}</span>
    </span>
  );
}
