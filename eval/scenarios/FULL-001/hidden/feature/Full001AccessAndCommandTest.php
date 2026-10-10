<?php

namespace Tests\Feature\Hidden;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Testing\PendingCommand;
use Tests\TestCase;

class Full001AccessAndCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $this->get('/announcements')->assertRedirect(route('login'));
    }

    public function test_unverified_users_are_redirected_to_the_verification_notice(): void
    {
        $this->actingAs(User::factory()->unverified()->create())
            ->get('/announcements')
            ->assertRedirect(route('verification.notice'));
    }

    public function test_verified_users_can_open_the_list_and_the_second_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/announcements')->assertOk();
        $this->actingAs($user)->get('/announcements?page=2')->assertOk();
    }

    public function test_the_command_registers_an_announcement(): void
    {
        $this->create('Valid-Title-001', 'Valid-Body-001')->assertSuccessful();

        $this->actingAs(User::factory()->create())
            ->get('/announcements')
            ->assertSee('Valid-Title-001')
            ->assertSee('Valid-Body-001');
    }

    public function test_the_title_is_required_and_up_to_100_characters(): void
    {
        $this->create(str_repeat('t', 100), 'Body-Title-Max')->assertSuccessful();
        $this->create(str_repeat('t', 101), 'Body-Title-Over')->assertFailed();
        $this->create('', 'Body-Title-Empty')->assertFailed();

        $this->actingAs(User::factory()->create())
            ->get('/announcements')
            ->assertSee('Body-Title-Max')
            ->assertDontSee('Body-Title-Over')
            ->assertDontSee('Body-Title-Empty');
    }

    public function test_the_body_is_required_and_up_to_2000_characters(): void
    {
        $this->create('Title-Body-Max', str_repeat('b', 2000))->assertSuccessful();
        $this->create('Title-Body-Over', str_repeat('b', 2001))->assertFailed();
        $this->create('Title-Body-Empty', '')->assertFailed();

        $this->actingAs(User::factory()->create())
            ->get('/announcements')
            ->assertSee('Title-Body-Max')
            ->assertDontSee('Title-Body-Over')
            ->assertDontSee('Title-Body-Empty');
    }

    /** issue で約束したのは引数の順（タイトル、本文）だけなので、引数の名前はコマンドの定義から取る */
    private function create(string $title, string $body): PendingCommand
    {
        $command = Artisan::all()['announcement:create'] ?? null;
        $this->assertNotNull($command, 'announcement:create コマンドがありません');
        [$first, $second] = array_values(array_diff(array_keys($command->getDefinition()->getArguments()), ['command']));

        $pending = $this->artisan('announcement:create', [$first => $title, $second => $body]);
        $this->assertInstanceOf(PendingCommand::class, $pending);

        return $pending;
    }
}
