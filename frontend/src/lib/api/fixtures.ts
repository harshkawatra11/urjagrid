/**
 * Offline fixtures. Files live in `src/data/fixtures/*.json`, named after the endpoint path with
 * `/api/v1/` removed and `/` replaced by `__` (for example `subdivisions.json`,
 * `transformers__dt_sn_01.json`), and hold the raw response body for scope `all`. A missing file
 * yields the caller's typed empty value, so every page stays renderable offline.
 */

export function fixtureNameFor(path: string): string {
  const noQuery = path.split("?")[0];
  return noQuery.replace(/^\/?api\/v1\//, "").replace(/^\//, "").replace(/\//g, "__");
}

const cache = new Map<string, unknown>();

export async function loadFixture<T>(name: string, empty: T): Promise<T> {
  if (cache.has(name)) return cache.get(name) as T;
  try {
    const mod = (await import(`@/data/fixtures/${name}.json`)) as { default: T };
    cache.set(name, mod.default);
    return mod.default;
  } catch {
    return empty;
  }
}

/** Clear the memo (tests). */
export function clearFixtureCache(): void {
  cache.clear();
}

function hasSubdivision(item: unknown): item is { subdivisionId: string } {
  return typeof item === "object" && item !== null && "subdivisionId" in item;
}

/** Keep only rows of `scope` (a sub-division id). Arrays, and array-valued top-level keys, are filtered when rows carry `subdivisionId`. */
export function filterBySubdivision<T>(data: T, scope: string | undefined): T {
  if (!scope || scope === "all") return data;
  const keep = (rows: unknown[]) => rows.filter((r) => !hasSubdivision(r) || r.subdivisionId === scope);
  if (Array.isArray(data)) return keep(data) as unknown as T;
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) out[k] = Array.isArray(v) ? keep(v) : v;
    return out as T;
  }
  return data;
}
