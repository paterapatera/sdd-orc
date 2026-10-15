/** 訓練用の試験問題（eval/scenarios/<ID>/scenario.ts）の型 */

/** train は直す根拠に、val は採否に使う。holdout は節目にだけ回す */
export type Split = "train" | "val" | "holdout";

type CheckBase = {
  /** 問題の中で一意な ID（例: "doctor"） */
  id: string;
  /** 落ちたら不合格にするか。false なら点数にだけ数える */
  must: boolean;
  label: string;
};

/**
 * 実行の後に、試験場のリポジトリで機械的に確かめること。
 * ファイルを読むだけの項目（exists、contains、unchanged、testFirst、noCommand）を先に判定し、command と hiddenTests はその後に書いた順に実行する。
 * コマンドが書き換えたファイルは、採点の最後に元に戻す。
 */
export type Check = CheckBase &
  /** 試験場のルートで sh -c で実行し、終了コード0なら合格 */
  (
    | { kind: "command"; run: string }
    /** すべてのパスがある */
    | { kind: "exists"; paths: readonly string[] }
    /** ファイルが、すべての正規表現（大文字小文字を区別しない）に当てはまる */
    | { kind: "contains"; path: string; patterns: readonly string[] }
    /**
     * 開始時のコミットから、glob に当てはまるファイルが変わっていない（未追跡のファイルも含む）。
     * allowNew なら、開始時に無かったファイルの追加は数えない（既存のファイルの変更と削除だけを見る）
     */
    | { kind: "unchanged"; paths: readonly string[]; allowNew?: boolean }
    /**
     * code に当てはまるファイルを最初に変えたコミットより前に、tests に当てはまるファイルを変え、
     * code には触れていないコミットがある（再現テストを先にコミットしてから直したか）
     */
    | { kind: "testFirst"; tests: readonly string[]; code: readonly string[] }
    /**
     * チャットの記録で、AI が実行したシェルのコマンドに、patterns（大文字小文字を区別しない正規表現）に当たるものが無い。
     * 人役の回答表で断ったこと（PR の作成など）を、聞かずに行っていないかを見る。記録が無ければ不合格
     */
    | { kind: "noCommand"; patterns: readonly string[] }
    /**
     * 問題のディレクトリの from を試験場の to にコピーして run を実行する。終わったら必ず消す。
     * 中身は実行する AI にも、スキルを直す AI にも見せない。
     */
    | { kind: "hiddenTests"; from: string; to: string; run: string }
  );

export type Scenario = {
  /** ディレクトリ名と同じ（例: "INIT-001"） */
  id: string;
  title: string;
  split: Split;
  /** 試験場の出発点にする tag */
  startTag: string;
  /** 人役が順に呼び出すスキル（例: ["/sdd-start", "/sdd-quick", "/sdd-impl", "/sdd-finish"]） */
  steps: readonly string[];
  /** AI に渡す issue の本文（問題のディレクトリからの相対パス）。導入の問題には無い */
  issue?: string;
  /** 人役の回答表（問題のディレクトリからの相対パス） */
  persona: string;
  checks: readonly Check[];
};

export function defineScenario<const T extends Scenario>(s: T): T {
  return s;
}
