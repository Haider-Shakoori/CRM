import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError,
  createLaravelClient,
  LEAD_STATUSES,
  type ApiIdentity,
  type ApiLead,
  type ApiLeadStatus,
} from '../../app/laravelClient';

type ListState = { organizationId: string; items: ApiLead[]; error?: string };
type EditDraft = { name: string; email: string; status: ApiLeadStatus; notes: string };

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

/**
 * Preview of real Laravel storage, deliberately isolated from mock-backed routes.
 * List state includes organization identity: after a switch, no prior tenant data
 * can render while the new request is in flight. Every async load has a cleanup guard.
 */
export default function ApiWorkspace() {
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const authClient = React.useMemo(() => apiBase ? createLaravelClient({ baseUrl: apiBase }) : null, [apiBase]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [sessionError, setSessionError] = React.useState('');
  const [orgId, setOrgId] = React.useState('');
  const [result, setResult] = React.useState<ListState | null>(null);
  const [reloadCount, setReloadCount] = React.useState(0);
  const [newName, setNewName] = React.useState('');
  const [edit, setEdit] = React.useState<{ id: string; version: number; draft: EditDraft } | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const client = React.useMemo(
    () => apiBase ? createLaravelClient({ baseUrl: apiBase, organizationId: orgId }) : null,
    [apiBase, orgId],
  );

  const handleError = React.useCallback((cause: unknown, fallback: string) => {
    if (cause instanceof ApiError && cause.status === 401) {
      navigate('/api-sign-in', { replace: true });
      return;
    }
    setActionError(errorText(cause, fallback));
  }, [navigate]);

  React.useEffect(() => {
    if (!authClient) return;
    let current = true;
    void authClient.me().then((data) => {
      if (!current) return;
      setIdentity(data);
      setOrgId((previous) => data.organizations.some((org) => org.id === previous)
        ? previous : (data.organizations[0]?.id ?? ''));
    }).catch((cause: unknown) => {
      if (!current) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setSessionError(errorText(cause, 'Could not check your session.'));
    });
    return () => { current = false; };
  }, [authClient, navigate]);

  React.useEffect(() => {
    if (!client || !orgId || !identity?.user.email_verified) return;
    let current = true;
    void client.listLeads({ pageSize: 100 }).then((data) => {
      if (current) setResult({ organizationId: orgId, items: data.items });
    }).catch((cause: unknown) => {
      if (!current) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setResult({ organizationId: orgId, items: [], error: errorText(cause, 'Could not load leads.') });
    });
    return () => { current = false; };
  }, [client, orgId, identity?.user.email_verified, reloadCount, navigate]);

  const selectedOrg = identity?.organizations.find((org) => org.id === orgId);
  const canEdit = !!selectedOrg && selectedOrg.role !== 'viewer';
  const visible = result?.organizationId === orgId ? result : null;
  const items = visible?.items ?? [];
  const refresh = () => setReloadCount((value) => value + 1);

  const createLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !canEdit || !newName.trim() || busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await client.createLead({ name: newName.trim() });
      setNewName('');
      refresh();
      setNotice('Lead created in the selected organization.');
    } catch (cause) { handleError(cause, 'Could not create lead.'); }
    finally { setBusy(false); }
  };
  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !canEdit || !edit || busy) return;
    const { id, version, draft } = edit;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await client.updateLead(id, {
        expected_version: version, name: draft.name.trim(), email: draft.email.trim() || null,
        notes: draft.notes.trim() || null, status: draft.status,
      });
      setEdit(null); refresh(); setNotice('Lead saved.');
    } catch (cause) {
      handleError(cause, 'Could not save changes.');
      if (cause instanceof ApiError && cause.status === 409) {
        setNotice('This lead changed in another session. Refresh and reopen it before editing.');
        refresh();
      }
    } finally { setBusy(false); }
  };
  const deleteLead = async () => {
    if (!client || !canEdit || !deleteId || busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await client.deleteLead(deleteId);
      setDeleteId(null); setEdit(null); refresh(); setNotice('Lead deleted.');
    } catch (cause) { handleError(cause, 'Could not delete lead.'); }
    finally { setBusy(false); }
  };
  const resendVerification = async () => {
    if (!authClient || busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await authClient.resendVerification();
      setNotice('Verification email requested. Check your inbox, then refresh this page.');
    } catch (cause) { handleError(cause, 'Could not request verification.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    if (!authClient || busy) return;
    setBusy(true);
    try {
      await authClient.logout();
      setIdentity(null); setResult(null);
      navigate('/api-sign-in', { replace: true });
    } catch (cause) { handleError(cause, 'Could not securely sign out.'); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CRM — Live API workspace</h1>
          <p className="text-sm text-muted">Real Laravel/PostgreSQL Leads. Other CRM modules remain a demo.</p>
        </div>
        <nav className="flex gap-4">
          <Link className="underline" to="/app/home">Demo CRM</Link>
          <button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={() => { void logout(); }}>Sign out</button>
        </nav>
      </header>
      {!apiBase ? <p role="alert">Set VITE_CRM_API_URL to enable the Laravel API.</p>
        : sessionError ? <p role="alert">{sessionError}</p>
          : !identity ? <p role="status">Checking your secure session…</p>
            : !identity.user.email_verified ? (
              <section className="space-y-3 rounded border p-4">
                <h2 className="font-semibold">Email verification required</h2>
                <p>Verify your email to access organization records.</p>
                <button type="button" disabled={busy} className="rounded border px-4 py-2" onClick={() => { void resendVerification(); }}>Resend verification email</button>
                {actionError && <p role="alert">{actionError}</p>}
                {notice && <p role="status">{notice}</p>}
              </section>
            ) : (
              <>
                <label className="block max-w-md space-y-1">Organization
                  <select aria-label="Organization" className="block w-full rounded border p-2" value={orgId}
                    onChange={(event) => {
                      setOrgId(event.target.value);
                      setEdit(null); setDeleteId(null); setActionError(''); setNotice('');
                    }}>
                    {identity.organizations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
                  </select>
                </label>
                {!orgId ? <p role="alert">You have no active organization memberships.</p> : (
                  <>
                    <form onSubmit={(event) => { void createLead(event); }} className="flex flex-wrap gap-2">
                      <input aria-label="New lead name" required className="min-w-56 flex-1 rounded border p-2" placeholder="Lead name"
                        value={newName} onChange={(event) => setNewName(event.target.value)} />
                      <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                        type="submit" disabled={busy || !canEdit}>Create lead</button>
                      <button type="button" className="rounded border px-4 py-2" onClick={refresh}>Refresh</button>
                    </form>
                    {actionError && <p role="alert" className="text-red-600">{actionError}</p>}
                    {notice && <p role="status">{notice}</p>}
                    {!visible ? <p role="status">Loading leads for the selected organization…</p>
                      : visible.error ? <p role="alert">{visible.error}</p>
                        : (
                          <div className="overflow-x-auto rounded border">
                            <table className="w-full text-left text-sm">
                              <thead><tr><th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Email</th><th className="p-3">Version</th><th className="p-3">Actions</th></tr></thead>
                              <tbody>{items.map((lead) => (
                                <tr key={lead.id} className="border-t">
                                  <td className="p-3">{lead.name}</td><td className="p-3">{lead.status}</td>
                                  <td className="p-3">{lead.email ?? '—'}</td><td className="p-3">{lead.version}</td>
                                  <td className="p-3 space-x-3">
                                    <button type="button" disabled={!canEdit || busy} className="underline disabled:opacity-50"
                                      onClick={() => { setDeleteId(null); setEdit({ id: lead.id, version: lead.version,
                                        draft: { name: lead.name, email: lead.email ?? '', status: lead.status, notes: lead.notes ?? '' } }); }}>Edit</button>
                                    <button type="button" disabled={!canEdit || busy} className="underline disabled:opacity-50"
                                      onClick={() => { setEdit(null); setDeleteId(lead.id); }}>Delete</button>
                                  </td>
                                </tr>
                              ))}</tbody>
                            </table>
                            {items.length === 0 && <p className="p-4 text-sm">No leads in this organization.</p>}
                          </div>
                        )}
                    {edit && canEdit && (
                      <form className="space-y-3 rounded border p-4" onSubmit={(event) => { void saveEdit(event); }}>
                        <h2 className="font-semibold">Edit lead</h2>
                        <label className="block">Name <input required maxLength={200} className="block w-full rounded border p-2"
                          value={edit.draft.name} onChange={(event) => setEdit((previous) => previous ? { ...previous, draft: { ...previous.draft, name: event.target.value } } : null)} /></label>
                        <label className="block">Email <input type="email" className="block w-full rounded border p-2"
                          value={edit.draft.email} onChange={(event) => setEdit((previous) => previous ? { ...previous, draft: { ...previous.draft, email: event.target.value } } : null)} /></label>
                        <label className="block">Status <select className="block w-full rounded border p-2" value={edit.draft.status}
                          onChange={(event) => setEdit((previous) => previous ? { ...previous, draft: { ...previous.draft, status: event.target.value as ApiLeadStatus } } : null)}>
                          {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select></label>
                        <label className="block">Notes <textarea className="block w-full rounded border p-2"
                          value={edit.draft.notes} onChange={(event) => setEdit((previous) => previous ? { ...previous, draft: { ...previous.draft, notes: event.target.value } } : null)} /></label>
                        <div className="flex gap-3">
                          <button type="submit" disabled={busy || !edit.draft.name.trim()} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Save lead</button>
                          <button type="button" className="rounded border px-4 py-2" onClick={() => setEdit(null)}>Cancel</button>
                        </div>
                      </form>
                    )}
                    {deleteId && canEdit && (
                      <div className="space-y-2 rounded border p-4" role="group" aria-label="Confirm lead deletion">
                        <p>Delete this lead permanently?</p>
                        <button type="button" disabled={busy} className="rounded bg-red-700 px-4 py-2 text-white" onClick={() => { void deleteLead(); }}>Confirm delete</button>
                        <button type="button" className="ml-3 rounded border px-4 py-2" onClick={() => setDeleteId(null)}>Cancel</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
    </main>
  );
}
