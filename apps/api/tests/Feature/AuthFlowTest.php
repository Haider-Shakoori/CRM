<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_browser_session_login_and_logout(): void
    {
        $user = User::create([
            'name' => 'Sales Person',
            'email' => 'sales@example.test',
            'password' => 'SecurePassword123!',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'sales@example.test', 'password' => 'wrong',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'sales@example.test', 'password' => 'SecurePassword123!',
        ])->assertOk()->assertJsonPath('data.user.id', $user->id);

        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.user.email', 'sales@example.test');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }
}
