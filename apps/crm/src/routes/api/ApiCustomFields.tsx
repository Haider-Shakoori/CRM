import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ApiError, createLaravelClient, type ApiCustomField, type ApiCustomFieldType,
  type ApiCustomFieldValue, type ApiCustomObject, type ApiCustomValue, type ApiIdentity,
} from '../../app/laravelClient';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';

const objectTypes: ApiCustomObject[] = ['lead', 'contact', 'account', 'deal'];
const fieldTypes: ApiCustomFieldType[] = ['text', 'number', 'date', 'boolean', 'select'];
const message = (cause: unknown) => cause instanceof ApiError ? cause.message : 'The request could not be completed.';
type RecordChoice = { id: string; label: string };

function FieldValueRow({ row, writable, busy, onSave }: {
  row: ApiCustomFieldValue;
  writable: boolean;
  busy: boolean;
  onSave: (row: ApiCustomFieldValue, value: ApiCustomValue) => Promise<void>;
}) {
  const { field, value } = row;
  const [draft, setDraft] = React.useState(value === null ? '' : String(value));
  const [booleanDraft, setBooleanDraft] = React.useState(value === null ? '' : value ? 'true' : 'false');
  const parsed: ApiCustomValue | null = field.field_type === 'boolean'
    ? booleanDraft === '' ? null : booleanDraft === 'true'
    : field.field_type === 'number' ? draft.trim() === '' || !Number.isFinite(Number(draft)) ? null : Number(draft)
      : draft;
  const valid = parsed !== null && (field.field_type !== 'select' ||
    field.options.includes(String(parsed))) &&
    (field.field_type !== 'text' || String(parsed).length <= 2000);
  return <form className="space-y-2 rounded-lg border p-4"
    onSubmit={(event) => { event.preventDefault(); if (valid && parsed !== null) void onSave(row, parsed); }}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="font-medium" htmlFor={'custom-' + field.id}>{field.label}</label>
      <span className="text-xs text-muted">{field.field_key} · {field.field_type}{!field.is_active ? ' · Inactive' : ''}</span>
    </div>
    {field.field_type === 'boolean'
      ? <select id={'custom-' + field.id} value={booleanDraft} disabled={!writable || busy || !field.is_active}
          onChange={(event) => setBooleanDraft(event.target.value)} className="block w-full rounded border p-2">
          <option value="">Not set</option><option value="true">Yes</option><option value="false">No</option>
        </select>
      : field.field_type === 'select'
        ? <select id={'custom-' + field.id} value={draft} disabled={!writable || busy || !field.is_active}
            onChange={(event) => setDraft(event.target.value)} className="block w-full rounded border p-2">
            <option value="">Not set</option>
            {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        : <input id={'custom-' + field.id}
            type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
            step={field.field_type === 'number' ? 'any' : undefined}
            maxLength={field.field_type === 'text' ? 2000 : undefined}
            value={draft} disabled={!writable || busy || !field.is_active}
            onChange={(event) => setDraft(event.target.value)} className="block w-full rounded border p-2" />}
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">Version: {row.version ?? 'not set'}</span>
      {writable && field.is_active &&
        <button type="submit" disabled={busy || !valid}
          className="rounded border px-3 py-2 disabled:opacity-50">Save value</button>}
    </div>
  </form>;
}

export default function ApiCustomFields() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('type');
  const objectType: ApiCustomObject = objectTypes.includes(requested as ApiCustomObject)
    ? requested as ApiCustomObject : 'lead';
  const selectedId = params.get('id') ?? '';
  const base = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => base ? createLaravelClient({ baseUrl: base }) : null, [base]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [orgId, setOrgId] = React.useState('');
  const [sessionError, setSessionError] = React.useState('');
  const client = React.useMemo(() => base ? createLaravelClient({ baseUrl: base, organizationId: orgId }) : null, [base, orgId]);
  const [fields, setFields] = React.useState<{ key: string; items: ApiCustomField[]; error?: string } | null>(null);
  const [values, setValues] = React.useState<{ key: string; items: ApiCustomFieldValue[]; error?: string } | null>(null);
  const [choices, setChoices] = React.useState<{ key: string; items: RecordChoice[]; error?: string } | null>(null);
  const [recordSearch, setRecordSearch] = React.useState('');
  const [searchDraft, setSearchDraft] = React.useState('');
  const [schema, setSchema] = React.useState({
    field_key: '', label: '', field_type: 'text' as ApiCustomFieldType, options: '',
  });
  const [revision, setRevision] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const membership = identity?.organizations.find((org) => org.id === orgId);
  const canWrite = !!membership && membership.role !== 'viewer';
  const canManage = membership?.role === 'owner' || membership?.role === 'admin';
  const fieldsKey = JSON.stringify([orgId, objectType, revision]);
  const valuesKey = JSON.stringify([orgId, objectType, selectedId, revision]);
  const choicesKey = JSON.stringify([orgId, objectType, recordSearch, revision]);
  const currentFields = fields?.key === fieldsKey ? fields : null;
  const currentValues = values?.key === valuesKey ? values : null;
  const currentChoices = choices?.key === choicesKey ? choices : null;

  React.useEffect(() => {
    if (!auth) return;
    let active = true;
    void auth.me().then((data) => {
      if (active) { setIdentity(data); setOrgId(preferredLiveOrganization(data)); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) navigate('/api-sign-in', { replace: true });
      else setSessionError(message(cause));
    });
    return () => { active = false; };
  }, [auth, navigate]);

  React.useEffect(() => {
    if (!client || !orgId || !identity?.user.email_verified) return;
    let active = true;
    void client.customFields(objectType).then((items) => {
      if (active) setFields({ key: fieldsKey, items });
    }).catch((cause: unknown) => { if (active) setFields({ key: fieldsKey, items: [], error: message(cause) }); });
    return () => { active = false; };
  }, [client, orgId, objectType, revision, fieldsKey, identity?.user.email_verified]);

  React.useEffect(() => {
    if (!client || !orgId || !selectedId || !identity?.user.email_verified) return;
    let active = true;
    void client.customValues(objectType, selectedId).then((items) => {
      if (active) setValues({ key: valuesKey, items });
    }).catch((cause: unknown) => { if (active) setValues({ key: valuesKey, items: [], error: message(cause) }); });
    return () => { active = false; };
  }, [client, orgId, objectType, selectedId, revision, valuesKey, identity?.user.email_verified]);

  React.useEffect(() => {
    if (!client || !orgId || !identity?.user.email_verified) return;
    let active = true;
    const promise = objectType === 'lead' ? client.listLeads({ q: recordSearch || undefined, pageSize: 25 })
      : objectType === 'contact' ? client.listContacts({ q: recordSearch || undefined, pageSize: 25 })
        : objectType === 'account' ? client.listAccounts({ q: recordSearch || undefined, pageSize: 25 })
          : client.listDeals({ q: recordSearch || undefined, pageSize: 25 });
    void promise.then((page) => {
      if (!active) return;
      setChoices({ key: choicesKey, items: page.items.map((item) => ({
        id: item.id, label: 'first_name' in item ? item.first_name + ' ' + item.last_name : item.name,
      })) });
    }).catch((cause: unknown) => { if (active) setChoices({ key: choicesKey, items: [], error: message(cause) }); });
    return () => { active = false; };
  }, [client, orgId, identity?.user.email_verified, objectType, recordSearch, revision, choicesKey]);

  const refresh = () => setRevision((value) => value + 1);
  const chooseType = (type: ApiCustomObject) => {
    setParams({ type }); setSearchDraft(''); setRecordSearch(''); setValues(null);
    setError(''); setNotice('');
  };
  const chooseRecord = (id: string) => {
    setParams(id ? { type: objectType, id } : { type: objectType });
    setValues(null); setError(''); setNotice('');
  };
  const applyWrite = async (fn: () => Promise<unknown>, success: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      await fn(); refresh(); setNotice(success); return true;
    } catch (cause) {
      setError(message(cause));
      if (cause instanceof ApiError && cause.status === 409) refresh();
      return false;
    } finally { setBusy(false); }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !canManage) return;
    const options = schema.field_type === 'select'
      ? schema.options.split('\n').map((value) => value.trim()).filter(Boolean) : [];
    const saved = await applyWrite(() => client.createCustomField({
      object_type: objectType, field_key: schema.field_key.trim(),
      label: schema.label.trim(), field_type: schema.field_type, options,
    }), 'Custom field created.');
    if (saved) setSchema({ field_key: '', label: '', field_type: 'text', options: '' });
  };
  const update = async (field: ApiCustomField, changes: { label?: string; is_active?: boolean }) => {
    if (!client || !canManage) return;
    await applyWrite(() => client.updateCustomField(field.id, { expected_version: field.version, ...changes }),
      'Custom field definition updated.');
  };
  const saveValue = async (row: ApiCustomFieldValue, value: ApiCustomValue) => {
    if (!client || !selectedId || !canWrite || !row.field.is_active) return;
    await applyWrite(() => client.saveCustomValue({
      field_id: row.field.id, subject_type: objectType, subject_id: selectedId,
      expected_version: row.version, value,
    }), 'Custom value saved to the selected CRM record.');
  };

  return <main className="mx-auto max-w-6xl space-y-5 p-5">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Live Dashboard</Link>
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/contacts">Contacts</Link>
      <Link className="underline" to="/crm/accounts">Accounts</Link>
      <Link className="underline" to="/crm/deals">Deals</Link>
      <Link className="underline" to="/crm/timeline">Customer Timeline</Link>
    </nav>
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">CRM / Customize / Laravel</p>
      <h1 className="text-2xl font-semibold">Custom Fields</h1>
      <p className="text-sm text-muted">Add typed CRM properties without changing the standard record fields. Only organization administrators can define properties.</p>
    </header>
    {!base ? <p role="alert">Set VITE_CRM_API_URL to use real CRM custom fields.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking secure session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email to use CRM fields.</p>
            : !identity.organizations.length ? <p role="alert">No active organization membership.</p>
              : <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">Organization
                    <select aria-label="Organization" value={orgId} className="mt-1 block w-full rounded border p-2"
                      onChange={(event) => {
                        setOrgId(event.target.value); storeLiveOrganization(event.target.value);
                        setParams({ type: objectType }); setFields(null); setValues(null); setChoices(null);
                        setRecordSearch(''); setSearchDraft(''); setError(''); setNotice('');
                      }}>
                      {identity.organizations.map((org) =>
                        <option key={org.id} value={org.id}>{org.name} ({org.role})</option>)}
                    </select>
                  </label>
                  <label className="text-sm">CRM record type
                    <select aria-label="CRM record type" value={objectType} className="mt-1 block w-full rounded border p-2"
                      onChange={(event) => chooseType(event.target.value as ApiCustomObject)}>
                      {objectTypes.map((type) =>
                        <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                    </select>
                  </label>
                </div>
                {error && <p role="alert" className="rounded border border-red-500 p-3 text-sm text-red-600">{error}</p>}
                {notice && <p role="status" className="rounded border p-3 text-sm">{notice}</p>}
                <section className="space-y-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">Field definitions</h2>
                    <button type="button" className="rounded border px-3 py-2" onClick={refresh}>Refresh</button>
                  </div>
                  {!currentFields ? <p role="status">Loading field definitions…</p>
                    : currentFields.error ? <p role="alert">{currentFields.error}</p>
                      : !currentFields.items.length ? <p className="text-sm">No custom fields defined for this CRM record type.</p>
                        : <ul className="space-y-2">{currentFields.items.map((field) => <li key={field.id}
                            className="flex flex-wrap items-center gap-3 rounded border p-3 text-sm">
                            <div className="flex-1">
                              <strong>{field.label}</strong>
                              <div className="text-xs text-muted">{field.field_key} · {field.field_type} · {field.is_active ? 'Active' : 'Inactive'}</div>
                            </div>
                            {canManage && <>
                              <button type="button" className="underline" disabled={busy}
                                onClick={() => {
                                  const label = window.prompt('New label', field.label);
                                  if (label && label.trim()) void update(field, { label: label.trim() });
                                }}>Rename</button>
                              <button type="button" className="underline" disabled={busy}
                                onClick={() => { void update(field, { is_active: !field.is_active }); }}>
                                {field.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </>}
                          </li>)}</ul>}
                </section>
                {canManage && <form onSubmit={(event) => { void create(event); }} className="space-y-3 rounded-xl border p-4">
                  <h2 className="text-lg font-semibold">Create custom field</h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-sm">Field key
                      <input required minLength={2} maxLength={50} pattern="[a-z][a-z0-9_]{1,49}"
                        className="mt-1 block w-full rounded border p-2" value={schema.field_key}
                        onChange={(event) => setSchema((old) => ({ ...old, field_key: event.target.value }))}
                        placeholder="customer_priority"/>
                    </label>
                    <label className="text-sm">Label
                      <input required maxLength={120} className="mt-1 block w-full rounded border p-2"
                        value={schema.label} onChange={(event) => setSchema((old) => ({ ...old, label: event.target.value }))}/>
                    </label>
                    <label className="text-sm">Data type
                      <select aria-label="Data type" className="mt-1 block w-full rounded border p-2"
                        value={schema.field_type}
                        onChange={(event) => setSchema((old) => ({ ...old, field_type: event.target.value as ApiCustomFieldType }))}>
                        {fieldTypes.map((type) => <option value={type} key={type}>{type}</option>)}
                      </select>
                    </label>
                  </div>
                  {schema.field_type === 'select' && <label className="block text-sm">Select choices, one per line
                    <textarea rows={4} className="mt-1 block w-full rounded border p-2" value={schema.options}
                      onChange={(event) => setSchema((old) => ({ ...old, options: event.target.value }))}/>
                  </label>}
                  <p className="text-xs text-muted">Keys and types stay fixed after creation. Deactivation preserves existing values.</p>
                  <button type="submit" disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
                    Create field</button>
                </form>}
                <section className="space-y-4 rounded-xl border p-4">
                  <h2 className="text-lg font-semibold">Record values</h2>
                  <form className="flex gap-2" onSubmit={(event) => {
                    event.preventDefault(); setRecordSearch(searchDraft.trim());
                  }}>
                    <label className="flex-1 text-sm">Search {objectType} records
                      <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)}
                        placeholder="Search live records" className="mt-1 block w-full rounded border p-2"/>
                    </label>
                    <button className="self-end rounded border px-4 py-2" type="submit">Search</button>
                  </form>
                  {!currentChoices ? <p role="status">Loading records…</p>
                    : currentChoices.error ? <p role="alert">{currentChoices.error}</p>
                      : <label className="block text-sm">Select record
                          <select aria-label="Select record" className="mt-1 block w-full rounded border p-2"
                            value={currentChoices.items.some((item) => item.id === selectedId) ? selectedId : ''}
                            onChange={(event) => chooseRecord(event.target.value)}>
                            <option value="">Choose a record</option>
                            {currentChoices.items.map((item) =>
                              <option key={item.id} value={item.id}>{item.label}</option>)}
                          </select>
                          <span className="text-xs text-muted">Showing the first 25 matching records. Direct record links can open other records.</span>
                        </label>}
                  {!selectedId ? <p className="text-sm">Select a CRM record to view its properties.</p>
                    : !currentValues ? <p role="status">Loading custom values…</p>
                      : currentValues.error ? <p role="alert">{currentValues.error}</p>
                        : <div className="grid gap-3 sm:grid-cols-2">
                            {currentValues.items.map((row) => <FieldValueRow
                              key={orgId + ':' + selectedId + ':' + row.field.id + ':' + revision}
                              row={row} writable={canWrite} busy={busy} onSave={saveValue}/>)}
                          </div>}
                </section>
              </>}
  </main>;
}
