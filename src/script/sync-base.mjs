/**
 * Fetch and fast-forward the local base branch from its upstream remote.
 * Does not checkout branches; updates the local base ref only via git fetch.
 */

function trimSha(sha) {
  return sha.trim().slice(0, 7);
}

function listRemotes(root, git) {
  return git(root, ["remote"]).stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function resolveFetchRemote(root, base, git) {
  const remotes = listRemotes(root, git);
  if (!remotes.length) return { status: "none" };

  const hasLocal = git(root, ["rev-parse", "--verify", `refs/heads/${base}`]).status === 0;
  if (hasLocal) {
    const upstream = git(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${base}@{upstream}`]);
    if (upstream.status === 0) {
      const full = upstream.stdout.trim();
      const slash = full.indexOf("/");
      if (slash > 0) return { status: "ok", remote: full.slice(0, slash) };
    }
  }

  if (remotes.includes("origin")) return { status: "ok", remote: "origin" };
  if (remotes.length === 1) return { status: "ok", remote: remotes[0] };
  return { status: "ambiguous", remotes };
}

function ambiguousRemoteMessage(base, remotes) {
  const names = remotes.join(", ");
  return `sync-base: several remotes (${names}) with no upstream on ${base}; pick one remote and run git fetch <remote> ${base} && git branch --track ${base} <remote>/${base}, or if local ${base} already exists run git branch --set-upstream-to=<remote>/${base} ${base}; then retry\n`;
}

function checkedOutRefusal(text) {
  return /checked out|cannot lock ref|is checked out at|would be overwritten by/i.test(text);
}

function checkedOutMessage(base) {
  return `sync-base: ${base} is checked out in this or another worktree; switch to your feature branch here, or run git pull --ff-only where ${base} is checked out\n`;
}

export function runSyncBase(root, baseBranch, git) {
  const base = baseBranch || "main";
  const resolved = resolveFetchRemote(root, base, git);

  if (resolved.status === "none") {
    return { code: 0, stdout: "sync-base: no git remote; using local base branch only\n", stderr: "" };
  }
  if (resolved.status === "ambiguous") {
    return {
      code: 1,
      stdout: "",
      stderr: ambiguousRemoteMessage(base, resolved.remotes),
    };
  }

  const remote = resolved.remote;
  const remoteTracking = `refs/remotes/${remote}/${base}`;
  const fetchRemote = git(root, [
    "fetch",
    remote,
    `+refs/heads/${base}:${remoteTracking}`,
  ]);
  if (fetchRemote.status !== 0) {
    const detail = `${fetchRemote.stderr || ""}${fetchRemote.stdout || ""}`.trim()
      || `git fetch ${remote} refs/heads/${base} failed`;
    return { code: 1, stdout: "", stderr: `sync-base: fetch failed: ${detail}\n` };
  }

  const remoteRev = git(root, ["rev-parse", "--verify", remoteTracking]);
  if (remoteRev.status !== 0) {
    return {
      code: 1,
      stdout: "",
      stderr: `sync-base: could not fetch refs/heads/${base} from ${remote} (branch missing or no permission)\n`,
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

  const localFetch = git(root, ["fetch", ".", `${remoteTracking}:refs/heads/${base}`]);
  if (localFetch.status !== 0) {
    const detail = `${localFetch.stderr || ""}${localFetch.stdout || ""}`.trim() || "local fast-forward failed";
    if (checkedOutRefusal(detail)) {
      return { code: 1, stdout: "", stderr: checkedOutMessage(base) };
    }
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
