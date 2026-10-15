import { useMemo, useState } from 'react';
import { ArrowRight, Check, Info, Minus, Users } from 'lucide-react';
import { calculatePlanCost, displayCurrencies, plans, type BillingInterval, type PlanId } from '@crm/configuration';
import { cn } from '@crm/ui';

/**
 * Interactive pricing table with a seat calculator.
 *
 * All arithmetic is local and illustrative. There is no tax calculation, no FX service
 * and no payment provider — the currency selector restates prices using fixed
 * illustrative rates, and says so next to the control rather than in a footnote.
 */

const selectablePlans = plans.filter((plan) => plan.id !== 'custom_enterprise');

function formatMoney(amount: number, currency: string, digits = 2) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

function currencyDigits(code: string) {
  return displayCurrencies.find((c) => c.code === code)?.decimalDigits ?? 2;
}

export default function PricingTable() {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [seats, setSeats] = useState(10);
  const [currency, setCurrency] = useState('USD');

  const rate = displayCurrencies.find((c) => c.code === currency)?.illustrativeRateFromUsd ?? 1;
  const digits = currencyDigits(currency);

  const costs = useMemo(() => {
    const map = new Map<PlanId, ReturnType<typeof calculatePlanCost>>();
    for (const plan of selectablePlans) {
      map.set(plan.id, calculatePlanCost(plan.id, seats, interval));
    }
    return map;
  }, [seats, interval]);

  const maxSeats = Math.max(...selectablePlans.map((plan) => plan.prices.find((p) => p.interval === interval)?.maximumSeats ?? 100));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          {/* Billing interval */}
          <div>
            <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-faint">Billing</span>
            <div
              className="inline-flex items-center gap-0.5 rounded-lg border border-border-subtle bg-inset p-0.5"
              role="radiogroup"
              aria-label="Billing interval"
            >
              {(['month', 'year'] as BillingInterval[]).map((option) => {
                const active = interval === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setInterval(option)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      active ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg',
                    )}
                  >
                    {option === 'month' ? 'Monthly' : 'Annual'}
                    {option === 'year' ? (
                      <span className="rounded-full bg-success-subtle px-1.5 py-0.5 text-2xs font-semibold text-success-fg">
                        save ~17%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seat count */}
          <div className="min-w-[15rem]">
            <label htmlFor="seat-count" className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-faint">
              <Users className="size-3" aria-hidden />
              Users
            </label>
            <div className="flex items-center gap-2">
              <input
                id="seat-count"
                type="range"
                min={1}
                max={Math.min(maxSeats, 500)}
                step={1}
                value={Math.min(seats, Math.min(maxSeats, 500))}
                onChange={(event) => setSeats(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-inset accent-[var(--brand)]"
                aria-describedby="seat-count-value"
              />
              <input
                type="number"
                min={1}
                max={5000}
                value={seats}
                onChange={(event) => setSeats(Math.max(1, Math.min(5000, Number(event.target.value) || 1)))}
                className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-xs tabular-nums text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/25"
                aria-label="Exact user count"
              />
            </div>
            <p id="seat-count-value" className="mt-1 text-2xs text-subtle">
              {seats} {seats === 1 ? 'user' : 'users'} · minimum seat counts apply per plan
            </p>
          </div>

          {/* Currency */}
          <div>
            <label htmlFor="pricing-currency" className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-faint">
              Display currency
            </label>
            <select
              id="pricing-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/25"
            >
              {displayCurrencies.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} · {option.label}
                </option>
              ))}
            </select>
            {currency !== 'USD' ? (
              <p className="mt-1 max-w-[14rem] text-2xs text-subtle">
                Converted at a fixed illustrative rate ({rate.toFixed(2)} per USD). No exchange-rate service is used.
              </p>
            ) : null}
          </div>
        </div>

        <p className="max-w-xs text-2xs leading-relaxed text-muted">
          Totals below are calculated in your browser from the illustrative price list. No tax is applied and nothing is
          charged.
        </p>
      </div>

      {/* Plan cards */}
      <ul className="grid gap-4 lg:grid-cols-4">
        {selectablePlans.map((plan) => {
          const cost = costs.get(plan.id);
          const price = plan.prices.find((p) => p.interval === interval);
          const billingTotal = cost ? cost.billingTotal * rate : 0;
          const perSeat = price ? price.perUserPrice * rate : 0;
          const baseFee = price ? price.basePlatformFee * rate : 0;
          return (
            <li
              key={plan.id}
              className={cn(
                'relative flex flex-col gap-3.5 rounded-xl border p-5',
                plan.recommended ? 'border-brand/50 bg-brand-subtle/40 shadow-sm' : 'border-border-subtle bg-surface',
              )}
            >
              {plan.recommended ? (
                <span className="absolute -top-2.5 start-5 rounded-full bg-brand px-2.5 py-0.5 text-2xs font-semibold text-brand-contrast">
                  {plan.badge ?? 'Recommended'}
                </span>
              ) : null}

              <div className="space-y-1">
                <h2 className="text-md font-semibold tracking-tight text-fg">{plan.name}</h2>
                <p className="text-2xs leading-relaxed text-muted">{plan.tagline}</p>
              </div>

              <div className="space-y-1">
                {price ? (
                  <>
                    <p className="flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tabular-nums tracking-tight text-fg">
                        {formatMoney(perSeat, currency, perSeat < 100 ? digits : 0)}
                      </span>
                      <span className="text-2xs text-muted">per user / month</span>
                    </p>
                    <p className="text-2xs text-subtle">
                      {baseFee > 0 ? `plus ${formatMoney(baseFee, currency, 0)} platform fee · ` : ''}
                      {interval === 'year' ? 'billed annually' : 'billed monthly'}
                    </p>
                    <div className="!mt-3 rounded-lg border border-border-subtle bg-inset px-3 py-2">
                      <p className="text-2xs text-subtle">
                        Estimated {interval === 'year' ? 'annual' : 'monthly'} total for{' '}
                        {cost?.seatsBilled ?? seats} users
                      </p>
                      <p className="mt-0.5 text-md font-semibold tabular-nums text-fg">
                        {formatMoney(billingTotal, currency, 0)}
                      </p>
                      {interval === 'year' && cost && cost.savingsVsMonthly > 0 ? (
                        <p className="mt-0.5 text-2xs font-medium text-success-fg">
                          Saves {formatMoney(cost.savingsVsMonthly * rate, currency, 0)} against monthly billing
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-lg font-semibold text-fg">Contact sales</p>
                )}
              </div>

              <a
                href={cost ? `/signup?plan=${plan.id}&seats=${seats}&interval=${interval}` : plan.ctaRoute}
                className={cn(
                  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors',
                  plan.recommended
                    ? 'bg-brand text-brand-contrast hover:bg-brand-hover'
                    : 'border border-border bg-surface text-fg hover:bg-hover',
                )}
              >
                {plan.ctaLabel}
                <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </a>

              <ul className="space-y-1.5 border-t border-border-subtle pt-3">
                {plan.highlights.slice(0, 6).map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-2xs leading-relaxed text-muted">
                    <Check className="mt-0.5 size-3 shrink-0 text-success-fg" aria-hidden />
                    {highlight}
                  </li>
                ))}
              </ul>

              <details className="group mt-auto border-t border-border-subtle pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-2xs font-medium text-brand-fg">
                  Plan limits
                  <span className="transition-transform group-open:rotate-180" aria-hidden>
                    ▾
                  </span>
                </summary>
                <dl className="mt-2 space-y-1.5">
                  {plan.limits.map((limit) => (
                    <div key={limit.key} className="flex items-start justify-between gap-3 text-2xs">
                      <dt className="min-w-0 text-muted">{limit.label}</dt>
                      <dd className="shrink-0 text-end font-medium tabular-nums text-fg">
                        {limit.included === null ? 'Unlimited' : limit.included.toLocaleString()}
                        <span className="ms-1 font-normal text-faint">{limit.included === null ? '' : limit.unit}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          );
        })}
      </ul>

      {/* Custom enterprise strip */}
      <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-fg">Custom Enterprise</h2>
          <p className="max-w-2xl text-xs leading-relaxed text-muted">
            For the largest deployments: negotiated volume pricing, contractual data-residency discussions, custom release
            considerations and a bespoke onboarding programme. Limits are defined in the order form rather than in the
            product interface.
          </p>
        </div>
        <a
          href="/contact-sales?plan=custom_enterprise"
          className="inline-flex h-10 shrink-0 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-hover"
        >
          Talk to sales
        </a>
      </div>

      <p className="flex items-start gap-2 text-2xs leading-relaxed text-faint">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        Seat arithmetic, annual discounts and the illustrative currency conversion are computed locally in your browser.
        This build contains no billing engine, tax calculation or payment integration, and the checkout flow is a
        simulated preview.
      </p>
    </div>
  );
}

/** Comparison matrix with progressive disclosure: the most decisive rows first. */
export function ComparisonRow({
  label,
  values,
  highlighted,
}: {
  label: string;
  values: Record<string, boolean | string | null>;
  highlighted?: boolean;
}) {
  return (
    <tr className={cn('border-b border-border-subtle', highlighted && 'bg-inset/60')}>
      <th scope="row" className="px-3 py-2.5 text-start text-xs font-medium text-fg">
        {label}
      </th>
      {Object.entries(values).map(([planId, value]) => (
        <td key={planId} className="px-3 py-2.5 text-center text-xs">
          {value === true ? (
            <>
              <Check className="mx-auto size-3.5 text-success-fg" aria-hidden />
              <span className="sr-only">Included</span>
            </>
          ) : value === false || value === null ? (
            <>
              <Minus className="mx-auto size-3.5 text-faint" aria-hidden />
              <span className="sr-only">Not available</span>
            </>
          ) : (
            <span className="tabular-nums text-muted">{value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
