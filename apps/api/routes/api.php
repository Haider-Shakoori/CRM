<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\CrmAccountController;
use App\Http\Controllers\CrmContactController;
use App\Http\Controllers\CrmPipelineController;
use App\Http\Controllers\CrmDealController;
use App\Http\Controllers\CrmActivityController;
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
        Route::get('/pipelines', [CrmPipelineController::class, 'index']);
        Route::get('/pipelines/{id}', [CrmPipelineController::class, 'show'])->whereUuid('id');
        Route::get('/deals', [CrmDealController::class, 'index']);
        Route::get('/deals/{id}', [CrmDealController::class, 'show'])->whereUuid('id');
        Route::get('/deals/{id}/events', [CrmDealController::class, 'events'])->whereUuid('id');
        Route::get('/activities/assignees', [CrmActivityController::class, 'assignees']);
        Route::get('/activities', [CrmActivityController::class, 'index']);
        Route::get('/activities/{id}', [CrmActivityController::class, 'show'])->whereUuid('id');
        Route::get('/activities/{id}/events', [CrmActivityController::class, 'events'])->whereUuid('id');
        Route::get('/leads', [LeadController::class, 'index']);
        Route::get('/leads/{id}', [LeadController::class, 'show'])->whereUuid('id');
        Route::middleware('organization.write')->group(function () {
            Route::post('/accounts', [CrmAccountController::class, 'store']);
            Route::patch('/accounts/{id}', [CrmAccountController::class, 'update'])->whereUuid('id');
            Route::delete('/accounts/{id}', [CrmAccountController::class, 'destroy'])->whereUuid('id');
            Route::post('/contacts', [CrmContactController::class, 'store']);
            Route::patch('/contacts/{id}', [CrmContactController::class, 'update'])->whereUuid('id');
            Route::delete('/contacts/{id}', [CrmContactController::class, 'destroy'])->whereUuid('id');
            Route::post('/pipelines', [CrmPipelineController::class, 'store']);
            Route::post('/pipelines/{id}/stages', [CrmPipelineController::class, 'addStage'])->whereUuid('id');
            Route::post('/deals', [CrmDealController::class, 'store']);
            Route::patch('/deals/{id}', [CrmDealController::class, 'update'])->whereUuid('id');
            Route::post('/deals/{id}/move', [CrmDealController::class, 'move'])->whereUuid('id');
            Route::delete('/deals/{id}', [CrmDealController::class, 'destroy'])->whereUuid('id');
            Route::post('/activities', [CrmActivityController::class, 'store']);
            Route::patch('/activities/{id}', [CrmActivityController::class, 'update'])->whereUuid('id');
            Route::delete('/activities/{id}', [CrmActivityController::class, 'destroy'])->whereUuid('id');
            Route::post('/leads', [LeadController::class, 'store']);
            Route::patch('/leads/{id}', [LeadController::class, 'update'])->whereUuid('id');
            Route::put('/leads/{id}', [LeadController::class, 'update'])->whereUuid('id');
            Route::delete('/leads/{id}', [LeadController::class, 'destroy'])->whereUuid('id');
        });
    });
});
