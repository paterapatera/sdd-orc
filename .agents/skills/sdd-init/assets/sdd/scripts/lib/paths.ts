import { join, resolve } from "node:path";

/** docs/sdd */
export const SDD_DIR = resolve(import.meta.dirname!, "../..");
/** 対象リポジトリのルート */
export const ROOT = resolve(SDD_DIR, "../..");
/** docs/specs */
export const SPECS_DIR = join(ROOT, "docs", "specs");
/** 人向けのHTMLの出力先（.gitignore の対象） */
export const OUT_DIR = join(ROOT, ".sdd", "out");

/** ルートからの相対パス（表示用） */
export function rel(path: string): string {
  return path.startsWith(ROOT + "/") ? path.slice(ROOT.length + 1) : path;
}

export async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
