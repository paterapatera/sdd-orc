import type {
  FunctionalRequirement,
  Invariant,
  IssueCoverageItem,
  NfrReview,
  NonFunctionalRequirement,
  OpenQuestion,
  Task,
  ValueCheck,
} from "../../schema/mod.ts";
import { VALUE_KINDS } from "../../schema/mod.ts";
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
  /** requirements.ts の values が出どころに挙げたファイルのうち、リポジトリに無いもの */
  missingBasisFiles?: Set<string>;
  /**
   * docs/sdd/architecture.ts の modules のパスと、引用できる文。dependsOn はモジュールのパスから、そのモジュールが
   * 依存するモジュールのパスへの対応。ファイルが無ければ undefined
   */
  architecture?: {
    modulePaths: readonly string[];
    texts: readonly string[];
    dependsOn?: ReadonlyMap<string, readonly string[]>;
  };
  /** docs/sdd/adr の ADR の ID と、status、title と decision の文。ディレクトリが無ければ undefined */
  adrs?: Map<string, { status: string; text: string }>;
  /**
   * 構成の回答の記録（verify が未回答として一覧に出した ID、直前のコミットにある ID、ユーザーが答えたと書き手が
   * --answered で申告した ID）。undefined なら確かめない。answered が undefined なら申告は確かめない
   */
  answerRecords?: { asked: Set<string>; committed: Set<string>; answered?: Set<string> };
  /** Git が追跡しているファイル（リポジトリからの相対パス）。undefined なら前例のある場所を根拠にしない */
  trackedFiles?: readonly string[];
};

/** 規約から逸脱していることを示す言い回し（conventionsCompliance に書かれていたら、守り方ではなく逸脱の説明である） */
const DEVIATION =
  /使わない|使用しない|未使用|使っていない|見送|適用しない|準拠しない|守らない|スコープを超える|対象外とする|後続の?issue/;

type AnyDecision = {
  title: string;
  decidedBy: "user" | "ai";
  adr: boolean;
  answers?: readonly string[];
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
    const mentioned = [...new Set(text.match(/\b(?:CONV-\d{3}|ADR-\d{4})\b/g) ?? [])].filter(
      (id) => !devs.includes(id),
    );
    if (mentioned.length && !d.adr) {
      c.warn(
        `設計判断「${d.title}」が ${mentioned.join(
          "、",
        )} に触れています。逸脱するなら deviates に書き、ユーザーに質問して決める`,
      );
    }
  }
}

const asDir = (p: string) => `${p.replace(/^\.\//, "").replace(/\/+$/, "")}/`;
const dirOf = (f: string) => f.slice(0, f.lastIndexOf("/") + 1);

/** 文に、パスそのものが1つの語として出てくるか（a/b/c は a/ も c/ も書いたことにならない） */
function mentionsPath(text: string, path: string): boolean {
  const p = asDir(path).slice(0, -1);
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w./-])${escaped}(?!/?[\\w.-])`).test(text);
}

/** 文に、パスそのものか、その下のパスが1つの語として出てくるか */
function mentionsUnder(text: string, path: string): boolean {
  const p = asDir(path).slice(0, -1);
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w./-])${escaped}(?:/|(?![\\w.-]))`).test(text);
}

/** ファイルが入る architecture.ts のモジュールのパス（最も深いもの）。どれにも入らなければ undefined */
function moduleOf(file: string, modulePaths: readonly string[]): string | undefined {
  return modulePaths
    .map(asDir)
    .filter((p) => file.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
}

/** ファイルがすべて入るディレクトリのパス（浅い順） */
function commonDirs(files: readonly string[]): string[] {
  if (!files.length) return [];
  const parts = files[0].split("/").slice(0, -1);
  return parts.map((_, i) => `${parts.slice(0, i + 1).join("/")}/`).filter((d) => files.every((f) => f.startsWith(d)));
}

/** ファイルがすべて、パスのどれかの下にあるか */
const under = (files: readonly string[], paths: string | readonly string[]) =>
  files.every((f) => [paths].flat().some((p) => f.startsWith(asDir(p))));

type AnyComponent = { kind: "new" | "modified"; files: readonly string[]; placement?: Record<string, string> };
type AnyDependency = { from: string; to: string; basis?: Record<string, string> };
type AnyStructureAnswer = {
  about: { placement?: readonly string[]; link?: readonly (readonly string[])[] };
  question: string;
  answer?: string;
  proposal?: string;
};

const ASK_STRUCTURE =
  "ユーザーに1件ずつ質問し、回答を answers に書いてその ID を指す（構成の判断は AI では決めない）。" +
  "まだ聞いていなければ、answer を書かずに proposal（書き手の案）で answers に残し、設計の終わりの確認ポイントで聞く";

/** 構成の回答の対象を1行で表す */
function aboutText(a: AnyStructureAnswer): string {
  if (a.about.placement) return `置き場所 ${a.about.placement.map(asDir).join("、")}`;
  return `つなぎ方 ${(a.about.link ?? []).map((s) => s.map(asDir).join("、")).join(" と ")}`;
}

/**
 * 設計の終わりの確認ポイントで人に見せる、構成の回答の一覧。answers が無ければ空。
 * 書き手がまとめ直さずにそのまま見せられるよう、質問、回答（未回答なら書き手の案）、対象、指している部品と依存を出す
 */
export function structureAnswerList(issue: LoadedIssue): string[] {
  const d = issue.design;
  const answers = (d?.answers ?? {}) as Readonly<Record<string, AnyStructureAnswer>>;
  const components = (d?.components ?? {}) as Readonly<Record<string, AnyComponent>>;
  const dependencies = (d?.dependencies ?? []) as readonly AnyDependency[];
  return Object.entries(answers).flatMap(([id, a]) => {
    const cited = [
      ...Object.entries(components)
        .filter(([, x]) => x.placement?.answer === id)
        .map(([n]) => `部品 ${n}`),
      ...dependencies.filter((x) => x.basis?.answer === id).map((x) => `依存 ${x.from} → ${x.to}`),
    ];
    return [
      `${id}（${aboutText(a)}）`,
      `    質問: ${a.question}`,
      a.answer === undefined ? `    回答: 未回答（書き手の案: ${a.proposal ?? "なし"}）` : `    回答: ${a.answer}`,
      `    根拠にしているもの: ${cited.join("、") || "なし"}`,
    ];
  });
}

/** 未回答の構成の回答の ID（verify が一覧に出したら記録し、記録のある ID にだけ answer を書ける） */
export function unansweredStructureIds(issue: LoadedIssue): string[] {
  const answers = (issue.design?.answers ?? {}) as Readonly<Record<string, AnyStructureAnswer>>;
  return Object.entries(answers)
    .filter(([, a]) => a.answer === undefined)
    .map(([id]) => id);
}

/** architecture.ts の引用が、記述の全体か、記述を「。」で区切った1文の全体か */
function quotesWhole(texts: readonly string[], quote: string): boolean {
  const q = quote.trim();
  return texts.some((t) => t.trim() === q || t.split(/(?<=。)/).some((s) => s.trim() === q));
}

/** ADR が構成の判断の根拠になるかを確かめる。accepted で、title か decision がファイルのある場所のパスを書いていること */
function checkAdrBasis(
  c: Collector,
  where: string,
  id: string,
  sides: readonly (readonly string[])[],
  opts: VerifyOptions,
) {
  const adr = opts.adrs?.get(id);
  if (!adr) c.error(`${where}の根拠 ${id} が docs/sdd/adr にありません`);
  else if (adr.status !== "accepted") c.error(`${where}の根拠 ${id} は accepted ではありません（${adr.status}）`);
  else {
    const missing = sides.filter((files) => !commonDirs(files).some((d) => mentionsPath(adr.text, d)));
    if (missing.length) {
      c.error(
        `${where}の根拠 ${id} は、title と decision にファイル ${missing
          .flat()
          .join("、")} のある場所のパスを書いていません。` +
          `置き場所を決めていない ADR は根拠になりません。ほかに根拠が無ければ、${ASK_STRUCTURE}`,
      );
    }
  }
}

/**
 * 置き場所を決めている恒久ドキュメント。モジュールのパス（architecture.ts が無ければ、何かのパス）を書いた
 * accepted の ADR と、モジュールのパスを1つだけ含む architecture.ts の記述
 */
export function placementSources(opts: VerifyOptions): string[] {
  const arch = opts.architecture;
  const adrs = [...(opts.adrs ?? [])]
    .filter(
      ([, a]) =>
        a.status === "accepted" &&
        (arch ? arch.modulePaths.some((m) => mentionsUnder(a.text, m)) : /(?<![\w./-])[\w.-]+\/[\w./-]*/.test(a.text)),
    )
    .map(([id, a]) => `${id}: ${a.text.replace(/\s+/g, " ")}`);
  const quotes = (arch?.texts ?? [])
    .filter((t) => arch!.modulePaths.filter((m) => mentionsPath(t, m)).length === 1)
    .map((t) => `architecture.ts: ${t}`);
  return [...adrs, ...quotes];
}

/** 2つのコンポーネントのあいだに依存があるか（向きは問わない） */
const linked = (dependencies: readonly AnyDependency[], a: string, b: string) =>
  dependencies.some((d) => (d.from === a && d.to === b) || (d.from === b && d.to === a));

const extOf = (f: string) => /\.[^./]+$/.exec(f)?.[0] ?? "";

/** 既存のコンポーネントか、恒久ドキュメントか回答を置き場所の根拠にした新しいコンポーネントか */
const hasBasis = (x: AnyComponent) =>
  x.kind === "modified" || (x.placement !== undefined && !("component" in x.placement));

/**
 * 新しいコンポーネントのファイルのうち、根拠の部品 ref に仕える場所に無いもの。仕える場所は、ref と architecture.ts の
 * 同じモジュール（architecture.ts が無ければ同じディレクトリ）か、ref のモジュールに依存するモジュールの、
 * 同じ拡張子の追跡されたファイルがすでにあるディレクトリ
 */
function filesOutside(
  files: readonly string[],
  ref: AnyComponent,
  homeOf: (f: string) => string | undefined,
  opts: VerifyOptions,
): string[] {
  const homes = new Set(ref.files.map(homeOf).filter((h) => h !== undefined));
  const kinds = new Set((opts.trackedFiles ?? []).map((t) => `${dirOf(t)}\0${extOf(t)}`));
  const deps = opts.architecture?.dependsOn;
  return files.filter((f) => {
    const h = homeOf(f);
    if (h === undefined) return true;
    if (homes.has(h)) return false;
    const servesRef = (deps?.get(h) ?? []).some((m) => homes.has(m));
    return !(servesRef && kinds.has(`${dirOf(f)}\0${extOf(f)}`));
  });
}

/** 根拠の無い新しいコンポーネントに、根拠にできる ADR、architecture.ts の記述、根拠のある部品を挙げる */
function placementCandidates(
  name: string,
  comp: AnyComponent,
  components: Readonly<Record<string, AnyComponent>>,
  dependencies: readonly AnyDependency[],
  homeOf: (f: string) => string | undefined,
  opts: VerifyOptions,
): string[] {
  const dirs = commonDirs(comp.files);
  const adrs = [...(opts.adrs ?? [])]
    .filter(([, a]) => a.status === "accepted" && dirs.some((d) => mentionsPath(a.text, d)))
    .map(([id]) => `{ adr: "${id}" }`);
  const arch = opts.architecture;
  const quotes = (arch?.texts ?? [])
    .filter((t) => {
      const paths = arch!.modulePaths.filter((m) => mentionsPath(t, m));
      return paths.length === 1 && under(comp.files, paths[0]);
    })
    .map((t) => `{ architecture: "${t}" }`);
  const refs = Object.entries(components)
    .filter(
      ([n, x]) =>
        n !== name &&
        hasBasis(x) &&
        linked(dependencies, name, n) &&
        filesOutside(comp.files, x, homeOf, opts).length === 0,
    )
    .map(([n]) => `{ component: "${n}" }`);
  return [...adrs, ...quotes, ...refs];
}

/**
 * 構成の判断の根拠を確かめる。新しいコンポーネントの置き場所と、どのモジュールにも入らない新しいコンポーネントの
 * つなぎ方は、恒久ドキュメントから1つに決まるか、その判断についての人の回答（answers）でなければならない
 */
function checkStructure(
  c: Collector,
  d: {
    components: Readonly<Record<string, AnyComponent>>;
    dependencies: readonly AnyDependency[];
    decisions: readonly AnyDecision[];
    answers?: Readonly<Record<string, AnyStructureAnswer>>;
    impact: { create: readonly string[]; modify: readonly string[]; delete?: readonly string[] };
  },
  requirementAnswers: readonly string[],
  opts: VerifyOptions,
) {
  const { components, dependencies, decisions } = d;
  const answers = d.answers ?? {};
  if (!d.answers) c.error("構成の判断への人の回答（answers）がありません。まだ回答が無ければ {} にしてください");
  checkIdFormat(c, Object.keys(answers), ID_FORMATS.ANS);
  for (const id of Object.keys(answers)) {
    if (requirementAnswers.includes(id)) {
      c.error(
        `回答 ${id} は requirements.ts の answers と同じ ID です。requirements.ts の answers と通し番号にしてください`,
      );
    }
    const cited = decisions.filter((x) => x.answers?.includes(id));
    if (!cited.some((x) => x.adr && x.decidedBy === "user")) {
      c.error(
        `構成の回答 ${id} を、adr: true・decidedBy: "user" の設計判断のどれも answers に書いていません（完了時に ADR にする）`,
      );
    }
  }
  for (const x of decisions) {
    for (const id of x.answers ?? []) {
      if (!(id in answers)) {
        c.error(`設計判断「${x.title}」の answers にある ${id} が、design.ts の answers にありません`);
      }
    }
    if (x.answers?.length && (!x.adr || x.decidedBy !== "user")) {
      c.error(`設計判断「${x.title}」は構成の回答から決めたので、adr: true・decidedBy: "user" にしてください`);
    }
  }

  const openPlacements = Object.entries(answers).filter(([, a]) => a.answer === undefined && a.about.placement);
  if (openPlacements.length > 1) {
    c.error(
      `未回答の置き場所の項目が ${openPlacements.length} 件あります（${openPlacements
        .map(([id]) => id)
        .join("、")}）。` +
        `置き場所は機能ごとに1件で聞き、それに伴う前例どおりの場所も同じ項目の placement に書いて、1件にまとめてください`,
    );
  }
  for (const [id, a] of Object.entries(answers)) {
    if (a.answer === undefined) {
      c.error(
        `構成の回答 ${id}（${aboutText(a)}）は未回答です。設計の終わりの確認ポイントで、` +
          `verify が出す「人に確かめる構成の回答」の一覧を見せ、ユーザーに1件ずつ聞いて answer に書いてください`,
      );
    } else if (opts.answerRecords && !opts.answerRecords.committed.has(id)) {
      const { asked, answered } = opts.answerRecords;
      if (!asked.has(id)) {
        c.error(
          `構成の回答 ${id} は、verify が未回答として一覧に出していないのに answer があります。` +
            `聞いていない判断に answer を書かない。answer を消して proposal（書き手の案）で残し、verify を実行して、` +
            `出た一覧を設計の終わりの確認ポイントで見せてから聞いてください`,
        );
      } else if (answered && !answered.has(id)) {
        c.error(
          `構成の回答 ${id} の answer は、ユーザーの回答として記録されていません。` +
            `確認ポイントで一覧を見せてユーザーが答えたなら、verify に --answered ${id} を付けて実行して記録してください。` +
            `ユーザーが答えていなければ、answer を消して proposal（書き手の案）で残し、確認ポイントで聞いてください`,
        );
      }
    }
    for (const path of a.about.placement ?? []) {
      const adrs = [...(opts.adrs ?? [])]
        .filter(([, x]) => x.status === "accepted" && mentionsPath(x.text, path))
        .map(([adrId]) => adrId);
      if (adrs.length) {
        c.warn(
          `構成の回答 ${id} の場所 ${asDir(path)} は、accepted の ${adrs.join("、")} が書いています。` +
            `ADR で決まるなら、質問せずに { adr: "…" } を根拠にする`,
        );
      }
    }
  }

  const answerOf = (where: string, id: string): AnyStructureAnswer | undefined => {
    const a = answers[id];
    if (!a) {
      c.error(
        `${where}の根拠の回答 ${id} が answers にありません。ユーザーに質問して得た回答を answers に書いてください`,
      );
    }
    return a;
  };

  const arch = opts.architecture;
  const homeOf = (f: string) => (arch ? moduleOf(f, arch.modulePaths) : dirOf(f));
  for (const [name, comp] of Object.entries(components)) {
    if (comp.kind !== "new") continue;
    const where = `新しいコンポーネント ${name} の置き場所`;
    const p = comp.placement;
    if (!p) {
      const candidates = placementCandidates(name, comp, components, dependencies, homeOf, opts);
      c.error(
        `新しいコンポーネント ${name} に placement（置き場所の根拠）がありません。` +
          (candidates.length
            ? `根拠にできる候補: ${candidates.join("、")}。合うものが無ければ、${ASK_STRUCTURE}`
            : `accepted の ADR、architecture.ts の記述、依存でつながる根拠のある部品（同じモジュールか、` +
              `その部品のモジュールに依存するモジュールの前例のある場所）のどれからも決まりません。${ASK_STRUCTURE}`),
      );
    } else if ("answer" in p) {
      const a = answerOf(where, p.answer);
      if (a && a.about.placement === undefined) {
        c.error(`${where}の根拠の回答 ${p.answer} は、置き場所（about.placement）への回答ではありません`);
      } else if (a && !under(comp.files, a.about.placement!)) {
        const paths = a.about.placement!;
        c.error(
          `${where}の根拠の回答 ${p.answer} は ${paths.map(asDir).join("、")} への回答ですが、` +
            `ファイル ${comp.files.filter((f) => !under([f], paths)).join("、")} はその下にありません`,
        );
      }
    } else if ("adr" in p) {
      checkAdrBasis(c, where, p.adr, [comp.files], opts);
    } else if ("architecture" in p) {
      const paths = arch?.modulePaths.filter((m) => mentionsPath(p.architecture, m)) ?? [];
      if (!arch) c.error(`${where}の根拠に architecture.ts の引用がありますが、docs/sdd/architecture.ts がありません`);
      else if (!arch.texts.some((t) => t.includes(p.architecture))) {
        c.error(`${where}の引用「${p.architecture}」が、architecture.ts の summary・layers・notes にありません`);
      } else if (!quotesWhole(arch.texts, p.architecture)) {
        c.error(
          `${where}の引用「${p.architecture}」は、architecture.ts の記述の一部を切り出しています。` +
            `記述の全体か、「。」で区切った1文の全体を引用してください。その文が置き場所を1つに決めないなら、${ASK_STRUCTURE}`,
        );
      } else if (paths.length !== 1) {
        c.error(
          `${where}の引用「${p.architecture}」は、architecture.ts の modules のパスを1つだけ含む文にしてください` +
            `（含むパス: ${paths.join("、") || "なし"}）。置き場所が1つに決まらないなら、${ASK_STRUCTURE}`,
        );
      } else {
        const outside = comp.files.filter((f) => !f.startsWith(asDir(paths[0])));
        if (outside.length) {
          c.error(`${where}の引用は ${paths[0]} を指しますが、ファイル ${outside.join("、")} はその下にありません`);
        }
      }
    } else if ("component" in p) {
      const ref = components[p.component];
      if (!ref) c.error(`${where}の根拠のコンポーネント「${p.component}」がありません`);
      else if (p.component === name || !hasBasis(ref)) {
        c.error(
          `${where}の根拠のコンポーネント ${p.component} は、既存のもの（kind: "modified"）でも、` +
            `answer、adr、architecture を置き場所の根拠にした新しいコンポーネントでもありません`,
        );
      } else if (!linked(dependencies, name, p.component)) {
        c.error(
          `${where}の根拠の ${p.component} と ${name} のあいだに依存がありません。` +
            `根拠にできるのは、新しいコンポーネントを使うか、新しいコンポーネントが使う根拠のある部品だけです。` +
            `ほかに根拠が無ければ、${ASK_STRUCTURE}`,
        );
      } else {
        const outside = filesOutside(comp.files, ref, homeOf, opts);
        if (outside.length) {
          c.error(
            `${where}の根拠の ${p.component} と、ファイル ${outside.join("、")} が` +
              (arch
                ? ` architecture.ts の同じモジュールにも、${p.component} のモジュールに依存する（dependsOn）モジュールの` +
                  `前例のある場所（同じ拡張子の既存のファイルがあるディレクトリ）にもありません。`
                : "同じディレクトリにありません。") +
              `ほかに根拠が無ければ、${ASK_STRUCTURE}`,
          );
        }
      }
    } else {
      c.error(`${where}の根拠は、answer、adr、architecture、component のどれかにしてください`);
    }
  }

  if (!arch) return;
  const outsideModules = new Set(
    Object.entries(components)
      .filter(
        ([, comp]) =>
          comp.kind === "new" &&
          comp.files.length > 0 &&
          comp.files.every((f) => moduleOf(f, arch.modulePaths) === undefined),
      )
      .map(([name]) => name),
  );
  for (const dep of dependencies) {
    if (outsideModules.has(dep.from) === outsideModules.has(dep.to)) continue;
    const where = `依存 ${dep.from} → ${dep.to} `;
    const sides = [components[dep.from]?.files ?? [], components[dep.to]?.files ?? []];
    const b = dep.basis;
    if (!b) {
      const outside = outsideModules.has(dep.from) ? dep.from : dep.to;
      c.error(
        `${where}は、architecture.ts のどのモジュールにも入らない ${outside} と、ほかのコンポーネントのつなぎ方です。` +
          `accepted の ADR で決まっていなければ、置き場所とは別に${ASK_STRUCTURE}（basis に書く）`,
      );
    } else if ("answer" in b) {
      const a = answerOf(where, b.answer);
      const link = a?.about.link;
      if (a && !link) {
        c.error(
          `${where}の根拠の回答 ${b.answer} は、つなぎ方（about.link）への回答ではありません。` +
            `置き場所の回答はつなぎ方の根拠になりません。置き場所とは別に${ASK_STRUCTURE}`,
        );
      } else if (
        link &&
        !(under(sides[0], link[0]) && under(sides[1], link[1])) &&
        !(under(sides[0], link[1]) && under(sides[1], link[0]))
      ) {
        c.error(
          `${where}の根拠の回答 ${b.answer} は ${link
            .map((s) => s.map(asDir).join("、"))
            .join(" と ")} のつなぎ方への回答ですが、` +
            `${dep.from} と ${dep.to} のファイルがそれぞれの側の下にありません`,
        );
      }
    } else if ("adr" in b) checkAdrBasis(c, where, b.adr, sides, opts);
    else c.error(`${where}の根拠は、answer か adr にしてください`);
  }

  // つなぎ方を求めるかは、書き手が省ける dependencies ではなく、作る・変えるファイルから決める
  const outsideFiles = [...outsideModules].flatMap((n) => components[n].files);
  const touched = [...d.impact.create, ...d.impact.modify, ...(d.impact.delete ?? [])].filter(
    (f) => moduleOf(f, arch.modulePaths) !== undefined,
  );
  const based = dependencies.some((dep) => outsideModules.has(dep.from) !== outsideModules.has(dep.to) && dep.basis);
  if (outsideFiles.length && touched.length && !based) {
    c.error(
      `architecture.ts のどのモジュールにも入らない新しいファイル（${outsideFiles.join("、")}）と、` +
        `既存のモジュールのファイル（${touched.join("、")}）を、同じ設計で作る・変えます。` +
        `両者のつなぎ方を accepted の ADR か人の回答で決め、つなぐコンポーネントのあいだの依存の basis に書いてください。` +
        `ADR で決まっていなければ、置き場所とは別に${ASK_STRUCTURE}`,
    );
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
  ANS: { re: /^ANS-\d{3}$/, label: "人の回答", example: "ANS-001" },
  T: { re: /^T-\d{3}$/, label: "タスク", example: "T-001" },
} as const;

type IdFormat = (typeof ID_FORMATS)[keyof typeof ID_FORMATS];

const ISSUE_ID_FORMAT = /^[A-Za-z0-9-]+$/;

class Collector {
  constructor(
    private file: Diagnostic["file"],
    readonly items: Diagnostic[] = [],
  ) {}
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
    for (const [kind, label] of [
      ["boundary", "境界値"],
      ["error", "異常系"],
    ] as const) {
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

/** 引用の照合用。空白と Markdown のコードの記号の違いは見ない */
const bare = (t: string) => t.replace(/[\s`]+/g, "");

type LooseDecision = { decidedBy?: unknown; notApplicable?: unknown; open?: unknown; basis?: Record<string, unknown> };

/**
 * 入力と表示の一覧（values）を確かめ、未確定の観点を「対象の観点」の形で返す。
 * 種類の観点の欠けと余り、存在しない ID の参照、確かめられない出どころをエラーにする。
 */
function checkValues(
  c: Collector,
  r: LooseRequirements,
  refs: Set<string>,
  issueMd: string | undefined,
  missingFiles: Set<string> | undefined,
): string[] {
  const answers = r.answers as Readonly<Record<string, unknown>> | undefined;
  if (!answers) c.error("人の回答（answers）がありません。まだ回答が無ければ {} にしてください");
  else checkIdFormat(c, Object.keys(answers), ID_FORMATS.ANS);
  const values = r.values as readonly ValueCheck[] | undefined;
  if (!values) {
    c.error("入力と表示の一覧（values）がありません。該当しない場合は [] にし、noValuesReason に理由を書いてください");
    return [];
  }
  if (values.length === 0 && !r.noValuesReason) {
    c.error("入力と表示の一覧（values）が空です。該当しない場合は noValuesReason に理由を書いてください");
  }
  if (values.length > 0 && r.noValuesReason) c.warn("values があるのに noValuesReason も書かれています");
  const kinds = VALUE_KINDS as Readonly<Record<string, { aspects: Readonly<Record<string, string>> }>>;
  const issueText = issueMd === undefined ? undefined : bare(issueMd);
  const open: string[] = [];
  values.forEach((v, i) => {
    const where = `values[${i}]（${v.target}）`;
    const kind = kinds[v.kind];
    if (!kind) {
      c.error(`${where}の種類「${v.kind}」がありません。${Object.keys(VALUE_KINDS).join("、")} から選んでください`);
      return;
    }
    const aspects = (v.aspects ?? {}) as Readonly<Record<string, LooseDecision>>;
    const missing = Object.keys(kind.aspects).filter((a) => !(a in aspects));
    if (missing.length > 0) {
      c.error(
        `${where}に観点の扱いがありません: ${missing.map((a) => `${a}（${kind.aspects[a]}）`).join("、")}。` +
          "決めた受け入れ条件（decidedBy）、人が関係しないと答えた理由（notApplicable）、未確定（open）のどれかを書いてください",
      );
    }
    for (const [a, d] of Object.entries(aspects)) {
      const label = kind.aspects[a];
      if (!label) {
        c.error(`${where}の観点「${a}」は種類 ${v.kind} にありません`);
        continue;
      }
      if (d.open === true) {
        open.push(`${v.target}の${label}`);
        continue;
      }
      for (const ref of Array.isArray(d.decidedBy) ? (d.decidedBy as string[]) : []) {
        if (!refs.has(ref)) c.error(`${where}の観点 ${a} が参照している ${ref} がありません`);
      }
      const basis = d.basis ?? {};
      if (d.notApplicable !== undefined && typeof basis.answer !== "string") {
        c.error(
          `${where}の観点 ${a}（${label}）を関係しない扱いにできるのは、人がそう答えたときだけです。` +
            "issue に書かれていないことは関係しない理由になりません。open にして質問し、回答を answers に書いて ID を出どころにしてください",
        );
        continue;
      }
      if (typeof basis.issue === "string") {
        if (issueText !== undefined && !issueText.includes(bare(basis.issue))) {
          c.error(
            `${where}の観点 ${a}（${label}）の出どころ「${basis.issue}」が issue.md にありません。` +
              "issue.md の文をそのまま引用するか、決まっていなければ open にして質問してください",
          );
        }
      } else if (typeof basis.code === "string") {
        if (missingFiles?.has(basis.code)) {
          c.error(
            `${where}の観点 ${a}（${label}）の出どころのファイル ${basis.code} がありません。` +
              "既存の振る舞いを決めているファイルを書くか、決まっていなければ open にして質問してください",
          );
        }
      } else if (typeof basis.answer === "string") {
        if (answers && !(basis.answer in answers)) {
          c.error(
            `${where}の観点 ${a}（${label}）の出どころの回答 ${basis.answer} が answers にありません。` +
              "人に質問して得た回答を answers に書くか、まだ聞いていなければ open にして質問してください",
          );
        }
      } else {
        c.error(
          `${where}の観点 ${a}（${label}）に出どころ（issue、code、answer のどれか）がありません。` +
            "推測で決めず、open にして質問してください",
        );
      }
    }
  });
  return open;
}

const MULTIPLE_POINTS = /[、，,・／/]|および|ならびに|[^\sぁ-ん]と[^\sぁ-ん]|[^\sぁ-ん]や[^\sぁ-ん]/;

/** 未確定の点の観点に、複数の点を並べていないか */
function checkOpenQuestions(c: Collector, openQuestions: readonly OpenQuestion[]) {
  openQuestions.forEach((q, i) => {
    if (typeof q !== "object" || q === null) {
      c.error(`openQuestions[${i}] は { target, aspect } の形で書いてください`);
      return;
    }
    const hit = q.aspect.match(MULTIPLE_POINTS);
    if (!hit) return;
    c.error(
      `openQuestions[${i}]（${q.target}）の観点「${q.aspect}」に、複数の点が並んでいます（「${hit[0]}」）。` +
        "1件に1つの観点だけを書き、残りは別の件に分けてください",
    );
  });
}

/** issue.md の「受け入れ条件」の箇条書きを取り出す（「未記載」「なし」なら空） */
export function issueCriteria(issueMd: string | undefined): string[] {
  if (!issueMd) return [];
  const m = issueMd.replaceAll("\r\n", "\n").match(/^##\s*受け入れ条件\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  if (!m) return [];
  return m[1]
    .split("\n")
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
  checkIdFormat(
    c,
    entries.map(([id]) => id),
    ID_FORMATS.T,
  );
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
      fr.acceptance.filter((a) => a.verifiedBy === "human").map((a) => a.id),
    ),
    ...Object.entries(invariants)
      .filter(([, v]) => v.verifiedBy === "human")
      .map(([id]) => id),
  ];
  const allDone = Object.values(tasks).length > 0 && Object.values(tasks).every((t) => t.status === "done");
  if (allDone && human.length > 0 && !guide) {
    c.error(
      `人が確かめる受け入れ条件（${human.join(
        "、",
      )}）があるのに、受け入れテストの準備（acceptanceGuide）がありません。` +
        "起動の手順、テスト用のアカウント、データの用意のしかたを書いてください",
    );
  }
}

const UNRESOLVED_NOTE = /未確定|未定|要確認|openQuestions|(設計|実装)で[^、。]{0,10}?(決め|定め|定義)/;

/** 十分性のチェックリストに「未確定」と書いたまま、質問せずに未確定の点を空にしていないか */
function checkChecklistResolved(
  c: Collector,
  checklist: Readonly<Record<string, { note: string }>>,
  openQuestions: readonly unknown[],
) {
  if (openQuestions.length > 0) return;
  for (const [item, { note }] of Object.entries(checklist)) {
    const hit = note.match(UNRESOLVED_NOTE);
    if (!hit) continue;
    c.error(
      `checklist.${item} に「${hit[0]}」とありますが、未確定の点（openQuestions）がありません。` +
        "質問して決めた値を受け入れ条件に書き、note を直してください（設計や実装に先送りしない）",
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
  const openAspects = checkValues(
    c,
    r,
    new Set([...acIds, ...Object.keys(r.invariants)]),
    issueMd,
    opts.missingBasisFiles,
  );
  checkOpenQuestions(c, r.openQuestions);
  const unresolved = [...r.openQuestions, ...openAspects];
  checkChecklistResolved(c, r.checklist, unresolved);
  if (unresolved.length > 0) {
    const msg = `未確定の点が ${unresolved.length} 件残っています`;
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
  checkStructure(
    c,
    {
      components: d.components as Readonly<Record<string, AnyComponent>>,
      dependencies: d.dependencies as readonly AnyDependency[],
      decisions: d.decisions as readonly AnyDecision[],
      answers: d.answers as Readonly<Record<string, AnyStructureAnswer>> | undefined,
      impact: d.impact,
    },
    Object.keys(r.answers ?? {}),
    opts,
  );

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
  const verified = checkTasks(
    c,
    t.tasks,
    {
      refs: new Set([...frIds, ...nfrIds, ...invIds, ...componentIds]),
      acIds,
      invIds,
      nfrIds,
      frIds,
      componentIds,
      humanAcIds: humanAcIdsOf(r.functional),
    },
    opts,
  );
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
  checkChecklistResolved(c, q.checklist, []);
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
  checkTasks(
    c,
    q.tasks,
    {
      refs: new Set([...frIds, ...invIds]),
      acIds,
      invIds,
      nfrIds: new Set(),
      frIds,
      componentIds: new Set(),
      humanAcIds: humanAcIdsOf(q.expected),
    },
    opts,
  );
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
      verifyFull(c, issue, { ...opts, missingBasisFiles: issue.missingBasisFiles });
      if (opts.finish && !issue.tasks) c.at("tasks.ts").error("tasks.ts が無いため完了処理を行えません");
      break;
    case "quick":
      if (issue.quick) verifyQuick(c.at("spec.ts"), issue, opts);
      break;
  }
  return c.items;
}
