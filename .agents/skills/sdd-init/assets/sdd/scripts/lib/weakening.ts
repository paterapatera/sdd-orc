import { branchBase, gitOut } from "./git.ts";

/**
 * このブランチで品質ゲートを緩めた変更を探す（試行で、PHPStan の level を下げる、対象をファイルの許可リストに絞る、
 * テストを除外する、などで品質ゲートを通していたため）。
 */

/** 品質ゲートの設定ファイル */
const QUALITY_CONFIG =
  /(^|\/)(phpunit\.xml(\.dist)?|phpstan\.neon(\.dist)?|psalm\.xml|deptrac[\w.-]*\.ya?ml|phpmd[\w.-]*\.xml|pint\.json|rector\.php|\.php-cs-fixer(\.dist)?\.php|biome\.jsonc?|eslint\.config\.[cm]?[jt]s|\.eslintrc(\.\w+)?|\.eslintignore|knip\.jsonc?|\.jscpd\.json|tsconfig[\w.-]*\.json|vitest\.config\.[cm]?[jt]s|jest\.config\.[cm]?[jt]s|playwright\.config\.[cm]?[jt]s|\.dependency-cruiser\.[cm]?js|pyproject\.toml|setup\.cfg|\.flake8|ruff\.toml|mypy\.ini|Cargo\.toml|clippy\.toml|\.golangci\.ya?ml)$/;

/** 設定ファイルに追加されたら、品質ゲートを緩めた可能性がある行 */
const RELAXING_LINE =
  /<exclude\b|excludePaths|exclude(_|-)?(dirs|paths|files)?\s*[:=]|"exclude"|ignorePatterns|"ignores?"|ignores\s*:|"includes"|includeOnly|testPathIgnore|--exclude-group|SKIP_[A-Z0-9_]+|"strict"\s*:\s*false|noImplicitAny"\s*:\s*false|reportUnmatchedIgnoredErrors\s*:\s*false|ignoreErrors|treatPhpDocTypesAsCertain/;

/** ソースコードに追加されたら、品質ゲートの検出を抑止している可能性がある行 */
const SUPPRESSION =
  /@phpstan-ignore|@psalm-suppress|eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|biome-ignore|#\s*noqa|#\s*type:\s*ignore|@SuppressWarnings|@codeCoverageIgnore|markTestSkipped|\b(it|test|describe)\.skip\(|#\[allow\(|\/\/nolint/;

export type Weakening = {
  /** 品質ゲートの設定を緩めた可能性がある変更（ファイルと行） */
  config: { file: string; line: string }[];
  /** PHPStan の level の引き下げ */
  levels: { file: string; from: string; to: string }[];
  /** ソースコードに追加した抑止のコメントなど */
  suppressions: { file: string; line: string }[];
};

function levelValue(v: string): number {
  return v === "max" ? 100 : Number(v);
}

export async function findWeakening(): Promise<Weakening | undefined> {
  const base = await branchBase();
  if (!base) return undefined;
  const result: Weakening = { config: [], levels: [], suppressions: [] };
  const diff = (await gitOut([
    "diff",
    "--unified=0",
    "--no-color",
    base,
    "HEAD",
    "--",
    ".",
    ":(exclude)docs/sdd",
    ":(exclude)docs/specs",
  ])) ?? "";
  let file = "";
  const removedLevels = new Map<string, string>();
  for (const line of diff.split("\n")) {
    const m = line.match(/^\+\+\+ b\/(.+)$/);
    if (m) {
      file = m[1];
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    const isConfig = QUALITY_CONFIG.test(file);
    if (line.startsWith("-")) {
      const lv = line.match(/^-\s*level\s*:\s*(\w+)/);
      if (isConfig && lv) removedLevels.set(file, lv[1]);
      continue;
    }
    if (!line.startsWith("+")) continue;
    const added = line.slice(1);
    if (isConfig) {
      const lv = added.match(/^\s*level\s*:\s*(\w+)/);
      if (lv) {
        const from = removedLevels.get(file);
        if (from && levelValue(lv[1]) < levelValue(from)) result.levels.push({ file, from, to: lv[1] });
        else if (!from && lv[1] !== "max" && levelValue(lv[1]) < 10) {
          result.levels.push({ file, from: "（新規）", to: lv[1] });
        }
      }
      if (RELAXING_LINE.test(added)) result.config.push({ file, line: added.trim() });
    } else if (SUPPRESSION.test(added)) {
      result.suppressions.push({ file, line: added.trim() });
    }
  }
  return result;
}
