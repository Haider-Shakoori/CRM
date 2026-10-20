import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient,
  type ApiIdentity, type ApiOverviewReport, type ApiPipelineReport, type ApiForecastReport,
} from '../../app/laravelClient';

type ReportState = {
  key: string;
  overview: ApiOverviewReport;
  pipeline: ApiPipelineReport;
  forecast: ApiForecastReport;
};
const formatCount = (value: number) => value.toLocaleString();
const errorMessage = (cause: unknown) =>
  cause instanceof ApiError ? cause.message : 'Could not retrieve live reporting data.';

function Kpi({ label, value, link }: { label: string; value: number; link: string }) {
  return <Link to={link} className="block space-y-2 rounded-xl border bg-surface p-4 hover:shadow-sm">
    <p className="text-sm text-muted">{label}</p>
    <strong className="text-3xl tabular-nums">{formatCount(value)}</strong>
  </Link>;
}

/** Reporting never mixes opportunity amounts with recognized revenue. */
export default function ApiReportingDashboard() {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() =>
    baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [sessionError, setSessionError] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [pipelineId, setPipelineId] = React.useState('');
  const [closeFrom, setCloseFrom] = React.useState('');
  const [closeTo, setCloseTo] = React.useState('');
  const [probabilityDraft, setProbabilityDraft] = React.useState<Record<string, string>>({});
  const [forecastError, setForecastError] = React.useState('');
  const [revision, setRevision] = React.useState(0);
  const [result, setResult] = React.useState<ReportState | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const client = React.useMemo(() =>
    baseUrl ? createLaravelClient({ baseUrl, organizationId }) : null,
    [baseUrl, organizationId]);
  const key = JSON.stringify([organizationId, pipelineId, closeFrom, closeTo, revision]);
  const visible = result?.key === key ? result : null;
  const overview = visible?.overview;
  const pipelineReport = visible?.pipeline;
  const forecast = visible?.forecast;

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((data) => {
      if (!active) return;
      setIdentity(data);
      setOrganizationId(data.organizations[0]?.id ?? '');
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) {
        navigate('/api-sign-in', { replace: true });
      } else setSessionError(errorMessage(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let active = true;
    void Promise.all([client.overviewReport(), client.pipelineReport(pipelineId || undefined),
      client.forecastReport({ pipeline_id: pipelineId || undefined,
        close_from: closeFrom || undefined, close_to: closeTo || undefined })])
      .then(([nextOverview, nextPipeline, nextForecast]) => {
        if (!active) return;
        setResult({ key, overview: nextOverview, pipeline: nextPipeline, forecast: nextForecast });
        setError('');
      }).catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
        else setError(errorMessage(cause));
      });
    return () => { active = false; };
  }, [client, organizationId, identity?.user.email_verified, pipelineId, closeFrom, closeTo, revision, key, navigate]);

  const signOut = async () => {
    if (!auth || busy) return;
    setBusy(true);
    try { await auth.logout(); navigate('/api-sign-in', { replace: true }); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  const canWrite = identity?.organizations.find((org) => org.id === organizationId)?.role !== 'viewer';
  const saveProbability = async (pipeline: string, stage: string, current: number) => {
    if (!client || !canWrite || busy) return;
    const parsed = Number(probabilityDraft[stage] ?? current);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      setForecastError('Stage probabilities must be whole percentages from 0 to 100.');
      return;
    }
    setBusy(true); setForecastError('');
    try {
      await client.updateStageProbability(pipeline, stage, parsed);
      setRevision((rev) => rev + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setForecastError(errorMessage(cause));
    } finally { setBusy(false); }
  };
  // The report endpoint never sums across currencies; no currency conversion is implied.
  const reportPipelines = pipelineReport?.pipelines ?? [];
  const displayPipelines = pipelineId ? reportPipelines.filter((pipe) => pipe.id === pipelineId) : reportPipelines;
  const groups = pipelineReport?.stage_currency_totals ?? [];
  const leadStatusData = overview ? Object.entries(overview.leads_by_status)
    .sort(([a], [b]) => a.localeCompare(b)) : [];
  const maxLeadCount = Math.max(1, ...leadStatusData.map(([, n]) => n));

  return <main className="mx-auto max-w-7xl space-y-7 p-5 sm:p-8">
    <nav className="flex flex-wrap items-center gap-4 text-sm">
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/accounts">Accounts</Link>
      <Link className="underline" to="/crm/contacts">Contacts</Link>
      <Link className="underline" to="/crm/deals">Deals</Link>
      <Link className="underline" to="/crm/my-work">My Work</Link>
      <Link className="underline" to="/crm/subscription">Subscription & Usage</Link>
      <Link className="underline" to="/app/home">Demo dashboard</Link>
      <button type="button" disabled={busy} onClick={() => { void signOut(); }}
        className="ml-auto underline disabled:opacity-50">Sign out</button>
    </nav>
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">CRM / Insights / Live data</p>
      <h1 className="text-3xl font-bold">CRM Dashboard & Reports</h1>
      <p className="text-sm text-muted">Metrics are calculated from your organization's live Laravel/PostgreSQL records, not demo data.</p>
    </header>
    {!baseUrl ? <p role="alert" className="rounded border p-4">Set VITE_CRM_API_URL to enable secure reporting.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking your secure session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email before viewing CRM reports.</p>
            : <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-56 flex-1 space-y-1 text-sm">Organization
                  <select aria-label="Organization" disabled={busy} className="block w-full rounded border p-2"
                    value={organizationId} onChange={(event) => {
                      setOrganizationId(event.target.value);
                      setPipelineId(''); setCloseFrom(''); setCloseTo(''); setProbabilityDraft({});
                      setError(''); setForecastError(''); setResult(null);
                    }}>
                    {identity.organizations.map((org) =>
                      <option value={org.id} key={org.id}>{org.name} ({org.role})</option>)}
                  </select>
                </label>
                <button className="rounded border px-4 py-2" type="button"
                  onClick={() => setRevision((current) => current + 1)}>Refresh figures</button>
              </div>
              {!organizationId ? <p role="alert">No active organization membership available.</p>
                : error ? <p role="alert">{error}</p>
                  : !visible ? <p role="status">Loading live CRM metrics…</p>
                    : <>
                      <p className="text-xs text-muted">As of {overview?.as_of} · Reporting timezone: {overview?.timezone} · Active (non-archived) Deals</p>
                      {overview && <section aria-label="CRM key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                        <Kpi label="Leads" value={overview.totals.leads} link="/crm/leads" />
                        <Kpi label="Contacts" value={overview.totals.contacts} link="/crm/contacts" />
                        <Kpi label="Accounts" value={overview.totals.accounts} link="/crm/accounts" />
                        <Kpi label="Active deals" value={overview.totals.deals} link="/crm/deals" />
                        <Kpi label="Pipelines" value={overview.totals.pipelines} link="/crm/deals" />
                        <Kpi label="Open activities" value={overview.totals.open_activities} link="/crm/activities" />
                        <Kpi label="Open tasks" value={overview.totals.open_tasks} link="/crm/tasks" />
                        <Kpi label="Overdue tasks" value={overview.totals.overdue_tasks} link="/crm/my-work" />
                        <Kpi label="Tasks due today" value={overview.totals.tasks_due_today} link="/crm/my-work" />
                        <Kpi label="Meetings next 7 days" value={overview.totals.meetings_next_7_days} link="/crm/activities" />
                      </section>}
                      <section className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-4 rounded-xl border p-5">
                          <h2 className="text-lg font-semibold">Lead status distribution</h2>
                          {leadStatusData.length === 0 ? <p className="text-sm text-muted">No Leads recorded yet.</p>
                            : <div className="space-y-4">{leadStatusData.map(([name, count]) =>
                              <div className="space-y-1" key={name}>
                                <div className="flex justify-between text-sm"><span className="capitalize">{name.replaceAll('_', ' ')}</span><strong>{formatCount(count)}</strong></div>
                                <div className="h-3 overflow-hidden rounded-full bg-inset">
                                  <div className="h-full rounded-full bg-blue-600" style={{ width: (count / maxLeadCount * 100) + '%' }} />
                                </div>
                              </div>)}</div>}
                        </div>
                        <div className="space-y-4 rounded-xl border p-5">
                          <h2 className="text-lg font-semibold">Activities by type and status</h2>
                          {!overview?.activities_by_kind_status.length ? <p className="text-sm text-muted">No activity records yet.</p>
                            : <table className="w-full text-left text-sm">
                              <thead><tr><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2 text-right">Count</th></tr></thead>
                              <tbody>{overview?.activities_by_kind_status.map((item) =>
                                <tr key={item.kind + item.status} className="border-t">
                                  <td className="p-2 capitalize">{item.kind}</td><td className="p-2 capitalize">{item.status}</td>
                                  <td className="p-2 text-right tabular-nums">{formatCount(item.count)}</td>
                                </tr>)}</tbody>
                            </table>}
                        </div>
                      </section>
                      <section className="space-y-4 rounded-xl border p-5">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-semibold">Sales pipeline report</h2>
                            <p className="text-sm text-muted">Opportunity totals, by stage and original currency. No mixed-currency totals.</p>
                          </div>
                          <label className="min-w-44 space-y-1 text-sm">Pipeline
                            <select aria-label="Filter pipeline" className="block w-full rounded border p-2" value={pipelineId}
                              onChange={(event) => { setPipelineId(event.target.value); setError(''); }}>
                              <option value="">All pipelines</option>
                              {reportPipelines.map((pipe) => <option key={pipe.id} value={pipe.id}>{pipe.name}</option>)}
                            </select>
                          </label>
                        </div>
                        {reportPipelines.length === 0 ? <p className="text-sm text-muted">No pipelines yet. Add one in Live Deals.</p>
                          : <div className="space-y-5">{displayPipelines.map((pipeline) => {
                            const forPipeline = groups.filter((row) => row.pipeline_id === pipeline.id);
                            return <section key={pipeline.id} className="space-y-2">
                              <h3 className="font-medium">{pipeline.name}</h3>
                              <div className="overflow-x-auto rounded border">
                                <table className="w-full text-left text-sm">
                                  <thead><tr><th className="p-3">Stage</th><th className="p-3">Outcome</th><th className="p-3">Currency</th><th className="p-3 text-right">Deals</th><th className="p-3 text-right">Opportunity value</th></tr></thead>
                                  <tbody>{pipeline.stages.flatMap((stage) => {
                                    const rows = forPipeline.filter((row) => row.stage_id === stage.id);
                                    return rows.length ? rows.map((row) =>
                                      <tr className="border-t" key={stage.id + row.currency}>
                                        <td className="p-3">{stage.name}</td><td className="p-3 capitalize">{stage.kind}</td>
                                        <td className="p-3">{row.currency}</td>
                                        <td className="p-3 text-right tabular-nums">{formatCount(row.deal_count)}</td>
                                        <td className="p-3 text-right tabular-nums">{row.deal_value}</td>
                                      </tr>) : [<tr className="border-t" key={stage.id}>
                                        <td className="p-3">{stage.name}</td><td className="p-3 capitalize">{stage.kind}</td>
                                        <td className="p-3">—</td><td className="p-3 text-right">0</td><td className="p-3 text-right">—</td>
                                      </tr>];
                                  })}</tbody>
                                </table>
                              </div>
                            </section>;
                          })}</div>}
                        <p className="text-xs text-muted">{pipelineReport?.definitions.won} {pipelineReport?.definitions.deals}</p>
                      </section>
                      <section className="space-y-4 rounded-xl border p-5" aria-label="Deal forecast">
                        <h2 className="text-lg font-semibold">Stage-weighted deal outlook</h2>
                        <p className="text-sm text-muted">Open deals multiplied by stage probability assumptions, not statistical predictions or recognized revenue. Currencies are never combined.</p>
                        <div className="flex flex-wrap gap-3">
                          <label className="text-sm">Expected close from
                            <input type="date" className="block rounded border p-2" value={closeFrom}
                              onChange={(event) => setCloseFrom(event.target.value)} />
                          </label>
                          <label className="text-sm">Expected close through
                            <input type="date" className="block rounded border p-2" value={closeTo}
                              onChange={(event) => setCloseTo(event.target.value)} />
                          </label>
                        </div>
                        {forecast && <div className="overflow-x-auto rounded border">
                          <table className="w-full text-left text-sm">
                            <thead><tr><th className="p-3">Currency</th><th className="p-3">Deals</th>
                              <th className="p-3">Open amount</th><th className="p-3">Weighted open outlook</th>
                              <th className="p-3">Won opportunities</th><th className="p-3">Lost opportunities</th>
                            </tr></thead>
                            <tbody>{forecast.currencies.map((row) =>
                              <tr className="border-t" key={row.currency}>
                                <td className="p-3 font-semibold">{row.currency}</td>
                                <td className="p-3">{row.deal_count}</td>
                                <td className="p-3 tabular-nums">{row.open_value}</td>
                                <td className="p-3 tabular-nums">{row.weighted_open_value}</td>
                                <td className="p-3 tabular-nums">{row.won_value}</td>
                                <td className="p-3 tabular-nums">{row.lost_value}</td>
                              </tr>)}</tbody>
                          </table>
                          {forecast.currencies.length === 0 && <p className="p-3 text-sm">No deals in the selected outlook window.</p>}
                        </div>}
                        <h3 className="font-semibold">Stage probability assumptions</h3>
                        {forecastError && <p role="alert" className="text-red-600">{forecastError}</p>}
                        <div className="grid gap-3 md:grid-cols-2">{displayPipelines.flatMap((pipeline) =>
                          pipeline.stages.map((stage) => <label className="flex items-center justify-between gap-3 rounded border p-3 text-sm"
                            key={stage.id}>
                            <span>{pipeline.name} / {stage.name} ({stage.kind})</span>
                            <input aria-label={'Probability ' + pipeline.name + ' ' + stage.name} type="number" min={0} max={100} step={1}
                              disabled={stage.kind !== 'open' || !canWrite || busy} className="w-20 rounded border p-2"
                              value={probabilityDraft[stage.id] ?? String(stage.probability)}
                              onChange={(event) => setProbabilityDraft((prev) => ({ ...prev, [stage.id]: event.target.value }))}/>
                            {stage.kind === 'open' && canWrite && <button type="button" disabled={busy}
                              className="underline disabled:opacity-50"
                              onClick={() => { void saveProbability(pipeline.id, stage.id, stage.probability); }}>Save</button>}
                          </label>))}</div>
                        <p className="text-xs text-muted">{forecast?.assumptions.confidence} · {forecast?.assumptions.basis}</p>
                      </section>
                    </>}
            </>}
  </main>;
}
