import { isLiveCrmMode } from '../../app/LiveRouteBridge';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';
import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiAccount, type ApiContact,
  type ApiIdentity, type ApiPage, type AccountInput, type ContactInput,
} from '../../app/laravelClient';

type RecordRow = ApiAccount | ApiContact;
type DirectoryState = { key: string; items: RecordRow[]; meta?: ApiPage<RecordRow>['meta']; error?: string };
type AccountOptions = { organizationId: string; items: ApiAccount[] };
type Draft = {
  name: string; first_name: string; last_name: string; email: string;
  phone: string; website: string; industry: string; job_title: string;
  account_id: string; notes: string;
};
const emptyDraft = (): Draft => ({
  name: '', first_name: '', last_name: '', email: '', phone: '',
  website: '', industry: '', job_title: '', account_id: '', notes: '',
});
const errText = (error: unknown) => error instanceof ApiError ? error.message : 'The request could not be completed.';

/** One shared, real-data CRM surface for the first Accounts/Contacts vertical slices. */
export default function ApiDirectory() {
  const isContact = useLocation().pathname.endsWith('/contacts');
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => apiBase ? createLaravelClient({ baseUrl: apiBase }) : null, [apiBase]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [sessionError, setSessionError] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [result, setResult] = React.useState<DirectoryState | null>(null);
  const [choices, setChoices] = React.useState<AccountOptions | null>(null);
  const [page, setPage] = React.useState(1);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [revision, setRevision] = React.useState(0);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [editing, setEditing] = React.useState<{ id: string; version: number } | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const client = React.useMemo(() => apiBase ? createLaravelClient({ baseUrl: apiBase, organizationId }) : null, [apiBase, organizationId]);
  const kind = isContact ? 'contacts' : 'accounts';
  const key = JSON.stringify([kind, organizationId, page, search, revision]);
  const role = identity?.organizations.find((org) => org.id === organizationId)?.role;
  const canWrite = !!role && role !== 'viewer';
  const visible = result?.key === key ? result : null;

  const fail = React.useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      navigate('/api-sign-in', { replace: true });
      return;
    }
    setError(errText(cause));
  }, [navigate]);

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((data) => {
      if (!active) return;
      setIdentity(data);
      setOrganizationId(preferredLiveOrganization(data));
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setSessionError(errText(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let active = true;
    const get = isContact
      ? client.listContacts({ page, pageSize: 25, q: search || undefined })
      : client.listAccounts({ page, pageSize: 25, q: search || undefined });
    void get.then((data) => {
      if (active) setResult({ key, items: data.items, meta: data.meta });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setResult({ key, items: [], error: errText(cause) });
    });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, isContact, page, search, revision, key, navigate]);

  React.useEffect(() => {
    if (!isContact || !client || !organizationId || !identity?.user.email_verified) return;
    let active = true;
    void client.listAccounts({ pageSize: 100 }).then((data) => {
      if (active) setChoices({ organizationId, items: data.items });
    }).catch(() => {
      if (active) setChoices({ organizationId, items: [] });
    });
    return () => { active = false; };
  }, [isContact, client, organizationId, identity?.user.email_verified, revision]);

  const refresh = () => setRevision((value) => value + 1);
  const closeForm = () => { setFormOpen(false); setEditing(null); setDraft(emptyDraft()); };
  const startEdit = (item: RecordRow) => {
    setError(''); setNotice(''); setDeleteId(null);
    if (isContact) {
      const contact = item as ApiContact;
      setDraft({ ...emptyDraft(), first_name: contact.first_name, last_name: contact.last_name,
        email: contact.email ?? '', phone: contact.phone ?? '', job_title: contact.job_title ?? '',
        notes: contact.notes ?? '', account_id: contact.account_id ?? '' });
    } else {
      const account = item as ApiAccount;
      setDraft({ ...emptyDraft(), name: account.name, website: account.website ?? '',
        phone: account.phone ?? '', industry: account.industry ?? '', notes: account.notes ?? '' });
    }
    setEditing({ id: item.id, version: item.version });
    setFormOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !canWrite || busy) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      if (isContact) {
        const input: ContactInput = {
          first_name: draft.first_name.trim(), last_name: draft.last_name.trim(),
          email: draft.email.trim() || null, phone: draft.phone.trim() || null,
          job_title: draft.job_title.trim() || null, notes: draft.notes.trim() || null,
          account_id: draft.account_id || null,
        };
        if (editing) await client.updateContact(editing.id, { ...input, expected_version: editing.version });
        else await client.createContact(input);
      } else {
        const input: AccountInput = {
          name: draft.name.trim(), website: draft.website.trim() || null,
          phone: draft.phone.trim() || null, industry: draft.industry.trim() || null,
          notes: draft.notes.trim() || null,
        };
        if (editing) await client.updateAccount(editing.id, { ...input, expected_version: editing.version });
        else await client.createAccount(input);
      }
      closeForm(); setPage(1); refresh(); setNotice(isContact ? 'Contact saved.' : 'Account saved.');
    } catch (cause) {
      fail(cause);
      if (cause instanceof ApiError && cause.status === 409) {
        closeForm(); refresh(); setNotice('This record changed in another session. Refresh and reopen it.');
      }
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!client || !deleteId || !canWrite || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (isContact) await client.deleteContact(deleteId);
      else await client.deleteAccount(deleteId);
      setDeleteId(null); closeForm(); refresh(); setNotice(isContact ? 'Contact deleted.' : 'Account deleted.');
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    if (!auth || busy) return;
    setBusy(true);
    try { await auth.logout(); navigate('/api-sign-in', { replace: true }); }
    catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const field = (key: keyof Draft, title: string, required = false, type = 'text') => (
    <label className="block space-y-1 text-sm" key={key}>
      {title}
      <input type={type} required={required} value={draft[key]} maxLength={255} className="block w-full rounded border p-2"
        onChange={(event) => setDraft((old) => ({ ...old, [key]: event.target.value }))} />
    </label>
  );

  return <main className="mx-auto max-w-6xl space-y-5 p-6">
    <nav className="flex flex-wrap items-center gap-4 text-sm">
      <Link className="underline" to="/crm/leads">Live Leads</Link>
      <Link className="underline" to="/crm/accounts">Live Accounts</Link>
      <Link className="underline" to="/crm/contacts">Live Contacts</Link>
      <Link className="underline" to="/crm/deals">Live Deals</Link>
      {!isLiveCrmMode && <Link className="underline" to="/app/home">Demo CRM</Link>}
      <button type="button" disabled={busy} className="ml-auto underline disabled:opacity-50" onClick={() => { void signOut(); }}>Sign out</button>
    </nav>
    <header>
      <p className="text-xs uppercase tracking-widest text-muted">CRM / Sales / Live data</p>
      <h1 className="text-2xl font-semibold">{isContact ? 'Contacts' : 'Accounts'}</h1>
      <p className="text-sm text-muted">Laravel/PostgreSQL records scoped to a verified organization. Advanced demo features remain separate.</p>
    </header>
    {!apiBase ? <p role="alert">Set VITE_CRM_API_URL to connect to Laravel.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking your session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email before accessing CRM data.</p>
            : <>
              <label className="block max-w-md space-y-1 text-sm">Organization
                <select aria-label="Organization" disabled={busy} value={organizationId}
                  className="block w-full rounded border p-2"
                  onChange={(event) => {
                    setOrganizationId(event.target.value); storeLiveOrganization(event.target.value); setPage(1); setSearch(''); setSearchInput('');
                    setDeleteId(null); closeForm(); setError(''); setNotice('');
                  }}>
                  {identity.organizations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
                </select>
              </label>
              {!organizationId ? <p role="alert">There are no active organizations in your membership.</p> : <>
                <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
                  <input aria-label={isContact ? 'Search contacts' : 'Search accounts'} type="search" className="min-w-44 flex-1 rounded border p-2"
                    placeholder={isContact ? 'Search contacts by name or email' : 'Search account names'}
                    value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                  <button type="submit" className="rounded border px-4 py-2">Search</button>
                  <button type="button" className="rounded border px-4 py-2" onClick={refresh}>Refresh</button>
                  <button type="button" disabled={!canWrite || busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                    onClick={() => { closeForm(); setDeleteId(null); setFormOpen(true); }}>
                    {isContact ? 'New contact' : 'New account'}
                  </button>
                </form>
                {error && <p role="alert" className="text-red-600">{error}</p>}
                {notice && <p role="status">{notice}</p>}
                {!visible ? <p role="status">Loading {kind} for this organization…</p>
                  : visible.error ? <p role="alert">{visible.error}</p>
                    : <div className="overflow-x-auto rounded border">
                      <table className="w-full text-left text-sm">
                        <thead><tr>
                          <th className="p-3">{isContact ? 'Contact' : 'Account'}</th>
                          <th className="p-3">{isContact ? 'Email' : 'Industry'}</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">{isContact ? 'Account' : 'Website'}</th>
                          <th className="p-3">Actions</th>
                        </tr></thead>
                        <tbody>{visible.items.map((item) => {
                          const contact = isContact ? item as ApiContact : null;
                          const account = !isContact ? item as ApiAccount : null;
                          const linkedName = choices?.organizationId === organizationId
                            ? choices.items.find((entry) => entry.id === contact?.account_id)?.name : undefined;
                          return <tr className="border-t" key={item.id}>
                            <td className="p-3">{contact ? contact.first_name + ' ' + contact.last_name : account?.name}</td>
                            <td className="p-3">{contact?.email ?? account?.industry ?? '—'}</td>
                            <td className="p-3">{contact?.phone ?? account?.phone ?? '—'}</td>
                            <td className="p-3">{contact ? (linkedName ?? (contact.account_id ? 'Linked account' : '—')) : account?.website ?? '—'}</td>
                            <td className="p-3">
                              <button type="button" className="mr-3 underline disabled:opacity-50" disabled={!canWrite || busy} onClick={() => startEdit(item)}>Edit</button>
                              <button type="button" className="underline disabled:opacity-50" disabled={!canWrite || busy}
                                onClick={() => { setDeleteId(item.id); closeForm(); setError(''); }}>Delete</button>
                            </td>
                          </tr>;
                        })}</tbody>
                      </table>
                      {visible.items.length === 0 && <p className="p-4 text-sm">No matching {kind}.</p>}
                      {visible.meta && <div className="flex items-center justify-between gap-3 border-t p-3 text-sm">
                        <span>Page {visible.meta.page} / {visible.meta.totalPages} · {visible.meta.total} total</span>
                        <div className="flex gap-2">
                          <button type="button" className="rounded border px-3 py-1 disabled:opacity-50" disabled={!visible.meta.hasPrev || busy}
                            onClick={() => { closeForm(); setPage((n) => Math.max(1, n - 1)); }}>Previous</button>
                          <button type="button" className="rounded border px-3 py-1 disabled:opacity-50" disabled={!visible.meta.hasNext || busy}
                            onClick={() => { closeForm(); setPage((n) => n + 1); }}>Next</button>
                        </div>
                      </div>}
                    </div>}
                {formOpen && canWrite && <form className="space-y-3 rounded border p-4" onSubmit={(event) => { void save(event); }}>
                  <h2 className="text-lg font-medium">{editing ? 'Edit' : 'New'} {isContact ? 'contact' : 'account'}</h2>
                  {isContact ? <>
                    {field('first_name', 'First name', true)}
                    {field('last_name', 'Last name', true)}
                    {field('email', 'Email', false, 'email')}
                    {field('job_title', 'Job title')}
                    <label className="block space-y-1 text-sm">Account
                      <select value={draft.account_id} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, account_id: event.target.value }))}>
                        <option value="">No linked account</option>
                        {choices?.organizationId === organizationId && choices.items.map((account) =>
                          <option key={account.id} value={account.id}>{account.name}</option>)}
                      </select>
                    </label>
                  </> : <>
                    {field('name', 'Account name', true)}
                    {field('website', 'Website', false, 'url')}
                    {field('industry', 'Industry')}
                  </>}
                  {field('phone', 'Phone')}
                  <label className="block space-y-1 text-sm">Notes
                    <textarea value={draft.notes} className="block w-full rounded border p-2"
                      onChange={(event) => setDraft((old) => ({ ...old, notes: event.target.value }))} />
                  </label>
                  <div className="flex gap-3">
                    <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>Save</button>
                    <button type="button" className="rounded border px-4 py-2" onClick={closeForm}>Cancel</button>
                  </div>
                  {isContact && <p className="text-xs text-muted">Account choices show the first 100 accounts; a full searchable picker follows in a later batch.</p>}
                </form>}
                {deleteId && canWrite && <section className="space-y-2 rounded border p-4" aria-label="Confirm record deletion">
                  <p>Delete this {isContact ? 'contact' : 'account'}? Accounts with linked contacts cannot be deleted.</p>
                  <button type="button" disabled={busy} className="rounded bg-red-700 px-4 py-2 text-white" onClick={() => { void remove(); }}>Confirm delete</button>
                  <button type="button" className="ml-3 rounded border px-4 py-2" onClick={() => setDeleteId(null)}>Cancel</button>
                </section>}
              </>}
            </>}
  </main>;
}
