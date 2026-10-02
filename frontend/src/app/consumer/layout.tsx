import { ScopeProvider } from "@/lib/scope";
import { RoleProvider } from "@/lib/roleContext";

/**
 * Standalone layout for the consumer phone app (D27): no dashboard shell/sidebar, a centered
 * phone-width column, Hindi-first copy. This route sits outside `(dashboard)` on purpose — a
 * household's phone screen, not a DISCOM control-room surface.
 */
export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <ScopeProvider>
        <div lang="hi" className="mx-auto min-h-screen w-full max-w-[420px] bg-bg px-3 py-4">
          {children}
        </div>
      </ScopeProvider>
    </RoleProvider>
  );
}
