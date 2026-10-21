import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError, createLaravelClient,
  type ApiIdentity, type ApiTag, type ApiTaggedRecord, type ApiPage, type CrmTagSubject,
} from '../../app/laravelClient';
import { preferredLiveOrganization, storeLiveOrganization } from '../../app/liveOrganization';

const types: CrmTagSubject[] = ['lead', 'contact', 'account', 'deal'];
const message = (error: unknown) => error instanceof ApiError ? error.message : 'The CRM request could not be completed.';
const starting = { name: '', color: '#64748b' };

export default function ApiTags() {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const auth = React.useMemo(() => baseUrl ? createLaravelClient({ baseUrl }) : null, [baseUrl]);
  const [identity, setIdentity] = React.useState<ApiIdentity | null>(null);
  const [orgId, setOrgId] = React.useState('');
  const [sessionError, setSessionError] = React.useState('');
  const client = React.useMemo(
    () => baseUrl ? createLaravelClient({ baseUrl, organizationId: orgId }) : null,
    [baseUrl, orgId],
  );
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [tagPage, setTagPage] = React.useState(1);
  const [tags, setTags] = React.useState<{ key: string; page: ApiPage<ApiTag> | null; error?: string } | null>(null);
  const [selectedId, setSelectedId] = React.useState('');
  const [subjectType, setSubjectType] = React.useState<CrmTagSubject>('lead');
  const [segmentPage, setSegmentPage] = React.useState(1);
  const [segments, setSegments] = React.useState<{ key: string; page: ApiPage<ApiTaggedRecord> | null; error?: string } | null>(null);
  const [recordSearchInput, setRecordSearchInput] = React.useState('');
  const [recordSearch, setRecordSearch] = React.useState('');
  const [choices, setChoices] = React.useState<{ key: string; items: Array<{ id: string; label: string }>; error?: string } | null>(null);
  const [recordId, setRecordId] = React.useState('');
  const [revision, setRevision] = React.useState(0);
  const [draft, setDraft] = React.useState(starting);
  const [editing, setEditing] = React.useState<ApiTag | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ApiTag | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const role = identity?.organizations.find((item) => item.id === orgId)?.role;
  const canWrite = !!role && role !== 'viewer';
  const canManage = role === 'owner' || role === 'admin';
  const tagKey = JSON.stringify([orgId, search, tagPage, revision]);
  const segmentKey = JSON.stringify([orgId, selectedId, subjectType, segmentPage, revision]);
  const choiceKey = JSON.stringify([orgId, subjectType, recordSearch, revision]);
  const currentTags = tags?.key === tagKey ? tags : null;
  const currentSegments = segments?.key === segmentKey ? segments : null;
  const currentChoices = choices?.key === choiceKey ? choices : null;
  const selectedTag = currentTags?.page?.items.find((item) => item.id === selectedId);

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
    void client.listTags({ q: search || undefined, page: tagPage, pageSize: 50 })
      .then((page) => { if (active) setTags({ key: tagKey, page }); })
      .catch((cause: unknown) => { if (active) setTags({ key: tagKey, page: null, error: message(cause) }); });
    return () => { active = false; };
  }, [client, orgId, identity?.user.email_verified, search, tagPage, revision, tagKey]);

  React.useEffect(() => {
    if (!client || !orgId || !selectedId || !identity?.user.email_verified) return;
    let active = true;
    void client.tagRecords(selectedId, { subject_type: subjectType, page: segmentPage, pageSize: 25 })
      .then((page) => { if (active) setSegments({ key: segmentKey, page }); })
      .catch((cause: unknown) => { if (active) setSegments({ key: segmentKey, page: null, error: message(cause) }); });
    return () => { active = false; };
  }, [client, orgId, selectedId, subjectType, segmentPage, revision, segmentKey, identity?.user.email_verified]);

  React.useEffect(() => {
    if (!client || !orgId || !identity?.user.email_verified || !canWrite) return;
    let active = true;
    const read = subjectType === 'lead' ? client.listLeads({ q: recordSearch || undefined, pageSize: 25 })
      : subjectType === 'contact' ? client.listContacts({ q: recordSearch || undefined, pageSize: 25 })
        : subjectType === 'account' ? client.listAccounts({ q: recordSearch || undefined, pageSize: 25 })
          : client.listDeals({ q: recordSearch || undefined, pageSize: 25 });
    void read.then((page) => {
      if (!active) return;
      setChoices({ key: choiceKey, items: page.items.map((item) => ({
        id: item.id,
        label: 'first_name' in item ? item.first_name + ' ' + item.last_name : item.name,
      })) });
    }).catch((cause: unknown) => {
      if (active) setChoices({ key: choiceKey, items: [], error: message(cause) });
    });
    return () => { active = false; };
  }, [client, orgId, subjectType, recordSearch, revision, choiceKey, identity?.user.email_verified, canWrite]);

  const refresh = () => setRevision((prev) => prev + 1);
  const chooseTag = (id: string) => {
    setSelectedId(id); setSegmentPage(1); setRecordId(''); setError(''); setNotice('');
  };
  const chooseType = (type: CrmTagSubject) => {
    setSubjectType(type); setRecordId(''); setRecordSearch(''); setRecordSearchInput('');
    setSegmentPage(1); setError(''); setNotice('');
  };
  const changeOrganization = (id: string) => {
    setOrgId(id); storeLiveOrganization(id);
    setSelectedId(''); setTagPage(1); setSearch(''); setSearchInput('');
    setRecordId(''); setRecordSearch(''); setRecordSearchInput('');
    setEditing(null); setConfirmDelete(null); setTags(null); setSegments(null); setChoices(null);
    setError(''); setNotice('');
  };
  const write = async (operation: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true); setError(''); setNotice('');
    try {
      await operation(); refresh(); setNotice(success); return true;
    } catch (cause) {
      setError(message(cause));
      if (cause instanceof ApiError && cause.status === 409) refresh();
      return false;
    } finally { setBusy(false); }
  };
  const saveTag = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !canManage || busy || !draft.name.trim()) return;
    const ok = await write(() => editing
      ? client.updateTag(editing.id, { name: draft.name.trim(), color: draft.color, expected_version: editing.version })
      : client.createTag({ name: draft.name.trim(), color: draft.color }),
    editing ? 'Tag updated.' : 'Tag created.');
    if (ok) { setDraft(starting); setEditing(null); }
  };

  return <main className="mx-auto max-w-6xl space-y-6 p-5">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Live Dashboard</Link>
      <Link className="underline" to="/crm/search">Global Search</Link>
      <Link className="underline" to="/crm/timeline">Customer Timeline</Link>
      <Link className="underline" to="/crm/custom-fields">Custom Fields</Link>
      <Link className="underline" to="/crm/leads">Leads</Link>
      <Link className="underline" to="/crm/contacts">Contacts</Link>
    </nav>
    <header className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted">CRM / Segmentation / Live data</p>
      <h1 className="text-2xl font-semibold">Tags & Segments</h1>
      <p className="text-sm text-muted">Organize real Leads, Contacts, Accounts and Deals with organization-private tags. No automated messages or campaigns are sent.</p>
    </header>
    {!baseUrl ? <p role="alert">Set VITE_CRM_API_URL to load CRM tags.</p>
      : sessionError ? <p role="alert">{sessionError}</p>
        : !identity ? <p role="status">Checking secure session…</p>
          : !identity.user.email_verified ? <p role="alert">Verify your email before viewing CRM tags.</p>
            : !identity.organizations.length ? <p role="alert">No active organization membership.</p>
              : <>
                <label className="block max-w-md text-sm">Organization
                  <select aria-label="Organization" className="mt-1 block w-full rounded border p-2"
                    value={orgId} onChange={(event) => changeOrganization(event.target.value)}>
                    {identity.organizations.map((org) =>
                      <option value={org.id} key={org.id}>{org.name} ({org.role})</option>)}
                  </select>
                </label>
                {error && <p role="alert" className="rounded border border-red-500 p-3 text-red-600">{error}</p>}
                {notice && <p role="status" className="rounded border p-3">{notice}</p>}
                <section className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-4 rounded-xl border p-4">
                    <h2 className="text-lg font-semibold">Tag directory</h2>
                    <form className="flex gap-2" onSubmit={(event) => {
                      event.preventDefault(); setTagPage(1); setSearch(searchInput.trim()); chooseTag('');
                    }}>
                      <label className="flex-1 text-sm">Find tag
                        <input className="mt-1 block w-full rounded border p-2" value={searchInput}
                          onChange={(event) => setSearchInput(event.target.value)} placeholder="Search tags"/>
                      </label>
                      <button type="submit" className="self-end rounded border px-3 py-2">Search</button>
                    </form>
                    {!currentTags ? <p role="status">Loading tags…</p>
                      : currentTags.error ? <p role="alert">{currentTags.error}</p>
                        : <>
                          <p className="text-sm text-muted">{currentTags.page?.meta.total ?? 0} tags in this organization</p>
                          {!currentTags.page?.items.length && <p className="text-sm">No tags match this search.</p>}
                          <ul className="space-y-2">{currentTags.page?.items.map((tag) =>
                            <li key={tag.id} className={'flex items-center gap-3 rounded border p-2 ' + (selectedId === tag.id ? 'border-blue-600' : '')}>
                              <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-full"
                                style={{ backgroundColor: tag.color }}/>
                              <button className="min-w-0 flex-1 break-words text-left underline" type="button"
                                onClick={() => chooseTag(tag.id)}>{tag.name}</button>
                              {canManage && <>
                                <button type="button" className="text-sm underline" onClick={() => {
                                  setEditing(tag); setDraft({ name: tag.name, color: tag.color }); setConfirmDelete(null);
                                }}>Edit</button>
                                <button type="button" className="text-sm underline" onClick={() => setConfirmDelete(tag)}>Delete</button>
                              </>}
                            </li>)}</ul>
                          <div className="flex items-center gap-3 text-sm">
                            <button type="button" className="rounded border px-3 py-2" disabled={tagPage <= 1}
                              onClick={() => setTagPage((page) => page - 1)}>Previous</button>
                            Page {tagPage} of {Math.max(1, currentTags.page?.meta.totalPages ?? 1)}
                            <button type="button" className="rounded border px-3 py-2"
                              disabled={!currentTags.page?.meta.hasNext} onClick={() => setTagPage((page) => page + 1)}>Next</button>
                          </div>
                        </>}
                    {canManage && <form className="space-y-3 rounded border p-3" onSubmit={(event) => { void saveTag(event); }}>
                      <h3 className="font-medium">{editing ? 'Edit tag' : 'Create tag'}</h3>
                      <label className="block text-sm">Name
                        <input required maxLength={80} className="mt-1 block w-full rounded border p-2"
                          value={draft.name} onChange={(event) => setDraft((old) => ({ ...old, name: event.target.value }))}/>
                      </label>
                      <label className="block text-sm">Color
                        <input type="color" className="mt-1 block size-10" value={draft.color}
                          onChange={(event) => setDraft((old) => ({ ...old, color: event.target.value }))}/>
                      </label>
                      <div className="flex gap-3">
                        <button type="submit" disabled={busy} className="rounded bg-blue-700 px-3 py-2 text-white">
                          {editing ? 'Save tag' : 'Create tag'}</button>
                        {editing && <button type="button" className="rounded border px-3 py-2"
                          onClick={() => { setEditing(null); setDraft(starting); }}>Cancel</button>}
                      </div>
                    </form>}
                    {confirmDelete && canManage && <div className="space-y-2 rounded border p-3 text-sm">
                      <p>Delete the tag “{confirmDelete.name}”? Linked tags must be removed first.</p>
                      <div className="flex gap-3">
                        <button className="rounded border px-3 py-2" type="button" disabled={busy}
                          onClick={() => {
                            if (!client) return;
                            const tag = confirmDelete;
                            void (async () => {
                              const ok = await write(() => client.deleteTag(tag.id, tag.version), 'Tag deleted.');
                              if (ok) {
                                setConfirmDelete(null);
                                if (selectedId === tag.id) chooseTag('');
                              }
                            })();
                          }}>Confirm delete</button>
                        <button type="button" className="underline" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </div>
                    </div>}
                  </div>
                  <div className="space-y-4 rounded-xl border p-4">
                    <h2 className="text-lg font-semibold">Tagged CRM records</h2>
                    {!selectedId ? <p className="text-sm text-muted">Choose a tag to view or change the CRM records assigned to it.</p>
                      : <>
                        <p className="text-sm text-muted">Selected tag: {selectedTag?.name ?? 'Tag'} </p>
                        <label className="block text-sm">CRM record type
                          <select className="mt-1 block w-full rounded border p-2" aria-label="CRM record type"
                            value={subjectType} onChange={(event) => chooseType(event.target.value as CrmTagSubject)}>
                            {types.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </label>
                        {!currentSegments ? <p role="status">Loading tagged records…</p>
                          : currentSegments.error ? <p role="alert">{currentSegments.error}</p>
                            : <>
                              <p className="text-sm text-muted">{currentSegments.page?.meta.total ?? 0} tagged {subjectType} records</p>
                              <ul className="space-y-2">{currentSegments.page?.items.map((record) =>
                                <li key={record.id} className="flex justify-between gap-3 rounded border p-3 text-sm">
                                  <Link className="break-words underline" to={"/crm/timeline?type=" + subjectType + "&id=" + encodeURIComponent(record.id)}>
                                    {record.label}</Link>
                                  {canWrite && <button type="button" className="shrink-0 underline" disabled={busy}
                                    onClick={() => {
                                      if (client) void write(() => client.unassignTag({
                                        subject_type: subjectType, subject_id: record.id, tag_id: selectedId,
                                      }), 'Tag removed from this record.');
                                    }}>Unassign</button>}
                                </li>)}</ul>
                              {!currentSegments.page?.items.length && <p className="text-sm">No records of this type have this tag.</p>}
                              <div className="flex items-center gap-3 text-sm">
                                <button className="rounded border px-3 py-2" disabled={segmentPage <= 1}
                                  type="button" onClick={() => setSegmentPage((page) => page - 1)}>Previous</button>
                                Page {segmentPage} of {Math.max(1, currentSegments.page?.meta.totalPages ?? 1)}
                                <button className="rounded border px-3 py-2" type="button"
                                  disabled={!currentSegments.page?.meta.hasNext}
                                  onClick={() => setSegmentPage((page) => page + 1)}>Next</button>
                              </div>
                            </>}
                        {canWrite && <div className="space-y-3 rounded border p-3">
                          <h3 className="font-medium">Assign this tag to a CRM record</h3>
                          <form className="flex gap-2" onSubmit={(event) => {
                            event.preventDefault(); setRecordId(''); setRecordSearch(recordSearchInput.trim());
                          }}>
                            <label className="flex-1 text-sm">Find {subjectType}
                              <input className="mt-1 block w-full rounded border p-2"
                                value={recordSearchInput} onChange={(event) => setRecordSearchInput(event.target.value)}
                                placeholder="Find live CRM record"/>
                            </label>
                            <button className="self-end rounded border px-3 py-2">Search</button>
                          </form>
                          {currentChoices?.error ? <p role="alert">{currentChoices.error}</p>
                            : <label className="block text-sm">Record
                              <select aria-label="Record" className="mt-1 block w-full rounded border p-2"
                                value={recordId} onChange={(event) => setRecordId(event.target.value)}>
                                <option value="">Choose a record</option>
                                {currentChoices?.items.map((record) =>
                                  <option key={record.id} value={record.id}>{record.label}</option>)}
                              </select>
                            </label>}
                          <p className="text-xs text-muted">Up to 25 matches are shown; refine search if your record is not listed.</p>
                          <button type="button" className="rounded bg-blue-700 px-4 py-2 text-white"
                            disabled={!recordId || busy} onClick={() => {
                              if (!client) return;
                              const id = recordId;
                              void (async () => {
                                const ok = await write(() => client.assignTag({
                                  subject_type: subjectType, subject_id: id, tag_id: selectedId,
                                }), 'Tag assigned to this record.');
                                if (ok) setRecordId('');
                              })();
                            }}>Assign tag</button>
                        </div>}
                      </>}
                  </div>
                </section>
              </>}
  </main>;
}
