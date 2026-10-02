/**
 * 作業中の他のブランチと、影響範囲が重なっていないかを調べる。
 *
 * 使い方: deno task --config docs/sdd/deno.json conflicts [--issue ID] [--paths a,b,...] [--no-fetch]
 *   --issue ID   docs/specs/ID の design.ts（または spec.ts）の影響範囲を、自分の影響範囲として使う
 *   --paths      自分が触る予定のファイルやディレクトリ（カンマ区切り）。--issue と併用できる
 *   --no-fetch   git fetch を行わない
 *
 * 対象: origin にあるブランチのうち、最終コミットが config.ts の staleBranchDays 日以内のもの
 *       （既定ブランチと、今のブランチの push 先は除く）。
 *   - SDDのブランチ: 実際の差分 ＋ design.ts / spec.ts に書かれた影響範囲
 *   - SDD以外のブランチ: 実際の差分
 *
 * 重なりは警告として表示するだけで、止めはしない（終了コードは0）。
 * push されていない作業は検出できない。
 */
import { dirname, join } from "node:path";
import { impactPaths, loadConfig, loadImpact } from "./lib/config.ts";
import { defaultRemoteBranch, git, gitOut, hasRemote } from "./lib/git.ts";
import { SPECS_DIR } from "./lib/paths.ts";

function option(name: string): string | undefined {
  const i = Deno.args.indexOf(name);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

const issueId = option("--issue");
const extraPaths = (option("--paths") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
const noFetch = Deno.args.includes("--no-fetch");

if (!(await hasRemote())) {
  console.log("リモート（origin）が無いため、他のブランチとの重なりは確認できません");
  Deno.exit(0);
}
if (!noFetch && (await git(["fetch", "--prune", "--quiet", "origin"])).code !== 0) {
  console.log("[警告] git fetch に失敗しました（ネットワークに出られない、認証が要る、など）。");
  console.log("       手元にあるリモートブランチの情報（最後に fetch した時点）で確認します。");
  console.log("       最新の状態で確かめるには、ネットワークに出られる環境で git fetch してから実行し直してください");
}

const config = await loadConfig();
const base = await defaultRemoteBranch();
if (!base) {
  console.log("リモートの既定ブランチが分かりません（origin/HEAD、origin/main、origin/master が無い）");
  Deno.exit(0);
}
const current = await gitOut(["branch", "--show-current"]);
const excluded = new Set([base, "origin/HEAD", "origin", ...(current ? [`origin/${current}`] : [])]);

// 自分の影響範囲
const mine = new Set(extraPaths);
if (issueId) {
  const impact = await loadImpact(join(SPECS_DIR, issueId));
  if (!impact) console.log(`[警告] docs/specs/${issueId} に design.ts も spec.ts もありません`);
  for (const p of impactPaths(impact)) mine.add(p);
}

type BranchInfo = {
  ref: string;
  daysAgo: number;
  changed: string[];
  sddIssues: string[];
  planned: string[];
  notes: string[];
};

/** 他のブランチの docs を一時ディレクトリに取り出し、予定している影響範囲を読む */
async function plannedImpact(ref: string, id: string): Promise<string[]> {
  const tmp = await Deno.makeTempDir({ prefix: "sdd-conflicts-" });
  try {
    const files = ((await gitOut(["ls-tree", "-r", "--name-only", ref, "--", "docs/sdd", `docs/specs/${id}`])) ?? "")
      .split("\n").filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const r = await git(["show", `${ref}:${f}`]);
      if (r.code !== 0) continue;
      await Deno.mkdir(join(tmp, dirname(f)), { recursive: true });
      await Deno.writeFile(join(tmp, f), r.bytes);
    }
    return impactPaths(await loadImpact(join(tmp, "docs/specs", id)));
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
}

const now = Date.now() / 1000;
const refs =
  ((await gitOut(["for-each-ref", "--format=%(refname:short)\t%(committerdate:unix)", "refs/remotes/origin"])) ??
    "")
    .split("\n").filter(Boolean).map((l) => {
      const [ref, ts] = l.split("\t");
      return { ref, daysAgo: Math.floor((now - Number(ts)) / 86400) };
    })
    .filter((r) => !excluded.has(r.ref) && r.daysAgo <= config.staleBranchDays);

const branches: BranchInfo[] = [];
for (const { ref, daysAgo } of refs) {
  const mergeBase = await gitOut(["merge-base", base, ref]);
  if (!mergeBase) continue;
  const all = ((await gitOut(["diff", "--name-only", mergeBase, ref])) ?? "").split("\n").filter(Boolean);
  if (all.length === 0) continue;
  const sddIssues = [
    ...new Set(all.map((f) => f.match(/^docs\/specs\/([^/]+)\//)?.[1]).filter((x): x is string => !!x)),
  ];
  const info: BranchInfo = {
    ref,
    daysAgo,
    changed: all.filter((f) => !f.startsWith("docs/specs/")),
    sddIssues,
    planned: [],
    notes: [],
  };
  for (const id of sddIssues) {
    try {
      info.planned.push(...await plannedImpact(ref, id));
    } catch {
      info.notes.push(`${id} の予定の影響範囲を読み込めませんでした`);
    }
  }
  branches.push(info);
}

/** a と b が同じファイルか、一方がもう一方を含むディレクトリか */
function overlaps(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\/$/, "");
  const [x, y] = [norm(a), norm(b)];
  return x === y || y.startsWith(x + "/") || x.startsWith(y + "/");
}

console.log(
  `作業中のブランチ: ${branches.length} 件（${base} との差分があり、最終コミットが ${config.staleBranchDays} 日以内）`,
);
if (mine.size > 0) console.log(`自分の影響範囲: ${mine.size} 件`);

let warnings = 0;
for (const b of branches) {
  const label = b.sddIssues.length ? `SDD: ${b.sddIssues.join(", ")}` : "SDD以外";
  console.log(`\n■ ${b.ref}（${label}、${b.daysAgo}日前、変更 ${b.changed.length} 件、予定 ${b.planned.length} 件）`);
  for (const n of b.notes) console.log(`  [注意] ${n}`);
  if (mine.size === 0) {
    const shown = [...new Set([...b.changed, ...b.planned])];
    for (const f of shown.slice(0, 15)) console.log(`  - ${f}`);
    if (shown.length > 15) console.log(`  …ほか ${shown.length - 15} 件`);
    continue;
  }
  const sameFile: string[] = [];
  const sameDir = new Set<string>();
  for (const m of mine) {
    const hitChanged = b.changed.filter((f) => overlaps(m, f));
    const hitPlanned = b.planned.filter((f) => overlaps(m, f));
    if (hitChanged.length || hitPlanned.length) {
      const kinds = [hitChanged.length ? "変更済み" : "", hitPlanned.length ? "予定" : ""].filter(Boolean).join("・");
      sameFile.push(`${m}（${kinds}）`);
      continue;
    }
    const dir = dirname(m);
    if (dir !== "." && [...b.changed, ...b.planned].some((f) => dirname(f) === dir)) sameDir.add(dir + "/");
  }
  if (sameFile.length === 0 && sameDir.size === 0) console.log("  重なりはありません");
  for (const s of sameFile) console.log(`  [重なり] ${s}`);
  for (const d of sameDir) console.log(`  [同じディレクトリ] ${d}`);
  warnings += sameFile.length;
}

if (mine.size > 0) {
  console.log(warnings ? `\n重なりが ${warnings} 件あります。担当者と調整してください` : "\n重なりはありません");
}
