<?php

namespace Tests\Feature\Hidden;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Val002MemberAccessAndBioTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $member = User::factory()->create();

        $this->get("/members/{$member->id}")->assertRedirect(route('login'));
    }

    public function test_unverified_users_are_redirected_to_the_verification_notice(): void
    {
        $member = User::factory()->create();

        $this->actingAs(User::factory()->unverified()->create())
            ->get("/members/{$member->id}")
            ->assertRedirect(route('verification.notice'));
    }

    public function test_verified_users_can_open_a_member_page_and_unknown_ids_are_not_found(): void
    {
        $member = User::factory()->create();
        $viewer = User::factory()->create();

        $this->actingAs($viewer)->get("/members/{$member->id}")->assertOk();
        $this->actingAs($viewer)->get("/members/{$viewer->id}")->assertOk();
        $this->actingAs($viewer)->get('/members/999999')->assertNotFound();
    }

    public function test_a_bio_of_up_to_160_characters_can_be_saved_and_it_may_be_empty(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch('/settings/profile', ['name' => $user->name, 'email' => $user->email, 'bio' => str_repeat('あ', 160)])
            ->assertSessionHasNoErrors();

        $this->actingAs($user)
            ->patch('/settings/profile', ['name' => $user->name, 'email' => $user->email, 'bio' => ''])
            ->assertSessionHasNoErrors();
    }

    public function test_a_bio_over_160_characters_is_rejected_and_nothing_is_saved(): void
    {
        $user = User::factory()->create(['name' => 'Before-Name']);

        $this->actingAs($user)
            ->patch('/settings/profile', ['name' => 'After-Name', 'email' => $user->email, 'bio' => str_repeat('あ', 161)])
            ->assertSessionHasErrors('bio');

        $this->assertSame('Before-Name', $user->fresh()->name);
    }
}
