import { isLiveCrmMode } from '../../app/LiveRouteBridge';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';
import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient,
  type ActivityInput, type ApiActivity, type ApiActivityEvent,
  type ApiActivityKind, type ApiActivityStatus, type ApiAssignee, type ApiIdentity,
  type ApiPage,
} from '../../app/laravelClient';

type ListData = { key: string; items: ApiActivity[]; meta?: ApiPage<ApiActivity>['meta']; error?: string };
type MemberData = { organizationId: string; members: ApiAssignee[] };
type RecordKind = 'lead' | 'contact' | 'account' | 'deal' | '';
type RecordOption = { id: string; label: string };
type RecordChoices = { key: string; items: RecordOption[]; error?: string };
type Draft = {
  title: string; kind: ApiActivityKind; notes: string; due: string; remind: string;
  assigned_to: string; subjectKind: RecordKind; subjectId: string;
};
const emptyDraft = (): Draft => ({
  title: '', kind: 'task', notes: '', due: '', remind: '', assigned_to: '',
  subjectKind: '', subjectId: '',
});
const explain = (cause: unknown) =>
  cause instanceof ApiError ? cause.message : 'Unable to complete this request.';
const toDatetimeLocal = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const asUtc = (value: string) => value ? new Date(value).toISOString() : null;

/** Database-backed task queue and activity log. Demo screens remain untouched. */
export default function ApiActivities() {
  const pathname = useLocation().pathname;
  const tasksOnly = pathname === '/crm/tasks' || pathname === '/crm/my-work';
  const mineOnly = pathname === '/crm/my-work';
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [sessionError, setSessionError] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const client = React.useMemo(() =>
    baseUrl ? createLaravelClient({ baseUrl, organizationId }) : null, [baseUrl, organizationId]);
  const [members, setMembers] = React.useState<MemberData | null>(null);
  const [list, setList] = React.useState<ListData | null>(null);
  const [queryInput, setQueryInput] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<ApiActivityStatus | ''>('');
  const [kind, setKind] = React.useState<ApiActivityKind | ''>('');
  const [page, setPage] = React.useState(1);
  const [revision, setRevision] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ApiActivity | null>(null);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [choices, setChoices] = React.useState<RecordChoices | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [timeline, setTimeline] = React.useState<{ organizationId: string; id: string; items: ApiActivityEvent[] } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const selectedRole = identity?.organizations.find((entry) => entry.id === organizationId)?.role;
  const canWrite = !!selectedRole && selectedRole !== 'viewer';
  const filterKey = JSON.stringify([organizationId, tasksOnly, mineOnly, page, query, kind, status, revision]);
  const visible = list?.key === filterKey ? list : null;
  const memberOptions = members?.organizationId === organizationId ? members.members : [];
  const recordKey = organizationId + ':' + draft.subjectKind;
  const subjectOptions = choices?.key === recordKey ? choices.items : [];

  const fail = React.useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      navigate('/api-sign-in', { replace: true });
      return;
    }
    setError(explain(cause));
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
      else setSessionError(explain(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let active = true;
    void client.listAssignees().then((data) => {
      if (active) setMembers({ organizationId, members: data });
    }).catch((cause: unknown) => {
      if (active) fail(cause);
    });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, fail]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let active = true;
    void client.listActivities({
      page, pageSize: 25, mine: mineOnly, q: query || undefined,
      kind: tasksOnly ? 'task' : kind || undefined, status: status || undefined,
    }).then((data) => {
      if (active) setList({ key: filterKey, items: data.items, meta: data.meta });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setList({ key: filterKey, items: [], error: explain(cause) });
    });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, tasksOnly, mineOnly, page, query, kind, status, filterKey, navigate]);

  React.useEffect(() => {
    const type = draft.subjectKind;
    if (!client || !organizationId || !type || !identity?.user.email_verified || !formOpen) return;
    let active = true;
    const load = async (): Promise<RecordOption[]> => {
      switch (type) {
        case 'lead':
          return (await client.listLeads({ pageSize: 100 })).items.map((x) => ({ id: x.id, label: x.name }));
        case 'contact':
          return (await client.listContacts({ pageSize: 100 })).items.map((x) => ({
            id: x.id, label: x.first_name + ' ' + x.last_name,
          }));
        case 'account':
          return (await client.listAccounts({ pageSize: 100 })).items.map((x) => ({ id: x.id, label: x.name }));
        case 'deal':
          return (await client.listDeals({ pageSize: 100 })).items.map((x) => ({ id: x.id, label: x.name }));
      }
    };
    void load().then((data) => {
      if (active) setChoices({ key: recordKey, items: data });
    }).catch((cause: unknown) => {
      if (active) setChoices({ key: recordKey, items: [], error: explain(cause) });
    });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, draft.subjectKind, recordKey, formOpen]);

  const refresh = () => setRevision((value) => value + 1);
  const closeForm = () => { setFormOpen(false); setEditing(null); setDraft(emptyDraft()); };
  const openEdit = (item: ApiActivity) => {
    setDeleteId(null); setTimeline(null); setError(''); setNotice(''); setEditing(item);
    const relation = (['lead', 'contact', 'account', 'deal'] as const)
      .find((type) => item[`${type}_id` as keyof ApiActivity] !== null);
    setDraft({
      title: item.title, kind: item.kind, notes: item.notes ?? '',
      due: toDatetimeLocal(item.due_at), remind: toDatetimeLocal(item.remind_at),
      assigned_to: item.assigned_to, subjectKind: relation ?? '',
      subjectId: relation ? String(item[`${relation}_id` as keyof ApiActivity]) : '',
    });
    setFormOpen(true);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !canWrite || busy || !draft.title.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data: ActivityInput = {
        title: draft.title.trim(), kind: draft.kind, notes: draft.notes.trim() || null,
        due_at: asUtc(draft.due), remind_at: asUtc(draft.remind),
        assigned_to: draft.assigned_to || identity?.user.id,
        lead_id: draft.subjectKind === 'lead' ? (draft.subjectId || null) : null,
        contact_id: draft.subjectKind === 'contact' ? (draft.subjectId || null) : null,
        account_id: draft.subjectKind === 'account' ? (draft.subjectId || null) : null,
        deal_id: draft.subjectKind === 'deal' ? (draft.subjectId || null) : null,
      };
      if (editing) await client.updateActivity(editing.id, { ...data, expected_version: editing.version });
      else await client.createActivity(data);
      closeForm(); setPage(1); refresh(); setNotice('Activity saved.');
    } catch (cause) {
      fail(cause);
      if (cause instanceof ApiError && cause.status === 409) {
        closeForm(); refresh(); setNotice('Record changed elsewhere. Reopen its latest version.');
      }
    } finally { setBusy(false); }
  };
  const changeStatus = async (item: ApiActivity, next: ApiActivityStatus) => {
    if (!client || !canWrite || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await client.updateActivity(item.id, { expected_version: item.version, status: next });
      refresh(); setNotice('Activity status updated.');
    } catch (cause) {
      fail(cause);
      if (cause instanceof ApiError && cause.status === 409) {
        refresh(); setNotice('Record changed elsewhere. Latest version reloaded.');
      }
    } finally { setBusy(false); }
  };
  const archive = async () => {
    if (!client || !deleteId || !canWrite || busy) return;
    setBusy(true); setError('');
    try {
      await client.archiveActivity(deleteId);
      setDeleteId(null); setTimeline(null); closeForm(); refresh(); setNotice('Activity archived; history retained.');
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const showHistory = async (id: string) => {
    if (!client) return;
    setError('');
    try {
      const data = await client.getActivityEvents(id);
      setTimeline({ organizationId, id, items: data });
    } catch (cause) { fail(cause); }
  };
  const signOut = async () => {
    if (!auth || busy) return;
    setBusy(true);
    try { await auth.logout(); navigate('/api-sign-in', { replace: true }); }
    catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const field = (key: 'title' | 'notes', title: string) => (
    <label className="block space-y-1 text-sm">
      {title}
      {key === 'notes' ? <textarea value={draft.notes} maxLength={10000} className="block w-full rounded border p-2"
        onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
        : <input required maxLength={200} value={draft.title} className="block w-full rounded border p-2"
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} />}
    </label>
  );

  return <main className="mx-auto max-w-6xl space-y-5 p-5">
    <nav className="flex flex-wrap gap-3 text-sm">
      <Link className="underline" to="/crm/my-work">My Work</Link>
      <Link className="underline" to="/crm/tasks">Live Tasks</Link>
      <Link className="underline" to="/crm/activities">Live Activities</Link>
      <Link className="underline" to="/crm/calendar">Live Calendar</Link>
      <Link className="underline" to="/crm/deals">Live Deals</Link>
      <Link className="underline" to="/crm/timeline">Customer Timeline</Link>
      <Link className="underline" to="/crm/contacts">Live Contacts</Link>
      {!isLiveCrmMode && <Link className="underline" to="/app/activities">Demo Activities</Link>}
      <button type="button" className="ml-auto underline" disabled={busy} onClick={() => { void signOut(); }}>Sign out</button>
    </nav>
    <header>
      <p className="text-xs uppercase text-muted">CRM / Productivity / Live data</p>
      <h1 className="text-2xl font-semibold">{mineOnly ? 'My Work' : tasksOnly ? 'Tasks' : 'Activities'}</h1>
      <p className="text-sm text-muted">Real organization-scoped tasks, calls and meetings. Reminder dates are stored but automatic notifications are not enabled yet.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL to connect to Laravel.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking your secure session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email to access CRM records.</p>
            : <>
              <label className="block max-w-md space-y-1 text-sm">Organization
                <select aria-label="Organization" disabled={busy} className="block w-full rounded border p-2" value={organizationId}
                  onChange={(event) => {
                    setOrganizationId(event.target.value); storeLiveOrganization(event.target.value); setPage(1); setQuery(''); setQueryInput('');
                    setTimeline(null); setDeleteId(null); closeForm(); setError(''); setNotice('');
                  }}>
                  {identity.organizations.map((entry) =>
                    <option key={entry.id} value={entry.id}>{entry.name} ({entry.role})</option>)}
                </select>
              </label>
              {!organizationId ? <p role="alert">No active organization memberships.</p> : <>
                <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                  event.preventDefault(); setPage(1); setQuery(queryInput.trim());
                }}>
                  <label className="min-w-48 flex-1 space-y-1 text-sm">Search
                    <input type="search" aria-label="Search activities" value={queryInput}
                      onChange={(event) => setQueryInput(event.target.value)}
                      className="block w-full rounded border p-2" placeholder="Task, meeting or call" />
                  </label>
                  {!tasksOnly && <label className="space-y-1 text-sm">Type
                    <select aria-label="Filter by type" value={kind} className="block rounded border p-2"
                      onChange={(event) => { setKind(event.target.value as ApiActivityKind | ''); setPage(1); }}>
                      <option value="">All</option><option value="task">Task</option>
                      <option value="call">Call</option><option value="meeting">Meeting</option>
                    </select>
                  </label>}
                  <label className="space-y-1 text-sm">Status
                    <select aria-label="Filter by status" value={status} className="block rounded border p-2"
                      onChange={(event) => { setStatus(event.target.value as ApiActivityStatus | ''); setPage(1); }}>
                      <option value="">All</option><option value="open">Open</option>
                      <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <button className="rounded border px-4 py-2">Search</button>
                  <button type="button" className="rounded border px-4 py-2" onClick={refresh}>Refresh</button>
                  <button type="button" disabled={!canWrite || busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                    onClick={() => { closeForm(); setDeleteId(null); setDraft({ ...emptyDraft(), kind: tasksOnly ? 'task' : 'task', assigned_to: identity.user.id }); setFormOpen(true); }}>
                    New {tasksOnly ? 'task' : 'activity'}
                  </button>
                </form>
                {error && <p role="alert" className="text-red-600">{error}</p>}
                {notice && <p role="status">{notice}</p>}
                {formOpen && canWrite && <form className="space-y-3 rounded border p-4"
                  onSubmit={(event) => { void submit(event); }}>
                  <h2 className="text-lg font-semibold">{editing ? 'Edit' : 'New'} {tasksOnly ? 'task' : 'activity'}</h2>
                  {field('title', 'Title')}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">Type
                      <select value={draft.kind} disabled={tasksOnly} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, kind: event.target.value as ApiActivityKind }))}>
                        <option value="task">Task</option><option value="call">Call</option><option value="meeting">Meeting</option>
                      </select>
                    </label>
                    <label className="block space-y-1 text-sm">Assigned to
                      <select value={draft.assigned_to} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, assigned_to: event.target.value }))}>
                        <option value="">Myself (default)</option>
                        {memberOptions.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.role})</option>)}
                      </select>
                    </label>
                    <label className="block space-y-1 text-sm">Due date / scheduled call or meeting
                      <input type="datetime-local" value={draft.due} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, due: event.target.value }))} />
                    </label>
                    <label className="block space-y-1 text-sm">Reminder date (no automatic message yet)
                      <input type="datetime-local" value={draft.remind} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, remind: event.target.value }))} />
                    </label>
                    <label className="block space-y-1 text-sm">Linked CRM record type
                      <select value={draft.subjectKind} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({
                          ...old, subjectKind: event.target.value as RecordKind, subjectId: '',
                        }))}>
                        <option value="">No linked record</option>
                        <option value="lead">Lead</option><option value="contact">Contact</option>
                        <option value="account">Account</option><option value="deal">Deal</option>
                      </select>
                    </label>
                    {draft.subjectKind && <label className="block space-y-1 text-sm">Linked record
                      <select value={draft.subjectId} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, subjectId: event.target.value }))}>
                        <option value="">No link</option>
                        {subjectOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        {draft.subjectId && !subjectOptions.some((option) => option.id === draft.subjectId) &&
                          <option value={draft.subjectId}>Previously linked record</option>}
                      </select>
                      <span className="text-xs text-muted">First 100 matching records; server validates every link.</span>
                      {choices?.key === recordKey && choices.error && <span role="alert">{choices.error}</span>}
                    </label>}
                  </div>
                  {field('notes', 'Notes')}
                  <div className="flex gap-2">
                    <button className="rounded bg-blue-700 px-4 py-2 text-white" disabled={busy}>Save</button>
                    <button type="button" className="rounded border px-4 py-2" onClick={closeForm}>Cancel</button>
                  </div>
                </form>}
                {!visible ? <p role="status">Loading organization activities…</p>
                  : visible.error ? <p role="alert">{visible.error}</p>
                    : <div className="overflow-x-auto rounded border">
                      <table className="w-full text-left text-sm">
                        <thead><tr>
                          <th className="p-3">Title</th><th className="p-3">Type</th><th className="p-3">Assigned</th>
                          <th className="p-3">Due</th><th className="p-3">Status</th><th className="p-3">Actions</th>
                        </tr></thead>
                        <tbody>{visible.items.map((item) => {
                          const assignee = memberOptions.find((x) => x.id === item.assigned_to);
                          return <tr key={item.id} className="border-t">
                            <td className="min-w-48 p-3 font-medium">{item.title}</td>
                            <td className="p-3 capitalize">{item.kind}</td>
                            <td className="p-3">{assignee?.name ?? 'Organization member'}</td>
                            <td className="p-3">{item.due_at ? new Date(item.due_at).toLocaleString() : '—'}</td>
                            <td className="p-3 capitalize">{item.status}</td>
                            <td className="min-w-48 space-x-3 p-3">
                              {item.status !== 'completed' ? <button type="button" className="underline disabled:opacity-50"
                                disabled={!canWrite || busy} onClick={() => { void changeStatus(item, 'completed'); }}>Complete</button>
                                : <button type="button" className="underline disabled:opacity-50" disabled={!canWrite || busy}
                                  onClick={() => { void changeStatus(item, 'open'); }}>Reopen</button>}
                              <button type="button" className="underline disabled:opacity-50" disabled={!canWrite || busy}
                                onClick={() => openEdit(item)}>Edit</button>
                              <button type="button" className="underline"
                                onClick={() => { void showHistory(item.id); }}>History</button>
                              <button type="button" className="underline disabled:opacity-50" disabled={!canWrite || busy}
                                onClick={() => { closeForm(); setDeleteId(item.id); }}>Archive</button>
                            </td>
                          </tr>;
                        })}</tbody>
                      </table>
                      {!visible.items.length && <p className="p-4 text-sm">No matching activities.</p>}
                      {visible.meta && <nav aria-label="Activity pages" className="flex items-center justify-between gap-3 border-t p-3 text-sm">
                        <span>Page {visible.meta.page} of {visible.meta.totalPages} · {visible.meta.total} total</span>
                        <div className="flex gap-2">
                          <button type="button" className="rounded border px-3 py-1 disabled:opacity-50"
                            disabled={!visible.meta.hasPrev || busy} onClick={() => setPage((n) => Math.max(1, n - 1))}>Previous</button>
                          <button type="button" className="rounded border px-3 py-1 disabled:opacity-50"
                            disabled={!visible.meta.hasNext || busy} onClick={() => setPage((n) => n + 1)}>Next</button>
                        </div>
                      </nav>}
                    </div>}
                {deleteId && canWrite && <section aria-label="Confirm activity archive" className="space-y-3 rounded border p-4">
                  <p>Archive this activity? Its audit history will be retained.</p>
                  <button type="button" disabled={busy} className="rounded bg-red-700 px-4 py-2 text-white" onClick={() => { void archive(); }}>Confirm archive</button>
                  <button type="button" className="ml-3 rounded border px-4 py-2" onClick={() => setDeleteId(null)}>Cancel</button>
                </section>}
                {timeline && timeline.organizationId === organizationId && <section className="space-y-2 rounded border p-4" aria-label="Activity history">
                  <h2 className="font-semibold">Activity history</h2>
                  <button className="underline text-sm" onClick={() => setTimeline(null)}>Close</button>
                  <ol className="space-y-2 text-sm">{timeline.items.map((entry) => <li key={entry.id}>
                    <strong className="capitalize">{entry.action.replace('_', ' ')}</strong> · {new Date(entry.created_at).toLocaleString()}
                  </li>)}</ol>
                </section>}
              </>}
            </>}
  </main>;
}
