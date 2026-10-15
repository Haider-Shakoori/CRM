'use client';

import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ExternalLink, LifeBuoy, MessageSquare, Rocket } from 'lucide-react';
import { Alert, Badge, Button, Card, DemoNotice } from '@crm/ui';
import { PageHeader } from '../../components/shared';

/**
 * Where the build stands.
 *
 * A single screen that answers the question a reviewer asks second, after "does it work?":
 * "how much of this is real?". Keeping it inside the product rather than in a document means
 * it cannot drift out of date without someone noticing.
 *
 * Nothing here is aspirational marketing. Every claim is either verifiable by clicking a link
 * on this page, or explicitly labelled as not built.
 */

const FINISHED = [
  { label: 'Home dashboard', to: '/app/home', note: 'Role-resolved widgets, editable layout, saved immediately' },
  { label: 'Leads', to: '/app/leads', note: 'Filters, facets, saved views, explainable scoring, bulk actions' },
  { label: 'Lead conversion', to: '/app/leads', note: 'Preview writes nothing, then an explicit commit' },
  { label: 'Deals board', to: '/app/deals', note: 'Drag and keyboard moves through one write path; totals recompute on every move' },
  { label: 'Deals list and detail', to: '/app/deals/list', note: 'Server-shaped sorting, product lines, stage selector, activity timeline' },
  { label: 'Forecast', to: '/app/deals/forecast', note: 'Commit, best case and coverage with accuracy tracking' },
  { label: 'My work', to: '/app/activities', note: 'Overdue first, task completion leaves the plan, undoable' },
  { label: 'Organization switcher', to: '/app/settings/organization', note: 'Three tenants with genuinely disjoint data' },
  { label: 'Command palette', to: '/app/home', note: '⌘K, keyboard navigation, live record search' },
];

const NOT_BUILT = [
  { label: 'Contacts and accounts', note: 'Routes resolve to a labelled placeholder' },
  { label: 'Support, knowledge base and customer success', note: 'Service screens are scheduled' },
  { label: 'Campaigns, journeys and attribution', note: 'Marketing module is scheduled' },
  { label: 'Quotes, orders, contracts and recurring revenue', note: 'Revenue operations is scheduled' },
  { label: 'Analytics, reports and dashboards', note: 'The chart components exist; the screens do not' },
  { label: 'Workflows, AI assistant and integrations', note: 'Service layer is ready for these' },
  { label: 'Customization, templates and platform administration', note: 'Scheduled' },
];

export default function HelpCentre() {
  return (
    <div className="pb-10">
      <PageHeader
        title="Where the build stands"
        description="A frontend-only demonstration. Everything on this page is either verifiable by clicking it, or labelled as not built."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Help' }]}
        actions={
          <Button variant="secondary" size="sm" trailingIcon={<ExternalLink className="size-3.5" />} asChild>
            <Link to="/app/home">Back to the dashboard</Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <Alert tone="warning" title="No backend is connected">
          There is no server, database, authentication service, payment provider, messaging provider or AI
          service in this build. Everything is computed in your browser from a seeded, synthetic dataset,
          and every simulated action says so where it happens.
        </Alert>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
              <Rocket className="size-4 text-success-fg" aria-hidden />
              Working end to end
            </h2>
            <Badge variant="success" size="sm">
              {FINISHED.length} screens
            </Badge>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {FINISHED.map((entry) => (
              <li key={entry.label}>
                <Link to={entry.to} className="group flex items-start gap-3 px-4 py-2.5 hover:bg-hover">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-fg">{entry.label}</span>
                    <span className="mt-0.5 block text-[0.6875rem] leading-snug text-muted">{entry.note}</span>
                  </span>
                  <ArrowRight
                    className="mt-0.5 size-3.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
              <BookOpen className="size-4 text-subtle" aria-hidden />
              Not built yet
            </h2>
            <DemoNotice tone="neutral">Placeholder routes</DemoNotice>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {NOT_BUILT.map((entry) => (
              <li key={entry.label} className="flex items-start gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-fg">{entry.label}</span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-snug text-muted">{entry.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border-subtle px-4 py-3">
            <p className="text-[0.6875rem] leading-relaxed text-muted">
              Each of these routes resolves to a page that names the module, describes what it will do and links
              back to the screens that are finished. None of them pretends to be complete.
            </p>
          </div>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
              <MessageSquare className="size-4 text-subtle" aria-hidden />
              Keyboard
            </h2>
            <dl className="mt-3 space-y-2">
              {[
                { keys: '⌘K / Ctrl+K', label: 'Search or jump to any screen' },
                { keys: 'Tab', label: 'Reach every control, including the pipeline move buttons' },
                { keys: '↑ ↓', label: 'Navigate the command palette results' },
                { keys: 'Enter', label: 'Open the highlighted result, or open a focused card' },
                { keys: 'Esc', label: 'Close a panel, palette or drawer' },
              ].map((row) => (
                <div key={row.keys} className="flex items-start justify-between gap-3">
                  <dt className="text-[0.6875rem] text-muted">{row.label}</dt>
                  <dd className="shrink-0">
                    <kbd className="rounded border border-border bg-inset px-1.5 py-px font-mono text-[0.625rem] text-subtle">
                      {row.keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
              <LifeBuoy className="size-4 text-subtle" aria-hidden />
              Demonstration data
            </h2>
            <ul className="mt-3 space-y-2.5 text-[0.6875rem] leading-relaxed text-muted">
              <li>
                <span className="font-medium text-fg">Three tenants.</span> Each has its own currency, locale,
                industry and module entitlement, so switching organization changes what you see.
              </li>
              <li>
                <span className="font-medium text-fg">Generated from a fixed seed.</span> Reloading produces
                the same records, which is why screenshots and tests are stable.
              </li>
              <li>
                <span className="font-medium text-fg">Stored in this browser.</span> Clearing site data, or using
                the reset control on the dashboard, restores the original state.
              </li>
              <li>
                <span className="font-medium text-fg">Explicit reset.</span> The dashboard offers a full reset that
                discards every change you have made.
              </li>
            </ul>
          </Card>
        </div>

        <p className="text-[0.625rem] leading-relaxed text-faint">
          This page is part of the product deliberately: a status screen inside the thing it describes is much harder
          to let go stale than a document nobody opens.
        </p>
      </div>
    </div>
  );
}
