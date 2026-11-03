# overview.html visual design

Human-readable styling for issue `overview.html` (generated CSS plus optional agent `<style>`). `check` does not validate colors; follow this guide when writing or regenerating markup.

## Layout (shadcn-like, static HTML)

- System sans-serif stack, generous whitespace; main column **max-width 75rem (~1200px)**, full width with side padding (not a narrow card).
- Cards: 1px border, ~8px radius, solid `--alto` border (no shadows), `--white` background.
- Summary list: **3–5 bullets**, prose **≤12 characters** per bullet (see `/sdd-req` skill); one line (`white-space: nowrap`); ids belong in the generated section, not in bullet prose.
- Tables: **width 100%**, `.sdd-table-wrap` horizontal scroll on small viewports; column **min-width ~7rem**; cell copy = short phrase + nowrap ids, **≤2 lines at 1280px**.
- File must work offline: no React, Tailwind build, external fonts, or CDN.

## Color rule (14 colors only)

Use **exactly these 14 hex values**. Do not introduce any other hex, rgb, hsl, named color, `color-mix`, or alpha blends.

Define every token as a CSS custom property with **exactly** these names:

```css
:root {
  --white: #fff;
  --black: #000;
  --alto: #dedede;
  --chicago: #5f5f5f;
  --casal: #2c6b6a;
  --azure: #3a5aad;
  --plum: #8f3a7b;
  --royal-purple: #6f48a0;
  --oregon: #9b4100;
  --jagged-ice: #c1e7e6;
  --hawkes-blue: #cfdeff;
  --classic-rose: #ffccef;
  --snuff: #e3d8f5;
  --almond: #f5d7c7;
}
```

### Usage

- **`--white` (`#fff`)**: page background and card surfaces.
- **`--black` (`#000`)**: strongest headings where `--chicago` is not enough contrast on a light fill.
- **Neutrals**: body text — `--chicago` on `--white`; borders/dividers and muted fills — `--alto` with `--chicago` text (answered questions, table headers, `none` cells).
- **Semantic pairs** (light fill + dark text/border): chicago/alto, casal/jagged-ice, azure/hawkes-blue, plum/classic-rose, royal-purple/snuff, oregon/almond.
- **Suggested mapping**: ADDED = casal/jagged-ice; MODIFIED / links / primary = azure/hawkes-blue; REMOVED = oregon/almond; open questions / undecided (未決定) = plum/classic-rose; **answered** questions = chicago/alto (`sdd-callout-neutral`); steering changes = royal-purple/snuff.

Every text/background pair must meet **WCAG AA 4.5:1** for body-sized text. Verified ratios for the default mapping:

| Use | Foreground | Background | Contrast |
|---|---|---|---|
| Body text | `--chicago` | `--white` | 6.39:1 |
| Added ids | `--casal` | `--jagged-ice` | 4.63:1 |
| Modified / links | `--azure` | `--hawkes-blue` | 4.79:1 |
| Removed ids | `--oregon` | `--almond` | 4.90:1 |
| Open questions / undecided | `--plum` | `--classic-rose` | 4.95:1 |
| Answered questions | `--chicago` | `--alto` | 4.75:1 |
| Steering changes | `--royal-purple` | `--snuff` | 4.95:1 |
| Strong headings | `--black` | `--white` | 21.0:1 |
