import {
  type AcceptanceGuide,
  CHECKLIST_LABELS,
  type ChecklistItem,
  DESIGN_CHECKLIST_LABELS,
  type DesignChecklistItem,
  type Ears,
  type FunctionalRequirement,
  type Invariant,
  type IssueCoverageItem,
  type NfrReview,
  type NonFunctionalRequirement,
  type SufficiencyChecklist,
  type Task,
} from "../schema/mod.ts";
import type { LoadedIssue, LooseDesign, LooseQuickSpec, LooseRequirements, LooseTasks } from "../scripts/lib/load.ts";
import type { Diagnostic } from "../scripts/lib/rules.ts";
import { earsSentence } from "../scripts/lib/ears.ts";
import { esc, idBadge, idBadges, list, type NavItem, statusLabel, table } from "./html.ts";
import { markdownToHtml } from "./markdown.ts";
import { dependencyDiagram } from "./svg.ts";

type AnyTask = Task<string, string>;
export type Section = { nav: NavItem; html: string };

const EARS_LABEL: Record<Ears["pattern"], string> = {
  ubiquitous: "常時",
  event: "イベント",
  state: "状態",
  optional: "オプション",
  unwanted: "異常系",
  complex: "複合",
};

const AC_KIND_LABEL: Record<FunctionalRequirement["acceptance"][number]["kind"], string> = {
  normal: "正常系",
  boundary: "境界値",
  error: "異常系",
};

const TASK_KIND_LABEL: Record<AnyTask["kind"], string> = {
  test: "テスト",
  e2e: "E2E テスト",
  impl: "実装",
  refactor: "リファクタリング",
  docs: "ドキュメント",
  chore: "雑務",
};

const TASK_STATUS_LABEL: Record<AnyTask["status"], string> = { todo: "未着手", doing: "作業中", done: "完了" };

function taskStatus(t: AnyTask): string {
  return statusLabel(t.status, TASK_STATUS_LABEL[t.status]);
}

export function diagnosticsSection(diags: Diagnostic[]): Section {
  const errors = diags.filter((d) => d.level === "error");
  const warnings = diags.filter((d) => d.level === "warning");
  const body = diags.length === 0
    ? `<div class="callout callout-ok">${statusLabel("ok", "問題なし")} 検証で問題は見つかりませんでした。</div>`
    : `<p>${statusLabel("error", `エラー ${errors.length} 件`)} ${
      statusLabel("warning", `警告 ${warnings.length} 件`)
    }</p>
<ul class="diag">${
      [...errors, ...warnings].map((d) =>
        `<li class="${d.level}">${statusLabel(d.level, d.level === "error" ? "エラー" : "警告")}<span><code>${
          esc(d.file)
        }</code> ${esc(d.message)}</span></li>`
      ).join("")
    }</ul>`;
  return { nav: { id: "verify", label: "検証結果" }, html: `<section id="verify"><h2>検証結果</h2>${body}</section>` };
}

/**
 * 受け入れテストの一覧。人は受け入れテストだけを行うので、受け入れ条件と変えてはいけない振る舞いを
 * チェックリストにする。チェックの状態はブラウザ（localStorage）に保存する。
 */
export function acceptanceSection(
  issueId: string,
  functional: Readonly<Record<string, FunctionalRequirement>>,
  invariants: Readonly<Record<string, Invariant>>,
  guide?: AcceptanceGuide,
): Section {
  const check = (id: string) =>
    `<input type="checkbox" class="accept" data-accept-key="${esc(issueId)}:${esc(id)}" aria-label="${
      esc(id)
    } を確認した">`;
  // 人が確かめるものだけを載せる（自動テストで確かめるものは、件数だけを示す）
  const acRows = Object.entries(functional).flatMap(([frId, fr]) =>
    fr.acceptance.filter((s) => s.verifiedBy === "human").map((s) => [
      check(s.id),
      `${idBadge(s.id)}<br><span class="muted">${esc(frId)} ${esc(fr.title)}</span>`,
      `<span class="tag">${AC_KIND_LABEL[s.kind] ?? esc(s.kind)}</span>`,
      s.given.length ? list(s.given) : `<span class="muted">なし</span>`,
      esc(s.when),
      list(s.then),
    ])
  );
  const automated = [
    ...Object.values(functional).flatMap((fr) =>
      fr.acceptance.filter((s) => s.verifiedBy !== "human").map((s) => s.id)
    ),
    ...Object.entries(invariants).filter(([, v]) => v.verifiedBy !== "human").map(([id]) => id),
  ];
  const invRows = Object.entries(invariants).filter(([, v]) => v.verifiedBy === "human").map(([id, v]) => [
    check(id),
    `${idBadge(id)}<br><span class="muted">${esc(v.title)}</span>`,
    esc(v.behavior),
    esc(v.verification),
  ]);
  const code = (v: string) => `<code>${esc(v)}</code>`;
  const guideHtml = guide
    ? `<h3>準備</h3>
<h4>起動の手順（リポジトリのルートで、上から順に実行する）</h4>
<ol>${
      guide.setup.map((st) => `<li>${code(st.run)}${st.note ? ` <span class="muted">${esc(st.note)}</span>` : ""}</li>`)
        .join("")
    }${
      guide.server
        ? `<li>${code(guide.server.run)} <span class="muted">（サーバー。${
          esc(guide.server.url)
        } が開けるまで待つ）</span></li>`
        : ""
    }</ol>
<h4>テスト用のアカウント</h4>${
      table(["ID", "パスワード", "権限"], guide.accounts.map((a) => [code(a.id), code(a.password), esc(a.role)]))
    }
<h4>テスト用のデータ</h4>${
      table(
        ["受け入れ条件", "コマンド", "実行後の状態"],
        guide.data.map((d) => [idBadges(d.acs), code(d.run), esc(d.expect)]),
      )
    }
<h4>確かめる画面</h4>${list(guide.check.map((c) => `${c.url}${c.note ? `（${c.note}）` : ""}`))}${
      guide.notes?.length ? `<h4>補足</h4>${list(guide.notes)}` : ""
    }`
    : `<div class="callout callout-warning">${
      statusLabel("warning", "準備なし")
    } 受け入れテストの準備（起動の手順、アカウント、データ）はまだ書かれていません。実装の完了時に sdd-impl が書きます。</div>`;
  const html = `<section id="acceptance"><h2>受け入れテスト</h2>
<p>次の受け入れ条件を満たすことを確かめてください。チェックの状態はこのブラウザに保存されます。
<span class="accept-progress" data-accept-issue="${esc(issueId)}"></span></p>
${guideHtml}
<h3>受け入れ条件</h3>${table(["確認", "ID", "種類", "前提（Given）", "操作（When）", "期待する結果（Then）"], acRows)}
<h3>変えてはいけない振る舞い</h3>${table(["確認", "ID", "守るべき振る舞い", "確かめ方"], invRows)}
${automated.length ? `<p class="muted">自動テストで確かめるもの（人の確認は不要）: ${idBadges(automated)}</p>` : ""}
</section>`;
  return { nav: { id: "acceptance", label: "受け入れテスト" }, html };
}

export function issueSection(issue: LoadedIssue): Section {
  const body = issue.issueMd
    ? `<div class="issue-body">${markdownToHtml(issue.issueMd)}</div>`
    : `<p class="muted">issue.md がありません</p>`;
  return { nav: { id: "issue", label: "issue" }, html: `<section id="issue"><h2>issue</h2>${body}</section>` };
}

function functionalCards(functional: Readonly<Record<string, FunctionalRequirement>>): string {
  const entries = Object.entries(functional);
  if (entries.length === 0) return `<p class="muted">なし</p>`;
  return entries.map(([id, fr]) => {
    const priority = fr.priority ? `<span class="tag">${esc(fr.priority)}</span>` : "";
    const acRows = fr.acceptance.map((s) => [
      idBadge(s.id),
      `<span class="tag">${AC_KIND_LABEL[s.kind] ?? esc(s.kind)}</span>`,
      s.given.length ? list(s.given) : `<span class="muted">なし</span>`,
      esc(s.when),
      list(s.then),
    ]);
    const na = [
      fr.notApplicable?.boundary ? `境界値なし: ${esc(fr.notApplicable.boundary)}` : "",
      fr.notApplicable?.error ? `異常系なし: ${esc(fr.notApplicable.error)}` : "",
    ].filter(Boolean);
    return `<div class="card" id="${esc(id)}">
<div class="card-head">${idBadge(id)}<span class="card-title">${esc(fr.title)}</span><span class="tag">${
      EARS_LABEL[fr.ears.pattern]
    }</span>${priority}</div>
<div class="ears">${esc(earsSentence(fr.ears))}</div>
${table(["ID", "種類", "前提（Given）", "操作（When）", "結果（Then）"], acRows)}
${na.length ? `<p class="muted">${na.join("<br>")}</p>` : ""}
${fr.notes ? `<p class="muted">${esc(fr.notes)}</p>` : ""}
</div>`;
  }).join("");
}

function nfrTable(nfrs: Readonly<Record<string, NonFunctionalRequirement>>): string {
  return table(
    ["ID", "名前", "カテゴリ", "何を測るか", "目標値", "条件", "確かめ方", "上書きする基準"],
    Object.entries(nfrs).map(([id, n]) => [
      idBadge(id),
      esc(n.title),
      esc(n.category),
      esc(n.metric),
      `<strong>${esc(n.target)}</strong>`,
      esc(n.condition),
      esc(n.verification),
      n.overrides ? esc(n.overrides) : `<span class="muted">なし（新規）</span>`,
    ]),
  );
}

function invariantTable(invs: Readonly<Record<string, Invariant>>): string {
  return table(
    ["ID", "名前", "守るべき振る舞い", "確かめ方"],
    Object.entries(invs).map(([id, v]) => [idBadge(id), esc(v.title), esc(v.behavior), esc(v.verification)]),
  );
}

/** 十分性の確認（issue との対応、非機能要件の検討、チェックリスト） */
function sufficiencyHtml(opts: {
  issueCoverage: readonly IssueCoverageItem[] | undefined;
  nfrReview?: NfrReview;
  checklist: SufficiencyChecklist | undefined;
  noInvariantsReason?: string;
}): string {
  const coverage = (opts.issueCoverage ?? []).map((item) => [
    esc(item.source),
    "coveredBy" in item ? idBadges(item.coveredBy) : `<span class="tag">除外</span> ${esc(item.excluded)}`,
  ]);
  const decisionLabel = { baseline: "基準のまま", added: "追加・上書き", notApplicable: "該当しない" } as const;
  const nfr = opts.nfrReview
    ? `<h4>非機能要件の検討（IPA 非機能要求グレードの大項目）</h4>${
      table(
        ["カテゴリ", "扱い", "内容"],
        Object.entries(opts.nfrReview).map(([category, e]) => [
          esc(category),
          esc(decisionLabel[e.decision]),
          e.decision === "added"
            ? idBadges(e.ids)
            : e.decision === "notApplicable"
            ? esc(e.reason)
            : e.note
            ? esc(e.note)
            : `<span class="muted">docs/sdd/nfr.ts の基準のまま</span>`,
        ]),
      )
    }`
    : "";
  const checklist = opts.checklist
    ? table(
      ["観点", "結果", "内容"],
      (Object.keys(CHECKLIST_LABELS) as ChecklistItem[]).map((k) => {
        const v = opts.checklist![k];
        return [
          esc(CHECKLIST_LABELS[k]),
          v
            ? (v.result === "considered" ? statusLabel("ok", "検討した") : statusLabel("todo", "該当しない"))
            : statusLabel(
              "error",
              "未記入",
            ),
          v ? esc(v.note) : "",
        ];
      }),
    )
    : `<p class="muted">なし</p>`;
  return `<h4>issue の受け入れ条件との対応</h4>${
    coverage.length
      ? table(["issue の受け入れ条件", "対応する要件"], coverage)
      : `<p class="muted">issue に受け入れ条件はありません</p>`
  }
${nfr}
<h4>十分性のチェックリスト</h4>${checklist}
${opts.noInvariantsReason ? `<p>変えてはいけない振る舞いが無い理由: ${esc(opts.noInvariantsReason)}</p>` : ""}`;
}

export function requirementsSection(r: LooseRequirements): Section {
  const open = r.openQuestions.length
    ? `<div class="callout callout-warning">${statusLabel("warning", "未確定")} レビューまでに解消が必要です。${
      list(r.openQuestions)
    }</div>`
    : `<p class="muted">なし</p>`;
  const html = `<section id="requirements"><h2>要件</h2>
<p>${esc(r.summary)}</p>
<h3 id="req-fr">機能要件</h3>${functionalCards(r.functional)}
<h3 id="req-nfr">非機能要件</h3><p class="muted">docs/sdd/nfr.ts（プロジェクト全体の基準）との差分だけを記載しています。</p>${
    nfrTable(r.nonFunctional)
  }
<h3 id="req-inv">変えてはいけない振る舞い</h3>${invariantTable(r.invariants)}
<h3 id="req-sufficiency">十分性の確認</h3>
${
    sufficiencyHtml({
      issueCoverage: r.issueCoverage,
      nfrReview: r.nfrReview,
      checklist: r.checklist,
      noInvariantsReason: r.noInvariantsReason,
    })
  }
<h3 id="req-other">前提・未確定の点・対象外</h3>
<h4>前提</h4>${list(r.assumptions)}
<h4>未確定の点</h4>${open}
<h4>対象外</h4>${list(r.outOfScope)}
</section>`;
  return {
    nav: {
      id: "requirements",
      label: "要件",
      children: [
        { id: "req-fr", label: "機能要件" },
        { id: "req-nfr", label: "非機能要件" },
        { id: "req-inv", label: "変えてはいけない振る舞い" },
        { id: "req-sufficiency", label: "十分性の確認" },
        { id: "req-other", label: "前提・未確定・対象外" },
      ],
    },
    html,
  };
}

function impactHtml(
  impact: { create: readonly string[]; modify: readonly string[]; delete?: readonly string[] },
): string {
  const files = (xs: readonly string[] | undefined) =>
    xs?.length ? `<ul>${xs.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul>` : `<p class="muted">なし</p>`;
  return `<div class="two-col"><div><h4>新しく作るファイル</h4>${
    files(impact.create)
  }</div><div><h4>変更するファイル</h4>${files(impact.modify)}</div></div>${
    impact.delete?.length ? `<h4>削除するファイル</h4>${files(impact.delete)}` : ""
  }`;
}

export function designSection(d: LooseDesign): Section {
  const comps = Object.entries(d.components);
  const diagram = dependencyDiagram(d.components, d.dependencies);
  const html = `<section id="design"><h2>設計</h2>
<p>${esc(d.overview)}</p>
<h3 id="design-asis">現状と変更後</h3>
<div class="two-col"><div><h4>現状（As-Is）</h4><p>${esc(d.asIs)}</p></div><div><h4>変更後（To-Be）</h4><p>${
    esc(d.toBe)
  }</p></div></div>
<h3 id="design-components">コンポーネント</h3>
${
    diagram
      ? `<div class="diagram">${diagram}</div><div class="legend"><span><i style="background:var(--jagged-ice);border:1px solid var(--casal)"></i>新規</span><span><i style="background:var(--hawkes-blue);border:1px solid var(--azure)"></i>変更</span><span>矢印: 使う側 → 使われる側</span></div>`
      : ""
  }
${
    table(
      ["名前", "種別", "責務", "ファイル", "現状"],
      comps.map(([name, c]) => [
        idBadge(name, "comp"),
        c.kind === "new" ? "新規" : "変更",
        esc(c.responsibility),
        c.files.map((f) => `<code>${esc(f)}</code>`).join("<br>") || `<span class="muted">なし</span>`,
        c.asIs ? esc(c.asIs) : `<span class="muted">—</span>`,
      ]),
    )
  }
<h3 id="design-interfaces">インターフェース</h3>
${
    Object.entries(d.interfaces).map(([name, i]) =>
      `<div class="card"><div class="card-head"><span class="card-title">${esc(name)}</span>${
        idBadge(i.component, "comp")
      }<span class="tag">${esc(i.kind)}</span><span class="tag">${
        { new: "新規", modified: "変更", removed: "削除" }[i.change] ?? esc(i.change)
      }</span></div><pre><code>${esc(i.signature)}</code></pre><p>${esc(i.description)}</p>${
        "compatibility" in i && i.compatibility
          ? `<div class="callout callout-warning">${statusLabel("warning", "互換")} ${esc(i.compatibility)}</div>`
          : ""
      }</div>`
    ).join("") || `<p class="muted">なし</p>`
  }
<h3 id="design-data">データモデル</h3>
${
    Object.entries(d.dataModels).map(([name, m]) =>
      `<div class="card"><div class="card-head"><span class="card-title">${esc(name)}</span><span class="tag">${
        m.kind === "new" ? "新規" : "変更"
      }</span></div><p>${esc(m.description)}</p><pre><code>${esc(m.definition)}</code></pre>${
        "migration" in m && m.migration
          ? `<div class="callout callout-warning">${statusLabel("warning", "移行")} ${esc(m.migration)}</div>`
          : ""
      }</div>`
    ).join("") || `<p class="muted">なし</p>`
  }
<h3 id="design-errors">エラー処理</h3>
${
    table(
      ["状況", "対処", "対応する要件"],
      d.errorHandling.map((e) => [
        esc(e.case),
        esc(e.handling),
        e.refs?.length ? idBadges(e.refs) : `<span class="muted">要件外の異常</span>`,
      ]),
    )
  }
<h3 id="design-impact">影響範囲</h3>
${impactHtml(d.impact)}
<h3 id="design-decisions">設計判断</h3>
${
    d.decisions.map((x) =>
      `<div class="card"><div class="card-head"><span class="card-title">${esc(x.title)}</span>${
        x.adr ? `<span class="tag">ADRに記録する</span>` : ""
      }</div><h4>背景</h4><p>${esc(x.context)}</p><h4>決めたこと</h4><p>${esc(x.decision)}</p><h4>検討した代替案</h4>${
        table(["案", "採用しなかった理由"], x.alternatives.map((a) => [esc(a.option), esc(a.reason)]))
      }</div>`
    ).join("") || `<p class="muted">なし</p>`
  }
<h3 id="design-strategy">非機能要件と変えてはいけない振る舞い</h3>
<h4>非機能要件の実現方法</h4>
${table(["要件", "実現方法"], Object.entries(d.nfrStrategy ?? {}).map(([id, v]) => [idBadge(id), esc(v)]))}
<h4>変えてはいけない振る舞いの守り方</h4>
${table(["要件", "守り方"], Object.entries(d.invariantStrategy ?? {}).map(([id, v]) => [idBadge(id), esc(v)]))}
<h3 id="design-checklist">設計のチェックリスト</h3>
${
    table(
      ["観点", "結果", "内容"],
      (Object.keys(DESIGN_CHECKLIST_LABELS) as DesignChecklistItem[]).map((k) => {
        const v = d.checklist?.[k];
        return [
          esc(DESIGN_CHECKLIST_LABELS[k]),
          v
            ? (v.result === "considered" ? statusLabel("ok", "検討した") : statusLabel("todo", "該当しない"))
            : statusLabel("error", "未記入"),
          v ? esc(v.note) : "",
        ];
      }),
    )
  }
${d.risks?.length ? `<h3 id="design-risks">リスク</h3>${list(d.risks)}` : ""}
</section>`;
  const children: NavItem[] = [
    { id: "design-asis", label: "現状と変更後" },
    { id: "design-components", label: "コンポーネント" },
    { id: "design-interfaces", label: "インターフェース" },
    { id: "design-data", label: "データモデル" },
    { id: "design-errors", label: "エラー処理" },
    { id: "design-impact", label: "影響範囲" },
    { id: "design-decisions", label: "設計判断" },
    { id: "design-strategy", label: "非機能要件と振る舞いの守り方" },
    { id: "design-checklist", label: "設計のチェックリスト" },
  ];
  if (d.risks?.length) children.push({ id: "design-risks", label: "リスク" });
  return { nav: { id: "design", label: "設計", children }, html };
}

function tasksReferring(tasks: Readonly<Record<string, AnyTask>>, id: string, field: "refs" | "verifies"): string[] {
  return Object.entries(tasks).filter(([, t]) => (t[field] ?? []).includes(id)).map(([tid]) => tid);
}

function coverageCell(ok: boolean, missing: string): string {
  return ok ? statusLabel("ok", "対応済み") : statusLabel("error", missing);
}

/**
 * 追跡表。要件 → 設計 → タスク の対応と、受け入れ条件などの検証の対応を示す。
 * 対応が漏れている箇所はエラー色で表示する。
 */
export function traceabilitySection(opts: {
  functional: Readonly<Record<string, FunctionalRequirement>>;
  nonFunctional: Readonly<Record<string, NonFunctionalRequirement>>;
  invariants: Readonly<Record<string, Invariant>>;
  traceability?: Readonly<Record<string, readonly string[]>>;
  tasks?: Readonly<Record<string, AnyTask>>;
}): Section {
  const { functional, nonFunctional, invariants, traceability, tasks } = opts;
  const hasDesign = traceability !== undefined;
  const reqRows = [...Object.keys(functional), ...Object.keys(nonFunctional)].map((id) => {
    const comps = traceability?.[id] ?? [];
    const impl = tasks ? tasksReferring(tasks, id, "refs") : [];
    const row = [idBadge(id)];
    if (hasDesign) row.push(comps.length ? idBadges(comps) : statusLabel("error", "設計なし"));
    if (tasks) row.push(impl.length ? idBadges(impl) : statusLabel("error", "タスクなし"));
    const ok = (!hasDesign || comps.length > 0) && (!tasks || impl.length > 0 || id.startsWith("NFR-"));
    row.push(coverageCell(ok, "未対応"));
    return row;
  });
  const reqHeaders = ["要件", ...(hasDesign ? ["コンポーネント"] : []), ...(tasks ? ["実現するタスク"] : []), "状態"];

  const verifyTargets: [string, string][] = [
    ...Object.values(functional).flatMap((fr) => fr.acceptance.map((s) => [s.id, "受け入れ条件"] as [string, string])),
    ...Object.keys(invariants).map((id) => [id, "変えてはいけない振る舞い"] as [string, string]),
    ...Object.keys(nonFunctional).map((id) => [id, "非機能要件"] as [string, string]),
  ];
  const verRows = verifyTargets.map(([id, kind]) => {
    const vt = tasks
      ? Object.entries(tasks).filter(([, t]) => t.kind === "test" && (t.verifies ?? []).includes(id)).map(([tid]) =>
        tid
      )
      : [];
    const cell = !tasks
      ? `<span class="muted">タスク未作成</span>`
      : vt.length
      ? statusLabel("ok", "対応済み")
      : id.startsWith("NFR-")
      ? statusLabel("warning", "テストなし")
      : statusLabel("error", "テストなし");
    return [idBadge(id), esc(kind), tasks ? idBadges(vt) : `<span class="muted">—</span>`, cell];
  });

  const html = `<section id="trace"><h2>追跡表</h2>
<h3>要件と設計・タスクの対応</h3>${table(reqHeaders, reqRows)}
<h3>検証の対応</h3>${table(["対象", "種類", "検証するテストタスク", "状態"], verRows)}
</section>`;
  return { nav: { id: "trace", label: "追跡表" }, html };
}

export function tasksSection(
  tasks: Readonly<Record<string, AnyTask>>,
  commits: ReadonlyMap<string, readonly { hash: string }[]> = new Map(),
): Section {
  const entries = Object.entries(tasks);
  const done = entries.filter(([, t]) => t.status === "done").length;
  const pct = entries.length ? Math.round((done / entries.length) * 100) : 0;
  const rows = entries.map(([id, t]) => [
    idBadge(id),
    taskStatus(t),
    esc(TASK_KIND_LABEL[t.kind]),
    `<strong>${esc(t.title)}</strong><br><span class="muted">${esc(t.description)}</span>`,
    idBadges(t.refs),
    t.verifies?.length ? idBadges(t.verifies) : `<span class="muted">—</span>`,
    commits.get(id)?.length
      ? commits.get(id)!.map((c) => `<code>${esc(c.hash)}</code>`).join(" ")
      : `<span class="muted">—</span>`,
  ]);
  const html = `<section id="tasks"><h2>タスク</h2>
<p>進捗: ${done} / ${entries.length} 件完了（${pct}%）</p>
<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>
${table(["ID", "状態", "種類", "内容", "実現する要件・コンポーネント", "検証する対象", "コミット"], rows)}
</section>`;
  return { nav: { id: "tasks", label: "タスク" }, html };
}

export function statsHtml(items: [string, string | number][]): string {
  return `<div class="stats">${
    items.map(([k, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")
  }</div>`;
}

/** 完全モードのページ本体 */
export function fullSections(
  issue: LoadedIssue,
  diags: Diagnostic[],
  commits: ReadonlyMap<string, readonly { hash: string }[]> = new Map(),
): Section[] {
  const r = issue.requirements;
  const d = issue.design;
  const t = issue.tasks as LooseTasks | undefined;
  const sections: Section[] = [diagnosticsSection(diags)];
  if (r) sections.push(acceptanceSection(issue.id, r.functional, r.invariants, t?.acceptanceGuide));
  sections.push(issueSection(issue));
  if (r) sections.push(requirementsSection(r));
  if (d) sections.push(designSection(d));
  if (r) {
    sections.push(traceabilitySection({
      functional: r.functional,
      nonFunctional: r.nonFunctional,
      invariants: r.invariants,
      traceability: d?.traceability as Readonly<Record<string, readonly string[]>> | undefined,
      tasks: t?.tasks,
    }));
  }
  if (t) sections.push(tasksSection(t.tasks, commits));
  return sections;
}

/** 軽量モードのページ本体（1ページにまとめる） */
export function quickSections(
  issue: LoadedIssue,
  diags: Diagnostic[],
  commits: ReadonlyMap<string, readonly { hash: string }[]> = new Map(),
): Section[] {
  const q = issue.quick as LooseQuickSpec;
  const cause = q.kind === "bugfix" && q.cause
    ? `<h3 id="quick-cause">原因</h3><h4>再現手順</h4>${list(q.cause.reproduction, true)}<h4>根本原因</h4><p>${
      esc(q.cause.rootCause)
    }</p>`
    : "";
  const html = `<section id="quick"><h2>spec（軽量モード）</h2>
<p><span class="tag">${q.kind === "bugfix" ? "バグの修正" : "小さな変更"}</span> ${esc(q.summary)}</p>
${cause}
<h3 id="quick-expected">期待する動作</h3>${functionalCards(q.expected)}
<h3 id="quick-inv">変えてはいけない振る舞い</h3>${invariantTable(q.invariants)}
<h3 id="quick-sufficiency">十分性の確認</h3>
${sufficiencyHtml({ issueCoverage: q.issueCoverage, checklist: q.checklist, noInvariantsReason: q.noInvariantsReason })}
<h3 id="quick-approach">変更方針</h3><p>${esc(q.approach)}</p>
<h3 id="quick-impact">影響範囲</h3>${impactHtml(q.impact)}
</section>`;
  const children: NavItem[] = [
    ...(cause ? [{ id: "quick-cause", label: "原因" }] : []),
    { id: "quick-expected", label: "期待する動作" },
    { id: "quick-inv", label: "変えてはいけない振る舞い" },
    { id: "quick-sufficiency", label: "十分性の確認" },
    { id: "quick-approach", label: "変更方針" },
    { id: "quick-impact", label: "影響範囲" },
  ];
  return [
    diagnosticsSection(diags),
    acceptanceSection(issue.id, q.expected, q.invariants, q.acceptanceGuide),
    issueSection(issue),
    { nav: { id: "quick", label: "spec", children }, html },
    traceabilitySection({ functional: q.expected, nonFunctional: {}, invariants: q.invariants, tasks: q.tasks }),
    tasksSection(q.tasks, commits),
  ];
}

export function taskStats(tasks: Readonly<Record<string, AnyTask>> | undefined): string {
  if (!tasks) return "—";
  const all = Object.values(tasks);
  return `${all.filter((t) => t.status === "done").length} / ${all.length}`;
}
