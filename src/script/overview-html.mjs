/** Minimal HTML parser for overview.html (no dependencies). */

export function parseHtmlFragment(html) {
  const root = { type: "root", children: [] };
  const stack = [root];
  let index = 0;
  while (index < html.length) {
    if (html[index] === "<") {
      if (html.startsWith("<!--", index)) {
        const end = html.indexOf("-->", index + 4);
        const comment = html.slice(index, end < 0 ? html.length : end + 3);
        stack[stack.length - 1].children.push({ type: "comment", text: comment });
        index = end < 0 ? html.length : end + 3;
        continue;
      }
      if (html[index + 1] === "/") {
        const end = html.indexOf(">", index);
        const tag = html.slice(index + 2, end).trim().split(/\s/)[0].toLowerCase();
        while (stack.length > 1 && stack[stack.length - 1].name !== tag) stack.pop();
        if (stack.length > 1) stack.pop();
        index = end + 1;
        continue;
      }
      const end = html.indexOf(">", index);
      if (end < 0) break;
      const raw = html.slice(index + 1, end);
      const selfClosing = /\/\s*$/.test(raw);
      const open = raw.replace(/\/\s*$/, "").trim();
      const space = open.search(/\s/);
      const name = (space < 0 ? open : open.slice(0, space)).toLowerCase();
      const attrText = space < 0 ? "" : open.slice(space);
      const node = { type: "element", name, attrs: parseAttrs(attrText), children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing && !/^(br|hr|img|meta|link|input)$/.test(name)) stack.push(node);
      index = end + 1;
      continue;
    }
    const next = html.indexOf("<", index);
    const text = html.slice(index, next < 0 ? html.length : next);
    if (text.length) stack[stack.length - 1].children.push({ type: "text", text });
    index = next < 0 ? html.length : next;
  }
  return root;
}

function parseAttrs(text) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(text))) {
    const key = match[1].toLowerCase();
    if (key === "/") continue;
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

export function attr(node, name) {
  if (!node?.attrs) return "";
  const key = name.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(node.attrs, key)) return node.attrs[key] ?? "";
  if (Object.prototype.hasOwnProperty.call(node.attrs, name)) return node.attrs[name] ?? "";
  return "";
}

export function hasAttr(node, name) {
  if (!node?.attrs) return false;
  const key = name.toLowerCase();
  return Object.prototype.hasOwnProperty.call(node.attrs, key) || Object.prototype.hasOwnProperty.call(node.attrs, name);
}

export function textContent(node) {
  if (!node) return "";
  if (node.type === "text") return node.text;
  if (node.type === "comment") return "";
  return (node.children || []).map(textContent).join("");
}

export function findElements(node, predicate, out = []) {
  if (node.type === "element" && predicate(node)) out.push(node);
  for (const child of node.children || []) findElements(child, predicate, out);
  return out;
}

export function firstElement(node, predicate) {
  if (node.type === "element" && predicate(node)) return node;
  for (const child of node.children || []) {
    const found = firstElement(child, predicate);
    if (found) return found;
  }
  return null;
}

/** Direct child elements only */
export function childElements(node) {
  return (node.children || []).filter((child) => child.type === "element");
}

export function tableBodyCells(tableEl) {
  const cells = [];
  for (const tr of findElements(tableEl, (n) => n.name === "tr")) {
    for (const cell of childElements(tr)) {
      if (cell.name === "td") cells.push(cell);
    }
  }
  return cells;
}

/** One left-to-right pass: &amp;#45; becomes literal &#45; (no numeric decode in the same pass). */
export function decodeHtmlEntitiesOnePass(text) {
  const s = String(text || "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] !== "&") {
      out += s[i];
      i += 1;
      continue;
    }
    if (s.startsWith("&amp;", i)) {
      out += "&";
      i += 5;
      continue;
    }
    if (s.startsWith("&nbsp;", i)) {
      out += " ";
      i += 6;
      continue;
    }
    if (s.startsWith("&#160;", i)) {
      out += " ";
      i += 7;
      continue;
    }
    if (/^&#xA0;/i.test(s.slice(i))) {
      out += " ";
      i += 7;
      continue;
    }
    if (s.startsWith("&lt;", i)) {
      out += "<";
      i += 4;
      continue;
    }
    if (s.startsWith("&gt;", i)) {
      out += ">";
      i += 4;
      continue;
    }
    if (s.startsWith("&quot;", i)) {
      out += '"';
      i += 6;
      continue;
    }
    const dec = /^&#(\d+);/.exec(s.slice(i));
    if (dec) {
      out += String.fromCharCode(Number(dec[1]));
      i += dec[0].length;
      continue;
    }
    const hex = /^&#x([0-9a-f]+);/i.exec(s.slice(i));
    if (hex) {
      out += String.fromCharCode(parseInt(hex[1], 16));
      i += hex[0].length;
      continue;
    }
    out += s[i];
    i += 1;
  }
  return out;
}

export function decodeHtmlEntities(text) {
  let value = String(text || "");
  for (let pass = 0; pass < 8; pass += 1) {
    const next = decodeHtmlEntitiesOnePass(value);
    if (next === value) break;
    value = next;
  }
  return value;
}

export function cellColspan(node) {
  const raw = attr(node, "colspan");
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Logical column index of a cell within its row (sums colspan). */
export function columnIndexInRow(rowCells, target) {
  let col = 0;
  for (const cell of rowCells) {
    if (cell === target) return col;
    col += cellColspan(cell);
  }
  return -1;
}

/** Header label at a logical column index in the header row. */
export function headerLabelAtColumn(headerRow, targetCol) {
  if (!headerRow) return "";
  let col = 0;
  for (const cell of childElements(headerRow)) {
    const span = cellColspan(cell);
    if (targetCol >= col && targetCol < col + span) return decodeHtmlEntities(textContent(cell)).trim();
    col += span;
  }
  return "";
}
