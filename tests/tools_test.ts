// doctor、drift、conflicts のテスト
import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "node:path";
import { emptyRepo, FIXTURE_SPECS, gitIdentity, install, makeProject, run, sh, task, writeFile } from "./helpers.ts";

const ARCH = (basedOn: string, modulePath = "src/auth") =>
  `import { defineArchitecture } from "./schema/mod.ts";
export default defineArchitecture({
  basedOn: "${basedOn}",
  updatedAt: "2026-09-30",
  summary: "テスト用",
  stack: [{ name: "Python", version: "3.12", purpose: "サーバー" }],
  modules: { auth: { path: "${modulePath}", responsibility: "認証" } },
});
`;

/** SDDを導入済みで、コミットが1つあるリポジトリ */
async function installedRepo(): Promise<string> {
  const root = await emptyRepo();
  await install(root);
  await writeFile(root, "src/auth/auth_service.py", "def login(): pass\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "init");
  return root;
}

/** tasks.ts のタスクをすべて完了にし、受け入れテストの準備を書く */
async function completeTasks(tasksPath: string) {
  const src = (await Deno.readTextFile(tasksPath)).replaceAll(`status: "todo"`, `status: "done"`)
    .replaceAll(`status: "doing"`, `status: "done"`)
    .replace(
      "  tasks: {",
      `  acceptanceGuide: { setup: [{ run: "true" }], accounts: [{ id: "a@example.com", password: "pass", role: "一般" }], data: [], check: [{ url: "http://127.0.0.1:1/" }] },\n  tasks: {`,
    );
  await Deno.writeTextFile(tasksPath, src);
}

// --- doctor ---

Deno.test("doctor: 導入直後は必須の項目に問題が無い", async () => {
  const root = await installedRepo();
  const r = await task(root, "doctor");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "✓ pre-commit hook");
  assertStringIncludes(r.out, "! docs/sdd/architecture.ts");
  assertStringIncludes(r.out, "! 品質ゲート");
  assertStringIncludes(r.out, "propose-quality-tools");
});

Deno.test("doctor: ブランチの接頭辞に大文字があれば警告する", async () => {
  const root = await installedRepo();
  const path = join(root, "docs/sdd/config.ts");
  await Deno.writeTextFile(path, (await Deno.readTextFile(path)).replace(`"feature/"`, `"Feature/"`));
  const r = await task(root, "doctor");
  assertStringIncludes(r.out, "! branchPrefix");
});

Deno.test("doctor: hook が無ければ問題として報告する", async () => {
  const root = await installedRepo();
  await Deno.remove(join(root, ".git/hooks/pre-commit"));
  const r = await task(root, "doctor");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "✕ pre-commit hook");
  assertStringIncludes(r.out, "--hook-only");
});

Deno.test("doctor: husky に組み込まれていれば hook ありとみなす", async () => {
  const root = await installedRepo();
  await Deno.remove(join(root, ".git/hooks/pre-commit"));
  await writeFile(root, ".husky/pre-commit", "npm test\nsh docs/sdd/scripts/pre-commit.sh\n");
  const r = await task(root, "doctor");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, ".husky/pre-commit");
});

Deno.test("doctor: 型定義の版が違えば問題として報告する", async () => {
  const root = await installedRepo();
  const path = join(root, "docs/sdd/config.ts");
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace(/schemaVersion: "[^"]+"/, `schemaVersion: "0.0.1"`),
  );
  const r = await task(root, "doctor");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "sdd-init で更新してください");
});

// --- drift ---

Deno.test("drift: 基準から構成に関わる変更が無ければそう伝える", async () => {
  const root = await installedRepo();
  const head = await sh(root, "rev-parse", "HEAD");
  await writeFile(root, "docs/sdd/architecture.ts", ARCH(head));
  await writeFile(root, "src/auth/auth_service.py", "def login(): return True\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "change");
  const r = await task(root, "drift");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "構成に関わる変更は見つかりませんでした");
});

Deno.test("drift: 依存関係・最上位のディレクトリ・モジュールのパスの変化を検出する", async () => {
  const root = await installedRepo();
  const head = await sh(root, "rev-parse", "HEAD");
  await writeFile(root, "docs/sdd/architecture.ts", ARCH(head));
  await writeFile(root, "pyproject.toml", "[project]\nname = 'x'\n");
  await writeFile(root, "billing/service.py", "pass\n");
  await sh(root, "mv", "src/auth", "src/authn");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "restructure");
  const r = await task(root, "drift");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "依存関係の定義が変わった: pyproject.toml");
  assertStringIncludes(r.out, "最上位のディレクトリが増えた: billing/");
  assertStringIncludes(r.out, "モジュール auth のパス src/auth が見つからない");
});

Deno.test("drift: basedOn が未設定なら案内だけする", async () => {
  const root = await installedRepo();
  await writeFile(root, "docs/sdd/architecture.ts", ARCH("none"));
  const r = await task(root, "drift");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "basedOn が未設定です");
});

// --- conflicts ---

/** 共有リポジトリ（bare）と、自分・他の人の clone を作る */
async function team() {
  const origin = await Deno.makeTempDir({ prefix: "sdd-origin-" });
  await sh(origin, "init", "-q", "--bare", "-b", "main");
  const seed = await installedRepo();
  await sh(seed, "remote", "add", "origin", origin);
  await sh(seed, "push", "-q", "origin", "main");

  const clone = async () => {
    const dir = await Deno.makeTempDir({ prefix: "sdd-clone-" });
    await sh(dir, "clone", "-q", origin, ".");
    await gitIdentity(dir);
    return dir;
  };
  return { origin, me: await clone(), other: await clone() };
}

/** 他の人が、SDDのブランチ（EX-001: auth_service.py を変更する設計）を push する */
async function pushSddBranch(other: string, opts: { date?: string } = {}) {
  await sh(other, "switch", "-q", "-c", "feature/EX-001-lockout");
  for (const f of ["issue.md", "requirements.ts", "design.ts"]) {
    await writeFile(other, `docs/specs/EX-001/${f}`, await Deno.readTextFile(join(FIXTURE_SPECS, "EX-001", f)));
  }
  await writeFile(other, "src/auth/lockout_policy.py", "def evaluate(): pass\n");
  await sh(other, "add", ".");
  const env = opts.date ? { GIT_COMMITTER_DATE: opts.date, GIT_AUTHOR_DATE: opts.date } : undefined;
  const r = await new Deno.Command("git", { args: ["commit", "-q", "--no-verify", "-m", "EX-001"], cwd: other, env })
    .output();
  if (r.code !== 0) throw new Error("commit に失敗しました");
  await sh(other, "push", "-q", "origin", "feature/EX-001-lockout");
}

Deno.test("conflicts: 他のSDDブランチの予定の影響範囲との重なりを検出する", async () => {
  const { me, other } = await team();
  await pushSddBranch(other);
  await sh(me, "switch", "-q", "-c", "feature/EX-009-profile");
  // design.ts の impact.modify にある auth_service.py は、まだ変更されていない（予定だけ）
  const r = await task(me, "conflicts", "--paths", "src/auth/auth_service.py,src/profile/view.py");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "origin/feature/EX-001-lockout（SDD: EX-001");
  assertStringIncludes(r.out, "[重なり] src/auth/auth_service.py（予定）");
});

Deno.test("conflicts: 自分の spec の影響範囲と、SDD以外のブランチの実際の差分を比べる", async () => {
  const { me, other } = await team();
  // 他の人は SDD を使わずに auth_service.py を変更している
  await sh(other, "switch", "-q", "-c", "hotfix/login");
  await writeFile(other, "src/auth/auth_service.py", "def login(): return None\n");
  await sh(other, "commit", "-q", "-am", "hotfix");
  await sh(other, "push", "-q", "origin", "hotfix/login");

  await sh(me, "switch", "-q", "-c", "feature/EX-001-lockout");
  for (const f of ["issue.md", "requirements.ts", "design.ts"]) {
    await writeFile(me, `docs/specs/EX-001/${f}`, await Deno.readTextFile(join(FIXTURE_SPECS, "EX-001", f)));
  }
  const r = await task(me, "conflicts", "--issue", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "origin/hotfix/login（SDD以外");
  assertStringIncludes(r.out, "[重なり] src/auth/auth_service.py（変更済み）");
});

Deno.test("conflicts: 古いブランチと自分のブランチは対象外", async () => {
  const { me, other } = await team();
  await pushSddBranch(other, { date: "2020-01-01T00:00:00" });
  await sh(me, "switch", "-q", "-c", "feature/EX-009-profile");
  await writeFile(me, "src/profile/view.py", "pass\n");
  await sh(me, "add", ".");
  await sh(me, "commit", "-q", "-m", "wip");
  await sh(me, "push", "-q", "-u", "origin", "feature/EX-009-profile");
  const r = await task(me, "conflicts", "--paths", "src/auth/auth_service.py");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "作業中のブランチ: 0 件");
});

Deno.test("conflicts: リモートが無ければ確認できない旨を伝える", async () => {
  const root = await installedRepo();
  const r = await run(Deno.execPath(), ["task", "--quiet", "--config", "docs/sdd/deno.json", "conflicts"], root);
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "リモート（origin）が無いため");
});

// --- next ---

Deno.test("next: 作業中のタスクと、関係するコンポーネント・要件を表示する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "next", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "進捗: 2 / 6 件完了");
  assertStringIncludes(r.out, "■ T-003（作業中、実装）");
  assertStringIncludes(
    r.out,
    "同じアカウントでログインに5回続けて失敗したとき、システムはそのアカウントを15分間ロックしなければならない。",
  );
  assertStringIncludes(r.out, "ファイル: src/auth/login_attempt_repository.py");
  assertStringIncludes(r.out, "変更: src/auth/auth_service.py");
});

Deno.test("next: 指定したテストタスクの受け入れ条件とインターフェースを表示する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "next", "EX-001", "--task", "T-005");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "AC-003（FR-002、異常系）");
  assertStringIncludes(r.out, "操作: アカウントAで正しいパスワードでログインする");
});

Deno.test("next: 軽量モードでは根本原因も表示する", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const r = await task(root, "next", "EX-002");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "■ T-001（未着手、テスト）再現テストを書いて失敗することを確かめる");
  assertStringIncludes(r.out, "INV-001 1ページ目の表示");
  assertStringIncludes(r.out, "根本原因:");
});

Deno.test("next: すべて完了していればそう伝える", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const path = join(root, "docs/specs/EX-002/spec.ts");
  await Deno.writeTextFile(path, (await Deno.readTextFile(path)).replaceAll(`status: "todo"`, `status: "done"`));
  const r = await task(root, "next", "EX-002");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "すべてのタスクが完了しています");
});

Deno.test("next: 設計までしか無ければ実装できない旨を伝える", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await Deno.remove(join(root, "docs/specs/EX-001/tasks.ts"));
  const r = await task(root, "next", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "実装できるspecがありません");
});

// --- finish-report ---

Deno.test("finish-report: 未完了のタスクがあれば完了の条件を満たさない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "finish-report", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "エラー 4 件");
  assertStringIncludes(r.out, "BNFR-001 を上書き");
});

Deno.test("finish-report: ADRの候補と次の番号、モジュール外に作ったファイルを示す", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const tasksPath = join(root, "docs/specs/EX-001/tasks.ts");
  await completeTasks(tasksPath);
  const designPath = join(root, "docs/specs/EX-001/design.ts");
  await Deno.writeTextFile(
    designPath,
    (await Deno.readTextFile(designPath)).replace("adr: false", "adr: true").replace(
      `decidedBy: "ai"`,
      `decidedBy: "user"`,
    ),
  );
  await writeFile(root, "docs/sdd/adr/ADR-0003.ts", "// 既存のADR\n");
  await writeFile(root, "docs/sdd/architecture.ts", ARCH("none"));

  const r = await task(root, "finish-report", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "満たしています");
  assertStringIncludes(r.out, "docs/sdd/adr/ADR-0004.ts: 失敗回数の保存先");
  assertStringIncludes(r.out, "どのモジュールにも含まれない場所に作成: migrations/0042_login_attempts.sql");
  assertStringIncludes(r.out, "新しいコンポーネント LockoutPolicy");
});

// --- gate ---

async function withCommands(root: string, commands: string) {
  const path = join(root, "docs/sdd/config.ts");
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace("staleBranchDays: 30,", `staleBranchDays: 30,\n  commands: ${commands},`),
  );
}

Deno.test("gate: format → check → test の順に実行し、失敗をまとめて報告する", async () => {
  const root = await makeProject({ specs: [] });
  await withCommands(
    root,
    `{ format: "echo formatted > gate.log", check: "cat gate.log && exit 3", test: "echo tested" }`,
  );
  const r = await task(root, "gate");
  assertEquals(r.code, 1, r.out);
  // format の結果を check が読めている（順序どおり）
  assertStringIncludes(r.out, "formatted");
  assertStringIncludes(r.out, "✕ check");
  // check が失敗しても test は実行される
  assertStringIncludes(r.out, "✓ test: echo tested");
  assertStringIncludes(r.out, "失敗が 1 件あります");
});

Deno.test("gate: check が無ければ lint と typecheck を実行する", async () => {
  const root = await makeProject({ specs: [] });
  await withCommands(root, `{ lint: "echo lint-ok", typecheck: "echo type-ok", test: "true" }`);
  const r = await task(root, "gate");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "✓ lint");
  assertStringIncludes(r.out, "✓ typecheck");
  assertStringIncludes(r.out, "未設定: format");
});

Deno.test("gate: commands が無ければ警告して終わる", async () => {
  const root = await makeProject({ specs: [] });
  const r = await task(root, "gate");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "品質ゲートが設定されていません");
});

// --- current ---

Deno.test("current: 小文字のブランチ名から、大文字のIDのディレクトリを特定する", async () => {
  const root = await makeProject({ specs: ["EX-001", "EX-002"] });
  await sh(root, "init", "-q", "-b", "main");
  await gitIdentity(root);
  await sh(root, "commit", "-q", "--allow-empty", "-m", "init");
  await sh(root, "switch", "-q", "-c", "feature/ex-002-search-count");
  const r = await task(root, "current");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "issue: EX-002");
  assertStringIncludes(r.out, "モード: 軽量モード");
  const idOnly = await task(root, "current", "--id-only");
  assertEquals(idOnly.out.trim(), "EX-002");
});

Deno.test("current: 対応するspecが無ければ失敗する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await sh(root, "init", "-q", "-b", "main");
  await gitIdentity(root);
  await sh(root, "commit", "-q", "--allow-empty", "-m", "init");
  await sh(root, "switch", "-q", "-c", "feature/ex-0011-other");
  const r = await task(root, "current");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "対応する docs/specs/<ID> がありません");
});

Deno.test("finish-report: 依存関係の定義が変わったのにADRにする設計判断が無ければエラー", async () => {
  const root = await installedRepo();
  await sh(root, "switch", "-q", "-c", "feature/ex-001-lockout");
  for (const f of ["issue.md", "requirements.ts", "design.ts", "tasks.ts"]) {
    await writeFile(root, `docs/specs/EX-001/${f}`, await Deno.readTextFile(join(FIXTURE_SPECS, "EX-001", f)));
  }
  const tasksPath = join(root, "docs/specs/EX-001/tasks.ts");
  await completeTasks(tasksPath);
  await writeFile(root, "pyproject.toml", "[project]\\nname = 'x'\\ndependencies = ['redis']\\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "--no-verify", "-m", "wip");

  const r = await task(root, "finish-report", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "依存関係の定義が変わっています（pyproject.toml）");

  // adr: true の設計判断があればエラーにならない
  const designPath = join(root, "docs/specs/EX-001/design.ts");
  await Deno.writeTextFile(
    designPath,
    (await Deno.readTextFile(designPath)).replace("adr: false", "adr: true").replace(
      `decidedBy: "ai"`,
      `decidedBy: "user"`,
    ),
  );
  const ok = await task(root, "finish-report", "EX-001");
  assertEquals(ok.out.includes("依存関係の定義が変わっています"), false, ok.out);
});

// --- scope と、タスクのコミットの検査 ---

async function quickBranch(): Promise<string> {
  const root = await installedRepo();
  await sh(root, "switch", "-q", "-c", "feature/ex-002-search-count");
  for (const f of ["issue.md", "spec.ts"]) {
    await writeFile(root, `docs/specs/EX-002/${f}`, await Deno.readTextFile(join(FIXTURE_SPECS, "EX-002", f)));
  }
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "EX-002: specを作成（軽量モード）");
  return root;
}

Deno.test("scope: 影響範囲に無いファイルの変更をエラーにする", async () => {
  const root = await quickBranch();
  await writeFile(root, "src/search/pagination.py", "def start(page, size): return (page - 1) * size\n");
  await writeFile(root, "src/other/util.py", "pass\n");
  const r = await task(root, "scope", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "影響範囲に無い変更: src/other/util.py");
  assertStringIncludes(r.out, "影響範囲にあるが変更していない: tests/test_pagination.py");
});

Deno.test("finish-report: 完了したタスクにコミットが無い、空のコミットがある場合はエラー", async () => {
  const root = await quickBranch();
  await writeFile(root, "tests/test_pagination.py", "def test_page2(): assert False\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "--no-verify", "-m", "EX-002 T-001: 再現テストを書く");
  await sh(root, "commit", "-q", "--no-verify", "--allow-empty", "-m", "EX-002 T-002: 開始位置の計算を直す");
  const path = join(root, "docs/specs/EX-002/spec.ts");
  await Deno.writeTextFile(path, (await Deno.readTextFile(path)).replaceAll(`status: "todo"`, `status: "done"`));
  const r = await task(root, "finish-report", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "T-002 のコミット");
  assertStringIncludes(r.out, "空のコミットです");
  // 人が確かめる受け入れ条件があるのに、受け入れテストの準備が書かれていない
  assertStringIncludes(r.out, "受け入れテストの準備（acceptanceGuide）がありません");
});

Deno.test("doctor: 品質ゲートでテストを除外している設定を警告する", async () => {
  const root = await installedRepo();
  await writeFile(
    root,
    "scripts/gate-test.sh",
    "#!/usr/bin/env bash\nexport SKIP_BUILD_TEST=1\nphp artisan test --exclude-group slow\n",
  );
  const path = join(root, "docs/sdd/config.ts");
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace(
      "staleBranchDays: 30,",
      `staleBranchDays: 30,\n  commands: { check: "true", test: "bash scripts/gate-test.sh" },`,
    ),
  );
  const r = await task(root, "doctor");
  assertStringIncludes(r.out, "scripts/gate-test.sh: SKIP_ で始まる環境変数");
  assertStringIncludes(r.out, "scripts/gate-test.sh: --exclude-group");
});

Deno.test("gate: E2E テストは --full のときだけ実行する", async () => {
  const root = await makeProject({ specs: [] });
  await withCommands(root, `{ check: "true", test: "echo unit-ok", e2e: "echo e2e-ran" }`);
  const quick = await task(root, "gate");
  assertEquals(quick.code, 0, quick.out);
  assertEquals(quick.out.includes("e2e-ran"), false, quick.out);
  assertStringIncludes(quick.out, "E2E テストは含めていません");
  const full = await task(root, "gate", "--full");
  assertEquals(full.code, 0, full.out);
  assertStringIncludes(full.out, "e2e-ran");
  assertStringIncludes(full.out, "✓ e2e");
});

Deno.test("doctor: E2E テストが未設定なら警告する", async () => {
  const root = await installedRepo();
  const r = await task(root, "doctor");
  assertStringIncludes(r.out, "! E2E テスト");
});

Deno.test("next: Conventional Commits 形式のコミットからタスクとの対応を求める", async () => {
  const root = await quickBranch();
  await writeFile(root, "tests/test_pagination.py", "def test_page2(): assert False\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "--no-verify", "-m", "test(EX-002): T-001 再現テストを書く");
  await writeFile(root, "src/other.py", "pass\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "--no-verify", "-m", "wip");
  const r = await task(root, "next", "EX-002");
  assertStringIncludes(r.out, "○ T-001 再現テストを書いて失敗することを確かめる（");
  const report = await task(root, "finish-report", "EX-002");
  assertStringIncludes(report.out, "形式が違うコミット");
  assertStringIncludes(report.out, "wip");
});

// --- acceptance ---

/** 空いているポートで、指定した本文を返すサーバーを起動するコマンド */
async function serverCommand(root: string, body: string): Promise<{ run: string; url: string }> {
  const l = Deno.listen({ port: 0 });
  const port = (l.addr as Deno.NetAddr).port;
  l.close();
  await writeFile(
    root,
    "server.ts",
    `Deno.serve({ port: ${port}, onListen() {} }, (req) => new URL(req.url).pathname === "/missing" ? new Response("no", { status: 404 }) : new Response(${
      JSON.stringify(body)
    }));\n`,
  );
  return { run: `${Deno.execPath()} run --allow-net server.ts`, url: `http://127.0.0.1:${port}` };
}

async function writeGuide(root: string, guide: string) {
  const path = join(root, "docs/specs/EX-002/spec.ts");
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace("  tasks: {", `  acceptanceGuide: ${guide},\n  tasks: {`),
  );
}

Deno.test("acceptance: 準備を実行し、サーバーを起動して画面を確かめる", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const srv = await serverCommand(root, "21〜40件目");
  await writeGuide(
    root,
    `{
    setup: [{ run: "echo ok > setup.log" }],
    server: { run: ${JSON.stringify(srv.run)}, url: "${srv.url}/" },
    accounts: [],
    data: [{ acs: ["AC-001"], run: "echo 45 > data.log", expect: "45件" }],
    check: [{ url: "${srv.url}/search?page=2", contains: "21〜40件目" }, { url: "${srv.url}/missing", status: 404 }],
  }`,
  );
  const r = await task(root, "acceptance", "EX-002");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "すべて確かめました");
  assertEquals((await Deno.readTextFile(join(root, "data.log"))).trim(), "45");
});

Deno.test("acceptance: 準備のコマンドや画面の確認が失敗したら、受け入れテストを頼めない", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const srv = await serverCommand(root, "1〜20件目");
  await writeGuide(
    root,
    `{
    setup: [{ run: "true" }],
    server: { run: ${JSON.stringify(srv.run)}, url: "${srv.url}/" },
    accounts: [],
    data: [],
    check: [{ url: "${srv.url}/search?page=2", contains: "21〜40件目" }],
  }`,
  );
  const r = await task(root, "acceptance", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "本文に「21〜40件目」がありません");

  // spec を元に戻してから、準備のコマンドが失敗する形で書き直す
  await writeFile(root, "docs/specs/EX-002/spec.ts", await Deno.readTextFile(join(FIXTURE_SPECS, "EX-002/spec.ts")));
  await writeGuide(root, `{ setup: [{ run: "exit 3" }], accounts: [], data: [], check: [{ url: "${srv.url}/" }] }`);
  const failed = await task(root, "acceptance", "EX-002");
  assertEquals(failed.code, 1, failed.out);
  assertStringIncludes(failed.out, "終了コード 3");
});

// --- finish-report: 品質ゲートを緩めた変更と ADR の書き換え ---

Deno.test("finish-report: 品質ゲートを緩めた変更と、採用済みの ADR の書き換えをエラーにする", async () => {
  const root = await installedRepo();
  await writeFile(root, "phpstan.neon", "parameters:\n  level: max\n  paths:\n    - src\n");
  await writeFile(
    root,
    "docs/sdd/adr/ADR-0001.ts",
    `export default { id: "ADR-0001", status: "accepted", decision: "PostgreSQL を使う" };\n`,
  );
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "--no-verify", "-m", "chore: 準備");
  await sh(root, "switch", "-q", "-c", "feature/ex-002-search-count");
  for (const f of ["issue.md", "spec.ts"]) {
    await writeFile(root, `docs/specs/EX-002/${f}`, await Deno.readTextFile(join(FIXTURE_SPECS, "EX-002", f)));
  }
  await writeFile(
    root,
    "phpstan.neon",
    "parameters:\n  level: 5\n  paths:\n    - src\n  excludePaths:\n    - src/Legacy\n",
  );
  await writeFile(
    root,
    "docs/sdd/adr/ADR-0001.ts",
    `export default { id: "ADR-0001", status: "accepted", decision: "テストは SQLite を使う" };\n`,
  );
  await writeFile(root, "src/search/pagination.py", "x = 1  # type: ignore\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "--no-verify", "-m", "fix(EX-002): T-002 直す");
  const r = await task(root, "finish-report", "EX-002", "--skip-gate");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "phpstan.neon の level が max → 5 です");
  assertStringIncludes(r.out, "品質ゲートの設定を緩めた可能性があります: phpstan.neon「excludePaths:」");
  assertStringIncludes(r.out, "採用済みの ADR を書き換えています: docs/sdd/adr/ADR-0001.ts");
  assertStringIncludes(r.out, "検出を抑止するコメントを追加しています: src/search/pagination.py");
});

// --- doctor: gate の根拠と、画面のある案件の E2E ---

Deno.test("doctor: gate と書いた規約の設定ファイルが無ければ問題にする", async () => {
  const root = await installedRepo();
  await writeFile(
    root,
    "docs/sdd/conventions.ts",
    `import { defineConventions } from "./schema/mod.ts";
export default defineConventions({
  "CONV-001": { topic: "層", rule: "r", enforcedBy: "gate", tool: "Deptrac", config: ["deptrac.yaml"] },
});
`,
  );
  const r = await task(root, "doctor");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "gate の根拠の deptrac.yaml がありません");
  await writeFile(root, "deptrac.yaml", "deptrac: {}\n");
  const ok = await task(root, "doctor");
  assertEquals(ok.out.includes("gate の根拠"), false, ok.out);
});

Deno.test("doctor: 画面がある案件で E2E が無ければ問題にする", async () => {
  const root = await installedRepo();
  const path = join(root, "docs/sdd/config.ts");
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace("staleBranchDays: 30,", "staleBranchDays: 30,\n  ui: true,"),
  );
  const r = await task(root, "doctor");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "✕ E2E テスト");
});
