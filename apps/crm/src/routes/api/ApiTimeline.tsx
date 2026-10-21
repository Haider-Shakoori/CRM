import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ApiError, createLaravelClient,
  type ApiIdentity, type ApiNote, type ApiTimelineEntry, type ApiTimelinePage,
  type ApiTimelineSubject,
} from '../../app/laravelClient';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';

type RecordOption = { id: string; label: string };
type RecordResults = { key: string; items: RecordOption[]; error?: string };
type TimelineResult = { key: string; page: ApiTimelinePage | null; error?: string };
const types: ApiTimelineSubject[] = ['lead', 'contact', 'account', 'deal'];
const explain = (cause: unknown) =>
  cause instanceof ApiError ? cause.message : 'Could not complete this CRM request.';

export default function ApiTimeline() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedType = params.get('type');
  const subjectType: ApiTimelineSubject = types.includes(requestedType as ApiTimelineSubject)
    ? requestedType as ApiTimelineSubject : 'lead';
  const subjectId = params.get('id') ?? '';
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [sessionError, setSessionError] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const client = React.useMemo(
    () => baseUrl ? createLaravelClient({ baseUrl, organizationId }) : null, [baseUrl, organizationId],
  );
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [records, setRecords] = React.useState<RecordResults | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineResult | null>(null);
  const [page, setPage] = React.useState(1);
  const [revision, setRevision] = React.useState(0);
  const [draft, setDraft] = React.useState({ title: '', body: '' });
  const [editing, setEditing] = React.useState<ApiNote | null>(null);
  const [confirmArchive, setConfirmArchive] = React.useState<ApiNote | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const role = identity?.organizations.find((organization) => organization.id === organizationId)?.role;
  const canWrite = !!role && role !== 'viewer';
  const recordKey = JSON.stringify([organizationId, subjectType, search, revision]);
  const timelineKey = JSON.stringify([organizationId, subjectType, subjectId, page, revision]);
  const visibleRecords = records?.key === recordKey ? records : null;
  const visibleTimeline = timeline?.key === timelineKey ? timeline : null;

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((data) => {
      if (active) { setIdentity(data); setOrganizationId(preferredLiveOrganization(data)); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setSessionError(explain(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let active = true;
    const read = subjectType === 'lead' ? client.listLeads({ q: search || undefined, pageSize: 25 })
      : subjectType === 'contact' ? client.listContacts({ q: search || undefined, pageSize: 25 })
        : subjectType === 'account' ? client.listAccounts({ q: search || undefined, pageSize: 25 })
          : client.listDeals({ q: search || undefined, pageSize: 25 });
    void read.then((data) => {
      if (!active) return;
      const items = data.items.map((item) => {
        const label = 'first_name' in item ? item.first_name + ' ' + item.last_name : item.name;
        return { id: item.id, label };
      });
      setRecords({ key: recordKey, items });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setRecords({ key: recordKey, items: [], error: explain(cause) });
    });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, subjectType, search, revision, recordKey, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !subjectId || !identity?.user.email_verified) return;
    let active = true;
    void client.timeline({ subject_type: subjectType, subject_id: subjectId, page, pageSize: 25 })
      .then((data) => { if (active) setTimeline({ key: timelineKey, page: data }); })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
        else setTimeline({ key: timelineKey, page: null, error: explain(cause) });
      });
    return () => { active = false; };
  }, [client, organizationId, subjectId, subjectType, page, revision, timelineKey, identity?.user.email_verified, navigate]);

  const selectRecord = (id: string, type: ApiTimelineSubject = subjectType) => {
    setParams(id ? { type, id } : { type });
    setPage(1); setFormOpen(false); setEditing(null); setConfirmArchive(null);
    setError(''); setNotice('');
  };
  const refresh = () => setRevision((value) => value + 1);
  const startEdit = async (entry: ApiTimelineEntry) => {
    if (!client || busy || !canWrite) return;
    setBusy(true); setError('');
    try {
      const note = await client.getNote(entry.id);
      setEditing(note); setDraft({ title: note.title, body: note.body }); setFormOpen(true);
    } catch (cause) { setError(explain(cause)); }
    finally { setBusy(false); }
  };
  const archive = async (entry: ApiTimelineEntry) => {
    if (!client || busy || !canWrite) return;
    setBusy(true); setError('');
    try { setConfirmArchive(await client.getNote(entry.id)); }
    catch (cause) { setError(explain(cause)); }
    finally { setBusy(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !canWrite || !subjectId || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (editing) {
        await client.updateNote(editing.id, {
          expected_version: editing.version, title: draft.title.trim(), body: draft.body.trim(),
        });
      } else {
        await client.createNote({
          subject_type: subjectType, subject_id: subjectId,
          title: draft.title.trim(), body: draft.body.trim(),
        });
      }
      setFormOpen(false); setEditing(null); setDraft({ title: '', body: '' });
      setPage(1); refresh(); setNotice('Note saved to the customer timeline.');
    } catch (cause) {
      setError(explain(cause));
      if (cause instanceof ApiError && cause.status === 409) {
        setFormOpen(false); setEditing(null); refresh();
      }
    } finally { setBusy(false); }
  };
  const confirmDelete = async () => {
    if (!client || !confirmArchive || !canWrite || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await client.archiveNote(confirmArchive.id, confirmArchive.version);
      setConfirmArchive(null); setPage(1); refresh(); setNotice('Note archived; audit history retained.');
    } catch (cause) {
      setError(explain(cause));
      if (cause instanceof ApiError && cause.status === 409) { setConfirmArchive(null); refresh(); }
    } finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-6xl space-y-6 p-5">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Dashboard</Link>
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/contacts">Contacts</Link>
      <Link className="underline" to="/crm/accounts">Accounts</Link>
      <Link className="underline" to="/crm/deals">Deals</Link>
      <Link className="underline" to="/crm/activities">Log call or meeting</Link>
    </nav>
    <header className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-muted">CRM / Communications / Live data</p>
      <h1 className="text-2xl font-semibold">Customer Timeline</h1>
      <p className="text-sm text-muted">Real notes and logged calls, meetings and tasks. This screen does not send emails, messages or place phone calls.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL to load live CRM timelines.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking secure CRM session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email before viewing customer history.</p>
            : !identity.organizations.length ? <p role="alert">No active organization membership.</p>
              : <>
                <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                  <label className="text-sm">Organization
                    <select aria-label="Organization" className="mt-1 block w-full rounded border p-2" value={organizationId}
                      onChange={(event) => {
                        setOrganizationId(event.target.value); storeLiveOrganization(event.target.value);
                        setParams({ type: subjectType }); setRecords(null); setTimeline(null);
                        setFormOpen(false); setEditing(null); setConfirmArchive(null);
                        setPage(1); setError(''); setNotice('');
                      }}>
                      {identity.organizations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
                    </select>
                  </label>
                  <label className="text-sm">CRM record type
                    <select aria-label="CRM record type" className="mt-1 block w-full rounded border p-2" value={subjectType}
                      onChange={(event) => {
                        selectRecord('', event.target.value as ApiTimelineSubject);
                        setSearch(''); setSearchInput('');
                      }}>
                      {types.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                    </select>
                  </label>
                  <form className="flex gap-2 sm:col-span-2" onSubmit={(event) => {
                    event.preventDefault(); setSearch(searchInput.trim());
                  }}>
                    <label className="flex-1 text-sm">Find {subjectType}
                      <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
                        className="mt-1 block w-full rounded border p-2" placeholder="Search live CRM records"/>
                    </label>
                    <button className="self-end rounded border px-4 py-2" type="submit">Search</button>
                  </form>
                  <div className="sm:col-span-2">
                    {visibleRecords?.error ? <p role="alert">{visibleRecords.error}</p>
                      : !visibleRecords ? <p role="status">Loading records…</p>
                        : <label className="block text-sm">Select CRM record
                          <select aria-label="Select CRM record" className="mt-1 block w-full rounded border p-2"
                            value={visibleRecords.items.some((item) => item.id === subjectId) ? subjectId : ''}
                            onChange={(event) => selectRecord(event.target.value)}>
                            <option value="">Select {subjectType}</option>
                            {visibleRecords.items.map((item) =>
                              <option key={item.id} value={item.id}>{item.label}</option>)}
                          </select>
                          <span className="text-xs text-muted">Showing up to 25 matching records. Search for more. Direct record links remain supported.</span>
                        </label>}
                  </div>
                </section>
                {error && <p role="alert" className="rounded border border-red-500 p-3 text-red-600">{error}</p>}
                {notice && <p role="status" className="rounded border p-3">{notice}</p>}
                {!subjectId ? <p className="rounded-xl border p-5 text-sm">Select a CRM record above to see its real communication history.</p>
                  : <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">Activity history</h2>
                      <div className="flex gap-2">
                        <button type="button" className="rounded border px-3 py-2" onClick={refresh}>Refresh</button>
                        {canWrite && <button type="button" className="rounded bg-blue-700 px-4 py-2 text-white"
                          onClick={() => {
                            setDraft({ title: '', body: '' }); setEditing(null); setFormOpen(true);
                            setConfirmArchive(null); setError('');
                          }}>Add note</button>}
                      </div>
                    </div>
                    {formOpen && canWrite && <form className="space-y-3 rounded-xl border p-4"
                      onSubmit={(event) => { void submit(event); }}>
                      <h3 className="font-semibold">{editing ? 'Edit note' : 'New note'}</h3>
                      <label className="block text-sm">Title
                        <input required maxLength={200} className="mt-1 block w-full rounded border p-2"
                          value={draft.title} onChange={(event) => setDraft((old) => ({ ...old, title: event.target.value }))}/>
                      </label>
                      <label className="block text-sm">Notes
                        <textarea required maxLength={20000} rows={5} className="mt-1 block w-full rounded border p-2"
                          value={draft.body} onChange={(event) => setDraft((old) => ({ ...old, body: event.target.value }))}/>
                      </label>
                      <div className="flex gap-3">
                        <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white" type="submit">Save note</button>
                        <button type="button" className="rounded border px-4 py-2"
                          onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</button>
                      </div>
                    </form>}
                    {confirmArchive && <section className="space-y-2 rounded-xl border p-4">
                      <h3 className="font-medium">Archive note?</h3>
                      <p className="text-sm">This removes the note from the visible timeline while retaining the audit record.</p>
                      <div className="flex gap-3">
                        <button type="button" disabled={busy} className="rounded border px-4 py-2"
                          onClick={() => { void confirmDelete(); }}>Confirm archive</button>
                        <button type="button" className="rounded border px-4 py-2"
                          onClick={() => setConfirmArchive(null)}>Cancel</button>
                      </div>
                    </section>}
                    {!visibleTimeline ? <p role="status">Loading timeline…</p>
                      : visibleTimeline.error ? <p role="alert">{visibleTimeline.error}</p>
                        : visibleTimeline.page && <>
                          <p className="text-sm text-muted">{visibleTimeline.page.meta.total} recorded interactions</p>
                          {!visibleTimeline.page.items.length ? <p className="rounded-xl border p-5 text-sm">No interactions logged for this record yet.</p>
                            : <ol className="space-y-3">
                              {visibleTimeline.page.items.map((entry) => <li className="space-y-2 rounded-xl border p-4" key={entry.entry_type + ':' + entry.id}>
                                <div className="flex flex-wrap justify-between gap-2">
                                  <h3 className="font-semibold">{entry.title}</h3>
                                  <span className="text-sm capitalize text-muted">{entry.kind}{entry.status ? ' · ' + entry.status : ''}</span>
                                </div>
                                {entry.description && <p className="whitespace-pre-wrap break-words text-sm">{entry.description}</p>}
                                <p className="text-xs text-muted">{entry.entry_type === 'note' ? 'Noted by ' : 'Assigned to '}{entry.actor_name ?? 'CRM member'} · Logged {new Date(entry.created_at).toLocaleString()}</p>
                                {entry.entry_type === 'note' && canWrite && <div className="flex gap-4 text-sm">
                                  <button className="underline" disabled={busy} type="button"
                                    onClick={() => { void startEdit(entry); }}>Edit note</button>
                                  <button className="underline" disabled={busy} type="button"
                                    onClick={() => { void archive(entry); }}>Archive note</button>
                                </div>}
                              </li>)}
                            </ol>}
                          <div className="flex items-center gap-3 text-sm">
                            <button className="rounded border px-3 py-2" disabled={page <= 1}
                              type="button" onClick={() => setPage((value) => value - 1)}>Previous</button>
                            Page {page} of {Math.max(1, visibleTimeline.page.meta.totalPages)}
                            <button className="rounded border px-3 py-2" disabled={!visibleTimeline.page.meta.hasNext}
                              type="button" onClick={() => setPage((value) => value + 1)}>Next</button>
                          </div>
                        </>}
                  </>}
              </>}
  </main>;
}
