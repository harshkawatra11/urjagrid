import type { Role } from "@/lib/roleContext";

/** Pure title/label + role-gate functions for the field-worker app (D28). */

export const FIELD_ALLOWED_ROLES: readonly Role[] = ["field", "ae", "admin"];

export function canUseFieldApp(role: Role | null): boolean {
  return role !== null && FIELD_ALLOWED_ROLES.includes(role);
}

export function registryTitle(count: number): string {
  return `${count} registrations on file`;
}

export function outageTitle(count: number): string {
  return `${count} outage reports`;
}
