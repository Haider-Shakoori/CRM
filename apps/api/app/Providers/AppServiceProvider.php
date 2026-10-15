<?php

namespace App\Providers;

use App\Support\OrganizationContext;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Request/job-local. Never persist current tenant in a singleton or static variable.
        $this->app->scoped(OrganizationContext::class, fn () => new OrganizationContext);
    }

    public function boot(): void
    {
        // Frontend UX renders the reset form; the password token is validated by this API.
        ResetPassword::createUrlUsing(fn (object $user, string $token): string =>
            rtrim((string) config('app.frontend_url'), '/').'/reset-password?token='
            .rawurlencode($token).'&email='.rawurlencode((string) $user->getEmailForPasswordReset())
        );
    }
}
