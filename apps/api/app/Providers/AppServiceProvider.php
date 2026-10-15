<?php

namespace App\Providers;

use App\Support\OrganizationContext;
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
    }
}
