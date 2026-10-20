import { isLiveCrmMode } from '../../app/LiveRouteBridge';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiAccount, type ApiDeal, type ApiDealEvent, type ApiIdentity,
  type ApiPage, type ApiPipeline, type ApiStageKind,
} from '../../app/laravelClient';

type BoardState = { key: string; items: ApiDeal[]; meta?: ApiPage<ApiDeal>['meta']; error?: string };
type PipelineState = { organizationId: string; items: ApiPipeline[] };
type Draft = { name: string; amount: string; currency: string; notes: string; expected_close_date: string; account_id: string };
const emptyDraft = (): Draft => ({ name: '', amount: '0', currency: 'USD', notes: '', expected_close_date: '', account_id: '' });
const readableError = (error: unknown) => error instanceof ApiError ? error.message : 'The request could not be completed.';

/**
 * Authenticated Laravel pipeline board. The rich demo Deals UI remains mock-backed
 * until all of its downstream forecasting/activities contracts exist.
 */
export default function ApiDeals() {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [authError, setAuthError] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [pipelineState, setPipelineState] = React.useState<PipelineState | null>(null);
  const [pipelineId, setPipelineId] = React.useState('');
  const [accountOptions, setAccountOptions] = React.useState<{ organizationId: string; items: ApiAccount[] } | null>(null);
  const [pipelineName, setPipelineName] = React.useState('');
  const [stageName, setStageName] = React.useState('');
  const [stageKind, setStageKind] = React.useState<ApiStageKind>('open');
  const [boardState, setBoardState] = React.useState<BoardState | null>(null);
  const [searchInput, setSearchInput] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [revision, setRevision] = React.useState(0);
  const [pipelineRevision, setPipelineRevision] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<ApiDeal | null>(null);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [archiveId, setArchiveId] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<{ id: string; organizationId: string; items: ApiDealEvent[] } | null>(null);
  const [historyBusy, setHistoryBusy] = React.useState(false);
  const client = React.useMemo(
    () => baseUrl ? createLaravelClient({ baseUrl, organizationId }) : null, [baseUrl, organizationId],
  );
  const role = identity?.organizations.find((org) => org.id === organizationId)?.role;
  const selectableAccounts = accountOptions?.organizationId === organizationId ? accountOptions.items : [];
  const writable = !!role && role !== 'viewer';
  const pipelines = pipelineState?.organizationId === organizationId ? pipelineState.items : [];
  const active = pipelines.find((pipe) => pipe.id === pipelineId);
  const boardKey = JSON.stringify([organizationId, pipelineId, page, query, revision]);
  const board = boardState?.key === boardKey ? boardState : null;

  const fail = React.useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      navigate('/api-sign-in', { replace: true });
      return;
    }
    setError(readableError(cause));
  }, [navigate]);

  React.useEffect(() => {
    if (!auth) return;
    let current = true;
    void auth.me().then((data) => {
      if (!current) return;
      setIdentity(data);
      setOrganizationId(preferredLiveOrganization(data));
    }).catch((cause: unknown) => {
      if (!current) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setAuthError(readableError(cause));
    });
    return () => { current = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let current = true;
    void client.listPipelines().then((items) => {
      if (current) setPipelineState({ organizationId, items });
    }).catch((cause: unknown) => {
      if (!current) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setError(readableError(cause));
    });
    return () => { current = false; };
  }, [client, organizationId, identity?.user.email_verified, pipelineRevision, navigate]);

  React.useEffect(() => {
    if (!client || !organizationId || !identity?.user.email_verified) return;
    let current = true;
    void client.listAccounts({ pageSize: 100 }).then((data) => {
      if (current) setAccountOptions({ organizationId, items: data.items });
    }).catch(() => {
      if (current) setAccountOptions({ organizationId, items: [] });
    });
    return () => { current = false; };
  }, [client, organizationId, identity?.user.email_verified]);

  React.useEffect(() => {
    if (!client || !active || !identity?.user.email_verified) return;
    let current = true;
    void client.listDeals({ pipeline_id: active.id, page, pageSize: 100, q: query || undefined })
      .then((data) => { if (current) setBoardState({ key: boardKey, items: data.items, meta: data.meta }); })
      .catch((cause: unknown) => {
        if (!current) return;
        if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
        else setBoardState({ key: boardKey, items: [], error: readableError(cause) });
      });
    return () => { current = false; };
  }, [client, active, identity?.user.email_verified, boardKey, page, query, navigate]);

  const refresh = () => setRevision((n) => n + 1);
  const refreshPipelines = () => setPipelineRevision((n) => n + 1);
  const resetForm = () => { setFormOpen(false); setEdit(null); setDraft(emptyDraft()); };
  const submitPipeline = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !writable || busy || !pipelineName.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const pipeline = await client.createPipeline(pipelineName.trim());
      setPipelineId(pipeline.id); setPipelineName(''); setPage(1); refreshPipelines(); refresh();
      setNotice('Pipeline created with five standard stages.');
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const submitStage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !active || !writable || busy || !stageName.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await client.addPipelineStage(active.id, stageName.trim(), stageKind);
      setStageName(''); setStageKind('open'); refreshPipelines();
      setNotice('Stage added to the selected pipeline.');
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const submitDeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !active || !writable || busy || !draft.name.trim()) return;
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) { setError('Enter a valid nonnegative amount.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const fields = {
        name: draft.name.trim(), amount, currency: draft.currency.trim().toUpperCase(),
        notes: draft.notes.trim() || null,
        expected_close_date: draft.expected_close_date || null,
        account_id: draft.account_id || null,
      };
      if (edit) {
        await client.updateDeal(edit.id, { ...fields, expected_version: edit.version });
      } else {
        await client.createDeal({
          ...fields, pipeline_id: active.id, stage_id: active.stages[0]!.id,
        });
      }
      resetForm(); setPage(1); refresh(); setNotice('Deal saved.');
    } catch (cause) {
      fail(cause);
      if (cause instanceof ApiError && cause.status === 409) {
        resetForm(); refresh(); setNotice('This deal changed elsewhere. Reopen its latest version.');
      }
    } finally { setBusy(false); }
  };
  const move = async (deal: ApiDeal, stageId: string) => {
    if (!client || !writable || busy || stageId === deal.stage_id) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await client.moveDeal(deal.id, stageId, deal.version);
      refresh(); setNotice('Stage moved and recorded in deal history.');
      if (history?.id === deal.id) setHistory(null);
    } catch (cause) {
      fail(cause);
      if (cause instanceof ApiError && cause.status === 409) { refresh(); setNotice('Deal changed elsewhere. Reloaded.'); }
    } finally { setBusy(false); }
  };
  const archive = async () => {
    if (!client || !writable || busy || !archiveId) return;
    setBusy(true); setError('');
    try {
      await client.archiveDeal(archiveId);
      setArchiveId(null); setHistory(null); refresh(); setNotice('Deal archived. History retained.');
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const openHistory = async (id: string) => {
    if (!client) return;
    setHistoryBusy(true); setError('');
    try {
      const items = await client.getDealEvents(id);
      setHistory({ id, organizationId, items });
    } catch (cause) { fail(cause); }
    finally { setHistoryBusy(false); }
  };
  const signOut = async () => {
    if (!auth || busy) return;
    setBusy(true);
    try { await auth.logout(); navigate('/api-sign-in', { replace: true }); }
    catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-7xl space-y-5 p-5">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link to="/crm/leads" className="underline">Live Leads</Link>
      <Link to="/crm/accounts" className="underline">Live Accounts</Link>
      <Link to="/crm/contacts" className="underline">Live Contacts</Link>
      <Link to="/crm/my-work" className="underline">Live My Work</Link>
      {!isLiveCrmMode && <Link to="/app/deals" className="underline">Demo Deals</Link>}
      <button type="button" disabled={busy} className="ml-auto underline" onClick={() => { void signOut(); }}>Sign out</button>
    </nav>
    <header>
      <p className="text-xs font-semibold uppercase text-muted">CRM / Sales / Live data</p>
      <h1 className="text-2xl font-semibold">Sales Pipelines & Deals</h1>
      <p className="text-sm text-muted">Real PostgreSQL pipeline board. Forecasting and other demo CRM modules remain simulated.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL to connect to the CRM API.</p>
      : authError ? <p role="alert">{authError}</p>
        : !identity ? <p role="status">Checking your secure session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email before accessing CRM records.</p>
            : <>
              <label className="block max-w-md space-y-1 text-sm">Organization
                <select aria-label="Organization" className="block w-full rounded border p-2" value={organizationId}
                  disabled={busy} onChange={(event) => {
                    setOrganizationId(event.target.value); storeLiveOrganization(event.target.value); setPipelineId(''); setPage(1);
                    setQuery(''); setSearchInput(''); setHistory(null); resetForm(); setArchiveId(null);
                    setError(''); setNotice('');
                  }}>
                  {identity.organizations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
                </select>
              </label>
              {error && <p role="alert" className="text-red-600">{error}</p>}
              {notice && <p role="status">{notice}</p>}
              {!organizationId ? <p role="alert">You have no active organization membership.</p> : <>
                <form onSubmit={(event) => { void submitPipeline(event); }} className="flex flex-wrap items-end gap-3 rounded border p-3">
                  <label className="flex-1 space-y-1 text-sm">New pipeline
                    <input aria-label="New pipeline name" required maxLength={150} value={pipelineName}
                      onChange={(event) => setPipelineName(event.target.value)}
                      className="block w-full rounded border p-2" placeholder="Enterprise sales" />
                  </label>
                  <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={!writable || busy}>Create pipeline</button>
                </form>
                <label className="block max-w-md space-y-1 text-sm">Pipeline
                  <select aria-label="Pipeline" value={active?.id ?? ''} className="block w-full rounded border p-2" disabled={busy}
                    onChange={(event) => { setPipelineId(event.target.value); setPage(1); setHistory(null); resetForm(); setArchiveId(null); }}>
                    <option value="">Select a pipeline</option>
                    {pipelines.map((pipe) => <option value={pipe.id} key={pipe.id}>{pipe.name}</option>)}
                  </select>
                </label>
                {!pipelineState || pipelineState.organizationId !== organizationId
                  ? <p role="status">Loading pipelines…</p>
                  : pipelines.length === 0 ? <p>Create your first pipeline to begin tracking sales deals.</p> : null}
                {active && <>
                  <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                    event.preventDefault(); setPage(1); setQuery(searchInput.trim());
                  }}>
                    <label className="flex-1 space-y-1 text-sm">Search deals
                      <input type="search" aria-label="Search deals" value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        className="block w-full rounded border p-2" placeholder="Deal name" />
                    </label>
                    <button className="rounded border px-4 py-2">Search</button>
                    <button type="button" className="rounded border px-4 py-2" onClick={refresh}>Refresh</button>
                    <button type="button" disabled={!writable || busy || active.stages.length === 0}
                      className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                      onClick={() => { resetForm(); setArchiveId(null); setFormOpen(true); }}>New deal</button>
                  </form>
                  <form className="flex flex-wrap items-end gap-2 rounded border p-3 text-sm"
                    onSubmit={(event) => { void submitStage(event); }}>
                    <label className="flex-1 space-y-1">Stage name
                      <input aria-label="New stage name" required maxLength={120} value={stageName}
                        onChange={(event) => setStageName(event.target.value)}
                        className="block w-full rounded border p-2" placeholder="Negotiation" />
                    </label>
                    <label className="space-y-1">Outcome
                      <select aria-label="Stage outcome" className="block rounded border p-2"
                        value={stageKind} onChange={(event) => setStageKind(event.target.value as ApiStageKind)}>
                        <option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option>
                      </select>
                    </label>
                    <button disabled={!writable || busy} className="rounded border px-4 py-2 disabled:opacity-50">Add stage</button>
                  </form>
                  {formOpen && writable && <form className="grid gap-3 rounded border p-4 sm:grid-cols-2"
                    onSubmit={(event) => { void submitDeal(event); }}>
                    <h2 className="sm:col-span-2 text-lg font-medium">{edit ? 'Edit deal' : 'New deal'}</h2>
                    <label className="space-y-1 text-sm">Name
                      <input required maxLength={200} value={draft.name} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, name: event.target.value }))} />
                    </label>
                    <label className="space-y-1 text-sm">Amount
                      <input type="number" required min={0} step="0.01" value={draft.amount} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, amount: event.target.value }))} />
                    </label>
                    <label className="space-y-1 text-sm">Currency
                      <input required maxLength={3} minLength={3} value={draft.currency} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, currency: event.target.value }))} />
                    </label>
                    <label className="space-y-1 text-sm">Linked account (optional)
                      <select value={draft.account_id} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, account_id: event.target.value }))}>
                        <option value="">No linked account</option>
                        {selectableAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">Expected close date
                      <input type="date" value={draft.expected_close_date} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, expected_close_date: event.target.value }))} />
                    </label>
                    <label className="space-y-1 text-sm sm:col-span-2">Notes
                      <textarea value={draft.notes} className="block w-full rounded border p-2"
                        onChange={(event) => setDraft((old) => ({ ...old, notes: event.target.value }))} />
                    </label>
                    <p className="text-xs text-muted sm:col-span-2">Account choices show the first 100 accounts; a searchable picker is planned for a later batch.</p>
                    <div className="flex gap-2 sm:col-span-2">
                      <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white">Save deal</button>
                      <button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Cancel</button>
                    </div>
                  </form>}
                  {!board ? <p role="status">Loading deals for the selected pipeline…</p>
                    : board.error ? <p role="alert">{board.error}</p>
                      : <>
                        <p className="text-xs text-muted">Showing up to 100 deals per page. {board.meta?.total ?? board.items.length} matching records.</p>
                        <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                          {active.stages.map((stage) => {
                            const items = board.items.filter((deal) => deal.stage_id === stage.id);
                            return <section key={stage.id} className="min-w-0 space-y-3 rounded-lg border p-3">
                              <h2 className="text-sm font-semibold">{stage.name} <span className="text-xs text-muted">({items.length})</span></h2>
                              <p className="text-xs capitalize text-muted">{stage.kind}</p>
                              {items.length === 0 && <p className="text-xs text-muted">No deals on this page</p>}
                              {items.map((deal) => <article key={deal.id} className="space-y-2 rounded border bg-surface p-3 text-sm">
                                <h3 className="break-words font-medium">{deal.name}</h3>
                                <p className="text-muted">{deal.amount} {deal.currency}</p>
                                <p className="text-xs text-muted">Version {deal.version}</p>
                                <label className="block space-y-1 text-xs">Move to
                                  <select aria-label={'Move ' + deal.name} value={deal.stage_id} disabled={!writable || busy}
                                    className="block w-full rounded border p-1 disabled:opacity-50"
                                    onChange={(event) => { void move(deal, event.target.value); }}>
                                    {active.stages.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}
                                  </select>
                                </label>
                                <div className="flex flex-wrap gap-3 text-xs">
                                  <button className="underline" disabled={historyBusy} onClick={() => { void openHistory(deal.id); }}>History</button>
                                  <button className="underline disabled:opacity-50" disabled={!writable || busy}
                                    onClick={() => {
                                      setEdit(deal); setFormOpen(true); setArchiveId(null);
                                      setDraft({ name: deal.name, amount: deal.amount, currency: deal.currency,
                                        notes: deal.notes ?? '', expected_close_date: deal.expected_close_date ?? '',
                                        account_id: deal.account_id ?? '' });
                                    }}>Edit</button>
                                  <button className="underline disabled:opacity-50" disabled={!writable || busy}
                                    onClick={() => { resetForm(); setArchiveId(deal.id); }}>Archive</button>
                                </div>
                              </article>)}
                            </section>;
                          })}
                        </div>
                        {board.meta && <nav aria-label="Deal pages" className="flex justify-between gap-3 text-sm">
                          <span>Page {board.meta.page} of {board.meta.totalPages}</span>
                          <div className="flex gap-2">
                            <button className="rounded border px-3 py-1 disabled:opacity-50"
                              disabled={!board.meta.hasPrev || busy} onClick={() => setPage((n) => Math.max(1, n - 1))}>Previous</button>
                            <button className="rounded border px-3 py-1 disabled:opacity-50"
                              disabled={!board.meta.hasNext || busy} onClick={() => setPage((n) => n + 1)}>Next</button>
                          </div>
                        </nav>}
                      </>}
                  {archiveId && writable && <section className="space-y-3 rounded border p-4" aria-label="Confirm deal archive">
                    <p>Archive this deal? Its activity timeline is preserved for auditing.</p>
                    <button className="rounded bg-red-700 px-4 py-2 text-white" disabled={busy} onClick={() => { void archive(); }}>Confirm archive</button>
                    <button className="ml-3 rounded border px-4 py-2" onClick={() => setArchiveId(null)}>Cancel</button>
                  </section>}
                  {history && history.organizationId === organizationId && <section className="space-y-2 rounded border p-4" aria-label="Deal history">
                    <h2 className="text-lg font-medium">Deal timeline</h2>
                    <button className="underline text-sm" onClick={() => setHistory(null)}>Close history</button>
                    {history.items.length === 0 && <p>No events.</p>}
                    <ol className="space-y-2 text-sm">{history.items.map((event) =>
                      <li key={event.id} className="border-b py-1">
                        <strong className="capitalize">{event.action}</strong> · {new Date(event.created_at).toLocaleString()}
                        {event.action === 'moved' && <span> — stage movement recorded</span>}
                      </li>)}</ol>
                  </section>}
                </>}
              </>}
            </>}
  </main>;
}
