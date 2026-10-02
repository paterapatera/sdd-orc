import { esc } from "./html.ts";

/**
 * issue.md を表示するための最小限のMarkdown変換。
 * 対応: 見出し、段落、箇条書き、番号付きリスト、引用、コードブロック、表、
 *       インラインコード、太字、リンク（http/https のみ）
 *
 * @param headingOffset 見出しの段を下げる数（# を h3 にするなら 2）
 */
export function markdownToHtml(md: string, headingOffset = 2): string {
  const lines = md.replaceAll("\r\n", "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const isBlockStart = (l: string) => /^(#{1,6}\s|```|>\s?|\s*[-*]\s|\s*\d+\.\s|\|)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = line.match(/^(`{3,})(.*)$/);
    if (fence) {
      // 閉じる側は、開いた側と同じ数以上のバッククォートだけの行（原文に ``` が含まれても崩れないように）
      const close = new RegExp(`^${fence[1]}\u0060*\\s*$`);
      const buf: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length + headingOffset);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${markdownToHtml(buf.join("\n"), headingOffset)}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      const re = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (line.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(cells(lines[i++]));
      out.push(
        `<div class="table-wrap"><table><thead><tr>${
          head.map((h) => `<th>${inline(h)}</th>`).join("")
        }</tr></thead><tbody>${
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")
        }</tbody></table></div>`,
      );
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && (buf.length === 0 || !isBlockStart(lines[i]))) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${buf.map(inline).join("<br>")}</p>`);
  }
  return out.join("\n");
}

function inline(s: string): string {
  // インラインコードを先に退避してから、残りをエスケープして装飾する
  const codes: string[] = [];
  let t = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `\uE000${codes.length - 1}\uE001`;
  });
  t = esc(t)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  return t.replace(/\uE000(\d+)\uE001/g, (_, n) => codes[Number(n)]);
}

/** issue.md の最初の見出しをタイトルとして取り出す */
export function extractTitle(md: string | undefined): string | undefined {
  return md?.match(/^#\s+(.+)$/m)?.[1]?.trim();
}
