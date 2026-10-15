import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { planComparison, plans, type PlanId } from '@crm/configuration';
import { cn } from '@crm/ui';
import { ComparisonRow } from '@/components/islands/PricingTable';

/**
 * Full plan comparison matrix.
 *
 * Two usability decisions matter more than the data itself:
 *  1. The decisive rows are shown first and the rest are behind "show all features",
 *     because a 55-row table presented at once is unreadable on any screen.
 *  2. The table is horizontally scrollable with a sticky first column on narrow
 *     screens rather than collapsing into an accordion, so plans stay comparable.
 */

const comparedPlans: PlanId[] = ['free', 'starter', 'professional', 'enterprise', 'custom_enterprise'];
const planLabels = new Map(plans.map((plan) => [plan.id, plan.name]));

export default function PlanComparisonTable() {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const categories = useMemo(() => {
    const filtered = planComparison.filter(
      (row) => !query || row.feature.toLowerCase().includes(query.toLowerCase()) || row.category.toLowerCase().includes(query.toLowerCase()),
    );
    const visible = showAll || query ? filtered : filtered.filter((row) => row.highlighted);
    const map = new Map<string, typeof planComparison>();
    for (const row of visible) {
      if (!map.has(row.category)) map.set(row.category, []);
      map.get(row.category)!.push(row);
    }
    return { groups: [...map.entries()], total: filtered.length, shown: visible.length };
  }, [showAll, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search features…"
            aria-label="Search the feature comparison"
            className="h-9 w-full rounded-md border border-border bg-surface ps-8 pe-3 text-xs text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/25"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-2xs text-subtle" aria-live="polite">
            Showing {categories.shown} of {categories.total} features
          </p>
          {!query ? (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-hover"
              aria-expanded={showAll}
            >
              {showAll ? 'Show key features only' : 'Show all features'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className="w-full min-w-[46rem] border-collapse">
          <caption className="sr-only">
            Feature comparison across the {comparedPlans.length} illustrative plans. A dash means the capability is not
            available on that plan; a value describes the limit.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky start-0 z-[5] bg-inset px-3 py-3 text-start text-2xs font-semibold uppercase tracking-wide text-muted">
                Capability
              </th>
              {comparedPlans.map((planId) => (
                <th
                  key={planId}
                  scope="col"
                  className={cn(
                    'px-3 py-3 text-center text-2xs font-semibold uppercase tracking-wide',
                    planId === 'professional' ? 'bg-brand-subtle text-brand-fg' : 'bg-inset text-muted',
                  )}
                >
                  {planLabels.get(planId)}
                  {planId === 'professional' ? (
                    <span className="mt-1 block text-[0.5625rem] font-normal normal-case tracking-normal">
                      recommended starting point
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.groups.map(([category, rows]) => (
            <tbody key={category}>
              <tr className="border-b border-border-subtle bg-inset/70">
                <th
                  scope="colgroup"
                  colSpan={comparedPlans.length + 1}
                  className="px-3 py-2 text-start text-2xs font-semibold uppercase tracking-wider text-faint"
                >
                  {category}
                </th>
              </tr>
              {rows.map((row) => (
                <ComparisonRow key={row.feature} label={row.feature} values={row.values} highlighted={row.highlighted} />
              ))}
            </tbody>
          ))}
          </tbody>
        </table>
      </div>

      {categories.shown === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No features match “{query}”.</p>
      ) : null}
    </div>
  );
}
