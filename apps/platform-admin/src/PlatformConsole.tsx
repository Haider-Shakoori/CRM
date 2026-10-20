import * as React from 'react';
import { ArrowLeft, Building2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Badge, Button, Container } from '@crm/ui';

type Operator = { id: string; name: string; role: 'viewer' | 'operator' };
type TenantRow = {
  id: string; name: string; slug: string; status: string;
  subscription_version: number | null; subscription_status: string | null;
  plan: string | null; created_at: string;
};
type Page<T> = { items: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean } };
type Plan = { code: string; name: string; public: boolean; limits: Record<string, number | null> };
type Subscription = {
  id: string | null; plan: string; plan_name: string;
  status: string; version: number; period_ends_at: string | null;
  cancel_at_period_end: boolean; limits: Record<string, number | null>;
};
type Detail = {
  tenant: { id: string; name: string; slug: string; status: string; created_at: string };
  subscription: Subscription;
  usage: Record<string, number>;
  organizations: Array<{ id: string; name: string; status: string }>;
  subscription_events: Array<{ id: string; action: string; source: string; created_at: string }>;
  platform_events: Array<{ id: string; action: string; actor_user_id: string; created_at: string }>;
  billing_connected: boolean;
};
type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

const API = ((import.meta.env.VITE_CRM_API_URL as string | undefined) ?? '').replace(/\/+$/, '');
const crmUrl = import.meta.env.VITE_CRM_URL ?? 'http://localhost:5173';
const err = (cause: unknown) => cause instanceof Error ? cause.message : 'A request failed.';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
  const xsrf = csrf ? decodeURIComponent(csrf.substring('XSRF-TOKEN='.length)) : undefined;
  const response = await fetch(API + '/api/v1' + path, {
    ...options, credentials: 'include',
    headers: {
      Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' && xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
      ...options.headers,
    },
  });
  const json = await response.json() as Envelope<T>;
  if (!response.ok || !json.ok || json.data === undefined) {
    throw new Error(json.error?.message ?? 'Request rejected (' + response.status + ').');
  }
  return json.data;
}

const displayDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'None';
const levels = ['active', 'trialing', 'past_due', 'canceled', 'expired'] as const;

export function PlatformConsole() {
  const [operator, setOperator] = React.useState<Operator | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [revision, setRevision] = React.useState(0);
  const [tenants, setTenants] = React.useState<Page<TenantRow> | null>(null);
  const [selected, setSelected] = React.useState('');
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [draft, setDraft] = React.useState({
    plan_code: '', status: 'active', period_ends_at: '', cancel_at_period_end: false,
  });
  const [acknowledge, setAcknowledge] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');

  React.useEffect(() => {
    let live = true;
    void request<Operator>('/platform/me').then((data) => {
      if (live) { setOperator(data); setError(''); }
    }).catch((cause: unknown) => { if (live) setError(err(cause)); })
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, []);

  React.useEffect(() => {
    if (!operator) return;
    let live = true;
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (query.trim()) params.set('q', query.trim());
    void Promise.all([request<Page<TenantRow>>('/platform/tenants?' + params),
      request<Plan[]>('/platform/plans')]).then(([rows, available]) => {
      if (live) { setTenants(rows); setPlans(available); setError(''); }
    }).catch((cause: unknown) => { if (live) setError(err(cause)); });
    return () => { live = false; };
  }, [operator, page, query, revision]);

  React.useEffect(() => {
    if (!operator || !selected) return;
    let live = true;
    void request<Detail>('/platform/tenants/' + encodeURIComponent(selected)).then((data) => {
      if (!live) return;
      setDetail(data); setError('');
      setDraft({
        plan_code: data.subscription.plan, status: data.subscription.status,
        period_ends_at: data.subscription.period_ends_at
          ? new Date(data.subscription.period_ends_at).toISOString().slice(0, 16) : '',
        cancel_at_period_end: data.subscription.cancel_at_period_end,
      });
      setAcknowledge(false);
    }).catch((cause: unknown) => { if (live) setError(err(cause)); });
    return () => { live = false; };
  }, [selected, operator, revision]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || operator?.role !== 'operator' || !acknowledge || busy) return;
    if ((draft.status === 'trialing' || draft.cancel_at_period_end) && !draft.period_ends_at) {
      setError('An end date is required for trials and scheduled cancellations.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await fetch(API + '/sanctum/csrf-cookie', { credentials: 'include' });
      await request('/platform/tenants/' + encodeURIComponent(detail.tenant.id) + '/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          ...draft, expected_version: detail.subscription.version,
          period_ends_at: draft.period_ends_at ? new Date(draft.period_ends_at).toISOString() : null,
          acknowledge_manual_change: true,
        }),
      });
      setNotice('Manual entitlement change saved and audited. No payment was processed.');
      setRevision((value) => value + 1);
    } catch (cause) { setError(err(cause)); }
    finally { setBusy(false); }
  };

  return <div className="min-h-dvh bg-canvas">
    <header className="border-b border-border-subtle bg-surface">
      <Container width="wide" className="flex flex-wrap items-center gap-4 py-4">
        <ShieldCheck className="size-6 text-brand-fg" aria-hidden="true"/>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Platform Operations</h1>
          <p className="text-xs text-muted">Verified operators only · CRM SaaS administration · No payment integration</p>
        </div>
        <Button variant="secondary" size="sm" asChild><a href={crmUrl + '/api-sign-in'}>CRM sign-in</a></Button>
      </Container>
    </header>
    <main>
      <Container width="wide" className="space-y-6 py-8">
        {checking ? <p role="status">Checking platform authorization…</p>
          : !operator ? <section className="max-w-xl space-y-3 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">Restricted platform console</h2>
            <p role="alert">{error || 'No platform operator access. Contact an authorized system operator.'}</p>
            <p className="text-sm text-muted">Tenant owner and administrator roles do not grant platform privileges.
              You must sign in with a verified account explicitly granted platform access by a server operator.</p>
          </section>
            : <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Tenant Administration</h2>
                  <p className="text-sm text-muted">Signed in: {operator.name} · Role: {operator.role}</p>
                </div>
                <Badge variant="outline">Live PostgreSQL data</Badge>
              </div>
              {error && <p role="alert" className="rounded border border-red-500 p-3 text-sm text-red-600">{error}</p>}
              {notice && <p role="status" className="rounded border p-3 text-sm">{notice}</p>}
              {!selected ? <section className="space-y-4">
                <form className="flex flex-wrap gap-3" onSubmit={(e) => {
                  e.preventDefault(); setPage(1); setQuery(search);
                }}>
                  <label className="flex max-w-md flex-1 items-center gap-2 rounded border bg-surface px-3">
                    <Search className="size-4" aria-hidden="true"/>
                    <span className="sr-only">Search tenants</span>
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent py-2 outline-none" placeholder="Search tenants"/>
                  </label>
                  <Button variant="secondary" size="sm">Search</Button>
                  <Button variant="secondary" size="sm" onClick={() => setRevision((value) => value + 1)}
                    type="button"><RefreshCw className="size-4" aria-hidden="true"/> Refresh</Button>
                </form>
                {!tenants ? <p role="status">Loading tenants…</p> : <>
                  <p className="text-sm text-muted">{tenants.meta.total} tenant records</p>
                  <div className="overflow-x-auto rounded-xl border bg-surface">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b"><th className="p-3">Tenant</th><th className="p-3">Status</th>
                        <th className="p-3">Plan</th><th className="p-3">Subscription</th><th className="p-3">Action</th></tr></thead>
                      <tbody>{tenants.items.map((tenant) => <tr key={tenant.id} className="border-b">
                        <td className="p-3"><strong>{tenant.name}</strong><div className="text-xs text-muted">{tenant.slug}</div></td>
                        <td className="p-3">{tenant.status}</td><td className="p-3">{tenant.plan ?? 'Not configured'}</td>
                        <td className="p-3">{tenant.subscription_status ?? 'Not configured'}</td>
                        <td className="p-3"><button type="button" className="underline"
                          onClick={() => { setDetail(null); setSelected(tenant.id); setNotice(''); }}>
                          Manage</button></td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <Button type="button" variant="secondary" size="sm" disabled={page <= 1}
                      onClick={() => setPage((value) => value - 1)}>Previous</Button>
                    <span>Page {page} of {Math.max(1, tenants.meta.totalPages)}</span>
                    <Button type="button" variant="secondary" size="sm" disabled={!tenants.meta.hasNext}
                      onClick={() => setPage((value) => value + 1)}>Next</Button>
                  </div>
                </>}
              </section> : <>
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  setSelected(''); setDetail(null); setNotice(''); setRevision((value) => value + 1);
                }}><ArrowLeft className="size-4" aria-hidden="true"/> All tenants</Button>
                {!detail || detail.tenant.id !== selected ? <p role="status">Loading tenant details…</p> : <>
                  <section className="space-y-3 rounded-xl border bg-surface p-5">
                    <h3 className="text-xl font-semibold">{detail.tenant.name}</h3>
                    <p className="text-sm text-muted">Tenant status: {detail.tenant.status} · Plan: {detail.subscription.plan_name}</p>
                    <p className="text-sm">Subscription status: {detail.subscription.status} · Version {detail.subscription.version}</p>
                    <p className="text-sm text-muted">Period end: {displayDate(detail.subscription.period_ends_at)}</p>
                    <p className="text-sm font-medium">Billing integration: Not connected</p>
                  </section>
                  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(detail.usage).map(([key, used]) => <article className="rounded-xl border p-4" key={key}>
                      <p className="text-sm capitalize">{key}</p>
                      <p className="text-2xl font-semibold tabular-nums">{used.toLocaleString()}</p>
                      <p className="text-xs text-muted">Limit: {detail.subscription.limits[key] ?? 'Unmetered'}</p>
                    </article>)}
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-lg font-semibold">Organizations</h3>
                    <ul className="space-y-2">{detail.organizations.map((org) =>
                      <li key={org.id} className="flex gap-2 rounded border p-3 text-sm">
                        <Building2 className="size-4" aria-hidden="true"/>{org.name} ({org.status})
                      </li>)}</ul>
                  </section>
                  {operator.role === 'operator' && <form className="max-w-xl space-y-4 rounded-xl border p-5"
                    onSubmit={(e) => { void save(e); }}>
                    <h3 className="text-lg font-semibold">Manual subscription action</h3>
                    <p className="text-sm text-muted">Authorized operator override only. No Stripe billing, payment verification or invoice is performed.</p>
                    <label className="block text-sm">Plan
                      <select className="mt-1 block w-full rounded border p-2" value={draft.plan_code}
                        onChange={(e) => setDraft((old) => ({ ...old, plan_code: e.target.value }))}>
                        {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm">Subscription status
                      <select className="mt-1 block w-full rounded border p-2" value={draft.status}
                        onChange={(e) => setDraft((old) => ({ ...old, status: e.target.value }))}>
                        {levels.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm">Period end (optional unless trial/cancellation scheduled)
                      <input type="datetime-local" className="mt-1 block w-full rounded border p-2"
                        value={draft.period_ends_at}
                        onChange={(e) => setDraft((old) => ({ ...old, period_ends_at: e.target.value }))}/>
                    </label>
                    <label className="flex gap-2 text-sm">
                      <input type="checkbox" checked={draft.cancel_at_period_end}
                        onChange={(e) => setDraft((old) => ({ ...old, cancel_at_period_end: e.target.checked }))}/>
                      Schedule cancellation at period end
                    </label>
                    <label className="flex gap-2 rounded border p-3 text-sm">
                      <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)}/>
                      I understand this manually changes tenant entitlements without collecting or confirming any payment.
                    </label>
                    <Button type="submit" variant="primary" disabled={!acknowledge || busy || !draft.plan_code}>
                      {busy ? 'Saving…' : 'Apply manual change'}</Button>
                  </form>}
                  <section className="space-y-2 rounded-xl border p-5">
                    <h3 className="text-lg font-semibold">Subscription history</h3>
                    {detail.subscription_events.length === 0 ? <p className="text-sm text-muted">No subscription events yet.</p>
                      : <ul className="space-y-2 text-sm">{detail.subscription_events.map((event) =>
                        <li key={event.id} className="border-b pb-2">{event.action} · {event.source} · {displayDate(event.created_at)}</li>)}</ul>}
                    <p className="text-xs text-muted">{detail.platform_events.length} recent platform administration events</p>
                  </section>
                </>}
              </>}
            </>}
      </Container>
    </main>
  </div>;
}
