import { cn } from "@/lib/cn";
import type { VoiceStatus } from "@/lib/voice/client";

/**
 * A CSS-only pulsing orb representing Urja's state. Deliberately not a WebGL/three.js scene --
 * the generic reference project used react-three-fiber for this, but that is heavy machinery
 * this prototype's voice surface does not need; a gradient + animated glow reads just as well.
 */
export function Orb({ status, thinking }: { status: VoiceStatus; thinking?: boolean }) {
  const label =
    status === "connected" ? (thinking ? "Thinking" : "Listening") : status === "connecting" ? "Connecting" : status === "failed" ? "Offline" : "Idle";

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div
        aria-hidden
        className={cn(
          "relative h-40 w-40 rounded-full",
          status === "connected" && "motion-safe:animate-pulse",
        )}
        style={{
          background: "radial-gradient(circle at 35% 30%, var(--brand) 0%, var(--brand-strong) 45%, transparent 75%)",
          boxShadow: status === "connected" ? "0 0 60px var(--brand-soft)" : "none",
          opacity: status === "failed" ? 0.35 : 1,
        }}
      />
      <p role="status" className="text-[13px] font-medium text-muted">
        {label}
      </p>
    </div>
  );
}
