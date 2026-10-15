/**
 * Customization extras: page layouts, industry templates and navigation configuration.
 *
 * These three modules sit beside `makeCustomizationService` (custom objects and saved views)
 * in `extra.ts`. They are split out because they are the parts of customization that are
 * *derived* rather than stored one-to-one:
 *
 *   - A **page layout** is a tree of sections and field placements. The live preview is
 *     rendered from that tree against a synthetic record, so what a reviewer sees is what the
 *     definition actually says — not a hand-drawn mock.
 *   - An **industry template** declares what it would add. Installation is a simulation and
 *     every number it returns is the template's own declared scope; nothing is fabricated.
 *   - **Navigation** has no backing collection in the seeded store. Its state is derived from
 *     a canonical baseline plus the custom objects that ask to appear in the sidebar, and the
 *     per-item visibility and order overrides live in this service's closure for the session.
 *
 * Nothing here performs I/O. A method whose behaviour genuinely depends on a backend (a real
 * template installer, a persisted navigation order) is labelled as simulated rather than
 * returning a fabricated confirmation the UI cannot stand behind.
 */

import type {
  CustomField,
  CustomNavigationPreview,
  CustomObject,
  FieldType,
  Id,
  IndustryTemplate,
  LayoutPreviewModel,
  ListQuery,
  NavigationItemConfig,
  PageLayout,
  ServiceContainer,
  Tone,
  ValidationRule,
} from '@crm/shared-types';
import { runQuery } from '../lib/query';
import { MockDb, type CollectionName } from '../lib/store';
import { createCrud, delay, err, ok } from './factory';

type Db = MockDb;

const asRecords = <T>(database: Db, collection: CollectionName): T[] => database.all(collection) as unknown as T[];

/** The organization a request belongs to. Mirrors the resolver in `services/index.ts`. */
function currentOrganizationId(db: Db): Id {
  return Object.values(db.state.users)[0]?.activeOrganizationId ?? Object.values(db.state.organizations)[0]?.id ?? 'org-vertex';
}

/** `asset_status` → `Asset status`. Used where the seed carries no human label. */
function humanise(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/* ------------------------------------------------------------------- layouts */

/** A plausible preview value for a field, chosen by its declared type. */
function previewValueFor(type: FieldType, field: CustomField | undefined): string | number | boolean | null {
  switch (type) {
    case 'number':
    case 'percent':
    case 'duration':
      return 42;
    case 'currency':
      return 1250;
    case 'boolean':
      return true;
    case 'date':
      return '2026-03-18';
    case 'datetime':
      return '2026-03-18T10:15:00.000Z';
    case 'picklist':
    case 'multi_picklist':
      return field?.picklistValues?.[0]?.label ?? 'In service';
    case 'lookup':
    case 'master_detail':
    case 'user_lookup':
    case 'team_lookup':
      return field?.lookup ? `${humanise(field.lookup.targetObjectApiName)} record` : 'Related record';
    case 'email':
      return 'sam.rivera@example.com';
    case 'phone':
      return '+44 20 7946 0100';
    case 'url':
      return 'https://example.com/spec-sheet';
    case 'address':
      return '18 Harbour Street, Leeds';
    case 'auto_number':
      return 'AST-00042';
    case 'formula':
    case 'rollup':
      return 'Computed in the browser';
    case 'rich_text':
    case 'textarea':
      return 'A representative value rendered by the layout preview.';
    case 'file':
    case 'image_placeholder':
    case 'geolocation_placeholder':
      return 'Not shown in preview';
    default:
      return `${humanise(String(type))} value`;
  }
}

/** Render a preview value the way the record page would. */
function displayPretext(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat('en').format(value);
  return value;
}

export function makeLayoutsService(db: Db): ServiceContainer['layouts'] {
  const crud = createCrud<PageLayout>(db, 'layouts', {
    label: 'Layout',
    searchFields: ['name', 'objectApiName', 'description'],
    facetField: 'kind',
    defaultSort: [{ field: 'name', direction: 'asc' }],
    defaultsFor: (input) => ({
      organizationId: (input as { organizationId?: Id }).organizationId ?? currentOrganizationId(db),
      sections: [],
      relatedLists: [],
      highlightsPanel: [],
      activityTimeline: { enabled: false, defaultFilter: 'all' as const, showInternalNotes: false },
      isActive: true,
      version: 1,
      assignment: { roleIds: [], isDefault: false, priority: 1 },
    }),
  });

  return {
    list: async (objectApiName) => {
      const organizationId = currentOrganizationId(db);
      const all = asRecords<PageLayout>(db, 'layouts').filter((layout) => layout.organizationId === organizationId);
      const scoped = objectApiName ? all.filter((layout) => layout.objectApiName === objectApiName) : all;
      return runQuery(scoped, {}, {
        searchFields: ['name', 'objectApiName', 'description'],
        facetField: 'kind',
        defaultSort: [{ field: 'name', direction: 'asc' }],
      });
    },

    get: (id) => crud.get(id),

    create: (input) => crud.create(input),

    update: async (id, input) => {
      const existing = db.state.layouts[id];
      // A layout is versioned: any change to its structure bumps the version so a reviewer can
      // see it move, and so a future backend can invalidate caches on the same signal.
      const bump = Boolean(input.sections || input.relatedLists || input.highlightsPanel);
      const next = bump && existing ? { ...input, version: (existing.version ?? 1) + 1 } : input;
      return crud.update(id, next);
    },

    remove: (id) => crud.remove(id),

    assign: async (id, assignment) => {
      await delay(`layout-assign:${id}`);
      const layout = db.state.layouts[id];
      if (!layout) return err<PageLayout>('not_found', 'Layout not found.');
      const updated: PageLayout = { ...layout, assignment, updatedAt: new Date().toISOString() };
      db.put('layouts', updated);
      return ok(updated);
    },

    preview: async (id, options) => {
      await delay(`layout-preview:${id}`, { latency: { min: 140, max: 340 } });
      const layout = db.state.layouts[id];
      if (!layout) return err<LayoutPreviewModel>('not_found', 'Layout not found.');

      const organizationId = currentOrganizationId(db);
      const object = Object.values(db.state.customObjects).find(
        (candidate) => candidate.organizationId === organizationId && candidate.apiName === layout.objectApiName,
      );
      const fields = asRecords<CustomField>(db, 'customFields').filter(
        (field) => field.organizationId === organizationId && field.objectApiName === layout.objectApiName,
      );
      const fieldByApiName = new Map(fields.map((field) => [field.apiName, field]));
      const device = options?.device ?? 'desktop';

      const values: Record<string, string | number | boolean | null> = {};
      for (const section of layout.sections) {
        for (const placement of section.fields) {
          values[placement.fieldApiName] = previewValueFor(placement.fieldType, fieldByApiName.get(placement.fieldApiName));
        }
      }

      const sections = [...layout.sections]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        // A section that hides on mobile is omitted rather than greyed out, which is what the
        // record page itself would do.
        .filter((section) => !(device === 'mobile' && section.responsiveBehaviour?.hideOnMobile))
        .map((section) => {
          const stacked = device !== 'desktop' && Boolean(section.responsiveBehaviour?.stackBelowBreakpoint);
          const columns = stacked || device === 'mobile' ? 1 : section.columns;
          return {
            id: section.id,
            label: section.label,
            columns,
            collapsible: section.collapsible,
            fields: [...section.fields]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((placement) => ({
                apiName: placement.fieldApiName,
                label: placement.fieldLabel,
                span: columns === 1 ? 1 : placement.span,
                required: placement.required,
                readOnly: placement.readOnly,
                value: displayPretext(values[placement.fieldApiName] ?? null),
                type: placement.fieldType,
                isSensitive: placement.isSensitive,
              })),
          };
        });

      // Rules that apply to this object are surfaced on the preview so a reviewer can see
      // that a layout and a rule are describing the same fields. They are read from the
      // store here rather than through a second service.
      const appliedRules = asRecords<ValidationRule>(db, 'validationRules')
        .filter(
          (rule) => rule.organizationId === organizationId && rule.objectApiName === layout.objectApiName && rule.active,
        )
        .slice(0, 6)
        .map((rule) => ({ ruleId: rule.id, effect: rule.errorMessage, fieldApiName: rule.errorField }));

      const model: LayoutPreviewModel = {
        layoutId: id,
        objectApiName: layout.objectApiName,
        objectLabel: object?.pluralLabel ?? humanise(layout.objectApiName),
        sampleRecord: {
          id: options?.recordId ?? `preview-${layout.objectApiName}`,
          label: `Sample ${object?.singularLabel ?? humanise(layout.objectApiName)}`,
          values,
        },
        sections,
        relatedLists: layout.relatedLists,
        appliedRules,
        unsaved: false,
      };
      return ok(model);
    },
  };
}

/* -------------------------------------------------------- industry templates */

export function makeIndustryTemplatesService(db: Db): ServiceContainer['industryTemplates'] {
  const crud = createCrud<IndustryTemplate>(db, 'industryTemplates', {
    label: 'Template',
    searchFields: ['name', 'summary', 'industryLabel'],
    facetField: 'industryLabel',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });

  const appliedCounts = (template: IndustryTemplate) => ({
    fields: template.contents.customFieldCount,
    objects: template.contents.customObjectCount,
    pipelines: template.contents.pipelineCount,
    workflows: template.contents.workflowCount,
    dashboards: template.contents.dashboardCount,
  });

  return {
    list: (query?: ListQuery) => crud.list(query),
    get: (id) => crud.get(id),

    /**
     * Installation is a simulation.
     *
     * The template's `isInstalled` flag is flipped so the gallery can show the state, and the
     * returned counts are the template's own declared scope. No object, field, pipeline or
     * workflow is created, and no sample data is loaded. The UI labels this at the point of
     * use; the service does not pretend otherwise.
     */
    install: async (id, options) => {
      await delay(`template-install:${id}`, { latency: { min: 360, max: 780 } });
      const template = db.state.industryTemplates[id];
      if (!template) return err('not_found', 'Template not found.');
      if (template.isInstalled && !options.overwriteExisting) {
        return err('conflict', 'This template is already installed. Choose “re-apply” to apply it again.');
      }
      db.put('industryTemplates', { ...template, isInstalled: true, installsCount: template.installsCount + 1 });
      return ok({ templateId: id, applied: appliedCounts(template) });
    },

    /**
     * What an install *would* add, computed against the current tenant so conflicts are real.
     *
     * Standard objects listed by a template (`account`, `deal`, …) are not conflicts: a custom
     * object with the same API name would be, and that is what is checked here.
     */
    previewChanges: async (id) => {
      await delay(`template-preview:${id}`, { latency: { min: 160, max: 360 } });
      const template = db.state.industryTemplates[id];
      if (!template) {
        return err<{ additions: Array<{ kind: string; label: string; count: number }>; conflicts: Array<{ kind: string; label: string; existingLabel: string }> }>(
          'not_found',
          'Template not found.',
        );
      }
      const organizationId = currentOrganizationId(db);
      const existingObjects = Object.values(db.state.customObjects).filter((object) => object.organizationId === organizationId);
      const existingFields = asRecords<CustomField>(db, 'customFields').filter((field) => field.organizationId === organizationId);

      const objectConflicts = template.contents.objectApiNames
        .filter((apiName) => existingObjects.some((object) => object.apiName === apiName))
        .map((apiName) => ({
          kind: 'Custom object',
          label: apiName,
          existingLabel: existingObjects.find((object) => object.apiName === apiName)?.pluralLabel ?? apiName,
        }));
      const fieldConflicts = template.sampleFields
        .flatMap((group) => group.fields.map((field) => field.label))
        .filter((label) => existingFields.some((field) => field.label === label))
        .map((label) => ({
          kind: 'Custom field',
          label,
          existingLabel: existingFields.find((field) => field.label === label)?.apiName ?? label,
        }));

      const additions = [
        { kind: 'Custom object', label: template.contents.customObjectCount === 1 ? '1 custom object' : `${template.contents.customObjectCount} custom objects`, count: template.contents.customObjectCount },
        { kind: 'Custom field', label: `${template.contents.customFieldCount} fields across the objects above`, count: template.contents.customFieldCount },
        { kind: 'Pipeline', label: template.samplePipeline.name, count: template.contents.pipelineCount },
        { kind: 'Workflow', label: `${template.contents.workflowCount} automations`, count: template.contents.workflowCount },
        { kind: 'Dashboard', label: `${template.contents.dashboardCount} dashboard with ${template.sampleDashboardWidgets.length} widgets`, count: template.contents.dashboardCount },
        { kind: 'Report', label: `${template.contents.reportCount} reports`, count: template.contents.reportCount },
        { kind: 'Template', label: `${template.contents.templateCounts.emailTemplates} email, ${template.contents.templateCounts.documentTemplates} document, ${template.contents.templateCounts.taskTemplates} task templates`, count: template.contents.templateCounts.emailTemplates + template.contents.templateCounts.documentTemplates + template.contents.templateCounts.taskTemplates },
      ].filter((entry) => entry.count > 0);

      return ok({ additions, conflicts: [...objectConflicts, ...fieldConflicts] });
    },

    /**
     * Uninstall removes the template's own artefacts only. Record data created by people is
     * never touched, and `retained` reports how much of it stays so the confirmation can say
     * so concretely.
     */
    uninstall: async (id) => {
      await delay(`template-uninstall:${id}`, { latency: { min: 260, max: 560 } });
      const template = db.state.industryTemplates[id];
      if (!template) return err('not_found', 'Template not found.');
      if (!template.isInstalled) return err('conflict', 'This template is not installed.');

      db.put('industryTemplates', { ...template, isInstalled: false });

      const organizationId = currentOrganizationId(db);
      const retainedRecords = Object.values(db.state.customObjects)
        .filter((object) => object.organizationId === organizationId)
        .reduce((sum, object) => sum + object.recordCount, 0);
      const retainedFields = asRecords<CustomField>(db, 'customFields').filter((field) => field.organizationId === organizationId).length;
      const removed = Object.values(appliedCounts(template)).reduce((sum, count) => sum + count, 0);

      return ok({ templateId: id, removed, retained: retainedRecords + retainedFields });
    },
  };
}

/* ---------------------------------------------------------------- navigation */

type NavSection = NavigationItemConfig['section'];

interface NavBaselineItem {
  key: string;
  label: string;
  route: string;
  icon: string;
  section: NavSection;
  order: number;
  isCustom: boolean;
  tone?: Tone;
}

const NAV_SECTIONS: Array<{ key: NavSection; label: string }> = [
  { key: 'workspace', label: 'Workspace' },
  { key: 'sales', label: 'Sales' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'service', label: 'Service' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'insights', label: 'Insights' },
  { key: 'automation', label: 'Automation' },
  { key: 'customize', label: 'Customise' },
];

const NAV_BASELINE: NavBaselineItem[] = [
  { key: 'home', label: 'Home', route: '/app/home', icon: 'Home', section: 'workspace', order: 10, isCustom: false },
  { key: 'my-work', label: 'My work', route: '/app/activities', icon: 'CheckSquare', section: 'workspace', order: 20, isCustom: false },
  { key: 'leads', label: 'Leads', route: '/app/leads', icon: 'Target', section: 'sales', order: 10, isCustom: false },
  { key: 'contacts', label: 'Contacts', route: '/app/contacts', icon: 'Users', section: 'sales', order: 20, isCustom: false },
  { key: 'accounts', label: 'Accounts', route: '/app/accounts', icon: 'Building2', section: 'sales', order: 30, isCustom: false },
  { key: 'deals', label: 'Deals', route: '/app/deals', icon: 'Handshake', section: 'sales', order: 40, isCustom: false },
  { key: 'campaigns', label: 'Campaigns', route: '/app/campaigns', icon: 'Megaphone', section: 'marketing', order: 10, isCustom: false },
  { key: 'tickets', label: 'Tickets', route: '/app/tickets', icon: 'LifeBuoy', section: 'service', order: 10, isCustom: false },
  { key: 'knowledge-base', label: 'Knowledge base', route: '/app/knowledge-base', icon: 'BookOpen', section: 'service', order: 20, isCustom: false },
  { key: 'inbox', label: 'Inbox', route: '/app/inbox', icon: 'Inbox', section: 'service', order: 30, isCustom: false },
  { key: 'products', label: 'Products', route: '/app/products', icon: 'Package', section: 'revenue', order: 10, isCustom: false },
  { key: 'quotes', label: 'Quotes', route: '/app/quotes', icon: 'FileText', section: 'revenue', order: 20, isCustom: false },
  { key: 'orders', label: 'Orders', route: '/app/orders', icon: 'ClipboardList', section: 'revenue', order: 30, isCustom: false },
  { key: 'documents', label: 'Documents', route: '/app/documents', icon: 'FolderOpen', section: 'productivity', order: 10, isCustom: false },
  { key: 'projects', label: 'Projects', route: '/app/projects', icon: 'KanbanSquare', section: 'productivity', order: 20, isCustom: false },
  { key: 'analytics', label: 'Analytics', route: '/app/analytics', icon: 'BarChart3', section: 'insights', order: 10, isCustom: false },
  { key: 'workflows', label: 'Workflows', route: '/app/workflows', icon: 'Workflow', section: 'automation', order: 10, isCustom: false },
  { key: 'ai', label: 'AI assistant', route: '/app/ai', icon: 'Sparkles', section: 'automation', order: 20, isCustom: false },
  { key: 'integrations', label: 'Integrations', route: '/app/integrations', icon: 'Plug', section: 'automation', order: 30, isCustom: false },
  { key: 'customization', label: 'Customization', route: '/app/customization/objects', icon: 'Settings2', section: 'customize', order: 10, isCustom: false },
  { key: 'templates', label: 'Industry templates', route: '/app/templates', icon: 'LayoutTemplate', section: 'customize', order: 20, isCustom: false },
];

/** Map a custom object's `navigation.section` onto a preview section. */
function sectionForObject(object: CustomObject): NavSection | 'hidden' {
  if (!object.navigation.showInSidebar || object.navigation.section === 'hidden') return 'hidden';
  return object.navigation.section;
}

interface NavOverride {
  visible?: boolean;
  order?: number;
  section?: NavSection;
  label?: string;
}

export function makeNavigationService(db: Db): ServiceContainer['navigation'] {
  /**
   * Overrides live in this closure for the session.
   *
   * There is no navigation collection to write to, and inventing one would require a schema
   * change that is out of this batch's scope. Keeping the edit in memory is honest: the
   * screen can show the change immediately, and `reset()` restores the derived baseline. The
   * service contract has no persistence promise, so none is made.
   */
  const overrides = new Map<string, NavOverride>();

  const buildPreview = (): CustomNavigationPreview => {
    const organizationId = currentOrganizationId(db);
    const customObjects = Object.values(db.state.customObjects).filter((object) => object.organizationId === organizationId);

    const derived: NavBaselineItem[] = [...NAV_BASELINE];
    for (const object of customObjects) {
      const section = sectionForObject(object);
      derived.push({
        key: `object:${object.apiName}`,
        label: object.pluralLabel,
        route: `/app/objects/${object.apiName}`,
        icon: object.icon,
        section: section === 'hidden' ? 'customize' : section,
        order: object.navigation.sortOrder,
        isCustom: true,
        tone: object.tone,
      });
    }

    let hiddenItemCount = 0;
    const sections = NAV_SECTIONS.map((section) => {
      const items = derived
        .filter((item) => item.section === section.key)
        .map((item) => {
          const override = overrides.get(item.key);
          const visible = override?.visible ?? (item.isCustom ? sectionForObject(customObjects.find((object) => `object:${object.apiName}` === item.key) ?? ({ navigation: { showInSidebar: true, section: 'customize' } } as CustomObject)) !== 'hidden' : true);
          if (!visible) hiddenItemCount += 1;
          return {
            key: item.key,
            label: override?.label ?? item.label,
            icon: item.icon,
            route: item.route,
            visible,
            tone: item.tone,
          };
        })
        .sort((a, b) => {
          const orderA = overrides.get(a.key)?.order ?? derived.find((item) => item.key === a.key)?.order ?? 0;
          const orderB = overrides.get(b.key)?.order ?? derived.find((item) => item.key === b.key)?.order ?? 0;
          return orderA - orderB;
        });
      return { key: section.key, label: section.label, items };
    }).filter((section) => section.items.length > 0);

    return { sections, hiddenItemCount, updatedAt: new Date().toISOString() };
  };

  return {
    get: async () => {
      await delay('navigation-get', { latency: { min: 60, max: 160 } });
      return ok(buildPreview());
    },

    update: async (items) => {
      await delay('navigation-update', { latency: { min: 120, max: 260 } });
      for (const item of items) {
        const existing = overrides.get(item.key) ?? {};
        overrides.set(item.key, {
          visible: item.visible,
          order: item.order,
          section: (item.section as NavSection) || existing.section,
          label: item.label ?? existing.label,
        });
      }
      return ok(buildPreview());
    },

    reset: async () => {
      overrides.clear();
      return ok(buildPreview());
    },
  };
}

/* ------------------------------------------------------------------ assembly */

/**
 * The three customization-extras modules in one call.
 *
 * Mirrors `makeCustomizationService`, so the container assembly reads as one line per module
 * group. Individual factories are exported too, so a test can build only what it needs.
 */
export function makeCustomizationExtrasService(db: Db): {
  layouts: ServiceContainer['layouts'];
  industryTemplates: ServiceContainer['industryTemplates'];
  navigation: ServiceContainer['navigation'];
} {
  return {
    layouts: makeLayoutsService(db),
    industryTemplates: makeIndustryTemplatesService(db),
    navigation: makeNavigationService(db),
  };
}
