'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, ListChecks, Sparkles } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { FilterClause, FilterGroup, Playbook, PlaybookStep } from '@crm/shared-types';
import type { Tone } from '@crm/ui';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  DemoNotice,
  InlineBar,
  MiniStat,
  Pagination,
  Select,
  TonePill,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordEmptyState, formatDate, formatNumber, type FilterChip } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Playbook screens.
 *
 * A playbook is guidance a person works through, plus a small number of steps that can be
 * turned into real tasks. This module keeps those two things visibly separate: the list shows
 * how many steps create a task, and the detail screen says in plain words that applying a
 * playbook writes task records to the local demo store and nothing else. The word "apply" is
 * used rather than "run" for the same reason — nothing is executed on a server here.
 */

const PURPOSE_LABEL: Record<Playbook['purpose'], string> = {
  qualification: 'Qualification',
  discovery: 'Discovery',
  objection_handling: 'Objection handling',
  onboarding: 'Onboarding',
  renewal: 'Renewal',
  win_back: 'Win-back',
  escalation: 'Escalation',
  custom: 'Custom',
};

const PURPOSE_TONE: Record<Playbook['purpose'], Tone> = {
  qualification: 'blue',
  discovery: 'violet',
  objection_handling: 'amber',
  onboarding: 'teal',
  renewal: 'green',
  win_back: 'slate',
  escalation: 'red',
  custom: 'neutral',
};

const PURPOSES = Object.keys(PURPOSE_LABEL) as Playbook['purpose'][];

type ActiveFilter = 'all' | 'active' | 'inactive';

function buildFilter(purpose: 'all' | Playbook['purpose'], state: ActiveFilter): FilterGroup | undefined {
  const clauses: FilterClause[] = [];
  if (purpose !== 'all') clauses.push({ field: 'purpose', operator: 'eq', value: purpose });
  if (state !== 'all') clauses.push({ field: 'isActive', operator: 'eq', value: state === 'active' });
  return clauses.length > 0 ? { id: 'playbook-filter', conjunction: 'and', clauses } : undefined;
}

function tasksPerPlaybook(playbook: Playbook): number {
  return playbook.steps.filter((step) => step.createsTask).length;
}

/* -------------------------------------------------------------------- list */

export function PlaybookList() {
  const services = useServices();
  const navigate = useNavigate();

  const [search, setSearch] = React.useState('');
  const [purpose, setPurpose] = React.useState<'all' | Playbook['purpose']>('all');
  const [state, setState] = React.useState<ActiveFilter>('all');
  const [page, setPage] = React.useState(1);

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 25,
      q: search || undefined,
      filter: buildFilter(purpose, state),
      sort: [{ field: 'name', direction: 'asc' as const }],
    }),
    [page, search, purpose, state],
  );

  const playbooks = useList(() => services.playbooks.list(query as never), [JSON.stringify(query)]);

  const columns = React.useMemo<ColumnDef<Playbook, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Playbook',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={`/app/customer-success/playbooks/${row.original.id}`}
              onClick={(event) => event.stopPropagation()}
              className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
            >
              {row.original.name}
            </Link>
            <span className="mt-0.5 block max-w-md truncate text-[0.6875rem] text-faint">{row.original.description}</span>
          </div>
        ),
      },
      {
        id: 'purpose',
        header: 'Purpose',
        accessorKey: 'purpose',
        cell: ({ row }) => (
          <TonePill tone={PURPOSE_TONE[row.original.purpose]} dot={false}>
            {PURPOSE_LABEL[row.original.purpose]}
          </TonePill>
        ),
      },
      {
        id: 'steps',
        header: 'Steps',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted">
            {row.original.steps.length}
            <span className="ms-1 text-faint">({tasksPerPlaybook(row.original)} create a task)</span>
          </span>
        ),
      },
      {
        id: 'used',
        header: 'Times used',
        accessorKey: 'timesUsed',
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.timesUsed)}</span>,
      },
      {
        id: 'completion',
        header: 'Avg completion',
        accessorKey: 'avgCompletionRate',
        cell: ({ row }) => <InlineBar value={row.original.avgCompletionRate} />,
      },
      {
        id: 'state',
        header: 'State',
        accessorKey: 'isActive',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'outline'} size="sm">
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [],
  );

  const items = playbooks.items;
  const totalSteps = items.reduce((sum, playbook) => sum + playbook.steps.length, 0);
  const totalApplications = items.reduce((sum, playbook) => sum + playbook.timesUsed, 0);

  const chips: FilterChip[] = [];
  if (purpose !== 'all') {
    chips.push({ id: 'purpose', label: `Purpose: ${PURPOSE_LABEL[purpose]}`, tone: 'brand', onRemove: () => setPurpose('all') });
  }
  if (state !== 'all') {
    chips.push({ id: 'state', label: state === 'active' ? 'Active only' : 'Inactive only', tone: 'brand', onRemove: () => setState('all') });
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Playbooks"
        description="Reusable guidance for qualification, onboarding, renewal, escalation and win-back, with the steps that can create a task marked explicitly."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customer success', to: '/app/customer-success' }, { label: 'Playbooks' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search playbooks by name or description"
            resultCount={playbooks.meta ? `${playbooks.meta.total.toLocaleString()} playbook(s)` : undefined}
            chips={chips}
            onClearFilters={() => {
              setPurpose('all');
              setState('all');
              setSearch('');
            }}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={purpose}
                  onValueChange={(value) => {
                    setPurpose(value as typeof purpose);
                    setPage(1);
                  }}
                  options={[{ value: 'all', label: 'All purposes' }, ...PURPOSES.map((value) => ({ value, label: PURPOSE_LABEL[value] }))]}
                  selectSize="sm"
                  className="w-[12rem]"
                  aria-label="Filter playbooks by purpose"
                />
                <Select
                  value={state}
                  onValueChange={(value) => {
                    setState(value as ActiveFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'Any state' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                  selectSize="sm"
                  className="w-[9rem]"
                  aria-label="Filter playbooks by state"
                />
              </div>
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Playbooks in view" value={formatNumber(items.length)} tone="violet" />
          <MiniStat label="Active" value={formatNumber(items.filter((playbook) => playbook.isActive).length)} tone="green" />
          <MiniStat label="Steps" value={formatNumber(totalSteps)} tone="blue" />
          <MiniStat label="Applications logged" value={formatNumber(totalApplications)} tone="teal" />
        </div>

        <DemoNotice tone="neutral">
          Playbooks are seeded guidance. Applying one creates local task records so the steps appear in My Work; no email is sent and no workflow engine runs.
        </DemoNotice>

        {playbooks.loading ? (
          <ListSkeleton rows={6} columns={4} />
        ) : items.length === 0 ? (
          <RecordEmptyState
            title="No playbooks match this view"
            body="Adjust the purpose or state filter, or clear the search, to see the seeded playbooks."
            primaryAction={{
              label: 'Clear filters',
              onClick: () => {
                setPurpose('all');
                setState('all');
                setSearch('');
              },
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            getRowId={(row) => row.id}
            onRowClick={(row) => navigate(`/app/customer-success/playbooks/${row.id}`)}
            emptyState={
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-fg">No playbooks are available</p>
                <p className="mt-1 text-xs text-muted">Nothing has been seeded for this tenant.</p>
              </div>
            }
            footer={playbooks.meta ? <Pagination page={playbooks.meta.page} pageSize={playbooks.meta.pageSize} total={playbooks.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function StepRow({ step, isLast }: { step: PlaybookStep; isLast: boolean }) {
  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-raised text-[0.625rem] font-semibold tabular-nums text-muted">
          {step.order}
        </span>
        {isLast ? null : <span className="mt-1 w-px flex-1 bg-border-subtle" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-fg">{step.title}</span>
          {step.required ? (
            <Badge variant="warning" size="sm">
              Required
            </Badge>
          ) : (
            <Badge variant="outline" size="sm">
              Optional
            </Badge>
          )}
          {step.createsTask ? (
            <Badge variant="info" size="sm">
              <CheckCircle2 className="size-2.5" aria-hidden />
              Creates a task
            </Badge>
          ) : (
            <Badge variant="outline" size="sm">
              <Circle className="size-2.5" aria-hidden />
              Guidance only
            </Badge>
          )}
        </div>
        {step.guidance ? <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">{step.guidance}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] text-faint">
          {step.createsTask && typeof step.taskDueOffsetDays === 'number' ? <span>Task due +{step.taskDueOffsetDays} day(s)</span> : null}
          {typeof step.completionCount === 'number' ? <span>Completed {step.completionCount}×</span> : null}
        </div>
        {step.resources && step.resources.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {step.resources.map((resource, index) => (
              <li key={`${step.id}-resource-${index}`}>
                <Badge variant="outline" size="sm">
                  {resource.label}
                  {resource.kind === 'video_placeholder' ? ' (placeholder)' : ''}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export function PlaybookDetail() {
  const services = useServices();
  const { playbookId } = useParams<{ playbookId: string }>();
  const id = playbookId ?? '';

  const playbook = useAsync(() => services.playbooks.get(id), [id], { skip: !id });
  const accounts = useList(() => services.accounts.list({ pageSize: 100, sort: [{ field: 'name', direction: 'asc' }] }), []);
  const [targetId, setTargetId] = React.useState('');

  const apply = useMutation(
    (input: { playbookId: string; accountId: string }) => services.playbooks.apply(input.playbookId, { type: 'account', id: input.accountId }),
    {
      simulated: true,
      successMessage: (result) =>
        `Created ${result.tasksCreated} task(s) in the local demo store. Nothing was emailed, scheduled or sent to a workflow engine.`,
      onSuccess: () => playbook.reload(),
    },
  );

  if (!id) {
    return (
      <div className="p-6">
        <RecordEmptyState title="No playbook was selected" body="Open a playbook from the list to see its steps." />
      </div>
    );
  }

  if (playbook.loading) {
    return (
      <div className="p-6">
        <ListSkeleton rows={8} columns={2} />
      </div>
    );
  }

  if (playbook.error || !playbook.data) {
    return (
      <div className="p-6">
        <RecordEmptyState
          title="This playbook could not be loaded"
          body={playbook.error ?? 'No playbook exists for that id.'}
          primaryAction={{ label: 'Back to playbooks', onClick: () => undefined }}
          secondaryAction={{ label: 'Retry', onClick: playbook.reload }}
        />
      </div>
    );
  }

  const record = playbook.data;
  const steps = [...record.steps].sort((a, b) => a.order - b.order);
  const taskSteps = steps.filter((step) => step.createsTask).length;
  const accountOptions = accounts.items.map((account) => ({ value: account.id, label: account.name }));

  return (
    <div className="pb-10">
      <PageHeader
        title={record.name}
        description={record.description}
        backTo={{ to: '/app/customer-success/playbooks', label: 'Playbooks' }}
        actions={
          <Badge variant={record.isActive ? 'success' : 'outline'} size="sm">
            {record.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-4 py-1.5 sm:px-6">
            <TonePill tone={PURPOSE_TONE[record.purpose]} dot={false}>
              {PURPOSE_LABEL[record.purpose]}
            </TonePill>
            <span className="text-[0.6875rem] text-subtle">
              {steps.length} step(s) · {taskSteps} create a task · updated {formatDate(record.updatedAt, 'relative')}
            </span>
          </div>
        }
      />

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ListChecks className="size-3.5 text-subtle" aria-hidden />
            <CardTitle>Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="mt-1">
              {steps.map((step, index) => (
                <StepRow key={step.id} step={step} isLast={index === steps.length - 1} />
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Sparkles className="size-3.5 text-subtle" aria-hidden />
              <CardTitle>Apply this playbook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DemoNotice tone="neutral">
                Applying creates one local task per step marked “creates a task”, so they appear in My Work. Nothing is emailed or scheduled, and no
                server is involved.
              </DemoNotice>

              {taskSteps === 0 ? (
                <p className="text-xs text-muted">Every step in this playbook is guidance only, so applying it creates no tasks.</p>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="playbook-target" className="block text-xs font-medium text-fg">
                  Apply to account
                </label>
                <Select
                  id="playbook-target"
                  value={targetId}
                  onValueChange={setTargetId}
                  options={accountOptions}
                  placeholder={accounts.loading ? 'Loading accounts…' : 'Choose an account'}
                  disabled={accounts.loading || accountOptions.length === 0}
                  selectSize="sm"
                  searchable
                />
                {accounts.loading ? null : accountOptions.length === 0 ? (
                  <p className="text-[0.6875rem] text-faint">No accounts are available to apply this playbook to.</p>
                ) : null}
              </div>

              <Button
                variant="primary"
                size="sm"
                loading={apply.pending}
                disabled={!targetId || taskSteps === 0}
                onClick={() => void apply.run({ playbookId: record.id, accountId: targetId })}
              >
                Apply playbook
              </Button>
              {apply.error ? <Alert tone="danger" title="The playbook could not be applied">{apply.error}</Alert> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <dl className="space-y-1.5 text-[0.6875rem]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">Times used</dt>
                  <dd className="tabular-nums text-fg">{formatNumber(record.timesUsed)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">Average completion</dt>
                  <dd className="tabular-nums text-muted">{record.avgCompletionRate}%</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">Owner teams</dt>
                  <dd className="tabular-nums text-muted">{record.ownerTeamIds.length}</dd>
                </div>
              </dl>
              <div className="pt-1">
                <InlineBar value={record.avgCompletionRate} />
              </div>
              <p className="text-[0.6875rem] leading-relaxed text-faint">
                “Times used” increases locally when a playbook is applied here. It is a demonstration counter, not a server-side audit.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
