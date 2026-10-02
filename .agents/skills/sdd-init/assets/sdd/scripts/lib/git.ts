import { ROOT } from "./paths.ts";

export type GitResult = { code: number; out: string; bytes: Uint8Array };

export async function git(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<GitResult> {
  const { code, stdout } = await new Deno.Command("git", {
    args,
    cwd: opts.cwd ?? ROOT,
    env: opts.env,
    stdout: "piped",
    stderr: "null",
  }).output();
  return { code, out: new TextDecoder().decode(stdout).trim(), bytes: stdout };
}

/** 成功したときだけ出力を返す */
export async function gitOut(args: string[]): Promise<string | undefined> {
  const r = await git(args);
  return r.code === 0 ? r.out : undefined;
}

export async function hasRemote(name = "origin"): Promise<boolean> {
  const remotes = await gitOut(["remote"]);
  return (remotes ?? "").split("\n").includes(name);
}

/** リモートの既定ブランチ（例: "origin/main"）。分からなければ undefined */
export async function defaultRemoteBranch(): Promise<string | undefined> {
  const head = await gitOut(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (head) return head;
  for (const name of ["origin/main", "origin/master", "origin/develop"]) {
    if ((await git(["rev-parse", "--verify", "--quiet", name])).code === 0) return name;
  }
  return undefined;
}

export async function commitExists(rev: string): Promise<boolean> {
  return (await git(["cat-file", "-e", `${rev}^{commit}`])).code === 0;
}

/** 今のブランチが既定ブランチから分かれたコミット。分からなければ undefined */
export async function branchBase(): Promise<string | undefined> {
  const candidates = (await hasRemote()) ? [await defaultRemoteBranch()] : [];
  candidates.push("main", "master");
  const current = await gitOut(["branch", "--show-current"]);
  for (const c of candidates) {
    if (!c || c === current || c === `origin/${current}`) continue;
    const mb = await gitOut(["merge-base", c, "HEAD"]);
    if (mb) return mb;
  }
  return undefined;
}

export type TaskCommit = { hash: string; subject: string; files: string[] };

/**
 * このブランチのコミットのうち、タスクのコミットを、タスクIDごとに集める（タスクのコミットは spec に書かず、ここで自動で求める）。
 * 形式は guides/commits.md の `<type>(<issueId>): <タスクID> <タイトル>`。古い形式 `<issueId> <タスクID>: <タイトル>` も読む。
 */
export async function taskCommits(issueId: string): Promise<Map<string, TaskCommit[]>> {
  const result = new Map<string, TaskCommit[]>();
  const base = await branchBase();
  const range = base ? `${base}..HEAD` : "HEAD";
  const log = await gitOut(["log", "--reverse", "--format=%h%x09%s", range]);
  if (!log) return result;
  const id = issueId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const conventional = new RegExp(`^[a-z]+\\(${id}\\)!?:\\s*(T-\\d+)\\b`, "i");
  const legacy = new RegExp(`^${id}\\s+(T-\\d+):`, "i");
  for (const line of log.split("\n")) {
    const [hash, subject] = line.split("\t");
    const m = subject?.match(conventional) ?? subject?.match(legacy);
    if (!m) continue;
    const files = ((await gitOut(["diff-tree", "--no-commit-id", "--name-only", "-r", hash])) ?? "").split("\n")
      .filter(Boolean);
    const list = result.get(m[1]) ?? [];
    list.push({ hash, subject, files });
    result.set(m[1], list);
  }
  return result;
}

/** このブランチのコミットのうち、guides/commits.md の形式（`<type>(<issueId>): …`）になっていないもの */
export async function nonConventionalCommits(issueId: string): Promise<string[]> {
  const base = await branchBase();
  if (!base) return [];
  const log = await gitOut(["log", "--reverse", "--format=%h%x09%s", `${base}..HEAD`]);
  const id = issueId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ok = new RegExp(`^[a-z]+\\(${id}\\)!?: `, "i");
  return (log ?? "").split("\n").filter(Boolean).filter((l) => !ok.test(l.split("\t")[1] ?? "")).map((l) =>
    l.replace("\t", " ")
  );
}

/** このブランチで変更したファイル（既定ブランチとの分岐点から、作業ツリーの変更も含む） */
export async function branchChangedFiles(): Promise<string[] | undefined> {
  const base = await branchBase();
  if (!base) return undefined;
  const committed = ((await gitOut(["diff", "--name-only", base, "HEAD"])) ?? "").split("\n");
  const working = ((await gitOut(["diff", "--name-only", "HEAD"])) ?? "").split("\n");
  const untracked = ((await gitOut(["ls-files", "--others", "--exclude-standard"])) ?? "").split("\n");
  return [...new Set([...committed, ...working, ...untracked].filter(Boolean))].sort();
}
