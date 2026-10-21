import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApiTags from './ApiTags';

const response = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });

describe('Live CRM segmentation', () => {
  const setup = (role: 'viewer' | 'owner' = 'viewer') => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith('/auth/me')) return response({
        user: { id: 'user-1', name: 'Tester', email: 'test@example.test', email_verified: true },
        organizations: [
          { id: 'org-1', name: 'Alpha', role },
          { id: 'org-2', name: 'Bravo', role: 'viewer' },
        ],
      });
      if (path.includes('/tags?')) return response({
        items: [{ id: 'tag-1', name: 'Priority', color: '#64748b', version: 1 }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
      if (path.includes('/tags/tag-1/records')) return response({
        items: [{ id: 'lead-1', label: 'Prospect', created_at: '2026-10-21T00:00:00Z' }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
      if (path.includes('/leads?')) return response({
        items: [{ id: 'lead-1', name: 'Prospect', version: 1 }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
      if (path.endsWith('/tags') && init?.method === 'POST') return response({
        id: 'tag-2', name: 'New', color: '#64748b', version: 1,
      });
      throw new Error('Unexpected request: ' + path);
    });
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  };

  it('viewer may browse tags but cannot change definitions or assignments', async () => {
    const fetcher = setup('viewer');
    const user = userEvent.setup();
    render(<MemoryRouter><ApiTags /></MemoryRouter>);
    await screen.findByText('Priority');
    await user.click(screen.getByRole('button', { name: 'Priority' }));
    await screen.findByRole('link', { name: 'Prospect' });
    expect(screen.queryByRole('button', { name: 'Assign tag' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create tag' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unassign' })).toBeNull();
    const request = fetcher.mock.calls.find(([url]) => String(url).includes('/tags/tag-1/records'));
    expect(new Headers(request?.[1]?.headers).get('X-Organization-ID')).toBe('org-1');
    expect(fetcher.mock.calls.every(([, opts]) => !opts?.method || opts.method === 'GET')).toBe(true);
  });

  it('owner can create organization-private tags through the Laravel client', async () => {
    const fetcher = setup('owner');
    const user = userEvent.setup();
    render(<MemoryRouter><ApiTags /></MemoryRouter>);
    await screen.findByText('Priority');
    await user.type(screen.getByLabelText('Name'), 'New');
    await user.click(screen.getByRole('button', { name: 'Create tag' }));
    const request = await vi.waitFor(() => {
      const call = fetcher.mock.calls.find(([url, opts]) => String(url).endsWith('/tags') && opts?.method === 'POST');
      expect(call).toBeDefined();
      return call;
    });
    expect(new Headers(request?.[1]?.headers).get('X-Organization-ID')).toBe('org-1');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ name: 'New', color: '#64748b' });
  });
});
