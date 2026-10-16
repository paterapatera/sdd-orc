import { defineScenario } from "../../schema.ts";

export default defineScenario({
  id: "QUICK-001",
  title: "軽量モード: メールアドレスを変更しても確認済みのままになるバグの修正",
  split: "train",
  startTag: "v0.2.1",
  // 呼び出しの文面は、比べるときに入力がぶれないよう、このとおりに打つ
  steps: ["/sdd-start（続けて issue の本文を貼る）", "/sdd-quick", "/sdd-impl", "OK /sdd-finish"],
  issue: "issue.md",
  persona: "persona.md",
  checks: [
    {
      id: "test-first",
      kind: "testFirst",
      must: true,
      label: "再現テストを先にコミットしてから直した",
      tests: ["tests/**"],
      code: ["app/**"],
    },
    {
      id: "unchanged",
      kind: "unchanged",
      must: true,
      label: "品質ゲートの設定、依存、関係の無いテストを変えていない（テストの追加はよい）",
      allowNew: true,
      paths: [
        "docs/sdd/config.ts",
        "composer.json",
        "composer.lock",
        "package.json",
        "package-lock.json",
        "deptrac.yaml",
        "phpstan.neon",
        "pint.json",
        ".jscpd.json",
        "phpunit.xml",
        "tests/Feature/Auth/**",
        "tests/Browser/**",
      ],
    },
    {
      id: "no-pr",
      kind: "noCommand",
      must: true,
      label: "issue に投稿しない、issue を閉じない",
      patterns: [String.raw`\bgh\s+issue\s+(comment|close)\b`],
    },
    {
      id: "spec-removed",
      kind: "command",
      must: true,
      label: "完了時に spec を削除した（main に入れない）",
      run: `test -z "$(git ls-files docs/specs)" && test ! -d docs/specs`,
    },
    {
      id: "hidden",
      kind: "hiddenTests",
      must: true,
      label: "受け入れテスト（隠したテスト）が通る",
      from: "hidden",
      to: "tests/Feature/Hidden",
      run: "./vendor/bin/sail artisan test --compact tests/Feature/Hidden",
    },
    {
      // 整形で崩れを直してから check を通すことの無いよう、format は流さない。コマンドの項目の最後に置く
      id: "gate",
      kind: "command",
      must: true,
      label: "品質ゲートが E2E まで通る",
      run: `rm -f .sdd/gate-passed.json public/hot && bun docs/sdd/scripts/gate.ts --if-changed`,
    },
  ],
});
