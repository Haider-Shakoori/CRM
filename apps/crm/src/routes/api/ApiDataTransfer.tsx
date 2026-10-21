import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiIdentity, type ApiTransferPreview,
} from '../../app/laravelClient';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';
import { createSafeCsv, importHeaders, parseCrmCsv, type ImportEntity } from '../../app/crmCsv';

const maxExportPages = 10;
const explain = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Could not complete bulk CRM transfer.';

export default function ApiDataTransfer() {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [organizationId, setOrganizationId] = React.useState('');
  const [entity, setEntity] = React.useState<ImportEntity>('leads');
  const [rows, setRows] = React.useState<Array<Record<string, string>>>([]);
  const [fileName, setFileName] = React.useState('');
  const [preview, setPreview] = React.useState<ApiTransferPreview | null>(null);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [startPage, setStartPage] = React.useState(1);
  const role = identity?.organizations.find((item) => item.id === organizationId)?.role;
  const canTransfer = role === 'owner' || role === 'admin';
  const client = React.useMemo(() =>
    baseUrl ? createLaravelClient({ baseUrl, organizationId }) : null, [baseUrl, organizationId]);

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((data) => {
      if (active) { setIdentity(data); setOrganizationId(preferredLiveOrganization(data)); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setError(explain(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  const reset = () => {
    setRows([]); setFileName(''); setPreview(null); setError(''); setNotice('');
  };
  const fileSelected = async (file: File | undefined) => {
    reset();
    if (!file) return;
    try {
      if (file.size > 256_000) throw new Error('CSV files must be 256 KB or smaller.');
      const text = await file.text();
      const parsed = parseCrmCsv(text, entity);
      setRows(parsed); setFileName(file.name);
    } catch (cause) { setError(explain(cause)); }
  };
  const check = async () => {
    if (!client || !canTransfer || busy || !rows.length) return;
    setBusy(true); setError(''); setPreview(null); setNotice('');
    try { setPreview(await client.previewDataImport(entity, rows)); }
    catch (cause) { setError(explain(cause)); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!client || !canTransfer || busy || !preview?.valid || !rows.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await client.importData(entity, rows);
      setNotice('Imported ' + created.created + ' ' + entity + '. All records were committed together.');
      setRows([]); setPreview(null); setFileName('');
    } catch (cause) {
      setPreview(null);
      setError(explain(cause) + ' Nothing was imported if server validation failed; preview again.');
    } finally { setBusy(false); }
  };
  const download = async () => {
    if (!client || !canTransfer || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const all: Array<Record<string, unknown>> = [];
      let columns: string[] = [];
      let lastPage = startPage;
      let hasNext = false;
      for (let offset = 0; offset < maxExportPages; offset++) {
        const response = await client.exportDataPage(entity, startPage + offset);
        columns = response.columns;
        all.push(...response.items);
        lastPage = startPage + offset;
        hasNext = response.meta.hasNext;
        if (!hasNext) break;
      }
      const csv = createSafeCsv(columns, all);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'crm-' + entity + '-part-' + startPage + '-' + lastPage + '.csv';
        anchor.click();
      } finally { URL.revokeObjectURL(url); }
      setStartPage(hasNext ? lastPage + 1 : 1);
      setNotice('Downloaded ' + all.length + ' ' + entity + ' records.' +
        (hasNext ? ' Additional records exist. Download the next page range to get the rest.' :
          ' This was the final page of the selected export.'));
    } catch (cause) { setError(explain(cause)); }
    finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Dashboard</Link>
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/contacts">Contacts</Link>
      <Link className="underline" to="/crm/accounts">Accounts</Link>
      <Link className="underline" to="/crm/timeline">Customer Timeline</Link>
    </nav>
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted">CRM / Data administration / Laravel</p>
      <h1 className="text-2xl font-semibold">CRM CSV Import & Export</h1>
      <p className="text-sm text-muted">Administrator-only bulk records. Preview validates data without saving it. Imports commit as one transaction and enforce existing plan quotas.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL before accessing live CRM data transfer.</p>
      : error && !identity ? <p role="alert">{error}</p>
        : !identity ? <p role="status">Checking your secure CRM session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email to manage CRM data transfers.</p>
            : !identity.organizations.length ? <p role="alert">No active organization membership.</p>
              : <>
                <label className="block max-w-lg text-sm">Organization
                  <select aria-label="Organization" className="mt-1 block w-full rounded border p-2"
                    value={organizationId} disabled={busy}
                    onChange={(event) => {
                      storeLiveOrganization(event.target.value); setOrganizationId(event.target.value);
                      reset(); setStartPage(1);
                    }}>
                    {identity.organizations.map((org) =>
                      <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
                  </select>
                </label>
                {!canTransfer ? <p role="alert">Bulk import and export require an organization owner or administrator.</p>
                  : <>
                    <label className="block max-w-xs text-sm">Record type
                      <select aria-label="Record type" className="mt-1 block w-full rounded border p-2"
                        value={entity} disabled={busy} onChange={(event) => {
                          setEntity(event.target.value as ImportEntity); reset(); setStartPage(1);
                        }}>
                        <option value="leads">Leads</option>
                        <option value="contacts">Contacts</option>
                        <option value="accounts">Accounts</option>
                      </select>
                    </label>
                    {error && <p role="alert" className="rounded border border-red-500 p-3 text-sm text-red-600">{error}</p>}
                    {notice && <p role="status" className="rounded border p-3 text-sm">{notice}</p>}
                    <section className="space-y-4 rounded-xl border p-5">
                      <h2 className="text-lg font-semibold">Import CSV</h2>
                      <p className="text-sm text-muted">Required columns: {entity === 'contacts' ? 'first_name, last_name' : 'name'}. Supported columns: {importHeaders[entity].join(', ')}. Maximum 100 records or 256 KB per file. Duplicate email or Account name is rejected.</p>
                      <label className="block text-sm">Choose a CSV file
                        <input type="file" accept=".csv,text/csv" className="mt-1 block w-full"
                          disabled={busy} onChange={(event) => { void fileSelected(event.target.files?.[0]); }}/>
                      </label>
                      {!!rows.length && <p className="text-sm">{fileName}: {rows.length} rows parsed locally. Nothing saved yet.</p>}
                      <div className="flex gap-3">
                        <button type="button" disabled={!rows.length || busy} className="rounded border px-4 py-2 disabled:opacity-50"
                          onClick={() => { void check(); }}>Preview validation</button>
                        <button type="button" disabled={!preview?.valid || busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                          onClick={() => { void commit(); }}>Import validated rows</button>
                      </div>
                      {preview && <section className="space-y-2" aria-label="Import preview">
                        <p className="font-medium">{preview.valid
                          ? 'Ready to import ' + preview.will_create + ' records.'
                          : 'Validation failed. No records can be imported until problems are fixed.'}</p>
                        <p className="text-sm text-muted">{preview.message}</p>
                        {preview.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">
                          {preview.issues.slice(0, 100).map((issue, index) =>
                            <li key={index}>Row {issue.row}, {issue.field}: {issue.message}</li>)}
                        </ul>}
                      </section>}
                    </section>
                    <section className="space-y-4 rounded-xl border p-5">
                      <h2 className="text-lg font-semibold">Export CSV</h2>
                      <p className="text-sm text-muted">Exports only approved CRM columns. Each file holds up to 1,000 records and is logged in the audit trail. Download additional page ranges when prompted. Spreadsheet formulas are escaped.</p>
                      <label className="block max-w-xs text-sm">Start at API page (100 records/page)
                        <input type="number" min={1} step={1} max={10000} value={startPage}
                          onChange={(event) => setStartPage(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                          className="mt-1 block w-full rounded border p-2"/>
                      </label>
                      <button type="button" disabled={busy} className="rounded border px-4 py-2 disabled:opacity-50"
                        onClick={() => { void download(); }}>Download {entity} CSV</button>
                    </section>
                  </>}
              </>}
  </main>;
}
