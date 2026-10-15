/**
 * Customization: custom objects, custom fields, layouts, validation rules, saved
 * views, navigation configuration and industry templates.
 *
 * This is the module that decides whether the product can compete with enterprise
 * platforms, so the model is deliberately close to how real metadata APIs work:
 * definitions are data, and the UI renders whatever the definition says.
 */

import type { Auditable, Id, ISODateString, Tone } from './common';

/* ------------------------------------------------------------ custom objects */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'rich_text'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'duration'
  | 'boolean'
  | 'picklist'
  | 'multi_picklist'
  | 'lookup'
  | 'master_detail'
  | 'user_lookup'
  | 'team_lookup'
  | 'file'
  | 'image_placeholder'
  | 'address'
  | 'geolocation_placeholder'
  | 'formula'
  | 'rollup'
  | 'auto_number'
  | 'json';

export interface CustomObject extends Auditable {
  id: Id;
  organizationId: Id;
  /** Singular and plural labels; the whole UI reads from these. */
  singularLabel: string;
  pluralLabel: string;
  /** Machine name used in API payloads and formula references. */
  apiName: string;
  description?: string;
  icon: string;
  tone: Tone;
  status: 'active' | 'draft' | 'deprecated';
  /** Standard objects can be extended but not deleted. */
  kind: 'standard' | 'custom' | 'junction';
  /** Navigation placement so new objects appear in the sidebar without a code change. */
  navigation: {
    showInSidebar: boolean;
    showInSearch: boolean;
    showInReports: boolean;
    section: 'workspace' | 'sales' | 'service' | 'marketing' | 'insights' | 'customize' | 'hidden';
    sortOrder: number;
  };
  /** Record behaviour. */
  features: {
    activities: boolean;
    notes: boolean;
    attachments: boolean;
    files: boolean;
    sharing: boolean;
    historyTracking: boolean;
    fieldHistoryTrackedFields: string[];
    duplicateDetection: boolean;
    /** Required for objects that participate in workflows. */
    workflowEnabled: boolean;
    bulkImport: boolean;
    apiEnabled: boolean;
  };
  fieldCount: number;
  recordCount: number;
  relationshipCount: number;
  layoutIds: Id[];
  defaultLayoutId?: Id;
  /** Junction objects describe many-to-many links between two objects. */
  junction?: { leftObjectApiName: string; rightObjectApiName: string };
}

export interface CustomField extends Auditable {
  id: Id;
  organizationId: Id;
  objectApiName: string;
  apiName: string;
  label: string;
  helpText?: string;
  type: FieldType;
  /** Field groups organise the layout editor palette. */
  group?: string;
  required: boolean;
  unique: boolean;
  /** Read-only fields are computed or integration-owned. */
  readOnly: boolean;
  /** Sensitive fields are masked for users without the field permission. */
  sensitive: boolean;
  encryptedAtRestNote?: string;
  defaultValue?: string | number | boolean | string[];
  /** Picklist definition. */
  picklistValues?: Array<{ id: Id; value: string; label: string; color?: Tone; isDefault: boolean; isActive: boolean; sortOrder: number }>;
  /** Numeric formatting. */
  numberFormat?: { precision: number; scale: number; displayFormat: 'plain' | 'percent' | 'currency' };
  currencyCodeMode?: 'organization_default' | 'record_currency' | 'fixed';
  fixedCurrencyCode?: string;
  /** Text constraints. */
  textFormat?: { maxLength?: number; patternPlaceholder?: string; caseSensitive: boolean };
  /** Relationship fields. */
  lookup?: {
    targetObjectApiName: string;
    relationshipName: string;
    /** Cascade behaviour is described for the configuration UI. */
    onDelete: 'clear' | 'restrict' | 'cascade_placeholder';
    filterNote?: string;
  };
  /** Formula and rollup fields. */
  formula?: {
    returnType: Exclude<FieldType, 'formula' | 'rollup'>;
    expression: string;
    /** Parsed identifier list so the editor can offer autocomplete and validation. */
    referencedFields: string[];
    syntaxHint: string;
    /** Evaluation happens client-side over the mock dataset only. */
    evaluationState: 'demo_client_evaluation';
  };
  rollup?: {
    childObjectApiName: string;
    childField: string;
    operation: 'sum' | 'count' | 'min' | 'max' | 'average';
    filterNote?: string;
  };
  autoNumber?: { prefix: string; nextNumber: number; padding: number };
  /** Conditional visibility so a field can exist without always being shown. */
  visibilityRules: Array<{
    id: Id;
    effect: 'show' | 'hide' | 'require' | 'read_only';
    conditionGroup: { conjunction: 'and' | 'or'; conditions: Array<{ field: string; operator: string; value: string }> };
    appliesToLayoutIds?: Id[];
    appliesToRoles?: Id[];
  }>;
  /** Field-level security is presented per role; nothing is enforced client-side. */
  fieldPermissions: Array<{ roleId: Id; roleName: string; read: boolean; edit: boolean }>;
  usage: { onLayouts: number; inFormulas: number; inWorkflows: number; inReports: number; populatedPercent: number };
  sortOrder: number;
  isActive: boolean;
}

/* ----------------------------------------------------------------- layouts */

export type LayoutKind = 'record_detail' | 'record_create' | 'list_view' | 'compact' | 'mobile' | 'portal';

export interface PageLayout extends Auditable {
  id: Id;
  organizationId: Id;
  objectApiName: string;
  name: string;
  kind: LayoutKind;
  description?: string;
  /** Which roles and record types this layout applies to. */
  assignment: { roleIds: Id[]; recordTypeIds?: Id[]; isDefault: boolean; priority: number };
  sections: LayoutSection[];
  /** Related lists shown at the bottom of the record. */
  relatedLists: Array<{
    id: Id;
    objectApiName: string;
    label: string;
    columns: string[];
    sortBy?: string;
    filterNote?: string;
    visible: boolean;
    showInMobile: boolean;
  }>;
  highlightsPanel: string[];
  activityTimeline: { enabled: boolean; defaultFilter: 'all' | 'activities' | 'notes' | 'emails' | 'calls'; showInternalNotes: boolean };
  isActive: boolean;
  version: number;
}

export interface LayoutSection {
  id: Id;
  label: string;
  columns: 1 | 2 | 3;
  collapsible: boolean;
  collapsedByDefault: boolean;
  fields: LayoutFieldPlacement[];
  sortOrder: number;
  /** Breakpoints let a section collapse on tablet without a separate layout. */
  responsiveBehaviour?: { stackBelowBreakpoint: boolean; hideOnMobile: boolean };
}

export interface LayoutFieldPlacement {
  id: Id;
  fieldApiName: string;
  fieldLabel: string;
  fieldType: FieldType;
  required: boolean;
  readOnly: boolean;
  /** How many grid columns the field spans. */
  span: 1 | 2 | 3;
  sortOrder: number;
  /** Help text override for this specific layout. */
  helpTextOverride?: string;
  isSensitive: boolean;
}

/* ------------------------------------------------------- validation rules */

export interface ValidationRule extends Auditable {
  id: Id;
  organizationId: Id;
  objectApiName: string;
  name: string;
  description: string;
  errorCondition: { conjunction: 'and' | 'or'; conditions: Array<{ field: string; operator: string; value: string }> };
  errorMessage: string;
  /** Which field the error is attached to; empty means a page-level error. */
  errorField?: string;
  errorLocation: 'inline' | 'top_of_page';
  active: boolean;
  /** Honest split between rule inspection and any enforcement. */
  enforcement: 'frontend_form_validation' | 'described_only';
  evaluatedOn: Array<'create' | 'edit' | 'import' | 'api'>;
  triggerCount: number;
}

/* ------------------------------------------------------------ saved views */

export interface SavedView extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  objectApiName: string;
  scope: 'personal' | 'shared' | 'system';
  sharedWithRoleIds: Id[];
  sharedWithTeamIds: Id[];
  isDefault: boolean;
  isPinned: boolean;
  /** Filters, sorting, visible columns and grouping. */
  filter: {
    conjunction: 'and' | 'or';
    /** Values may be strings, numbers or booleans depending on the field type. */
    conditions: Array<{ field: string; operator: string; value: string | number | boolean }>;
  };
  sort: Array<{ field: string; direction: 'asc' | 'desc' }>;
  columns: Array<{ field: string; label: string; width?: number; visible: boolean }>;
  groupBy?: string;
  display: 'table' | 'kanban' | 'cards' | 'calendar' | 'timeline' | 'map_placeholder' | 'tree';
  kanbanGroupField?: string;
  density: 'compact' | 'comfortable';
  ownerId: Id;
  ownerName: string;
  usedByCount: number;
  icon?: string;
  tone?: Tone;
}

/* --------------------------------------------------------- navigation config */

export interface NavigationItemConfig {
  id: Id;
  organizationId: Id;
  key: string;
  label: string;
  route: string;
  icon: string;
  section: 'workspace' | 'sales' | 'marketing' | 'service' | 'revenue' | 'productivity' | 'insights' | 'automation' | 'customize' | 'admin';
  order: number;
  visible: boolean;
  /** Entitlement and role gating are declared here, evaluated in the shell hook. */
  requiredModuleKey?: string;
  requiredPermission?: string;
  personaVisibility: string[];
  /** Hides the item when the tenant is in Simple Mode. */
  advancedOnly: boolean;
  badgeSource?: 'notifications' | 'overdue_tasks' | 'open_tickets' | 'none';
  isCustomObject: boolean;
  parentKey?: string;
}

/* ------------------------------------------------------- industry templates */

export interface IndustryTemplate extends Auditable {
  id: Id;
  name: string;
  industryId: Id;
  industryLabel: string;
  /** Honest framing: these are configuration examples, not certified solutions. */
  disclaimer: string;
  summary: string;
  icon: string;
  tone: Tone;
  /** What the template actually configures. */
  contents: {
    objectApiNames: string[];
    customObjectCount: number;
    customFieldCount: number;
    pipelineCount: number;
    workflowCount: number;
    dashboardCount: number;
    reportCount: number;
    templateCounts: { emailTemplates: number; documentTemplates: number; callScripts: number; taskTemplates: number };
    industryTerminology: Array<{ standardLabel: string; industryLabel: string }>;
  };
  /** Representative fields so the gallery can show a fair preview. */
  sampleFields: Array<{ objectLabel: string; fields: Array<{ label: string; type: FieldType; note?: string }> }>;
  sampleWorkflows: Array<{ name: string; triggerLabel: string; actionSummary: string }>;
  samplePipeline: { name: string; stages: Array<{ name: string; probability: number; tone: Tone }> };
  sampleDashboardWidgets: string[];
  installsCount: number;
  /** Mirrors the platform's regulatory stance: no compliance claim is made. */
  complianceNote?: string;
  regulatoryDisclaimerRequired: boolean;
  isInstalled: boolean;
  previewRoute: string;
}

export interface CustomizationOverview {
  customObjectCount: number;
  customFieldCountByObject: Array<{ objectApiName: string; label: string; count: number; kind: 'standard' | 'custom' }>;
  layoutCount: number;
  savedViewCount: number;
  validationRuleCount: number;
  activeValidationRuleCount: number;
  /** Storage/quota is presentation only; the platform owner defines real limits. */
  quota: { used: number; included: number; unit: string };
  recentlyChanged: Array<{ id: Id; label: string; kind: 'field' | 'object' | 'layout' | 'rule' | 'view' | 'navigation'; changedByName: string; changedAt: string }>;
  unusedFields: Array<{ objectApiName: string; fieldApiName: string; label: string; populatedPercent: number }>;
  warnings: Array<{ id: Id; severity: 'info' | 'warning'; message: string; href?: string }>;
}

export interface FormulaEditorState {
  objectApiName: string;
  expression: string;
  returnType: FieldType;
  /** Client-side validation output. */
  validation: { valid: boolean; message?: string; position?: number };
  referencedFields: string[];
  suggestedFields: Array<{ apiName: string; label: string; type: FieldType }>;
  functions: Array<{ name: string; signature: string; description: string; category: string }>;
  previewRows: Array<{ recordLabel: string; value: string | number | boolean | null }>;
  /** The evaluation engine is a browser-only demonstration. */
  evaluationState: 'demo_client_evaluation';
}

export interface FieldUsageWarning {
  fieldApiName: string;
  label: string;
  risk: 'unused' | 'deprecated' | 'duplicate_of_standard' | 'excessive_picklist';
  message: string;
  recommendation: string;
}

export interface ObjectRelationship {
  id: Id;
  fromObjectApiName: string;
  fromLabel: string;
  toObjectApiName: string;
  toLabel: string;
  kind: 'lookup' | 'master_detail' | 'many_to_many';
  fieldApiName: string;
  onDelete: string;
  isRequired: boolean;
  childRecords: number;
}

export interface LayoutPreviewModel {
  layoutId: Id;
  objectApiName: string;
  objectLabel: string;
  /** Synthetic record used to render the live preview. */
  sampleRecord: { id: Id; label: string; values: Record<string, string | number | boolean | null> };
  sections: Array<{
    id: Id;
    label: string;
    columns: number;
    collapsible: boolean;
    fields: Array<{ apiName: string; label: string; span: number; required: boolean; readOnly: boolean; value: string; type: FieldType; isSensitive: boolean }>;
  }>;
  relatedLists: PageLayout['relatedLists'];
  appliedRules: Array<{ ruleId: Id; effect: string; fieldApiName?: string }>;
  unsaved: boolean;
}

export interface PermissionFieldMatrixRow {
  fieldApiName: string;
  label: string;
  type: FieldType;
  isSensitive: boolean;
  perRole: Array<{ roleId: Id; read: boolean; edit: boolean; masked: boolean }>;
}

export interface CustomNavigationPreview {
  sections: Array<{ key: string; label: string; items: Array<{ key: string; label: string; icon: string; route: string; visible: boolean; tone?: Tone }> }>;
  hiddenItemCount: number;
  updatedAt: ISODateString;
}
