'use client';

import * as React from 'react';
import { Download, KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import type { AuditEvent, SecurityPolicy, SessionRecord, TrustedDevice } from '@crm/shared-types';
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
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  Input,
  Select,
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
 * Security policy, sessions, trusted devices and the audit log.
 *
 * The honesty rule of this file is one sentence long, and it is stated at the top of both
 * screens: **these controls are stored in this browser and change nothing about how anyone signs
 * in.** There is no identity provider, no directory, no SMS gateway, no mail transport and no
 * server-side session table. Where a control would normally have a real-world effect — revoking a
 * session, requiring MFA — the outcome is labelled as a local demonstration rather than dressed
 * up as enforcement.
 */

/** Dates for the audit export range: 90 days before the dataset epoch, and the epoch itself. */
const EXPORT_TO_DEFAULT = '2026-10-13';
const EXPORT_FROM_DEFAULT = '2026-07-15';

export function SecurityScreen() {
  const services = useServices();

  const policy = useAsync(() => services.security.policy(), []);
  const users = useList(() => services.users.list({ pageSize: 200 }), []);
  const active = useActiveOrganization();

  const [draft, setDraft] = React.useState<SecurityPolicy | undefined>(undefined);
  const [seededFrom, setSeededFrom] = React.useState<SecurityPolicy | undefined>(undefined);
  const [sessionsKey, setSessionsKey] = React.useState(0);
  const [devicesKey, setDevicesKey] = React.useState(0);

  if (policy.data !== seededFrom) {
    setSeededFrom(policy.data);
    setDraft(policy.data);
  }

  const sessions = useList(() => services.security.sessions({ pageSize: 50 }), [sessionsKey]);
  const devices = useList(() => services.security.devices(), [devicesKey]);

  const orgUsers = React.useMemo(
    () => users.items.filter((user) => user.organizationIds.includes(active.activeId)),
    [users.items, active.activeId],
  );
  const nameById = React.useMemo(() => new Map(orgUsers.map((user) => [user.id, user.displayName])), [orgUsers]);

  const dirty = Boolean(draft && policy.data && JSON.stringify(draft) !== JSON.stringify(policy.data));

  const setMfa = (patch: Partial<SecurityPolicy['mfa']>) => setDraft((current) => (current ? { ...current, mfa: { ...current.mfa, ...patch } } : current));
  const setPassword = (patch: Partial<SecurityPolicy['password']>) => setDraft((current) => (current ? { ...current, password: { ...current.password, ...patch } } : current));
  const setSessionsPolicy = (patch: Partial<SecurityPolicy['sessions']>) => setDraft((current) => (current ? { ...current, sessions: { ...current.sessions, ...patch } } : current));
  const setNetwork = (patch: Partial<SecurityPolicy['network']>) => setDraft((current) => (current ? { ...current, network: { ...current.network, ...patch } } : current));
  const setGovernance = (patch: Partial<SecurityPolicy['dataGovernance']>) => setDraft((current) => (current ? { ...current, dataGovernance: { ...current.dataGovernance, ...patch } } : current));

  const savePolicy = useMutation((next: SecurityPolicy) => services.security.updatePolicy(next), {
    successMessage: 'Security policy saved in this browser.',
    onSuccess: () => policy.reload(),
  });

  const revokeSession = useMutation((id: string) => services.security.revokeSession(id), {
    onSuccess: (result) => {
      // The service returns the honest wording; the toast uses it rather than inventing one.
      notify.simulated('Session record removed', result.note);
      setSessionsKey((value) => value + 1);
    },
  });
  const revokeOthers = useMutation(() => services.security.revokeAllOtherSessions(), {
    onSuccess: (result) => {
      notify.simulated('Other sessions cleared', result.note);
      setSessionsKey((value) => value + 1);
    },
  });
  const revokeDevice = useMutation((id: string) => services.security.revokeDevice(id), {
    successMessage: 'Device trust cleared in this browser.',
    onSuccess: () => setDevicesKey((value) => value + 1),
  });

  const sessionColumns: ColumnDef<SessionRecord, unknown>[] = [
    {
      id: 'user',
      header: 'User',
      accessorKey: 'userId',
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate text-xs font-medium text-fg">{nameById.get(row.original.userId) ?? 'Unknown user'}</span>
          <span className="mt-0.5 block text-[0.6875rem] text-faint">{row.original.deviceLabel}</span>
        </div>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      accessorFn: (session) => `${session.browser} ${session.os}`,
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate text-[0.6875rem] text-muted">
            {row.original.browser} · {row.original.os}
          </span>
          <span className="mt-0.5 block truncate text-[0.625rem] text-faint">
            {row.original.locationLabel ?? 'Location not recorded'} · {row.original.ipAddressMasked}
          </span>
        </div>
      ),
    },
    {
      id: 'started',
      header: 'Started',
      accessorKey: 'startedAt',
      cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.startedAt)}</span>,
    },
    {
      id: 'lastSeen',
      header: 'Last seen',
      accessorKey: 'lastSeenAt',
      cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.lastSeenAt, 'relative')}</span>,
    },
    {
      id: 'flags',
      header: 'Flags',
      accessorFn: (session) => [session.current ? 'current' : '', session.trusted ? 'trusted' : '', session.mfaSatisfied ? 'mfa' : ''].join(' '),
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.current ? <Badge variant="brand" size="sm">This session</Badge> : null}
          {row.original.trusted ? <Badge variant="outline" size="sm">Trusted</Badge> : null}
          {row.original.mfaSatisfied ? (
            <Badge variant="success" size="sm">MFA</Badge>
          ) : (
            <Badge variant="warning" size="sm">No MFA</Badge>
          )}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.current ? (
          <span className="text-[0.625rem] text-faint">Cannot be ended here</span>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            loading={revokeSession.pending}
            onClick={() => void revokeSession.run(row.original.id)}
            leadingIcon={<LogOut className="size-3" />}
          >
            End session
          </Button>
        ),
    },
  ];

  const deviceColumns: ColumnDef<TrustedDevice, unknown>[] = [
    {
      id: 'device',
      header: 'Device',
      accessorKey: 'label',
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate text-xs font-medium text-fg">{row.original.label}</span>
          <span className="mt-0.5 block text-[0.6875rem] text-faint">
            {row.original.platform} · {nameById.get(row.original.userId) ?? 'Unknown user'}
          </span>
        </div>
      ),
    },
    {
      id: 'added',
      header: 'Added',
      accessorKey: 'addedAt',
      cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.addedAt)}</span>,
    },
    {
      id: 'used',
      header: 'Last used',
      accessorKey: 'lastUsedAt',
      cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.lastUsedAt, 'relative')}</span>,
    },
    {
      id: 'expires',
      header: 'Expires',
      accessorKey: 'expiresAt',
      cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.expiresAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="xs" loading={revokeDevice.pending} onClick={() => void revokeDevice.run(row.original.id)}>
          Remove trust
        </Button>
      ),
    },
  ];

  if (policy.loading || !draft) return <ListSkeleton rows={12} columns={3} />;
  if (policy.error) {
    return (
      <div className="pb-8">
        <PageHeader title="Security" tabs={<SettingsPageNav />} />
        <div className="p-4 sm:p-6">
          <RecordErrorState message={policy.error} onRetry={policy.reload} />
        </div>
      </div>
    );
  }

  const mfaMethodOptions: Array<{ value: SecurityPolicy['mfa']['allowedMethods'][number]; label: string; note: string }> = [
    { value: 'totp', label: 'Authenticator app (TOTP)', note: 'The method this demonstration uses everywhere it shows an MFA state.' },
    { value: 'webauthn', label: 'Security key / passkey (WebAuthn)', note: 'Described only; no relying-party configuration exists here.' },
    { value: 'sms', label: 'SMS code', note: 'No SMS gateway is connected, so no code could ever be delivered.' },
    { value: 'email', label: 'Email code', note: 'No mail transport is connected, so no code could ever be delivered.' },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Security"
        description="Password rules, multi-factor requirements, session timeouts and network restrictions for this organization."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Security' }]}
        tabs={<SettingsPageNav />}
        actions={
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty}
            loading={savePolicy.pending}
            onClick={() => void savePolicy.run(draft)}
            leadingIcon={<ShieldCheck className="size-3.5" />}
          >
            Save policy
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <Alert tone="warning" title="These controls are local-only">
          The policy is stored in this browser’s demonstration store. No identity provider, directory, network policy engine or
          session service is connected, so nothing on this page changes how anyone signs in, and no enforcement claim is made.
        </Alert>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Multi-factor authentication</CardTitle>
            <StatusBadge status={draft.mfa.enforcement} tone={draft.mfa.enforcement === 'off' ? 'slate' : 'green'} size="sm" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Requirement" htmlFor="mfa-enforcement" description="Who would be asked for a second factor. Nothing is enforced in this build.">
              <Select
                id="mfa-enforcement"
                value={draft.mfa.enforcement}
                onValueChange={(value) => setMfa({ enforcement: value as SecurityPolicy['mfa']['enforcement'] })}
                options={[
                  { value: 'off', label: 'Off — no second factor required' },
                  { value: 'admins_only', label: 'Administrators only' },
                  { value: 'all_users', label: 'Every user' },
                  { value: 'risk_based', label: 'Risk-based (adaptive)' },
                ]}
                selectSize="sm"
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Allowed methods</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {mfaMethodOptions.map((method) => (
                  <div key={method.value} className="rounded-md border border-border-subtle bg-surface p-2.5">
                    <Checkbox
                      id={`mfa-${method.value}`}
                      checked={draft.mfa.allowedMethods.includes(method.value)}
                      onCheckedChange={(checked) =>
                        setMfa({
                          allowedMethods: checked === true
                            ? [...draft.mfa.allowedMethods, method.value]
                            : draft.mfa.allowedMethods.filter((value) => value !== method.value),
                        })
                      }
                      label={method.label}
                      description={method.note}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Grace period (days)" htmlFor="mfa-grace" hint="Time before enforcement would begin for existing users.">
                <Input
                  id="mfa-grace"
                  inputMode="numeric"
                  value={String(draft.mfa.gracePeriodDays)}
                  onChange={(event) => setMfa({ gracePeriodDays: Number(event.target.value) || 0 })}
                />
              </Field>
              <Field label="Remember a device (days)" htmlFor="mfa-remember" hint="Applies to trusted devices listed below.">
                <Input
                  id="mfa-remember"
                  inputMode="numeric"
                  value={String(draft.mfa.rememberDeviceDays)}
                  onChange={(event) => setMfa({ rememberDeviceDays: Number(event.target.value) || 0 })}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum length" htmlFor="pwd-length" hint="8–64 characters.">
              <Input id="pwd-length" inputMode="numeric" value={String(draft.password.minLength)} onChange={(event) => setPassword({ minLength: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="Prevent reuse (previous passwords)" htmlFor="pwd-reuse" hint="0–24.">
              <Input id="pwd-reuse" inputMode="numeric" value={String(draft.password.preventReuse)} onChange={(event) => setPassword({ preventReuse: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="Lock out after (failed attempts)" htmlFor="pwd-lockout" hint="1–50.">
              <Input id="pwd-lockout" inputMode="numeric" value={String(draft.password.lockoutAttempts)} onChange={(event) => setPassword({ lockoutAttempts: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="Expire passwords after (days)" htmlFor="pwd-expiry" hint="Leave empty for no expiry.">
              <Input
                id="pwd-expiry"
                inputMode="numeric"
                value={draft.password.expiryDays === null ? '' : String(draft.password.expiryDays)}
                onChange={(event) => setPassword({ expiryDays: event.target.value === '' ? null : Number(event.target.value) })}
                placeholder="No expiry"
              />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <Switch id="pwd-upper" checked={draft.password.requireUppercase} onCheckedChange={(checked) => setPassword({ requireUppercase: checked })} label="Require an uppercase letter" />
              <Switch id="pwd-number" checked={draft.password.requireNumber} onCheckedChange={(checked) => setPassword({ requireNumber: checked })} label="Require a number" />
              <Switch id="pwd-symbol" checked={draft.password.requireSymbol} onCheckedChange={(checked) => setPassword({ requireSymbol: checked })} label="Require a symbol" />
            </div>
            <div className="sm:col-span-2">
              <DemoNotice tone="neutral">
                These are stored preferences. Password validation in a real deployment is performed by the authentication service —
                a frontend rule is advice, not a control.
              </DemoNotice>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Single sign-on</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert tone="warning" title="No identity provider is connected">
              There is no SAML or OIDC metadata, no signing certificate, no client secret, no directory synchronisation and no
              just-in-time provisioning in this build. The status below is therefore “not connected” rather than a configured
              integration that has not been tested yet.
            </Alert>
            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
              {[
                { label: 'Protocol', value: draft.sso.protocol === 'none' ? 'None configured' : draft.sso.protocol.toUpperCase() },
                { label: 'Enforced for everyone', value: draft.sso.enforceForAllUsers ? 'Yes' : 'No' },
                { label: 'JIT provisioning', value: draft.sso.jitProvisioning ? 'On' : 'Off' },
                { label: 'Provider', value: draft.sso.providerLabel ?? 'Not connected' },
                { label: 'Default role on first sign-in', value: draft.sso.defaultRoleId ?? 'Not set' },
                { label: 'State', value: 'not_connected' },
              ].map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-2xs font-medium uppercase tracking-wide text-faint">{fact.label}</dt>
                  <dd className="mt-0.5 truncate font-medium text-fg">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Idle timeout (minutes)" htmlFor="sess-idle" hint="5–1440.">
                <Input id="sess-idle" inputMode="numeric" value={String(draft.sessions.idleTimeoutMinutes)} onChange={(event) => setSessionsPolicy({ idleTimeoutMinutes: Number(event.target.value) || 0 })} />
              </Field>
              <Field label="Absolute timeout (hours)" htmlFor="sess-absolute" hint="1–2160.">
                <Input id="sess-absolute" inputMode="numeric" value={String(draft.sessions.absoluteTimeoutHours)} onChange={(event) => setSessionsPolicy({ absoluteTimeoutHours: Number(event.target.value) || 0 })} />
              </Field>
              <Field label="Concurrent session limit" htmlFor="sess-limit" hint="Leave empty for no limit.">
                <Input
                  id="sess-limit"
                  inputMode="numeric"
                  value={draft.sessions.concurrentSessionLimit === null ? '' : String(draft.sessions.concurrentSessionLimit)}
                  onChange={(event) => setSessionsPolicy({ concurrentSessionLimit: event.target.value === '' ? null : Number(event.target.value) })}
                  placeholder="No limit"
                />
              </Field>
              <div className="flex items-end">
                <Switch
                  id="sess-reauth"
                  checked={draft.sessions.requireReauthForSensitiveActions}
                  onCheckedChange={(checked) => setSessionsPolicy({ requireReauthForSensitiveActions: checked })}
                  label="Re-authenticate for sensitive actions"
                  description="Would prompt again before exports, permission changes and billing changes."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4">
              <div>
                <p className="text-xs font-medium text-fg">Active sessions</p>
                <p className="mt-0.5 text-[0.6875rem] text-muted">
                  {formatNumber(sessions.meta?.total ?? 0)} session records for members of this organization.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={revokeOthers.pending}
                onClick={() => void revokeOthers.run(undefined)}
                leadingIcon={<LogOut className="size-3.5" />}
              >
                Clear other sessions
              </Button>
            </div>

            {sessions.loading ? (
              <ListSkeleton rows={4} columns={5} />
            ) : (
              <DataTable
                columns={sessionColumns}
                data={sessions.items}
                getRowId={(session) => session.id}
                emptyState={<p className="p-6 text-center text-xs text-muted">No session records are listed for this organization.</p>}
              />
            )}
            <DemoNotice tone="neutral">
              “End session” removes the record from this browser. It cannot terminate a real session, because no session service is
              connected — the confirmation says exactly that.
            </DemoNotice>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <MonitorSmartphone className="size-4 text-subtle" aria-hidden />
            <CardTitle>Trusted devices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {devices.loading ? (
              <ListSkeleton rows={3} columns={4} />
            ) : devices.items.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">No session is currently marked as trusted.</p>
            ) : (
              <DataTable columns={deviceColumns} data={devices.items} getRowId={(device) => device.id} />
            )}
            <DemoNotice tone="neutral">
              A device is derived from a session whose <span className="font-mono">trusted</span> flag is set. Removing trust clears
              that flag locally; there is no device registry behind it.
            </DemoNotice>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network restrictions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="IP allow-list" htmlFor="net-allow" description="One CIDR range per line, for example 203.0.113.0/24. Empty means no restriction.">
              <Textarea
                id="net-allow"
                rows={3}
                value={draft.network.ipAllowlist.join('\n')}
                onChange={(event) => setNetwork({ ipAllowlist: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })}
                className="font-mono"
              />
            </Field>
            <Field label="IP deny-list" htmlFor="net-deny" description="Ranges that would be refused regardless of the allow-list.">
              <Textarea
                id="net-deny"
                rows={2}
                value={draft.network.ipDenylist.join('\n')}
                onChange={(event) => setNetwork({ ipDenylist: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })}
                className="font-mono"
              />
            </Field>
            <Field label="Country allow-list" htmlFor="net-country" description="ISO-3166 alpha-2 codes, comma separated. Empty means every country.">
              <Input
                id="net-country"
                value={draft.network.countryAllowlist.join(', ')}
                onChange={(event) =>
                  setNetwork({
                    countryAllowlist: event.target.value
                      .split(',')
                      .map((value) => value.trim().toUpperCase())
                      .filter(Boolean),
                  })
                }
                placeholder="US, DE, AE"
              />
            </Field>
            <Switch
              id="net-tor"
              checked={draft.network.blockTorExitNodes}
              onCheckedChange={(checked) => setNetwork({ blockTorExitNodes: checked })}
              label="Block known Tor exit nodes"
              description="A list this build does not hold or refresh. The switch records the intent only."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data governance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-end">
              <Switch
                id="gov-approval"
                checked={draft.dataGovernance.exportRequiresApproval}
                onCheckedChange={(checked) => setGovernance({ exportRequiresApproval: checked })}
                label="Exports require approval"
                description="Recorded as policy; the export pipeline does not currently gate on it here."
              />
            </div>
            <div className="flex items-end">
              <Switch
                id="gov-mask"
                checked={draft.dataGovernance.maskSensitiveFieldsForNonAdmins}
                onCheckedChange={(checked) => setGovernance({ maskSensitiveFieldsForNonAdmins: checked })}
                label="Mask sensitive fields for non-administrators"
                description="Matches how the seeded dataset already presents masked values."
              />
            </div>
            <Field label="Audit retention (days)" htmlFor="gov-audit" hint="30–3650. Also shown on the retention policy under Data management.">
              <Input
                id="gov-audit"
                inputMode="numeric"
                value={String(draft.dataGovernance.auditRetentionDays)}
                onChange={(event) => setGovernance({ auditRetentionDays: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="Record retention (years)" htmlFor="gov-record" hint="1–25.">
              <Input
                id="gov-record"
                inputMode="numeric"
                value={String(draft.dataGovernance.recordRetentionYears)}
                onChange={(event) => setGovernance({ recordRetentionYears: Number(event.target.value) || 0 })}
              />
            </Field>
            <div className="sm:col-span-2">
              <DemoNotice tone="neutral">
                Retention is a recorded intention in this build. No archival job, anonymisation routine or deletion scheduler runs,
                and the Data management screen says the same.
              </DemoNotice>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <KeyRound className="size-4 text-subtle" aria-hidden />
            <CardTitle>Where these values are stored</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-muted">
              The policy is derived from the seeded records (who has MFA, the tenant’s tier) and any change is kept in this browser
              under the <span className="font-mono text-[0.6875rem]">crm.demo.</span> namespace. “Reset demo data” under Data
              management clears it and returns the derived baseline.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================= audit log */

const AUDIT_CATEGORIES = [
  { value: 'all', label: 'All activity' },
  { value: 'record', label: 'Records' },
  { value: 'permission', label: 'Permissions' },
  { value: 'export', label: 'Exports' },
  { value: 'workflow', label: 'Automation' },
  { value: 'integration', label: 'Integrations' },
  { value: 'user', label: 'Users' },
  { value: 'role', label: 'Roles' },
  { value: 'layout', label: 'Layouts' },
  { value: 'field', label: 'Fields' },
];

const SEVERITY_TONES: Record<AuditEvent['severity'], 'slate' | 'blue' | 'amber' | 'red'> = {
  info: 'slate',
  notice: 'blue',
  warning: 'amber',
  critical: 'red',
};

export function AuditLogScreen() {
  const services = useServices();
  const active = useActiveOrganization();
  const users = useList(() => services.users.list({ pageSize: 200 }), []);

  const [search, setSearch] = React.useState('');
  const [severity, setSeverity] = React.useState('all');
  const [category, setCategory] = React.useState('all');
  const [actorId, setActorId] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [detail, setDetail] = React.useState<AuditEvent | null>(null);
  const [from, setFrom] = React.useState(EXPORT_FROM_DEFAULT);
  const [to, setTo] = React.useState(EXPORT_TO_DEFAULT);

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 50,
      q: search || undefined,
      severity: severity === 'all' ? undefined : severity,
      category: category === 'all' ? undefined : category,
      actorId: actorId === 'all' ? undefined : actorId,
      sort: [{ field: 'at', direction: 'desc' as const }],
    }),
    [page, search, severity, category, actorId],
  );

  const events = useList(() => services.security.auditEvents(query), [JSON.stringify(query)]);

  const exportEvents = useMutation((range: { from: string; to: string }) => services.security.exportAuditEvents(range.from, range.to), {
    onSuccess: (result) => {
      notify.simulated(
        'Audit export recorded',
        `${formatNumber(result.rowCount)} events matched the range. The request is recorded in the log; this build does not produce a downloadable file from it.`,
      );
    },
  });

  const scopedUsers = users.items.filter((user) => user.organizationIds.includes(active.activeId));

  const columns = React.useMemo<ColumnDef<AuditEvent, unknown>[]>(
    () => [
      {
        id: 'at',
        header: 'When',
        accessorKey: 'at',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.at)}</span>,
      },
      {
        id: 'actor',
        header: 'Actor',
        accessorKey: 'actorLabel',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs text-fg">{row.original.actorLabel}</span>
            <span className="mt-0.5 block text-[0.625rem] text-faint">{row.original.actorType}</span>
          </div>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        accessorKey: 'action',
        cell: ({ row }) => <span className="font-mono text-[0.6875rem] text-fg">{row.original.action}</span>,
      },
      {
        id: 'resource',
        header: 'Resource',
        accessorKey: 'resourceLabel',
        cell: ({ row }) => <span className="truncate text-[0.6875rem] text-muted">{row.original.resourceLabel}</span>,
      },
      {
        id: 'outcome',
        header: 'Outcome',
        accessorKey: 'outcome',
        cell: ({ row }) => <StatusBadge status={row.original.outcome} size="sm" />,
      },
      {
        id: 'severity',
        header: 'Severity',
        accessorKey: 'severity',
        cell: ({ row }) => (
          <TonePill tone={SEVERITY_TONES[row.original.severity]} className="text-2xs">
            {row.original.severity}
          </TonePill>
        ),
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Audit log"
        description="Who did what, when — read from the seeded audit records and any configuration change made in this browser."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Audit log' }]}
        tabs={<SettingsPageNav />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={exportEvents.pending}
            onClick={() => void exportEvents.run({ from, to })}
            leadingIcon={<Download className="size-3.5" />}
          >
            Record an export
          </Button>
        }
      />

      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <Alert tone="warning" title="This is a demonstration log, not an audit trail">
          The entries are local records: seeded synthetic events plus any configuration change this browser made. A real audit trail
          would be written server-side, append-only and tamper-evident. Nothing here is any of those things.
        </Alert>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Field label="Search" htmlFor="audit-search">
              <Input id="audit-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Action, resource or actor" />
            </Field>
          </div>
          <Field label="Severity" htmlFor="audit-severity" className="w-[10rem]">
            <Select
              id="audit-severity"
              value={severity}
              onValueChange={(value) => { setSeverity(value); setPage(1); }}
              options={[{ value: 'all', label: 'All severities' }, ...['info', 'notice', 'warning', 'critical'].map((value) => ({ value, label: value }))]}
              selectSize="sm"
            />
          </Field>
          <Field label="Category" htmlFor="audit-category" className="w-[12rem]">
            <Select id="audit-category" value={category} onValueChange={(value) => { setCategory(value); setPage(1); }} options={AUDIT_CATEGORIES} selectSize="sm" />
          </Field>
          <Field label="Actor" htmlFor="audit-actor" className="w-[13rem]">
            <Select
              id="audit-actor"
              value={actorId}
              onValueChange={(value) => { setActorId(value); setPage(1); }}
              options={[{ value: 'all', label: 'Everyone' }, ...scopedUsers.map((user) => ({ value: user.id, label: user.displayName }))]}
              selectSize="sm"
              searchable
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border-subtle bg-surface p-3">
          <Field label="Export from" htmlFor="audit-from" className="w-[10rem]">
            <Input id="audit-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="Export to" htmlFor="audit-to" className="w-[10rem]">
            <Input id="audit-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <p className="max-w-md text-[0.6875rem] leading-relaxed text-faint">
            Recording an export writes an entry to this log with the range you choose. No file is generated and nothing is emailed.
          </p>
        </div>

        {events.loading ? (
          <ListSkeleton rows={12} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={events.items}
            getRowId={(event) => event.id}
            onRowClick={(event) => setDetail(event)}
            emptyState={
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-fg">No audit events match this view</p>
                <p className="mt-1 text-xs text-muted">Adjust the filters, or clear the search.</p>
              </div>
            }
          />
        )}

        <p className="text-[0.6875rem] text-faint">
          Showing {formatNumber(events.items.length)} of {formatNumber(events.meta?.total ?? 0)} events. Select a row for the change
          detail.
        </p>
      </div>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          title={detail?.action ?? 'Audit event'}
          description={detail ? `${detail.actorLabel} · ${formatDate(detail.at)}` : undefined}
          size="md"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setDetail(null)}>
              Close
            </Button>
          }
        >
          {detail ? (
            <div className="space-y-4">
              <dl className="grid gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
                {[
                  { label: 'Resource', value: detail.resourceLabel },
                  { label: 'Resource key', value: detail.resource },
                  { label: 'Outcome', value: detail.outcome },
                  { label: 'Severity', value: detail.severity },
                  { label: 'IP address', value: detail.ipAddressMasked ?? 'Not recorded' },
                  { label: 'Client', value: detail.userAgent ?? 'Not recorded' },
                ].map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="text-2xs font-medium uppercase tracking-wide text-faint">{fact.label}</dt>
                    <dd className="mt-0.5 truncate font-medium text-fg">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="text-xs font-medium text-fg">Changes</p>
                {detail.changes && detail.changes.length > 0 ? (
                  <TableWrap className="mt-2">
                    <thead>
                      <tr>
                        <Th>Field</Th>
                        <Th>Before</Th>
                        <Th>After</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.changes.map((change, index) => (
                        <Tr key={`${change.field}-${index}`}>
                          <Td>
                            <span className="font-mono text-[0.6875rem] text-fg">{change.field}</span>
                          </Td>
                          <Td>
                            <span className="text-[0.6875rem] text-muted">{change.before ?? '—'}</span>
                          </Td>
                          <Td>
                            <span className="text-[0.6875rem] text-muted">
                              {change.after ?? '—'}
                              {change.masked ? ' (masked)' : ''}
                            </span>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </TableWrap>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    No field-level diff was recorded for this event. A real trail would include one for every write.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
