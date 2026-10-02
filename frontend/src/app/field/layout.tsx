import { ScopeProvider } from "@/lib/scope";
import { RoleProvider } from "@/lib/roleContext";

/**
 * Standalone layout for the field-worker app (D28): no dashboard shell, a mobile-width column.
 * Role gating (field/ae/admin only) happens in the view, since role is only known client-side
 * (`useRole`) — this layout stays a plain server component.
 */
export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <ScopeProvider>
        <div className="mx-auto min-h-screen w-full max-w-[480px] bg-bg px-3 py-4">{children}</div>
      </ScopeProvider>
    </RoleProvider>
  );
}
