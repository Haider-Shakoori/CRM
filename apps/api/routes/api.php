<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\CrmAccountController;
use App\Http\Controllers\CrmContactController;
use App\Http\Controllers\CrmPipelineController;
use App\Http\Controllers\CrmDealController;
use App\Http\Controllers\CrmActivityController;
use App\Http\Controllers\CrmTimelineController;
use App\Http\Controllers\CrmReportingController;
use App\Http\Controllers\CrmForecastController;
use App\Http\Controllers\CrmLeadConversionController;
use App\Http\Controllers\CrmSubscriptionController;
use App\Http\Controllers\CrmStripeBillingController;
use App\Http\Controllers\CrmPlatformController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\AuditController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/billing/stripe/webhook', [CrmStripeBillingController::class, 'webhook'])->middleware('throttle:120,1');

Route::get('/health', fn () => response()->json([
    'ok' => true,
    'data' => ['service' => 'crm-api'],
]));

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/subscription/plans', [CrmSubscriptionController::class, 'catalog']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::middleware(['verified', 'platform.operator'])->prefix('platform')->group(function () {
        Route::get('/me', [CrmPlatformController::class, 'me']);
        Route::get('/plans', [CrmPlatformController::class, 'plans']);
        Route::get('/tenants', [CrmPlatformController::class, 'tenants']);
        Route::get('/tenants/{id}', [CrmPlatformController::class, 'tenant'])->whereUuid('id');
        Route::patch('/tenants/{id}/subscription', [CrmPlatformController::class, 'updateSubscription'])
            ->whereUuid('id')->middleware('platform.operator:write');
    });
    Route::post('/invitations/accept', [InvitationController::class, 'accept'])->middleware('verified');
    Route::middleware(['verified', 'organization'])->group(function () {
        Route::post('/organizations/invitations', [InvitationController::class, 'store']);
        Route::get('/organizations/usage', [AuditController::class, 'usage']);
        Route::get('/organizations/subscription', [CrmSubscriptionController::class, 'show']);
        Route::post('/organizations/billing/checkout', [CrmStripeBillingController::class, 'checkout'])->middleware('throttle:10,1');
        Route::post('/organizations/billing/portal', [CrmStripeBillingController::class, 'portal'])->middleware('throttle:10,1');
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
        Route::get('/reports/overview', [CrmReportingController::class, 'overview']);
        Route::get('/reports/pipelines', [CrmReportingController::class, 'pipelines']);
        Route::get('/reports/forecast', [CrmForecastController::class, 'index']);
        Route::get('/accounts', [CrmAccountController::class, 'index']);
        Route::get('/accounts/{id}', [CrmAccountController::class, 'show'])->whereUuid('id');
        Route::get('/contacts', [CrmContactController::class, 'index']);
        Route::get('/contacts/{id}', [CrmContactController::class, 'show'])->whereUuid('id');
        Route::get('/pipelines', [CrmPipelineController::class, 'index']);
        Route::get('/pipelines/{id}', [CrmPipelineController::class, 'show'])->whereUuid('id');
        Route::get('/deals', [CrmDealController::class, 'index']);
        Route::get('/deals/{id}', [CrmDealController::class, 'show'])->whereUuid('id');
        Route::get('/deals/{id}/events', [CrmDealController::class, 'events'])->whereUuid('id');
        Route::get('/timeline', [CrmTimelineController::class, 'index']);
        Route::get('/timeline/summary', [CrmTimelineController::class, 'summary']);
        Route::get('/notes/{id}', [CrmTimelineController::class, 'show'])->whereUuid('id');
        Route::get('/notes/{id}/events', [CrmTimelineController::class, 'events'])->whereUuid('id');
        Route::get('/activities/assignees', [CrmActivityController::class, 'assignees']);
        Route::get('/activities', [CrmActivityController::class, 'index']);
        Route::get('/activities/{id}', [CrmActivityController::class, 'show'])->whereUuid('id');
        Route::get('/activities/{id}/events', [CrmActivityController::class, 'events'])->whereUuid('id');
        Route::get('/leads', [LeadController::class, 'index']);
        Route::get('/leads/{id}', [LeadController::class, 'show'])->whereUuid('id');
        Route::get('/leads/{id}/conversion', [CrmLeadConversionController::class, 'show'])->whereUuid('id');
        Route::get('/leads/{id}/matches', [CrmLeadConversionController::class, 'matches'])->whereUuid('id');
        Route::middleware('organization.write')->group(function () {
            Route::post('/notes', [CrmTimelineController::class, 'store']);
            Route::patch('/notes/{id}', [CrmTimelineController::class, 'update'])->whereUuid('id');
            Route::delete('/notes/{id}', [CrmTimelineController::class, 'destroy'])->whereUuid('id');
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
            Route::post('/leads/{id}/convert', [CrmLeadConversionController::class, 'store'])->whereUuid('id');
            Route::patch('/pipelines/{id}/stages/{stageId}/probability', [CrmPipelineController::class, 'updateStageProbability'])->whereUuid('id')->whereUuid('stageId');
            Route::post('/leads', [LeadController::class, 'store']);
            Route::patch('/leads/{id}', [LeadController::class, 'update'])->whereUuid('id');
            Route::put('/leads/{id}', [LeadController::class, 'update'])->whereUuid('id');
            Route::delete('/leads/{id}', [LeadController::class, 'destroy'])->whereUuid('id');
        });
    });
});
