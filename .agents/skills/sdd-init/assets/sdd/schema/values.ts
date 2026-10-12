import type { NonEmpty } from "./ids.ts";

/**
 * 値の種類ごとの観点。requirements.ts の values に書いた値は、その種類の観点すべてに扱いを書く
 * （1つでも欠けると型エラーになる）。観点は、主なフレームワークの検証規則の一覧と境界値の考え方から作った。
 * 観点の表示名は1つの点だけを書く（1つの観点を1問で聞けるようにするため）。
 */
export const VALUE_KINDS = {
  textInput: {
    label: "文字列の入力",
    aspects: {
      required: "未入力のときに受け付けるか",
      minLength: "最小の文字数",
      maxLength: "最大の文字数",
      blankOnly: "空白だけの値の扱い",
      surroundingSpace: "前後の空白の扱い",
      lineBreak: "改行を含む値の扱い",
      characters: "受け付ける文字の種類",
      unique: "既存の値と同じ値の扱い",
      relation: "ほかの項目の値との関係",
      rejection: "受け付けないときに利用者へ返す結果",
    },
  },
  numberInput: {
    label: "数値の入力",
    aspects: {
      required: "未入力のときに受け付けるか",
      min: "最小値",
      max: "最大値",
      fraction: "小数を受け付けるか",
      notation: "数字以外の書き方（全角、桁区切りなど）の扱い",
      relation: "ほかの項目の値との関係",
      rejection: "受け付けないときに利用者へ返す結果",
    },
  },
  dateInput: {
    label: "日付・日時の入力",
    aspects: {
      required: "未入力のときに受け付けるか",
      notation: "受け付ける形式",
      earliest: "選べる最も早い日時",
      latest: "選べる最も遅い日時",
      timezone: "入力した日時を解釈するタイムゾーン",
      relation: "ほかの項目の値との関係",
      rejection: "受け付けないときに利用者へ返す結果",
    },
  },
  emailInput: {
    label: "メールアドレスの入力",
    aspects: {
      required: "未入力のときに受け付けるか",
      maxLength: "最大の文字数",
      format: "形式の確かめ方",
      letterCase: "大文字と小文字の区別",
      unique: "既存の値と同じ値の扱い",
      rejection: "受け付けないときに利用者へ返す結果",
    },
  },
  choiceInput: {
    label: "選択肢からの入力",
    aspects: {
      required: "未選択のときに受け付けるか",
      options: "選べる値",
      optionLabels: "選べる値の表示名",
      optionOrder: "選べる値の並び順",
      multiple: "複数を選べるか",
      initial: "初期値",
      relation: "ほかの項目の値との関係",
      rejection: "選べる値に無い値が送られたときの結果",
    },
  },
  fileInput: {
    label: "ファイルの入力",
    aspects: {
      required: "未選択のときに受け付けるか",
      types: "受け付けるファイルの種類",
      maxSize: "大きさの上限",
      count: "一度に受け付ける個数",
      rejection: "受け付けないときに利用者へ返す結果",
    },
  },
  textDisplay: {
    label: "文字列の表示",
    aspects: {
      long: "長い値の見せ方",
      lineBreak: "改行を含む値の見せ方",
      empty: "値が空のときの表示",
    },
  },
  dateDisplay: {
    label: "日付・日時の表示",
    aspects: {
      format: "表示の形式",
      timezone: "表示するタイムゾーン",
      empty: "値が無いときの表示",
    },
  },
  numberDisplay: {
    label: "数値の表示",
    aspects: {
      format: "表示の形式",
      unit: "単位",
      empty: "値が無いときの表示",
    },
  },
  listDisplay: {
    label: "一覧の表示",
    aspects: {
      items: "各行に出す項目",
      order: "並び順",
      tie: "並び順を決める値が等しいときの順",
      empty: "0件のときの表示",
      pageSize: "一度に表示する件数",
      rest: "表示しきれない分の見せ方",
    },
  },
} as const satisfies Record<string, { label: string; aspects: Record<string, string> }>;

/** 値の種類 */
export type ValueKind = keyof typeof VALUE_KINDS;

/** 値の種類の観点 */
export type AspectOf<K extends ValueKind> = keyof (typeof VALUE_KINDS)[K]["aspects"] & string;

/**
 * 扱いを決めた出どころ。書き手の推測は出どころにならない。
 * - issue: issue.md からの引用（issue.md にそのままあるかを verify が確かめる）
 * - code: 既存の振る舞いを決めているファイルのリポジトリのルートからのパス（あるかを verify が確かめる）
 * - answer: 人の回答の ID（requirements.ts の answers にあるかを型と verify が確かめる）
 */
export type Basis<Ans extends string = string> = { issue: string } | { code: string } | { answer: Ans };

/**
 * 1つの観点の扱い。
 * - decidedBy: 受け入れ条件か、変えてはいけない振る舞いで決めた（ID と出どころを書く）
 * - notApplicable: この値には関係しないと人が答えた（理由と、その回答の ID を書く）。
 *   issue に書かれていないことは、関係しない理由にならない
 * - open: 決まっていない。人に聞く質問は、対象と観点の名前で表す（文は書かない）
 */
export type AspectDecision<Ref extends string = string, Ans extends string = string> =
  | { decidedBy: NonEmpty<Ref>; basis: Basis<Ans> }
  | { notApplicable: string; basis: { answer: Ans } }
  | { open: true };

/** この issue が作る・変える入力か表示の1つと、その観点ごとの扱い */
export type ValueCheck<Ref extends string = string, Ans extends string = string> = {
  [K in ValueKind]: {
    /** 何の値か（例: 「検索欄」「一覧の各行の名前」「export コマンドの第1引数」） */
    target: string;
    kind: K;
    aspects: { readonly [A in AspectOf<K>]: AspectDecision<Ref, Ans> };
  };
}[ValueKind];

/** 質問への人の回答。質問した対象と観点、答えた内容を書く */
export type Answer = {
  target: string;
  aspect: string;
  /** 人が答えた内容（要約してよいが、人が答えていないことは足さない） */
  answer: string;
};

/** 入力と表示の観点以外の、未確定の点。1件に1つの対象の1つの観点だけを書く */
export type OpenQuestion = {
  /** 何についてか（例: 「検索欄」「ログイン後の遷移」） */
  target: string;
  /** 決まっていない観点。1つだけ（例: 「遷移先の画面」） */
  aspect: string;
};
