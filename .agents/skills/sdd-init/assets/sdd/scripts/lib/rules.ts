import type {
  FunctionalRequirement,
  Invariant,
  IssueCoverageItem,
  NfrReview,
  NonFunctionalRequirement,
  Task,
} from "../../schema/mod.ts";
import type { LoadedIssue, LooseDesign, LooseRequirements, LooseTasks, SpecFile } from "./load.ts";

export type Diagnostic = {
  level: "error" | "warning";
  file: SpecFile | "issue.md" | "(dir)";
  message: string;
};

export type VerifyOptions = {
  /** sdd-finish の前の検証。すべてのタスクの完了と、未確定の点が無いことも求める */
  finish?: boolean;
  /** docs/sdd/nfr.ts の基準のID。ファイルが無ければ undefined */
  baselineNfrIds?: Set<string>;
  /** docs/sdd/nfr.ts の基準があるカテゴリ。ファイルが無ければ undefined */
  baselineNfrCategories?: Set<string>;
  /** docs/sdd/nfr.ts の基準のIDとカテゴリ。ファイルが無ければ undefined */
  baselineNfrs?: Map<string, string>;
  /** docs/sdd/conventions.ts の規約のIDと、守られ方（gate / manual）。ファイルが無ければ undefined */
  conventions?: Map<string, "gate" | "manual">;
  /** config.ts の ui（画面があるか） */
  ui?: boolean;
};

/** 規約から逸脱していることを示す言い回し（conventionsCompliance に書かれていたら、守り方ではなく逸脱の説明である） */
const DEVIATION =
  /使わない|使用しない|未使用|使っていない|見送|適用しない|準拠しない|守らない|スコープを超える|対象外とする|後続の?issue/;

type AnyDecision = {
  title: string;
  decidedBy: "user" | "ai";
  adr: boolean;
  deviates?: { conventions?: readonly string[]; adrs?: readonly string[] };
  context: string;
  decision: string;
  alternatives: readonly { option: string; reason: string }[];
};

/** 設計判断を誰が決めたかを確かめる（ADR になる判断と、規約・ADR からの逸脱はユーザーが決める） */
function checkDecisions(c: Collector, decisions: readonly AnyDecision[], opts: VerifyOptions) {
  for (const d of decisions) {
    if (d.adr && d.decidedBy !== "user") {
      c.error(
        `設計判断「${d.title}」は ADR になる判断（adr: true）なので、ユーザーに質問して決める（decidedBy: "user"）`,
      );
    }
    const devs = [...(d.deviates?.conventions ?? []), ...(d.deviates?.adrs ?? [])];
    if (devs.length && d.decidedBy !== "user") {
      c.error(
        `設計判断「${d.title}」は ${devs.join("、")} から逸脱するので、ユーザーに質問して決める（decidedBy: "user"）`,
      );
    }
    for (const id of d.deviates?.conventions ?? []) {
      if (opts.conventions && !opts.conventions.has(id)) {
        c.error(`設計判断「${d.title}」の deviates にある ${id} が conventions.ts にありません`);
      }
    }
    const text = [d.context, d.decision, ...d.alternatives.flatMap((a) => [a.option, a.reason])].join(" ");
    const mentioned = [...new Set(text.match(/\b(?:CONV-\d{3}|ADR-\d{4})\b/g) ?? [])].filter((id) =>
      !devs.includes(id)
    );
    if (mentioned.length && !d.adr) {
      c.warn(
        `設計判断「${d.title}」が ${
          mentioned.join("、")
        } に触れています。逸脱するなら deviates に書き、ユーザーに質問して決める`,
      );
    }
  }
}

/** 手で守る規約（manual）ごとに、設計や spec で守り方が書かれているかを確かめる */
function checkConventionsCompliance(
  c: Collector,
  compliance: Readonly<Record<string, string>> | undefined,
  conventions: Map<string, "gate" | "manual"> | undefined,
  decisions?: readonly AnyDecision[],
) {
  const map = compliance ?? {};
  // 守り方の欄に逸脱が書かれていたら、ユーザーが決めた逸脱の設計判断が必要（軽量モードには設計判断が無いので逸脱できない）
  for (const [id, text] of Object.entries(map)) {
    if (!DEVIATION.test(text) || /^該当しない/.test(text.trim())) continue;
    const approved = (decisions ?? []).some((d) => d.decidedBy === "user" && d.deviates?.conventions?.includes(id));
    if (!approved) {
      c.error(
        `conventionsCompliance の ${id} に、規約を守らないことが書かれています（「${text.match(DEVIATION)?.[0]}」）。` +
          (decisions
            ? `逸脱するならユーザーに質問し、decisions に deviates: { conventions: ["${id}"] }、decidedBy: "user" で書く`
            : "軽量モードでは規約から逸脱できない。規約どおりにするか、完全モードに切り替える"),
      );
    }
  }
  if (!conventions) return;
  for (const [id, by] of conventions) {
    if (by === "manual" && !map[id]?.trim()) {
      c.error(
        `手で守る規約 ${id} の守り方が conventionsCompliance にありません（該当しない場合は「該当しない: 理由」と書く）`,
      );
    }
  }
  for (const id of Object.keys(map)) {
    if (!conventions.has(id)) c.error(`conventionsCompliance に、conventions.ts に無い規約「${id}」があります`);
    else if (conventions.get(id) === "gate") {
      c.warn(`${id} は品質ゲートで強制している規約なので、conventionsCompliance に書く必要はありません`);
    }
  }
}

type AnyTask = Task<string, string>;

const isTestKind = (k: string) => k === "test" || k === "e2e";

function humanAcIdsOf(functional: Readonly<Record<string, FunctionalRequirement>>): Set<string> {
  return new Set(
    Object.values(functional).flatMap((fr) => fr.acceptance.filter((a) => a.verifiedBy === "human").map((a) => a.id)),
  );
}

const ID_FORMATS = {
  FR: { re: /^FR-\d{3}$/, label: "機能要件", example: "FR-001" },
  NFR: { re: /^NFR-\d{3}$/, label: "非機能要件", example: "NFR-001" },
  INV: { re: /^INV-\d{3}$/, label: "変えてはいけない振る舞い", example: "INV-001" },
  AC: { re: /^AC-\d{3}$/, label: "受け入れ条件", example: "AC-001" },
  T: { re: /^T-\d{3}$/, label: "タスク", example: "T-001" },
} as const;

type IdFormat = (typeof ID_FORMATS)[keyof typeof ID_FORMATS];

const ISSUE_ID_FORMAT = /^[A-Za-z0-9-]+$/;

class Collector {
  constructor(private file: Diagnostic["file"], readonly items: Diagnostic[] = []) {}
  /** 同じ結果の一覧に、別のファイルとして記録する */
  at(file: Diagnostic["file"]): Collector {
    return new Collector(file, this.items);
  }
  error(message: string) {
    this.items.push({ level: "error", file: this.file, message });
  }
  warn(message: string) {
    this.items.push({ level: "warning", file: this.file, message });
  }
}

/** 空文字列（空白だけのものを含む）を探す */
function findEmptyStrings(value: unknown, path: string, out: string[]) {
  if (typeof value === "string") {
    if (value.trim() === "") out.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findEmptyStrings(v, `${path}[${i}]`, out));
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) findEmptyStrings(v, `${path}.${k}`, out);
  }
}

function checkEmptyStrings(c: Collector, value: unknown, root: string) {
  const empties: string[] = [];
  findEmptyStrings(value, root, empties);
  for (const p of empties) c.error(`${p} が空です`);
}

function checkIdFormat(c: Collector, ids: Iterable<string>, f: IdFormat) {
  for (const id of ids) {
    if (!f.re.test(id)) c.error(`${f.label}のID「${id}」の形式が違います（例: ${f.example}）`);
  }
}

function checkIssueField(c: Collector, issueField: string, dirName: string) {
  if (issueField !== dirName) c.error(`issue「${issueField}」がディレクトリ名「${dirName}」と一致しません`);
}

/**
 * 曖昧な言葉（docs/sdd/guides/writing-requirements.md の「使わない」言葉）。
 * 「等」は「同等」「平等」「等しい」などを除く。
 */
const VAGUE = /など|(?<![同平対均上])等(?!し)|適切|相当|可能な限り|なるべく|または同等/;

function checkVague(c: Collector, where: string, text: string | undefined) {
  if (!text) return;
  const m = text.match(VAGUE);
  if (m) {
    c.warn(`${where} に曖昧な言葉「${m[0]}」があります（対象を列挙するか、具体的な値にしてください）: 「${text}」`);
  }
}

/** 機能要件（完全モードの functional と軽量モードの expected で共通）を検証し、ACのIDを返す */
function checkFunctional(
  c: Collector,
  functional: Readonly<Record<string, FunctionalRequirement>>,
  label: string,
): Set<string> {
  checkIdFormat(c, Object.keys(functional), ID_FORMATS.FR);
  if (Object.keys(functional).length === 0) c.warn(`${label}が1件もありません`);
  const acIds = new Set<string>();
  for (const [frId, fr] of Object.entries(functional)) {
    if (!fr.acceptance || fr.acceptance.length === 0) c.error(`${frId} に受け入れ条件がありません`);
    for (const s of fr.acceptance ?? []) {
      checkIdFormat(c, [s.id], ID_FORMATS.AC);
      if (acIds.has(s.id)) c.error(`受け入れ条件のID「${s.id}」が重複しています`);
      acIds.add(s.id);
    }
    const kinds = new Set((fr.acceptance ?? []).map((a) => a.kind));
    if (!kinds.has("normal")) c.error(`${frId} に正常系（kind: "normal"）の受け入れ条件がありません`);
    for (const [kind, label] of [["boundary", "境界値"], ["error", "異常系"]] as const) {
      const reason = fr.notApplicable?.[kind];
      if (!kinds.has(kind) && !reason) {
        c.error(
          `${frId} に${label}（kind: "${kind}"）の受け入れ条件がありません。該当しない場合は notApplicable.${kind} に理由を書いてください`,
        );
      }
      if (kinds.has(kind) && reason) {
        c.warn(`${frId} は${label}の受け入れ条件があるのに notApplicable.${kind} も書かれています`);
      }
    }
    const e = fr.ears as Record<string, string | undefined>;
    for (const k of ["trigger", "state", "feature", "condition", "response"]) {
      checkVague(c, `${frId} の ears.${k}`, e?.[k]);
    }
    for (const a of fr.acceptance ?? []) {
      for (const g of a.given) checkVague(c, `${a.id} の given`, g);
      checkVague(c, `${a.id} の when`, a.when);
      for (const t of a.then) {
        checkVague(c, `${a.id} の then`, t);
        if (/または/.test(t)) {
          c.warn(`${a.id} の then に「または」があります。期待する結果は1つに決めてください: 「${t}」`);
        }
      }
    }
    const response = fr.ears?.response ?? "";
    if (response && !/ならない$/.test(response)) {
      c.warn(`${frId} の ears.response は「〜しなければならない」で終えてください（現在: 「${response}」）`);
    }
  }
  return acIds;
}

function checkInvariants(
  c: Collector,
  invariants: Readonly<Record<string, Invariant>>,
  noInvariantsReason: string | undefined,
) {
  checkIdFormat(c, Object.keys(invariants), ID_FORMATS.INV);
  const empty = Object.keys(invariants).length === 0;
  if (empty && !noInvariantsReason) {
    c.error(
      "変えてはいけない振る舞い（invariants）が空です。該当しない場合は noInvariantsReason に理由を書いてください",
    );
  }
  if (!empty && noInvariantsReason) c.warn("invariants があるのに noInvariantsReason も書かれています");
}

/** issue.md の「受け入れ条件」の箇条書きを取り出す（「未記載」「なし」なら空） */
export function issueCriteria(issueMd: string | undefined): string[] {
  if (!issueMd) return [];
  const m = issueMd.replaceAll("\r\n", "\n").match(/^##\s*受け入れ条件\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  if (!m) return [];
  return m[1].split("\n")
    .map((l) => l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)?.[1]?.trim())
    .filter((x): x is string => !!x && !/^(未記載|なし)$/.test(x));
}

const normalize = (t: string) => t.replace(/\s+/g, " ").trim();

/** issue.md の受け入れ条件が、すべて issueCoverage に書かれているかを確かめる */
function checkIssueCoverage(
  c: Collector,
  coverage: readonly IssueCoverageItem[] | undefined,
  issueMd: string | undefined,
  knownIds: Set<string>,
) {
  const items = coverage ?? [];
  const sources = new Set(items.map((i) => normalize(i.source)));
  for (const criterion of issueCriteria(issueMd)) {
    if (!sources.has(normalize(criterion))) {
      c.error(
        `issue.md の受け入れ条件「${criterion}」が issueCoverage にありません（対応する要件か、除外する理由を書いてください）`,
      );
    }
  }
  for (const item of items) {
    if ("coveredBy" in item) {
      for (const id of item.coveredBy) {
        if (!knownIds.has(id)) c.error(`issueCoverage の「${item.source}」が存在しないID「${id}」を参照しています`);
      }
    }
  }
}

/** 非機能要件の検討結果（nfrReview）と、実際の非機能要件が一致しているかを確かめる */
function checkNfrReview(
  c: Collector,
  review: NfrReview | undefined,
  nfrs: Readonly<Record<string, NonFunctionalRequirement>>,
  _baselineCategories: Set<string> | undefined,
) {
  if (!review) {
    c.error("非機能要件の検討結果（nfrReview）がありません");
    return;
  }
  const listed = new Map<string, string>();
  for (const [category, entry] of Object.entries(review)) {
    if (entry.decision === "added") {
      for (const id of entry.ids) {
        listed.set(id, category);
        const nfr = nfrs[id];
        if (!nfr) c.error(`nfrReview の「${category}」が存在しない ${id} を挙げています`);
        else if (nfr.category !== category) {
          c.error(`${id} のカテゴリは「${nfr.category}」ですが、nfrReview では「${category}」に挙げられています`);
        }
      }
    }
  }
  for (const [id, nfr] of Object.entries(nfrs)) {
    if (!listed.has(id)) c.error(`${id} が nfrReview の「${nfr.category}」に挙げられていません（decision: "added"）`);
  }
}

function checkImpact(
  c: Collector,
  impact: { create: readonly string[]; modify: readonly string[]; delete?: readonly string[] },
) {
  const n = impact.create.length + impact.modify.length + (impact.delete?.length ?? 0);
  if (n === 0) c.warn("影響範囲（impact）にファイルが1件もありません");
}

/** タスクに関する共通の検証 */
function checkTasks(
  c: Collector,
  tasks: Readonly<Record<string, AnyTask>>,
  known: {
    refs: Set<string>;
    acIds: Set<string>;
    invIds: Set<string>;
    nfrIds: Set<string>;
    frIds: Set<string>;
    componentIds: Set<string>;
    humanAcIds?: Set<string>;
  },
  opts: VerifyOptions,
): Set<string> {
  const entries = Object.entries(tasks);
  checkIdFormat(c, entries.map(([id]) => id), ID_FORMATS.T);
  if (entries.length === 0) c.error("タスクが1件もありません");

  const referenced = new Set<string>();
  const verifiedByTest = new Set<string>();
  const verifiedByE2e = new Set<string>();
  const verifiable = new Set([...known.acIds, ...known.invIds, ...known.nfrIds, ...(opts.baselineNfrIds ?? [])]);

  for (const [tid, t] of entries) {
    if (!t.refs || t.refs.length === 0) c.error(`${tid} の refs が空です`);
    for (const r of t.refs ?? []) {
      if (!known.refs.has(r)) c.error(`${tid} の refs にある「${r}」が存在しません`);
      referenced.add(r);
    }
    for (const v of t.verifies ?? []) {
      if (!verifiable.has(v)) c.error(`${tid} の verifies にある「${v}」が存在しません`);
      if (isTestKind(t.kind)) verifiedByTest.add(v);
      if (t.kind === "e2e") verifiedByE2e.add(v);
    }
    if (t.verifies?.length && !isTestKind(t.kind)) {
      c.warn(`${tid} は kind が "test" / "e2e" ではないのに verifies があります`);
    }
    if (opts.finish && t.status !== "done") c.error(`${tid}「${t.title}」が完了していません（status: ${t.status}）`);
  }

  for (const ac of known.acIds) {
    if (!verifiedByTest.has(ac)) c.error(`受け入れ条件 ${ac} を検証するテストタスクがありません`);
  }
  for (const inv of known.invIds) {
    if (!verifiedByTest.has(inv)) c.error(`変えてはいけない振る舞い ${inv} を検証するテストタスクがありません`);
  }
  for (const nfr of known.nfrIds) {
    if (!verifiedByTest.has(nfr)) c.warn(`非機能要件 ${nfr} を検証するテストタスクがありません`);
  }
  for (const fr of known.frIds) {
    if (!referenced.has(fr)) c.error(`機能要件 ${fr} を実現するタスクがありません（refs に含めてください）`);
  }
  for (const comp of known.componentIds) {
    if (!referenced.has(comp)) c.warn(`コンポーネント ${comp} を refs に含むタスクがありません`);
  }
  // 画面がある案件では、人が確かめる受け入れ条件を E2E でも確かめる（人の受け入れテストより先に画面の誤りに気づくため）
  if (opts.ui) {
    for (const ac of known.humanAcIds ?? []) {
      if (!verifiedByE2e.has(ac)) {
        c.error(`人が確かめる受け入れ条件 ${ac} を確かめる E2E のタスク（kind: "e2e"）がありません`);
      }
    }
  }
  return verifiedByTest;
}

type Guide = { setup: readonly unknown[] } | undefined;

/** すべてのタスクが完了していて、人が確かめる受け入れ条件があるなら、受け入れテストの準備（acceptanceGuide）が必要 */
function checkAcceptanceGuide(
  c: Collector,
  functional: Readonly<Record<string, FunctionalRequirement>>,
  invariants: Readonly<Record<string, Invariant>>,
  tasks: Readonly<Record<string, AnyTask>>,
  guide: Guide,
) {
  const human = [
    ...Object.values(functional).flatMap((fr) =>
      fr.acceptance.filter((a) => a.verifiedBy === "human").map((a) => a.id)
    ),
    ...Object.entries(invariants).filter(([, v]) => v.verifiedBy === "human").map(([id]) => id),
  ];
  const allDone = Object.values(tasks).length > 0 && Object.values(tasks).every((t) => t.status === "done");
  if (allDone && human.length > 0 && !guide) {
    c.error(
      `人が確かめる受け入れ条件（${
        human.join("、")
      }）があるのに、受け入れテストの準備（acceptanceGuide）がありません。` +
        "起動の手順、テスト用のアカウント、データの用意のしかたを書いてください",
    );
  }
}

function verifyRequirements(
  c: Collector,
  issueId: string,
  r: LooseRequirements,
  issueMd: string | undefined,
  opts: VerifyOptions,
): Set<string> {
  checkEmptyStrings(c, r, "requirements");
  checkIssueField(c, r.issue, issueId);
  const acIds = checkFunctional(c, r.functional, "機能要件");
  checkIdFormat(c, Object.keys(r.nonFunctional), ID_FORMATS.NFR);
  checkInvariants(c, r.invariants, r.noInvariantsReason);
  checkNfrReview(c, r.nfrReview, r.nonFunctional, opts.baselineNfrCategories);
  checkIssueCoverage(
    c,
    r.issueCoverage,
    issueMd,
    new Set([...Object.keys(r.functional), ...Object.keys(r.nonFunctional), ...Object.keys(r.invariants), ...acIds]),
  );
  for (const [id, nfr] of Object.entries(r.nonFunctional)) {
    if (!nfr.overrides) continue;
    if (!opts.baselineNfrIds) {
      c.warn(`${id} が ${nfr.overrides} を上書きしていますが、docs/sdd/nfr.ts がありません`);
    } else if (!opts.baselineNfrIds.has(nfr.overrides)) {
      c.error(`${id} が上書きしている ${nfr.overrides} が docs/sdd/nfr.ts にありません`);
    }
  }
  if (r.openQuestions.length > 0) {
    const msg = `未確定の点が ${r.openQuestions.length} 件残っています`;
    if (opts.finish) c.error(msg);
    else c.warn(msg);
  }
  return acIds;
}

function verifyDesign(c: Collector, r: LooseRequirements, d: LooseDesign, opts: VerifyOptions) {
  checkEmptyStrings(c, d, "design");
  const comps = new Set(Object.keys(d.components));
  if (comps.size === 0) c.error("コンポーネントが1件もありません");

  const targets = [...Object.keys(r.functional), ...Object.keys(r.nonFunctional)];
  const trace = d.traceability as Readonly<Record<string, readonly string[]>>;
  const traced = new Set<string>();
  for (const id of targets) {
    const list = trace[id];
    if (!list || list.length === 0) {
      c.error(`${id} に対応するコンポーネントが traceability にありません`);
      continue;
    }
    for (const comp of list) {
      if (!comps.has(comp)) c.error(`traceability の ${id} が存在しないコンポーネント「${comp}」を参照しています`);
      traced.add(comp);
    }
  }
  for (const id of Object.keys(trace)) {
    if (!targets.includes(id)) c.error(`traceability に要件に無いID「${id}」があります`);
  }
  for (const comp of comps) {
    if (!traced.has(comp)) c.warn(`コンポーネント ${comp} はどの要件の traceability にも含まれていません`);
  }
  for (const dep of d.dependencies) {
    for (const end of [dep.from, dep.to]) {
      if (!comps.has(end)) c.error(`dependencies が存在しないコンポーネント「${end}」を参照しています`);
    }
  }
  for (const [name, i] of Object.entries(d.interfaces)) {
    if (!comps.has(i.component)) {
      c.error(`interfaces.${name} が存在しないコンポーネント「${i.component}」を参照しています`);
    }
  }
  for (const [name, comp] of Object.entries(d.components)) {
    if (comp.kind === "modified" && !comp.asIs) c.warn(`既存のコンポーネント ${name} に asIs（現状）がありません`);
  }
  checkImpact(c, d.impact);
  checkConventionsCompliance(c, d.conventionsCompliance, opts.conventions, d.decisions as readonly AnyDecision[]);
  checkDecisions(c, d.decisions as readonly AnyDecision[], opts);

  // 影響範囲とコンポーネントのファイルの照合（影響範囲の漏れは、衝突の検出と実装範囲の管理を無効にする）
  const impactFiles = new Set([...d.impact.create, ...d.impact.modify, ...(d.impact.delete ?? [])]);
  for (const [name, comp] of Object.entries(d.components)) {
    for (const f of comp.files) {
      if (!impactFiles.has(f)) c.error(`コンポーネント ${name} のファイル ${f} が impact にありません`);
    }
    if (comp.kind === "new") {
      for (const f of comp.files) {
        if (d.impact.delete?.includes(f)) {
          c.error(`新規のコンポーネント ${name} のファイル ${f} が impact.delete にあります`);
        }
      }
    }
  }

  // 既存のインターフェースとデータモデルの変更
  for (const [name, i] of Object.entries(d.interfaces)) {
    if (i.change !== "new" && !("compatibility" in i && i.compatibility)) {
      c.error(
        `interfaces.${name} は既存のものの${
          i.change === "removed" ? "削除" : "変更"
        }なので、compatibility（呼び出し元への影響と互換の扱い）が必要です`,
      );
    }
  }
  for (const [name, m] of Object.entries(d.dataModels)) {
    if (m.kind === "modified" && !("migration" in m && m.migration)) {
      c.error(`dataModels.${name} は既存のものの変更なので、migration（既存データの移行方法）が必要です`);
    }
  }

  // エラー処理と、異常系の受け入れ条件・EARSの異常系（unwanted）の要件の対応
  const handled = new Set<string>(d.errorHandling.flatMap((e) => e.refs ?? []));
  const knownIds = new Set([
    ...Object.keys(r.functional),
    ...Object.keys(r.nonFunctional),
    ...Object.values(r.functional).flatMap((fr) => fr.acceptance.map((a) => a.id)),
  ]);
  for (const e of d.errorHandling) {
    for (const ref of e.refs ?? []) {
      if (!knownIds.has(ref)) c.error(`errorHandling の「${e.case}」が存在しないID「${ref}」を参照しています`);
    }
  }
  for (const [frId, fr] of Object.entries(r.functional)) {
    const acIds = fr.acceptance.map((a) => a.id);
    if (fr.ears.pattern === "unwanted" && !handled.has(frId) && !acIds.some((a) => handled.has(a))) {
      c.error(`${frId} は異常系（unwanted）の要件ですが、対応するエラー処理（errorHandling の refs）がありません`);
    }
    for (const a of fr.acceptance) {
      if (a.kind === "error" && !handled.has(a.id) && !handled.has(frId)) {
        c.error(`異常系の受け入れ条件 ${a.id} に対応するエラー処理（errorHandling の refs）がありません`);
      }
    }
  }

  // 非機能要件の実現方法と、変えてはいけない振る舞いの守り方
  const strategies: [string, Readonly<Record<string, string>> | undefined, string[], string][] = [
    ["nfrStrategy", d.nfrStrategy, Object.keys(r.nonFunctional), "実現方法"],
    ["invariantStrategy", d.invariantStrategy, Object.keys(r.invariants), "守り方"],
  ];
  for (const [field, map, ids, label] of strategies) {
    for (const id of ids) {
      if (!map?.[id]) c.error(`${id} の${label}が ${field} にありません`);
    }
    for (const id of Object.keys(map ?? {})) {
      if (!ids.includes(id)) c.error(`${field} に要件に無いID「${id}」があります`);
    }
  }
}

function verifyFull(c: Collector, issue: LoadedIssue, opts: VerifyOptions) {
  const { requirements: r, design: d, tasks: t } = issue;
  if (!r) {
    if (d || t) c.at("requirements.ts").error("requirements.ts が無いまま設計やタスクが作られています");
    return;
  }
  const acIds = verifyRequirements(c.at("requirements.ts"), issue.id, r, issue.issueMd, opts);
  if (!d) {
    if (t) c.at("design.ts").error("design.ts が無いままタスクが作られています");
    return;
  }
  verifyDesign(c.at("design.ts"), r, d, opts);
  if (!t) return;
  verifyFullTasks(c.at("tasks.ts"), r, d, t, acIds, opts);
}

function verifyFullTasks(
  c: Collector,
  r: LooseRequirements,
  d: LooseDesign,
  t: LooseTasks,
  acIds: Set<string>,
  opts: VerifyOptions,
) {
  checkEmptyStrings(c, t, "tasks");
  checkAcceptanceGuide(c, r.functional, r.invariants, t.tasks, t.acceptanceGuide);
  const frIds = new Set(Object.keys(r.functional));
  const nfrIds = new Set(Object.keys(r.nonFunctional));
  const invIds = new Set(Object.keys(r.invariants));
  const componentIds = new Set(Object.keys(d.components));
  const verified = checkTasks(c, t.tasks, {
    refs: new Set([...frIds, ...nfrIds, ...invIds, ...componentIds]),
    acIds,
    invIds,
    nfrIds,
    frIds,
    componentIds,
    humanAcIds: humanAcIdsOf(r.functional),
  }, opts);
  checkBaselineNfrVerification(c, r, verified, opts);
}

/**
 * nfrReview で baseline にしたカテゴリに docs/sdd/nfr.ts の基準があれば、各基準をテストタスクで確かめるか、
 * waived に理由を書く（プロジェクト全体の非機能要件が、どのissueでも確かめられないことを防ぐ）
 */
function checkBaselineNfrVerification(
  c: Collector,
  r: LooseRequirements,
  verifiedByTest: Set<string>,
  opts: VerifyOptions,
) {
  if (!opts.baselineNfrs || !r.nfrReview) return;
  for (const [category, entry] of Object.entries(r.nfrReview)) {
    const waived = entry.decision === "baseline" ? (entry.waived ?? {}) : {};
    for (const id of Object.keys(waived)) {
      if (!opts.baselineNfrs.has(id)) {
        c.error(`nfrReview の「${category}」の waived にある ${id} が docs/sdd/nfr.ts にありません`);
      } else if (opts.baselineNfrs.get(id) !== category) {
        c.error(
          `nfrReview の「${category}」の waived にある ${id} は、カテゴリ「${opts.baselineNfrs.get(id)}」の基準です`,
        );
      }
    }
    if (entry.decision !== "baseline") continue;
    for (const [id, cat] of opts.baselineNfrs) {
      if (cat !== category || verifiedByTest.has(id) || waived[id as keyof typeof waived]) continue;
      c.error(
        `プロジェクト全体の非機能要件 ${id}（${category}）を確かめるテストタスクがありません。` +
          `tasks の verifies に ${id} を書くか、nfrReview の「${category}」の waived に確かめない理由を書いてください`,
      );
    }
  }
}

function verifyQuick(c: Collector, issue: LoadedIssue, opts: VerifyOptions) {
  const q = issue.quick!;
  checkEmptyStrings(c, q, "spec");
  checkIssueField(c, q.issue, issue.id);
  const acIds = checkFunctional(c, q.expected, "期待する動作（expected）");
  checkInvariants(c, q.invariants, q.noInvariantsReason);
  checkIssueCoverage(
    c,
    q.issueCoverage,
    issue.issueMd,
    new Set([...Object.keys(q.expected), ...Object.keys(q.invariants), ...acIds]),
  );
  if (q.kind === "bugfix") {
    if (!q.cause) c.error('バグの修正（kind: "bugfix"）には cause（原因）が必要です');
    const first = Object.values(q.tasks)[0];
    if (first && first.kind !== "test") {
      c.error('バグの修正では、最初のタスクを再現テスト（kind: "test"）にしてください');
    }
  }
  checkImpact(c, q.impact);
  checkConventionsCompliance(c, q.conventionsCompliance, opts.conventions);
  checkAcceptanceGuide(c, q.expected, q.invariants, q.tasks, q.acceptanceGuide);
  const taskCount = Object.keys(q.tasks).length;
  if (taskCount > 3) c.warn(`タスクが ${taskCount} 件あります。完全モードへの格上げを検討してください`);
  const frIds = new Set(Object.keys(q.expected));
  const invIds = new Set(Object.keys(q.invariants));
  checkTasks(c, q.tasks, {
    refs: new Set([...frIds, ...invIds]),
    acIds,
    invIds,
    nfrIds: new Set(),
    frIds,
    componentIds: new Set(),
    humanAcIds: humanAcIdsOf(q.expected),
  }, opts);
}

/** 1件のissueを検証する */
export function verifyIssue(issue: LoadedIssue, opts: VerifyOptions = {}): Diagnostic[] {
  const c = new Collector("(dir)");
  if (!ISSUE_ID_FORMAT.test(issue.id)) {
    c.error(`ディレクトリ名「${issue.id}」に使えない文字が含まれています（英数字とハイフンだけにしてください）`);
  }
  if (issue.issueMd === undefined) c.at("issue.md").error("issue.md がありません");
  for (const e of issue.loadErrors) c.at(e.file).error(`読み込みに失敗しました: ${e.message}`);

  switch (issue.mode) {
    case "none":
      c.warn("specがまだありません");
      if (opts.finish) c.error("specが無いため完了処理を行えません");
      break;
    case "mixed":
      c.error("軽量モード（spec.ts）と完全モード（requirements.ts など）のファイルが混在しています");
      break;
    case "full":
      verifyFull(c, issue, opts);
      if (opts.finish && !issue.tasks) c.at("tasks.ts").error("tasks.ts が無いため完了処理を行えません");
      break;
    case "quick":
      if (issue.quick) verifyQuick(c.at("spec.ts"), issue, opts);
      break;
  }
  return c.items;
}
