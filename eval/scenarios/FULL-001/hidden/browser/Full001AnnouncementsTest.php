<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;

/** issue で約束したのは引数の順（タイトル、本文）だけなので、引数の名前はコマンドの定義から取る */
function full001_create(string $title, string $body): void
{
    $command = Artisan::all()['announcement:create'] ?? null;
    expect($command)->not->toBeNull();
    [$first, $second] = array_values(array_diff(array_keys($command->getDefinition()->getArguments()), ['command']));

    test()->artisan('announcement:create', [$first => $title, $second => $body])->assertSuccessful();
}

function full001_text(mixed $page): string
{
    return (string) $page->script('document.body.innerText');
}

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 10)->setTime(9, 0));
});

it('FULL-001: 一覧は新しい順に、タイトル・本文・登録日を表示する', function () {
    full001_create('Older-Title', 'Older-Body');
    $this->travel(1)->minutes();
    full001_create('Newer-Title', 'Newer-Body');
    $this->actingAs(User::factory()->create());

    $text = full001_text(visit('/announcements')->assertSee('Newer-Body')->assertSee('2026-10-10'));

    expect(strpos($text, 'Newer-Title'))->toBeInt()
        ->and(strpos($text, 'Older-Title'))->toBeInt()
        ->and(strpos($text, 'Newer-Title'))->toBeLessThan(strpos($text, 'Older-Title'));
});

it('FULL-001: 本文の改行は改行のまま、HTML のタグは文字のまま表示する', function () {
    full001_create('Format-Title', "Line-One\nLine-Two <b>Tag-Text</b>");
    $this->actingAs(User::factory()->create());

    $text = full001_text(visit('/announcements')->assertSee('Format-Title'));

    expect($text)->toMatch('/Line-One\n+Line-Two/')
        ->and($text)->toContain('<b>Tag-Text</b>');
});

it('FULL-001: 一覧は20件ずつで、2ページ目は ?page=2 で開ける', function () {
    foreach (range(1, 25) as $i) {
        full001_create(sprintf('Notice-%02d', $i), sprintf('Body-%02d', $i));
        $this->travel(1)->minutes();
    }
    $this->actingAs(User::factory()->create());

    visit('/announcements')
        ->assertSee('Notice-25')
        ->assertSee('Notice-06')
        ->assertDontSee('Notice-05');

    visit('/announcements?page=2')
        ->assertSee('Notice-05')
        ->assertSee('Notice-01')
        ->assertDontSee('Notice-06');
});

it('FULL-001: ダッシュボードに新しい順の3件と登録日を表示し、サイドバーから一覧を開ける', function () {
    foreach (['Dash-1', 'Dash-2', 'Dash-3', 'Dash-4'] as $title) {
        full001_create($title, $title.'-Body');
        $this->travel(1)->minutes();
    }
    $this->actingAs(User::factory()->create());

    $page = visit('/dashboard')
        ->assertSee('Dash-4')
        ->assertSee('Dash-3')
        ->assertSee('Dash-2')
        ->assertDontSee('Dash-1')
        ->assertSee('2026-10-10');

    $text = full001_text($page);
    expect(strpos($text, 'Dash-4'))->toBeLessThan(strpos($text, 'Dash-2'));

    $hasMenu = $page->script(
        "[...document.querySelectorAll('a')].some((a) => a.textContent.includes('お知らせ') && new URL(a.href).pathname === '/announcements')",
    );
    expect($hasMenu)->toBeTrue();
});

it('FULL-001: お知らせが無いときは、一覧とダッシュボードに「お知らせはありません」と表示する', function () {
    $this->actingAs(User::factory()->create());

    visit('/announcements')->assertSee('お知らせはありません');
    visit('/dashboard')->assertSee('お知らせはありません');
});
