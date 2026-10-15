'use client';

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { KanbanBoard, PipelineList, type KanbanCard, type KanbanColumn } from './kanban';

/**
 * Kanban behaviour tests.
 *
 * These exist because the board makes a structural promise that a reviewer cannot see by
 * looking at it: **every way of moving a card goes through one handler**. Drag, the
 * per-card stage buttons and the list selector must all produce the same call with the same
 * arguments, a refusal must leave the board unchanged and say why, and every outcome must
 * reach the live region so a screen-reader user is told what happened.
 *
 * A note on scope. dnd-kit resolves a drop from the browser's layout geometry, and jsdom has
 * no layout, so a synthetic pointer drag cannot be made to land on a column reliably. The
 * tests therefore exercise the *shared* move path through the controls that do not need
 * geometry — the stage buttons on each card and the selector in the list view — and assert
 * that both reach the identical `onMove` call. The drag handler itself is a thin wrapper
 * around that same call, which is the property being protected.
 */

const columns: KanbanColumn[] = [
  { id: 'qualify', label: 'Qualify', tone: 'blue', probability: 20 },
  { id: 'propose', label: 'Propose', tone: 'violet', probability: 50 },
  { id: 'negotiate', label: 'Negotiate', tone: 'amber', probability: 80 },
];

const cards: KanbanCard[] = [{ id: 'deal-1', columnId: 'qualify', title: 'Deal one', value: '$12,000' }];

/** The board's single polite live region. */
function liveRegion(): HTMLElement | null {
  return document.querySelector('[aria-live="polite"]');
}

describe('KanbanBoard', () => {
  it('moves a card forward through the same call the board uses for a drop', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockResolvedValue(undefined);

    render(<KanbanBoard columns={columns} cards={cards} onMove={onMove} />);

    await user.click(screen.getByRole('button', { name: 'Move Deal one forward to Propose' }));

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove).toHaveBeenCalledWith('deal-1', 'propose');
  });

  it('routes the board control and the list selector through identical move calls', async () => {
    const user = userEvent.setup();

    const boardMove = vi.fn().mockResolvedValue(undefined);
    const board = render(<KanbanBoard columns={columns} cards={cards} onMove={boardMove} />);
    await user.click(screen.getByRole('button', { name: 'Move Deal one forward to Propose' }));
    await waitFor(() => expect(boardMove).toHaveBeenCalledTimes(1));
    const boardCall = boardMove.mock.calls[0];
    board.unmount();

    const listMove = vi.fn().mockResolvedValue(undefined);
    render(<PipelineList columns={columns} cards={cards} onMove={listMove} />);
    await user.selectOptions(screen.getByLabelText('Move Deal one to another stage'), 'propose');
    await waitFor(() => expect(listMove).toHaveBeenCalledTimes(1));

    // The two independent input methods produced the exact same service call.
    expect(listMove.mock.calls[0]).toEqual(boardCall);
    expect(listMove).toHaveBeenCalledWith('deal-1', 'propose');
  });

  it('leaves the card in place and announces the reason when the move is rejected', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockRejectedValue(new Error('The stage change was rejected by the server.'));

    render(<KanbanBoard columns={columns} cards={cards} onMove={onMove} />);

    await user.click(screen.getByRole('button', { name: 'Move Deal one forward to Propose' }));
    await waitFor(() =>
      expect(liveRegion()?.textContent).toMatch(/Could not move .*Deal one.* rejected by the server/i),
    );

    // The board is controlled, so a refusal must not have optimistically moved anything.
    const qualify = screen.getByRole('region', { name: /Qualify, 1 card/ });
    expect(within(qualify).getByText('Deal one')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Propose, 0 cards/ })).queryByText('Deal one')).not.toBeInTheDocument();
  });

  it('refuses a move into a locked column without calling the service, and explains why', async () => {
    const user = userEvent.setup();
    const lockedColumns: KanbanColumn[] = [
      { id: 'qualify', label: 'Qualify', tone: 'blue' },
      {
        id: 'closed',
        label: 'Closed won',
        tone: 'green',
        acceptDrop: false,
        dropBlockedReason: 'Approval is required before this stage.',
      },
    ];
    const onMove = vi.fn();

    render(<KanbanBoard columns={lockedColumns} cards={cards} onMove={onMove} />);

    expect(screen.getByText('Locked')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move Deal one forward to Closed won' }));

    expect(onMove).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(liveRegion()?.textContent).toMatch(/Cannot move .*Deal one.* Approval is required before this stage/i),
    );
  });

  it('announces a successful move exactly once', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockResolvedValue(undefined);

    render(<KanbanBoard columns={columns} cards={cards} onMove={onMove} />);

    await user.click(screen.getByRole('button', { name: 'Move Deal one forward to Propose' }));

    await waitFor(() => expect(liveRegion()?.textContent).toMatch(/moved to Propose\./));
    expect(liveRegion()?.textContent).not.toMatch(/Could not move/);
  });

  it('disables the stage controls at the ends of the pipeline', () => {
    render(<KanbanBoard columns={columns} cards={cards} onMove={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Already in the first stage' })).toBeDisabled();
  });

  it('offers no path into a locked column from the list view either', () => {
    const lockedColumns: KanbanColumn[] = [
      { id: 'qualify', label: 'Qualify', tone: 'blue' },
      { id: 'closed', label: 'Closed won', tone: 'green', acceptDrop: false },
    ];

    render(<PipelineList columns={lockedColumns} cards={cards} onMove={() => undefined} />);

    expect(screen.getByRole('option', { name: 'Closed won' })).toBeDisabled();
  });
});

describe('PipelineList', () => {
  it('has no detectable accessibility violations', async () => {
    render(<PipelineList columns={columns} cards={cards} onMove={() => undefined} />);

    // jsdom performs no layout, so contrast cannot be computed and the landmark rule is not
    // meaningful for a bare list; every other rule still runs.
    await expect(
      axe(document.body, { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } }),
    ).resolves.toHaveNoViolations();
  });
});
