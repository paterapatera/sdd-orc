<?php

namespace Tests\Feature\Hidden;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Quick001EmailChangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_changing_the_email_marks_it_unverified(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch(route('profile.update'), ['name' => $user->name, 'email' => 'new-address@example.com'])
            ->assertSessionHasNoErrors();

        $this->assertNull($user->refresh()->email_verified_at);
    }

    public function test_pages_requiring_verification_redirect_to_the_notice_after_changing_the_email(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch(route('profile.update'), ['name' => $user->name, 'email' => 'new-address@example.com'])
            ->assertSessionHasNoErrors();

        $this->actingAs($user->refresh())
            ->get(route('security.edit'))
            ->assertRedirect(route('verification.notice'));
    }

    public function test_keeping_the_same_email_stays_verified(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch(route('profile.update'), ['name' => 'Renamed User', 'email' => $user->email])
            ->assertSessionHasNoErrors();

        $this->assertNotNull($user->refresh()->email_verified_at);
    }
}
