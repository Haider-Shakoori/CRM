'use client';

import * as React from 'react';
import { AlertTriangle, Database, Download, HardDriveDownload, Plus, RotateCcw, Upload } from 'lucide-react';
import type { DuplicateCandidate, ExportRequest } from '@crm/shared-types';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  Input,
  Progress,
  Select,
  Slider,
  StatusBadge,
  Switch,
  TableWrap,
  Td,
  Textarea,
  Th,
  TonePill,
  Tr,
  notify,
} from '@crm/ui';
import { ListSkeleton, PageHeader, RecordErrorState, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';
import { SettingsPageNav, useActiveOrganization } from './SettingsScreens';

/**
 * Data management.
 *
 * The screen is organised around one question a reviewer should be able to answer: *where does
 * each control actually write?* Three answers are possible, and each section states which one
 * applies:
 *
 *   1. **The mock store** — an import that runs, a duplicate merge, a retention policy, a reset.
 *      These are real local writes.
 *   2. **This browser’s settings namespace** (`crm.demo.`) — the duplicate match rules, which have
 *      no service method because the contract does not define one.
 *   3. **Nowhere** — backup and restore, because no backup service exists. The status is
 *      `not_connected` and the request form says so before it is submitted.
 *
 * The demonstration importer never reads a file. Headers are typed by the reviewer, row counts are
 * typed by the reviewer, and the records it creates are composed from the file name and row number
 * with explicit notes on each record saying so.
 */

const IMPORT_RESOURCE_FIELDS: Record<string, Array<{ value: string; label: string }>> = {
  contacts: [
    { value: '', label: 'Do not import' },
    { value: 'firstName', label: 'First name' },
    { value: 'lastName', label: 'Last name (required)' },
    { value: 'email', label: 'Work email' },
    { value: 'phone', label: 'Phone' },
    { value: 'jobTitle', label: 'Job title' },
    { value: 'accountName', label: 'Account name' },
  ],
  leads: [
    { value: '', label: 'Do not import' },
    { value: 'companyName', label: 'Company name (required)' },
    { value: 'firstName', label: 'First name' },
    { value: 'lastName', label: 'Last name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'jobTitle', label: 'Job title' },
  ],
  accounts: [
    { value: '', label: 'Do not import' },
    { value: 'name', label: 'Account name (required)' },
    { value: 'website', label: 'Website' },
    { value: 'industry', label: 'Industry' },
    { value: 'phone', label: 'Phone' },
  ],
};

const RESOURCE_OPTIONS = [
  { value: 'contacts', label: 'Contacts' },
  { value: 'leads', label: 'Leads' },
  { value: 'accounts', label: 'Accounts' },
];

const DEFAULT_HEADERS: Record<string, string> = {
  contacts: 'First name,Last name,Email,Phone,Company',
  leads: 'Company,First name,Last name,Email',
  accounts: 'Account name,Website,Industry,Phone',
};

const EXPORT_RESOURCES = ['Contacts', 'Leads', 'Accounts', 'Deals', 'Tickets'];

/* -------------------------------------------------------- local match rules */

interface DuplicateRules {
  matchEmail: boolean;
  matchPhone: boolean;
  matchName: boolean;
  matchDomain: boolean;
  threshold: number;
}

const DEFAULT_RULES: DuplicateRules = { matchEmail: true, matchPhone: false, matchName: true, matchDomain: false, threshold: 80 };
const RULES_KEY = 'crm.demo.duplicate-rules';

function readRules(): DuplicateRules {
  if (typeof localStorage === 'undefined') return DEFAULT_RULES;
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? { ...DEFAULT_RULES, ...(JSON.parse(raw) as Partial<DuplicateRules>) } : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

function writeRules(rules: DuplicateRules): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  } catch {
    /* storage unavailable: the values stay in component state for this session */
  }
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------- screen */

export function DataScreen() {
  const services = useServices();
  const active = useActiveOrganization();

  const [importsKey, setImportsKey] = React.useState(0);
  const [exportKey, setExportKey] = React.useState(0);
  const [candidatesKey, setCandidatesKey] = React.useState(0);
  const [backupKey, setBackupKey] = React.useState(0);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const [restoreScope, setRestoreScope] = React.useState('Full dataset');
  const [restoreReason, setRestoreReason] = React.useState('');
  const [mergeTarget, setMergeTarget] = React.useState<DuplicateCandidate | null>(null);
  const [rules, setRules] = React.useState<DuplicateRules>(() => readRules());
  const [retentionDraft, setRetentionDraft] = React.useState<Record<string, { days: string; enabled: boolean }>>({});

  const snapshot = useAsync(() => services.demo.snapshot(), []);
  const meters = useAsync(() => services.billing.usage(), []);
  const imports = useList(() => services.data.importJobs({ pageSize: 50 }), [importsKey]);
  const exports = useList(() => services.exports.list({ pageSize: 50 }), [exportKey]);
  const candidates = useList(() => services.data.duplicateCandidates({ pageSize: 50 }), [candidatesKey]);
  const retention = useAsync(() => services.data.retentionPolicy(), []);
  const consent = useAsync(() => services.data.consentOverview(), []);
  const deletions = useList(() => services.data.deletionRequests({ pageSize: 50 }), []);
  const backup = useAsync(() => services.data.backupStatus(), [backupKey]);

  // Seeded during render whenever the retention record changes identity, so a save that
  // reloads it refreshes the draft without a syncing effect.
  const [seededFrom, setSeededFrom] = React.useState(retention.data);
  if (retention.data !== seededFrom) {
    setSeededFrom(retention.data);
    const next: Record<string, { days: string; enabled: boolean }> = {};
    for (const rule of retention.data?.rules ?? []) next[rule.id] = { days: String(rule.retentionDays), enabled: rule.enabled };
    setRetentionDraft(next);
  }

  const saveRules = () => {
    writeRules(rules);
    // The matching itself runs inside the mock service with its own rules; this panel records
    // the administrator's intent and says so rather than implying the list below changed.
    notify.info('Match rules saved in this browser', 'The candidate list below is still produced by the mock service’s own matching rule.');
  };

  const saveRetention = useMutation(
    (input: Array<{ id: string; retentionDays: number; enabled: boolean }>) => services.data.updateRetentionPolicy(input),
    {
      successMessage: (result) => `${result.updated} retention rule${result.updated === 1 ? '' : 's'} updated in this browser.`,
      onSuccess: () => retention.reload(),
    },
  );

  const resolveDuplicate = useMutation(
    (input: { id: string; resolution: 'ignored' | 'not_duplicate' }) => services.data.resolveDuplicate(input.id, input.resolution),
    {
      successMessage: 'Candidate marked as reviewed.',
      onSuccess: () => setCandidatesKey((value) => value + 1),
    },
  );

  const mergeCandidate = useMutation((candidate: DuplicateCandidate) => services.data.mergeRecords(candidate), {
    successMessage: (result) => `Records merged in this browser. ${result.movedRelations} related record${result.movedRelations === 1 ? '' : 's'} re-pointed.`,
    onSuccess: () => {
      setMergeTarget(null);
      setCandidatesKey((value) => value + 1);
    },
  });

  const requestRestore = useMutation(
    (input: { scope: string; reason: string }) => services.data.requestRestore(input.scope, input.reason),
    {
      simulated: true,
      successMessage: (result) => result.note,
      onSuccess: () => {
        setRestoreOpen(false);
        setRestoreReason('');
        setBackupKey((value) => value + 1);
      },
    },
  );

  const requestExport = useMutation(
    (input: { resource: string; rowCount: number }) =>
      services.exports.request({
        resource: input.resource,
        format: 'csv',
        scope: 'all_records',
        rowCount: input.rowCount,
        includeHiddenColumns: false,
        includeCustomFields: false,
        requestedById: active.user?.id ?? '',
        containsPersonalData: input.resource === 'Contacts' || input.resource === 'Leads',
        requiresApproval: false,
      }),
    {
      successMessage: 'Export request recorded. Generate it from the list to download the file.',
      onSuccess: () => setExportKey((value) => value + 1),
    },
  );

  const generateExport = useMutation((id: string) => services.exports.generate(id), {
    onSuccess: (result) => {
      downloadFile(result.filename, result.content, result.mimeType);
      notify.simulated('Export generated in this browser', 'The file was produced locally and downloaded. Nothing was uploaded or emailed.');
      setExportKey((value) => value + 1);
    },
  });

  const resetDemo = useMutation(() => services.demo.reset('all'), {
    onSuccess: (result) => {
      notify.success('Demo data reset', `${formatNumber(result.records)} seeded records were restored across ${result.collections} collections. Reloading…`);
      window.setTimeout(() => window.location.assign('/app/settings/data'), 700);
    },
  });

  const candidateColumns: ColumnDef<DuplicateCandidate, unknown>[] = [
    {
      id: 'records',
      header: 'Candidate pair',
      accessorFn: (candidate) => `${candidate.recordA.label} ${candidate.recordB.label}`,
      cell: ({ row }) => (
        <div className="min-w-0 space-y-0.5">
          <span className="block truncate text-xs font-medium text-fg">{row.original.recordA.label}</span>
          <span className="block truncate text-[0.6875rem] text-muted">↔ {row.original.recordB.label}</span>
        </div>
      ),
    },
    {
      id: 'kind',
      header: 'Type',
      accessorKey: 'entityKind',
      cell: ({ row }) => <StatusBadge status={row.original.entityKind} size="sm" />,
    },
    {
      id: 'score',
      header: 'Score',
      accessorKey: 'score',
      cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.score}%</span>,
    },
    {
      id: 'matched',
      header: 'Matched on',
      accessorFn: (candidate) => candidate.matchedOn.map((match) => match.field).join(', '),
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.matchedOn.map((match) => (
            <TonePill key={match.field} tone="slate">
              {match.field}
            </TonePill>
          ))}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status !== 'pending' ? (
          <span className="text-[0.625rem] text-faint">Reviewed</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="xs"
              loading={mergeCandidate.pending}
              onClick={() => setMergeTarget(row.original)}
            >
              Merge
            </Button>
            <Button
              variant="ghost"
              size="xs"
              loading={resolveDuplicate.pending}
              onClick={() => void resolveDuplicate.run({ id: row.original.id, resolution: 'not_duplicate' })}
            >
              Not a duplicate
            </Button>
            <Button
              variant="ghost"
              size="xs"
              loading={resolveDuplicate.pending}
              onClick={() => void resolveDuplicate.run({ id: row.original.id, resolution: 'ignored' })}
            >
              Ignore
            </Button>
          </span>
        ),
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Data management"
        description="Storage, imports and exports, duplicate review, retention and the demonstration reset."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Data management' }]}
        tabs={<SettingsPageNav />}
        actions={
          <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)} leadingIcon={<Upload className="size-3.5" />}>
            Demonstration import
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <Alert tone="warning" title="No analytics or storage backend is connected">
          Every figure on this page is computed from the synthetic dataset held in this browser. There is no warehouse, no object
          store, no backup service and no privacy workflow behind any of it.
        </Alert>

        {/* ------------------------------------------------ storage & usage */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Database className="size-4 text-subtle" aria-hidden />
            <CardTitle>Storage & usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.loading ? (
              <ListSkeleton rows={3} columns={4} />
            ) : snapshot.error || !snapshot.data ? (
              <RecordErrorState message={snapshot.error ?? 'The dataset snapshot could not be read.'} onRetry={snapshot.reload} />
            ) : (
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-border-subtle bg-inset p-3">
                  <p className="text-2xs font-medium uppercase tracking-wide text-faint">Records</p>
                  <p className="mt-1 text-md font-semibold tabular-nums text-fg">{formatNumber(snapshot.data.records)}</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-inset p-3">
                  <p className="text-2xs font-medium uppercase tracking-wide text-faint">Collections</p>
                  <p className="mt-1 text-md font-semibold tabular-nums text-fg">{formatNumber(snapshot.data.collections)}</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-inset p-3">
                  <p className="text-2xs font-medium uppercase tracking-wide text-faint">Local payload</p>
                  <p className="mt-1 text-md font-semibold tabular-nums text-fg">
                    {snapshot.data.approxBytes > 0 ? `${(snapshot.data.approxBytes / 1024 / 1024).toFixed(2)} MB` : 'Not persisted'}
                  </p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-inset p-3">
                  <p className="text-2xs font-medium uppercase tracking-wide text-faint">Measured at</p>
                  <p className="mt-1 text-xs font-medium text-fg">{formatDate(snapshot.data.takenAt)}</p>
                </div>
              </div>
            )}

            {meters.loading ? (
              <ListSkeleton rows={3} columns={2} />
            ) : (
              <div className="space-y-3">
                {(meters.data ?? []).map((meter) => {
                  const percent = meter.included > 0 ? Math.min(100, Math.round((meter.used / meter.included) * 100)) : 0;
                  const overage = meter.overage ?? 0;
                  return (
                    <div key={meter.key} className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-fg">{meter.label}</span>
                        <span className="text-[0.6875rem] text-muted">
                          {formatNumber(meter.used)} / {formatNumber(meter.included)} {meter.unit}
                          {overage > 0 ? ` · ${formatNumber(overage)} over` : ''} · {meter.overageBehaviour} on overage
                        </span>
                      </div>
                      <Progress value={percent} tone={percent >= 90 ? 'red' : percent >= 70 ? 'amber' : 'teal'} size="sm" />
                    </div>
                  );
                })}
                <p className="text-[0.6875rem] text-faint">
                  Meter readings are seeded illustrative figures for the period {meters.data?.[0]?.periodStart ?? '—'} to{' '}
                  {meters.data?.[0]?.periodEnd ?? '—'}. Nothing here is metered from real traffic.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- imports */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Import history</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setWizardOpen(true)} leadingIcon={<Plus className="size-3.5" />}>
              New import
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {imports.loading ? (
              <ListSkeleton rows={4} columns={5} />
            ) : imports.items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No import jobs have been recorded.</p>
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Job</Th>
                    <Th>Resource</Th>
                    <Th>State</Th>
                    <Th align="end">Rows</Th>
                    <Th align="end">Processed</Th>
                    <Th align="end">Failed</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {imports.items.map((job) => (
                    <Tr key={job.id}>
                      <Td>
                        <span className="block font-mono text-[0.6875rem] text-fg">{job.id}</span>
                        <span className="mt-0.5 block text-[0.625rem] text-faint">{job.createdBy}</span>
                      </Td>
                      <Td>{job.resource}</Td>
                      <Td>
                        <StatusBadge status={job.state} size="sm" />
                      </Td>
                      <Td align="end">{formatNumber(job.totalRows)}</Td>
                      <Td align="end">{formatNumber(job.processedRows)}</Td>
                      <Td align="end">{formatNumber(job.failedRows)}</Td>
                      <Td>
                        <span className="text-[0.6875rem] text-muted">{formatDate(job.createdAt)}</span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
            <DemoNotice tone="neutral">
              The contacts and accounts rows dated to the organization’s creation are illustrative history derived from the seeded
              dataset: their row counts are the real counts of those records. Jobs you run in this session are genuine local writes.
            </DemoNotice>
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- exports */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Export history</CardTitle>
            <Select
              value=""
              onValueChange={(value) => {
                if (!value) return;
                const counts: Record<string, number> = { Contacts: 128, Leads: 96, Accounts: 46, Deals: 92, Tickets: 104 };
                void requestExport.run({ resource: value, rowCount: counts[value] ?? 100 });
              }}
              options={[{ value: '', label: 'Request an export…' }, ...EXPORT_RESOURCES.map((value) => ({ value, label: value }))]}
              selectSize="sm"
              className="w-[13rem]"
              aria-label="Request an export"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {exports.loading ? (
              <ListSkeleton rows={4} columns={5} />
            ) : exports.items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No exports have been requested.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {exports.items.map((request: ExportRequest) => (
                  <li key={request.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-fg">{request.resource}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-faint">
                        {request.format.toUpperCase()} · {formatNumber(request.rowCount)} rows · requested{' '}
                        {formatDate(request.requestedAt, 'relative')}
                        {request.containsPersonalData ? ' · contains personal data' : ''}
                      </span>
                    </span>
                    <StatusBadge status={request.state} size="sm" />
                    <Button
                      variant="secondary"
                      size="xs"
                      loading={generateExport.pending}
                      onClick={() => void generateExport.run(request.id)}
                      leadingIcon={<Download className="size-3" />}
                    >
                      Generate
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <DemoNotice tone="neutral">
              Export files are produced in this browser from the seeded records and download straight to your machine. Nothing is
              uploaded, queued on a server or emailed.
            </DemoNotice>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------- duplicates */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Duplicate candidates</CardTitle>
            <span className="text-2xs text-faint">{formatNumber(candidates.meta?.total ?? 0)} in the queue</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 rounded-lg border border-border-subtle bg-inset p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-fg">Match rules (local only)</p>
                <Checkbox id="dup-email" checked={rules.matchEmail} onCheckedChange={(checked) => setRules((current) => ({ ...current, matchEmail: checked === true }))} label="Match on email address" />
                <Checkbox id="dup-phone" checked={rules.matchPhone} onCheckedChange={(checked) => setRules((current) => ({ ...current, matchPhone: checked === true }))} label="Match on phone number" />
                <Checkbox id="dup-name" checked={rules.matchName} onCheckedChange={(checked) => setRules((current) => ({ ...current, matchName: checked === true }))} label="Match on name and account" />
                <Checkbox id="dup-domain" checked={rules.matchDomain} onCheckedChange={(checked) => setRules((current) => ({ ...current, matchDomain: checked === true }))} label="Match on website domain" />
              </div>
              <div className="space-y-3">
                <Slider
                  id="dup-threshold"
                  label="Match threshold"
                  value={rules.threshold}
                  onChange={(value) => setRules((current) => ({ ...current, threshold: value }))}
                  min={50}
                  max={100}
                  step={1}
                  formatValue={(value) => `${value}%`}
                />
                <Switch id="dup-automerge" checked={false} disabled onCheckedChange={() => undefined} label="Automatic merge" description="Not offered: every merge is a human decision in this build." />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={saveRules}>
                  Save rules
                </Button>
                <p className="text-[0.6875rem] leading-relaxed text-faint">
                  Saved under <span className="font-mono">crm.demo.duplicate-rules</span> in this browser. The mock service produces
                  the candidates below with its own fixed rule, so this panel records intent rather than changing the algorithm.
                </p>
              </div>
            </div>

            {candidates.loading ? (
              <ListSkeleton rows={5} columns={5} />
            ) : candidates.items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">
                No duplicate candidates are derived from the seeded {active.active?.name ?? 'organization'} records.
              </p>
            ) : (
              <DataTable columns={candidateColumns} data={candidates.items} getRowId={(candidate) => candidate.id} />
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------ retention */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Retention policy</CardTitle>
            {retention.data?.lastReviewedAt ? <span className="text-2xs text-faint">Last reviewed {formatDate(retention.data.lastReviewedAt)}</span> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {retention.loading || Object.keys(retentionDraft).length === 0 ? (
              <ListSkeleton rows={5} columns={4} />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Resource</Th>
                    <Th align="end">Keep for (days)</Th>
                    <Th>Action</Th>
                    <Th>Legal hold exemption</Th>
                    <Th>Enabled</Th>
                  </tr>
                </thead>
                <tbody>
                  {(retention.data?.rules ?? []).map((rule) => {
                    const draft = retentionDraft[rule.id] ?? { days: String(rule.retentionDays), enabled: rule.enabled };
                    return (
                      <Tr key={rule.id}>
                        <Td>{rule.resource}</Td>
                        <Td align="end">
                          <Input
                            aria-label={`Retention days for ${rule.resource}`}
                            inputMode="numeric"
                            value={draft.days}
                            onChange={(event) => setRetentionDraft((current) => ({ ...current, [rule.id]: { ...draft, days: event.target.value } }))}
                            className="w-[6rem] text-end"
                          />
                        </Td>
                        <Td>
                          <Badge variant="outline" size="sm">
                            {rule.action}
                          </Badge>
                        </Td>
                        <Td>
                          {rule.legalHoldExempt ? (
                            <TonePill tone="amber">Exempt under legal hold</TonePill>
                          ) : (
                            <span className="text-[0.6875rem] text-faint">Not exempt</span>
                          )}
                        </Td>
                        <Td>
                          <Switch
                            id={`retention-${rule.id}`}
                            checked={draft.enabled}
                            onCheckedChange={(checked) => setRetentionDraft((current) => ({ ...current, [rule.id]: { ...draft, enabled: checked } }))}
                            label={<span className="sr-only">Enable retention for {rule.resource}</span>}
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-xl text-[0.6875rem] leading-relaxed text-faint">
                Retention is a recorded intention. No archival, anonymisation or deletion job runs in this build, and the audit
                retention here and on the Security screen read the same value.
              </p>
              <Button
                variant="primary"
                size="sm"
                loading={saveRetention.pending}
                onClick={() => {
                  const rulesToSave = Object.entries(retentionDraft).map(([id, draft]) => ({ id, retentionDays: Number(draft.days) || 0, enabled: draft.enabled }));
                  void saveRetention.run(rulesToSave);
                }}
              >
                Save retention policy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------------------- consent and deletions */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Consent overview</CardTitle>
              <span className="text-2xs text-faint">{formatNumber(consent.data?.changes30d ?? 0)} changes in 30 days</span>
            </CardHeader>
            <CardContent className="space-y-4">
              {consent.loading ? (
                <ListSkeleton rows={4} columns={2} />
              ) : consent.error || !consent.data ? (
                <RecordErrorState message={consent.error ?? 'Consent figures could not be derived.'} onRetry={consent.reload} />
              ) : (
                <>
                  <TableWrap>
                    <thead>
                      <tr>
                        <Th>Channel</Th>
                        <Th align="end">Granted</Th>
                        <Th align="end">Denied</Th>
                        <Th align="end">Withdrawn</Th>
                        <Th align="end">Pending</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {consent.data.byChannel.map((row) => (
                        <Tr key={row.channel}>
                          <Td>{row.channel}</Td>
                          <Td align="end">{formatNumber(row.granted)}</Td>
                          <Td align="end">{formatNumber(row.denied)}</Td>
                          <Td align="end">{formatNumber(row.withdrawn)}</Td>
                          <Td align="end">{formatNumber(row.pending)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </TableWrap>
                  <div>
                    <p className="text-xs font-medium text-fg">By jurisdiction</p>
                    <ul className="mt-1 space-y-1 text-[0.6875rem] text-muted">
                      {consent.data.byJurisdiction.length === 0 ? (
                        <li className="text-faint">No jurisdiction tag is recorded on the consent entries.</li>
                      ) : (
                        consent.data.byJurisdiction.map((row) => (
                          <li key={row.jurisdiction}>
                            {row.jurisdiction}: {formatNumber(row.contacts)} contacts · {formatNumber(row.granted)} granted ·{' '}
                            {formatNumber(row.withdrawn)} withdrawn
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <DemoNotice tone="neutral">
                    Figures are derived directly from the consent entries on the seeded contacts. No consent-management platform is
                    connected, and the jurisdiction tag is a label rather than a legal determination.
                  </DemoNotice>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Deletion requests</CardTitle>
              <span className="text-2xs text-faint">derived from withdrawn consent</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {deletions.loading ? (
                <ListSkeleton rows={4} columns={3} />
              ) : deletions.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">No contact record currently carries a withdrawn consent entry.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {deletions.items.slice(0, 8).map((request) => (
                    <li key={request.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-fg">{request.subjectLabel}</span>
                        <span className="mt-0.5 block text-[0.6875rem] text-faint">
                          {request.requestedBy} · due {formatDate(request.dueAt)}
                        </span>
                      </span>
                      <StatusBadge status={request.state} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
              <DemoNotice tone="neutral">
                These rows are derived from withdrawn consent entries so the workflow can be seen. Nothing was deleted, no data
                subject was contacted and no regulator or privacy platform is connected.
              </DemoNotice>
            </CardContent>
          </Card>
        </div>

        {/* ---------------------------------------------------------- backup */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <HardDriveDownload className="size-4 text-subtle" aria-hidden />
            <CardTitle>Backup & restore</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {backup.loading ? (
              <ListSkeleton rows={2} columns={3} />
            ) : backup.error || !backup.data ? (
              <RecordErrorState message={backup.error ?? 'Backup status is unavailable.'} onRetry={backup.reload} />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={backup.data.state} label="Not connected" size="sm" />
                  <p className="text-xs text-muted">{backup.data.note}</p>
                </div>
                {backup.data.requestedRestores.length > 0 ? (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {backup.data.requestedRestores.map((request) => (
                      <li key={request.id} className="flex flex-wrap items-center gap-2 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-fg">{request.scope}</span>
                        <StatusBadge status={request.state} size="sm" />
                        <span className="text-[0.6875rem] text-faint">{formatDate(request.requestedAt, 'relative')}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setRestoreOpen(true)}>
                    Request a restore
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------- reset */}
        <Card className="border-danger/30">
          <CardHeader className="flex-row items-center gap-2">
            <AlertTriangle className="size-4 text-danger-fg" aria-hidden />
            <CardTitle>Reset demo data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs leading-relaxed text-muted">
              Restores every collection to the seeded baseline and clears this browser’s demonstration settings. Any record you
              created, any policy you edited and any import you ran in this session is discarded.
            </p>
            <Button variant="danger-outline" size="sm" onClick={() => setResetOpen(true)} leadingIcon={<RotateCcw className="size-3.5" />}>
              Reset demo data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------- import wizard */}
      <ImportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCommitted={() => setImportsKey((value) => value + 1)}
      />

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent
          title="Request a restore"
          description="The request is recorded in this browser against a backup service that does not exist."
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setRestoreOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={requestRestore.pending}
                onClick={() => void requestRestore.run({ scope: restoreScope, reason: restoreReason.trim() })}
              >
                Record request
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Scope" htmlFor="restore-scope">
              <Select id="restore-scope" value={restoreScope} onValueChange={setRestoreScope} options={['Full dataset', 'Contacts', 'Deals', 'Tickets', 'Documents'].map((value) => ({ value, label: value }))} />
            </Field>
            <Field label="Reason" htmlFor="restore-reason" required>
              <Textarea id="restore-reason" rows={3} value={restoreReason} onChange={(event) => setRestoreReason(event.target.value)} placeholder="Why a restore is being requested" />
            </Field>
            <Alert tone="warning" title="Nothing will be restored">
              There is no snapshot to restore from. This form exercises the request flow and the returned note says plainly that no
              data was recovered.
            </Alert>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={mergeTarget !== null}
        onOpenChange={(open) => !open && setMergeTarget(null)}
        title={mergeTarget ? `Merge ${mergeTarget.recordB.label} into ${mergeTarget.recordA.label}?` : 'Merge records?'}
        description="The second record is removed from this browser and its related records are re-pointed to the first. This cannot be undone from the interface."
        confirmLabel="Merge records"
        tone="danger"
        loading={mergeCandidate.pending}
        onCancel={() => setMergeTarget(null)}
        onConfirm={() => {
          if (mergeTarget) void mergeCandidate.run(mergeTarget);
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demonstration data?"
        description="Every local change is discarded, including records you created, policies you edited and demonstration settings. The page reloads afterwards."
        confirmLabel="Reset everything"
        tone="danger"
        loading={resetDemo.pending}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => void resetDemo.run(undefined)}
      >
        <p className="text-xs text-muted">
          The seeded baseline is deterministic: the same three tenants with the same synthetic records are rebuilt from the fixed
          dataset epoch.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------ import wizard */

type WizardStep = 'source' | 'map' | 'validate';

type WizardMapInput = { resource: string; fileName: string; rowCount: number; headers: string[] };
type WizardMapping = { sourceHeader: string; targetField: string | null; confidence: number; sample: string[] };

function ImportWizard({ open, onOpenChange, onCommitted }: { open: boolean; onOpenChange: (open: boolean) => void; onCommitted: () => void }) {
  const services = useServices();
  const [step, setStep] = React.useState<WizardStep>('source');
  const [resource, setResource] = React.useState('contacts');
  const [fileName, setFileName] = React.useState('contacts-october-2026.csv');
  const [rowCount, setRowCount] = React.useState('120');
  const [headersText, setHeadersText] = React.useState(DEFAULT_HEADERS['contacts'] ?? '');
  const [jobId, setJobId] = React.useState('');
  const [mappings, setMappings] = React.useState<Array<{ sourceHeader: string; targetField: string | null }>>([]);
  const [validation, setValidation] = React.useState<{ valid: number; invalid: number; warnings: number; errors: Array<{ row: number; field: string; message: string }> } | null>(null);
  const [onDuplicate, setOnDuplicate] = React.useState<'skip' | 'update' | 'create_anyway'>('skip');

  /** Only mapped columns are sent: an empty target field means “do not import this column”. */
  const mappedColumns = (): Array<{ sourceHeader: string; targetField: string }> =>
    mappings
      .filter((mapping): mapping is { sourceHeader: string; targetField: string } => Boolean(mapping.targetField))
      .map((mapping) => ({ sourceHeader: mapping.sourceHeader, targetField: mapping.targetField }));

  const startMapping = useMutation<WizardMapInput, { mappings: WizardMapping[]; unmappedHeaders: string[] }>(
    async (input) => {
      const started = await services.data.startImport({ resource: input.resource, fileName: input.fileName, rowCount: input.rowCount });
      if (!started.ok) return started;
      setJobId(started.data.jobId);
      return services.data.suggestMapping(started.data.jobId, input.headers);
    },
    {
      onSuccess: (result) => {
        setMappings(result.mappings.map((mapping) => ({ sourceHeader: mapping.sourceHeader, targetField: mapping.targetField })));
        setStep('map');
      },
    },
  );

  const validate = useMutation<{ jobId: string; mappings: Array<{ sourceHeader: string; targetField: string }> }, { valid: number; invalid: number; warnings: number; errors: Array<{ row: number; field: string; message: string }> }>(
    (input) => services.data.validateImport(input.jobId, input.mappings),
    {
      onSuccess: (result) => {
        setValidation(result);
        setStep('validate');
      },
    },
  );

  const commit = useMutation<{ jobId: string; mappings: Array<{ sourceHeader: string; targetField: string }>; onDuplicate: 'skip' | 'update' | 'create_anyway' }, { created: number; updated: number; skipped: number; failed: number; jobId: string }>(
    (input) => services.data.commitImport(input.jobId, input.mappings, { onDuplicate: input.onDuplicate }),
    {
      successMessage: (result) =>
        `Import run finished: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed.`,
      onSuccess: () => {
        onCommitted();
        onOpenChange(false);
        setStep('source');
        setValidation(null);
        setJobId('');
      },
    },
  );

  const headers = headersText.split(',').map((header) => header.trim()).filter(Boolean);
  const fieldOptions = IMPORT_RESOURCE_FIELDS[resource] ?? IMPORT_RESOURCE_FIELDS['contacts']!;
  const targetOptions = fieldOptions.filter((option) => option.value !== '');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setStep('source');
          setValidation(null);
        }
      }}
    >
      <DialogContent
        title="Demonstration import"
        description="No file is read. You type the headers and the row count, and this run creates synthetic records from them."
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step === 'source' ? (
              <Button
                variant="primary"
                size="sm"
                loading={startMapping.pending}
                onClick={() => {
                  if (headers.length === 0) {
                    notify.warning('Enter at least one column header.');
                    return;
                  }
                  const count = Number(rowCount);
                  if (!Number.isFinite(count) || count < 1) {
                    notify.warning('Enter a row count of at least one.');
                    return;
                  }
                  void startMapping.run({ resource, fileName, rowCount: count, headers });
                }}
              >
                Suggest a mapping
              </Button>
            ) : step === 'map' ? (
              <Button
                variant="primary"
                size="sm"
                loading={validate.pending}
                onClick={() => void validate.run({ jobId, mappings: mappedColumns() })}
              >
                Validate mapping
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={commit.pending}
                onClick={() => void commit.run({ jobId, mappings: mappedColumns(), onDuplicate })}
              >
                Run the import
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {step === 'source' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Resource" htmlFor="wizard-resource">
                  <Select
                    id="wizard-resource"
                    value={resource}
                    onValueChange={(value) => {
                      setResource(value);
                      setHeadersText(DEFAULT_HEADERS[value] ?? '');
                      setFileName(`${value}-october-2026.csv`);
                    }}
                    options={RESOURCE_OPTIONS}
                  />
                </Field>
                <Field label="File name" htmlFor="wizard-file" description="Used to compose the synthetic records. No file with this name is read.">
                  <Input id="wizard-file" value={fileName} onChange={(event) => setFileName(event.target.value)} />
                </Field>
                <Field label="Row count" htmlFor="wizard-rows" description="The number of rows the file is said to contain.">
                  <Input id="wizard-rows" inputMode="numeric" value={rowCount} onChange={(event) => setRowCount(event.target.value)} />
                </Field>
                <Field label="Column headers" htmlFor="wizard-headers" className="sm:col-span-2" description="Comma separated. The mapping is suggested from these names alone.">
                  <Input id="wizard-headers" value={headersText} onChange={(event) => setHeadersText(event.target.value)} />
                </Field>
              </div>
              <Alert tone="warning" title="Read this before running it">
                This build never reads a file. At most 200 synthetic records are composed from the file name and row number; each one
                carries a note saying it came from a demonstration import. Duplicate detection uses those composed values, so it will
                not find duplicates that exist in a real file.
              </Alert>
            </>
          ) : step === 'map' ? (
            <>
              <p className="text-xs text-muted">
                Suggested mappings are matched from the header names. Adjust any that are wrong; a header left as “Do not import” is
                ignored.
              </p>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Source column</Th>
                    <Th>Target field</Th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping, index) => (
                    <Tr key={`${mapping.sourceHeader}-${index}`}>
                      <Td>
                        <span className="font-mono text-[0.6875rem] text-fg">{mapping.sourceHeader}</span>
                      </Td>
                      <Td>
                        <Select
                          value={mapping.targetField ?? ''}
                          onValueChange={(value) =>
                            setMappings((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, targetField: value || null } : entry)))
                          }
                          options={fieldOptions}
                          selectSize="sm"
                          className="w-[14rem]"
                          aria-label={`Target field for ${mapping.sourceHeader}`}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
              <p className="text-[0.6875rem] text-faint">
                {targetOptions.length} target field{targetOptions.length === 1 ? '' : 's'} are available for this resource in the
                demonstration importer.
              </p>
            </>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  { label: 'Valid rows', value: validation?.valid ?? 0 },
                  { label: 'Invalid rows', value: validation?.invalid ?? 0 },
                  { label: 'Warnings', value: validation?.warnings ?? 0 },
                  { label: 'Mapped columns', value: mappings.filter((mapping) => mapping.targetField).length },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border-subtle bg-inset p-3">
                    <p className="text-2xs font-medium uppercase tracking-wide text-faint">{stat.label}</p>
                    <p className="mt-1 text-md font-semibold tabular-nums text-fg">{formatNumber(stat.value)}</p>
                  </div>
                ))}
              </div>
              {validation && validation.errors.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-fg">Rejected rows</p>
                  <ul className="mt-1 space-y-1 text-[0.6875rem] text-muted">
                    {validation.errors.slice(0, 8).map((error, index) => (
                      <li key={`${error.row}-${error.field}-${index}`}>
                        Row {error.row} · {error.field}: {error.message}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[0.625rem] text-faint">Showing the first 8 of {validation.errors.length} reported problems.</p>
                </div>
              ) : (
                <p className="text-xs text-muted">No row-level problems were reported for this mapping.</p>
              )}
              <Field label="When a composed record already exists" htmlFor="wizard-duplicate" description="Only synthesised keys can be matched, because no file values are read.">
                <Select
                  id="wizard-duplicate"
                  value={onDuplicate}
                  onValueChange={(value) => setOnDuplicate(value as typeof onDuplicate)}
                  options={[
                    { value: 'skip', label: 'Skip it' },
                    { value: 'update', label: 'Update the existing record' },
                    { value: 'create_anyway', label: 'Create another record anyway' },
                  ]}
                  selectSize="sm"
                />
              </Field>
              <DemoNotice tone="neutral">
                Row-level validation is deterministic: the same row count always reports the same rejected rows. Nothing inspects file
                content because there is none.
              </DemoNotice>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
