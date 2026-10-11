<?php

namespace Tests\Feature\Hidden;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Val001LoginHistoryAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $this->get('/settings/login-history')->assertRedirect(route('login'));
    }

    public function test_unverified_users_can_open_the_page(): void
    {
        $this->actingAs(User::factory()->unverified()->create())
            ->get('/settings/login-history')
            ->assertOk();
    }

    public function test_verified_users_can_open_the_page(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/settings/login-history')
            ->assertOk();
    }
}
