import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { CircleAlert, MousePointerClick, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import type {
  CaptureForm,
  EmailTemplate,
  Journey,
  LandingPage,
  LeadSource,
  Segment,
  SegmentRule,
} from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  DemoNotice,
  Field,
  InlineBar,
  Input,
  MiniStat,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
  TonePill,
  cn,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Marketing screens.
 *
 * These screens compose the rest of the marketing module: audiences, journeys, templates,
 * forms, landing pages and attribution. The same two rules apply throughout:
 *
 *   1. **Nothing is transmitted.** Forms record submissions locally, landing pages are
 *      `demo_not_hosted`, and every send control is labelled simulated.
 *   2. **Derived numbers say they are derived.** Member counts, journey statistics and
 *      attribution rows come from the shared synthetic dataset and are labelled as such.
 */

/* ---------------------------------------------------------------- segments */

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: 'is greater than',
  less_than: 'is less than',
  between: 'is between',
  in_list: 'is one of',
  not_in_list: 'is not one of',
  is_set: 'is set',
  is_not_set: 'is not set',
  has_activity_in_last: 'has activity in the last',
  has_no_activity_in_last: 'has no activity in the last',
  is_in_segment: 'is in segment',
  is_not_in_segment: 'is not in segment',
};

function describeValue(rule: SegmentRule): string {
  const value = rule.value;
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    if ('days' in value) return `${value.days} days`;
    const from = 'from' in value && value.from ? value.from : '…';
    const to = 'to' in value && value.to ? value.to : '…';
    return `${from} – ${to}`;
  }
  return String(value);
}

function RuleTree({ rule, depth = 0 }: { rule: SegmentRule; depth?: number }) {
  return (
    <li className={cn('space-y-1', depth > 0 && 'border-s border-border-subtle ps-3')}>
      <p className="text-xs text-fg">
        <span className="font-medium">{rule.label || rule.field}</span>{' '}
        <span className="text-muted">{OPERATOR_LABELS[rule.operator] ?? rule.operator}</span>
        {describeValue(rule) ? <span className="text-muted"> {describeValue(rule)}</span> : null}
      </p>
      {rule.nested ? (
        <ul className="space-y-1">
          {rule.nested.rules.map((child) => (
            <RuleTree key={child.id} rule={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SegmentsScreen() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);

  const query = React.useMemo(() => ({ page, pageSize: 25, q: search || undefined }), [page, search]);
  const segments = useList(() => services.segments.list(query), [JSON.stringify(query)]);

  const activeId = selectedId ?? segments.items[0]?.id;
  const selected = React.useMemo(() => segments.items.find((item) => item.id === activeId), [segments.items, activeId]);
  const members = useList(() => services.segments.members(activeId ?? '', { pageSize: 12 }), [activeId], { skip: !activeId });

  const columns = React.useMemo<ColumnDef<Segment, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Segment',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] capitalize text-faint">
              {row.original.kind} · {row.original.entityType} · {row.original.refreshCadence}
            </span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'members',
        header: 'Members',
        accessorFn: (segment) => segment.memberCount,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-fg">{formatNumber(row.original.memberCount)}</span>,
      },
      {
        id: 'refreshed',
        header: 'Last refreshed',
        accessorKey: 'lastRefreshedAt',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.lastRefreshedAt, 'relative')}</span>,
      },
      {
        id: 'used',
        header: 'Used in',
        accessorFn: (segment) => segment.usedInCampaignIds.length,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-[0.6875rem] tabular-nums text-muted">{row.original.usedInCampaignIds.length} campaigns</span>,
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Segments"
        description="Reusable audiences with nested AND/OR rules, a live member preview and an explicit refresh cadence."
        breadcrumbs={[{ to: '/app/campaigns', label: 'Campaigns' }, { label: 'Segments' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search segments"
            onClearFilters={() => setSearch('')}
            resultCount={segments.meta ? `${segments.meta.total} segments` : undefined}
          />
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.6fr_1fr]">
        {segments.loading ? (
          <ListSkeleton rows={10} columns={5} />
        ) : (
          <DataTable
            columns={columns}
            data={segments.items}
            onRowClick={(segment) => setSelectedId(segment.id)}
            footer={segments.meta ? <Pagination page={segments.meta.page} pageSize={segments.meta.pageSize} total={segments.meta.total} onPageChange={setPage} /> : null}
          />
        )}

        <div className="space-y-4">
          {selected ? (
            <>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{selected.name}</h2>
                    <p className="mt-0.5 text-xs text-muted">{selected.description ?? 'No description.'}</p>
                  </div>
                  <StatusBadge status={selected.status} size="sm" />
                </div>

                <h3 className="mt-4 text-2xs font-semibold uppercase tracking-wide text-muted">Rules ({selected.definition.conjunction})</h3>
                <ul className="mt-2 space-y-1">
                  {selected.definition.rules.map((rule) => (
                    <RuleTree key={rule.id} rule={rule} />
                  ))}
                </ul>

                {selected.preview ? (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted">Preview</h3>
                    <p className="text-xs text-muted">
                      <span className="font-medium text-fg">{formatNumber(selected.preview.total)}</span> matching records (synthetic).
                    </p>
                    <div className="space-y-2">
                      {selected.preview.byLifecycleStage.slice(0, 4).map((row) => (
                        <div key={row.label} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-2">
                          <span className="truncate text-[0.6875rem] text-muted">{row.label}</span>
                          <InlineBar value={row.count} max={Math.max(selected.preview?.total ?? 1, 1)} tone={row.tone} />
                          <span className="text-end text-[0.6875rem] tabular-nums text-faint">{formatNumber(row.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-border-subtle px-4 py-3">
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Members</h2>
                </div>
                {members.loading ? (
                  <div className="p-4">
                    <ListSkeleton rows={5} columns={1} />
                  </div>
                ) : members.items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted">No members are currently included.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {members.items.map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <div className="min-w-0">
                          <span className="block truncate text-xs text-fg">{member.label}</span>
                          {member.subtitle ? <span className="block truncate text-[0.6875rem] text-faint">{member.subtitle}</span> : null}
                        </div>
                        {member.contactId ? (
                          <Link to={`/app/contacts/${member.contactId}`} className="text-[0.6875rem] text-link hover:underline">
                            Open
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {members.meta ? (
                  <div className="border-t border-border-subtle px-4 py-2 text-[0.6875rem] text-faint">
                    Showing {members.items.length} of {formatNumber(members.meta.total)}
                  </div>
                ) : null}
              </Card>
            </>
          ) : (
            <Card className="p-10 text-center text-xs text-muted">Select a segment to see its rules and members.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- journeys */

export function JourneysScreen() {
  const services = useServices();
  const [page, setPage] = React.useState(1);
  const query = React.useMemo(() => ({ page, pageSize: 20 }), [page]);
  const journeys = useList(() => services.journeys.list(query), [JSON.stringify(query)]);

  const columns = React.useMemo<ColumnDef<Journey, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Journey',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/campaigns/journeys/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.name}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] capitalize text-faint">
              {row.original.nodes.length} nodes · entry: {row.original.entryType.replace(/_/g, ' ')}
            </span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'entered',
        header: 'Entered',
        accessorFn: (journey) => journey.stats.entered,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.stats.entered)}</span>,
      },
      {
        id: 'conversion',
        header: 'Goal rate',
        accessorFn: (journey) => journey.stats.conversionRate,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{row.original.stats.conversionRate}%</span>,
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Journeys"
        description="Multi-step automations over a segment or form entry, with validation before activation and a deterministic enrolment forecast."
        breadcrumbs={[{ to: '/app/campaigns', label: 'Campaigns' }, { label: 'Journeys' }]}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="info">
          A journey in this build validates and simulates. Activating one changes local status only — no email, SMS or
          WhatsApp message is ever dispatched to a recipient.
        </DemoNotice>
        {journeys.loading ? (
          <ListSkeleton rows={8} columns={4} />
        ) : (
          <DataTable
            columns={columns}
            data={journeys.items}
            footer={journeys.meta ? <Pagination page={journeys.meta.page} pageSize={journeys.meta.pageSize} total={journeys.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

export function JourneyDetail() {
  const services = useServices();
  const { journeyId } = useParams<{ journeyId: string }>();
  const journey = useAsync(() => services.journeys.get(journeyId ?? ''), [journeyId], { skip: !journeyId });
  const record = journey.data;

  const [simulation, setSimulation] = React.useState<{ entered: number; durationDays: number; byNode: Array<{ nodeId: string; reached: number; converted: number }> } | undefined>();
  const [issues, setIssues] = React.useState<Array<{ nodeId?: string; severity: 'error' | 'warning'; message: string }> | undefined>();

  const validate = useMutation(() => services.journeys.validate(journeyId ?? ''), {
    simulated: true,
    successMessage: 'Validation complete.',
    onSuccess: (result) => setIssues(result?.issues ?? []),
  });

  const simulate = useMutation(
    () => services.journeys.simulate(journeyId ?? '', record?.entrySegmentId ?? ''),
    { simulated: true, successMessage: 'Forecast simulated.', onSuccess: (result) => setSimulation(result ?? undefined) },
  );

  if (journey.loading) return <ListSkeleton rows={10} columns={2} />;
  if (journey.error || !record) {
    return (
      <div className="p-6">
        <Card className="p-10 text-center text-xs text-muted">
          This journey could not be found.{' '}
          <Link to="/app/campaigns/journeys" className="text-link hover:underline">
            Back to journeys
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/campaigns/journeys', label: 'Journeys' }}
          title={record.name}
          subtitle={record.description}
          badges={<StatusBadge status={record.status} />}
          facts={[
            { label: 'Entry', value: record.entryType.replace(/_/g, ' ') },
            { label: 'Re-entry', value: record.reEntryRule.replace(/_/g, ' ') },
            { label: 'Nodes', value: String(record.nodes.length) },
            { label: 'Entered', value: formatNumber(record.stats.entered) },
            { label: 'Completed', value: formatNumber(record.stats.completed) },
          ]}
          actions={
            <>
              <Button variant="secondary" size="sm" loading={validate.pending} onClick={() => void validate.run(undefined)} leadingIcon={<ShieldCheck className="size-3.5" />}>
                Validate
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={simulate.pending}
                disabled={!record.entrySegmentId}
                onClick={() => void simulate.run(undefined)}
                leadingIcon={<Sparkles className="size-3.5" />}
              >
                Simulate entry
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {issues ? (
          issues.length === 0 ? (
            <Alert tone="success" title="Validation passed">
              No reachability or configuration problems were found.
            </Alert>
          ) : (
            <Alert tone={issues.some((issue) => issue.severity === 'error') ? 'danger' : 'warning'} title={`${issues.length} issue(s) found`}>
              <ul className="list-disc space-y-1 ps-4">
                {issues.map((issue, index) => (
                  <li key={`${issue.nodeId ?? 'journey'}-${index}`}>
                    <span className="font-medium">{issue.severity}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )
        ) : null}

        {simulation ? (
          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Simulated forecast</h2>
            <p className="mt-1 text-xs text-muted">
              {formatNumber(simulation.entered)} records would enter, completing in about {simulation.durationDays} days. This is a
              deterministic estimate, not a live enrolment.
            </p>
          </Card>
        ) : null}

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Steps</h2>
          <ol className="mt-3 space-y-2">
            {record.nodes.map((node, index) => (
              <li key={node.id} className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface p-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-inset text-[0.6875rem] font-medium text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-medium text-fg">{node.label}</p>
                    <Badge variant="outline" size="sm">
                      {node.kind.replace(/_/g, ' ')}
                    </Badge>
                    {node.isEntry ? <TonePill tone="violet">Entry</TonePill> : null}
                    {node.isTerminal ? <TonePill tone="slate">Terminal</TonePill> : null}
                  </div>
                  {node.description ? <p className="mt-1 text-[0.6875rem] text-muted">{node.description}</p> : null}
                  {node.stats ? (
                    <p className="mt-1 text-[0.625rem] text-faint">
                      Entered {formatNumber(node.stats.entered)} · completed {formatNumber(node.stats.completed)} · branched {formatNumber(node.stats.branched)} ·
                      failed {formatNumber(node.stats.failed)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- email templates */

export function EmailTemplatesScreen() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const query = React.useMemo(() => ({ page, pageSize: 20, q: search || undefined }), [page, search]);
  const templates = useList(() => services.emailTemplates.list(query), [JSON.stringify(query)]);

  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const activeId = selectedId ?? templates.items[0]?.id;
  const selected = templates.items.find((item) => item.id === activeId);
  const preview = useAsync(() => services.emailTemplates.renderPreview(activeId ?? ''), [activeId], { skip: !activeId });

  const [blockOverrides, setBlockOverrides] = React.useState<Record<string, boolean>>({});
  const blocks = React.useMemo(
    () => (selected?.blocks ?? []).map((block) => ({ ...block, visible: blockOverrides[block.id] ?? block.visible })),
    [selected, blockOverrides],
  );

  const toggleBlock = useMutation(
    (input: { id: string; visible: boolean }) =>
      services.emailTemplates.update(
        activeId ?? '',
        { blocks: (selected?.blocks ?? []).map((block) => (block.id === input.id ? { ...block, visible: input.visible } : block)) } as never,
      ),
    {
      successMessage: 'Template updated.',
      onSuccess: (_updated, input) => setBlockOverrides((prev) => ({ ...prev, [input.id]: input.visible })),
    },
  );

  const columns = React.useMemo<ColumnDef<EmailTemplate, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Template',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.subject}</span>
          </div>
        ),
      },
      { id: 'category', header: 'Category', accessorKey: 'category', cell: ({ row }) => <span className="text-[0.6875rem] capitalize text-muted">{row.original.category}</span> },
      {
        id: 'blocks',
        header: 'Blocks',
        accessorFn: (template) => template.blocks.length,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-[0.6875rem] tabular-nums text-muted">{row.original.blocks.length}</span>,
      },
      {
        id: 'used',
        header: 'Used in',
        accessorFn: (template) => template.usedInCampaignCount,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-[0.6875rem] tabular-nums text-muted">{row.original.usedInCampaignCount} campaigns</span>,
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Email templates"
        description="Block-based templates rendered to preview HTML locally. Rendering is a demonstration — nothing is delivered."
        breadcrumbs={[{ to: '/app/campaigns', label: 'Campaigns' }, { label: 'Templates' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search templates"
            onClearFilters={() => setSearch('')}
            resultCount={templates.meta ? `${templates.meta.total} templates` : undefined}
          />
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
        {templates.loading ? (
          <ListSkeleton rows={10} columns={4} />
        ) : (
          <DataTable
            columns={columns}
            data={templates.items}
            onRowClick={(template) => setSelectedId(template.id)}
            footer={templates.meta ? <Pagination page={templates.meta.page} pageSize={templates.meta.pageSize} total={templates.meta.total} onPageChange={setPage} /> : null}
          />
        )}

        {selected ? (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{selected.name}</h2>
                <p className="mt-0.5 truncate text-xs text-muted">{selected.subject}</p>
              </div>
              <Badge variant="outline" size="sm">
                {selected.renderMode.replace(/_/g, ' ')}
              </Badge>
            </div>

            <h3 className="mt-4 text-2xs font-semibold uppercase tracking-wide text-muted">Blocks</h3>
            <ul className="mt-2 space-y-2">
              {(blocks ?? []).map((block) => (
                <li key={block.id} className="rounded-md border border-border-subtle bg-surface p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs text-fg">
                      <Mail className="size-3.5 text-faint" aria-hidden />
                      {block.type.replace(/_/g, ' ')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleBlock.run({ id: block.id, visible: !block.visible })}
                      aria-pressed={block.visible}
                    >
                      {block.visible ? 'Visible' : 'Hidden'}
                    </Button>
                  </div>
                  {typeof block.content.text === 'string' ? <p className="mt-1 text-[0.6875rem] text-muted">{block.content.text}</p> : null}
                </li>
              ))}
            </ul>

            <h3 className="mt-4 text-2xs font-semibold uppercase tracking-wide text-muted">Preview</h3>
            {preview.loading ? (
              <ListSkeleton rows={4} columns={1} />
            ) : preview.data ? (
              <div className="mt-2 space-y-2">
                <pre className="max-h-48 overflow-auto rounded-md border border-border-subtle bg-inset p-2 text-[0.625rem] leading-relaxed text-muted">
                  {preview.data.plainText}
                </pre>
                {preview.data.warnings.length > 0 ? (
                  <ul className="space-y-1">
                    {preview.data.warnings.map((warning) => (
                      <li key={warning} className="flex items-start gap-1.5 text-[0.6875rem] text-warning-fg">
                        <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">No preview available.</p>
            )}

            <div className="mt-4">
              <DemoNotice tone="neutral">
                Preview HTML is generated in the browser from local blocks. No email is sent, and no provider is
                connected to this build.
              </DemoNotice>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ landing pages */

export function LandingPagesScreen() {
  const services = useServices();
  const [page, setPage] = React.useState(1);
  const query = React.useMemo(() => ({ page, pageSize: 20 }), [page]);
  const pages = useList(() => services.landingPages.list(query), [JSON.stringify(query)]);

  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const activeId = selectedId ?? pages.items[0]?.id;
  const selected = pages.items.find((item) => item.id === activeId);

  const publish = useMutation(() => services.landingPages.publish(activeId ?? ''), {
    simulated: true,
    successMessage: 'Page marked published locally (not hosted).',
    onSuccess: () => pages.reload(),
  });

  const columns = React.useMemo<ColumnDef<LandingPage, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Page',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-faint">/{row.original.slug}</span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'views',
        header: 'Views',
        accessorFn: (page) => page.views,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-[0.6875rem] tabular-nums text-muted">{formatNumber(row.original.views)}</span>,
      },
      {
        id: 'conversion',
        header: 'Conversion',
        accessorFn: (page) => page.conversionRate,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-fg">{row.original.conversionRate}%</span>,
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Landing pages"
        description="Section-based pages you can compose and preview. Publishing records a static representation — there is no hosting."
        breadcrumbs={[{ to: '/app/campaigns', label: 'Campaigns' }, { label: 'Landing pages' }]}
      />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
        {pages.loading ? (
          <ListSkeleton rows={8} columns={4} />
        ) : (
          <DataTable
            columns={columns}
            data={pages.items}
            onRowClick={(page) => setSelectedId(page.id)}
            footer={pages.meta ? <Pagination page={pages.meta.page} pageSize={pages.meta.pageSize} total={pages.meta.total} onPageChange={setPage} /> : null}
          />
        )}

        {selected ? (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{selected.name}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {selected.sections.length} sections · {selected.theme.layout.replace(/_/g, ' ')} layout
                </p>
              </div>
              <StatusBadge status={selected.status} size="sm" />
            </div>

            <ol className="mt-3 space-y-2">
              {selected.sections
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((section) => (
                  <li key={section.id} className="rounded-md border border-border-subtle bg-surface p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" size="sm">
                        {section.type.replace(/_/g, ' ')}
                      </Badge>
                      {section.visible ? null : <span className="text-[0.625rem] text-faint">hidden</span>}
                    </div>
                    {section.heading ? <p className="mt-1 text-xs font-medium text-fg">{section.heading}</p> : null}
                    {section.body ? <p className="mt-0.5 text-[0.6875rem] text-muted">{section.body}</p> : null}
                  </li>
                ))}
            </ol>

            <div className="mt-4 flex items-center gap-2">
              <Button variant="primary" size="sm" loading={publish.pending} onClick={() => void publish.run(undefined)}>
                Publish locally
              </Button>
              <Badge variant="outline" size="sm">
                {selected.hostingState.replace(/_/g, ' ')}
              </Badge>
            </div>

            <div className="mt-3">
              <DemoNotice tone="warning">
                Published pages are stored as a static representation inside this browser. They are not hosted, and no
                public URL exists.
              </DemoNotice>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- forms */

export function FormsScreen() {
  const services = useServices();
  const [page, setPage] = React.useState(1);
  const query = React.useMemo(() => ({ page, pageSize: 20 }), [page]);
  const forms = useList(() => services.forms.list(query), [JSON.stringify(query)]);

  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const activeId = selectedId ?? forms.items[0]?.id;
  const selected = forms.items.find((item) => item.id === activeId);

  const [submission, setSubmission] = React.useState<{ submissionId: string; actionTaken: string } | undefined>();

  const submit = useMutation(
    (values: Record<string, unknown>) => services.forms.submit(activeId ?? '', values),
    {
      simulated: true,
      successMessage: 'Submission recorded locally.',
      onSuccess: (result) => setSubmission(result ?? undefined),
    },
  );

  const columns = React.useMemo<ColumnDef<CaptureForm, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Form',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] capitalize text-faint">
              {row.original.submitAction.kind.replace(/_/g, ' ')} · {row.original.integrationState.replace(/_/g, ' ')}
            </span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'submissions',
        header: 'Submissions',
        accessorFn: (form) => form.submissions,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-[0.6875rem] tabular-nums text-muted">{formatNumber(row.original.submissions)}</span>,
      },
      {
        id: 'conversion',
        header: 'Conversion',
        accessorFn: (form) => form.conversionRate,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-fg">{row.original.conversionRate}%</span>,
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Forms"
        description="Capture forms with explicit consent. In this build a submission is recorded locally and nothing is transmitted."
        breadcrumbs={[{ to: '/app/campaigns', label: 'Campaigns' }, { label: 'Forms' }]}
      />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
        {forms.loading ? (
          <ListSkeleton rows={8} columns={4} />
        ) : (
          <DataTable
            columns={columns}
            data={forms.items}
            onRowClick={(form) => {
              setSelectedId(form.id);
              setSubmission(undefined);
            }}
            footer={forms.meta ? <Pagination page={forms.meta.page} pageSize={forms.meta.pageSize} total={forms.meta.total} onPageChange={setPage} /> : null}
          />
        )}

        {selected ? (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{selected.name}</h2>
              <StatusBadge status={selected.status} size="sm" />
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const values: Record<string, unknown> = {};
                for (const field of selected.fields) {
                  values[field.key] = data.get(field.key);
                }
                void submit.run(values);
              }}
            >
              {selected.fields
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => (
                  <Field key={field.id} label={field.label} htmlFor={`form-${field.id}`} required={field.required} hint={field.helpText}>
                    {field.type === 'textarea' ? (
                      <Textarea id={`form-${field.id}`} name={field.key} rows={3} placeholder={field.placeholder} />
                    ) : field.type === 'select' ? (
                      <Select
                        id={`form-${field.id}`}
                        name={field.key}
                        value=""
                        onValueChange={() => undefined}
                        options={[{ value: '', label: 'Choose…' }, ...(field.options ?? []).map((option) => ({ value: option.value, label: option.label }))]}
                      />
                    ) : (
                      <Input
                        id={`form-${field.id}`}
                        name={field.key}
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                        placeholder={field.placeholder}
                      />
                    )}
                  </Field>
                ))}

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" type="submit" loading={submit.pending} leadingIcon={<MousePointerClick className="size-3.5" />}>
                  Record a test submission
                </Button>
                {submit.error ? <span className="text-[0.6875rem] text-danger-fg">{submit.error}</span> : null}
              </div>
            </form>

            {submission ? (
              <div className="mt-3">
                <Alert tone="success" title="Recorded locally, not transmitted">
                  Submission <span className="font-mono">{submission.submissionId}</span>. The configured action
                  “{submission.actionTaken}” was described but not performed against a backend.
                </Alert>
              </div>
            ) : null}

            <div className="mt-3">
              <DemoNotice tone="warning">
                This form is connected to nothing. In a real deployment the submit action would create the configured
                record and fire the follow-up automation.
              </DemoNotice>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ lead sources */

export function LeadSourcesScreen() {
  const services = useServices();
  const [page, setPage] = React.useState(1);
  const query = React.useMemo(() => ({ page, pageSize: 25, sort: [{ field: 'leadCount', direction: 'desc' as const }] }), [page]);
  const sources = useList(() => services.leadSources.list(query), [JSON.stringify(query)]);

  const totalLeads = React.useMemo(() => sources.items.reduce((sum, source) => sum + source.leadCount, 0), [sources.items]);

  const columns = React.useMemo<ColumnDef<LeadSource, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Source',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.channel ?? row.original.kind.replace(/_/g, ' ')}</span>
          </div>
        ),
      },
      { id: 'kind', header: 'Kind', accessorKey: 'kind', cell: ({ row }) => <span className="text-[0.6875rem] capitalize text-muted">{row.original.kind.replace(/_/g, ' ')}</span> },
      { id: 'active', header: 'State', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'active' : 'inactive'} size="sm" /> },
      {
        id: 'leads',
        header: 'Leads',
        accessorFn: (source) => source.leadCount,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-fg">{formatNumber(row.original.leadCount)}</span>,
      },
      {
        id: 'conversion',
        header: 'Conversion',
        accessorFn: (source) => source.conversionRate,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.conversionRate}%</span>,
      },
      {
        id: 'cost',
        header: 'Cost / lead',
        accessorFn: (source) => source.costPerLead?.amount ?? 0,
        meta: { align: 'end' },
        cell: ({ row }) =>
          row.original.costPerLead ? (
            <span className="text-[0.6875rem] tabular-nums text-muted">{formatMoney(row.original.costPerLead.amount, row.original.costPerLead.currency)}</span>
          ) : (
            <span className="text-[0.6875rem] text-faint">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Lead sources"
        description="Where leads come from, with illustrative cost and conversion. Cost figures are synthetic demonstration values."
        breadcrumbs={[{ to: '/app/leads', label: 'Leads' }, { label: 'Sources' }]}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniStat label="Sources" value={formatNumber(sources.meta?.total ?? sources.items.length)} />
          <MiniStat label="Leads (page)" value={formatNumber(totalLeads)} tone="violet" />
          <MiniStat
            label="Best conversion"
            value={`${Math.max(0, ...sources.items.map((source) => source.conversionRate))}%`}
            tone="teal"
          />
        </div>

        <DemoNotice tone="neutral">
          Attribution here is a presentation of the demonstration dataset. Cost per lead is illustrative and is not a
          real advertising cost.
        </DemoNotice>

        {sources.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={sources.items}
            footer={sources.meta ? <Pagination page={sources.meta.page} pageSize={sources.meta.pageSize} total={sources.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}
