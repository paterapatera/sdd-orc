<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;

/** ログインの画面と同じ経路（POST /login）でログインし、すぐにログアウトする。記録の仕組み（テーブル名など）には触れない */
function val001_login(User $user, string $password = 'password'): void
{
    test()->post(route('login.store'), ['email' => $user->email, 'password' => $password]);
    Auth::guard('web')->logout();
    test()->flushSession();
}

function val001_text(mixed $page): string
{
    return (string) $page->script('document.body.innerText');
}

it('VAL-001: ログインした日時を日本時間の「年-月-日 時:分」で、IP アドレスと一緒に表示する。失敗したログインは出さない', function () {
    $user = User::factory()->create();

    $this->travelTo(now('UTC')->setDate(2026, 10, 10)->setTime(15, 20));
    val001_login($user, 'wrong-password');
    $this->travelTo(now('UTC')->setDate(2026, 10, 10)->setTime(15, 30));
    val001_login($user);

    $this->actingAs($user);

    visit('/settings/login-history')
        ->assertSee('2026-10-11 00:30')
        ->assertSee('127.0.0.1')
        ->assertDontSee('2026-10-11 00:20');
});

it('VAL-001: 新しい順に10件だけ表示する', function () {
    $user = User::factory()->create();
    foreach (range(1, 12) as $minute) {
        $this->travelTo(now('UTC')->setDate(2026, 10, 10)->setTime(0, $minute));
        val001_login($user);
    }

    $this->actingAs($user);

    $page = visit('/settings/login-history')
        ->assertSee('2026-10-10 09:12')
        ->assertSee('2026-10-10 09:03')
        ->assertDontSee('2026-10-10 09:02')
        ->assertDontSee('2026-10-10 09:01');

    $text = val001_text($page);
    expect(strpos($text, '2026-10-10 09:12'))->toBeLessThan(strpos($text, '2026-10-10 09:03'));
});

it('VAL-001: 2段階認証は、確認のコードまで済ませたときにだけ記録する', function () {
    $user = User::factory()->withTwoFactor()->create();

    $this->travelTo(now('UTC')->setDate(2026, 10, 10)->setTime(0, 0));
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('two-factor.login'));

    $this->travelTo(now('UTC')->setDate(2026, 10, 10)->setTime(0, 5));
    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1']);
    $this->assertAuthenticatedAs($user);
    Auth::guard('web')->logout();
    $this->flushSession();

    $this->actingAs($user);

    visit('/settings/login-history')
        ->assertSee('2026-10-10 09:05')
        ->assertDontSee('2026-10-10 09:00');
});

it('VAL-001: ほかの利用者のログインは表示しない', function () {
    $other = User::factory()->create();
    $me = User::factory()->create();

    $this->travelTo(now('UTC')->setDate(2026, 10, 10)->setTime(1, 0));
    val001_login($other);
    $this->travelTo(now('UTC')->setDate(2026, 10, 10)->setTime(2, 0));
    val001_login($me);

    $this->actingAs($me);

    visit('/settings/login-history')
        ->assertSee('2026-10-10 11:00')
        ->assertDontSee('2026-10-10 10:00');
});

it('VAL-001: 記録が無いときは「ログイン履歴はありません」と表示し、設定のメニューから開ける', function () {
    $this->actingAs(User::factory()->create());

    $page = visit('/settings/profile');
    $hasMenu = $page->script(
        "[...document.querySelectorAll('a')].some((a) => a.textContent.includes('ログイン履歴') && new URL(a.href).pathname === '/settings/login-history')",
    );
    expect($hasMenu)->toBeTrue();

    visit('/settings/login-history')->assertSee('ログイン履歴はありません');
});
