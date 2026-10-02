import { defineDesign } from "../../sdd/schema/mod.ts";
import type requirements from "./requirements.ts";

export default defineDesign<typeof requirements>()({
  overview: "ログインの失敗回数をDBに記録し、しきい値を超えたらロック解除時刻を設定する。",
  asIs: "AuthService.login はパスワードを照合して結果を返すだけで、失敗回数は記録していない。",
  toBe: "AuthService.login が照合の前にロック状態を確認し、失敗時は LoginAttemptRepository に記録する。ロックの判定は LockoutPolicy に切り出す。",
  components: {
    AuthService: {
      kind: "modified",
      responsibility: "ログインの受付と、ロック状態の確認",
      files: ["src/auth/auth_service.py"],
      asIs: "パスワードの照合だけを行う",
    },
    LockoutPolicy: {
      kind: "new",
      responsibility: "失敗回数からロックするかどうかと、ロック解除の時刻を決める",
      files: ["src/auth/lockout_policy.py"],
    },
    LoginAttemptRepository: {
      kind: "new",
      responsibility: "失敗回数とロック解除の時刻を保存する",
      files: ["src/auth/login_attempt_repository.py"],
    },
  },
  dependencies: [
    { from: "AuthService", to: "LockoutPolicy", label: "判定" },
    { from: "AuthService", to: "LoginAttemptRepository", label: "記録" },
  ],
  interfaces: {
    evaluate: {
      component: "LockoutPolicy",
      kind: "function",
      change: "new",
      signature: "def evaluate(failed_count: int, now: datetime) -> datetime | None",
      description: "ロックする場合はロック解除の時刻を、しない場合は None を返す",
    },
  },
  dataModels: {
    login_attempts: {
      kind: "new",
      description: "アカウントごとの失敗回数とロック解除の時刻",
      definition:
        "CREATE TABLE login_attempts (account_id BIGINT PRIMARY KEY, failed_count INT NOT NULL, locked_until TIMESTAMP NULL);",
    },
  },
  errorHandling: [
    {
      case: "ロック中のアカウントでログインされた",
      handling: "パスワードを照合せずに拒否し、ロック中であることを示す応答を返す",
      refs: ["AC-003"],
    },
    {
      case: "login_attempts への書き込みに失敗した",
      handling: "ログインは失敗として扱い、エラーをログに記録する",
    },
  ],
  impact: {
    create: ["src/auth/lockout_policy.py", "src/auth/login_attempt_repository.py", "migrations/0042_login_attempts.sql"],
    modify: ["src/auth/auth_service.py"],
  },
  decisions: [
    {
      title: "失敗回数の保存先",
      decidedBy: "ai",
      context: "失敗回数を複数のAPIサーバーで共有する必要がある",
      decision: "既存のPostgreSQLにテーブルを追加する",
      alternatives: [{ option: "Redis", reason: "現在の構成に無く、運用の負担が増えるため" }],
      adr: false,
    },
  ],
  traceability: {
    "FR-001": ["LockoutPolicy", "LoginAttemptRepository"],
    "FR-002": ["AuthService"],
    "NFR-001": ["LoginAttemptRepository"],
  },
  nfrStrategy: {
    "NFR-001": "login_attempts は account_id を主キーにし、ログインごとの読み書きを主キーでの1回ずつに抑える",
  },
  invariantStrategy: {
    "INV-001": "AuthService の応答の組み立て部分には手を入れず、ロック中の拒否は新しい分岐として追加する",
  },
  conventionsCompliance: {},
  checklist: {
    conventions: { result: "considered", note: "既存の src/auth/ のリポジトリの作り方（UserRepository）に合わせた" },
    security: { result: "considered", note: "ロック中はパスワードを照合しない（照合の結果から情報を漏らさない）" },
    dataIntegrity: { result: "considered", note: "失敗回数の加算は UPDATE ... SET failed_count = failed_count + 1 で行い、同時ログインでも数え漏れない" },
    performance: { result: "considered", note: "主キーでの読み書きだけ（nfrStrategy）" },
    observability: { result: "considered", note: "ロックした時点で、アカウントIDと解除時刻をログに出す" },
    testability: { result: "considered", note: "LockoutPolicy は時刻を引数で受け取る純粋な関数にした" },
    rollback: { result: "considered", note: "テーブルの追加だけなので、マイグレーションを戻せば元に戻る" },
    sharedFiles: { result: "considered", note: "共有ファイルの変更は auth_service.py だけ" },
  },
});
