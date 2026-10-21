import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApiCustomFields from './ApiCustomFields';

const success = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });

describe('Laravel CRM custom fields', () => {
  const makeFetcher = (role: string) => {
    let saved: string | null = null;
    return vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith('/auth/me')) return success({
        user: { id: 'user-1', name: 'CRM User', email: 'user@example.test', email_verified: true },
        organizations: [{ id: 'org-1', name: 'Alpha', role }],
      });
      if (path.includes('/custom-fields?')) return success([{
        id: 'field-1', object_type: 'lead', field_key: 'priority', label: 'Priority',
        field_type: 'text', options: [], is_active: true, version: 1,
      }]);
      if (path.includes('/custom-fields/values?')) return success([{
        field: {
          id: 'field-1', object_type: 'lead', field_key: 'priority', label: 'Priority',
          field_type: 'text', options: [], is_active: true, version: 1,
        }, value: saved, version: saved === null ? null : 1,
      }]);
      if (path.includes('/leads?')) return success({
        items: [{ id: 'lead-1', name: 'Example Prospect', version: 1 }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
      if (path.endsWith('/custom-fields/values') && init?.method === 'PUT') {
        saved = JSON.parse(String(init.body)).value as string;
        return success({ field_id: 'field-1', value: saved, version: 1 });
      }
      if (path.endsWith('/custom-fields') && init?.method === 'POST') return success({
        id: 'field-2', label: 'New field', field_type: 'text', object_type: 'lead',
        field_key: 'new_field', options: [], is_active: true, version: 1,
      });
      throw new Error('Unexpected request: ' + path);
    });
  };

  it('does not expose creation or value updates to viewer roles', async () => {
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    const fetcher = makeFetcher('viewer');
    vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter initialEntries={['/crm/custom-fields?type=lead&id=lead-1']}>
      <ApiCustomFields />
    </MemoryRouter>);
    await screen.findByText('Priority');
    await screen.findByLabelText('priority'.charAt(0).toUpperCase() + 'riority');
    expect(screen.queryByRole('button', { name: 'Create field' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save value' })).toBeNull();
    expect(fetcher.mock.calls.every(([, init]) => init?.method !== 'PUT')).toBe(true);
  });

  it('saves typed record values with membership-scoped headers and correct version', async () => {
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    const fetcher = makeFetcher('owner');
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/crm/custom-fields?type=lead&id=lead-1']}>
      <ApiCustomFields />
    </MemoryRouter>);
    const field = await screen.findByLabelText('Priority');
    await user.type(field, 'Urgent');
    await user.click(screen.getByRole('button', { name: 'Save value' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([url, init]) =>
      String(url).endsWith('/custom-fields/values') && init?.method === 'PUT')).toBe(true));
    const call = fetcher.mock.calls.find(([url, init]) =>
      String(url).endsWith('/custom-fields/values') && init?.method === 'PUT');
    expect(new Headers(call?.[1]?.headers).get('X-Organization-ID')).toBe('org-1');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      field_id: 'field-1', subject_type: 'lead', subject_id: 'lead-1',
      value: 'Urgent', expected_version: null,
    });
  });
});
