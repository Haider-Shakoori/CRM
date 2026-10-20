import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiActivity, type ApiActivityKind, type ApiIdentity,
} from '../../app/laravelClient';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';

type MonthResult = {
  key: string; items: ApiActivity[]; total: number; limited: boolean; error?: string;
};
const cap = 1000;
const showError = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Could not load CRM calendar data.';

function localDay(value: Date): string {
  return String(value.getFullYear()) + '-' +
    String(value.getMonth() + 1).padStart(2, '0') + '-' +
    String(value.getDate()).padStart(2, '0');
}
function shiftMonth(start: Date, offset: number): Date {
  return new Date(start.getFullYear(), start.getMonth() + offset, 1);
}

/** Real calendar: only tenant-authorized due activities; never synthetic appointments. */
export default function ApiCalendar() {
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => apiBase ? createLaravelClient({ baseUrl: apiBase }) : null, [apiBase]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [sessionError, setSessionError] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [month, setMonth] = React.useState(() => {
    const now = new Date();
    return localDay(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [selectedDay, setSelectedDay] = React.useState(() => localDay(new Date()));
  const [kind, setKind] = React.useState<ApiActivityKind | ''>('');
  const [revision, setRevision] = React.useState(0);
  const [result, setResult] = React.useState<MonthResult | null>(null);
  const client = React.useMemo(
    () => apiBase ? createLaravelClient({ baseUrl: apiBase, organizationId }) : null,
    [apiBase, organizationId],
  );
  const currentMonth = React.useMemo(() => new Date(month + 'T12:00:00'), [month]);
  const start = React.useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);
  const end = React.useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1), [currentMonth]);
  const key = JSON.stringify([organizationId, month, kind, revision]);
  const visible = result?.key === key ? result : null;
  const memberships = identity?.organizations ?? [];
  const dates = React.useMemo(() => {
    const firstWeekday = (start.getDay() + 6) % 7;
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((firstWeekday + lastDay) / 7) * 7 }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day >= 1 && day <= lastDay ? localDay(new Date(start.getFullYear(), start.getMonth(), day)) : '';
    });
  }, [start]);

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((data) => {
      if (active) { setIdentity(data); setOrganizationId(preferredLiveOrganization(data)); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setSessionError(showError(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let active = true;
    const readMonth = async () => {
      const items: ApiActivity[] = [];
      let total = 0;
      let limited = false;
      for (let page = 1; page <= 10; page++) {
        const response = await client.listActivities({
          page, pageSize: 100, due_from: start.toISOString(), due_to: end.toISOString(),
          kind: kind || undefined,
        });
        if (!active) return;
        items.push(...response.items);
        total = response.meta.total;
        if (!response.meta.hasNext) break;
        if (page === 10) limited = true;
      }
      if (active) setResult({
        key, items, total, limited,
      });
    };
    void readMonth().catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setResult({ key, items: [], total: 0, limited: false, error: showError(cause) });
    });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, start, end, kind, key, navigate]);

  const byDay = React.useMemo(() => {
    const result = new Map<string, ApiActivity[]>();
    for (const item of visible?.items ?? []) {
      if (!item.due_at) continue;
      const value = new Date(item.due_at);
      if (!Number.isFinite(value.getTime())) continue;
      const day = localDay(value);
      result.set(day, [...(result.get(day) ?? []), item]);
    }
    return result;
  }, [visible]);
  const agenda = byDay.get(selectedDay) ?? [];
  const selectedDate = new Date(selectedDay + 'T12:00:00');
  return <main className="mx-auto max-w-7xl space-y-5 p-5">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Live Dashboard</Link>
      <Link className="underline" to="/crm/activities">Live Activities</Link>
      <Link className="underline" to="/crm/tasks">Live Tasks</Link>
      <Link className="underline" to="/crm/deals">Live Deals</Link>
      <Link className="underline" to="/app/home">CRM Home</Link>
    </nav>
    <header>
      <p className="text-xs uppercase tracking-wide text-muted">Laravel CRM / Calendar</p>
      <h1 className="text-2xl font-semibold">CRM Calendar</h1>
      <p className="text-sm text-muted">Real tenant-scoped tasks, calls and meetings with due dates. Times and calendar days use your browser's local time zone, not the organization's reporting time zone.</p>
    </header>
    {!apiBase ? <p role="alert">Set VITE_CRM_API_URL to view the live CRM calendar.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking your CRM session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email to access CRM activities.</p>
            : !memberships.length ? <p role="alert">No active organization membership is available.</p>
              : <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm">Organization
                    <select aria-label="Organization" className="block rounded border p-2" value={organizationId}
                      onChange={(event) => {
                        setOrganizationId(event.target.value); storeLiveOrganization(event.target.value);
                        setResult(null);
                      }}>
                      {memberships.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.role})</option>)}
                    </select>
                  </label>
                  <label className="text-sm">Activity type
                    <select aria-label="Activity type" className="block rounded border p-2" value={kind}
                      onChange={(event) => setKind(event.target.value as ApiActivityKind | '')}>
                      <option value="">All types</option><option value="task">Tasks</option>
                      <option value="meeting">Meetings</option><option value="call">Calls</option>
                    </select>
                  </label>
                  <button type="button" className="rounded border px-3 py-2" onClick={() => setRevision((n) => n + 1)}>Refresh</button>
                </div>
                <section className="rounded-xl border p-4">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <button className="rounded border px-3 py-2" type="button" aria-label="Previous month"
                      onClick={() => {
                        const next = shiftMonth(currentMonth, -1);
                        setMonth(localDay(next)); setSelectedDay(localDay(next));
                      }}>Previous</button>
                    <h2 className="text-lg font-semibold">{currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
                    <button className="rounded border px-3 py-2" type="button" aria-label="Next month"
                      onClick={() => {
                        const next = shiftMonth(currentMonth, 1);
                        setMonth(localDay(next)); setSelectedDay(localDay(next));
                      }}>Next</button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => <span key={name} className="p-2">{name}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {dates.map((day, index) => {
                      const count = day ? (byDay.get(day)?.length ?? 0) : 0;
                      return day ? <button key={day} type="button" aria-pressed={selectedDay === day}
                        className={'min-h-14 rounded border p-2 text-left text-sm ' +
                          (selectedDay === day ? 'border-blue-600 bg-blue-50 text-slate-900' : '')}
                        onClick={() => setSelectedDay(day)}>
                        <span>{Number(day.slice(-2))}</span>
                        {count > 0 && <span className="mt-1 block text-xs">{count} due</span>}
                      </button> : <span key={'blank-' + index} aria-hidden="true" className="min-h-14" />;
                    })}
                  </div>
                </section>
                {!visible ? <p role="status">Loading real CRM activities…</p>
                  : visible.error ? <p role="alert">{visible.error}</p>
                    : <>
                      {visible.limited && <p role="alert">Only the first {cap.toLocaleString()} activities are shown this month. Refine the type filter or use the full Activities list.</p>}
                      <p className="text-sm text-muted">{visible.total} due activities in this calendar month.</p>
                      <section className="space-y-3 rounded-xl border p-5">
                        <h2 className="text-lg font-semibold">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                        {agenda.length === 0 ? <p className="text-sm text-muted">No due activities on the selected day.</p>
                          : <ul className="space-y-3">{agenda.map((activity) =>
                            <li key={activity.id} className="rounded border p-3">
                              <h3 className="font-medium">{activity.title}</h3>
                              <p className="text-sm text-muted">{activity.kind} · {activity.status}
                                {' · '}{activity.due_at ? new Date(activity.due_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''}
                              </p>
                              {activity.notes && <p className="mt-1 text-sm">{activity.notes}</p>}
                            </li>)}</ul>}
                        <Link className="underline" to="/crm/activities">Manage activities in live CRM</Link>
                      </section>
                    </>}
              </>}
  </main>;
}
