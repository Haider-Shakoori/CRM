<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

final class AuthController
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:254'],
            'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()],
            'organization_name' => ['required', 'string', 'max:150'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'locale' => ['sometimes', 'string', 'max:16'],
            'timezone' => ['sometimes', 'timezone'],
            'tenant_id' => ['prohibited'],
            'organization_id' => ['prohibited'],
        ]);

        $email = Str::lower(trim($data['email']));
        if (User::where('email', $email)->exists()) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'duplicate', 'message' => 'An account with this email already exists.', 'retryable' => false,
            ]], 422);
        }

        [$user, $organization] = DB::transaction(function () use ($data, $email): array {
            $user = User::create([
                'name' => $data['name'], 'email' => $email, 'password' => $data['password'],
            ]);
            $slug = Str::slug($data['organization_name']).'-'.Str::lower(Str::random(10));
            $tenant = Tenant::create([
                'name' => $data['organization_name'], 'slug' => $slug, 'status' => 'active',
            ]);
            $organization = Organization::create([
                'tenant_id' => $tenant->id,
                'name' => $data['organization_name'], 'slug' => $slug, 'status' => 'active',
                'currency' => Str::upper($data['currency'] ?? 'USD'),
                'locale' => $data['locale'] ?? 'en',
                'timezone' => $data['timezone'] ?? 'UTC',
            ]);
            OrganizationMembership::create([
                'organization_id' => $organization->id, 'user_id' => $user->id,
                'role' => 'owner', 'status' => 'active',
            ]);
            return [$user, $organization];
        });

        $user->sendEmailVerificationNotification();
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json(['ok' => true, 'data' => [
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'email_verified' => false],
            'organization' => ['id' => $organization->id, 'name' => $organization->name],
            'email_verification_required' => true,
        ]], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::guard('web')->attempt([
            'email' => Str::lower(trim($data['email'])),
            'password' => $data['password'],
        ])) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'unauthenticated', 'message' => 'Invalid email or password.', 'retryable' => false,
            ]], 422);
        }

        $request->session()->regenerate();
        $user = Auth::guard('web')->user();

        return response()->json(['ok' => true, 'data' => [
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email,
                'email_verified' => $user->hasVerifiedEmail()],
        ]]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        // Also drop any resolved Sanctum guard state in persistent/test runtimes.
        Auth::forgetGuards();

        return response()->json(['ok' => true, 'data' => ['logged_out' => true]]);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        if (!$request->user()->hasVerifiedEmail()) {
            $request->user()->sendEmailVerificationNotification();
        }
        return response()->json(['ok' => true, 'data' => ['queued' => true]], 202);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:254']]);
        // Never reveal whether an account exists.
        PasswordBroker::broker()->sendResetLink(['email' => Str::lower(trim($data['email']))]);
        return response()->json(['ok' => true, 'data' => [
            'message' => 'If this email has an account, recovery instructions will be sent.',
        ]], 202);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', \Illuminate\Validation\Rules\Password::min(12)->letters()->numbers()],
        ]);
        $data['email'] = Str::lower(trim($data['email']));
        $status = PasswordBroker::broker()->reset($data, function (User $user, string $password): void {
            $user->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();
            $user->tokens()->delete();
            event(new PasswordReset($user));
        });

        if ($status !== PasswordBroker::PASSWORD_RESET) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'validation_failed',
                'message' => 'The password recovery token is invalid or expired.',
                'retryable' => false,
            ]], 422);
        }

        return response()->json(['ok' => true, 'data' => ['password_reset' => true]]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        // Only active memberships and organizations belonging to active tenants are exposed.
        $organizations = $user->memberships()->where('status', 'active')
            ->with('organization.tenant')
            ->get()
            ->filter(fn ($membership) => $membership->organization?->status === 'active'
                && $membership->organization->tenant?->status === 'active')
            ->map(fn ($membership) => [
                'id' => $membership->organization->id,
                'name' => $membership->organization->name,
                'role' => $membership->role,
                'currency' => $membership->organization->currency,
                'locale' => $membership->organization->locale,
                'timezone' => $membership->organization->timezone,
            ])->values()->all();

        return response()->json(['ok' => true, 'data' => [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'email_verified' => $user->hasVerifiedEmail(),
            ],
            'organizations' => $organizations,
        ]]);
    }
}
