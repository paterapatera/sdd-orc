import { deepStrictEqual, ok, rejects } from "node:assert/strict";

export function assert(value: unknown, msg?: string): asserts value {
  ok(value, msg ?? "assertion failed");
}

export function assertFalse(value: unknown, msg?: string): void {
  ok(!value, msg ?? "expected a falsy value");
}

export function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  deepStrictEqual(actual, expected, msg ?? "values are not equal");
}

export function assertStringIncludes(actual: string, expected: string, msg?: string): void {
  ok(actual.includes(expected), msg ?? `Expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`);
}

export async function assertRejects(
  fn: () => Promise<unknown>,
  errorClass?: new (...args: never[]) => Error,
  msgIncludes?: string,
): Promise<void> {
  await rejects(fn, (err: unknown) => {
    if (errorClass && !(err instanceof errorClass)) return false;
    if (msgIncludes && (!(err instanceof Error) || !err.message.includes(msgIncludes))) return false;
    return true;
  });
}
