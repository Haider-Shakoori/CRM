import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApiGlobalSearchPage from './ApiGlobalSearch';

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
const groups = (name: string) => ({
  leads: { items: [{ id: name + '-lead', title: name + ' Prospect', subtitle: '', status: 'new' }], total: 1, has_more: false },
  contacts: { items: [], total: 0, has_more: false },
  accounts: { items: [], total: 0, has_more: false },
  deals: { items: [], total: 0, has_more: false },
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });

describe('Live CRM global search', () => {
  it('never mixes search results after switching organizations', async () => {
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/me')) return success({
        user: { id: 'u', name: 'Tester', email: 'test@example.test', email_verified: true },
        organizations: [{ id: 'org-a', name: 'Alpha', role: 'viewer' }, { id: 'org-b', name: 'Bravo', role: 'owner' }],
      });
      if (url.includes('/search?')) {
        const org = new Headers(init?.headers).get('X-Organization-ID');
        return success({ query: 'acme', per_type: 10, groups: groups(org === 'org-a' ? 'Alpha' : 'Bravo') });
      }
      throw new Error('Unknown request: ' + url);
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/crm/search?q=acme']}><ApiGlobalSearchPage /></MemoryRouter>);
    await screen.findByText('Alpha Prospect');
    expect(screen.getByRole('link', { name: 'Alpha Prospect' }).getAttribute('href')).toBe(
      '/crm/timeline?type=lead&id=Alpha-lead',
    );
    await user.selectOptions(screen.getByLabelText('Organization'), 'org-b');
    await screen.findByText('Bravo Prospect');
    expect(screen.queryByText('Alpha Prospect')).toBeNull();
    const calls = fetcher.mock.calls.filter(([url]) => String(url).includes('/search?'));
    expect(new Headers(calls[0]?.[1]?.headers).get('X-Organization-ID')).toBe('org-a');
    expect(new Headers(calls[calls.length - 1]?.[1]?.headers).get('X-Organization-ID')).toBe('org-b');
    expect(sessionStorage.getItem('crm.live.selected-organization')).toBe('org-b');
  });

  it('requires a valid search and does not fetch records before search is submitted', async () => {
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).endsWith('/auth/me')) return success({
        user: { id: 'u', name: 'Tester', email: 'test@example.test', email_verified: true },
        organizations: [{ id: 'org-a', name: 'Alpha', role: 'owner' }],
      });
      throw new Error('Unexpected record search');
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/crm/search']}><ApiGlobalSearchPage /></MemoryRouter>);
    await screen.findByText('Enter a search term to find CRM records.');
    await user.type(screen.getByLabelText('Search all CRM records'), 'x');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Enter between 2 and 120 characters to search.');
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) =>
      String(url).includes('/search?'))).toHaveLength(0));
  });
});
