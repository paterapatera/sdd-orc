import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Architecture, Config, Design, QuickSpec } from "../../schema/mod.ts";
import { exists, SDD_DIR } from "./paths.ts";

const DEFAULT_CONFIG: Config = {
  schemaVersion: "",
  tracker: "manual",
  branchPrefix: "feature/",
  staleBranchDays: 30,
};

export async function importDefault<T>(path: string): Promise<T> {
  const mod = await import(pathToFileURL(path).href);
  if (mod.default === undefined) throw new Error(`${path} に default export がありません`);
  return mod.default as T;
}

/** docs/sdd/config.ts。無ければ既定値 */
export async function loadConfig(): Promise<Config> {
  const path = join(SDD_DIR, "config.ts");
  if (!(await exists(path))) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...(await importDefault<Partial<Config>>(path)) };
}

/** docs/sdd/architecture.ts。無ければ undefined */
export async function loadArchitecture(): Promise<Architecture | undefined> {
  const path = join(SDD_DIR, "architecture.ts");
  if (!(await exists(path))) return undefined;
  return await importDefault<Architecture>(path);
}

type Impact = { create: readonly string[]; modify: readonly string[]; delete?: readonly string[] };

/** issueのディレクトリにある design.ts か spec.ts から影響範囲を読む。無ければ undefined */
export async function loadImpact(issueDir: string): Promise<Impact | undefined> {
  for (const file of ["design.ts", "spec.ts"]) {
    const path = join(issueDir, file);
    if (!(await exists(path))) continue;
    // deno-lint-ignore no-explicit-any
    const spec = await importDefault<Design<any, string> | QuickSpec<any, any>>(path);
    return spec.impact;
  }
  return undefined;
}

export function impactPaths(impact: Impact | undefined): string[] {
  if (!impact) return [];
  return [...impact.create, ...impact.modify, ...(impact.delete ?? [])];
}
