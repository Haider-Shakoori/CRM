import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiIdentity, type ApiSubscriptionSnapshot, type CrmQuotaResource,
} from '../../app/laravelClient';

const labels: Record<CrmQuotaResource, string> = {
  seats: 'Team seats', leads: 'Leads', contacts: 'Contacts', accounts: 'Accounts',
  deals: 'Active Deals', activities: 'Active Activities',
};
const resources = Object.keys(labels) as CrmQuotaResource[];
const message = (cause: unknown) => cause instanceof ApiError ? cause.message : 'Unable to load subscription status.';

export default function ApiSubscriptionPage() {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [organizationId, setOrganizationId] = React.useState('');
  const [error, setError] = React.useState('');
  const [revision, setRevision] = React.useState(0);
  const [snapshot, setSnapshot] = React.useState<{ organizationId: string; revision: number; data: ApiSubscriptionSnapshot } | null>(null);
  const client = React.useMemo(() =>
    baseUrl ? createLaravelClient({ baseUrl, organizationId }) : null, [baseUrl, organizationId]);
  const role = identity?.organizations.find((org) => org.id === organizationId)?.role;
  const canView = role === 'owner' || role === 'admin';
  const current = snapshot?.organizationId === organizationId && snapshot.revision === revision ? snapshot.data : null;

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((result) => {
      if (!active) return;
      setIdentity(result);
      setOrganizationId(result.organizations[0]?.id ?? '');
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setError(message(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !canView || !identity?.user.email_verified) return;
    let active = true;
    void client.subscriptionUsage().then((data) => {
      if (active) { setSnapshot({ organizationId, revision, data }); setError(''); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setError(message(cause));
    });
    return () => { active = false; };
  }, [client, organizationId, canView, identity?.user.email_verified, navigate, revision]);

  return <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Live Dashboard</Link>
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/my-work">My Work</Link>
      <Link className="underline" to="/app/home">Demo Home</Link>
    </nav>
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted">CRM / Organization / Entitlements</p>
      <h1 className="text-3xl font-bold">Subscription & Usage</h1>
      <p className="text-sm text-muted">Real subscription state and quota usage from Laravel. This page does not collect payments or change plans.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL to load subscription details.</p>
      : error ? <p role="alert">{error}</p>
        : !identity ? <p role="status">Checking session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email to access subscription information.</p>
            : <>
              <label className="block max-w-md space-y-1 text-sm">Organization
                <select aria-label="Organization" className="block w-full rounded border p-2" value={organizationId}
                  onChange={(event) => { setOrganizationId(event.target.value); setSnapshot(null); setError(''); }}>
                  {identity.organizations.map((entry) =>
                    <option key={entry.id} value={entry.id}>{entry.name} ({entry.role})</option>)}
                </select>
              </label>
              {!organizationId ? <p role="alert">No active organization membership.</p>
                : !canView ? <p role="alert">Subscription details are available to organization owners and administrators.</p>
                  : !current ? <p role="status">Loading subscription usage…</p>
                    : <>
                      <section className="space-y-2 rounded-xl border p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-muted">Current plan</p>
                            <h2 className="text-xl font-semibold">{current.subscription.plan_name}</h2>
                          </div>
                          <span className="rounded border px-3 py-1 text-sm capitalize">{current.subscription.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm">{current.write_enabled ? 'CRM editing is enabled for this subscription.' :
                          'CRM records remain readable, but writes are paused while the subscription is inactive or past its period end.'}</p>
                        <p className="text-sm text-muted">Period end: {current.subscription.period_ends_at
                          ? new Date(current.subscription.period_ends_at).toLocaleString() : 'No fixed end date'}</p>
                        <p className="text-sm text-muted">Scheduled cancellation: {current.subscription.cancel_at_period_end ? 'Yes' : 'No'}</p>
                        <p className="text-sm text-muted">{current.manage_message}</p>
                      </section>
                      <section className="space-y-4">
                        <h2 className="text-xl font-semibold">Resource limits</h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {resources.map((resource) => {
                            const used = current.usage[resource];
                            const limit = current.subscription.limits[resource];
                            const remaining = limit === null ? null : Math.max(0, limit - used);
                            return <article key={resource} className="space-y-2 rounded-xl border p-4">
                              <h3 className="font-medium">{labels[resource]}</h3>
                              <strong className="block text-2xl tabular-nums">{used.toLocaleString()}</strong>
                              <p className="text-sm text-muted">{limit === null ? 'No configured limit' :
                                'Limit ' + limit.toLocaleString() + ' · ' + remaining?.toLocaleString() + ' remaining'}</p>
                              {limit !== null && <div className="h-2 overflow-hidden rounded-full bg-inset">
                                <div className="h-full rounded-full bg-blue-600"
                                  style={{ width: Math.min(100, limit === 0 ? 100 : (used / limit) * 100) + '%' }}/>
                              </div>}
                            </article>;
                          })}
                        </div>
                      </section>
                      <button type="button" className="rounded border px-4 py-2" onClick={() => setRevision((value) => value + 1)}>
                        Refresh usage
                      </button>
                    </>}
            </>}
  </main>;
}
