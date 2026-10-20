import * as React from 'react';
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
    await user.type(screen.getByLabelText('New Account name'), 'Unique Account');
    await user.click(screen.getByRole('button', { name: 'Confirm conversion' }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(String(fetcher.mock.calls.find(([url]) => String(url).endsWith('/convert'))?.[1]?.body));
    expect(payload.allow_duplicate_contact).toBe(true);
    expect(payload.account_name).toBe('Unique Account');
  });
});
