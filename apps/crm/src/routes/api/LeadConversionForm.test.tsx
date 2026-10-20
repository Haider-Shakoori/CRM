import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadConversionForm from './LeadConversionForm';
import { createLaravelClient } from '../../app/laravelClient';

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

describe('Lead conversion form', () => {
  it('requires duplicate acknowledgment before conversion', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).endsWith('/matches')) return success({
        contact_email_matches: [{ id: 'c1', first_name: 'Old', last_name: 'Person', email: 'same@example.test', account_id: null }],
        lead_email_matches: [], match_rule: 'exact email',
      });
      if (String(url).endsWith('/pipelines')) return success([]);
      if (String(url).endsWith('/convert')) return success({ id: 'converted', account_id: 'a', contact_id: 'c', deal_id: null });
      throw new Error('Unknown request');
    });
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-1', fetchImpl: fetcher });
    const done = vi.fn();
    const user = userEvent.setup();
    render(<LeadConversionForm client={client}
      lead={{ id: 'l1', name: 'New Person', email: 'same@example.test', version: 1 }}
      onConverted={done} onCancel={vi.fn()} />);
    await screen.findByText(/Records with the same email were found/);
    expect((screen.getByRole('button', { name: 'Confirm conversion' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /I reviewed the matches/ }));
    await user.type(screen.getByLabelText(/^New Account name/), 'Unique Account');
    await user.click(screen.getByRole('button', { name: 'Confirm conversion' }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(String(fetcher.mock.calls.find(([url]) => String(url).endsWith('/convert'))?.[1]?.body));
    expect(payload.allow_duplicate_contact).toBe(true);
    expect(payload.account_name).toBe('Unique Account');
  });
  it('chooses an existing Account and creates an optional Deal', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const path = String(url);
      if (path.endsWith('/matches')) return success({ contact_email_matches: [], lead_email_matches: [], match_rule: 'exact email' });
      if (path.endsWith('/pipelines')) return success([{ id: 'p1', name: 'Sales',
        stages: [{ id: 's1', name: 'Prospecting', kind: 'open', probability: 10, position: 1 }] }]);
      if (path.includes('/accounts?')) return success({ items: [{ id: 'a1', name: 'Existing' }], meta: { total: 1 } });
      if (path.endsWith('/convert')) return success({ id: 'converted', account_id: 'a1', contact_id: 'c1', deal_id: 'd1' });
      throw new Error('Unexpected request: ' + path);
    });
    const client = createLaravelClient({ baseUrl: 'https://api.example.test', organizationId: 'org-1', fetchImpl: fetcher });
    const done = vi.fn();
    const user = userEvent.setup();
    render(<LeadConversionForm client={client}
      lead={{ id: 'l1', name: 'New Person', email: 'unique@example.test', version: 2 }}
      onConverted={done} onCancel={vi.fn()} />);
    await screen.findByText(/No existing Contacts or other Leads/);
    await user.click(screen.getByLabelText('Use existing Account'));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('option', { name: 'Existing' });
    await user.selectOptions(screen.getByLabelText('Account', { exact: true }), 'a1');
    await user.click(screen.getByRole('checkbox', { name: /Create a Deal linked/ }));
    await user.selectOptions(screen.getByLabelText('Pipeline', { exact: true }), 'p1');
    await user.selectOptions(screen.getByLabelText('Stage', { exact: true }), 's1');
    await user.click(screen.getByRole('button', { name: 'Confirm conversion' }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(String(fetcher.mock.calls.find(([url]) => String(url).endsWith('/convert'))?.[1]?.body));
    expect(payload.account_id).toBe('a1');
    expect(payload.account_name).toBeUndefined();
    expect(payload.deal.pipeline_id).toBe('p1');
    expect(payload.deal.stage_id).toBe('s1');
    expect(payload.allow_duplicate_contact).toBeUndefined();
  });

});
