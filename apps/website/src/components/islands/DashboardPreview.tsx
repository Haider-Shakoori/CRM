import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Filter,
  LifeBuoy,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@crm/ui';

/**
 * Homepage product preview.
 *
 * This is not a screenshot: it is the real design system rendering real components with
 * synthetic data. That matters for two reasons — the preview cannot drift away from the
 * product, and it proves the tokens, density and dark mode work in situ.
 *
 * Data is generated deterministically from a fixed seed so server and client renders
 * agree, which avoids a hydration mismatch. Motion is limited to a repeating bar
 * animation that is disabled under `prefers-reduced-motion`.
 */

/* Deterministic pseudo-random source: identical on server and client. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const pipelineStages = [
  { name: 'Discovery', tone: 'blue', deals: 14, value: 486_000 },
  { name: 'Validation', tone: 'teal', deals: 9, value: 372_500 },
  { name: 'Business case', tone: 'violet', deals: 7, value: 318_000 },
  { name: 'Negotiation', tone: 'amber', deals: 5, value: 244_800 },
  { name: 'Commit', tone: 'green', deals: 4, value: 186_400 },
] as const;

const stageTone: Record<string, string> = {
  blue: 'bg-tone-blue',
  teal: 'bg-tone-teal',
  violet: 'bg-tone-violet',
  amber: 'bg-tone-amber',
  green: 'bg-tone-green',
};

const activities = [
  { id: 'a1', icon: 'call', text: 'Discovery call completed with the buying committee', meta: 'Northwind Logistics · 42 min', tone: 'green' },
  { id: 'a2', icon: 'email', text: 'Proposal sent and tracked as viewed twice', meta: 'Helios Manufacturing · simulated delivery', tone: 'blue' },
  { id: 'a3', icon: 'task', text: 'Renewal task created 60 days before expiry', meta: 'Automation: contract nearing expiry', tone: 'violet' },
  { id: 'a4', icon: 'ticket', text: 'Ticket escalated to the service manager', meta: 'SLA threshold reached · priority high', tone: 'amber' },
  { id: 'a5', icon: 'badge', text: 'Health score improved by 8 points', meta: 'Aurora Health · adoption increased', tone: 'green' },
];

export default function DashboardPreview({ className }: { className?: string }) {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // A slow, single-purpose animation that communicates "live" without being decorative.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 4200);
    return () => window.clearInterval(id);
  }, []);

  const sparkline = useMemo(() => {
    const random = seeded(20261013);
    return Array.from({ length: 24 }, () => 34 + random() * 52);
  }, []);

  const totalValue = pipelineStages.reduce((sum, stage) => sum + stage.value, 0);

  const currency = (value: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);

  return (
    <div className={cn('relative', className)}>
      {/* Ambient brand glow. Purely decorative, hidden from assistive technology. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 -z-10 opacity-70 blur-3xl"
        style={{ backgroundImage: 'var(--gradient-mesh)' }}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xl ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border-subtle bg-inset px-3 py-2">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-danger/50" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/50" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-2 py-0.5 text-2xs text-subtle">
            <Search className="size-3" aria-hidden />
            app.example-crm.test/deals
          </div>
          <span className="rounded-sm border border-dashed border-border-strong px-1 text-[0.5625rem] uppercase tracking-wide text-faint">
            Sample data
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
            <TrendingUp className="size-3.5 text-brand" aria-hidden />
            Sales pipeline
          </span>
          <span className="hidden items-center gap-1 rounded-md border border-border-subtle bg-inset px-1.5 py-0.5 text-2xs text-muted sm:inline-flex">
            <CalendarDays className="size-3" aria-hidden />
            This quarter
          </span>
          <span className="hidden items-center gap-1 rounded-md border border-border-subtle bg-inset px-1.5 py-0.5 text-2xs text-muted sm:inline-flex">
            <Filter className="size-3" aria-hidden />
            Enterprise accounts
          </span>
          <span className="ms-auto inline-flex items-center gap-1 rounded-md bg-brand-subtle px-1.5 py-0.5 text-2xs font-medium text-brand-fg">
            <Sparkles className="size-3" aria-hidden />
            Assistant ready
          </span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 border-b border-border-subtle lg:grid-cols-4">
          <PreviewKpi
            icon={<CircleDollarSign className="size-3.5" aria-hidden />}
            label="Weighted pipeline"
            value={currency(totalValue * 0.42)}
            delta="+12.4%"
            direction="up"
          />
          <PreviewKpi
            icon={<Target className="size-3.5" aria-hidden />}
            label="Commit this quarter"
            value={currency(2_480_000)}
            delta="+6.1%"
            direction="up"
          />
          <PreviewKpi
            icon={<Clock className="size-3.5" aria-hidden />}
            label="Average cycle time"
            value="38 days"
            delta="−4 days"
            direction="up"
          />
          <PreviewKpi
            icon={<LifeBuoy className="size-3.5" aria-hidden />}
            label="SLA compliance"
            value="96.2%"
            delta="−0.8%"
            direction="down"
          />
        </div>

        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          {/* Pipeline board */}
          <div className="border-b border-border-subtle p-3 lg:border-b-0 lg:border-e">
            <div className="mb-2.5 flex items-baseline justify-between">
              <p className="text-xs font-semibold text-fg">Pipeline by stage</p>
              <p className="text-2xs text-subtle">Hover a stage to isolate it</p>
            </div>
            <div className="space-y-2">
              {pipelineStages.map((stage) => {
                const width = (stage.value / pipelineStages[0]!.value) * 100;
                const dimmed = activeStage !== null && activeStage !== stage.name;
                return (
                  <button
                    key={stage.name}
                    type="button"
                    onMouseEnter={() => setActiveStage(stage.name)}
                    onMouseLeave={() => setActiveStage(null)}
                    onFocus={() => setActiveStage(stage.name)}
                    onBlur={() => setActiveStage(null)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start transition-opacity duration-200',
                      dimmed ? 'opacity-45' : 'opacity-100',
                      'hover:bg-hover',
                    )}
                    aria-label={`${stage.name}: ${stage.deals} deals, ${currency(stage.value)}.`}
                  >
                    <span className="w-24 shrink-0 truncate text-2xs font-medium text-muted">{stage.name}</span>
                    <span className="relative h-5 min-w-0 flex-1 overflow-hidden rounded bg-inset">
                      <span
                        className={cn('absolute inset-y-0 start-0 rounded transition-[width] duration-500 ease-standard', stageTone[stage.tone])}
                        style={{ width: `${Math.max(width, 8)}%`, opacity: 0.85 }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-end text-2xs tabular-nums text-muted">{stage.deals}</span>
                    <span className="w-16 shrink-0 text-end text-2xs font-medium tabular-nums text-fg">{currency(stage.value)}</span>
                  </button>
                );
              })}
            </div>

            {/* Sparkline */}
            <div className="mt-4 rounded-lg border border-border-subtle bg-inset p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-2xs font-semibold text-muted">Created pipeline, last 24 weeks</p>
                <p className="text-2xs text-subtle">Illustrative</p>
              </div>
              <div className="flex h-14 items-end gap-[3px]" role="img" aria-label="Weekly created pipeline trend, illustrative data">
                {sparkline.map((height, index) => (
                  <span
                    key={index}
                    className={cn(
                      'flex-1 rounded-sm transition-colors duration-500',
                      index % 8 === tick % 8 ? 'bg-brand' : 'bg-border-strong',
                    )}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Activity + assistant */}
          <div className="p-3">
            <div className="mb-2.5 flex items-baseline justify-between">
              <p className="text-xs font-semibold text-fg">Recent activity</p>
              <p className="text-2xs text-subtle">Across every module</p>
            </div>
            <ol className="space-y-0">
              {activities.map((item, index) => (
                <li key={item.id} className="relative flex gap-2.5 pb-2.5">
                  {index !== activities.length - 1 ? (
                    <span className="absolute start-[0.5625rem] top-6 bottom-0 w-px bg-border-subtle" aria-hidden />
                  ) : null}
                  <span
                    className={cn(
                      'relative z-[1] mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full',
                      item.tone === 'green' && 'bg-tone-green-bg text-tone-green',
                      item.tone === 'blue' && 'bg-tone-blue-bg text-tone-blue',
                      item.tone === 'violet' && 'bg-tone-violet-bg text-tone-violet',
                      item.tone === 'amber' && 'bg-tone-amber-bg text-tone-amber',
                    )}
                    aria-hidden
                  >
                    {item.icon === 'call' ? <Activity className="size-2.5" /> : null}
                    {item.icon === 'email' ? <ArrowUpRight className="size-2.5" /> : null}
                    {item.icon === 'task' ? <Clock className="size-2.5" /> : null}
                    {item.icon === 'ticket' ? <LifeBuoy className="size-2.5" /> : null}
                    {item.icon === 'badge' ? <BadgeCheck className="size-2.5" /> : null}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs leading-snug text-fg">{item.text}</p>
                    <p className="text-2xs text-subtle">{item.meta}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Assistant preview */}
            <div className="mt-3 rounded-lg border border-border-subtle bg-brand-subtle/50 p-3">
              <p className="flex items-center gap-1.5 text-2xs font-semibold text-brand-fg">
                <Sparkles className="size-3" aria-hidden />
                Assistant · demonstration engine
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-fg">
                “Three enterprise deals slipped a stage this week. Two cite procurement timing; one is waiting on a
                security review. The largest, Northwind Logistics, has no activity for 9 days.”
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-2xs text-muted">
                  <Users className="size-3" aria-hidden />3 records cited
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-dashed border-border-strong px-1.5 py-0.5 text-2xs text-faint">
                  Not a language model
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-2xs text-faint">
        Product interface preview rendered with real design-system components and synthetic data.
      </p>
    </div>
  );
}

function PreviewKpi({
  icon,
  label,
  value,
  delta,
  direction,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  direction: 'up' | 'down';
}) {
  return (
    <div className="border-b border-border-subtle p-3 last:border-b-0 lg:border-b-0 lg:border-e lg:last:border-e-0">
      <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-faint">
        <span className="text-subtle">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      <p
        className={cn(
          'mt-0.5 inline-flex items-center gap-0.5 text-2xs font-medium',
          direction === 'up' ? 'text-success-fg' : 'text-danger-fg',
        )}
      >
        {direction === 'up' ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
        {delta}
        <span className="ms-1 font-normal text-subtle">vs last quarter</span>
      </p>
    </div>
  );
}
