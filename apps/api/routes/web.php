<?php

use App\Http\Controllers\AuthController;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Browser session authentication only: call /sanctum/csrf-cookie before POSTing.
Route::prefix('api/v1/auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::middleware('auth:web')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/verification-notification', [AuthController::class, 'resendVerification'])
            ->middleware('throttle:6,1');
    });
});

Route::get('/email/verify/{id}/{hash}', function (EmailVerificationRequest $request) {
    $request->fulfill();
    return response()->json(['ok' => true, 'data' => ['verified' => true]]);
})->middleware(['auth:web', 'signed', 'throttle:6,1'])->name('verification.verify');
