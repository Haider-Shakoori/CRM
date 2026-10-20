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


export interface ApiLeadConversion {
  id: string;
  lead_id: string;
  account_id: string;
  contact_id: string;
  converted_by: string;
  created_at: string;
}
export type LeadConversionInput = {
  expected_version: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  account_id?: string;
  account_name?: string;
};
export interface ApiForecastReport {
  currencies: Array<{
    currency: string;
    deal_count: number;
    open_value: string;
    weighted_open_value: string;
    won_value: string;
    lost_value: string;
    no_close_date: number;
  }>;
  assumptions: {
    method: string;
    confidence: string;
    basis: string;
    won: string;
    date_filter: string;
  };
}

export interface ApiAccount {
  id: string;
  organization_id: string;
  name: string;
  website: string | null;
  phone: string | null;
  industry: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ApiContact {
  id: string;
  organization_id: string;
  account_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type AccountInput = { name: string; website?: string | null; phone?: string | null; industry?: string | null; notes?: string | null };
export type ContactInput = { first_name: string; last_name: string; account_id?: string | null; email?: string | null; phone?: string | null; job_title?: string | null; notes?: string | null };


export type ApiStageKind = 'open' | 'won' | 'lost';
export interface ApiPipelineStage {
  id: string;
  organization_id: string;
  pipeline_id: string;
  name: string;
  kind: ApiStageKind;
  position: number;
  probability: number;
}
export interface ApiPipeline {
  id: string;
  organization_id: string;
  name: string;
  version: number;
  stages: ApiPipelineStage[];
}
export interface ApiDeal {
  id: string;
  organization_id: string;
  pipeline_id: string;
  stage_id: string;
  account_id: string | null;
  name: string;
  amount: string;
  currency: string;
  expected_close_date: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface ApiDealEvent {
  id: string;
  deal_id: string;
  action: 'created' | 'updated' | 'moved' | 'archived';
  from_stage_id: string | null;
  to_stage_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
export type DealInput = {
  name: string;
  pipeline_id: string;
  stage_id: string;
  amount?: number;
  currency?: string;
  account_id?: string | null;
  expected_close_date?: string | null;
  notes?: string | null;
};


export type ApiActivityKind = 'task' | 'call' | 'meeting';
export type ApiActivityStatus = 'open' | 'completed' | 'cancelled';
export interface ApiActivity {
  id: string;
  organization_id: string;
  title: string;
  kind: ApiActivityKind;
  status: ApiActivityStatus;
  notes: string | null;
  due_at: string | null;
  remind_at: string | null;
  completed_at: string | null;
  assigned_to: string;
  lead_id: string | null;
  contact_id: string | null;
  account_id: string | null;
  deal_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface ApiAssignee {
  id: string;
  name: string;
  email: string;
  role: string;
}
export interface ApiActivityEvent {
  id: string;
  activity_id: string;
  actor_user_id: string;
  action: 'created' | 'updated' | 'status_changed' | 'archived';
  metadata: Record<string, unknown>;
  created_at: string;
}
export type ActivityInput = {
  title: string;
  kind: ApiActivityKind;
  status?: ApiActivityStatus;
  notes?: string | null;
  due_at?: string | null;
  remind_at?: string | null;
  assigned_to?: string;
  lead_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  deal_id?: string | null;
};


export interface ApiOverviewReport {
  as_of: string;
  timezone: string;
  totals: {
    leads: number; contacts: number; accounts: number; deals: number; pipelines: number;
    open_activities: number; open_tasks: number; overdue_tasks: number;
    tasks_due_today: number; meetings_next_7_days: number;
  };
  leads_by_status: Record<string, number>;
  activities_by_kind_status: Array<{ kind: string; status: string; count: number }>;
}
export interface ApiPipelineReport {
  pipelines: Array<{
    id: string;
    name: string;
    stages: Array<{ id: string; name: string; kind: ApiStageKind; position: number; probability: number }>;
  }>;
  stage_currency_totals: Array<{
    pipeline_id: string; stage_id: string;
    kind: ApiStageKind; currency: string; deal_count: number; deal_value: string;
  }>;
  definitions: { deals: string; value: string; won: string };
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
    convertLead: (id: string, input: LeadConversionInput) =>
      request<ApiLeadConversion>('/api/v1/leads/' + encodeURIComponent(id) + '/convert', { method: 'POST', body: JSON.stringify(input) }, true),
    getLeadConversion: (id: string) =>
      request<ApiLeadConversion>('/api/v1/leads/' + encodeURIComponent(id) + '/conversion', {}, true),
    listAccounts: (params: { page?: number; pageSize?: number; q?: string } = {}) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
      return request<ApiPage<ApiAccount>>('/api/v1/accounts' + (search.size ? '?' + search.toString() : ''), {}, true);
    },
    getAccount: (id: string) => request<ApiAccount>('/api/v1/accounts/' + encodeURIComponent(id), {}, true),
    createAccount: (input: AccountInput) =>
      request<ApiAccount>('/api/v1/accounts', { method: 'POST', body: JSON.stringify(input) }, true),
    updateAccount: (id: string, patch: Partial<AccountInput> & { expected_version: number }) =>
      request<ApiAccount>('/api/v1/accounts/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }, true),
    deleteAccount: (id: string) =>
      request<{ id: string }>('/api/v1/accounts/' + encodeURIComponent(id), { method: 'DELETE' }, true),
    listContacts: (params: { page?: number; pageSize?: number; q?: string; account_id?: string } = {}) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
      return request<ApiPage<ApiContact>>('/api/v1/contacts' + (search.size ? '?' + search.toString() : ''), {}, true);
    },
    getContact: (id: string) => request<ApiContact>('/api/v1/contacts/' + encodeURIComponent(id), {}, true),
    createContact: (input: ContactInput) =>
      request<ApiContact>('/api/v1/contacts', { method: 'POST', body: JSON.stringify(input) }, true),
    updateContact: (id: string, patch: Partial<ContactInput> & { expected_version: number }) =>
      request<ApiContact>('/api/v1/contacts/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }, true),
    deleteContact: (id: string) =>
      request<{ id: string }>('/api/v1/contacts/' + encodeURIComponent(id), { method: 'DELETE' }, true),
    listPipelines: () => request<ApiPipeline[]>('/api/v1/pipelines', {}, true),
    getPipeline: (id: string) => request<ApiPipeline>('/api/v1/pipelines/' + encodeURIComponent(id), {}, true),
    createPipeline: (name: string) => request<ApiPipeline>('/api/v1/pipelines',
      { method: 'POST', body: JSON.stringify({ name }) }, true),
    addPipelineStage: (pipelineId: string, name: string, kind: ApiStageKind) =>
      request<ApiPipelineStage>('/api/v1/pipelines/' + encodeURIComponent(pipelineId) + '/stages',
        { method: 'POST', body: JSON.stringify({ name, kind }) }, true),
    listDeals: (params: { pipeline_id?: string; page?: number; pageSize?: number; q?: string } = {}) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
      return request<ApiPage<ApiDeal>>('/api/v1/deals' + (search.size ? '?' + search.toString() : ''), {}, true);
    },
    getDeal: (id: string) => request<ApiDeal>('/api/v1/deals/' + encodeURIComponent(id), {}, true),
    getDealEvents: (id: string) => request<ApiDealEvent[]>('/api/v1/deals/' + encodeURIComponent(id) + '/events', {}, true),
    createDeal: (input: DealInput) => request<ApiDeal>('/api/v1/deals',
      { method: 'POST', body: JSON.stringify(input) }, true),
    updateDeal: (id: string, patch: Partial<Omit<DealInput, 'pipeline_id' | 'stage_id'>> & { expected_version: number }) =>
      request<ApiDeal>('/api/v1/deals/' + encodeURIComponent(id),
        { method: 'PATCH', body: JSON.stringify(patch) }, true),
    moveDeal: (id: string, stageId: string, expectedVersion: number) =>
      request<ApiDeal>('/api/v1/deals/' + encodeURIComponent(id) + '/move',
        { method: 'POST', body: JSON.stringify({ stage_id: stageId, expected_version: expectedVersion }) }, true),
    archiveDeal: (id: string) => request<{ id: string }>('/api/v1/deals/' + encodeURIComponent(id),
      { method: 'DELETE' }, true),
    overviewReport: () => request<ApiOverviewReport>('/api/v1/reports/overview', {}, true),
    forecastReport: (filters: { pipeline_id?: string; close_from?: string; close_to?: string } = {}) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) search.set(key, value);
      return request<ApiForecastReport>('/api/v1/reports/forecast' + (search.size ? '?' + search : ''), {}, true);
    },
    updateStageProbability: (pipelineId: string, stageId: string, probability: number) =>
      request<ApiPipelineStage>('/api/v1/pipelines/' + encodeURIComponent(pipelineId) + '/stages/' + encodeURIComponent(stageId) + '/probability',
        { method: 'PATCH', body: JSON.stringify({ probability }) }, true),
    pipelineReport: (pipelineId?: string) => {
      const search = pipelineId ? '?pipeline_id=' + encodeURIComponent(pipelineId) : '';
      return request<ApiPipelineReport>('/api/v1/reports/pipelines' + search, {}, true);
    },
    listAssignees: () => request<ApiAssignee[]>('/api/v1/activities/assignees', {}, true),
    listActivities: (params: { page?: number; pageSize?: number; q?: string; kind?: ApiActivityKind;
      status?: ApiActivityStatus; assigned_to?: string; mine?: boolean; due_before?: string } = {}) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') search.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
      return request<ApiPage<ApiActivity>>('/api/v1/activities' + (search.size ? '?' + search.toString() : ''), {}, true);
    },
    getActivity: (id: string) => request<ApiActivity>('/api/v1/activities/' + encodeURIComponent(id), {}, true),
    getActivityEvents: (id: string) => request<ApiActivityEvent[]>('/api/v1/activities/' + encodeURIComponent(id) + '/events', {}, true),
    createActivity: (input: ActivityInput) =>
      request<ApiActivity>('/api/v1/activities', { method: 'POST', body: JSON.stringify(input) }, true),
    updateActivity: (id: string, patch: Partial<ActivityInput> & { expected_version: number }) =>
      request<ApiActivity>('/api/v1/activities/' + encodeURIComponent(id),
        { method: 'PATCH', body: JSON.stringify(patch) }, true),
    archiveActivity: (id: string) => request<{ id: string }>('/api/v1/activities/' + encodeURIComponent(id),
      { method: 'DELETE' }, true),



  };
}
