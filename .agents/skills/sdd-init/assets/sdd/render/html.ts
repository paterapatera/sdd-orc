/** HTMLの特殊文字をエスケープする */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** IDの種類ごとの見た目 */
export type IdKind = "fr" | "nfr" | "inv" | "ac" | "task" | "comp";

export function idKindOf(id: string): IdKind {
  if (id.startsWith("FR-")) return "fr";
  if (id.startsWith("NFR-")) return "nfr";
  if (id.startsWith("INV-")) return "inv";
  if (id.startsWith("AC-")) return "ac";
  if (/^T-\d/.test(id)) return "task";
  return "comp";
}

/** クリックでコピーできるIDのバッジ */
export function idBadge(id: string, kind: IdKind = idKindOf(id)): string {
  return `<button type="button" class="id id-${kind}" data-copy="${esc(id)}" title="クリックでコピー">${
    esc(id)
  }</button>`;
}

export function idBadges(ids: readonly string[]): string {
  return ids.length ? ids.map((id) => idBadge(id)).join(" ") : `<span class="muted">なし</span>`;
}

/** 状態を表すラベル。色だけに頼らず、必ず文字を添える */
export function statusLabel(kind: "ok" | "error" | "warning" | "todo" | "doing" | "done", text: string): string {
  const icon = { ok: "✓", done: "✓", error: "✕", warning: "!", todo: "○", doing: "▶" }[kind];
  return `<span class="status status-${kind}"><span aria-hidden="true">${icon}</span> ${esc(text)}</span>`;
}

export function list(items: readonly string[], ordered = false): string {
  if (items.length === 0) return `<p class="muted">なし</p>`;
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
}

export function table(headers: readonly string[], rows: readonly (readonly string[])[], cls = ""): string {
  if (rows.length === 0) return `<p class="muted">なし</p>`;
  return `<div class="table-wrap"><table class="${cls}"><thead><tr>${
    headers.map((h) => `<th>${esc(h)}</th>`).join("")
  }</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
  }</tbody></table></div>`;
}

export type NavItem = { id: string; label: string; children?: NavItem[] };

export type Page = {
  title: string;
  subtitle: string;
  meta: readonly [string, string][];
  nav: NavItem[];
  body: string;
};

function renderNav(items: NavItem[]): string {
  return `<ul>${
    items.map((i) =>
      `<li><a href="#${esc(i.id)}">${esc(i.label)}</a>${i.children?.length ? renderNav(i.children) : ""}</li>`
    ).join("")
  }</ul>`;
}

export function renderPage(p: Page): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-title">${esc(p.title)}</div>
  <div class="topbar-sub">${esc(p.subtitle)}</div>
</header>
<div class="layout">
  <nav class="sidenav" aria-label="目次">${renderNav(p.nav)}</nav>
  <main>
    <dl class="meta">${p.meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>
    ${p.body}
  </main>
</div>
<div class="toast" role="status" aria-live="polite"></div>
<script>${JS}</script>
</body>
</html>
`;
}

const CSS = `
:root {
  /* 濃い色 */
  --chicago: #5f5f5f;
  --casal: #2c6b6a;
  --azure: #3a5aad;
  --plum: #8f3a7b;
  --royal-purple: #6f48a0;
  --oregon: #9b4100;
  /* 薄い色 */
  --alto: #dedede;
  --jagged-ice: #c1e7e6;
  --hawkes-blue: #cfdeff;
  --classic-rose: #ffccef;
  --snuff: #e3d8f5;
  --almond: #f5d7c7;

  --text: #1f1f1f;
  --bg: #ffffff;
  --panel: #fafafa;
  --primary: var(--casal);
  --primary-bg: var(--jagged-ice);
  --secondary: var(--chicago);
  --secondary-bg: var(--alto);
  --warning: var(--oregon);
  --warning-bg: var(--almond);
  --error: var(--plum);
  --error-bg: var(--classic-rose);
}
* { box-sizing: border-box; }
html { scroll-padding-top: 16px; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif;
  font-size: 15px; line-height: 1.7;
}
a { color: var(--primary); }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
pre { background: var(--panel); border: 1px solid var(--alto); border-radius: 6px; padding: 10px 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
.topbar { background: var(--primary); color: #fff; padding: 14px 24px; }
.topbar-title { font-size: 20px; font-weight: 700; }
.topbar-sub { font-size: 13px; opacity: .9; }
.layout { display: flex; align-items: flex-start; }
.sidenav { position: sticky; top: 0; width: 240px; flex-shrink: 0; max-height: 100vh; overflow-y: auto; padding: 16px 8px 16px 16px; border-right: 1px solid var(--alto); font-size: 14px; }
.sidenav ul { list-style: none; margin: 0; padding: 0; }
.sidenav ul ul { padding-left: 14px; font-size: 13px; }
.sidenav a { display: block; padding: 3px 8px; border-radius: 4px; color: var(--text); text-decoration: none; }
.sidenav a:hover { background: var(--panel); }
.sidenav a.active { background: var(--primary-bg); color: var(--primary); font-weight: 700; }
main { flex: 1; min-width: 0; max-width: 1080px; padding: 16px 32px 64px; }
h2 { color: var(--primary); border-bottom: 2px solid var(--primary); padding-bottom: 4px; margin: 40px 0 16px; font-size: 22px; }
h3 { color: var(--primary); margin: 28px 0 10px; font-size: 18px; }
h4 { margin: 18px 0 8px; font-size: 15px; }
.muted { color: var(--secondary); }
.meta { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0 0 8px; font-size: 13px; color: var(--secondary); }
.meta div { display: flex; gap: 6px; }
.meta dt { font-weight: 700; }
.meta dd { margin: 0; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 8px 0 16px; }
th, td { border: 1px solid var(--alto); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: var(--secondary-bg); color: var(--text); font-weight: 700; white-space: nowrap; }
td ul, td ol { margin: 0; padding-left: 18px; }
.card { border: 1px solid var(--alto); border-radius: 8px; padding: 12px 16px; margin: 12px 0; background: var(--bg); }
.card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.card-title { font-weight: 700; font-size: 16px; }
.ears { background: var(--panel); border-left: 4px solid var(--azure); padding: 8px 12px; margin: 8px 0; }
.id { font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 4px 7px; border-radius: 4px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; }
.id:hover { filter: brightness(.95); text-decoration: underline; }
.id-fr { color: var(--azure); background: var(--hawkes-blue); }
.id-nfr { color: var(--royal-purple); background: var(--snuff); }
.id-inv { color: var(--oregon); background: var(--almond); }
.id-ac { color: var(--azure); background: var(--bg); border-color: var(--azure); }
.id-task { color: var(--chicago); background: var(--alto); }
.id-comp { color: var(--casal); background: var(--jagged-ice); }
.tag { display: inline-block; font-size: 12px; padding: 1px 8px; border-radius: 10px; background: var(--secondary-bg); color: var(--secondary); }
.status { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.status-ok, .status-done { color: var(--primary); background: var(--primary-bg); }
.status-doing { color: var(--azure); background: var(--hawkes-blue); }
.status-todo { color: var(--secondary); background: var(--secondary-bg); }
.status-warning { color: var(--warning); background: var(--warning-bg); }
.status-error { color: var(--error); background: var(--error-bg); }
.diag { list-style: none; padding: 0; margin: 8px 0; }
.diag li { display: flex; gap: 8px; align-items: baseline; padding: 6px 10px; border-radius: 6px; margin: 4px 0; }
.diag li.error { background: var(--error-bg); color: var(--error); }
.diag li.warning { background: var(--warning-bg); color: var(--warning); }
.diag code { color: inherit; }
.callout { border-radius: 8px; padding: 10px 14px; margin: 8px 0; }
.callout-ok { background: var(--primary-bg); color: var(--primary); }
.callout-warning { background: var(--warning-bg); color: var(--warning); }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.two-col > div { border: 1px solid var(--alto); border-radius: 8px; padding: 10px 14px; }
.two-col h4 { margin-top: 0; }
.progress { height: 10px; background: var(--secondary-bg); border-radius: 5px; overflow: hidden; margin: 6px 0 12px; }
.progress > div { height: 100%; background: var(--primary); }
.stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
.stat { border: 1px solid var(--alto); border-radius: 8px; padding: 8px 14px; min-width: 110px; }
.stat b { display: block; font-size: 20px; color: var(--primary); }
.stat span { font-size: 12px; color: var(--secondary); }
.diagram { border: 1px solid var(--alto); border-radius: 8px; padding: 12px; overflow-x: auto; background: var(--bg); }
.legend { display: flex; gap: 16px; font-size: 12px; color: var(--secondary); margin-top: 6px; }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; }
.issue-body { border: 1px solid var(--alto); border-radius: 8px; padding: 4px 18px; }
input.accept { width: 18px; height: 18px; accent-color: var(--casal); cursor: pointer; }
.accept-progress { font-weight: 700; color: var(--primary); }
.toast { position: fixed; right: 20px; bottom: 20px; background: var(--primary); color: #fff; padding: 8px 14px; border-radius: 6px; font-size: 14px; opacity: 0; transition: opacity .2s; pointer-events: none; }
.toast.show { opacity: 1; }
@media (max-width: 800px) {
  .layout { display: block; }
  .sidenav { position: static; width: auto; max-height: none; border-right: none; border-bottom: 1px solid var(--alto); }
  main { padding: 12px 16px 48px; }
  .two-col { grid-template-columns: 1fr; }
}
@media print {
  .sidenav, .toast { display: none; }
  .layout { display: block; }
}
`;

const JS = `
(() => {
  const toast = document.querySelector(".toast");
  let timer;
  const show = (msg) => {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove("show"), 1500);
  };
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    show(text + " をコピーしました");
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-copy]");
    if (el) copy(el.dataset.copy);
  });
  // 受け入れテストのチェック状態をブラウザに保存する（保存できない環境でも表示は壊さない）
  const accepts = [...document.querySelectorAll("input.accept")];
  const store = {
    get(k) { try { return localStorage.getItem("sdd-accept:" + k) === "1"; } catch { return false; } },
    set(k, v) { try { v ? localStorage.setItem("sdd-accept:" + k, "1") : localStorage.removeItem("sdd-accept:" + k); } catch {} },
  };
  const progress = () => {
    const done = accepts.filter((a) => a.checked).length;
    document.querySelectorAll(".accept-progress").forEach((el) => {
      el.textContent = "（確認済み " + done + " / " + accepts.length + " 件）";
    });
  };
  accepts.forEach((a) => {
    a.checked = store.get(a.dataset.acceptKey);
    a.addEventListener("change", () => { store.set(a.dataset.acceptKey, a.checked); progress(); });
  });
  progress();
  const links = [...document.querySelectorAll(".sidenav a")];
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const observer = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      links.forEach((a) => a.classList.remove("active"));
      byId.get(en.target.id)?.classList.add("active");
    }
  }, { rootMargin: "0px 0px -70% 0px" });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) observer.observe(s); });
})();
`;
