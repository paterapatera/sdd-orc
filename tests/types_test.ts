import { test } from "bun:test";
// 型定義が誤りを型エラーとして検出できることを確かめる。
// `@ts-expect-error` の直後の行で型エラーが起きなければ、型チェックが失敗する。
import {
  defineConfig,
  defineDesign,
  defineQuickSpec,
  defineRequirements,
  defineTasks,
} from "../.agents/skills/sdd-init/assets/sdd/schema/mod.ts";

const ac = <const I extends `AC-${number}`>(id: I) =>
  ({ id, kind: "normal", verifiedBy: "human", given: [], when: "w", then: ["t"] as const }) as const;

const na = { result: "notApplicable", note: "n" } as const;
const checklist = {
  actors: na,
  dataStates: na,
  inputValidation: na,
  errorFeedback: na,
  existingData: na,
  consistency: na,
  outOfScope: na,
} as const;
const nfrNa = { decision: "notApplicable", reason: "r" } as const;
const nfrReview = {
  可用性: nfrNa,
  "性能・拡張性": nfrNa,
  "運用・保守性": nfrNa,
  移行性: nfrNa,
  セキュリティ: nfrNa,
  "システム環境・エコロジー": nfrNa,
} as const;
const reqExtra = { nfrReview, issueCoverage: [], checklist, values: [], answers: {} } as const;
const quickExtra = { issueCoverage: [], checklist, conventionsCompliance: {} } as const;

const reqs = defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {
    "FR-001": {
      title: "a",
      ears: { pattern: "ubiquitous", response: "r" },
      acceptance: [ac("AC-001")],
    },
    "FR-002": {
      title: "b",
      ears: { pattern: "event", trigger: "t", response: "r" },
      acceptance: [ac("AC-002")],
    },
  },
  nonFunctional: {},
  invariants: { "INV-001": { title: "i", behavior: "b", verification: "v", verifiedBy: "automated" } },
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {
    "FR-001": {
      title: "a",
      // @ts-expect-error event 型には trigger が必要
      ears: { pattern: "event", response: "r" },
      acceptance: [ac("AC-001")],
    },
  },
  nonFunctional: {},
  invariants: {},
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {
    "FR-001": {
      title: "a",
      ears: { pattern: "ubiquitous", response: "r" },
      // @ts-expect-error 受け入れ条件は1件以上
      acceptance: [],
    },
  },
  nonFunctional: {},
  invariants: {},
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {
    // @ts-expect-error IDの形式が違う
    "REQ-001": {
      title: "a",
      ears: { pattern: "ubiquitous", response: "r" },
      acceptance: [ac("AC-001")],
    },
  },
  nonFunctional: {},
  invariants: {},
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

const dna = { result: "notApplicable", note: "n" } as const;
const base = {
  overview: "o",
  asIs: "a",
  toBe: "t",
  answers: {},
  interfaces: {},
  dataModels: {},
  errorHandling: [],
  impact: { create: [], modify: [] },
  decisions: [],
  nfrStrategy: {},
  invariantStrategy: { "INV-001": "s" },
  conventionsCompliance: {},
  checklist: {
    conventions: dna,
    security: dna,
    dataIntegrity: dna,
    performance: dna,
    observability: dna,
    testability: dna,
    rollback: dna,
    sharedFiles: dna,
  },
} as const;
const comp = { kind: "new", responsibility: "r", files: [], placement: { adr: "ADR-0001" } } as const;

const design = defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp, B: comp },
  dependencies: [{ from: "A", to: "B" }],
  traceability: { "FR-001": ["A"], "FR-002": ["B"] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  // @ts-expect-error FR-002 の対応が漏れている
  traceability: { "FR-001": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  // @ts-expect-error 存在しないコンポーネントを参照している
  traceability: { "FR-001": ["A"], "FR-002": ["Z"] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  // @ts-expect-error 対応するコンポーネントが空
  traceability: { "FR-001": ["A"], "FR-002": [] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  // @ts-expect-error 依存関係で存在しないコンポーネントを参照している
  dependencies: [{ from: "A", to: "Z" }],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

const structureAnswers = {
  "ANS-001": { about: { placement: ["src/x/"] }, question: "q", answer: "a" },
  "ANS-002": { about: { link: [["src/x/"], ["src/core/", "web/src/"]] }, question: "q", answer: "a" },
} as const;

defineDesign<typeof reqs>()({
  ...base,
  answers: structureAnswers,
  components: {
    A: { kind: "modified", responsibility: "r", files: [] },
    B: { kind: "new", responsibility: "r", files: [], placement: { component: "A" } },
    C: { kind: "new", responsibility: "r", files: [], placement: { architecture: "引用" } },
    D: { kind: "new", responsibility: "r", files: [], placement: { answer: "ANS-001" } },
  },
  dependencies: [
    { from: "A", to: "D", basis: { answer: "ANS-002" } },
    {
      from: "A",
      to: "B",
      basis: { adr: "ADR-0001" },
    },
  ],
  decisions: [
    {
      title: "t",
      decidedBy: "user",
      answers: ["ANS-001", "ANS-002"],
      context: "c",
      decision: "d",
      alternatives: [],
      adr: true,
    },
  ],
  traceability: { "FR-001": ["A"], "FR-002": ["B", "C", "D"] },
});

defineDesign<typeof reqs>()({
  ...base,
  answers: structureAnswers,
  components: {
    // @ts-expect-error 根拠の回答は answers にある ID だけ
    A: { kind: "new", responsibility: "r", files: [], placement: { answer: "ANS-009" } },
  },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: {
    // @ts-expect-error 設計判断の title は置き場所の根拠にならない（人の回答は answers の ID で指す）
    A: { kind: "new", responsibility: "r", files: [], placement: { decision: "置き場所" } },
  },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  // @ts-expect-error 回答の about は placement（パスの一覧）か link（両側のパスの一覧）
  answers: { "ANS-001": { about: { link: [["src/x/"]] }, question: "q", answer: "a" } },
  components: { A: comp },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  answers: { "ANS-001": { about: { placement: ["src/x/"] }, question: "q", proposal: "p" } },
  components: { A: { kind: "new", responsibility: "r", files: [], placement: { answer: "ANS-001" } } },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  // @ts-expect-error 回答は answer（人の回答）か proposal（未回答のときの書き手の案）のどちらかが要る
  answers: { "ANS-001": { about: { placement: ["src/x/"] }, question: "q" } },
  components: { A: comp },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: {
    // @ts-expect-error 新しいコンポーネントには置き場所の根拠（placement）が要る
    A: { kind: "new", responsibility: "r", files: [] },
  },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: {
    // @ts-expect-error AI の判断は置き場所の根拠にならない
    A: { kind: "new", responsibility: "r", files: [], placement: { decidedBy: "ai" } },
  },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp, B: comp },
  // @ts-expect-error つなぎ方の根拠は ADR か人の回答だけ（既存のコンポーネントは根拠にならない）
  dependencies: [{ from: "A", to: "B", basis: { component: "A" } }],
  traceability: { "FR-001": ["A"], "FR-002": ["B"] },
});

const task = { title: "t", kind: "test", description: "d", status: "todo" } as const;

defineTasks<typeof reqs, typeof design>()({
  tasks: {
    "T-001": { ...task, refs: ["FR-001", "A", "INV-001"], verifies: ["AC-001", "INV-001"] },
  },
});

defineTasks<typeof reqs, typeof design>()({
  tasks: {
    // @ts-expect-error 存在しない要件を参照している
    "T-001": { ...task, refs: ["FR-009"] },
  },
});

defineTasks<typeof reqs, typeof design>()({
  tasks: {
    // @ts-expect-error 存在しない受け入れ条件を検証しようとしている
    "T-001": { ...task, refs: ["FR-001"], verifies: ["AC-009"] },
  },
});

defineTasks<typeof reqs, typeof design>()({
  tasks: {
    // @ts-expect-error refs は1件以上
    "T-001": { ...task, refs: [] },
  },
});

const expected = {
  "FR-001": {
    title: "a",
    ears: { pattern: "ubiquitous", response: "r" },
    acceptance: [ac("AC-001")],
  },
} as const;

defineQuickSpec({
  ...quickExtra,
  issue: "X-2",
  kind: "change",
  summary: "s",
  expected,
  invariants: {},
  approach: "a",
  impact: { create: [], modify: [] },
  tasks: { "T-001": { ...task, refs: ["FR-001"], verifies: ["AC-001"] } },
});

// @ts-expect-error バグの修正には原因が必要
defineQuickSpec({
  ...quickExtra,
  issue: "X-2",
  kind: "bugfix",
  summary: "s",
  expected,
  invariants: {},
  approach: "a",
  impact: { create: [], modify: [] },
  tasks: { "T-001": { ...task, refs: ["FR-001"] } },
});

defineQuickSpec({
  ...quickExtra,
  issue: "X-2",
  kind: "change",
  summary: "s",
  expected,
  invariants: {},
  approach: "a",
  impact: { create: [], modify: [] },
  // @ts-expect-error 存在しない受け入れ条件を検証しようとしている
  tasks: { "T-001": { ...task, refs: ["FR-001"], verifies: ["AC-002"] } },
});

defineTasks<typeof reqs, typeof design>()({
  tasks: {
    // @ts-expect-error タスクIDの形式が違う
    "TASK-1": { ...task, refs: ["FR-001"] },
  },
});

defineQuickSpec({
  ...quickExtra,
  issue: "X-2",
  kind: "change",
  summary: "s",
  // @ts-expect-error 期待する動作のIDの形式が違う
  expected: { "REQ-1": expected["FR-001"] },
  invariants: {},
  approach: "a",
  impact: { create: [], modify: [] },
  tasks: { "T-001": { ...task, refs: ["REQ-1"] } },
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {},
  nonFunctional: {},
  invariants: {},
  // @ts-expect-error 非機能要件の検討でカテゴリが欠けている
  nfrReview: { 可用性: nfrNa },
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {},
  nonFunctional: {},
  invariants: {},
  // @ts-expect-error 存在しない非機能要件を追加したことにしている
  nfrReview: { ...nfrReview, 可用性: { decision: "added", ids: ["NFR-009"] } },
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: { "FR-001": { title: "a", ears: { pattern: "ubiquitous", response: "r" }, acceptance: [ac("AC-001")] } },
  nonFunctional: {},
  invariants: {},
  // @ts-expect-error issue の受け入れ条件を、存在しない要件に対応付けている
  issueCoverage: [{ source: "x", coveredBy: ["FR-009"] }],
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {},
  nonFunctional: {},
  invariants: {},
  // @ts-expect-error チェックリストの項目が欠けている
  checklist: { actors: na },
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {
    "FR-001": {
      title: "a",
      ears: { pattern: "ubiquitous", response: "r" },
      // @ts-expect-error 受け入れ条件の種類が無い
      acceptance: [{ id: "AC-001", verifiedBy: "human", given: [], when: "w", then: ["t"] }],
    },
  },
  nonFunctional: {},
  invariants: {},
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
  // @ts-expect-error 変えてはいけない振る舞いの守り方が欠けている
  invariantStrategy: {},
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
  interfaces: {
    // @ts-expect-error 既存のインターフェースを変更するのに compatibility が無い
    f: { component: "A", kind: "function", change: "modified", signature: "s", description: "d" },
  },
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
  dataModels: {
    // @ts-expect-error 既存のデータモデルを変更するのに migration が無い
    t: { kind: "modified", description: "d", definition: "x" },
  },
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
  // @ts-expect-error エラー処理が存在しない受け入れ条件を参照している
  errorHandling: [{ case: "c", handling: "h", refs: ["AC-009"] }],
});

defineDesign<typeof reqs>()({
  ...base,
  components: { A: comp },
  dependencies: [],
  traceability: { "FR-001": ["A"], "FR-002": ["A"] },
  // @ts-expect-error 設計のチェックリストの項目が欠けている
  checklist: { conventions: dna },
});

defineRequirements({
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: {
    "FR-001": {
      title: "a",
      ears: { pattern: "ubiquitous", response: "r" },
      // @ts-expect-error 受け入れ条件の確かめ方が無い
      acceptance: [{ id: "AC-001", kind: "normal", given: [], when: "w", then: ["t"] }],
    },
  },
  nonFunctional: {},
  invariants: {},
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
});

defineTasks<typeof reqs, typeof design>()({
  tasks: {
    // @ts-expect-error タスクにコミットは書かない
    "T-001": { ...task, refs: ["FR-001"], commit: "abc1234" },
  },
});

defineTasks<typeof reqs, typeof design>()({
  tasks: {
    // プロジェクト全体の非機能要件（BNFR-xxx）も verifies に書ける
    "T-001": { ...task, refs: ["FR-001"], verifies: ["AC-001", "BNFR-001"] },
  },
});

defineConfig({
  schemaVersion: "0.9.0",
  tracker: "manual",
  branchPrefix: "",
  staleBranchDays: 30,
  issues: { cli: "backlog" },
  forge: { cli: "gh" },
});
defineConfig({
  schemaVersion: "0.9.0",
  tracker: "manual",
  branchPrefix: "",
  staleBranchDays: 30,
  // @ts-expect-error issue の取得先は gh / fj / jira / backlog / manual
  issues: { cli: "github" },
});

const valueReq = {
  ...reqExtra,
  issue: "X-1",
  summary: "s",
  functional: { "FR-001": { title: "a", ears: { pattern: "ubiquitous", response: "r" }, acceptance: [ac("AC-001")] } },
  nonFunctional: {},
  invariants: {},
  assumptions: [],
  openQuestions: [],
  outOfScope: [],
} as const;
const display = { long: { open: true }, lineBreak: { open: true }, empty: { open: true } } as const;

defineRequirements({
  ...valueReq,
  values: [
    {
      target: "t",
      kind: "textDisplay",
      aspects: {
        long: { decidedBy: ["AC-001"], basis: { issue: "q" } },
        lineBreak: { open: true },
        empty: { notApplicable: "n", basis: { answer: "ANS-001" } },
      },
    },
  ],
  answers: { "ANS-001": { target: "t", aspect: "a", answer: "n" } },
  openQuestions: [{ target: "t", aspect: "a" }],
});

defineRequirements({
  ...valueReq,
  values: [
    {
      target: "t",
      kind: "listDisplay",
      // @ts-expect-error 種類の観点（tie）が欠けている
      aspects: {
        items: { open: true },
        order: { open: true },
        empty: { open: true },
        pageSize: { open: true },
        rest: { open: true },
      },
    },
  ],
});

defineRequirements({
  ...valueReq,
  // @ts-expect-error 存在しない受け入れ条件で決めたことにしている
  values: [
    {
      target: "t",
      kind: "textDisplay",
      aspects: { ...display, long: { decidedBy: ["AC-009"], basis: { issue: "q" } } },
    },
  ],
});

defineRequirements({
  ...valueReq,
  // @ts-expect-error 値の種類が無い
  values: [{ target: "t", kind: "colorInput", aspects: display }],
});

defineRequirements({
  ...valueReq,
  // @ts-expect-error 決めた扱いに出どころが無い
  values: [{ target: "t", kind: "textDisplay", aspects: { ...display, long: { decidedBy: ["AC-001"] } } }],
});

defineRequirements({
  ...valueReq,
  // @ts-expect-error 未確定は true だけで、質問の文は書かない
  values: [{ target: "t", kind: "textDisplay", aspects: { ...display, long: { open: "どう見せるか" } } }],
});

defineRequirements({
  ...valueReq,
  values: [
    {
      target: "t",
      kind: "textDisplay",
      // @ts-expect-error 関係しない扱いの出どころは人の回答だけ
      aspects: { ...display, long: { notApplicable: "n", basis: { issue: "q" } } },
    },
  ],
});

defineRequirements({
  ...valueReq,
  // @ts-expect-error answers に無い回答を出どころにしている
  values: [
    {
      target: "t",
      kind: "textDisplay",
      aspects: { ...display, long: { decidedBy: ["AC-001"], basis: { answer: "ANS-009" } } },
    },
  ],
});

defineRequirements({
  ...valueReq,
  answers: {
    // @ts-expect-error 回答の ID の形式が違う
    "Q-1": { target: "t", aspect: "a", answer: "n" },
  },
});

defineRequirements({
  ...valueReq,
  // @ts-expect-error 未確定の点は対象と観点の組で書く
  openQuestions: ["表示の件数"],
});

test("型定義のテストは型チェックで行う", () => {});
