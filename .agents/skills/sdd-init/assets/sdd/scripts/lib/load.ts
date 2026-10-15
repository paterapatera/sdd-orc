import { join } from "node:path";
import type {
  Adr,
  AnsId,
  Architecture,
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
import { mkdir, readDir, readTextFile, runCommand, writeTextFile } from "./io.ts";
import { ANSWERED_DIR, ASKED_DIR, exists, ROOT, SDD_DIR, SPECS_DIR } from "./paths.ts";

// 実行時に読み込むspecの型。IDはすべて string として扱う。
export type LooseRequirements = Requirements;
export type LooseDesign = Design<Requirements, string, AnsId>;
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
  /** requirements.ts の values が出どころに挙げたファイルのうち、リポジトリに無いもの */
  missingBasisFiles?: Set<string>;
};

async function readIdRecord(dir: string, id: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const xs = JSON.parse(await readTextFile(join(dir, `${id}.json`)));
    if (Array.isArray(xs)) {
      for (const x of xs) if (typeof x === "string") ids.add(x);
    }
  } catch {
    // 記録が無ければ空
  }
  return ids;
}

async function addIdRecord(dir: string, id: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const merged = [...new Set([...(await readIdRecord(dir, id)), ...ids])].sort();
  await mkdir(dir, { recursive: true });
  await writeTextFile(join(dir, `${id}.json`), JSON.stringify(merged) + "\n");
}

/**
 * 構成の回答の記録。asked は verify が未回答として一覧に出した ID、committed は直前のコミットの design.ts にある ID、
 * answered はユーザーが答えたと書き手が --answered で申告した ID。
 * committed に無い ID の answer は、asked と answered の両方に無ければ verify がエラーにする
 */
export async function loadAnswerRecords(
  id: string,
): Promise<{ asked: Set<string>; committed: Set<string>; answered: Set<string> }> {
  const asked = await readIdRecord(ASKED_DIR, id);
  const answered = await readIdRecord(ANSWERED_DIR, id);
  const committed = new Set<string>();
  try {
    const out = await runCommand("git", {
      args: ["show", `HEAD:docs/specs/${id}/design.ts`],
      cwd: ROOT,
      stdout: "piped",
      stderr: "null",
    });
    if (out.code === 0) {
      for (const m of new TextDecoder().decode(out.stdout).matchAll(/"(ANS-\d+)"\s*:\s*\{\s*about\b/g)) {
        committed.add(m[1]);
      }
    }
  } catch {
    // Git が無ければ、コミット済みの回答は無いものとする
  }
  return { asked, committed, answered };
}

/** verify が未回答として一覧に出した構成の回答の ID を、記録に足す */
export async function recordAsked(id: string, ids: readonly string[]): Promise<void> {
  await addIdRecord(ASKED_DIR, id, ids);
}

/** ユーザーが答えたと書き手が申告した構成の回答の ID を、記録に足す */
export async function recordAnswered(id: string, ids: readonly string[]): Promise<void> {
  await addIdRecord(ANSWERED_DIR, id, ids);
}

/** docs/specs にあるissueのIDの一覧 */
export async function listIssueIds(): Promise<string[]> {
  if (!(await exists(SPECS_DIR))) return [];
  const ids: string[] = [];
  for (const e of await readDir(SPECS_DIR)) {
    if (e.isDirectory && !e.name.startsWith(".") && !e.name.startsWith("_")) ids.push(e.name);
  }
  return ids.sort();
}

export async function loadIssue(id: string): Promise<LoadedIssue> {
  const dir = join(SPECS_DIR, id);
  const issue: LoadedIssue = { id, dir, mode: "none", loadErrors: [] };

  const issuePath = join(dir, "issue.md");
  if (await exists(issuePath)) issue.issueMd = await readTextFile(issuePath);

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
  if (issue.requirements) issue.missingBasisFiles = await missingBasisFiles(issue.requirements);

  const full =
    [issue.requirements, issue.design, issue.tasks].some((x) => x !== undefined) ||
    issue.loadErrors.some((e) => e.file !== "spec.ts");
  const quick = issue.quick !== undefined || issue.loadErrors.some((e) => e.file === "spec.ts");
  issue.mode = full && quick ? "mixed" : full ? "full" : quick ? "quick" : "none";
  return issue;
}

async function missingBasisFiles(r: LooseRequirements): Promise<Set<string>> {
  const paths = new Set<string>();
  for (const v of r.values ?? []) {
    for (const d of Object.values((v.aspects ?? {}) as Readonly<Record<string, { basis?: { code?: unknown } }>>)) {
      if (typeof d.basis?.code === "string") paths.add(d.basis.code);
    }
  }
  const missing = new Set<string>();
  for (const p of paths) {
    if (!(await exists(join(ROOT, p)))) missing.add(p);
  }
  return missing;
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

/** verify が構成の判断の根拠を確かめるのに使う、docs/sdd/architecture.ts の中身 */
export type ArchitectureContext = {
  /** modules のパス */
  modulePaths: string[];
  /** 引用できる文（summary、layers の name と rule、notes） */
  texts: string[];
  /** モジュールのパスから、そのモジュールが依存する（dependsOn）モジュールのパスへの対応 */
  dependsOn: Map<string, string[]>;
};

type VerifyContext = {
  baselineNfrIds?: Set<string>;
  baselineNfrs?: Map<string, string>;
  conventions?: Map<string, "gate" | "manual">;
  ui?: boolean;
  architecture?: ArchitectureContext;
  adrs?: Map<string, AdrContext>;
  /** Git が追跡しているファイル。Git が使えなければ undefined */
  trackedFiles?: string[];
};

const asDir = (p: string) => `${p.replace(/^\.\//, "").replace(/\/+$/, "")}/`;

/** verify が構成の判断の根拠を確かめるのに使う、ADR の中身 */
export type AdrContext = {
  status: Adr["status"];
  /** 置き場所を書いているかを見る文（title と decision） */
  text: string;
};

/** verify に渡す、プロジェクト全体の情報（docs/sdd の nfr.ts、conventions.ts、architecture.ts、adr/） */
export async function loadVerifyContext(): Promise<VerifyContext> {
  const nfrPath = join(SDD_DIR, "nfr.ts");
  const convPath = join(SDD_DIR, "conventions.ts");
  const archPath = join(SDD_DIR, "architecture.ts");
  const adrDir = join(SDD_DIR, "adr");
  const ctx: VerifyContext = { ui: (await loadConfig()).ui };
  if (await exists(archPath)) {
    const a = await importDefault<Architecture>(archPath);
    const modules = a.modules ?? {};
    ctx.architecture = {
      modulePaths: Object.values(modules).map((m) => m.path),
      texts: [a.summary, ...(a.layers ?? []).flatMap((l) => [l.name, l.rule]), ...(a.notes ?? [])],
      dependsOn: new Map(
        Object.values(modules).map((m) => [
          asDir(m.path),
          (m.dependsOn ?? []).flatMap((n) => {
            const dep = (modules as Record<string, { path: string } | undefined>)[n];
            return dep ? [asDir(dep.path)] : [];
          }),
        ]),
      ),
    };
  }
  try {
    const out = await runCommand("git", {
      args: ["ls-files", "-z"],
      cwd: ROOT,
      stdout: "piped",
      stderr: "null",
    });
    if (out.code === 0) ctx.trackedFiles = new TextDecoder().decode(out.stdout).split("\0").filter(Boolean);
  } catch {
    // Git が無ければ、前例のある場所を根拠にしない
  }
  if (await exists(adrDir)) {
    ctx.adrs = new Map();
    for (const e of await readDir(adrDir)) {
      if (!e.isFile || !e.name.endsWith(".ts")) continue;
      try {
        const adr = await importDefault<Adr>(join(adrDir, e.name));
        ctx.adrs.set(adr.id, { status: adr.status, text: `${adr.title}\n${adr.decision}` });
      } catch {
        // 読めない ADR は根拠にできない（指すと verify が「見つからない」と報告する）
      }
    }
  }
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
