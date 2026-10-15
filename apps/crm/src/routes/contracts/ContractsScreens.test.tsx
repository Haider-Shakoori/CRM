'use client';

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Contract } from '@crm/shared-types';
import { createMockServices, type MockServiceContainer } from '@crm/mock-services';
import { ServiceProvider } from '../../app/ServiceProvider';
import ContractList, { ContractDetail } from './ContractsScreens';

/**
 * Contract screen behaviour tests.
 *
 * These cover the promises the screen makes but a reviewer cannot see by reading it: the
 * lifecycle dialogs are reachable, each write goes through the service rather than editing a
 * copy, and a guarded write leaves the record untouched. They also exist because the browser
 * smoke run for this batch could not dispatch input at all — the in-app browsing surface stays
 * hidden, so Chromium delivers no pointer events and every `onClick` in the app is silently
 * untested by that route.
 */

function setup() {
  return createMockServices({ persist: false });
}

async function renewableContract(services: MockServiceContainer): Promise<Contract> {
  const page = await services.contracts.list({ page: 1, pageSize: 100 });
  const candidate = page.items.find((contract) => contract.status === 'active' || contract.status === 'expiring_soon');
  if (!candidate) throw new Error('The seeded dataset holds no renewable contract.');
  return candidate;
}

function renderDetail(services: MockServiceContainer, contractId: string) {
  return render(
    <ServiceProvider services={services} persist={false}>
      <MemoryRouter initialEntries={[`/app/contracts/${contractId}`]}>
        <Routes>
          <Route path="/app/contracts/:contractId" element={<ContractDetail />} />
        </Routes>
      </MemoryRouter>
    </ServiceProvider>,
  );
}

describe('ContractDetail lifecycle writes', () => {
  it('creates a linked renewal through the dialog and closes the original', async () => {
    const user = userEvent.setup();
    const services = setup();
    const contract = await renewableContract(services);
    renderDetail(services, contract.id);

    await user.click(await screen.findByRole('button', { name: 'Renew' }));
    expect(await screen.findByText('Renew this contract')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create renewal' }));

    expect(await screen.findByText('This contract was renewed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew' })).toBeNull();

    const closed = await services.contracts.get(contract.id);
    if (!closed.ok) throw new Error('The closed contract could not be read.');
    expect(closed.data.status).toBe('renewed');
    expect(closed.data.renewalId).toBeTruthy();

    const renewal = await services.contracts.get(closed.data.renewalId as string);
    if (!renewal.ok) throw new Error('The renewal contract could not be read.');
    expect(renewal.data.previousContractId).toBe(contract.id);
    expect(renewal.data.status).toBe('active');
  });

  it('keeps the dialog open and the record unchanged when no termination reason is given', async () => {
    const user = userEvent.setup();
    const services = setup();
    const contract = await renewableContract(services);
    renderDetail(services, contract.id);

    await user.click(await screen.findByRole('button', { name: 'Terminate' }));
    await user.click(screen.getByRole('button', { name: 'Terminate contract' }));

    expect(screen.getByText('Terminate this contract')).toBeInTheDocument();
    const unchanged = await services.contracts.get(contract.id);
    if (!unchanged.ok) throw new Error('The contract could not be read.');
    expect(unchanged.data.status).toBe(contract.status);
    expect(unchanged.data.terminationReason).toBeUndefined();
  });

  it('records a termination reason and removes the lifecycle actions', async () => {
    const user = userEvent.setup();
    const services = setup();
    const contract = await renewableContract(services);
    renderDetail(services, contract.id);

    await user.click(await screen.findByRole('button', { name: 'Terminate' }));
    await user.type(screen.getByLabelText(/Reason/), 'Customer consolidated vendors.');
    await user.click(screen.getByRole('button', { name: 'Terminate contract' }));

    expect(await screen.findByText('This contract was terminated')).toBeInTheDocument();
    expect(screen.getByText(/Customer consolidated vendors\./)).toBeInTheDocument();

    const stored = await services.contracts.get(contract.id);
    if (!stored.ok) throw new Error('The contract could not be read.');
    expect(stored.data.status).toBe('terminated');
    expect(stored.data.autoRenew).toBe(false);
  });

  it('re-derives the annualised value when an amendment changes the contract value', async () => {
    const user = userEvent.setup();
    const services = setup();
    const contract = await renewableContract(services);
    renderDetail(services, contract.id);

    await user.click(await screen.findByRole('button', { name: 'Amend' }));
    const value = screen.getByLabelText('Contract value');
    await user.clear(value);
    await user.type(value, String(contract.contractValue.amount * 2));
    await user.click(screen.getByRole('button', { name: 'Record amendment' }));

    await waitFor(async () => {
      const stored = await services.contracts.get(contract.id);
      if (!stored.ok) throw new Error('The contract could not be read.');
      expect(stored.data.contractValue.amount).toBe(contract.contractValue.amount * 2);
      expect(stored.data.annualisedValue.amount).toBe(
        Math.round(((contract.contractValue.amount * 2) / Math.max(1, contract.termMonths)) * 12),
      );
    });
  });
});

describe('ContractList', () => {
  it('renders seeded contracts with the summary strip', async () => {
    const services = setup();
    const page = await services.contracts.list({ page: 1, pageSize: 100 });
    render(
      <ServiceProvider services={services} persist={false}>
        <MemoryRouter initialEntries={['/app/contracts']}>
          <Routes>
            <Route path="/app/contracts" element={<ContractList />} />
          </Routes>
        </MemoryRouter>
      </ServiceProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Contracts' })).toBeInTheDocument();
    expect(screen.getByText('Active contracts')).toBeInTheDocument();
    const rows = await screen.findAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
    expect(page.meta.total).toBeGreaterThan(0);
  });
});
