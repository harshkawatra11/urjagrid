import { DashboardShell } from "@/components/shell/DashboardShell";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
