<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_does_not_enumerate_users_and_resets_password_with_one_time_token(): void
    {
        Notification::fake();
        $user = User::create([
            'name' => 'Recovery User', 'email' => 'recover@example.test',
            'password' => 'OriginalPassword123!',
        ]);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'absent@example.test'])
            ->assertStatus(202);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])
            ->assertStatus(202);
        Notification::assertSentTo($user, ResetPassword::class);

        $token = '';
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use (&$token) {
            $token = $notification->token;
            return true;
        });

        $this->assertNotSame('', $token);
        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => 'definitely-wrong-token',
            'password' => 'ReplacementPassword123!',
            'password_confirmation' => 'ReplacementPassword123!',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'ReplacementPassword123!',
            'password_confirmation' => 'ReplacementPassword123!',
        ])->assertOk()->assertJsonPath('data.password_reset', true);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'AnotherPassword123!',
            'password_confirmation' => 'AnotherPassword123!',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'OriginalPassword123!',
        ])->assertStatus(422);
        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'ReplacementPassword123!',
        ])->assertOk();
    }
}
