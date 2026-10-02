import { join } from "node:path";
import type { Config } from "../../schema/mod.ts";
import { exists, ROOT } from "./paths.ts";

/**
 * 品質ゲートでテストを除外している設定を探す。除外したテストは、受け入れ条件などの根拠にならない
 * （試行で、フロントエンドのビルドの検証が除外されていて、スタイルの不具合を検出できなかった）。
 */
const PATTERNS: [RegExp, string][] = [
  [/\bSKIP_[A-Z0-9_]+\s*=/, "SKIP_ で始まる環境変数"],
  [/--exclude-group\b/, "--exclude-group"],
  [/--skip\b/, "--skip"],
  [/-k\s+["']?not\b/, '-k "not ..."'],
  [/--testPathIgnorePatterns\b|--testPathIgnore\b/, "--testPathIgnorePatterns"],
  [/--filter\s+["']?!/, "--filter で除外"],
];

/** commands のコマンドと、そこから呼ばれるスクリプトファイル（bash xxx.sh、sh xxx.sh、./xxx.sh）の中身を調べる */
export async function findGateSkips(commands: Config["commands"]): Promise<string[]> {
  const found: string[] = [];
  for (const [name, cmd] of Object.entries(commands ?? {})) {
    if (!cmd) continue;
    const sources: [string, string][] = [[`commands.${name}`, cmd]];
    for (const m of cmd.matchAll(/(?:^|\s)(?:bash\s+|sh\s+|\.\/)?([\w./-]+\.sh)\b/g)) {
      const path = join(ROOT, m[1]);
      if (await exists(path)) sources.push([m[1], await Deno.readTextFile(path)]);
    }
    for (const [where, text] of sources) {
      for (const [re, label] of PATTERNS) {
        if (re.test(text)) found.push(`${where}: ${label}`);
      }
    }
  }
  return [...new Set(found)];
}
