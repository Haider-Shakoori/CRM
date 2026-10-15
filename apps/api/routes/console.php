<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('crm:health', function () {
    $this->info('CRM API bootstrap is available.');
})->purpose('Verify the API command runtime');
