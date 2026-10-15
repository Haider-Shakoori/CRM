<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LeadController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'ok' => true,
    'data' => ['service' => 'crm-api'],
]));

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::middleware(['verified', 'organization'])->group(function () {
        Route::get('/organizations/current', function (Request $request) {
            $organization = $request->attributes->get('crm_organization');
            return response()->json(['ok' => true, 'data' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'currency' => $organization->currency,
                'locale' => $organization->locale,
                'timezone' => $organization->timezone,
            ]]);
        });
        Route::get('/leads', [LeadController::class, 'index']);
        Route::get('/leads/{id}', [LeadController::class, 'show']);
        Route::middleware('organization.write')->group(function () {
            Route::post('/leads', [LeadController::class, 'store']);
            Route::patch('/leads/{id}', [LeadController::class, 'update']);
            Route::put('/leads/{id}', [LeadController::class, 'update']);
            Route::delete('/leads/{id}', [LeadController::class, 'destroy']);
        });
    });
});
