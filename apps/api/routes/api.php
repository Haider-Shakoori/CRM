<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\CrmAccountController;
use App\Http\Controllers\CrmContactController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\AuditController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'ok' => true,
    'data' => ['service' => 'crm-api'],
]));

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/invitations/accept', [InvitationController::class, 'accept'])->middleware('verified');
    Route::middleware(['verified', 'organization'])->group(function () {
        Route::post('/organizations/invitations', [InvitationController::class, 'store']);
        Route::get('/organizations/usage', [AuditController::class, 'usage']);
        Route::get('/organizations/audit', [AuditController::class, 'index']);
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
        Route::get('/accounts', [CrmAccountController::class, 'index']);
        Route::get('/accounts/{id}', [CrmAccountController::class, 'show'])->whereUuid('id');
        Route::get('/contacts', [CrmContactController::class, 'index']);
        Route::get('/contacts/{id}', [CrmContactController::class, 'show'])->whereUuid('id');
        Route::get('/leads', [LeadController::class, 'index']);
        Route::get('/leads/{id}', [LeadController::class, 'show'])->whereUuid('id');
        Route::middleware('organization.write')->group(function () {
            Route::post('/accounts', [CrmAccountController::class, 'store']);
            Route::patch('/accounts/{id}', [CrmAccountController::class, 'update'])->whereUuid('id');
            Route::delete('/accounts/{id}', [CrmAccountController::class, 'destroy'])->whereUuid('id');
            Route::post('/contacts', [CrmContactController::class, 'store']);
            Route::patch('/contacts/{id}', [CrmContactController::class, 'update'])->whereUuid('id');
            Route::delete('/contacts/{id}', [CrmContactController::class, 'destroy'])->whereUuid('id');
            Route::post('/leads', [LeadController::class, 'store']);
            Route::patch('/leads/{id}', [LeadController::class, 'update'])->whereUuid('id');
            Route::put('/leads/{id}', [LeadController::class, 'update'])->whereUuid('id');
            Route::delete('/leads/{id}', [LeadController::class, 'destroy'])->whereUuid('id');
        });
    });
});
