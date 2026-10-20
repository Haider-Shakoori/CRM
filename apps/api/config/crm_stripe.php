<?php

return [
    // Never enabled merely by adding credentials. Operators must explicitly opt in.
    'enabled' => (bool) env('CRM_STRIPE_ENABLED', false),
    'mode' => env('CRM_STRIPE_MODE', 'test'),
    'secret' => env('CRM_STRIPE_SECRET_KEY'),
    'webhook_secret' => env('CRM_STRIPE_WEBHOOK_SECRET'),
    'return_url' => env('CRM_STRIPE_RETURN_URL', 'http://localhost:5173/crm/subscription'),
    // Configure Price IDs ONLY after creating recurring Prices in Stripe's test mode.
    'prices' => [
        'team' => env('CRM_STRIPE_PRICE_TEAM'),
        'business' => env('CRM_STRIPE_PRICE_BUSINESS'),
    ],
];
