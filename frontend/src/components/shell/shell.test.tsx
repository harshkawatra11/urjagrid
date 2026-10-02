import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/flex/chargers" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

import { ScopeProvider } from "@/lib/scope";
import { breadcrumbsFor, findActiveHref, navItems } from "./nav-items";
import { Sidebar } from "./Sidebar";

beforeEach(() => {
  nav.pathname = "/flex/chargers";
  localStorage.clear();
});

describe("sidebar active state", () => {
  it("uses the longest prefix so nested flex routes highlight the right item", () => {
    expect(findActiveHref("/flex/chargers")).toBe("/flex/chargers");
    expect(findActiveHref("/flex")).toBe("/flex");
    expect(findActiveHref("/plans/fp_a1b2c3d4")).toBe("/plans");
    expect(findActiveHref("/subdivisions/sd_subhashnagar")).toBe("/subdivisions");
    expect(findActiveHref("/nonsense")).toBeNull();
  });

  it("marks exactly one link aria-current for the active route", () => {
    render(
      <ScopeProvider>
        <Sidebar />
      </ScopeProvider>,
    );
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Managed Charging");
  });

  it("lists every sidebar route grouped by function", () => {
    expect(navItems.map((n) => n.href)).toContain("/command");
    expect(navItems.map((n) => n.href)).toContain("/plans");
    expect(navItems.map((n) => n.href)).toContain("/regulator");
    expect(new Set(navItems.map((n) => n.href)).size).toBe(navItems.length);
  });

  it("builds breadcrumbs for a drill-down route", () => {
    expect(breadcrumbsFor("/subdivisions/sd_subhashnagar", () => "Subhash Nagar").map((c) => c.label)).toEqual([
      "Flex Plans",
      "Sub-division Lab",
      "Subhash Nagar",
    ]);
  });
});
