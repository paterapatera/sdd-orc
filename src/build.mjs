import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function bundleSdd() {
  const entry = path.join(packageRoot, "src/script/main.mjs");
  const nodeImports = new Map();
  const chunks = [];
  const seen = new Set();

  function resolveImport(fromFile, spec) {
    const base = path.resolve(path.dirname(fromFile), spec);
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    if (fs.existsSync(`${base}.mjs`)) return `${base}.mjs`;
    throw new Error(`Cannot resolve ${spec} from ${fromFile}`);
  }

  function load(file) {
    if (seen.has(file)) return;
    seen.add(file);
    let text = fs.readFileSync(file, "utf8");
    if (text.startsWith("#!")) text = text.slice(text.indexOf("\n") + 1);
    const deps = [];
    text = text.replace(/^import\s+(.+?)\s+from\s+["']([^"']+)["'];?\s*$/gm, (full, clause, spec) => {
      if (!spec.startsWith(".")) {
        recordNodeImport(clause.trim(), spec);
        return "";
      }
      deps.push(resolveImport(file, spec));
      return "";
    });
    for (const dep of deps) load(dep);
    text = text.replace(/^export\s+(async\s+function|function|const|let|class)\s+/gm, "$1 ");
    text = text.replace(/^export\s+\{[^}]*\};?\s*$/gm, "");
    chunks.push(text.trim());
  }

  function recordNodeImport(clause, spec) {
    const star = /^\*\s+as\s+([A-Za-z0-9_]+)$/.exec(clause);
    const named = /^\{([^}]+)\}$/.exec(clause);
    const def = /^([A-Za-z0-9_]+)$/.exec(clause);
    const mixed = /^([A-Za-z0-9_]+)\s*,\s*\{([^}]+)\}$/.exec(clause);
    const add = (info) => {
      const key = `${spec}::${info.type}::${info.name}::${info.local}`;
      nodeImports.set(key, { spec, ...info });
    };
    if (star) add({ type: "namespace", name: star[1], local: star[1] });
    else if (def) add({ type: "default", name: def[1], local: def[1] });
    else if (named) addNamed(named[1], add);
    else if (mixed) {
      add({ type: "default", name: mixed[1], local: mixed[1] });
      addNamed(mixed[2], add);
    } else {
      throw new Error(`Unsupported import: ${clause} from ${spec}`);
    }
  }

  function addNamed(inner, add) {
    for (const part of inner.split(",")) {
      const bit = part.trim();
      if (!bit) continue;
      const [name, alias] = bit.split(/\s+as\s+/).map((item) => item.trim());
      add({ type: "named", name, local: alias || name });
    }
  }

  load(entry);
  const grouped = new Map();
  for (const info of nodeImports.values()) {
    if (!grouped.has(info.spec)) grouped.set(info.spec, []);
    grouped.get(info.spec).push(info);
  }
  let prelude = "";
  for (const [spec, infos] of grouped) {
    const defaults = infos.filter((info) => info.type === "default");
    const named = infos.filter((info) => info.type === "named");
    const namespaces = infos.filter((info) => info.type === "namespace");
    if (defaults.length > 1) throw new Error(`Duplicate default import from ${spec}`);
    const bits = [];
    if (defaults[0]) bits.push(defaults[0].local);
    if (named.length) {
      bits.push(`{ ${named.map((info) => (info.name === info.local ? info.name : `${info.name} as ${info.local}`)).join(", ")} }`);
    }
    if (bits.length) prelude += `import ${bits.join(", ")} from "${spec}";\n`;
    for (const info of namespaces) prelude += `import * as ${info.local} from "${spec}";\n`;
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const out = `#!/usr/bin/env node\nconst PACKAGE_VERSION = ${JSON.stringify(packageJson.version)};\n${prelude}\n${chunks.join("\n\n")}\n`;
  const destination = path.join(packageRoot, "dist/sdd.mjs");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, out);
  return destination;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = bundleSdd();
  process.stdout.write(`${destination}\n`);
}
