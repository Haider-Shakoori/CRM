import { isLiveCrmMode } from '../../app/LiveRouteBridge';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiIdentity, type ApiSubscriptionSnapshot, type ApiSubscriptionPlan, type CrmQuotaResource,
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
  const [billingError, setBillingError] = React.useState('');
  const [billingBusy, setBillingBusy] = React.useState(false);
  const [plans, setPlans] = React.useState<ApiSubscriptionPlan[]>([]);
  const [chosenPlan, setChosenPlan] = React.useState('');
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
      setOrganizationId(preferredLiveOrganization(result));
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

  React.useEffect(() => {
    if (!client || !organizationId || !canView || !current?.billing_connected || current.billing_linked) {
      return;
    }
    let active = true;
    void client.subscriptionPlans().then((items) => {
      if (!active) return;
      const purchasable = items.filter((item) => item.checkout_available && item.code !== 'starter');
      setPlans(purchasable);
      setChosenPlan(purchasable[0]?.code ?? '');
    }).catch((cause: unknown) => { if (active) setBillingError(message(cause)); });
    return () => { active = false; };
  }, [client, organizationId, canView, current?.billing_connected, current?.billing_linked]);

  const goToStripe = async (mode: 'checkout' | 'portal') => {
    if (!client || !current?.billing_connected || billingBusy || !canView) return;
    if (mode === 'checkout' && (!chosenPlan || current.billing_linked)) return;
    if (mode === 'portal' && !current.billing_linked) return;
    setBillingBusy(true); setBillingError('');
    try {
      const result = mode === 'checkout'
        ? (await client.stripeCheckout(chosenPlan)).checkout_url
        : (await client.stripePortal()).portal_url;
      const expectedHost = mode === 'checkout' ? 'checkout.stripe.com' : 'billing.stripe.com';
      const destination = new URL(result);
      if (destination.protocol !== 'https:' || destination.hostname !== expectedHost) {
        throw new Error('Unexpected Stripe destination.');
      }
      window.location.assign(destination.href);
    } catch (cause) {
      setBillingError(message(cause)); setBillingBusy(false);
    }
  };

  return <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Live Dashboard</Link>
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/my-work">My Work</Link>
      {!isLiveCrmMode && <Link className="underline" to="/app/home">Demo Home</Link>}
    </nav>
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted">CRM / Organization / Entitlements</p>
      <h1 className="text-3xl font-bold">Subscription & Usage</h1>
      <p className="text-sm text-muted">Real subscription status from Laravel. Stripe checkout is shown only when a test integration is explicitly configured.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL to load subscription details.</p>
      : error ? <p role="alert">{error}</p>
        : !identity ? <p role="status">Checking session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email to access subscription information.</p>
            : <>
              <label className="block max-w-md space-y-1 text-sm">Organization
                <select aria-label="Organization" className="block w-full rounded border p-2" value={organizationId}
                  onChange={(event) => { setOrganizationId(event.target.value); storeLiveOrganization(event.target.value); setSnapshot(null); setError('');
                    setPlans([]); setChosenPlan(''); setBillingError(''); }}>
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
                      {current.billing_connected && <section className="space-y-3 rounded-xl border p-5" aria-label="Stripe test billing">
                        <h2 className="text-xl font-semibold">Stripe billing (test mode)</h2>
                        <p className="text-sm text-muted">Stripe test payments only. Returning from Checkout does not activate a subscription; only verified Stripe subscription webhooks can change access.</p>
                        {billingError && <p role="alert" className="text-red-600">{billingError}</p>}
                        {current.billing_linked
                          ? <button type="button" disabled={billingBusy} className="rounded border px-4 py-2 disabled:opacity-50"
                              onClick={() => { void goToStripe('portal'); }}>Open Stripe customer portal (test)</button>
                          : plans.length ? <div className="flex flex-wrap items-end gap-3">
                            <label className="text-sm">Published plan
                              <select className="mt-1 block min-w-52 rounded border p-2" value={chosenPlan}
                                onChange={(event) => setChosenPlan(event.target.value)}>
                                {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                              </select>
                            </label>
                            <button type="button" disabled={!chosenPlan || billingBusy}
                              className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                              onClick={() => { void goToStripe('checkout'); }}>Open Stripe test Checkout</button>
                          </div>
                            : <p className="text-sm">No paid plans have been published with configured Stripe test Price IDs yet.</p>}
                      </section>}
                      <button type="button" className="rounded border px-4 py-2" onClick={() => setRevision((value) => value + 1)}>
                        Refresh usage
                      </button>
                    </>}
            </>}
  </main>;
}
