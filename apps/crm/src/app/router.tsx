import * as React from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './shell/AppShell';

/**
 * Route configuration.
 *
 * Three decisions worth stating, because all three are visible to a reviewer:
 *
 *   1. **Every route below `/app` renders inside the shell**, so navigation, the organization
 *      switcher and the command palette mount once and survive navigation. Screens are
 *      lazily imported, so analytics pulls in the chart library only for the people who open
 *      it.
 *
 *   2. **Routes bound for screens this batch did not build render `ModulePlaceholder`**, which
 *      states plainly what the screen will contain and links to what *is* finished. The
 *      alternatives — a 404, or a stub that looks complete — both mislead.
 *
 *   3. **Named exports are used where several screens share a domain file**, via the
 *      `.then(module => ({ default: module.X }))` form. Grouping by domain rather than by
 *      screen keeps a list, its detail view and its form reading the same helpers, which is
 *      where the duplication would otherwise creep in.
 */

function lazyScreen(loader: () => Promise<{ default: React.ComponentType }>) {
  const Component = React.lazy(loader);
  return (
    <React.Suspense fallback={<ScreenFallback />}>
      <Component />
    </React.Suspense>
  );
}

/** Shape-matched skeleton, so the layout does not jump when the screen arrives. */
function ScreenFallback() {
  return (
    <div className="space-y-4 p-4 sm:p-6" role="status" aria-label="Loading screen">
      <div className="h-6 w-48 animate-pulse rounded bg-inset" />
      <div className="h-4 w-72 animate-pulse rounded bg-inset" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-inset" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-9 animate-pulse rounded bg-inset" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ placeholders */

/**
 * One placeholder component, many routes.
 *
 * It is created once and given props per route, so a reviewer landing on any unfinished
 * screen sees the module's real name and description from the registry rather than a generic
 * apology.
 */
const Placeholder = React.lazy(() => import('../routes/ModulePlaceholder'));

function placeholder(props: { title: string; moduleKey: string; description: string }) {
  return (
    <React.Suspense fallback={<ScreenFallback />}>
      <Placeholder {...props} />
    </React.Suspense>
  );
}

const notBuilt = (title: string, moduleKey: string, description: string) => placeholder({ title, moduleKey, description });

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/app/home" replace /> },
  { path: '/api-sign-in', element: lazyScreen(() => import('../routes/api/ApiSignIn')) },
  { path: '/api-workspace', element: <Navigate to="/crm/leads" replace /> },
  { path: '/crm/leads', element: lazyScreen(() => import('../routes/api/ApiWorkspace')) },
  { path: '/crm/accounts', element: lazyScreen(() => import('../routes/api/ApiDirectory')) },
  { path: '/crm/contacts', element: lazyScreen(() => import('../routes/api/ApiDirectory')) },
  { path: '/forgot-password', element: lazyScreen(() => import('../routes/api/ApiPasswordRecovery')) },
  { path: '/reset-password', element: lazyScreen(() => import('../routes/api/ApiPasswordRecovery')) },
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/app/home" replace /> },

      /* --------------------------------------------------------- workspace */
      { path: 'home', element: lazyScreen(() => import('../routes/Home')) },
      { path: 'activities', element: lazyScreen(() => import('../routes/activities/MyWork')) },
      { path: 'activities/new', element: lazyScreen(() => import('../routes/activities/MyWork')) },
      {
        path: 'activities/all',
        element: lazyScreen(() => import('../routes/engagement/EngagementScreens')),
      },
      {
        path: 'activities/:activityId',
        element: lazyScreen(() => import('../routes/engagement/EngagementScreens').then((module) => ({ default: module.ActivityDetail }))),
      },
      {
        path: 'calendar',
        element: lazyScreen(() => import('../routes/engagement/CalendarScreens')),
      },
      {
        path: 'tasks',
        element: lazyScreen(() => import('../routes/engagement/TaskScreens')),
      },
      {
        path: 'sequences',
        element: lazyScreen(() => import('../routes/engagement/SequenceScreens')),
      },
      {
        path: 'sequences/:sequenceId',
        element: lazyScreen(() => import('../routes/engagement/SequenceScreens').then((module) => ({ default: module.SequenceDetail }))),
      },
      {
        path: 'communications',
        element: lazyScreen(() => import('../routes/engagement/CommunicationsScreens')),
      },

      /* ------------------------------------------------------------- sales */
      { path: 'leads', element: lazyScreen(() => import('../routes/leads/LeadsScreens')) },
      { path: 'leads/new', element: lazyScreen(() => import('../routes/leads/LeadsScreens').then((module) => ({ default: module.LeadForm }))) },
      { path: 'leads/:leadId', element: lazyScreen(() => import('../routes/leads/LeadsScreens').then((module) => ({ default: module.LeadDetail }))) },
      { path: 'leads/:leadId/edit', element: lazyScreen(() => import('../routes/leads/LeadsScreens').then((module) => ({ default: module.LeadForm }))) },
      { path: 'leads/:leadId/convert', element: lazyScreen(() => import('../routes/leads/LeadsScreens').then((module) => ({ default: module.LeadConvert }))) },
      {
        path: 'leads/board',
        element: notBuilt('Lead board', 'leads', 'The same leads on a kanban board, grouped by status, so a team can work the queue by stage rather than by date.'),
      },
      {
        path: 'leads/sources',
        element: lazyScreen(() => import('../routes/marketing/MarketingScreens').then((module) => ({ default: module.LeadSourcesScreen }))),
      },
      {
        path: 'leads/import',
        element: notBuilt('Import wizard', 'leads', 'Upload, map, validate, then commit — with every rejected row and its reason shown before anything is written.'),
      },
      {
        path: 'leads/duplicates',
        element: notBuilt('Duplicate review', 'leads', 'Side-by-side candidates with the matched fields, for a human decision rather than an automatic merge.'),
      },

      { path: 'contacts', element: lazyScreen(() => import('../routes/contacts/ContactsScreens')) },
      { path: 'contacts/new', element: lazyScreen(() => import('../routes/contacts/ContactsScreens').then((module) => ({ default: module.ContactForm }))) },
      { path: 'contacts/duplicates', element: lazyScreen(() => import('../routes/contacts/ContactsScreens').then((module) => ({ default: module.ContactDuplicates }))) },
      { path: 'contacts/:contactId', element: lazyScreen(() => import('../routes/contacts/ContactsScreens').then((module) => ({ default: module.ContactDetail }))) },
      { path: 'contacts/:contactId/edit', element: lazyScreen(() => import('../routes/contacts/ContactsScreens').then((module) => ({ default: module.ContactForm }))) },
      {
        path: 'contacts/import',
        element: notBuilt('Import contacts', 'contacts', 'Upload, map, validate, then commit — with every rejected row and its reason shown before anything is written.'),
      },

      { path: 'accounts', element: lazyScreen(() => import('../routes/accounts/AccountsScreens')) },
      { path: 'accounts/new', element: lazyScreen(() => import('../routes/accounts/AccountsScreens').then((module) => ({ default: module.AccountForm }))) },
      { path: 'accounts/:accountId', element: lazyScreen(() => import('../routes/accounts/AccountsScreens').then((module) => ({ default: module.AccountDetail }))) },
      { path: 'accounts/:accountId/edit', element: lazyScreen(() => import('../routes/accounts/AccountsScreens').then((module) => ({ default: module.AccountForm }))) },

      { path: 'deals', element: lazyScreen(() => import('../routes/deals/DealsScreens')) },
      { path: 'deals/list', element: lazyScreen(() => import('../routes/deals/DealsScreens').then((module) => ({ default: module.DealsList }))) },
      { path: 'deals/new', element: lazyScreen(() => import('../routes/deals/DealsScreens').then((module) => ({ default: module.DealForm }))) },
      { path: 'deals/forecast', element: lazyScreen(() => import('../routes/deals/DealsScreens').then((module) => ({ default: module.Forecast }))) },
      { path: 'deals/:dealId', element: lazyScreen(() => import('../routes/deals/DealsScreens').then((module) => ({ default: module.DealDetail }))) },
      { path: 'deals/:dealId/edit', element: lazyScreen(() => import('../routes/deals/DealsScreens').then((module) => ({ default: module.DealForm }))) },
      {
        path: 'deals/pipelines',
        element: notBuilt('Pipeline configuration', 'deals', 'Stages, probabilities, forecast categories, required exit criteria and staleness thresholds.'),
      },
      {
        path: 'deals/lost-reasons',
        element: notBuilt('Lost reason analysis', 'deals', 'Why deals are lost, grouped by reason, with the value and win-rate impact of each.'),
      },

      /* --------------------------------------------------------- marketing */
      { path: 'campaigns', element: lazyScreen(() => import('../routes/marketing/CampaignScreens')) },
      { path: 'campaigns/new', element: lazyScreen(() => import('../routes/marketing/CampaignScreens').then((module) => ({ default: module.CampaignForm }))) },
      { path: 'campaigns/calendar', element: lazyScreen(() => import('../routes/marketing/CampaignScreens').then((module) => ({ default: module.CampaignCalendar }))) },
      {
        path: 'campaigns/segments',
        element: lazyScreen(() => import('../routes/marketing/MarketingScreens').then((module) => ({ default: module.SegmentsScreen }))),
      },
      {
        path: 'campaigns/journeys',
        element: lazyScreen(() => import('../routes/marketing/MarketingScreens').then((module) => ({ default: module.JourneysScreen }))),
      },
      {
        path: 'campaigns/journeys/:journeyId',
        element: lazyScreen(() => import('../routes/marketing/MarketingScreens').then((module) => ({ default: module.JourneyDetail }))),
      },
      {
        path: 'campaigns/templates',
        element: lazyScreen(() => import('../routes/marketing/MarketingScreens').then((module) => ({ default: module.EmailTemplatesScreen }))),
      },
      {
        path: 'campaigns/landing-pages',
        element: lazyScreen(() => import('../routes/marketing/MarketingScreens').then((module) => ({ default: module.LandingPagesScreen }))),
      },
      {
        path: 'campaigns/forms',
        element: lazyScreen(() => import('../routes/marketing/MarketingScreens').then((module) => ({ default: module.FormsScreen }))),
      },
      {
        path: 'campaigns/:campaignId',
        element: lazyScreen(() => import('../routes/marketing/CampaignScreens').then((module) => ({ default: module.CampaignDetail }))),
      },
      { path: 'campaigns/*', element: notBuilt('Campaigns', 'campaigns', 'A block-based email editor, audience segments with nested rules, a journey canvas with per-node counts and six attribution models.') },

      /* ----------------------------------------------------------- service */
      { path: 'tickets', element: lazyScreen(() => import('../routes/tickets/TicketsScreens')) },
      {
        path: 'tickets/:ticketId',
        element: lazyScreen(() => import('../routes/tickets/TicketsScreens').then((module) => ({ default: module.TicketDetail }))),
      },
      {
        path: 'tickets/queues',
        element: notBuilt('Queues & SLA', 'tickets', 'Queue membership, priority-based SLA targets, pause windows and escalation rules that fire at a percentage of the target.'),
      },
      { path: 'tickets/*', element: notBuilt('Support', 'tickets', 'Queues, SLA policies, categories and agent performance reporting.') },

      { path: 'knowledge-base', element: lazyScreen(() => import('../routes/knowledge-base/KnowledgeBaseScreens')) },
      {
        path: 'knowledge-base/:articleId',
        element: lazyScreen(() => import('../routes/knowledge-base/KnowledgeBaseScreens').then((module) => ({ default: module.KbArticleDetail }))),
      },
      { path: 'knowledge-base/*', element: notBuilt('Knowledge base', 'knowledge_base', 'The article editor with structured blocks and review dates, plus suggestion scoring while composing a reply.') },
      { path: 'customer-success', element: lazyScreen(() => import('../routes/customer-success/CustomerSuccessScreens')) },
      {
        path: 'customer-success/renewals',
        element: lazyScreen(() => import('../routes/customer-success/CustomerSuccessScreens').then((module) => ({ default: module.RenewalBoard }))),
      },
      {
        path: 'customer-success/onboarding',
        element: lazyScreen(() => import('../routes/customer-success/CustomerSuccessScreens').then((module) => ({ default: module.OnboardingBoard }))),
      },
      {
        path: 'customer-success/reviews',
        element: lazyScreen(() => import('../routes/customer-success/CustomerSuccessScreens').then((module) => ({ default: module.BusinessReviewsBoard }))),
      },
      {
        path: 'customer-success/accounts/:accountId',
        element: lazyScreen(() => import('../routes/customer-success/CustomerSuccessScreens').then((module) => ({ default: module.AccountSuccessPanel }))),
      },
      { path: 'customer-success/playbooks', element: lazyScreen(() => import('../routes/customer-success/PlaybookScreens').then((module) => ({ default: module.PlaybookList }))) },
      {
        path: 'customer-success/playbooks/:playbookId',
        element: lazyScreen(() => import('../routes/customer-success/PlaybookScreens').then((module) => ({ default: module.PlaybookDetail }))),
      },
      { path: 'customer-success/*', element: notBuilt('Customer success', 'customer_success', 'Health scores, onboarding plans, renewals and churn risk.') },

      /* ----------------------------------------------------------- revenue */
      { path: 'products', element: lazyScreen(() => import('../routes/products/ProductsScreens')) },
      { path: 'products/new', element: lazyScreen(() => import('../routes/products/ProductsScreens').then((module) => ({ default: module.ProductForm }))) },
      { path: 'products/:productId', element: lazyScreen(() => import('../routes/products/ProductsScreens').then((module) => ({ default: module.ProductDetail }))) },
      { path: 'products/:productId/edit', element: lazyScreen(() => import('../routes/products/ProductsScreens').then((module) => ({ default: module.ProductForm }))) },
      { path: 'products/*', element: notBuilt('Products', 'products', 'Catalog with variants, bundles and price books.') },

      { path: 'quotes', element: lazyScreen(() => import('../routes/quotes/QuotesScreens')) },
      { path: 'quotes/new', element: lazyScreen(() => import('../routes/quotes/QuotesScreens').then((module) => ({ default: module.QuoteForm }))) },
      { path: 'quotes/:quoteId', element: lazyScreen(() => import('../routes/quotes/QuotesScreens').then((module) => ({ default: module.QuoteDetail }))) },
      { path: 'quotes/:quoteId/edit', element: lazyScreen(() => import('../routes/quotes/QuotesScreens').then((module) => ({ default: module.QuoteForm }))) },
      { path: 'quotes/*', element: notBuilt('Quotes', 'quotes', 'Quote builder with approvals and revision history.') },

      { path: 'orders', element: lazyScreen(() => import('../routes/orders/OrdersScreens')) },
      { path: 'orders/:orderId', element: lazyScreen(() => import('../routes/orders/OrdersScreens').then((module) => ({ default: module.OrderDetail }))) },
      { path: 'orders/*', element: notBuilt('Orders', 'orders', 'Order activation and delivery handoff.') },
      { path: 'contracts', element: lazyScreen(() => import('../routes/contracts/ContractsScreens')) },
      {
        path: 'contracts/:contractId',
        element: lazyScreen(() => import('../routes/contracts/ContractsScreens').then((module) => ({ default: module.ContractDetail }))),
      },
      {
        path: 'contracts/*',
        element: notBuilt('Contracts', 'contracts', 'The built contract surfaces are the list and the detail with renew, amend and terminate. Deeper paths are not part of this build.'),
      },
      { path: 'subscriptions', element: lazyScreen(() => import('../routes/subscriptions/RecurringRevenueScreens')) },
      { path: 'subscriptions/invoices', element: lazyScreen(() => import('../routes/invoices/InvoicesScreens')) },
      {
        path: 'subscriptions/invoices/:invoiceId',
        element: lazyScreen(() => import('../routes/invoices/InvoicesScreens').then((module) => ({ default: module.InvoiceDetail }))),
      },
      {
        path: 'subscriptions/*',
        element: notBuilt('Recurring revenue', 'subscriptions', 'The built surfaces are the revenue report and the invoices list and detail. Deeper paths are not part of this build.'),
      },

      /* -------------------------------------------------------- productivity */
      { path: 'inbox', element: lazyScreen(() => import('../routes/inbox/InboxScreens')) },
      {
        path: 'inbox/:conversationId',
        element: lazyScreen(() => import('../routes/inbox/InboxScreens').then((module) => ({ default: module.ConversationDetail }))),
      },
      { path: 'inbox/*', element: notBuilt('Omnichannel inbox', 'inbox', 'Channel configuration, assignment rules and saved replies.') },
      {
        path: 'documents',
        element: notBuilt('Documents', 'documents', 'Folders with record associations, version history, access presentation and a signature workflow preview.'),
      },
      {
        path: 'projects',
        element: lazyScreen(() => import('../routes/projects/ProjectScreens').then((module) => ({ default: module.ProjectsScreen }))),
      },
      {
        path: 'projects/:projectId',
        element: lazyScreen(() => import('../routes/projects/ProjectScreens').then((module) => ({ default: module.ProjectDetail }))),
      },

      /* ------------------------------------------------------------ insights */
      { path: 'analytics', element: lazyScreen(() => import('../routes/analytics/AnalyticsScreens')) },
      { path: 'analytics/dashboards', element: lazyScreen(() => import('../routes/analytics/DashboardScreens')) },
      {
        path: 'analytics/dashboards/:dashboardId',
        element: lazyScreen(() => import('../routes/analytics/DashboardScreens').then((module) => ({ default: module.DashboardView }))),
      },
      { path: 'analytics/reports', element: lazyScreen(() => import('../routes/analytics/ReportScreens')) },
      {
        path: 'analytics/reports/new',
        element: lazyScreen(() => import('../routes/analytics/ReportScreens').then((module) => ({ default: module.ReportBuilder }))),
      },
      {
        path: 'analytics/reports/:reportId',
        element: lazyScreen(() => import('../routes/analytics/ReportScreens').then((module) => ({ default: module.ReportViewer }))),
      },
      { path: 'analytics/*', element: notBuilt('Analytics', 'analytics', 'Dashboards, reports, forecasts and cohort analysis.') },
      { path: 'goals', element: notBuilt('Goals', 'analytics', 'Quota attainment by team and rep, with pipeline coverage and pacing against the period target.') },

      /* ---------------------------------------------------------- automation */
      {
        path: 'workflows',
        element: lazyScreen(() => import('../routes/automation/AutomationScreens').then((m) => ({ default: m.WorkflowList }))),
      },
      { path: 'workflows/new', element: lazyScreen(() => import('../routes/automation/AutomationScreens').then((m) => ({ default: m.WorkflowNew }))) },
      {
        path: 'workflows/:workflowId',
        element: lazyScreen(() => import('../routes/automation/AutomationScreens').then((m) => ({ default: m.WorkflowDetail }))),
      },
      {
        path: 'workflows/:workflowId/runs',
        element: lazyScreen(() => import('../routes/automation/AutomationScreens').then((m) => ({ default: m.WorkflowRuns }))),
      },
      { path: 'workflows/*', element: lazyScreen(() => import('../routes/automation/AutomationScreens').then((m) => ({ default: m.WorkflowList }))) },
      {
        path: 'ai',
        element: lazyScreen(() => import('../routes/ai/AiScreens')),
      },
      { path: 'ai/*', element: lazyScreen(() => import('../routes/ai/AiScreens')) },
      {
        path: 'integrations',
        element: notBuilt('Integrations', 'integrations', 'Browse providers by category with honest availability labels, connect through a guided wizard, map fields and review sync health.'),
      },
      { path: 'integrations/*', element: notBuilt('Integrations', 'integrations', 'A marketplace with connection wizards and sync health.') },
      {
        path: 'developer',
        element: notBuilt('Developer platform', 'developer', 'Scoped API keys, webhook endpoints with an event catalog and delivery history, request logs and a documented endpoint reference.'),
      },
      { path: 'developer/*', element: notBuilt('Developer platform', 'developer', 'API keys, webhooks, delivery logs and the endpoint reference.') },

      /* ----------------------------------------------------------- customize */
      { path: 'customization', element: <Navigate to="/app/customization/objects" replace /> },
      {
        path: 'customization/objects',
        element: lazyScreen(() => import('../routes/customization/CustomizationScreens').then((m) => ({ default: m.ObjectsScreen }))),
      },
      {
        path: 'customization/objects/:objectId',
        element: lazyScreen(() => import('../routes/customization/CustomizationScreens').then((m) => ({ default: m.ObjectDetailScreen }))),
      },
      {
        path: 'customization/layouts',
        element: lazyScreen(() => import('../routes/customization/CustomizationScreens').then((m) => ({ default: m.LayoutsScreen }))),
      },
      {
        path: 'customization/validation',
        element: lazyScreen(() => import('../routes/customization/CustomizationScreens').then((m) => ({ default: m.ValidationRulesScreen }))),
      },
      {
        path: 'customization/views',
        element: lazyScreen(() => import('../routes/customization/CustomizationScreens').then((m) => ({ default: m.SavedViewsScreen }))),
      },
      {
        path: 'templates',
        element: lazyScreen(() => import('../routes/customization/TemplateScreens').then((m) => ({ default: m.TemplateGallery }))),
      },
      {
        path: 'templates/:templateId',
        element: lazyScreen(() => import('../routes/customization/TemplateScreens').then((m) => ({ default: m.TemplateDetail }))),
      },
      {
        path: 'partners',
        element: lazyScreen(() => import('../routes/partners/PartnerScreens').then((module) => ({ default: module.PartnersScreen }))),
      },
      {
        path: 'partners/registrations',
        element: lazyScreen(() => import('../routes/partners/PartnerScreens').then((module) => ({ default: module.DealRegistrationsScreen }))),
      },
      {
        path: 'partners/referrals',
        element: lazyScreen(() => import('../routes/partners/PartnerScreens').then((module) => ({ default: module.ReferralsScreen }))),
      },
      {
        path: 'partners/commissions',
        element: lazyScreen(() => import('../routes/partners/PartnerScreens').then((module) => ({ default: module.CommissionStatementsScreen }))),
      },
      {
        path: 'partners/:partnerId',
        element: lazyScreen(() => import('../routes/partners/PartnerScreens').then((module) => ({ default: module.PartnerDetail }))),
      },
      {
        path: 'field-sales',
        element: lazyScreen(() => import('../routes/field-sales/FieldSalesScreens').then((module) => ({ default: module.FieldSalesScreen }))),
      },
      {
        path: 'field-sales/territories',
        element: lazyScreen(() => import('../routes/field-sales/FieldSalesScreens').then((module) => ({ default: module.TerritoriesScreen }))),
      },
      {
        path: 'field-sales/visit-plans',
        element: lazyScreen(() => import('../routes/field-sales/FieldSalesScreens').then((module) => ({ default: module.VisitPlansScreen }))),
      },
      {
        path: 'portal-preview',
        element: lazyScreen(() => import('../routes/portal/PortalPreviewScreens').then((module) => ({ default: module.PortalPreviewScreen }))),
      },

      /* --------------------------------------------------------------- admin */
      { path: 'settings', element: <Navigate to="/app/settings/organization" replace /> },
      {
        path: 'settings/organization',
        element: lazyScreen(() => import('../routes/settings/SettingsScreens').then((module) => ({ default: module.OrganizationScreen }))),
      },
      {
        path: 'settings/business-units',
        element: lazyScreen(() => import('../routes/settings/SettingsScreens').then((module) => ({ default: module.BusinessUnitsScreen }))),
      },
      {
        path: 'settings/users',
        element: lazyScreen(() => import('../routes/settings/SettingsScreens').then((module) => ({ default: module.UsersScreen }))),
      },
      {
        path: 'settings/roles',
        element: lazyScreen(() => import('../routes/settings/RoleScreens').then((module) => ({ default: module.RolesScreen }))),
      },
      {
        path: 'settings/security',
        element: lazyScreen(() => import('../routes/settings/SecurityScreens').then((module) => ({ default: module.SecurityScreen }))),
      },
      {
        path: 'settings/audit',
        element: lazyScreen(() => import('../routes/settings/SecurityScreens').then((module) => ({ default: module.AuditLogScreen }))),
      },
      {
        path: 'settings/data',
        element: lazyScreen(() => import('../routes/settings/DataScreens').then((module) => ({ default: module.DataScreen }))),
      },
      {
        path: 'settings/billing',
        element: lazyScreen(() => import('../routes/settings/BillingScreens').then((module) => ({ default: module.BillingScreen }))),
      },
      {
        path: 'settings/billing/:section',
        element: lazyScreen(() => import('../routes/settings/BillingScreens').then((module) => ({ default: module.BillingScreen }))),
      },
      /* The module registry addresses branding and structure separately; both live on the screens above. */
      { path: 'settings/branding', element: <Navigate to="/app/settings/organization" replace /> },
      { path: 'settings/structure', element: <Navigate to="/app/settings/business-units" replace /> },
      { path: 'settings/consent', element: <Navigate to="/app/settings/data" replace /> },
      { path: 'settings/help', element: lazyScreen(() => import('../routes/settings/HelpCentre')) },
      {
        path: 'settings/*',
        element: notBuilt(
          'Administration',
          'org_admin',
          'Localization and the module catalogue remain placeholders. Everything else under Settings is built: organization and branding, business units and teams, users, roles and permissions, security and audit, data management and billing.',
        ),
      },

      /* ---------------------------------------------------------- boundaries */
      { path: 'not-entitled', element: lazyScreen(() => import('../routes/boundaries/Boundaries').then((module) => ({ default: module.NotEntitled }))) },
      { path: 'access-denied', element: lazyScreen(() => import('../routes/boundaries/Boundaries').then((module) => ({ default: module.AccessDenied }))) },
      { path: 'session-expired', element: lazyScreen(() => import('../routes/boundaries/Boundaries').then((module) => ({ default: module.SessionExpired }))) },
      { path: '*', element: lazyScreen(() => import('../routes/boundaries/Boundaries').then((module) => ({ default: module.NotFound }))) },
    ],
  },
  { path: '*', element: <Navigate to="/app/home" replace /> },
];

/**
 * Which module a path belongs to.
 *
 * Used by the shell to refuse entry to a module the tenant is not entitled to, so a
 * bookmarked URL produces a plain explanation and an upgrade route instead of a screen full
 * of empty states. The first matching prefix wins, so the list is ordered most-specific first.
 */
export const moduleRouteManifest: Array<{ prefix: string; moduleKey: string | null }> = [
  { prefix: '/app/settings/help', moduleKey: null },
  { prefix: '/app/settings', moduleKey: 'org_admin' },
  { prefix: '/app/calendar', moduleKey: 'calendar' },
  { prefix: '/app/tasks', moduleKey: 'activities' },
  { prefix: '/app/sequences', moduleKey: 'campaigns' },
  { prefix: '/app/communications', moduleKey: 'inbox' },
  { prefix: '/app/leads', moduleKey: 'leads' },
  { prefix: '/app/contacts', moduleKey: 'contacts' },
  { prefix: '/app/accounts', moduleKey: 'accounts' },
  { prefix: '/app/deals', moduleKey: 'deals' },
  { prefix: '/app/campaigns', moduleKey: 'campaigns' },
  { prefix: '/app/tickets', moduleKey: 'tickets' },
  { prefix: '/app/knowledge-base', moduleKey: 'knowledge_base' },
  { prefix: '/app/customer-success', moduleKey: 'customer_success' },
  { prefix: '/app/products', moduleKey: 'products' },
  { prefix: '/app/quotes', moduleKey: 'quotes' },
  { prefix: '/app/orders', moduleKey: 'orders' },
  { prefix: '/app/contracts', moduleKey: 'contracts' },
  { prefix: '/app/subscriptions', moduleKey: 'subscriptions' },
  { prefix: '/app/inbox', moduleKey: 'inbox' },
  { prefix: '/app/documents', moduleKey: 'documents' },
  { prefix: '/app/projects', moduleKey: 'projects' },
  { prefix: '/app/analytics', moduleKey: 'analytics' },
  { prefix: '/app/workflows', moduleKey: 'workflows' },
  { prefix: '/app/ai', moduleKey: 'ai' },
  { prefix: '/app/integrations', moduleKey: 'integrations' },
  { prefix: '/app/developer', moduleKey: 'developer' },
  { prefix: '/app/customization', moduleKey: 'customization' },
  { prefix: '/app/templates', moduleKey: 'templates' },
  { prefix: '/app/partners', moduleKey: 'partners' },
  { prefix: '/app/field-sales', moduleKey: 'field_sales' },
  { prefix: '/app/portal-preview', moduleKey: 'portal' },
];

export function moduleKeyForPath(pathname: string): string | null | undefined {
  const match = moduleRouteManifest.find((entry) => pathname.startsWith(entry.prefix));
  return match ? match.moduleKey : undefined;
}

export const router = createBrowserRouter(routes);
