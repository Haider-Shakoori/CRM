/**
 * Tenancy, organization structure, identity and authorization surfaces.
 *
 * IMPORTANT: nothing in this file enforces security. It describes the shape of the
 * data and the UI affordances. Real isolation, authorization and session integrity
 * are backend responsibilities.
 */

import type {
  Address,
  Auditable,
  CurrencyCode,
  Id,
  ISODateString,
  ISODateTimeString,
  ImageRef,
  LanguageTag,
  PageMeta,
  Tone,
} from './common';

/* ------------------------------------------------------------------- tenant */

export type TenantStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'churned' | 'prospect';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'expired';

export interface Tenant extends Auditable {
  id: Id;
  /** Display name of the paying customer account as seen by the platform owner. */
  name: string;
  slug: string;
  status: TenantStatus;
  planId: Id;
  subscriptionStatus: SubscriptionStatus;
  /** Billing currency for the platform contract. */
  billingCurrency: CurrencyCode;
  /** ISO-3166 alpha-2 of the contracting entity. */
  countryCode: string;
  primaryRegion: DataRegion;
  seatsPurchased: number;
  seatsUsed: number;
  trialEndsAt?: ISODateTimeString;
  renewsAt?: ISODateTimeString;
  /** Platform-owner lifecycle trail (onboarding, upgrade, suspension, notes). */
  lifecycle: TenantLifecycleEvent[];
  supportNotes: TenantSupportNote[];
  /** Internal health indicator maintained by the platform team. */
  accountTier: 'starter' | 'growth' | 'professional' | 'enterprise';
  enabledModuleKeys: string[];
  featureFlags: Record<string, boolean>;
  contactEmail: string;
  sandboxEnabled: boolean;
}

export interface TenantLifecycleEvent {
  id: Id;
  at: ISODateTimeString;
  kind:
    | 'created'
    | 'trial_started'
    | 'trial_converted'
    | 'plan_changed'
    | 'seats_changed'
    | 'module_enabled'
    | 'module_disabled'
    | 'suspended'
    | 'reactivated'
    | 'canceled'
    | 'note';
  summary: string;
  actorId?: Id;
  actorLabel?: string;
  detail?: string;
}

export interface TenantSupportNote {
  id: Id;
  at: ISODateTimeString;
  authorLabel: string;
  body: string;
  pinned?: boolean;
}

/** Residency is presented as a product option; the frontend makes no compliance claim. */
export type DataRegion = 'us-east' | 'us-west' | 'eu-central' | 'eu-west' | 'uk' | 'ap-southeast' | 'ap-south' | 'au' | 'ca' | 'me-central';

/* ------------------------------------------------------------- organization */

export interface Organization extends Auditable {
  id: Id;
  tenantId: Id;
  name: string;
  legalName?: string;
  slug: string;
  /** Short label used in the organization switcher on small screens. */
  shortName?: string;
  logo?: ImageRef;
  industryId: Id;
  companySize: CompanySize;
  countryCode: string;
  defaultLocale: LanguageTag;
  defaultTimezone: string;
  defaultCurrency: CurrencyCode;
  fiscalYearStartMonth: number;
  weekStartsOn: 0 | 1 | 6;
  addresses: Address[];
  /** Configuration-driven branding override for this tenant. */
  branding: OrganizationBranding;
  /** Modules the tenant has actually licensed, driving navigation visibility. */
  enabledModuleKeys: string[];
  workspaceIds: Id[];
  businessUnitIds: Id[];
  hierarchy: OrgNode[];
  taxId?: string;
  onboarding: OnboardingProgress;
  /** Human-facing plan name, resolved from the subscription. */
  planId: Id;
  dataRegion?: DataRegion;
}

export type CompanySize =
  | 'solo'
  | '2-10'
  | '11-50'
  | '51-200'
  | '201-1000'
  | '1001-5000'
  | '5000+';

export interface OrganizationBranding {
  productDisplayName?: string;
  logoUrl?: string;
  logoMarkUrl?: string;
  faviconUrl?: string;
  accentPresetId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  defaultTheme?: ThemePreference;
  defaultDensity?: DensityPreference;
  emailSignatureHtml?: string;
  loginBackgroundStyle?: 'brand' | 'mesh' | 'solid' | 'photo_placeholder';
  socialShareImageUrl?: string;
}

/** Every member of the organization, including the workspace memberships they hold. */
export interface Workspace {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  kind: 'sales' | 'service' | 'marketing' | 'operations' | 'executive' | 'custom';
  memberIds: Id[];
  defaultPipelineId?: Id;
  isDefault?: boolean;
}

export type OrgNodeKind = 'branch' | 'region' | 'division' | 'team';

export interface OrgNode {
  id: Id;
  parentId?: Id;
  kind: OrgNodeKind;
  name: string;
  code?: string;
  countryCode?: string;
  managerId?: Id;
  memberCount: number;
  /** Financial year override for entities that report on a different cycle. */
  fiscalYearStartMonth?: number;
  currency?: CurrencyCode;
}

export interface BusinessUnit {
  id: Id;
  organizationId: Id;
  name: string;
  code?: string;
  leaderId?: Id;
  memberIds: Id[];
  departmentIds: Id[];
}

export interface Department {
  id: Id;
  businessUnitId?: Id;
  organizationId: Id;
  name: string;
  parentId?: Id;
  leadId?: Id;
  memberIds: Id[];
}

export interface Team extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  kind:
    | 'sales'
    | 'service'
    | 'marketing'
    | 'success'
    | 'operations'
    | 'finance'
    | 'field'
    | 'custom';
  description?: string;
  managerId?: Id;
  memberIds: Id[];
  memberRoles: Array<{ userId: Id; roleInTeam?: string }>;
  parentTeamId?: Id;
  territoryIds?: Id[];
  isShared: boolean;
}

/* -------------------------------------------------------------------- users */

export type UserStatus = 'active' | 'invited' | 'suspended' | 'deactivated';

export type PersonaKey =
  | 'business_owner'
  | 'ceo'
  | 'sales_rep'
  | 'sales_manager'
  | 'sales_director'
  | 'marketing_specialist'
  | 'marketing_manager'
  | 'support_agent'
  | 'service_manager'
  | 'account_manager'
  | 'success_manager'
  | 'revops_manager'
  | 'finance_user'
  | 'field_rep'
  | 'org_admin'
  | 'it_admin'
  | 'platform_admin';

export interface User extends Auditable {
  id: Id;
  tenantId: Id;
  organizationIds: Id[];
  /** The organization currently being viewed. Part of the UI state, not the identity. */
  activeOrganizationId?: Id;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  personalEmail?: string;
  phone?: string;
  mobile?: string;
  jobTitle?: string;
  avatarUrl?: string;
  /** Initials fallback so we never depend on a remote avatar service. */
  initials: string;
  status: UserStatus;
  locale: LanguageTag;
  timezone: string;
  currency: CurrencyCode;
  dateFormat: string;
  numberFormat: string;
  /** Personas the user can preview. Drives dashboards, navigation and density defaults. */
  persona: PersonaKey;
  roleIds: Id[];
  groupIds: Id[];
  teamIds: Id[];
  businessUnitId?: Id;
  departmentId?: Id;
  managerId?: Id;
  reportsToIds?: Id[];
  territories: string[];
  seatType: 'full' | 'light' | 'viewer';
  preferences: UserPreferences;
  mfaEnabled: boolean;
  lastActiveAt?: ISODateTimeString;
  invitedAt?: ISODateTimeString;
  activatedAt?: ISODateTimeString;
}

export interface UserPreferences {
  theme: ThemePreference;
  density: DensityPreference;
  contrast: 'default' | 'high';
  reducedMotion: boolean;
  /** Simple Mode hides advanced modules and reduces per-page information density. */
  interfaceMode: InterfaceMode;
  sidebarCollapsed: boolean;
  favorites: FavoriteEntry[];
  recentlyViewed: RecentEntry[];
  defaultLandingRoute: string;
  emailNotifications: Record<string, boolean>;
  inAppNotifications: Record<string, boolean>;
  weeklyDigest: boolean;
  /** Optional signature used by the email composer demonstration. */
  emailSignature?: string;
  tablePageSize: number;
  startOfWeek: 0 | 1 | 6;
  timeFormat: '12h' | '24h';
  /** Kept for the accessibility panel; the OS preference is read separately. */
  screenReaderHints: boolean;
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type DensityPreference = 'comfortable' | 'compact' | 'spacious';
export type InterfaceMode = 'simple' | 'advanced';

export interface FavoriteEntry {
  id: Id;
  kind: 'record' | 'view' | 'route' | 'report' | 'dashboard';
  label: string;
  path: string;
  icon?: string;
}

export interface RecentEntry extends FavoriteEntry {
  viewedAt: ISODateTimeString;
}

export interface Invitation {
  id: Id;
  organizationId: Id;
  email: string;
  roleIds: Id[];
  teamIds: Id[];
  invitedById: Id;
  message?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  sentAt: ISODateTimeString;
  expiresAt: ISODateTimeString;
  /** The demo never sends mail; the UI states this explicitly. */
  deliverySimulated: boolean;
}

export interface UserGroup {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  memberIds: Id[];
  /** Groups can grant roles without duplicating per-user configuration. */
  grantedRoleIds: Id[];
  color?: Tone;
}

/* --------------------------------------------------- roles and permissions */

export interface Role extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  /** System roles cannot be deleted by an organization admin. */
  kind: 'system' | 'custom' | 'template';
  permissions: PermissionGrant[];
  /** Hierarchical role inheritance, mirroring how enterprises model access. */
  inheritsFromRoleId?: Id;
  userCount: number;
  isDefault?: boolean;
  color?: Tone;
}

export type PermissionEffect = 'allow' | 'deny' | 'inherit';

export interface PermissionGrant {
  /** Module or resource key, e.g. `deals`, `tickets`, `reports`. */
  resource: string;
  action: PermissionAction;
  effect: PermissionEffect;
  scope?: PermissionScope;
}

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'import'
  | 'assign'
  | 'approve'
  | 'configure'
  | 'manage';

export interface PermissionScope {
  kind: 'own' | 'team' | 'team_and_children' | 'department' | 'organization' | 'all';
  /** Restrict to specific field groups when field-level security is configured. */
  fieldGroups?: string[];
}

export interface PermissionDescriptor {
  key: string;
  resource: string;
  resourceLabel: string;
  action: PermissionAction;
  actionLabel: string;
  description: string;
  /** Non-configurable grants are shown read-only to explain platform behaviour. */
  configurable: boolean;
  dependsOn?: string[];
}

export interface AccessReviewRow {
  userId: Id;
  userName: string;
  roleNames: string[];
  lastActiveAt?: ISODateTimeString;
  unmatchedPermissions: number;
  riskFlags: Array<'dormant_account' | 'excessive_scope' | 'no_mfa' | 'external_guest' | 'custom_role'>;
}

/* ---------------------------------------------------------------- sessions */

export interface SessionRecord {
  id: Id;
  userId: Id;
  deviceLabel: string;
  browser: string;
  os: string;
  ipAddressMasked: string;
  locationLabel?: string;
  startedAt: ISODateTimeString;
  lastSeenAt: ISODateTimeString;
  current: boolean;
  trusted: boolean;
  /** Sensitive values are masked in the UI; the real values never reach the client. */
  mfaSatisfied: boolean;
}

export interface TrustedDevice {
  id: Id;
  userId: Id;
  label: string;
  addedAt: ISODateTimeString;
  lastUsedAt?: ISODateTimeString;
  expiresAt?: ISODateTimeString;
  platform: string;
}

/* ---------------------------------------------------------- security config */

export interface SecurityPolicy {
  organizationId: Id;
  mfa: {
    enforcement: 'off' | 'admins_only' | 'all_users' | 'risk_based';
    allowedMethods: Array<'totp' | 'webauthn' | 'sms' | 'email'>;
    gracePeriodDays: number;
    rememberDeviceDays: number;
  };
  sso: {
    enabled: boolean;
    protocol: 'saml' | 'oidc' | 'none';
    providerLabel?: string;
    // NOTE: no client secrets, certificates or metadata are modelled on the client.
    enforceForAllUsers: boolean;
    jitProvisioning: boolean;
    defaultRoleId?: Id;
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
    expiryDays: number | null;
    preventReuse: number;
    lockoutAttempts: number;
  };
  sessions: {
    idleTimeoutMinutes: number;
    absoluteTimeoutHours: number;
    concurrentSessionLimit: number | null;
    requireReauthForSensitiveActions: boolean;
  };
  network: {
    ipAllowlist: string[];
    ipDenylist: string[];
    countryAllowlist: string[];
    blockTorExitNodes: boolean;
  };
  dataGovernance: {
    exportRequiresApproval: boolean;
    maskSensitiveFieldsForNonAdmins: boolean;
    auditRetentionDays: number;
    recordRetentionYears: number;
  };
}

export interface AuditEvent {
  id: Id;
  at: ISODateTimeString;
  organizationId: Id;
  actorId?: Id;
  actorLabel: string;
  actorType: 'user' | 'system' | 'api' | 'integration';
  action: string;
  resource: string;
  resourceLabel: string;
  resourceId?: Id;
  outcome: 'success' | 'failure' | 'denied';
  ipAddressMasked?: string;
  userAgent?: string;
  /** Field-level diffs are presented as a change list, never as raw payloads. */
  changes?: Array<{ field: string; before?: string; after?: string; masked?: boolean }>;
  severity: 'info' | 'notice' | 'warning' | 'critical';
}

export interface ApiKeyRecord {
  id: Id;
  organizationId: Id;
  name: string;
  /** Only a masked representation is ever displayed. */
  maskedKey: string;
  scopes: string[];
  createdById: Id;
  createdAt: ISODateTimeString;
  lastUsedAt?: ISODateTimeString;
  expiresAt?: ISODateTimeString;
  status: 'active' | 'revoked' | 'expired';
  /** Demo keys cannot authenticate anything. */
  demoOnly: true;
}

/* -------------------------------------------------------------- onboarding */

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  optional: boolean;
  /** Deep link into the product so the checklist is actionable, not decorative. */
  route?: string;
  completedAt?: ISODateTimeString;
}

export interface OnboardingProgress {
  organizationId: Id;
  startedAt: ISODateTimeString;
  completedAt?: ISODateTimeString;
  steps: OnboardingStep[];
  /** Demo data can be re-seeded from onboarding or settings at any time. */
  sampleDataLoaded: boolean;
  pipelineTemplateId?: Id;
  dismissedChecklist: boolean;
}

/* ------------------------------------------------------------------ usage */

export interface UsageMeter {
  organizationId: Id;
  key: string;
  label: string;
  unit: string;
  used: number;
  included: number;
  /** null means unlimited on the current plan. */
  overage?: number | null;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  /** Overage handling is commercially configured; this is presentation only. */
  overageBehaviour: 'block' | 'bill' | 'throttle' | 'notify';
}

export interface Entitlement {
  moduleKey: string;
  label: string;
  included: boolean;
  /** Limits enforce nothing in the frontend; they drive messaging and upgrade prompts. */
  limits: Record<string, number | null>;
  source: 'plan' | 'addon' | 'contract_override' | 'trial';
  trialEndsAt?: ISODateTimeString;
}

export interface AccessDeniedContext {
  reason: 'no_permission' | 'not_entitled' | 'session_expired' | 'region_restricted' | 'feature_flag_off';
  resource?: string;
  requiredPermission?: string;
  moduleKey?: string;
  requestedPath: string;
  hint?: string;
  upgradeRoute?: string;
}

export interface PaginatedUsers {
  items: User[];
  meta: PageMeta;
}
