'use client';

import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, Save, Trash2 } from 'lucide-react';
import type { Organization, OrgNode, Team } from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  IconButton,
  Input,
  MultiSelect,
  Select,
  StatusBadge,
  Switch,
  Textarea,
  cn,
  focusRing,
  notify,
} from '@crm/ui';
import { ListSkeleton, PageHeader, RecordEmptyState, RecordErrorState, formatDate, formatNumber, initialsOf } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Organization administration: company profile and branding, business units and teams, and the
 * user directory.
 *
 * Three honesty constraints shape this file:
 *
 *   - **Nothing here provisions anyone.** Invitations are recorded locally and the record itself
 *     carries `deliverySimulated`; no email leaves the browser, and the invitation dialog says so
 *     before the button is pressed.
 *   - **Branding is a configuration override, not asset hosting.** The logo field is a URL
 *     placeholder because no file storage is connected; the preview mark is generated from the
 *     company initials rather than pretending an upload happened.
 *   - **The company profile form addresses the organisation the mock resolves**, and the note on
 *     the screen states which one that is, so switching organisations through the shell cannot
 *     quietly show one tenant’s name under another’s records.
 */

/* --------------------------------------------------------------- settings nav */

const SETTINGS_LINKS: Array<{ to: string; label: string }> = [
  { to: '/app/settings/organization', label: 'Organization' },
  { to: '/app/settings/business-units', label: 'Business units & teams' },
  { to: '/app/settings/users', label: 'Users' },
  { to: '/app/settings/roles', label: 'Roles & permissions' },
  { to: '/app/settings/security', label: 'Security' },
  { to: '/app/settings/data', label: 'Data management' },
  { to: '/app/settings/billing', label: 'Billing' },
  { to: '/app/settings/help', label: 'Help' },
];

/** Tab-strip navigation shared by every settings screen. */
export function SettingsPageNav() {
  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-x-4 gap-y-1">
      {SETTINGS_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              '-mb-px whitespace-nowrap border-b-2 px-0.5 pb-2 text-xs font-medium',
              isActive ? 'border-brand text-fg' : 'border-transparent text-muted hover:text-fg',
              focusRing,
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * The organization the review is currently looking at.
 *
 * Built from the signed-in user’s `activeOrganizationId` because that is what the record lists
 * scope by. The settings services follow the same rule, so the header an administrator sees and
 * the data underneath it cannot disagree.
 */
export function useActiveOrganization() {
  const services = useServices();
  const user = useAsync(() => services.tenant.currentUser(), []);
  const organizations = useList(() => services.tenant.organizations(), []);
  const activeId = user.data?.activeOrganizationId ?? organizations.items[0]?.id ?? '';
  const active = organizations.items.find((organization) => organization.id === activeId);
  return {
    activeId,
    active,
    organizations: organizations.items,
    user: user.data,
    loading: user.loading || organizations.loading,
  };
}

/* -------------------------------------------------------------- catalogues */

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
  { value: 'nl', label: 'Nederlands' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'CHF', 'CAD', 'AUD'].map((value) => ({ value, label: value }));

const TIMEZONES = [
  'America/Chicago',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
].map((value) => ({ value, label: value.replace(/_/g, ' ') }));

const COUNTRIES = ['US', 'DE', 'GB', 'AE', 'FR', 'NL', 'CA', 'AU', 'SG'].map((value) => ({ value, label: value }));

const COMPANY_SIZES: Array<{ value: Organization['companySize']; label: string }> = [
  { value: 'solo', label: 'Solo' },
  { value: '2-10', label: '2–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1,000' },
  { value: '1001-5000', label: '1,001–5,000' },
  { value: '5000+', label: '5,000+' },
];

const INDUSTRIES = [
  { value: 'technology_saas', label: 'Technology / SaaS' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'wholesale_distribution', label: 'Wholesale & distribution' },
  { value: 'professional_services', label: 'Professional services' },
  { value: 'financial_services', label: 'Financial services' },
  { value: 'healthcare', label: 'Healthcare' },
];

/** Accent presets the shell already understands. No design-token rewrite happens here. */
const ACCENT_PRESETS = [
  { value: 'violet', label: 'Violet' },
  { value: 'teal', label: 'Teal' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'amber', label: 'Amber' },
  { value: 'slate', label: 'Slate' },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/* ================================================== company profile & branding */

interface ProfileValues {
  name: string;
  legalName: string;
  shortName: string;
  countryCode: string;
  industryId: string;
  companySize: Organization['companySize'];
  taxId: string;
  defaultLocale: string;
  defaultTimezone: string;
  defaultCurrency: string;
}

interface BrandingValues {
  productDisplayName: string;
  accentPresetId: string;
  logoUrl: string;
  defaultTheme: Organization['branding']['defaultTheme'];
  defaultDensity: Organization['branding']['defaultDensity'];
  loginBackgroundStyle: Organization['branding']['loginBackgroundStyle'];
}

export function OrganizationScreen() {
  const services = useServices();
  const organization = useAsync(() => services.organization.get(), []);
  const active = useActiveOrganization();

  // Both forms are controlled from the first render: the fields are seeded with these
  // placeholders and then reset to the record, so a `Select` never switches between
  // uncontrolled and controlled while the organization loads.
  const profile = useForm<ProfileValues>({
    mode: 'onBlur',
    defaultValues: {
      name: '',
      legalName: '',
      shortName: '',
      countryCode: '',
      industryId: '',
      companySize: '11-50',
      taxId: '',
      defaultLocale: 'en-US',
      defaultTimezone: 'UTC',
      defaultCurrency: 'USD',
    },
  });
  const branding = useForm<BrandingValues>({
    mode: 'onBlur',
    defaultValues: {
      productDisplayName: '',
      accentPresetId: 'violet',
      logoUrl: '',
      defaultTheme: 'system',
      defaultDensity: 'comfortable',
      loginBackgroundStyle: 'mesh',
    },
  });
  const [startMonth, setStartMonth] = React.useState('1');
  const [weekStartsOn, setWeekStartsOn] = React.useState('1');

  React.useEffect(() => {
    if (!organization.data) return;
    const record = organization.data;
    profile.reset({
      name: record.name,
      legalName: record.legalName ?? '',
      shortName: record.shortName ?? '',
      countryCode: record.countryCode,
      industryId: record.industryId,
      companySize: record.companySize,
      taxId: record.taxId ?? '',
      defaultLocale: record.defaultLocale,
      defaultTimezone: record.defaultTimezone,
      defaultCurrency: record.defaultCurrency,
    });
    branding.reset({
      productDisplayName: record.branding.productDisplayName ?? '',
      accentPresetId: record.branding.accentPresetId ?? 'violet',
      logoUrl: record.branding.logoUrl ?? '',
      defaultTheme: record.branding.defaultTheme ?? 'system',
      defaultDensity: record.branding.defaultDensity ?? 'comfortable',
      loginBackgroundStyle: record.branding.loginBackgroundStyle ?? 'mesh',
    });
    setStartMonth(String(record.fiscalYearStartMonth));
    setWeekStartsOn(String(record.weekStartsOn));
  }, [organization.data, profile, branding]);

  const saveProfile = useMutation((values: ProfileValues) => services.organization.update({ ...values }), {
    successMessage: 'Company profile saved.',
    onSuccess: () => organization.reload(),
  });
  const saveBranding = useMutation(
    (values: BrandingValues) =>
      services.organization.updateBranding({
        productDisplayName: values.productDisplayName || undefined,
        accentPresetId: values.accentPresetId || undefined,
        logoUrl: values.logoUrl || undefined,
        defaultTheme: values.defaultTheme,
        defaultDensity: values.defaultDensity,
        loginBackgroundStyle: values.loginBackgroundStyle,
      }),
    { successMessage: 'Branding saved.', onSuccess: () => organization.reload() },
  );
  const saveFiscalYear = useMutation(
    (values: { startMonth: number; weekStartsOn: 0 | 1 | 6 }) => services.organization.fiscalYear(values),
    { successMessage: 'Fiscal year updated.', onSuccess: () => organization.reload() },
  );

  const record = organization.data;
  const profileValues = profile.watch();
  const brandingValues = branding.watch();
  const profileDirty = profile.formState.isDirty;
  const brandingDirty = branding.formState.isDirty;
  const fiscalDirty = Boolean(record) && (String(record?.fiscalYearStartMonth) !== startMonth || String(record?.weekStartsOn) !== weekStartsOn);

  if (organization.loading) return <ListSkeleton rows={12} columns={3} />;
  if (organization.error || !record) {
    return (
      <div className="pb-8">
        <PageHeader title="Organization" tabs={<SettingsPageNav />} />
        <div className="p-4 sm:p-6">
          <RecordErrorState message={organization.error ?? 'The organization could not be loaded.'} onRetry={organization.reload} />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Organization"
        description="The company profile, branding overrides and fiscal calendar every screen reads from."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Organization' }]}
        tabs={<SettingsPageNav />}
      />

      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <Alert tone="info" title="This is configuration, not a signed record">
          The profile below is editable in this browser only. No provisioning system, file storage or certificate authority is
          connected, so nothing here changes how the product is deployed.
        </Alert>

        {active.active && active.active.id !== record.id ? (
          <DemoNotice tone="warning">
            You are viewing records for <span className="font-medium">{active.active.name}</span>, but this demonstration resolves the
            company profile from <span className="font-medium">{record.name}</span> (the first seeded organization). Profile edits apply
            to {record.name}; the record lists follow the organization switcher. This limitation is disclosed rather than hidden.
          </DemoNotice>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Company profile</CardTitle>
            {profileDirty ? <Badge variant="warning" size="sm">Unsaved changes</Badge> : null}
          </CardHeader>
          <CardContent>
            <form
              id="organization-profile-form"
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={profile.handleSubmit((values) => {
                void saveProfile.run(values);
              })}
            >
              <Field label="Company name" htmlFor="org-name" required className="sm:col-span-2" error={profile.formState.errors.name ? 'A company name is required.' : undefined}>
                <Input id="org-name" {...profile.register('name', { required: true })} />
              </Field>
              <Field label="Legal name" htmlFor="org-legal-name" hint="Shown on invoices and contracts.">
                <Input id="org-legal-name" {...profile.register('legalName')} />
              </Field>
              <Field label="Short name" htmlFor="org-short-name" hint="Used in the organization switcher.">
                <Input id="org-short-name" {...profile.register('shortName')} />
              </Field>
              <Field label="Tax identifier" htmlFor="org-tax-id" hint="Recorded for reference only. No tax calculation is performed.">
                <Input id="org-tax-id" {...profile.register('taxId')} />
              </Field>
              <Field label="Country" htmlFor="org-country">
                <Select
                  id="org-country"
                  value={profileValues.countryCode}
                  onValueChange={(value) => profile.setValue('countryCode', value, { shouldDirty: true })}
                  options={COUNTRIES}
                />
              </Field>
              <Field label="Industry" htmlFor="org-industry">
                <Select
                  id="org-industry"
                  value={profileValues.industryId}
                  onValueChange={(value) => profile.setValue('industryId', value, { shouldDirty: true })}
                  options={
                    INDUSTRIES.some((entry) => entry.value === profileValues.industryId)
                      ? INDUSTRIES
                      : [...INDUSTRIES, { value: profileValues.industryId, label: profileValues.industryId }]
                  }
                />
              </Field>
              <Field label="Company size" htmlFor="org-size">
                <Select
                  id="org-size"
                  value={profileValues.companySize}
                  onValueChange={(value) => profile.setValue('companySize', value as Organization['companySize'], { shouldDirty: true })}
                  options={COMPANY_SIZES.map((entry) => ({ value: entry.value, label: entry.label }))}
                />
              </Field>
              <Field label="Default locale" htmlFor="org-locale" hint="Drives date and number formatting.">
                <Select
                  id="org-locale"
                  value={profileValues.defaultLocale}
                  onValueChange={(value) => profile.setValue('defaultLocale', value, { shouldDirty: true })}
                  options={LOCALES}
                />
              </Field>
              <Field label="Default currency" htmlFor="org-currency" hint="Records carry their own currency; this is the default for new ones.">
                <Select
                  id="org-currency"
                  value={profileValues.defaultCurrency}
                  onValueChange={(value) => profile.setValue('defaultCurrency', value, { shouldDirty: true })}
                  options={CURRENCIES}
                />
              </Field>
              <Field label="Timezone" htmlFor="org-timezone">
                <Select
                  id="org-timezone"
                  value={profileValues.defaultTimezone}
                  onValueChange={(value) => profile.setValue('defaultTimezone', value, { shouldDirty: true })}
                  options={TIMEZONES}
                  searchable
                />
              </Field>
            </form>
          </CardContent>
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <p className="text-2xs text-faint">
              National, VAT and registration numbers are recorded for reference. No tax or e-invoicing service is connected.
            </p>
            <Button
              type="submit"
              form="organization-profile-form"
              variant="primary"
              size="sm"
              loading={saveProfile.pending}
              disabled={!profileDirty}
              leadingIcon={<Save className="size-3.5" />}
            >
              Save profile
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Branding</CardTitle>
            {brandingDirty ? <Badge variant="warning" size="sm">Unsaved changes</Badge> : null}
          </CardHeader>
          <CardContent>
            <form
              id="organization-branding-form"
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={branding.handleSubmit((values) => {
                void saveBranding.run(values);
              })}
            >
              <Field label="Product display name" htmlFor="brand-product" className="sm:col-span-2" hint="Shown in the sidebar and on the sign-in screen.">
                <Input id="brand-product" {...branding.register('productDisplayName')} placeholder={record.name} />
              </Field>
              <Field label="Logo URL" htmlFor="brand-logo" className="sm:col-span-2" description="No upload storage is connected in this build, so a URL is the only option. Leaving it empty shows a generated initial mark.">
                <Input id="brand-logo" {...branding.register('logoUrl')} placeholder="https://" inputMode="url" />
              </Field>
              <Field label="Preview" className="sm:col-span-2">
                <div id="brand-mark" className="flex items-center gap-3 rounded-md border border-border-subtle bg-inset p-3">
                  {brandingValues.logoUrl ? (
                    <img src={brandingValues.logoUrl} alt="" className="size-9 rounded-md border border-border-subtle object-contain" />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-md bg-brand-subtle text-xs font-semibold text-brand-fg" aria-hidden>
                      {initialsOf(record.name)}
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {brandingValues.logoUrl
                      ? 'Loaded from the URL above. If the host is unreachable the browser shows its own broken-image state.'
                      : `${initialsOf(record.name)} is generated from the company name — nothing was uploaded.`}
                  </span>
                </div>
              </Field>
              <Field label="Accent preset" htmlFor="brand-accent">
                <Select
                  id="brand-accent"
                  value={brandingValues.accentPresetId}
                  onValueChange={(value) => branding.setValue('accentPresetId', value, { shouldDirty: true })}
                  options={ACCENT_PRESETS}
                />
              </Field>
              <Field label="Default theme" htmlFor="brand-theme">
                <Select
                  id="brand-theme"
                  value={brandingValues.defaultTheme ?? 'system'}
                  onValueChange={(value) => branding.setValue('defaultTheme', value as Organization['branding']['defaultTheme'], { shouldDirty: true })}
                  options={[
                    { value: 'system', label: 'Follow the operating system' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </Field>
              <Field label="Default density" htmlFor="brand-density">
                <Select
                  id="brand-density"
                  value={brandingValues.defaultDensity ?? 'comfortable'}
                  onValueChange={(value) => branding.setValue('defaultDensity', value as Organization['branding']['defaultDensity'], { shouldDirty: true })}
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                    { value: 'spacious', label: 'Spacious' },
                  ]}
                />
              </Field>
              <Field label="Sign-in background" htmlFor="brand-background">
                <Select
                  id="brand-background"
                  value={brandingValues.loginBackgroundStyle ?? 'mesh'}
                  onValueChange={(value) => branding.setValue('loginBackgroundStyle', value as Organization['branding']['loginBackgroundStyle'], { shouldDirty: true })}
                  options={[
                    { value: 'brand', label: 'Brand colour' },
                    { value: 'mesh', label: 'Generated mesh' },
                    { value: 'solid', label: 'Solid surface' },
                    { value: 'photo_placeholder', label: 'Photograph placeholder' },
                  ]}
                />
              </Field>
            </form>
          </CardContent>
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <p className="text-2xs text-faint">Branding is stored as an organization override. The design tokens themselves are not rewritten.</p>
            <Button
              type="submit"
              form="organization-branding-form"
              variant="primary"
              size="sm"
              loading={saveBranding.pending}
              disabled={!brandingDirty}
              leadingIcon={<Save className="size-3.5" />}
            >
              Save branding
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fiscal year</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fiscal year starts" htmlFor="fiscal-month" hint="Used for quotas, forecasts and reports.">
                <Select
                  id="fiscal-month"
                  value={startMonth}
                  onValueChange={setStartMonth}
                  options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
                />
              </Field>
              <Field label="Week starts on" htmlFor="fiscal-week">
                <Select
                  id="fiscal-week"
                  value={weekStartsOn}
                  onValueChange={setWeekStartsOn}
                  options={[
                    { value: '0', label: 'Sunday' },
                    { value: '1', label: 'Monday' },
                    { value: '6', label: 'Saturday' },
                  ]}
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                loading={saveFiscalYear.pending}
                disabled={!fiscalDirty}
                onClick={() => void saveFiscalYear.run({ startMonth: Number(startMonth), weekStartsOn: Number(weekStartsOn) as 0 | 1 | 6 })}
                leadingIcon={<Save className="size-3.5" />}
              >
                Save fiscal year
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Read-only facts</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
              {[
                { label: 'Organization id', value: record.id },
                { label: 'Slug', value: record.slug },
                { label: 'Data region', value: record.dataRegion ?? '—' },
                { label: 'Modules enabled', value: formatNumber(record.enabledModuleKeys.length) },
                { label: 'Created', value: formatDate(record.createdAt) },
                { label: 'Last updated', value: formatDate(record.updatedAt, 'relative') },
              ].map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-2xs font-medium uppercase tracking-wide text-faint">{fact.label}</dt>
                  <dd className="mt-0.5 truncate font-medium text-fg">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-fg">Registered address</p>
              {record.addresses.length === 0 ? (
                <p className="text-xs text-muted">No address is recorded.</p>
              ) : (
                <ul className="space-y-1 text-xs text-muted">
                  {record.addresses.map((address, index) => (
                    <li key={address.id ?? index}>
                      {[address.line1, address.city, address.postalCode, address.countryCode].filter(Boolean).join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================================== business units & teams */

const NODE_KINDS: Array<{ value: OrgNode['kind']; label: string }> = [
  { value: 'branch', label: 'Branch' },
  { value: 'region', label: 'Region' },
  { value: 'division', label: 'Division' },
  { value: 'team', label: 'Team' },
];

const TEAM_KINDS: Array<{ value: Team['kind']; label: string }> = [
  { value: 'sales', label: 'Sales' },
  { value: 'service', label: 'Service' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'success', label: 'Customer success' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'field', label: 'Field' },
  { value: 'custom', label: 'Custom' },
];

interface OrgNodeDraft {
  kind: OrgNode['kind'];
  name: string;
  code: string;
  countryCode: string;
  managerId: string;
  memberCount: string;
  fiscalYearStartMonth: string;
  currency: string;
}

function OrgNodeForm({
  initial,
  title,
  description,
  pending,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<OrgNodeDraft>;
  title: string;
  description: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (draft: OrgNodeDraft) => void;
}) {
  const [draft, setDraft] = React.useState<OrgNodeDraft>({
    kind: initial?.kind ?? 'branch',
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    countryCode: initial?.countryCode ?? '',
    managerId: initial?.managerId ?? '',
    memberCount: initial?.memberCount ?? '0',
    fiscalYearStartMonth: initial?.fiscalYearStartMonth ?? '',
    currency: initial?.currency ?? '',
  });
  const services = useServices();
  const users = useList(() => services.users.list({ pageSize: 200 }), []);
  const active = useActiveOrganization();
  const members = users.items.filter((user) => user.organizationIds.includes(active.activeId));

  const set = <K extends keyof OrgNodeDraft>(key: K, value: OrgNodeDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form
      id="org-node-form"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.name.trim()) {
          notify.warning('A node name is required.');
          return;
        }
        onSubmit(draft);
      }}
    >
      <p className="text-xs text-muted">{description}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kind" htmlFor="node-kind">
          <Select id="node-kind" value={draft.kind} onValueChange={(value) => set('kind', value as OrgNode['kind'])} options={NODE_KINDS} />
        </Field>
        <Field label="Name" htmlFor="node-name" required>
          <Input id="node-name" value={draft.name} onChange={(event) => set('name', event.target.value)} autoFocus />
        </Field>
        <Field label="Code" htmlFor="node-code" hint="Optional short label, e.g. HQ or EMEA.">
          <Input id="node-code" value={draft.code} onChange={(event) => set('code', event.target.value)} />
        </Field>
        <Field label="Country" htmlFor="node-country">
          <Select
            id="node-country"
            value={draft.countryCode}
            onValueChange={(value) => set('countryCode', value)}
            options={[{ value: '', label: 'Not set' }, ...COUNTRIES]}
          />
        </Field>
        <Field label="Manager" htmlFor="node-manager">
          <Select
            id="node-manager"
            value={draft.managerId}
            onValueChange={(value) => set('managerId', value)}
            options={[{ value: '', label: 'Not assigned' }, ...members.map((user) => ({ value: user.id, label: user.displayName }))]}
            searchable
          />
        </Field>
        <Field label="Members" htmlFor="node-members" hint="A count for reporting; membership is managed per user.">
          <Input id="node-members" inputMode="numeric" value={draft.memberCount} onChange={(event) => set('memberCount', event.target.value)} />
        </Field>
        <Field label="Fiscal year override" htmlFor="node-fiscal" hint="Optional. For entities reporting on a different cycle.">
          <Select
            id="node-fiscal"
            value={draft.fiscalYearStartMonth}
            onValueChange={(value) => set('fiscalYearStartMonth', value)}
            options={[{ value: '', label: 'Inherit from the organization' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
          />
        </Field>
        <Field label="Currency override" htmlFor="node-currency">
          <Select
            id="node-currency"
            value={draft.currency}
            onValueChange={(value) => set('currency', value)}
            options={[{ value: '', label: 'Inherit from the organization' }, ...CURRENCIES]}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={pending} form="org-node-form">
          {title}
        </Button>
      </div>
    </form>
  );
}

interface TeamDraft {
  name: string;
  kind: Team['kind'];
  description: string;
  managerId: string;
  isShared: boolean;
  parentTeamId: string;
}

function TeamForm({
  initial,
  pending,
  onCancel,
  onSubmit,
  parentOptions,
}: {
  initial?: Partial<TeamDraft>;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (draft: TeamDraft) => void;
  parentOptions: Array<{ value: string; label: string }>;
}) {
  const [draft, setDraft] = React.useState<TeamDraft>({
    name: initial?.name ?? '',
    kind: initial?.kind ?? 'sales',
    description: initial?.description ?? '',
    managerId: initial?.managerId ?? '',
    isShared: initial?.isShared ?? true,
    parentTeamId: initial?.parentTeamId ?? '',
  });
  const services = useServices();
  const users = useList(() => services.users.list({ pageSize: 200 }), []);
  const active = useActiveOrganization();
  const members = users.items.filter((user) => user.organizationIds.includes(active.activeId));
  const set = <K extends keyof TeamDraft>(key: K, value: TeamDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form
      id="team-form"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.name.trim()) {
          notify.warning('A team name is required.');
          return;
        }
        onSubmit(draft);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="team-name" required>
          <Input id="team-name" value={draft.name} onChange={(event) => set('name', event.target.value)} autoFocus />
        </Field>
        <Field label="Kind" htmlFor="team-kind">
          <Select id="team-kind" value={draft.kind} onValueChange={(value) => set('kind', value as Team['kind'])} options={TEAM_KINDS} />
        </Field>
        <Field label="Manager" htmlFor="team-manager">
          <Select
            id="team-manager"
            value={draft.managerId}
            onValueChange={(value) => set('managerId', value)}
            options={[{ value: '', label: 'Not assigned' }, ...members.map((user) => ({ value: user.id, label: user.displayName }))]}
            searchable
          />
        </Field>
        <Field label="Parent team" htmlFor="team-parent">
          <Select
            id="team-parent"
            value={draft.parentTeamId}
            onValueChange={(value) => set('parentTeamId', value)}
            options={[{ value: '', label: 'No parent team' }, ...parentOptions]}
          />
        </Field>
        <Field label="Description" htmlFor="team-description" className="sm:col-span-2">
          <Textarea id="team-description" rows={2} value={draft.description} onChange={(event) => set('description', event.target.value)} />
        </Field>
      </div>
      <Switch
        id="team-shared"
        checked={draft.isShared}
        onCheckedChange={(checked) => set('isShared', checked)}
        label="Shared team"
        description="Shared teams expose their records to the whole organization rather than only their members."
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={pending} form="team-form">
          Save team
        </Button>
      </div>
    </form>
  );
}

export function BusinessUnitsScreen() {
  const services = useServices();
  const hierarchy = useAsync(() => services.organization.hierarchy(), []);
  const teams = useList(() => services.users.teams(), []);
  const active = useActiveOrganization();

  const [nodeDialog, setNodeDialog] = React.useState<
    { key: string; mode: 'create'; parentId?: string } | { key: string; mode: 'edit'; node: OrgNode } | null
  >(null);
  const [teamDialog, setTeamDialog] = React.useState<{ key: string; team?: Team } | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<OrgNode | null>(null);

  const nodes = hierarchy.data ?? [];
  const scopedTeams = teams.items.filter((team) => team.organizationId === active.activeId);

  const createNode = useMutation(
    (input: { draft: OrgNodeDraft; parentId?: string }) =>
      services.organization.createOrgNode({
        parentId: input.parentId,
        kind: input.draft.kind,
        name: input.draft.name.trim(),
        code: input.draft.code.trim() || undefined,
        countryCode: input.draft.countryCode || undefined,
        managerId: input.draft.managerId || undefined,
        memberCount: Number(input.draft.memberCount) || 0,
        fiscalYearStartMonth: input.draft.fiscalYearStartMonth ? Number(input.draft.fiscalYearStartMonth) : undefined,
        currency: input.draft.currency || undefined,
      }),
    { successMessage: 'Business unit added.', onSuccess: () => { setNodeDialog(null); hierarchy.reload(); } },
  );
  const updateNode = useMutation(
    (input: { id: string; draft: OrgNodeDraft }) =>
      services.organization.updateOrgNode(input.id, {
        kind: input.draft.kind,
        name: input.draft.name.trim(),
        code: input.draft.code.trim() || undefined,
        countryCode: input.draft.countryCode || undefined,
        managerId: input.draft.managerId || undefined,
        memberCount: Number(input.draft.memberCount) || 0,
        fiscalYearStartMonth: input.draft.fiscalYearStartMonth ? Number(input.draft.fiscalYearStartMonth) : undefined,
        currency: input.draft.currency || undefined,
      }),
    { successMessage: 'Business unit updated.', onSuccess: () => { setNodeDialog(null); hierarchy.reload(); } },
  );
  const removeNode = useMutation((id: string) => services.organization.removeOrgNode(id), {
    successMessage: 'Business unit removed.',
    onSuccess: () => { setConfirmRemove(null); hierarchy.reload(); },
  });
  const createTeam = useMutation(
    (draft: TeamDraft) =>
      services.users.createTeam({
        organizationId: active.activeId,
        name: draft.name.trim(),
        kind: draft.kind,
        description: draft.description.trim() || undefined,
        managerId: draft.managerId || undefined,
        memberIds: [],
        memberRoles: [],
        parentTeamId: draft.parentTeamId || undefined,
        isShared: draft.isShared,
      }),
    { successMessage: 'Team created.', onSuccess: () => { setTeamDialog(null); teams.reload(); } },
  );
  const updateTeam = useMutation(
    (input: { id: string; draft: TeamDraft }) =>
      services.users.updateTeam(input.id, {
        name: input.draft.name.trim(),
        kind: input.draft.kind,
        description: input.draft.description.trim() || undefined,
        managerId: input.draft.managerId || undefined,
        parentTeamId: input.draft.parentTeamId || undefined,
        isShared: input.draft.isShared,
      }),
    { successMessage: 'Team updated.', onSuccess: () => { setTeamDialog(null); teams.reload(); } },
  );

  const byParent = new Map<string, OrgNode[]>();
  for (const node of nodes) {
    const key = node.parentId ?? '';
    byParent.set(key, [...(byParent.get(key) ?? []), node]);
  }
  const users = useList(() => services.users.list({ pageSize: 200 }), []);
  const managerName = (managerId: string | undefined): string =>
    managerId ? (users.items.find((user) => user.id === managerId)?.displayName ?? 'Unknown user') : 'Not assigned';

  const renderNodes = (parentId: string): React.ReactNode => {
    const children = byParent.get(parentId) ?? [];
    if (children.length === 0) return null;
    return (
      <ul className="space-y-1.5">
        {children.map((node) => (
          <li key={node.id}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border-subtle bg-surface px-3 py-2">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Badge variant="outline" size="sm">
                  {NODE_KINDS.find((kind) => kind.value === node.kind)?.label ?? node.kind}
                </Badge>
                <span className="truncate text-xs font-medium text-fg">{node.name}</span>
                {node.code ? <span className="rounded border border-border-subtle bg-inset px-1 py-0.5 font-mono text-[0.625rem] text-subtle">{node.code}</span> : null}
              </span>
              <span className="text-[0.6875rem] text-muted">
                {node.countryCode ?? '—'} · {formatNumber(node.memberCount)} members · {managerName(node.managerId)}
                {node.currency ? ` · ${node.currency}` : ''}
                {node.fiscalYearStartMonth ? ` · FY from ${MONTHS[node.fiscalYearStartMonth - 1] ?? node.fiscalYearStartMonth}` : ''}
              </span>
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="xs" onClick={() => setNodeDialog({ key: `create-${node.id}-${Date.now()}`, mode: 'create', parentId: node.id })} leadingIcon={<Plus className="size-3" />}>
                  Add child
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setNodeDialog({ key: `edit-${node.id}`, mode: 'edit', node })}>
                  Edit
                </Button>
                <IconButton
                  label={`Remove ${node.name}`}
                  icon={<Trash2 />}
                  size="icon-xs"
                  onClick={() => {
                    if ((byParent.get(node.id) ?? []).length > 0) {
                      notify.warning('Move or remove the child units first.', 'A unit with children cannot be removed from here.');
                      return;
                    }
                    setConfirmRemove(node);
                  }}
                />
              </span>
            </div>
            <div className="ms-4 mt-1.5 border-s border-border-subtle ps-3">{renderNodes(node.id)}</div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Business units & teams"
        description="The reporting structure (regions, divisions, branches) and the working teams that sit on top of it."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Business units & teams' }]}
        tabs={<SettingsPageNav />}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setNodeDialog({ key: `create-root-${Date.now()}`, mode: 'create' })}
            leadingIcon={<Plus className="size-3.5" />}
          >
            Add unit
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Reporting structure</CardTitle>
            <span className="text-2xs text-faint">{nodes.length} units</span>
          </CardHeader>
          <CardContent>
            {hierarchy.loading ? (
              <ListSkeleton rows={5} columns={2} />
            ) : hierarchy.error ? (
              <RecordErrorState message={hierarchy.error} onRetry={hierarchy.reload} />
            ) : nodes.length === 0 ? (
              <RecordEmptyState
                title="No business units yet"
                body="A unit groups people and records for reporting. Add a region or division to start."
                primaryAction={{ label: 'Add unit', onClick: () => setNodeDialog({ key: `create-empty-${Date.now()}`, mode: 'create' }) }}
              />
            ) : (
              renderNodes('')
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Teams</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setTeamDialog({ key: `team-${Date.now()}` })} leadingIcon={<Plus className="size-3.5" />}>
              New team
            </Button>
          </CardHeader>
          <CardContent>
            {teams.loading ? (
              <ListSkeleton rows={4} columns={2} />
            ) : scopedTeams.length === 0 ? (
              <RecordEmptyState
                title="No teams in this organization"
                body="Teams scope records and shared views. Create one to group the people who work together."
                primaryAction={{ label: 'New team', onClick: () => setTeamDialog({ key: `team-empty-${Date.now()}` }) }}
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {scopedTeams.map((team) => (
                  <li key={team.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <Badge variant="outline" size="sm">
                      {TEAM_KINDS.find((kind) => kind.value === team.kind)?.label ?? team.kind}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-fg">{team.name}</span>
                      <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                        {team.isShared ? 'Shared with the organization' : 'Private to members'} · {formatNumber(team.memberIds.length)} members · manager {managerName(team.managerId)}
                      </span>
                    </span>
                    <Button variant="ghost" size="xs" onClick={() => setTeamDialog({ key: `team-edit-${team.id}`, team })}>
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <DemoNotice tone="neutral">
          Unit membership counts are recorded figures for reporting; changing membership happens on each user record. No directory
          synchronisation is connected, so this structure exists in the browser only.
        </DemoNotice>
      </div>

      <Dialog open={nodeDialog !== null} onOpenChange={(open) => !open && setNodeDialog(null)}>
        <DialogContent
          title={nodeDialog?.mode === 'edit' ? `Edit ${nodeDialog.node.name}` : 'Add a business unit'}
          description={
            nodeDialog?.mode === 'create' && nodeDialog.parentId
              ? 'The new unit reports to the unit you selected.'
              : 'Units form the reporting tree used by rollups and territory views.'
          }
          size="lg"
        >
          {nodeDialog ? (
            <OrgNodeForm
              key={nodeDialog.key}
              initial={
                nodeDialog.mode === 'edit'
                  ? {
                      kind: nodeDialog.node.kind,
                      name: nodeDialog.node.name,
                      code: nodeDialog.node.code ?? '',
                      countryCode: nodeDialog.node.countryCode ?? '',
                      managerId: nodeDialog.node.managerId ?? '',
                      memberCount: String(nodeDialog.node.memberCount),
                      fiscalYearStartMonth: nodeDialog.node.fiscalYearStartMonth ? String(nodeDialog.node.fiscalYearStartMonth) : '',
                      currency: nodeDialog.node.currency ?? '',
                    }
                  : undefined
              }
              title={nodeDialog.mode === 'edit' ? 'Save changes' : 'Add unit'}
              description="Every field except the name is optional."
              pending={createNode.pending || updateNode.pending}
              onCancel={() => setNodeDialog(null)}
              onSubmit={(draft) => {
                if (nodeDialog.mode === 'edit') void updateNode.run({ id: nodeDialog.node.id, draft });
                else void createNode.run({ draft, parentId: nodeDialog.parentId });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={teamDialog !== null} onOpenChange={(open) => !open && setTeamDialog(null)}>
        <DialogContent title={teamDialog?.team ? `Edit ${teamDialog.team.name}` : 'New team'} description="Teams scope records, shared views and notifications." size="lg">
          {teamDialog ? (
            <TeamForm
              key={teamDialog.key}
              initial={
                teamDialog.team
                  ? {
                      name: teamDialog.team.name,
                      kind: teamDialog.team.kind,
                      description: teamDialog.team.description ?? '',
                      managerId: teamDialog.team.managerId ?? '',
                      isShared: teamDialog.team.isShared,
                      parentTeamId: teamDialog.team.parentTeamId ?? '',
                    }
                  : undefined
              }
              pending={createTeam.pending || updateTeam.pending}
              parentOptions={scopedTeams
                .filter((team) => team.id !== teamDialog.team?.id)
                .map((team) => ({ value: team.id, label: team.name }))}
              onCancel={() => setTeamDialog(null)}
              onSubmit={(draft) => {
                if (teamDialog.team) void updateTeam.run({ id: teamDialog.team.id, draft });
                else void createTeam.run(draft);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={confirmRemove ? `Remove ${confirmRemove.name}?` : 'Remove unit?'}
        description="The unit is removed from this browser’s demonstration data. Records that referenced it keep their own values."
        confirmLabel="Remove unit"
        tone="danger"
        loading={removeNode.pending}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) void removeNode.run(confirmRemove.id);
        }}
      />
    </div>
  );
}

/* ========================================================= user directory */

export function UsersScreen() {
  const services = useServices();
  const active = useActiveOrganization();
  const users = useList(() => services.users.list({ pageSize: 200 }), []);
  const invitations = useList(() => services.users.invitations({ pageSize: 100 }), []);
  const roles = useList(() => services.roles.list({ pageSize: 100 }), []);
  const teams = useList(() => services.users.teams(), []);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [suspendTarget, setSuspendTarget] = React.useState<string | null>(null);
  const [roleTarget, setRoleTarget] = React.useState<string | null>(null);
  const [roleSelection, setRoleSelection] = React.useState<string[]>([]);
  const [suspendReason, setSuspendReason] = React.useState('');

  const scopedUsers = users.items.filter((user) => user.organizationIds.includes(active.activeId));
  const scopedInvitations = invitations.items.filter((invitation) => invitation.organizationId === active.activeId);
  const scopedRoles = roles.items.filter((role) => role.organizationId === active.activeId);
  const scopedTeams = teams.items.filter((team) => team.organizationId === active.activeId);

  const visible = scopedUsers.filter((user) => {
    const matchesSearch = !search
      ? true
      : `${user.displayName} ${user.email} ${user.jobTitle ?? ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const reload = () => {
    users.reload();
    invitations.reload();
  };

  const invite = useMutation(
    (input: { email: string; firstName: string; lastName: string; roleIds: string[]; teamIds: string[]; message: string }) =>
      services.users.invite(input),
    {
      simulated: true,
      successMessage: (invitation) => `Invitation recorded for ${invitation.email}`,
      onSuccess: () => {
        setInviteOpen(false);
        reload();
      },
    },
  );
  const revoke = useMutation((id: string) => services.users.revokeInvitation(id), {
    successMessage: 'Invitation revoked.',
    onSuccess: reload,
  });
  const resend = useMutation((id: string) => services.users.resendInvitation(id), {
    simulated: true,
    // The service returns the honest wording; the toast renders it rather than inventing one.
    successMessage: (result) => result.note,
  });
  const activate = useMutation((id: string) => services.users.activate(id), { successMessage: 'User activated.', onSuccess: reload });
  const reactivate = useMutation((id: string) => services.users.reactivate(id), { successMessage: 'User reactivated.', onSuccess: reload });
  const suspend = useMutation((input: { id: string; reason: string }) => services.users.suspend(input.id, input.reason), {
    successMessage: 'User suspended.',
    onSuccess: () => {
      setSuspendTarget(null);
      setSuspendReason('');
      reload();
    },
  });
  const changeRole = useMutation((input: { id: string; roleIds: string[] }) => services.users.changeRole(input.id, input.roleIds), {
    successMessage: 'Roles updated.',
    onSuccess: () => {
      setRoleTarget(null);
      reload();
    },
  });
  const changeSeat = useMutation((input: { id: string; seatType: 'full' | 'light' | 'viewer' }) => services.users.changeSeatType(input.id, input.seatType), {
    successMessage: 'Seat type updated.',
    onSuccess: reload,
  });

  const roleUser = scopedUsers.find((user) => user.id === roleTarget);
  const userRoles = (user: (typeof scopedUsers)[number]) =>
    user.roleIds.map((roleId) => roles.items.find((role) => role.id === roleId)?.name ?? 'Unknown role');

  return (
    <div className="pb-10">
      <PageHeader
        title="Users"
        description="Who belongs to this organization, what role they hold, and the invitations that are still outstanding."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Users' }]}
        tabs={<SettingsPageNav />}
        actions={
          <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)} leadingIcon={<Plus className="size-3.5" />}>
            Invite user
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <Alert tone="warning" title="No email is sent">
          Invitations are recorded in this browser and carry a <span className="font-mono text-[0.6875rem]">deliverySimulated</span> flag.
          Nothing is delivered, and accepting an invitation would require the user-provisioning backend that does not exist here.
        </Alert>

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border-subtle bg-surface p-3">
            <p className="text-2xs font-medium uppercase tracking-wide text-faint">Members</p>
            <p className="mt-1 text-md font-semibold tabular-nums text-fg">{formatNumber(scopedUsers.length)}</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-3">
            <p className="text-2xs font-medium uppercase tracking-wide text-faint">Active</p>
            <p className="mt-1 text-md font-semibold tabular-nums text-fg">{formatNumber(scopedUsers.filter((user) => user.status === 'active').length)}</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-3">
            <p className="text-2xs font-medium uppercase tracking-wide text-faint">Pending invitations</p>
            <p className="mt-1 text-md font-semibold tabular-nums text-fg">{formatNumber(scopedInvitations.filter((invitation) => invitation.status === 'pending').length)}</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-3">
            <p className="text-2xs font-medium uppercase tracking-wide text-faint">Without MFA</p>
            <p className="mt-1 text-md font-semibold tabular-nums text-fg">{formatNumber(scopedUsers.filter((user) => !user.mfaEnabled).length)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Field label="Search" htmlFor="user-search" className="max-w-sm">
              <Input id="user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or job title" />
            </Field>
          </div>
          <Field label="Status" htmlFor="user-status" className="w-[11rem]">
            <Select
              id="user-status"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'invited', label: 'Invited' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'deactivated', label: 'Deactivated' },
              ]}
              selectSize="sm"
            />
          </Field>
        </div>

        {users.loading ? (
          <ListSkeleton rows={8} columns={4} />
        ) : visible.length === 0 ? (
          <RecordEmptyState
            title="No users match this view"
            body="Adjust the search or status filter, or invite someone new."
            primaryAction={{ label: 'Invite user', onClick: () => setInviteOpen(true) }}
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((user) => (
              <li key={user.id} className="rounded-lg border border-border-subtle bg-surface p-3">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-subtle text-xs font-semibold text-muted" aria-hidden>
                    {user.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-fg">{user.displayName}</span>
                      <StatusBadge status={user.status} size="sm" />
                      {!user.mfaEnabled ? <Badge variant="warning" size="sm">No MFA</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] text-muted">
                      {user.email} · {user.jobTitle ?? 'No job title'} · {userRoles(user).join(', ') || 'No role'}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-faint">
                      {formatNumber(user.teamIds.length)} teams · {user.seatType} seat · last active {formatDate(user.lastActiveAt, 'relative')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {user.status === 'suspended' || user.status === 'deactivated' ? (
                      <Button variant="secondary" size="xs" onClick={() => void reactivate.run(user.id)} loading={reactivate.pending}>
                        Reactivate
                      </Button>
                    ) : user.status === 'invited' ? (
                      <Button variant="secondary" size="xs" onClick={() => void activate.run(user.id)} loading={activate.pending}>
                        Mark active
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setSuspendTarget(user.id);
                          setSuspendReason('');
                        }}
                      >
                        Suspend
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setRoleTarget(user.id);
                        setRoleSelection(user.roleIds);
                      }}
                    >
                      Roles
                    </Button>
                    <Select
                      value={user.seatType}
                      onValueChange={(value) => void changeSeat.run({ id: user.id, seatType: value as 'full' | 'light' | 'viewer' })}
                      options={[
                        { value: 'full', label: 'Full seat' },
                        { value: 'light', label: 'Light seat' },
                        { value: 'viewer', label: 'Viewer' },
                      ]}
                      selectSize="sm"
                      className="w-[8.5rem]"
                      aria-label={`Seat type for ${user.displayName}`}
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.teamIds.length === 0 ? (
                    <span className="text-[0.6875rem] text-faint">No team membership</span>
                  ) : (
                    user.teamIds.map((teamId) => {
                      const team = teams.items.find((candidate) => candidate.id === teamId);
                      return (
                        <Badge key={teamId} variant="outline" size="sm">
                          {team?.name ?? teamId}
                        </Badge>
                      );
                    })
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Invitations</CardTitle>
            <span className="text-2xs text-faint">{scopedInvitations.length} records</span>
          </CardHeader>
          <CardContent>
            {invitations.loading ? (
              <ListSkeleton rows={3} columns={3} />
            ) : scopedInvitations.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No invitations have been recorded for this organization.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {scopedInvitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-fg">{invitation.email}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-faint">
                        Sent {formatDate(invitation.sentAt, 'relative')} · expires {formatDate(invitation.expiresAt)} ·{' '}
                        {invitation.deliverySimulated ? 'delivery simulated' : 'delivery state unknown'}
                      </span>
                    </span>
                    <StatusBadge status={invitation.status} size="sm" />
                    {invitation.status === 'pending' ? (
                      <>
                        <Button variant="ghost" size="xs" onClick={() => void resend.run(invitation.id)} loading={resend.pending}>
                          Resend
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => void revoke.run(invitation.id)} loading={revoke.pending}>
                          Revoke
                        </Button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent
          title="Invite a user"
          description="An invitation record is created in this browser. No email is sent and no account is provisioned."
          size="lg"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" form="invite-form" loading={invite.pending}>
                Record invitation
              </Button>
            </>
          }
        >
          <InviteForm
            roles={scopedRoles.map((role) => ({ value: role.id, label: role.name }))}
            teams={scopedTeams.map((team) => ({ value: team.id, label: team.name }))}
            onSubmit={(values) => void invite.run(values)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={suspendTarget !== null} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent
          title="Suspend this user"
          description="Suspending is recorded locally and appends an entry to the demonstration audit log."
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setSuspendTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={suspend.pending}
                disabled={suspendReason.trim().length < 4}
                onClick={() => {
                  if (suspendTarget) void suspend.run({ id: suspendTarget, reason: suspendReason.trim() });
                }}
              >
                Suspend user
              </Button>
            </>
          }
        >
          <Field label="Reason" htmlFor="suspend-reason" required hint="Kept with the audit entry so the change explains itself.">
            <Textarea id="suspend-reason" rows={3} value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>

      <Dialog open={roleTarget !== null} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent
          title={roleUser ? `Roles for ${roleUser.displayName}` : 'Roles'}
          description="Roles describe what this person may do. The permission matrix lives under Roles & permissions."
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setRoleTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={changeRole.pending}
                disabled={roleSelection.length === 0}
                onClick={() => {
                  if (roleTarget) void changeRole.run({ id: roleTarget, roleIds: roleSelection });
                }}
              >
                Save roles
              </Button>
            </>
          }
        >
          <Field label="Roles" htmlFor="user-roles" required>
            <div id="user-roles">
              <MultiSelect
                values={roleSelection}
                onChange={setRoleSelection}
                options={scopedRoles.map((role) => ({ value: role.id, label: role.name, description: role.description }))}
                placeholder="Add a role"
              />
            </div>
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteForm({
  roles,
  teams,
  onSubmit,
}: {
  roles: Array<{ value: string; label: string }>;
  teams: Array<{ value: string; label: string }>;
  onSubmit: (values: { email: string; firstName: string; lastName: string; roleIds: string[]; teamIds: string[]; message: string }) => void;
}) {
  const [email, setEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [roleIds, setRoleIds] = React.useState<string[]>([]);
  const [teamIds, setTeamIds] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState('');

  return (
    <form
      id="invite-form"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
          notify.warning('Enter a valid email address.');
          return;
        }
        if (!firstName.trim() || !lastName.trim()) {
          notify.warning('A first and last name are required.');
          return;
        }
        if (roleIds.length === 0) {
          notify.warning('Select at least one role.');
          return;
        }
        onSubmit({ email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), roleIds, teamIds, message: message.trim() });
      }}
    >
      <Field label="Work email" htmlFor="invite-email" required>
        <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor="invite-first" required>
          <Input id="invite-first" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Last name" htmlFor="invite-last" required>
          <Input id="invite-last" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
        </Field>
      </div>
      <Field label="Roles" htmlFor="invite-roles" required>
        <div id="invite-roles">
          <MultiSelect values={roleIds} onChange={setRoleIds} options={roles} placeholder="Add a role" />
        </div>
      </Field>
      <Field label="Teams" htmlFor="invite-teams">
        <div id="invite-teams">
          <MultiSelect values={teamIds} onChange={setTeamIds} options={teams} placeholder="Add a team" />
        </div>
      </Field>
      <Field label="Message" htmlFor="invite-message" hint="Recorded with the invitation; it is never delivered.">
        <Textarea id="invite-message" rows={2} value={message} onChange={(event) => setMessage(event.target.value)} />
      </Field>
      <DemoNotice tone="neutral">
        The person does not exist until a provisioning backend creates them. This record is the invitation a real system would send.
      </DemoNotice>
    </form>
  );
}
