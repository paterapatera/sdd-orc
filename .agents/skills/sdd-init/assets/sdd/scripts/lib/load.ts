import { join } from "node:path";
import type {
  BaselineNfrs,
  Conventions,
  Design,
  FrId,
  FunctionalRequirement,
  Invariant,
  InvId,
  QuickSpec,
  Requirements,
  Tasks,
} from "../../schema/mod.ts";
import { importDefault, loadConfig } from "./config.ts";
import { exists, SDD_DIR, SPECS_DIR } from "./paths.ts";

// 実行時に読み込むspecの型。IDはすべて string として扱う。
export type LooseRequirements = Requirements;
export type LooseDesign = Design<Requirements, string>;
export type LooseTasks = Tasks<string, string>;
export type LooseQuickSpec = QuickSpec<
  Readonly<Record<FrId, FunctionalRequirement>>,
  Readonly<Record<InvId, Invariant>>
>;

export type SpecFile = "requirements.ts" | "design.ts" | "tasks.ts" | "spec.ts";

export type LoadedIssue = {
  id: string;
  dir: string;
  /** full: 完全モード、quick: 軽量モード、mixed: 両方のファイルがある、none: specがまだ無い */
  mode: "full" | "quick" | "mixed" | "none";
  issueMd?: string;
  requirements?: LooseRequirements;
  design?: LooseDesign;
  tasks?: LooseTasks;
  quick?: LooseQuickSpec;
  /** 読み込みに失敗したファイルとその理由 */
  loadErrors: { file: SpecFile; message: string }[];
};

/** docs/specs にあるissueのIDの一覧 */
export async function listIssueIds(): Promise<string[]> {
  if (!(await exists(SPECS_DIR))) return [];
  const ids: string[] = [];
  for await (const e of Deno.readDir(SPECS_DIR)) {
    if (e.isDirectory && !e.name.startsWith(".") && !e.name.startsWith("_")) ids.push(e.name);
  }
  return ids.sort();
}

export async function loadIssue(id: string): Promise<LoadedIssue> {
  const dir = join(SPECS_DIR, id);
  const issue: LoadedIssue = { id, dir, mode: "none", loadErrors: [] };

  const issuePath = join(dir, "issue.md");
  if (await exists(issuePath)) issue.issueMd = await Deno.readTextFile(issuePath);

  const load = async <T>(file: SpecFile): Promise<T | undefined> => {
    const path = join(dir, file);
    if (!(await exists(path))) return undefined;
    try {
      return await importDefault<T>(path);
    } catch (e) {
      issue.loadErrors.push({ file, message: e instanceof Error ? e.message : String(e) });
      return undefined;
    }
  };

  issue.requirements = await load<LooseRequirements>("requirements.ts");
  issue.design = await load<LooseDesign>("design.ts");
  issue.tasks = await load<LooseTasks>("tasks.ts");
  issue.quick = await load<LooseQuickSpec>("spec.ts");

  const full = [issue.requirements, issue.design, issue.tasks].some((x) => x !== undefined) ||
    issue.loadErrors.some((e) => e.file !== "spec.ts");
  const quick = issue.quick !== undefined || issue.loadErrors.some((e) => e.file === "spec.ts");
  issue.mode = full && quick ? "mixed" : full ? "full" : quick ? "quick" : "none";
  return issue;
}

/** docs/sdd/nfr.ts の基準があるカテゴリ。ファイルが無ければ undefined */
export async function loadBaselineNfrCategories(): Promise<Set<string> | undefined> {
  const path = join(SDD_DIR, "nfr.ts");
  if (!(await exists(path))) return undefined;
  const nfrs = await importDefault<BaselineNfrs>(path);
  return new Set(Object.values(nfrs).map((n) => n.category));
}

/** docs/sdd/nfr.ts の基準のID。ファイルが無ければ undefined */
export async function loadBaselineNfrIds(): Promise<Set<string> | undefined> {
  const path = join(SDD_DIR, "nfr.ts");
  if (!(await exists(path))) return undefined;
  const nfrs = await importDefault<BaselineNfrs>(path);
  return new Set(Object.keys(nfrs));
}

/** verify に渡す、プロジェクト全体の情報（docs/sdd の nfr.ts と conventions.ts） */
export async function loadVerifyContext(): Promise<{
  baselineNfrIds?: Set<string>;
  baselineNfrs?: Map<string, string>;
  conventions?: Map<string, "gate" | "manual">;
  ui?: boolean;
}> {
  const nfrPath = join(SDD_DIR, "nfr.ts");
  const convPath = join(SDD_DIR, "conventions.ts");
  const ctx: {
    baselineNfrIds?: Set<string>;
    baselineNfrs?: Map<string, string>;
    conventions?: Map<string, "gate" | "manual">;
    ui?: boolean;
  } = { ui: (await loadConfig()).ui };
  if (await exists(nfrPath)) {
    const nfrs = await importDefault<BaselineNfrs>(nfrPath);
    ctx.baselineNfrs = new Map(Object.entries(nfrs).map(([id, n]) => [id, n.category]));
    ctx.baselineNfrIds = new Set(ctx.baselineNfrs.keys());
  }
  if (await exists(convPath)) {
    const conv = await importDefault<Conventions>(convPath);
    // 0.6.0 より前の規約には enforcedBy が無い。その場合は manual として扱う
    ctx.conventions = new Map(
      Object.entries(conv).map(([id, c]) => [id, (c as { enforcedBy?: "gate" | "manual" }).enforcedBy ?? "manual"]),
    );
  }
  return ctx;
}
