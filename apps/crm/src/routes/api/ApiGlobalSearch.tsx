import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiIdentity, type ApiGlobalSearch, type ApiSearchType,
} from '../../app/laravelClient';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';

const types: ApiSearchType[] = ['leads', 'contacts', 'accounts', 'deals'];
const destinations: Record<ApiSearchType, string> = {
  leads: 'lead', contacts: 'contact', accounts: 'account', deals: 'deal',
};
const titles: Record<ApiSearchType, string> = {
  leads: 'Leads', contacts: 'Contacts', accounts: 'Accounts', deals: 'Deals',
};
const listLinks: Record<ApiSearchType, string> = {
  leads: '/crm/leads', contacts: '/crm/contacts', accounts: '/crm/accounts', deals: '/crm/deals',
};
const errorText = (cause: unknown) => cause instanceof ApiError
  ? cause.message : 'Unable to complete CRM search.';

export default function ApiGlobalSearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const term = (params.get('q') ?? '').trim();
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [organizationId, setOrganizationId] = React.useState('');
  const [input, setInput] = React.useState(term);
  const [validation, setValidation] = React.useState('');
  const [sessionError, setSessionError] = React.useState('');
  const [reload, setReload] = React.useState(0);
  const [result, setResult] = React.useState<{
    key: string;
    data?: ApiGlobalSearch;
    error?: string;
  } | null>(null);
  const client = React.useMemo(() => baseUrl
    ? createLaravelClient({ baseUrl, organizationId }) : null, [baseUrl, organizationId]);
  const searchKey = JSON.stringify([organizationId, term, reload]);
  const visible = result?.key === searchKey ? result : null;
  const validTerm = term.length >= 2 && term.length <= 120;

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((data) => {
      if (active) {
        setIdentity(data);
        setOrganizationId(preferredLiveOrganization(data));
      }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setSessionError(errorText(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified || !validTerm) return;
    let active = true;
    void client.globalSearch(term).then((data) => {
      if (active) setResult({ key: searchKey, data });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setResult({ key: searchKey, error: errorText(cause) });
    });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, term, validTerm, reload, searchKey, navigate]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = input.trim();
    if (next.length < 2 || next.length > 120) {
      setValidation('Enter between 2 and 120 characters to search.');
      return;
    }
    setValidation('');
    if (next === term) setReload((value) => value + 1);
    else setParams({ q: next });
  };
  const total = visible?.data
    ? types.reduce((sum, type) => sum + visible.data!.groups[type].total, 0)
    : 0;

  return <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Dashboard</Link>
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/contacts">Contacts</Link>
      <Link className="underline" to="/crm/accounts">Accounts</Link>
      <Link className="underline" to="/crm/deals">Deals</Link>
      <Link className="underline" to="/crm/timeline">Customer timelines</Link>
    </nav>
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted">Live CRM / Find records</p>
      <h1 className="text-2xl font-semibold">Global CRM Search</h1>
      <p className="text-sm text-muted">Search real Leads, Contacts, Accounts and Deals in the selected organization.
        Records from other organizations are never included.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL to use live CRM search.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking secure CRM session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email to search CRM records.</p>
            : !identity.organizations.length ? <p role="alert">No active CRM organization is available.</p>
              : <>
                <section className="space-y-3 rounded-xl border p-4">
                  <label className="block max-w-md text-sm">Organization
                    <select aria-label="Organization" value={organizationId}
                      className="mt-1 block w-full rounded border p-2"
                      onChange={(event) => {
                        setOrganizationId(event.target.value);
                        storeLiveOrganization(event.target.value);
                        setResult(null);
                        setValidation('');
                      }}>
                      {identity.organizations.map((org) =>
                        <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
                    </select>
                  </label>
                  <form className="flex flex-wrap items-end gap-2" role="search" onSubmit={submit}>
                    <label className="min-w-52 flex-1 text-sm">Search all CRM records
                      <input autoFocus value={input} maxLength={120} className="mt-1 block w-full rounded border p-2"
                        placeholder="Name, email, phone or opportunity"
                        onChange={(event) => setInput(event.target.value)}/>
                    </label>
                    <button type="submit" className="rounded bg-blue-700 px-5 py-2 text-white">Search</button>
                  </form>
                  {validation && <p role="alert" className="text-sm text-red-600">{validation}</p>}
                </section>
                {!term ? <p className="text-sm text-muted">Enter a search term to find CRM records.</p>
                  : !validTerm ? <p role="alert">Search terms must contain 2–120 characters.</p>
                    : !visible ? <p role="status">Searching live CRM records…</p>
                      : visible.error ? <p role="alert">{visible.error}</p>
                        : visible.data && <>
                          <p role="status" className="text-sm">
                            {total.toLocaleString()} matching records for “{visible.data.query}”
                          </p>
                          {total === 0 && <p className="rounded-xl border p-4 text-sm">
                            No matching records were found in this organization.
                          </p>}
                          <div className="grid gap-4 md:grid-cols-2">
                            {types.map((type) => {
                              const group = visible.data!.groups[type];
                              return <section key={type} className="space-y-3 rounded-xl border p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <h2 className="font-semibold">{titles[type]} ({group.total})</h2>
                                  <Link className="text-sm underline" to={listLinks[type]}>Open {titles[type]}</Link>
                                </div>
                                {!group.items.length ? <p className="text-sm text-muted">No matching {titles[type].toLowerCase()}.</p>
                                  : <ul className="divide-y">{group.items.map((item) =>
                                    <li key={item.id} className="py-3">
                                      <Link className="font-medium underline"
                                        to={'/crm/timeline?type=' + destinations[type] + '&id=' + encodeURIComponent(item.id)}>
                                        {item.title}
                                      </Link>
                                      {(item.subtitle || item.status) && <p className="mt-1 text-sm text-muted">
                                        {[item.subtitle, item.status].filter(Boolean).join(' · ')}
                                      </p>}
                                    </li>)}</ul>}
                                {group.has_more && <p className="text-xs text-muted">
                                  Showing {group.items.length} of {group.total} matches. Use the full {titles[type]} screen for more.
                                </p>}
                              </section>;
                            })}
                          </div>
                        </>}
              </>}
  </main>;
}
