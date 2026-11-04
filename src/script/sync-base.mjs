/**
 * Fetch and fast-forward the local base branch from its upstream remote.
 * Does not checkout branches or touch the working tree.
 */

function trimSha(sha) {
  return sha.trim().slice(0, 7);
}

export function resolveFetchRemote(root, base, git) {
  const hasLocal = git(root, ["rev-parse", "--verify", `refs/heads/${base}`]).status === 0;
  if (hasLocal) {
    const upstream = git(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${base}@{upstream}`]);
    if (upstream.status === 0) {
      const full = upstream.stdout.trim();
      const slash = full.indexOf("/");
      if (slash > 0) return full.slice(0, slash);
    }
  }
  const remotes = git(root, ["remote"]).stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  if (remotes.includes("origin")) return "origin";
  return null;
}

export function runSyncBase(root, baseBranch, git) {
  const base = baseBranch || "main";
  const remote = resolveFetchRemote(root, base, git);
  if (!remote) {
    return { code: 0, stdout: "sync-base: no git remote; using local base branch only\n", stderr: "" };
  }

  const fetch = git(root, ["fetch", remote, base]);
  if (fetch.status !== 0) {
    const detail = `${fetch.stderr || ""}${fetch.stdout || ""}`.trim() || `git fetch ${remote} ${base} failed`;
    return { code: 1, stdout: "", stderr: `sync-base: fetch failed: ${detail}\n` };
  }

  const remoteRef = `${remote}/${base}`;
  const remoteRev = git(root, ["rev-parse", "--verify", remoteRef]);
  if (remoteRev.status !== 0) {
    return {
      code: 1,
      stdout: "",
      stderr: `sync-base: ${remoteRef} is missing after fetch (branch may not exist on ${remote})\n`,
    };
  }
  const target = remoteRev.stdout.trim();

  const localRevResult = git(root, ["rev-parse", "--verify", `refs/heads/${base}`]);
  const hadLocal = localRevResult.status === 0;
  const oldLocal = hadLocal ? localRevResult.stdout.trim() : "";

  if (hadLocal) {
    const ahead = git(root, ["rev-list", "--count", `${target}..${base}`]);
    const aheadCount = Number.parseInt(ahead.stdout.trim(), 10) || 0;
    if (aheadCount > 0) {
      return {
        code: 1,
        stdout: "",
        stderr: `sync-base: local ${base} has ${aheadCount} commit(s) not on ${remote}/${base}; resolve or push before close\n`,
      };
    }
  }

  if (hadLocal && oldLocal === target) {
    return { code: 0, stdout: `sync-base: ${base} already up to date (${trimSha(target)})\n`, stderr: "" };
  }

  const update = git(root, ["update-ref", `refs/heads/${base}`, target, hadLocal ? oldLocal : ""]);
  if (update.status !== 0) {
    const detail = `${update.stderr || ""}${update.stdout || ""}`.trim() || "update-ref failed";
    return { code: 1, stdout: "", stderr: `sync-base: could not update ${base}: ${detail}\n` };
  }

  if (!hadLocal) {
    return { code: 0, stdout: `sync-base: created local ${base} at ${trimSha(target)} from ${remote}/${base}\n`, stderr: "" };
  }
  return {
    code: 0,
    stdout: `sync-base: fast-forwarded ${base} from ${trimSha(oldLocal)} to ${trimSha(target)}\n`,
    stderr: "",
  };
}
