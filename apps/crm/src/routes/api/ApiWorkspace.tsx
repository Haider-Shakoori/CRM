import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, createLaravelClient, type ApiLead } from '../../app/laravelClient';

type Organization = { id: string; name: string; role: string };
type Identity = { user: { name: string; email_verified: boolean }; organizations: Organization[] };

export default function ApiWorkspace() {
  const apiBase = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const navigate = useNavigate();
  const [identity, setIdentity] = React.useState<Identity | null>(null);
  const [orgId, setOrgId] = React.useState('');
  const [leads, setLeads] = React.useState<ApiLead[]>([]);
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const client = React.useMemo(() => apiBase ? createLaravelClient({ baseUrl: apiBase, organizationId: orgId }) : null, [apiBase, orgId]);
  React.useEffect(() => {
    if (!client) return;
    let active = true;
    void client.me().then((value) => {
      if (!active) return;
      const data = value as Identity;
      setIdentity(data);
      setOrgId((prior) => data.organizations.some((org) => org.id === prior) ? prior : (data.organizations[0]?.id ?? ''));
    }).catch(() => { if (active) navigate('/api-sign-in', { replace: true }); });
    return () => { active = false; };
    // Only authenticate when the configured API origin changes.
  }, [apiBase, navigate]);
  const reload = React.useCallback(async () => {
    if (!client || !orgId) return;
    try { setError(''); setLeads((await client.listLeads()).items); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Could not load leads.'); }
  }, [client, orgId]);
  React.useEffect(() => { void reload(); }, [reload]);
  const addLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !name.trim() || busy) return;
    setBusy(true);
    try { await client.createLead({ name: name.trim() }); setName(''); await reload(); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Could not save lead.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    if (!client) return;
    try { await client.logout(); navigate('/api-sign-in', { replace: true }); }
    catch { setError('Could not securely sign out.'); }
  };
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">CRM — Live API workspace</h1><p className="text-sm text-muted">Real organization-scoped Leads stored in Laravel/PostgreSQL. Other CRM modules remain demo-only.</p></div>
      <div className="flex gap-4"><Link className="underline" to="/app/home">Demo CRM</Link><button className="underline" onClick={() => { void logout(); }}>Sign out</button></div>
    </header>
    {!apiBase ? <p role="alert">Set VITE_CRM_API_URL to enable the backend.</p> : !identity ? <p role="status">Checking your secure session…</p> : !identity.user.email_verified ? <p role="alert">Verify your email address before accessing organization records.</p> : <>
      <label className="block space-y-1">Organization
        <select aria-label="Organization" className="block w-full max-w-md rounded border p-2" value={orgId} onChange={(event) => setOrgId(event.target.value)}>
          {identity.organizations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
        </select>
      </label>
      {!orgId ? <p role="alert">You have no active organization memberships.</p> : <>
        <form onSubmit={(event) => { void addLead(event); }} className="flex flex-wrap gap-2">
          <input aria-label="Lead name" required className="min-w-56 flex-1 rounded border p-2" placeholder="Lead name" value={name} onChange={(event) => setName(event.target.value)} />
          <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy || identity.organizations.find((org) => org.id === orgId)?.role === 'viewer'}>Create lead</button>
          <button type="button" className="rounded border px-4 py-2" onClick={() => { void reload(); }}>Refresh</button>
        </form>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Email</th><th className="p-3">Version</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-t"><td className="p-3">{lead.name}</td><td className="p-3">{lead.status}</td><td className="p-3">{lead.email ?? '—'}</td><td className="p-3">{lead.version}</td></tr>)}</tbody></table>{leads.length === 0 && <p className="p-4 text-sm">No leads in this organization.</p>}</div>
      </>}
    </>}
  </main>;
}
