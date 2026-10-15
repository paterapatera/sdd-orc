export const MANIFEST_NAME: string;

export function installSkills(options?: {
  dir?: string;
  sourceDir?: string;
  agents?: string[];
  dryRun?: boolean;
  global?: boolean;
  home?: string;
}): Promise<{
  base: string;
  changes: { action: "追加" | "更新" | "削除"; target: string }[];
}>;
