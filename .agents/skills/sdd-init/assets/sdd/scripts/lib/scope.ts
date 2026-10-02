import { branchChangedFiles } from "./git.ts";

type Impact = { create: readonly string[]; modify: readonly string[]; delete?: readonly string[] };

export type ScopeResult = {
  /** 影響範囲（impact）に無いのに変更したファイル */
  outside: string[];
  /** 影響範囲にあるのに変更していないファイル */
  untouched: string[];
  /** 比較できたか（既定ブランチとの分岐点が分からなければ false） */
  available: boolean;
};

/** spec と SDD の道具は比較の対象外 */
const IGNORED = [/^docs\/specs\//, /^docs\/sdd\//];

function covered(file: string, entries: readonly string[]): boolean {
  return entries.some((e) => {
    const p = e.replace(/\/$/, "");
    return file === p || file.startsWith(p + "/");
  });
}

/** このブランチで実際に変更したファイルと、spec の影響範囲を照合する */
export async function checkScope(impact: Impact): Promise<ScopeResult> {
  const changed = await branchChangedFiles();
  if (!changed) return { outside: [], untouched: [], available: false };
  const entries = [...impact.create, ...impact.modify, ...(impact.delete ?? [])];
  const files = changed.filter((f) => !IGNORED.some((re) => re.test(f)));
  return {
    outside: files.filter((f) => !covered(f, entries)),
    untouched: entries.filter((e) => !files.some((f) => covered(f, [e]))),
    available: true,
  };
}
