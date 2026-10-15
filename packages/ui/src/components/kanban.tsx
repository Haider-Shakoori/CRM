'use client';

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, GripVertical, MoveRight } from 'lucide-react';
import { cn, focusRing, toneClass, truncate, type Tone } from '../lib/utils';
import { Button } from './primitives';

/**
 * Kanban board.
 *
 * The design decision that matters most here is the relationship between dragging and every
 * other way of moving a card. They are **not two features**: both paths call the same
 * `onMove` handler, which the caller wires to a single server operation returning the
 * recomputed totals. That is what makes "the board and the totals can never disagree"
 * structurally true instead of a thing to remember.
 *
 * Accessibility is not optional here. Drag-and-drop is unavailable to keyboard users and to
 * anyone using a screen reader, so:
 *
 *   - Each card carries a "move to stage" control that works with the keyboard alone.
 *   - Each column carries previous/next controls so a card can be advanced without any
 *     pointer interaction at all.
 *   - Droppable columns announce their card count and stage probability.
 *   - Live regions announce the result of a move, including a failure.
 */

export interface KanbanColumn {
  id: string;
  label: string;
  tone: Tone;
  /** Weighting applied to the cards, shown in the header. */
  probability?: number;
  description?: string;
  /** Blocks a drop, e.g. a stage that requires an approval first. */
  acceptDrop?: boolean;
  /** Renders a lock affordance explaining why drops are rejected. */
  dropBlockedReason?: string;
}

export interface KanbanCard {
  id: string;
  columnId: string;
  title: string;
  subtitle?: string;
  /** Primary figure, already formatted by the caller. */
  value?: string;
  /** Secondary metadata rendered as chips. */
  meta?: Array<{ label: string; tone?: Tone }>;
  /** Renders a warning stripe, e.g. a stale deal. */
  attention?: 'warning' | 'danger';
  avatar?: React.ReactNode;
  /** Accessible summary of the card, used by the move controls. */
  ariaLabel?: string;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  /**
   * Called for every move, from any input method. Returning a rejected promise lets the
   * board roll the card back and announce the reason.
   */
  onMove: (cardId: string, toColumnId: string) => Promise<void> | void;
  onCardClick?: (cardId: string) => void;
  /** Renders extra content in a column header, e.g. a weighted total. */
  renderColumnSummary?: (columnId: string, cards: KanbanCard[]) => React.ReactNode;
  /** Rendered when a column has no cards. */
  emptyColumnLabel?: string;
  /** Ids currently being saved, so each card can show its own pending state. */
  pendingIds?: string[];
  className?: string;
  /** Height of the scrollable board area. */
  height?: string;
}

export function KanbanBoard({
  columns,
  cards,
  onMove,
  onCardClick,
  renderColumnSummary,
  emptyColumnLabel = 'Nothing here',
  pendingIds = [],
  className,
  height = 'calc(100dvh - 20rem)',
}: KanbanBoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const [movingId, setMovingId] = React.useState<string | null>(null);

  const sensors = useSensors(
    // A small activation distance keeps a click distinct from a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const cardsByColumn = React.useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const column of columns) map.set(column.id, []);
    for (const card of cards) {
      const bucket = map.get(card.columnId);
      if (bucket) bucket.push(card);
      else map.set(card.columnId, [card]);
    }
    return map;
  }, [columns, cards]);

  /** Run a move through the shared handler, with rollback and an announcement. */
  const handleMove = React.useCallback(
    async (cardId: string, toColumnId: string) => {
      const card = cards.find((candidate) => candidate.id === cardId);
      const target = columns.find((column) => column.id === toColumnId);
      if (!card || !target || card.columnId === toColumnId) return;
      if (target.acceptDrop === false) {
        setAnnouncement(`Cannot move “${card.title}” to ${target.label}. ${target.dropBlockedReason ?? 'That stage is not accepting cards.'}`);
        return;
      }

      setMovingId(cardId);
      setAnnouncement(`Moving “${card.title}” to ${target.label}…`);
      try {
        await onMove(cardId, toColumnId);
        setAnnouncement(`“${card.title}” moved to ${target.label}.`);
      } catch (error) {
        setAnnouncement(
          `Could not move “${card.title}”. ${error instanceof Error ? error.message : 'The change was not saved.'}`,
        );
      } finally {
        setMovingId(null);
      }
    },
    [cards, columns, onMove],
  );

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    // The pointer may land on a card rather than the column, so resolve both cases.
    const targetColumn = columns.some((column) => column.id === overId)
      ? overId
      : cards.find((card) => card.id === overId)?.columnId;
    if (targetColumn) void handleMove(String(active.id), targetColumn);
  };

  const activeCard = activeId ? cards.find((card) => card.id === activeId) : undefined;

  return (
    <div className={cn('flex flex-col', className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex min-h-0 gap-3 overflow-x-auto pb-2" style={{ height }}>
          {columns.map((column, columnIndex) => (
            <KanbanColumnView
              key={column.id}
              column={column}
              cards={cardsByColumn.get(column.id) ?? []}
              allColumns={columns}
              columnIndex={columnIndex}
              onMove={handleMove}
              onCardClick={onCardClick}
              renderColumnSummary={renderColumnSummary}
              emptyColumnLabel={emptyColumnLabel}
              pendingIds={pendingIds}
              movingId={movingId}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
          {activeCard ? <CardShell card={activeCard} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* One live region for the board, so every move is announced exactly once. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

function KanbanColumnView({
  column,
  cards,
  allColumns,
  columnIndex,
  onMove,
  onCardClick,
  renderColumnSummary,
  emptyColumnLabel,
  pendingIds,
  movingId,
}: {
  column: KanbanColumn;
  cards: KanbanCard[];
  allColumns: KanbanColumn[];
  columnIndex: number;
  onMove: (cardId: string, toColumnId: string) => void;
  onCardClick?: (cardId: string) => void;
  renderColumnSummary?: (columnId: string, cards: KanbanCard[]) => React.ReactNode;
  emptyColumnLabel: string;
  pendingIds: string[];
  movingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: column.acceptDrop === false });
  const previous = allColumns[columnIndex - 1];
  const next = allColumns[columnIndex + 1];

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label}, ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}
      className={cn(
        'flex w-[17rem] shrink-0 flex-col rounded-lg border bg-inset/60 transition-colors',
        isOver && column.acceptDrop !== false ? 'border-brand bg-brand-subtle/50' : 'border-border-subtle',
        column.acceptDrop === false && 'opacity-80',
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-border-subtle px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <span className={cn('size-1.5 shrink-0 rounded-full', toneClass(column.tone, 'dot'))} aria-hidden />
            <span className="truncate">{column.label}</span>
          </h2>
          <p className="mt-0.5 text-2xs text-subtle">
            {cards.length} {cards.length === 1 ? 'deal' : 'deals'}
            {typeof column.probability === 'number' ? ` · ${column.probability}%` : ''}
          </p>
        </div>
        {column.acceptDrop === false ? (
          <span className="shrink-0 rounded border border-dashed border-border-strong px-1 text-[0.5625rem] uppercase tracking-wide text-faint" title={column.dropBlockedReason}>
            Locked
          </span>
        ) : null}
      </header>

      {renderColumnSummary ? (
        <div className="border-b border-border-subtle px-3 py-2">{renderColumnSummary(column.id, cards)}</div>
      ) : null}

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul className="min-h-[6rem] flex-1 space-y-2 overflow-y-auto p-2">
          {cards.length === 0 ? (
            <li className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center text-2xs text-faint">
              {column.acceptDrop === false ? column.dropBlockedReason ?? 'Not accepting cards' : emptyColumnLabel}
            </li>
          ) : null}

          {cards.map((card, cardIndex) => (
            <KanbanCardView
              key={card.id}
              card={card}
              column={column}
              previous={previous}
              next={next}
              onMove={onMove}
              onCardClick={onCardClick}
              isPending={pendingIds.includes(card.id) || movingId === card.id}
              position={cardIndex + 1}
              total={cards.length}
            />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function KanbanCardView({
  card,
  column,
  previous,
  next,
  onMove,
  onCardClick,
  isPending,
  position,
  total,
}: {
  card: KanbanCard;
  column: KanbanColumn;
  previous?: KanbanColumn;
  next?: KanbanColumn;
  onMove: (cardId: string, toColumnId: string) => void;
  onCardClick?: (cardId: string) => void;
  isPending: boolean;
  position: number;
  total: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group', isDragging && 'opacity-40')}
    >
      <div className="relative">
        {/*
          Drag handle. Keyboard users do not need it: the move controls below operate
          without a pointer, and the handle is hidden from the accessibility tree so it is
          not announced as an unusable control.
        */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-hidden
          tabIndex={-1}
          className="absolute end-1.5 top-1.5 z-[1] rounded p-1 text-faint opacity-0 transition-opacity hover:text-muted focus-visible:opacity-100 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>

        <div
          className={cn(
            'rounded-lg border bg-surface p-2.5 shadow-xs transition-shadow',
            card.attention === 'danger' ? 'border-danger/35' : card.attention === 'warning' ? 'border-warning/40' : 'border-border-subtle',
            onCardClick && 'cursor-pointer hover:border-border-strong hover:shadow-sm',
            isPending && 'animate-pulse',
          )}
          onClick={onCardClick ? () => onCardClick(card.id) : undefined}
          onKeyDown={
            onCardClick
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onCardClick(card.id);
                  }
                }
              : undefined
          }
          role={onCardClick ? 'button' : undefined}
          tabIndex={onCardClick ? 0 : undefined}
          aria-label={card.ariaLabel ?? `${card.title}${card.value ? `, ${card.value}` : ''}${card.subtitle ? `, ${card.subtitle}` : ''}`}
        >
          <p className="pe-5 text-xs font-medium leading-snug text-fg">{truncate(card.title, 72)}</p>
          {card.subtitle ? <p className="mt-0.5 text-2xs text-muted">{truncate(card.subtitle, 64)}</p> : null}

          {card.value ? <p className="mt-1.5 text-sm font-semibold tabular-nums tracking-tight text-fg">{card.value}</p> : null}

          {card.meta && card.meta.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {card.meta.map((entry) => (
                <li
                  key={entry.label}
                  className={cn(
                    'rounded border px-1.5 py-px text-[0.625rem]',
                    entry.tone
                      ? cn(toneClass(entry.tone, 'bg'), toneClass(entry.tone, 'fg'), toneClass(entry.tone, 'border'))
                      : 'border-border-subtle bg-inset text-muted',
                  )}
                >
                  {entry.label}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-2">
            {card.avatar ?? <span />}
            {card.attention ? (
              <span className={cn('text-[0.625rem] font-medium', card.attention === 'danger' ? 'text-danger-fg' : 'text-warning-fg')}>
                {card.attention === 'danger' ? 'Overdue' : 'Not moving'}
              </span>
            ) : null}
          </div>
        </div>

        {/*
          Non-drag move controls. Always in the DOM, revealed on focus or hover, and
          operable with the keyboard alone. This is the alternative that makes the board
          usable without a pointer, and it calls exactly the same handler as dragging.
        */}
        <div className="mt-1 flex items-center justify-between gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="xs"
            disabled={!previous}
            onClick={(event) => {
              event.stopPropagation();
              if (previous) onMove(card.id, previous.id);
            }}
            leadingIcon={<ChevronLeft className="rtl:rotate-180" />}
            aria-label={previous ? `Move ${card.title} back to ${previous.label}` : 'Already in the first stage'}
            title={previous ? `Move to ${previous.label}` : undefined}
          >
            {previous?.label}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={!next}
            onClick={(event) => {
              event.stopPropagation();
              if (next) onMove(card.id, next.id);
            }}
            trailingIcon={<ChevronRight className="rtl:rotate-180" />}
            aria-label={next ? `Move ${card.title} forward to ${next.label}` : 'Already in the final stage'}
            title={next ? `Move to ${next.label}` : undefined}
          >
            {next?.label}
          </Button>
        </div>

        <span className="sr-only">
          Position {position} of {total} in {column.label}.
        </span>
      </div>
    </li>
  );
}

/** Rendered inside the drag overlay so the lifted card matches the board. */
function CardShell({ card, dragging }: { card: KanbanCard; dragging?: boolean }) {
  return (
    <div className={cn('w-[16rem] rounded-lg border border-border bg-surface p-2.5 shadow-xl', dragging && 'rotate-1 opacity-95')}>
      <p className="text-xs font-medium leading-snug text-fg">{truncate(card.title, 72)}</p>
      {card.subtitle ? <p className="mt-0.5 text-2xs text-muted">{truncate(card.subtitle, 64)}</p> : null}
      {card.value ? <p className="mt-1.5 text-sm font-semibold tabular-nums text-fg">{card.value}</p> : null}
    </div>
  );
}

/**
 * Alternate list-based view of the same pipeline.
 *
 * Offered because a board is the wrong shape for some tasks: comparing valuations across
 * many deals, or working on a phone. The list reuses the same move controls, so the two
 * views stay in step for the same reason the board and its totals do.
 */
export function PipelineList({
  cards,
  columns,
  onMove,
  onCardClick,
  className,
}: {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  onMove: (cardId: string, toColumnId: string) => void;
  onCardClick?: (cardId: string) => void;
  className?: string;
}) {
  return (
    <ul className={cn('divide-y divide-[var(--border-subtle)] rounded-lg border border-border-subtle bg-surface', className)}>
      {cards.map((card) => {
        const column = columns.find((candidate) => candidate.id === card.columnId);
        return (
          <li key={card.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <button
              type="button"
              onClick={onCardClick ? () => onCardClick(card.id) : undefined}
              className={cn('min-w-0 flex-1 text-start', onCardClick && focusRing)}
            >
              <span className="block truncate text-xs font-medium text-fg">{card.title}</span>
              <span className="mt-0.5 block truncate text-2xs text-muted">{card.subtitle}</span>
            </button>
            {column ? (
              <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-2xs', toneClass(column.tone, 'bg'), toneClass(column.tone, 'fg'), toneClass(column.tone, 'border'))}>
                {column.label}
              </span>
            ) : null}
            {card.value ? <span className="w-24 shrink-0 text-end text-xs font-medium tabular-nums text-fg">{card.value}</span> : null}
            <label className="shrink-0">
              <span className="sr-only">Move {card.title} to another stage</span>
              <select
                value={card.columnId}
                onChange={(event) => onMove(card.id, event.target.value)}
                className={cn('h-7 rounded-md border border-border bg-surface px-1.5 text-2xs text-fg', focusRing)}
              >
                {columns.map((option) => (
                  <option key={option.id} value={option.id} disabled={option.acceptDrop === false}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export { MoveRight };
