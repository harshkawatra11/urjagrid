import Image from "next/image";
import { BRAND } from "@/lib/brand";

export function LogoMark({ size = 24 }: { size?: number }) {
  const width = Math.round((size * 412) / 352);
  return (
    <Image
      src="/brand/urjagrid-logo.png"
      alt={BRAND.name}
      width={width}
      height={size}
      priority
      className="shrink-0"
    />
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] font-semibold leading-none text-text">
      <LogoMark size={22} />
      <span>
        Urja<span className="text-brand">Grid</span>
      </span>
    </span>
  );
}
