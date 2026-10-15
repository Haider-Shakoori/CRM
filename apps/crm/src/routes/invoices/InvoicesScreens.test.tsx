'use client';

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { InvoiceRecord } from '@crm/shared-types';
import { createMockServices, type MockServiceContainer } from '@crm/mock-services';
import { ServiceProvider } from '../../app/ServiceProvider';
import { InvoiceDetail } from './InvoicesScreens';

/**
 * Invoice screen behaviour tests.
 *
 * The point of these is the settlement path: marking an invoice paid must write through the
 * service, must not be reachable twice, and must leave the balance at zero. Each dialog is
 * addressed through its own `role=dialog` container because the trigger and the submit control
 * deliberately carry the same label. As with the contract tests, the browser could not dispatch
 * pointer events for this batch, so this is where the write paths are actually exercised.
 */

function payableInvoice(services: MockServiceContainer): Promise<InvoiceRecord> {
  return services.invoices.list({ page: 1, pageSize: 100 }).then((page) => {
    const candidate = page.items.find((invoice) => ['draft', 'issued', 'payment_pending', 'overdue'].includes(invoice.status));
    if (!candidate) throw new Error('The seeded dataset holds no payable invoice.');
    return candidate;
  });
}

function renderDetail(services: MockServiceContainer, invoiceId: string) {
  return render(
    <ServiceProvider services={services} persist={false}>
      <MemoryRouter initialEntries={[`/app/subscriptions/invoices/${invoiceId}`]}>
        <Routes>
          <Route path="/app/subscriptions/invoices/:invoiceId" element={<InvoiceDetail />} />
        </Routes>
      </MemoryRouter>
    </ServiceProvider>,
  );
}

async function openDialog(name: string): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog');
}

describe('InvoiceDetail settlement writes', () => {
  it('settles the balance when the invoice is marked paid', async () => {
    const services = createMockServices({ persist: false });
    const invoice = await payableInvoice(services);
    renderDetail(services, invoice.id);

    const dialog = await openDialog('Mark paid');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const stored = await services.invoices.get(invoice.id);
    if (!stored.ok) throw new Error('The invoice could not be read.');
    expect(stored.data.status).toBe('payment_received');
    expect(stored.data.balanceDue.amount).toBe(0);
    expect(stored.data.amountPaid.amount).toBe(stored.data.total.amount);
    // The settlement controls disappear once there is nothing left to collect.
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull();
  });

  it('records a partial payment without settling the invoice', async () => {
    const services = createMockServices({ persist: false });
    const invoice = await payableInvoice(services);
    renderDetail(services, invoice.id);

    const dialog = await openDialog('Record payment');
    const amount = within(dialog).getByLabelText(/Amount/);
    await userEvent.clear(amount);
    await userEvent.type(amount, '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    // The dialog closes in the write's success handler, so waiting for it removes the race
    // against the service's simulated latency.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const stored = await services.invoices.get(invoice.id);
    if (!stored.ok) throw new Error('The invoice could not be read.');
    expect(stored.data.amountPaid.amount).toBe(invoice.amountPaid.amount + 1);
    expect(stored.data.balanceDue.amount).toBe(invoice.total.amount - invoice.amountPaid.amount - 1);
    expect(stored.data.status).not.toBe('payment_received');
  });

  it('voids only when a reason is given and keeps the reason on the record', async () => {
    const services = createMockServices({ persist: false });
    const invoice = await payableInvoice(services);
    renderDetail(services, invoice.id);

    const dialog = await openDialog('Void');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Void invoice' }));

    const refused = await services.invoices.get(invoice.id);
    if (!refused.ok) throw new Error('The invoice could not be read.');
    expect(refused.data.status).toBe(invoice.status);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Raised against the wrong contract.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Void invoice' }));

    expect(await screen.findByText('This invoice is void')).toBeInTheDocument();
    const voided = await services.invoices.get(invoice.id);
    if (!voided.ok) throw new Error('The invoice could not be read.');
    expect(voided.data.status).toBe('void');
    expect(voided.data.balanceDue.amount).toBe(0);
    expect(voided.data.notes).toContain('Raised against the wrong contract.');
  });
});
