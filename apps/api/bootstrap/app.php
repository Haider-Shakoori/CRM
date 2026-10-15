<?php

use App\Http\Middleware\RequireOrganizationWriteRole;
use App\Http\Middleware\ResolveOrganization;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum first-party SPA cookies require explicit stateful origins + CSRF.
        $middleware->statefulApi();
        $middleware->alias([
            'organization' => ResolveOrganization::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Laravel's default JSON 401/403/404/422 responses remain authoritative.
        // A typed API error adapter can be added when the full HTTP service contract lands.
    })
    ->create();
