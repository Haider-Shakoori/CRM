import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApiCalendar from './ApiCalendar';

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

afterEach(() => { vi.unstubAllGlobals(); });
beforeEach(() => { sessionStorage.clear(); });

describe('Live CRM calendar', () => {
  it('loads only the selected organization date window, never mock events', async () => {
    const eventDate = new Date();
    const due = new Date(eventDate.getFullYear(), eventDate.getMonth(), 15, 14, 0).toISOString();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, options) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) return ok({
        user: { id: 'user-1', name: 'Tester', email: 'test@example.test', email_verified: true },
        organizations: [{ id: 'org-1', name: 'Alpha', role: 'owner' }, { id: 'org-2', name: 'Bravo', role: 'member' }],
      });
      if (url.includes('/api/v1/activities?')) {
        const org = new Headers(options?.headers).get('X-Organization-ID');
        return ok({
          items: org === 'org-1' ? [{ id: 'a1', title: 'Confirm proposal call', kind: 'call', status: 'open',
            due_at: due, notes: null }] : [{ id: 'b1', title: 'Bravo only meeting', kind: 'meeting',
            status: 'open', due_at: due, notes: null }],
          meta: { total: 1, page: 1, pageSize: 100, hasNext: false, hasPrev: false },
        });
      }
      throw new Error('Unexpected URL: ' + url);
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<MemoryRouter><ApiCalendar /></MemoryRouter>);
    await screen.findByText('1 due');
    expect(screen.getByRole('heading', { name: 'CRM Calendar' })).toBeTruthy();
    const queries = fetcher.mock.calls.filter(([url]) => String(url).includes('/api/v1/activities?'));
    expect(new Headers(queries[0]?.[1]?.headers).get('X-Organization-ID')).toBe('org-1');
    const url = new URL(String(queries[0]?.[0]));
    expect(url.searchParams.get('due_from')).toMatch(/T/);
    expect(url.searchParams.get('due_to')).toMatch(/T/);
    await user.click(screen.getByRole('button', { name: /15.*1 due/ }));
    await screen.findByText('Confirm proposal call');
    await user.selectOptions(screen.getByLabelText('Organization'), 'org-2');
    await waitFor(() => expect(screen.getByText('Bravo only meeting')).toBeTruthy());
    expect(screen.queryByText('Confirm proposal call')).toBeNull();
    expect(sessionStorage.getItem('crm.live.selected-organization')).toBe('org-2');
  });
});
