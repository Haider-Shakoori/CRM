/**
 * First-party Laravel API transport. Never persist tokens in localStorage:
 * Sanctum uses HttpOnly session cookies plus the readable XSRF-TOKEN cookie.
 * This file is intentionally independent of the mock service container.
 */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  baseUrl: string;
  organizationId?: string;
  fetchImpl?: typeof fetch;
  /** Supplied by the browser cookie store; do not pass bearer tokens. */
  getXsrfToken?: () => string | undefined;
}

export interface ApiIdentity {
  user: { id: string; name: string; email: string; email_verified: boolean };
  organizations: Array<{ id: string; name: string; role: 'owner' | 'admin' | 'member' | 'viewer' }>;
}

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted'] as const;
export type ApiLeadStatus = (typeof LEAD_STATUSES)[number];

export interface ApiLead {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  notes: string | null;
  status: ApiLeadStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ApiPage<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export function browserXsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='));
  if (!cookie) return undefined;
  try { return decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)); }
  catch { return undefined; }
}

export function createLaravelClient(options: ApiOptions) {
  const fetcher = options.fetchImpl ?? fetch;
  const root = options.baseUrl.replace(/\/$/, '');
  const request = async <T>(path: string, init: RequestInit = {}, scoped = false): Promise<T> => {
    if (scoped && !options.organizationId) throw new ApiError(0, 'Select an organization before accessing CRM records.');
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body != null) headers.set('Content-Type', 'application/json');
    if (scoped) headers.set('X-Organization-ID', options.organizationId!);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const xsrf = (options.getXsrfToken ?? browserXsrfToken)();
      if (xsrf) headers.set('X-XSRF-TOKEN', xsrf);
    }
    const res = await fetcher(root + path, { ...init, headers, credentials: 'include' });
    let payload: unknown;
    try { payload = await res.json(); }
    catch { throw new ApiError(res.status, 'The server returned an invalid JSON response.'); }
    const body = payload as { ok?: boolean; data?: T; message?: string; error?: { message?: string } };
    if (!res.ok || body.ok === false || body.data === undefined) {
      throw new ApiError(res.status, body.error?.message ?? body.message ?? 'The API request failed.');
    }
    return body.data;
  };
  return {
    csrf: async () => {
      const res = await fetcher(root + '/sanctum/csrf-cookie', { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new ApiError(res.status, 'Could not initialize secure session.');
    },
    login: async (email: string, password: string) => {
      const csrf = await fetcher(root + '/sanctum/csrf-cookie', { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!csrf.ok) throw new ApiError(csrf.status, 'Could not initialize secure session.');
      return request<unknown>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },
    logout: () => request<unknown>('/api/v1/auth/logout', { method: 'POST' }),
    me: () => request<ApiIdentity>('/api/v1/auth/me'),
    resendVerification: () => request<{ queued: boolean }>('/api/v1/auth/verification-notification', { method: 'POST' }),
    forgotPassword: async (email: string) => {
      const csrf = await fetcher(root + '/sanctum/csrf-cookie', { credentials: 'include' });
      if (!csrf.ok) throw new ApiError(csrf.status, 'Could not initialize secure session.');
      return request<{ message: string }>('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    },
    resetPassword: async (email: string, token: string, password: string, password_confirmation: string) => {
      const csrf = await fetcher(root + '/sanctum/csrf-cookie', { credentials: 'include' });
      if (!csrf.ok) throw new ApiError(csrf.status, 'Could not initialize secure session.');
      return request<{ password_reset: boolean }>('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, token, password, password_confirmation }),
      });
    },
    listLeads: (params: { page?: number; pageSize?: number; status?: ApiLeadStatus; q?: string } = {}) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
      const suffix = search.size ? '?' + search.toString() : '';
      return request<ApiPage<ApiLead>>('/api/v1/leads' + suffix, {}, true);
    },
    getLead: (id: string) => request<ApiLead>('/api/v1/leads/' + encodeURIComponent(id), {}, true),
    createLead: (lead: { name: string; email?: string | null; notes?: string | null; status?: string }) =>
      request<ApiLead>('/api/v1/leads', { method: 'POST', body: JSON.stringify(lead) }, true),
    updateLead: (id: string, patch: { expected_version: number; name?: string; email?: string | null; notes?: string | null; status?: string }) =>
      request<ApiLead>('/api/v1/leads/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }, true),
    deleteLead: (id: string) => request<{ id: string }>('/api/v1/leads/' + encodeURIComponent(id), { method: 'DELETE' }, true),
  };
}
