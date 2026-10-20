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
    expect(url).toBe('https://api.example.test/api/v1/leads?page=3&pageSize=25&status=qualified&q=Afghan+%26+Sons');
    expect(new Headers(init?.headers).get('X-Organization-ID')).toBe('org-3');
    expect(data.meta.totalPages).toBe(3);
    expect(data.meta.hasPrev).toBe(true);
    expect(data.meta.hasNext).toBe(false);
  });

});
