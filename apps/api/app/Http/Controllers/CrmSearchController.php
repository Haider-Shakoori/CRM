<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class CrmSearchController
{
    /**
     * Search only the current membership-verified organization.
     * The Eloquent models enforce organization scoping even when this
     * endpoint is called without the normal web UI.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:120'],
            'per_type' => ['sometimes', 'integer', 'min:1', 'max:25'],
        ]);
        $term = trim($data['q']);
        if (mb_strlen($term) < 2) {
            throw ValidationException::withMessages([
                'q' => 'Enter at least 2 characters to search.',
            ]);
        }

        // Literal wildcard escaping prevents "%", "_" and backslash
        // input from becoming uncontrolled wildcard searches.
        $pattern = '%'.addcslashes($term, '%_\\').'%';
        $limit = (int) ($data['per_type'] ?? 10);

        $leads = Lead::query()->where(function ($query) use ($pattern) {
            $query->where('name', 'ilike', $pattern)->orWhere('email', 'ilike', $pattern);
        });
        $contacts = CrmContact::query()->where(function ($query) use ($pattern) {
            $query->where('first_name', 'ilike', $pattern)
                ->orWhere('last_name', 'ilike', $pattern)
                ->orWhere('email', 'ilike', $pattern)
                ->orWhere('phone', 'ilike', $pattern)
                ->orWhereRaw("CONCAT_WS(' ', first_name, last_name) ILIKE ?", [$pattern]);
        });
        $accounts = CrmAccount::query()->where('name', 'ilike', $pattern);
        $deals = CrmDeal::query()->where('name', 'ilike', $pattern);

        return response()->json(['ok' => true, 'data' => [
            'query' => $term,
            'per_type' => $limit,
            'groups' => [
                'leads' => $this->group($leads, $limit, fn ($lead) => [
                    'id' => $lead->id,
                    'title' => $lead->name,
                    'subtitle' => $lead->email ?? '',
                    'status' => $lead->status,
                ], 'name'),
                'contacts' => $this->group($contacts, $limit, fn ($contact) => [
                    'id' => $contact->id,
                    'title' => trim($contact->first_name.' '.$contact->last_name),
                    'subtitle' => $contact->email ?? $contact->phone ?? '',
                    'status' => null,
                ], 'last_name'),
                'accounts' => $this->group($accounts, $limit, fn ($account) => [
                    'id' => $account->id,
                    'title' => $account->name,
                    'subtitle' => '',
                    'status' => null,
                ], 'name'),
                'deals' => $this->group($deals, $limit, fn ($deal) => [
                    'id' => $deal->id,
                    'title' => $deal->name,
                    'subtitle' => $deal->currency,
                    'status' => null,
                ], 'name'),
            ],
        ]]);
    }

    private function group($query, int $limit, callable $format, string $orderColumn): array
    {
        $total = (clone $query)->count();
        $items = $query->orderBy($orderColumn)->orderBy('id')->limit($limit)
            ->get()->map($format)->values()->all();
        return [
            'items' => $items,
            'total' => $total,
            'has_more' => $total > count($items),
        ];
    }
}
