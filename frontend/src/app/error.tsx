"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-4 text-center text-text">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-[13px] text-muted">{error.message || "An unexpected error occurred."}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-[13px] hover:bg-surface-3"
      >
        Try again
      </button>
    </div>
  );
}
