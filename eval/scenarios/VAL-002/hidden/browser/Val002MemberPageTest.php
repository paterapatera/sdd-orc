<?php

use App\Models\User;

/** プロフィールの設定と同じ経路（PATCH /settings/profile）で自己紹介を保存する。保存の仕組み（列名など）には触れない */
function val002_save_bio(User $user, ?string $bio): void
{
    $data = ['name' => $user->name, 'email' => $user->email];
    if ($bio !== null) {
        $data['bio'] = $bio;
    }
    test()->actingAs($user)->patch('/settings/profile', $data);
}

function val002_text(mixed $page): string
{
    return (string) $page->script('document.body.innerText');
}

it('VAL-002: 名前、自己紹介（改行と HTML の文字のまま）、日本時間で数えた利用開始の月を表示し、メールアドレスは出さない', function () {
    $member = User::factory()->create([
        'name' => 'Member-Name',
        'email' => 'member-secret@example.com',
        'created_at' => now('UTC')->setDate(2026, 9, 30)->setTime(16, 0),
    ]);
    val002_save_bio($member, "Line-One\nLine-Two <b>Tag-Text</b>");

    $this->actingAs(User::factory()->create());

    $page = visit("/members/{$member->id}")
        ->assertSee('Member-Name')
        ->assertSee('2026年10月から利用')
        ->assertDontSee('2026年9月から利用')
        ->assertDontSee('member-secret@example.com');

    $text = val002_text($page);
    expect($text)->toMatch('/Line-One\n+Line-Two/')
        ->and($text)->toContain('<b>Tag-Text</b>');
});

it('VAL-002: 自己紹介が空なら「自己紹介はまだありません」と表示する', function () {
    $member = User::factory()->create();
    $this->actingAs(User::factory()->create());

    visit("/members/{$member->id}")->assertSee('自己紹介はまだありません');
});

it('VAL-002: bio を送らずに名前を保存しても、自己紹介は変わらない', function () {
    $member = User::factory()->create(['name' => 'Old-Name']);
    val002_save_bio($member, 'Keep-This-Bio');

    $this->actingAs($member)->patch('/settings/profile', ['name' => 'New-Name', 'email' => $member->email]);

    $this->actingAs(User::factory()->create());

    visit("/members/{$member->id}")
        ->assertSee('New-Name')
        ->assertSee('Keep-This-Bio');
});

it('VAL-002: 160文字の自己紹介は保存され、161文字は保存されない', function () {
    $ok = User::factory()->create();
    val002_save_bio($ok, str_repeat('ok', 80));
    $ng = User::factory()->create();
    val002_save_bio($ng, str_repeat('ng', 80).'x');

    $this->actingAs(User::factory()->create());

    visit("/members/{$ok->id}")->assertSee(str_repeat('ok', 80));
    visit("/members/{$ng->id}")->assertSee('自己紹介はまだありません');
});
