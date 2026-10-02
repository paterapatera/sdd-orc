/**
 * SDDの導入状態を確認する。
 *
 * 使い方: deno task --config docs/sdd/deno.json doctor
 *
 * 確認する項目: Deno の版、型定義の版、pre-commit hook、.gitignore、恒久ドキュメント。
 * 必須の項目に問題があれば終了コード1で終わる。
 */
import { join, resolve } from "node:path";
import { SCHEMA_VERSION } from "../schema/mod.ts";
import { loadConfig } from "./lib/config.ts";
import { findGateSkips } from "./lib/gate-skips.ts";
import { gitOut } from "./lib/git.ts";
import { exists, ROOT, SDD_DIR } from "./lib/paths.ts";

type Item = { level: "ok" | "ng" | "warn"; label: string; detail?: string };
const items: Item[] = [];
const HOOK_COMMAND = "docs/sdd/scripts/pre-commit.sh";

async function readIfExists(path: string): Promise<string | undefined> {
  return (await exists(path)) ? await Deno.readTextFile(path) : undefined;
}

// Deno
const [major] = Deno.version.deno.split(".").map(Number);
items.push(
  major >= 2
    ? { level: "ok", label: `Deno ${Deno.version.deno}` }
    : { level: "ng", label: `Deno ${Deno.version.deno}`, detail: "Deno 2 以上が必要です" },
);

// 型定義の版
const config = await loadConfig();
if (!(await exists(join(SDD_DIR, "config.ts")))) {
  items.push({ level: "ng", label: "docs/sdd/config.ts", detail: "ありません。sdd-init を実行してください" });
} else if (config.schemaVersion !== SCHEMA_VERSION) {
  items.push({
    level: "ng",
    label: "型定義の版",
    detail: `config.ts は ${config.schemaVersion}、schema は ${SCHEMA_VERSION} です。sdd-init で更新してください`,
  });
} else {
  items.push({ level: "ok", label: `型定義の版 ${SCHEMA_VERSION}` });
}

// ブランチの接頭辞（リモートとローカルで大文字小文字が食い違わないよう、ブランチ名は小文字にする）
if (config.branchPrefix !== config.branchPrefix.toLowerCase()) {
  items.push({
    level: "warn",
    label: "branchPrefix",
    detail: `「${config.branchPrefix}」に大文字が含まれています。小文字にしてください`,
  });
}

// 品質ゲート（人のコードレビューの代わりにコードの品質を担保する）
const cmds = config.commands ?? {};
const gateNames = ["format", "check", "test"].filter((k) => cmds[k as keyof typeof cmds]);
if (!cmds.check && !cmds.lint && !cmds.typecheck) {
  items.push({
    level: "warn",
    label: "品質ゲート",
    detail:
      "config.ts の commands に check（または lint、typecheck）がありません。propose-quality-tools でツールを選んで登録してください",
  });
} else if (!cmds.test) {
  items.push({ level: "warn", label: "品質ゲート", detail: "config.ts の commands に test がありません" });
} else {
  items.push({ level: "ok", label: `品質ゲート（${gateNames.join("、")}）` });
}
if (!cmds.e2e && config.ui) {
  items.push({
    level: "ng",
    label: "E2E テスト",
    detail: "画面がある案件（config.ts の ui: true）なのに commands.e2e がありません",
  });
} else if (!cmds.e2e) {
  items.push({
    level: "warn",
    label: "E2E テスト",
    detail:
      "config.ts の commands に e2e がありません。画面があるなら、画面の崩れや遷移の誤りは単体テストでは気づけない（sdd-init で選定する）",
  });
}

// 品質ゲートでテストを除外している設定
for (const skip of await findGateSkips(config.commands)) {
  items.push({
    level: "warn",
    label: "品質ゲートでの除外",
    detail: `${skip}（除外したテストは受け入れ条件の根拠にならない）`,
  });
}

// 規約の enforcedBy: "gate" に書いた設定ファイルやテストが実在するか（試行で、存在しないツールで gate と書かれていた）
{
  const convPath = join(SDD_DIR, "conventions.ts");
  if (await exists(convPath)) {
    const { importDefault } = await import("./lib/config.ts");
    const conv = await importDefault<Record<string, { enforcedBy?: string; config?: readonly string[] }>>(convPath);
    for (const [cid, c] of Object.entries(conv)) {
      if (c.enforcedBy !== "gate") continue;
      if (!c.config?.length) {
        items.push({
          level: "ng",
          label: `規約 ${cid}`,
          detail: 'enforcedBy: "gate" なのに config（設定ファイルやテストのパス）がありません',
        });
        continue;
      }
      for (const p of c.config) {
        if (!(await exists(join(ROOT, p)))) {
          items.push({
            level: "ng",
            label: `規約 ${cid}`,
            detail: `gate の根拠の ${p} がありません（実在しないなら manual にする）`,
          });
        }
      }
    }
  }
}
if (config.ui === undefined) {
  items.push({
    level: "warn",
    label: "画面の有無",
    detail: "config.ts に ui（画面があるか）がありません。sdd-init で登録してください",
  });
}

// ホスティングのCLI（PR/MRの作成、squash マージ、issue の取得とコメントに使う）
if (!config.forge) {
  items.push({
    level: "warn",
    label: "ホスティングのCLI",
    detail: "config.ts の forge がありません。gh / glab / fj / tea のどれを使うかを sdd-init で登録してください",
  });
} else {
  try {
    const { code } = await new Deno.Command(config.forge.cli, { args: ["--version"], stdout: "null", stderr: "null" })
      .output();
    items.push(
      code === 0
        ? { level: "ok", label: `ホスティングのCLI（${config.forge.cli}）` }
        : { level: "warn", label: "ホスティングのCLI", detail: `${config.forge.cli} --version が失敗しました` },
    );
  } catch {
    items.push({ level: "warn", label: "ホスティングのCLI", detail: `${config.forge.cli} が見つかりません` });
  }
}

// pre-commit hook（.git/hooks か、既存のhook管理の設定に組み込まれているか）
const hooksDir = await gitOut(["rev-parse", "--git-path", "hooks"]);
const hookFiles = [
  ...(hooksDir ? [resolve(ROOT, hooksDir, "pre-commit")] : []),
  ...[".husky/pre-commit", ".pre-commit-config.yaml", "lefthook.yml", "lefthook.yaml", ".lefthook.yml", "package.json"]
    .map((f) => join(ROOT, f)),
  join(ROOT, ".simple-git-hooks.json"),
];
let hookFound: string | undefined;
for (const f of hookFiles) {
  if ((await readIfExists(f))?.includes(HOOK_COMMAND)) {
    hookFound = f;
    break;
  }
}
items.push(
  hookFound ? { level: "ok", label: "pre-commit hook", detail: hookFound.slice(ROOT.length + 1) } : {
    level: "ng",
    label: "pre-commit hook",
    detail: "設置されていません。sdd-init の install.ts を --hook-only 付きで実行してください",
  },
);

// .gitignore
const gitignore = (await readIfExists(join(ROOT, ".gitignore"))) ?? "";
items.push(
  gitignore.split(/\r?\n/).some((l) => /^\/?\.sdd\/?$/.test(l.trim()))
    ? { level: "ok", label: ".gitignore に .sdd/ がある" }
    : { level: "ng", label: ".gitignore", detail: ".sdd/ がありません。sdd-init を実行してください" },
);

// 恒久ドキュメント
for (const f of ["architecture.ts", "conventions.ts", "nfr.ts"]) {
  items.push(
    (await exists(join(SDD_DIR, f)))
      ? { level: "ok", label: `docs/sdd/${f}` }
      : { level: "warn", label: `docs/sdd/${f}`, detail: "ありません。sdd-init で作成してください" },
  );
}

const icon = { ok: "✓", ng: "✕", warn: "!" };
for (const i of items) console.log(`  ${icon[i.level]} ${i.label}${i.detail ? ` — ${i.detail}` : ""}`);
const ng = items.filter((i) => i.level === "ng").length;
console.log(ng ? `\n問題が ${ng} 件あります` : "\n問題ありません");
Deno.exit(ng ? 1 : 0);
