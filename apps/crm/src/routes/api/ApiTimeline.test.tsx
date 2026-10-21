import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApiTimeline from './ApiTimeline';

const success = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });

describe('Real CRM communication timeline', () => {
  const makeFetch = (role: 'owner' | 'viewer' = 'owner') => {
    let noteCreated = false;
    let activityCreated = false;
    let activityStatus = 'open';
    let activityVersion = 1;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/me')) return success({
        user: { id: 'user-1', name: 'Member', email: 'user@example.test', email_verified: true },
        organizations: [{ id: 'org-1', name: 'Alpha', role }, { id: 'org-2', name: 'Bravo', role: 'viewer' }],
      });
      if (url.includes('/leads?')) return success({
        items: [{ id: 'lead-1', name: 'Example Prospect', version: 1 }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
      if (url.includes('/timeline/summary?')) return success({
        notes: noteCreated ? 1 : 0, activities: activityCreated ? 1 : 0,
        open: activityCreated && activityStatus === 'open' ? 1 : 0,
        completed: activityCreated && activityStatus === 'completed' ? 1 : 0,
        open_tasks: activityCreated && activityStatus === 'open' ? 1 : 0,
        overdue: 0, next_due_at: null,
      });
      if (url.includes('/timeline?')) return success({
        subject_type: 'lead', subject_id: 'lead-1',
        items: [...(activityCreated ? [{
          id: 'activity-1', entry_type: 'activity', kind: 'task', status: activityStatus,
          actor_user_id: 'user-1', actor_name: 'Member', title: 'Follow up', description: 'Discuss order',
          created_at: '2026-10-21T00:01:00Z', due_at: null,
          completed_at: activityStatus === 'completed' ? '2026-10-21T01:00:00Z' : null, version: activityVersion,
        }] : []), ...(noteCreated ? [{
          id: 'note-1', entry_type: 'note', kind: 'note', status: null,
          actor_user_id: 'user-1', actor_name: 'Member', title: 'Discovery note',
          description: 'Spoke with customer', created_at: '2026-10-21T00:00:00Z',
          due_at: null, completed_at: null, version: 1,
        }] : [])],
        meta: { page: 1, pageSize: 25, total: Number(noteCreated) + Number(activityCreated), totalPages: 1, hasNext: false, hasPrev: false },
      });
      if (url.endsWith('/activities/assignees')) return success([{ id: 'user-1', name: 'Member', role: 'owner', email: 'member@example.test' }]);
      if (url.endsWith('/activities') && init?.method === 'POST') {
        activityCreated = true;
        return success({ id: 'activity-1', status: 'open', version: 1 });
      }
      if (url.endsWith('/activities/activity-1') && init?.method === 'PATCH') {
        activityStatus = JSON.parse(String(init.body)).status;
        activityVersion += 1;
        return success({ id: 'activity-1', status: activityStatus, version: activityVersion });
      }
      if (url.endsWith('/notes') && init?.method === 'POST') {
        noteCreated = true;
        return success({ id: 'note-1', title: 'Discovery note', body: 'Spoke with customer', version: 1 });
      }
      throw new Error('Unexpected API request: ' + url);
    });
    return fetcher;
  };

  it('does not show mutation controls to an organization viewer', async () => {
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    const fetcher = makeFetch('viewer');
    vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter initialEntries={['/crm/timeline?type=lead&id=lead-1']}><ApiTimeline /></MemoryRouter>);
    await screen.findByText('No interactions logged for this record yet.');
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log call, meeting or task' })).toBeNull();
    const requests = fetcher.mock.calls.filter(([url]) => String(url).includes('/timeline?'));
    expect(new Headers(requests[0]?.[1]?.headers).get('X-Organization-ID')).toBe('org-1');
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('posts a note to the selected tenant-scoped record and refreshes the timeline', async () => {
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    const fetcher = makeFetch('owner');
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/crm/timeline?type=lead&id=lead-1']}><ApiTimeline /></MemoryRouter>);
    await screen.findByText('No interactions logged for this record yet.');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByLabelText('Title'), 'Discovery note');
    await user.type(screen.getByLabelText('Notes'), 'Spoke with customer');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([url, init]) =>
      String(url).endsWith('/notes') && init?.method === 'POST')).toBe(true));
    await screen.findByText('Spoke with customer');
    const request = fetcher.mock.calls.find(([url, init]) =>
      String(url).endsWith('/notes') && init?.method === 'POST');
    expect(new Headers(request?.[1]?.headers).get('X-Organization-ID')).toBe('org-1');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      subject_type: 'lead', subject_id: 'lead-1', title: 'Discovery note', body: 'Spoke with customer',
    });
  });
  it('logs an assigned follow-up and completes it without leaving the customer timeline', async () => {
    vi.stubEnv('VITE_CRM_API_URL', 'https://api.example.test');
    const fetcher = makeFetch('owner');
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/crm/timeline?type=lead&id=lead-1']}><ApiTimeline /></MemoryRouter>);
    await screen.findByText('No interactions logged for this record yet.');
    await user.click(screen.getByRole('button', { name: 'Log call, meeting or task' }));
    await user.type(screen.getByLabelText('Subject'), 'Follow up');
    await user.type(screen.getByLabelText('Details / outcome'), 'Discuss order');
    await user.selectOptions(screen.getByLabelText('Assign to'), 'user-1');
    await user.click(screen.getByRole('button', { name: 'Save interaction' }));
    await screen.findByText('Discuss order');
    const create = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/activities') && init?.method === 'POST');
    const payload = JSON.parse(String(create?.[1]?.body));
    expect(payload).toMatchObject({ kind: 'task', status: 'open', lead_id: 'lead-1',
      assigned_to: 'user-1', title: 'Follow up', notes: 'Discuss order' });
    expect(payload.account_id).toBeUndefined();
    expect(new Headers(create?.[1]?.headers).get('X-Organization-ID')).toBe('org-1');
    await user.click(screen.getByRole('button', { name: 'Mark completed' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([url, init]) =>
      String(url).endsWith('/activities/activity-1') && init?.method === 'PATCH')).toBe(true));
    const update = fetcher.mock.calls.find(([url, init]) =>
      String(url).endsWith('/activities/activity-1') && init?.method === 'PATCH');
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({ status: 'completed', expected_version: 1 });
    await screen.findByRole('button', { name: 'Reopen follow-up' });
  });

});
