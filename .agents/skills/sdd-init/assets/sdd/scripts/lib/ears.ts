import type { Ears } from "../../schema/mod.ts";

/** EARSの項目を日本語の文章に組み立てる（schema/requirements.ts の Ears の説明を参照） */
export function earsSentence(e: Ears): string {
  const s = e.subject ?? "システム";
  switch (e.pattern) {
    case "ubiquitous":
      return `${s}は${e.response}。`;
    case "event":
      return `${e.trigger}とき、${s}は${e.response}。`;
    case "state":
      return `${e.state}間、${s}は${e.response}。`;
    case "optional":
      return `${e.feature}場合、${s}は${e.response}。`;
    case "unwanted":
      return `もし${e.condition}ならば、${s}は${e.response}。`;
    case "complex":
      return `${e.state}間、${e.trigger}とき、${s}は${e.response}。`;
  }
}
