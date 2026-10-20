import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformConsole } from './PlatformConsole';

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
const row = {
  id: 'tenant-1', name: 'Acme CRM', slug: 'acme', status: 'active',
  plan: 'starter', subscription_status: 'active', subscription_version: 1, created_at: '2026-10-01',
};
const detail = {
  tenant: row,
  subscription: {
    id: 'sub-1', plan: 'starter', plan_name: 'Starter', version: 1, status: 'active',
    period_ends_at: null, cancel_at_period_end: false, limits: { seats: 3, leads: 200 },
  },
  usage: { seats: 2, leads: 10 },
  organizations: [{ id: 'org-1', name: 'Acme Sales', status: 'active' }],
  subscription_events: [], platform_events: [], billing_connected: false,
};
const plans = [{ code: 'starter', name: 'Starter', public: true, limits: {} },
  { code: 'team', name: 'Team', public: false, limits: {} }];

afterEach(() => { vi.unstubAllGlobals(); });

describe('Verified platform operator UI', () => {
  it('shows access denied and never enumerates tenants when the operator check fails', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { message: 'Platform operator access required.' } }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    render(<PlatformConsole />);
    await screen.findByRole('heading', { name: 'Restricted platform console' });
    expect(screen.getByRole('alert').textContent).toContain('Platform operator access required');
    expect(fetcher.mock.calls).toHaveLength(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/v1/platform/me');
  });

  it('lets a platform viewer inspect tenants but never exposes manual write controls', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const path = String(url);
      if (path.endsWith('/platform/me')) return ok({ id: 'viewer-1', name: 'Platform Viewer', role: 'viewer' });
      if (path.includes('/platform/tenants?')) return ok({
        items: [row], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false },
      });
      if (path.endsWith('/platform/plans')) return ok(plans);
      if (path.endsWith('/platform/tenants/tenant-1')) return ok(detail);
      throw new Error('Unexpected route: ' + path);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<PlatformConsole />);
    const user = userEvent.setup();
    await screen.findByText('Acme CRM');
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await screen.findByText('Acme Sales (active)');
    expect(screen.queryByRole('button', { name: 'Apply manual change' })).toBeNull();
    expect(fetcher.mock.calls.every(([, init]) => init?.method !== 'PATCH')).toBe(true);
  });

  it('requires manual acknowledgment before an operator applies a versioned change', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith('/platform/me')) return ok({ id: 'operator-1', name: 'Platform Operator', role: 'operator' });
      if (path.includes('/platform/tenants?')) return ok({
        items: [row], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false },
      });
      if (path.endsWith('/platform/plans')) return ok(plans);
      if (path.endsWith('/platform/tenants/tenant-1')) return ok(detail);
      if (path.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
      if (path.endsWith('/platform/tenants/tenant-1/subscription') && init?.method === 'PATCH') {
        return ok({ version: 2, subscription: { ...detail.subscription, version: 2, status: 'past_due' }, payment_processed: false });
      }
      throw new Error('Unexpected route: ' + path);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<PlatformConsole />);
    const user = userEvent.setup();
    await screen.findByText('Acme CRM');
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await screen.findByRole('heading', { name: 'Manual subscription action' });
    const submit = screen.getByRole('button', { name: 'Apply manual change' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText('Plan', { exact: true }), 'team');
    await user.selectOptions(screen.getByLabelText('Subscription status'), 'past_due');
    await user.click(screen.getByRole('checkbox', { name: /I understand this manually changes tenant entitlements/ }));
    await user.click(submit);
    await waitFor(() => expect(fetcher.mock.calls.some(([url, options]) =>
      String(url).endsWith('/subscription') && options?.method === 'PATCH')).toBe(true));
    const sent = fetcher.mock.calls.find(([url, options]) =>
      String(url).endsWith('/subscription') && options?.method === 'PATCH');
    const payload = JSON.parse(String(sent?.[1]?.body));
    expect(payload.expected_version).toBe(1);
    expect(payload.plan_code).toBe('team');
    expect(payload.status).toBe('past_due');
    expect(payload.acknowledge_manual_change).toBe(true);
    expect(payload.tenant_id).toBeUndefined();
  });
});
