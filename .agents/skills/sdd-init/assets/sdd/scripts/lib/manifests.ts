/** 依存関係の定義ファイル（変わったら、新しい依存の追加・変更の可能性がある） */
export const MANIFESTS: readonly RegExp[] = [
  /(^|\/)package\.json$/,
  /(^|\/)pyproject\.toml$/,
  /(^|\/)requirements[^/]*\.txt$/,
  /(^|\/)Cargo\.toml$/,
  /(^|\/)go\.mod$/,
  /(^|\/)pom\.xml$/,
  /(^|\/)build\.gradle(\.kts)?$/,
  /(^|\/)Gemfile$/,
  /(^|\/)composer\.json$/,
  /(^|\/)deno\.jsonc?$/,
];

export function isManifest(path: string): boolean {
  // docs/sdd/deno.json は SDD の道具なので除く
  return !path.startsWith("docs/sdd/") && MANIFESTS.some((re) => re.test(path));
}
