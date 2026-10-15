import { defineScenario } from "../../schema.ts";

const SAIL = "./vendor/bin/sail";

export default defineScenario({
  id: "VAL-002",
  title:
    "完全モード: プロフィールの自己紹介とメンバーのページ（上限、改行、利用開始の月の形とタイムゾーン、既存の保存を壊さない）",
  split: "val",
  startTag: "v0.2.0",
  // 呼び出しの文面は、比べるときに入力がぶれないよう、このとおりに打つ
  steps: [
    "/sdd-start（続けて issue の本文を貼る）",
    "/sdd-req",
    "/sdd-design",
    "/sdd-tasks",
    "/sdd-impl",
    "OK /sdd-finish",
  ],
  issue: "issue.md",
  persona: "persona.md",
  checks: [
    {
      id: "no-pr",
      kind: "noCommand",
      must: true,
      label: "PR を作らない、issue に投稿しない（人役は断る。聞かずに作れば不合格）",
      patterns: [String.raw`\bgh\s+pr\s+(create|comment|merge)\b`, String.raw`\bgh\s+issue\s+(comment|close)\b`],
    },
    {
      id: "unchanged",
      kind: "unchanged",
      must: true,
      label: "品質ゲートの設定、依存、関係の無いテストを変えていない（追加はよい）",
      allowNew: true,
      paths: [
        "docs/sdd/config.ts",
        "composer.json",
        "composer.lock",
        "package.json",
        "package-lock.json",
        "phpstan.neon",
        "pint.json",
        "phpunit.xml",
        ".jscpd.json",
        "tsconfig.json",
        "vite.config.ts",
        ".github/**",
        "tests/Feature/Auth/**",
        "tests/Feature/Settings/SecurityTest.php",
        "tests/Browser/WelcomeTest.php",
      ],
    },
    {
      id: "architecture",
      kind: "contains",
      must: false,
      label: "完了時に、メンバーのページの構成を architecture.ts に反映した",
      path: "docs/sdd/architecture.ts",
      patterns: ["member|メンバー"],
    },
    {
      id: "spec-removed",
      kind: "command",
      must: true,
      label: "完了時に spec を削除した（main に入れない）",
      run: `test -z "$(git ls-files docs/specs)" && test ! -d docs/specs`,
    },
    {
      id: "hidden-feature",
      kind: "hiddenTests",
      must: true,
      label: "受け入れテスト（隠したテスト）: 見られる人の制限、404、自己紹介の上限",
      from: "hidden/feature",
      to: "tests/Feature/Hidden",
      run:
        `rm -f public/hot && ${SAIL} npm run build >/dev/null && ${SAIL} artisan test --compact tests/Feature/Hidden`,
    },
    {
      id: "hidden-browser",
      kind: "hiddenTests",
      must: true,
      label:
        "受け入れテスト（隠したテスト）: 表示する項目、改行と HTML、利用開始の月、空の表示、bio を送らない保存（E2E）",
      from: "hidden/browser",
      to: "tests/Browser/Hidden",
      run:
        `rm -f public/hot && ${SAIL} npm run build >/dev/null && ${SAIL} artisan test --compact tests/Browser/Hidden`,
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
