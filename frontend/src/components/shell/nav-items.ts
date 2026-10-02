import {
  AudioLines,
  BatteryCharging,
  Building2,
  FlaskConical,
  Gauge,
  Landmark,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Map,
  Plug,
  Radio,
  ScanLine,
  ShieldAlert,
  Smartphone,
  Thermometer,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const NAV_GROUPS = ["Command", "Flex Plans", "Network", "Flex Levers", "Insights", "Registries"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export type NavItem = { href: string; label: string; icon: LucideIcon; group: NavGroup };

/** Sidebar items, one per Lane D page (SPEC section 8), grouped by function. */
export const navItems: NavItem[] = [
  { href: "/command", label: "Grid Command Centre", icon: LayoutDashboard, group: "Command" },
  { href: "/voice", label: "Voice Control Room", icon: AudioLines, group: "Command" },
  { href: "/map", label: "Grid Map", icon: Map, group: "Command" },

  { href: "/plans", label: "Flex Plans", icon: ListChecks, group: "Flex Plans" },
  { href: "/subdivisions", label: "Sub-division Lab", icon: Building2, group: "Flex Plans" },
  { href: "/transformers", label: "Transformers", icon: Zap, group: "Flex Plans" },
  { href: "/scenario", label: "Scenario Lab", icon: FlaskConical, group: "Flex Plans" },

  { href: "/feeders", label: "Feeders", icon: Radio, group: "Network" },
  { href: "/thermal", label: "Transformer Health", icon: Thermometer, group: "Network" },
  { href: "/power-quality", label: "Voltage & Losses", icon: Gauge, group: "Network" },
  { href: "/critical", label: "Critical Loads", icon: ShieldAlert, group: "Network" },

  { href: "/flex", label: "Live Grid Ops", icon: Plug, group: "Flex Levers" },
  { href: "/flex/chargers", label: "Managed Charging", icon: BatteryCharging, group: "Flex Levers" },
  { href: "/flex/storage", label: "Storage & P2P", icon: BatteryCharging, group: "Flex Levers" },
  { href: "/flex/dr", label: "Demand Response", icon: ScanLine, group: "Flex Levers" },
  { href: "/flex/lifeline", label: "Lifeline & Fairness", icon: ShieldAlert, group: "Flex Levers" },

  { href: "/forecast", label: "Forecast Studio", icon: LineChart, group: "Insights" },
  { href: "/reliability", label: "Reliability", icon: Gauge, group: "Insights" },
  { href: "/analytics", label: "Analytics", icon: LineChart, group: "Insights" },
  { href: "/economics", label: "Economics", icon: Landmark, group: "Insights" },
  { href: "/regulator", label: "Regulator View", icon: Landmark, group: "Insights" },

  { href: "/consumers", label: "Consumers & Channels", icon: Users, group: "Registries" },
  { href: "/protocols", label: "Integrations", icon: Wrench, group: "Registries" },
  { href: "/consumer", label: "Consumer App", icon: Smartphone, group: "Registries" },
  { href: "/field", label: "Field Worker App", icon: Wrench, group: "Registries" },
];

/** Drill-down routes reached from a list, not shown in the sidebar. */
export const detailRoutes = [
  { pattern: "/plans/[planId]", label: "Flex Plan Case File" },
  { pattern: "/subdivisions/[id]", label: "Sub-division Detail" },
  { pattern: "/transformers/[dtId]", label: "Transformer Case File" },
] as const;

/** The sidebar item that owns `pathname`: the longest href that is a segment-wise prefix. */
export function findActiveHref(pathname: string, items: readonly { href: string }[] = navItems): string | null {
  let best: string | null = null;
  for (const it of items) {
    const match = pathname === it.href || pathname.startsWith(it.href + "/");
    if (match && (best === null || it.href.length > best.length)) best = it.href;
  }
  return best;
}

export type Crumb = { label: string; href?: string };

/** Breadcrumbs from the route: group, page, then the drill-down id (resolved by `resolveName`). */
export function breadcrumbsFor(pathname: string, resolveName: (segment: string) => string = (s) => s): Crumb[] {
  const activeHref = findActiveHref(pathname);
  const item = navItems.find((n) => n.href === activeHref);
  if (!item) return [];
  const crumbs: Crumb[] = [{ label: item.group }, { label: item.label, href: item.href }];
  const rest = pathname.slice(item.href.length).split("/").filter(Boolean);
  if (rest.length > 0) crumbs.push({ label: resolveName(decodeURIComponent(rest[rest.length - 1])) });
  return crumbs;
}
