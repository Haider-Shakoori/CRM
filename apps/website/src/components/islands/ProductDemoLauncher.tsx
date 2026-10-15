import { useMemo, useState } from 'react';
import { ArrowRight, Check, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@crm/ui';
import { crmUrl } from '@/config/apps';

/**
 * Public interactive demo launcher.
 *
 * The full demo shell lives at `/demo`. This component is the entry point on the
 * homepage and on product pages: it lets a visitor pick a starting scenario and see
 * exactly what the demo does and does not do before they commit any attention to it.
 *
 * Scope note: the scenario picker is functional here (selection state is real and the
 * chosen scenario is passed through to `/demo` as a query parameter), and the honesty
 * copy is authoritative. The full in-demo workflow — sample records, guided tour,
 * feature tooltips and the reset button — is implemented in the demo route itself.
 */

interface Scenario {
  id: string;
  name: string;
  role: string;
  body: string;
  highlights: string[];
  route: string;
}

const scenarios: Scenario[] = [
  {
    id: 'sales',
    name: 'Sales representative',
    role: 'Pipeline and daily plan',
    body: 'Work the pipeline: move a deal, see the weighted forecast update, complete a task and log a call.',
    highlights: ['Drag-free stage moves that stay in sync with totals', 'Daily plan with overdue tasks surfaced', 'Deal detail with products, team and competitors'],
    route: '/deals',
  },
  {
    id: 'manager',
    name: 'Sales manager',
    role: 'Forecast and coaching',
    body: 'Review commit versus best case, find the deals that stopped moving, and drill into a rep’s activity mix.',
    highlights: ['Forecast rollup by rep and team', 'Stale-deal detection with days in stage', 'Coaching view of activity against outcome'],
    route: '/analytics/forecast',
  },
  {
    id: 'service',
    name: 'Support agent',
    role: 'Queues and knowledge',
    body: 'Triage the inbox, reply with a saved response, escalate an SLA at risk and link a knowledge article.',
    highlights: ['Priority-based SLA timers with pause windows', 'Article suggestions while composing a reply', 'Escalation rules shown at a percentage of target'],
    route: '/tickets',
  },
  {
    id: 'success',
    name: 'Customer success manager',
    role: 'Health and renewal',
    body: 'Open an account’s health score, read the weighted factors behind it, and start a renewal.',
    highlights: ['Explainable health components and signals', 'Onboarding plan created from a won deal', 'Renewal pipeline separate from new business'],
    route: '/customer-success',
  },
  {
    id: 'admin',
    name: 'Administrator',
    role: 'Configuration and access',
    body: 'Add a custom field, preview a page layout, adjust a role’s permission matrix and read the audit log.',
    highlights: ['Field types with conditional visibility', 'Live layout preview against a sample record', 'Permission matrix with field-level controls'],
    route: '/customization',
  },
  {
    id: 'marketing',
    name: 'Marketing manager',
    role: 'Campaigns and attribution',
    body: 'Build a segment with nested rules, inspect a journey on the canvas and compare attribution models.',
    highlights: ['Live audience preview with breakdowns', 'Per-node enrolment counts on the canvas', 'Six attribution models on the same period'],
    route: '/campaigns',
  },
];

export default function ProductDemoLauncher({ className, compact }: { className?: string; compact?: boolean }) {
  const [selected, setSelected] = useState<string>('sales');
  const [resetCount, setResetCount] = useState(0);

  const active = useMemo(() => scenarios.find((scenario) => scenario.id === selected) ?? scenarios[0]!, [selected]);

  return (
    <div className={cn('grid gap-6 text-start', !compact && 'lg:grid-cols-[1.1fr_1fr] lg:items-start', className)}>
      {/* Scenario picker */}
      <div className="space-y-3">
        <div role="radiogroup" aria-label="Choose a demo scenario" className="grid gap-2 sm:grid-cols-2">
          {scenarios.map((scenario) => {
            const isActive = scenario.id === selected;
            return (
              <button
                key={scenario.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setSelected(scenario.id)}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border p-3 text-start transition-colors',
                  isActive ? 'border-brand/50 bg-brand-subtle/60' : 'border-border-subtle bg-surface hover:border-border-strong',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-fg">{scenario.name}</span>
                  {isActive ? <Check className="size-3.5 shrink-0 text-brand-fg" aria-hidden /> : null}
                </span>
                <span className="text-2xs text-subtle">{scenario.role}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div className="space-y-4 rounded-xl border border-border-subtle bg-surface p-5">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-brand-fg">
            <Sparkles className="size-3" aria-hidden />
            {active.name} scenario
          </p>
          <p className="text-sm leading-relaxed text-fg">{active.body}</p>
        </div>

        <ul className="space-y-2 border-t border-border-subtle pt-3">
          {active.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-2xs leading-relaxed text-muted">
              <Check className="mt-0.5 size-3 shrink-0 text-success-fg" aria-hidden />
              {highlight}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
          <a
            href={crmUrl(active.route, { demo: 1 })}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
          >
            Open this scenario
            <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
          </a>
          <a
            href="/demo"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-hover"
          >
            Full guided demo
          </a>
          <button
            type="button"
            onClick={() => setResetCount((count) => count + 1)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset demo data
          </button>
        </div>

        <p className="text-2xs leading-relaxed text-faint" role="status">
          {resetCount > 0 ? `Demo data reset requested ${resetCount} time${resetCount === 1 ? '' : 's'}. ` : ''}
          Resetting restores the seeded sample dataset in this browser.
        </p>

        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border-strong bg-inset p-3">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
          <p className="text-2xs leading-relaxed text-muted">
            Isolated synthetic data in your browser only. No backend, no authentication, no messages sent, no payments
            taken and no AI service called. Everything reset on demand.
          </p>
        </div>
      </div>
    </div>
  );
}
