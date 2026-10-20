import { describe, expect, it, vi } from 'vitest';
import { ApiError, createLaravelClient } from './laravelClient';

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
describe('Laravel browser client', () => {
  it('fails closed without a selected organization', async () => {
    const mock = vi.fn<typeof fetch>();
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', fetchImpl: mock });
    await expect(api.listLeads()).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
  it('scopes lead requests using the membership-validated organization header', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ items: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1, hasNext: false, hasPrev: false } }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test/', organizationId: 'org-1', fetchImpl: mock });
    await api.listLeads({ page: 2, q: 'test lead' });
    expect(mock).toHaveBeenCalledOnce();
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/api/v1/leads?page=2&q=test+lead');
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-1');
    expect(init?.credentials).toBe('include');
  });
  it('sends CSRF header and optimistic-concurrency version for changes', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ id: 'lead-1', version: 3 }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-1', fetchImpl: mock, getXsrfToken: () => 'decoded-token' });
    await api.updateLead('lead-1', { expected_version: 2, name: 'New name' });
    const [, init] = mock.mock.calls[0]!;
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('decoded-token');
    expect(JSON.parse(String(init?.body))).toEqual({ expected_version: 2, name: 'New name' });
    expect(init?.method).toBe('PATCH');
  });
  it('exposes API conflict status rather than silently overwriting', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message: 'Lead changed' }), { status: 409 }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-1', fetchImpl: mock });
    await expect(api.updateLead('lead-1', { expected_version: 1 })).rejects.toMatchObject({ status: 409, message: 'Lead changed' });
  });
  it('uses a CSRF-cookie handshake for password recovery without leaking organization headers', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(success({ message: 'Recovery instructions requested.' }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-1',
      getXsrfToken: () => 'xsrf-cookie-value', fetchImpl: mock });
    await api.forgotPassword('person@example.test');
    expect(mock.mock.calls[0]![0]).toBe('https://api.example.test/sanctum/csrf-cookie');
    expect(mock.mock.calls[1]![0]).toBe('https://api.example.test/api/v1/auth/forgot-password');
    const [, init] = mock.mock.calls[1]!;
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('xsrf-cookie-value');
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBeNull();
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'person@example.test' });
  });
  it('handles structured validation errors without exposing secrets', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, error: { code: 'validation_failed', message: 'Invalid credentials.', retryable: false } }),
      { status: 422 },
    ));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', fetchImpl: mock });
    await expect(api.me()).rejects.toMatchObject({ status: 422, message: 'Invalid credentials.' });
  });
  it('scopes destructive lead operations and never supplies tenant ownership in request bodies', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ id: 'lead-1' }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-2',
      getXsrfToken: () => 'xsrf', fetchImpl: mock });
    await api.deleteLead('lead-1');
    const [, init] = mock.mock.calls[0]!;
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-2');
  });

  it('passes server search, status, page and page-size parameters without changing organization ownership', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({
      items: [], meta: { page: 3, pageSize: 25, total: 70, totalPages: 3, hasNext: false, hasPrev: true },
    }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-3', fetchImpl: mock });
    const data = await api.listLeads({ page: 3, pageSize: 25, q: 'Afghan & Sons', status: 'qualified' });
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/api/v1/leads?page=3&pageSize=25&q=Afghan+%26+Sons&status=qualified');
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-3');
    expect(data.meta.totalPages).toBe(3);
    expect(data.meta.hasPrev).toBe(true);
    expect(data.meta.hasNext).toBe(false);
  });

  it('scopes the Accounts listing to an organization and preserves server pagination', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({
      items: [], meta: { page: 2, pageSize: 25, total: 47, totalPages: 2, hasNext: false, hasPrev: true },
    }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-3', fetchImpl: mock });
    const page = await api.listAccounts({ page: 2, pageSize: 25, q: 'Acme' });
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/api/v1/accounts?page=2&pageSize=25&q=Acme');
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-3');
    expect(page.meta.total).toBe(47);
  });
  it('sends Contact-to-Account relations using the server-validated account ID', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ id: 'c1', version: 1 }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-3',
      fetchImpl: mock, getXsrfToken: () => 'xsrf' });
    await api.createContact({ first_name: 'Amina', last_name: 'Khan', account_id: 'account-uuid' });
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/api/v1/contacts');
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-3');
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('xsrf');
    expect(JSON.parse(String(init?.body))).toEqual({
      first_name: 'Amina', last_name: 'Khan', account_id: 'account-uuid',
    });
  });
  it('requires an organization even for directory deletes', async () => {
    const mock = vi.fn<typeof fetch>();
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', fetchImpl: mock });
    await expect(api.deleteContact('c1')).rejects.toBeInstanceOf(ApiError);
    await expect(api.deleteAccount('a1')).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
  it('uses expected_version when updating Account records', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ id: 'a1', version: 3 }));
    const api = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-3', fetchImpl: mock });
    await api.updateAccount('a1', { name: 'Renamed', expected_version: 2 });
    const [, init] = mock.mock.calls[0]!;
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Renamed', expected_version: 2 });
  });

  it('scopes pipeline reads and deal movements with optimistic concurrency', async () => {
    const mock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(success([{ id: 'pipe-1', name: 'Pipeline', stages: [] }]))
      .mockResolvedValueOnce(success({ id: 'deal-1', version: 3, stage_id: 'stage-2' }));
    const client = createLaravelClient({
      baseUrl: 'https://api.example.test', organizationId: 'org-3',
      fetchImpl: mock, getXsrfToken: () => 'csrf-token',
    });
    await client.listPipelines();
    await client.moveDeal('deal-1', 'stage-2', 2);
    expect(mock.mock.calls[0]![0]).toBe('https://api.example.test/api/v1/pipelines');
    const [path, init] = mock.mock.calls[1]!;
    expect(path).toBe('https://api.example.test/api/v1/deals/deal-1/move');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ stage_id: 'stage-2', expected_version: 2 });
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-3');
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(init?.credentials).toBe('include');
  });
  it('fails closed without membership context on pipeline, deal, and timeline methods', async () => {
    const mock = vi.fn<typeof fetch>();
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', fetchImpl: mock });
    await expect(client.listPipelines()).rejects.toBeInstanceOf(ApiError);
    await expect(client.listDeals()).rejects.toBeInstanceOf(ApiError);
    await expect(client.getDealEvents('deal-1')).rejects.toBeInstanceOf(ApiError);
    await expect(client.archiveDeal('deal-1')).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
  it('preserves server-driven pipeline paging and search', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({
      items: [], meta: { page: 2, pageSize: 100, total: 102, totalPages: 2, hasNext: false, hasPrev: true },
    }));
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-3', fetchImpl: mock });
    const result = await client.listDeals({ pipeline_id: 'pipe-1', page: 2, pageSize: 100, q: 'Consulting' });
    expect(mock.mock.calls[0]![0]).toBe('https://api.example.test/api/v1/deals?pipeline_id=pipe-1&page=2&pageSize=100&q=Consulting');
    expect(result.meta.total).toBe(102);
    expect(result.meta.hasPrev).toBe(true);
  });

  it('requires organization membership context for activity and assignee reads', async () => {
    const mock = vi.fn<typeof fetch>();
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', fetchImpl: mock });
    await expect(client.listActivities()).rejects.toBeInstanceOf(ApiError);
    await expect(client.listAssignees()).rejects.toBeInstanceOf(ApiError);
    await expect(client.getActivityEvents('activity-1')).rejects.toBeInstanceOf(ApiError);
    await expect(client.archiveActivity('activity-1')).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
  it('sends scoped activity filters and server pagination', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({
      items: [], meta: { page: 2, pageSize: 25, total: 60, totalPages: 3, hasNext: true, hasPrev: true },
    }));
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-4', fetchImpl: mock });
    const page = await client.listActivities({ page: 2, pageSize: 25, kind: 'task', status: 'open', mine: true });
    expect(mock.mock.calls[0]![0]).toBe('https://api.example.test/api/v1/activities?page=2&pageSize=25&kind=task&status=open&mine=1');
    expect(new Headers(mock.mock.calls[0]![1]?.headers).get('X-Organization-ID')).toBe('org-4');
    expect(page.meta.totalPages).toBe(3);
  });
  it('includes CSRF and expected version for completing a task', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ id: 'activity-1', status: 'completed', version: 2 }));
    const client = createLaravelClient({
      baseUrl: 'https://api.example.test', organizationId: 'org-4', fetchImpl: mock,
      getXsrfToken: () => 'my-xsrf',
    });
    await client.updateActivity('activity-1', { status: 'completed', expected_version: 1 });
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/api/v1/activities/activity-1');
    expect(init?.method).toBe('PATCH');
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('my-xsrf');
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'completed', expected_version: 1 });
  });

  it('fails closed without organization selection on live reporting methods', async () => {
    const mock = vi.fn<typeof fetch>();
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', fetchImpl: mock });
    await expect(client.overviewReport()).rejects.toBeInstanceOf(ApiError);
    await expect(client.pipelineReport()).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
  it('requests current organization reporting with credentialed session cookies', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ as_of: '2026-10-20', totals: { leads: 3 } }));
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-4', fetchImpl: mock });
    const result = await client.overviewReport();
    expect(mock.mock.calls[0]![0]).toBe('https://api.example.test/api/v1/reports/overview');
    expect(new Headers(mock.mock.calls[0]![1]?.headers).get('X-Organization-ID')).toBe('org-4');
    expect(mock.mock.calls[0]![1]?.credentials).toBe('include');
    expect(result.totals.leads).toBe(3);
  });
  it('encodes pipeline selection without sending tenant or currency conversion overrides', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(success({ pipelines: [], stage_currency_totals: [] }));
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-4', fetchImpl: mock });
    await client.pipelineReport('pipeline/with & spaces');
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/api/v1/reports/pipelines?pipeline_id=pipeline%2Fwith%20%26%20spaces');
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-4');
    expect(init?.body).toBeUndefined();
  });

});
