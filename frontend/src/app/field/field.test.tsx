import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { RoleProvider, useRole } from "@/lib/roleContext";
import { FieldAppView } from "./FieldAppView";
import { canUseFieldApp, outageTitle, registryTitle } from "./titles";

function RoleSetter({ role }: { role: "field" | "consumer" }) {
  const { setRole } = useRole();
  useEffect(() => {
    setRole(role);
  }, [role, setRole]);
  return null;
}

describe("titles.ts pure functions", () => {
  it("canUseFieldApp allows only field/ae/admin", () => {
    expect(canUseFieldApp("field")).toBe(true);
    expect(canUseFieldApp("ae")).toBe(true);
    expect(canUseFieldApp("admin")).toBe(true);
    expect(canUseFieldApp("consumer")).toBe(false);
    expect(canUseFieldApp("regulator")).toBe(false);
    expect(canUseFieldApp(null)).toBe(false);
  });

  it("registryTitle and outageTitle format counts", () => {
    expect(registryTitle(2)).toBe("2 registrations on file");
    expect(outageTitle(3)).toBe("3 outage reports");
  });
});

describe("FieldAppView role gate", () => {
  // Role/scope context providers seed their initial state from localStorage; without clearing it
  // between tests, the previous test's role (set via `setRole`, which persists) can still be
  // read synchronously by the next test's fresh RoleProvider before its own effect overwrites it.
  beforeEach(() => {
    localStorage.clear();
  });

  it("blocks a consumer role from the field app", async () => {
    render(
      <RoleProvider>
        <ScopeProvider>
          <RoleSetter role="consumer" />
          <FieldAppView />
        </ScopeProvider>
      </RoleProvider>,
    );
    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("lets a field role use the registry and outage forms", async () => {
    render(
      <RoleProvider>
        <ScopeProvider>
          <RoleSetter role="field" />
          <FieldAppView />
        </ScopeProvider>
      </RoleProvider>,
    );
    expect(await screen.findByText(/Register life-support home/)).toBeInTheDocument();
    expect(screen.getByText("Field Worker App")).toBeInTheDocument();
    const consentCheckbox = screen.getByRole("checkbox");
    expect(consentCheckbox).not.toBeChecked();
    fireEvent.click(consentCheckbox);
    expect(consentCheckbox).toBeChecked();
  });
});
