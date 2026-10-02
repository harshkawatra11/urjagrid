/** Brand constants for UrjaGrid. Single source of truth for product copy. */
export const BRAND = {
  name: "UrjaGrid",
  tagline: "Brownout, never blackout.",
  persona: "Urja",
  green: "#b7e34a",
  shortDescription:
    "A software-only decision layer that forecasts per-transformer demand/supply, builds Flex Plans a Junior Engineer approves, then dispatches and verifies them.",
} as const;

export type Brand = typeof BRAND;
