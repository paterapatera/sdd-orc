import type { Component } from "../schema/mod.ts";
import { esc } from "./html.ts";

type Edge = { from: string; to: string; label?: string };

const FONT = 13;
const PAD_X = 14;
const BOX_H = 40;
const GAP_X = 28;
const GAP_Y = 64;
const MARGIN = 16;

/** 文字列の表示幅のおおよその値 */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0xff ? FONT : FONT * 0.62;
  return w;
}

/**
 * コンポーネントの依存関係の図（SVG）を作る。
 * 使う側を上に、使われる側を下に並べる（最長経路による階層化）。
 */
export function dependencyDiagram(components: Readonly<Record<string, Component>>, edges: readonly Edge[]): string {
  const names = Object.keys(components);
  if (names.length === 0) return "";
  const known = new Set(names);
  const valid = edges.filter((e) => known.has(e.from) && known.has(e.to) && e.from !== e.to);

  // 階層: from の階層 + 1 以上に to を置く。循環があっても止まるよう、回数を制限する
  const level = new Map(names.map((n) => [n, 0]));
  for (let iter = 0; iter < names.length; iter++) {
    let changed = false;
    for (const e of valid) {
      const next = level.get(e.from)! + 1;
      if (next > level.get(e.to)! && next < names.length) {
        level.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const rows: string[][] = [];
  for (const n of names) (rows[level.get(n)!] ??= []).push(n);
  const compact = rows.filter((r) => r && r.length > 0);

  const width = new Map(names.map((n) => [n, Math.ceil(textWidth(n) + PAD_X * 2)]));
  const rowWidths = compact.map((r) => r.reduce((s, n) => s + width.get(n)!, 0) + GAP_X * (r.length - 1));
  const svgW = Math.max(...rowWidths) + MARGIN * 2;
  const svgH = compact.length * BOX_H + (compact.length - 1) * GAP_Y + MARGIN * 2;

  const pos = new Map<string, { x: number; y: number; w: number }>();
  compact.forEach((r, ri) => {
    let x = MARGIN + (svgW - MARGIN * 2 - rowWidths[ri]) / 2;
    const y = MARGIN + ri * (BOX_H + GAP_Y);
    for (const n of r) {
      pos.set(n, { x, y, w: width.get(n)! });
      x += width.get(n)! + GAP_X;
    }
  });

  const edgeSvg = valid.map((e) => {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    const x1 = a.x + a.w / 2;
    const x2 = b.x + b.w / 2;
    let d: string;
    let lx: number;
    let ly: number;
    if (b.y > a.y) {
      const y1 = a.y + BOX_H;
      const y2 = b.y - 2;
      d = `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
      lx = (x1 + x2) / 2;
      ly = (y1 + y2) / 2;
    } else {
      // 同じ段か上向き（循環）の場合は、上側を回り込む曲線にする
      const y1 = a.y;
      const y2 = b.y - 2;
      const top = Math.min(a.y, b.y) - GAP_Y / 2;
      d = `M${x1},${y1} C${x1},${top} ${x2},${top} ${x2},${y2}`;
      lx = (x1 + x2) / 2;
      ly = top + 6;
    }
    const label = e.label
      ? `<text x="${lx}" y="${
        ly - 4
      }" text-anchor="middle" font-size="12" fill="var(--chicago)" paint-order="stroke" stroke="#fff" stroke-width="4">${
        esc(e.label)
      }</text>`
      : "";
    return `<path d="${d}" fill="none" stroke="var(--chicago)" stroke-width="1.5" marker-end="url(#arrow)"/>${label}`;
  }).join("");

  const nodeSvg = names.map((n) => {
    const p = pos.get(n)!;
    const isNew = components[n].kind === "new";
    const fill = isNew ? "var(--jagged-ice)" : "var(--hawkes-blue)";
    const stroke = isNew ? "var(--casal)" : "var(--azure)";
    return `<g><title>${
      esc(components[n].responsibility)
    }</title><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${BOX_H}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text x="${
      p.x + p.w / 2
    }" y="${
      p.y + BOX_H / 2 + FONT / 2 - 2
    }" text-anchor="middle" font-size="${FONT}" font-weight="700" fill="${stroke}">${esc(n)}</text></g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="コンポーネントの依存関係">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--chicago)"/></marker></defs>
${edgeSvg}${nodeSvg}</svg>`;
}
