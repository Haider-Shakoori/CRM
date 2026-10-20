import { ArrowUpRight, Building2, CreditCard, Flag, Globe, ShieldCheck, Terminal } from 'lucide-react';
import { brandConfig } from '@crm/configuration';
import { Badge, Button, Card, Container, DemoNotice } from '@crm/ui';

/**
 * Platform administration landing page.
 *
 * This console is a distinct trust domain from the CRM application: it manages tenants,
 * plans and the platform itself, and a tenant administrator should never be able to reach it.
 *
 * It is not built yet, and this page says so rather than showing a dashboard of invented
 * figures. Two things are deliberate:
 *
 *   1. **The planned scope is named**, because a reviewer evaluating the architecture needs to
 *      know the surface was considered rather than forgotten.
 *   2. **The href to the CRM is absolute**, because the two applications run on separate
 *      origins in development and on separate subdomains in production.
 *
 * A page that showed plausible-looking tenant counts would be worse than this one: it would
 * imply a working product where there is a plan.
 */

const PLANNED = [
  {
    icon: Building2,
    title: 'Tenant management',
    body: 'Directory and detail, subscription status, seat usage, module entitlements, trial controls, suspension and reactivation, lifecycle history and internal support notes.',
  },
  {
    icon: CreditCard,
    title: 'Plans and subscriptions',
    body: 'Plan creation and editing, feature and seat limits, trial configuration, add-ons, regional price presentation, renewal overview and failed-payment presentation.',
  },
  {
    icon: Flag,
    title: 'Platform operations',
    body: 'Feature flags with rollout rules and an audit trail, the module catalog, global settings, announcement and maintenance-banner management.',
  },
  {
    icon: Globe,
    title: 'Localization administration',
    body: 'Translation completeness per locale, missing keys, reviewer assignment and the enablement flags for each surface.',
  },
  {
    icon: ShieldCheck,
    title: 'Platform security',
    body: 'Platform roles with dual-approval actions, internal user management, global audit activity and system status presentation.',
  },
  {
    icon: Terminal,
    title: 'Integration and support oversight',
    body: 'The integration catalog, support queue with escalation, and product usage analytics across tenants.',
  },
];

export function PlatformLanding() {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* Non-dismissible stripe: the same honesty requirement as the CRM shell. */}
      <div className="border-b border-warning/30 bg-warning-subtle px-3 py-1 text-center">
        <DemoNotice tone="warning">Frontend demo</DemoNotice>
      </div>

      <header className="border-b border-border-subtle bg-surface">
        <Container width="wide" className="flex h-14 items-center gap-3">
          <img src="/brand/logo-mark.svg" alt="" className="size-7" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-tight text-fg">
              {brandConfig.application.platformAdminTitleTemplate.replace('%s', brandConfig.productDisplayName)}
            </p>
            <p className="text-[0.625rem] text-subtle">SaaS platform owner console</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" trailingIcon={<ArrowUpRight className="size-3.5" />} asChild>
              <a href={import.meta.env.VITE_CRM_URL ?? 'http://localhost:5173'}>Open the CRM</a>
            </Button>
          </div>
        </Container>
      </header>

      <main>
        <Container width="content" className="space-y-8 py-12">
          <div className="max-w-3xl space-y-4">
            <Badge variant="outline">Demo mode · Laravel API not configured</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-fg">
              The platform console is separate and ready for secure API configuration
            </h1>
            <p className="text-base leading-relaxed text-muted">
              This is the third of three applications in the monorepo. It shares the design tokens, the
              component library, the domain types and the localization foundation with the public website
              and the CRM — but it is deliberately not the same application, because a platform operator is
              not a tenant user and the two must never share a navigation tree.
            </p>
            <p className="text-sm leading-relaxed text-subtle">
              The service contracts for everything below already exist in{' '}
              <code className="rounded bg-inset px-1 py-0.5 font-mono text-[0.6875rem]">@crm/shared-types</code>, and the
              synthetic platform dataset — tenants, plans, subscriptions, invoices, feature flags, the module
              catalog and localization rows — is already generated. The live tenant directory and manual entitlement screens are now implemented behind operator authorization; this demo does not access them.
            </p>
          </div>

          <Card className="border-dashed p-5">
            <h2 className="text-sm font-semibold text-fg">Why this page exists instead of a dashboard</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              A landing page with plausible tenant counts, a revenue chart and a churn figure would take an hour to
              build and would misrepresent the state of the work. Everything on this page is either verifiable — the
              links work, the CRM is real — or explicitly labelled as planned.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" asChild>
                <a href={import.meta.env.VITE_CRM_URL ?? 'http://localhost:5173'}>Open the CRM application</a>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <a href={import.meta.env.VITE_WEBSITE_URL ?? 'http://localhost:4321'}>Open the public website</a>
              </Button>
            </div>
          </Card>

          <section aria-labelledby="planned-heading" className="space-y-4">
            <h2 id="planned-heading" className="text-lg font-semibold tracking-tight text-fg">
              Planned scope for this console
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PLANNED.map((entry) => {
                const Icon = entry.icon;
                return (
                  <li key={entry.title}>
                    <Card className="h-full p-4">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-subtle text-brand-fg" aria-hidden>
                        <Icon className="size-4" />
                      </span>
                      <h3 className="mt-3 text-sm font-semibold text-fg">{entry.title}</h3>
                      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted">{entry.body}</p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-fg">What is already in place underneath</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {[
                { term: 'Platform service contract', detail: '51 methods across tenants, plans, subscriptions, flags, modules, localization, audit and support.' },
                { term: 'Synthetic platform dataset', detail: 'Three tenants, four plans, seven add-ons, subscriptions, invoices, platform users and roles, 60 audit events, five feature flags and 25 module catalog entries.' },
                { term: 'Design system', detail: 'The same tokens, components, charts and data table as the CRM, so the console will look related without looking identical.' },
                { term: 'Honest labelling vocabulary', detail: '18 canonical notices, including the synthetic-figures and not-claimed-uptime statements this console needs most.' },
              ].map((entry) => (
                <div key={entry.term}>
                  <dt className="text-xs font-medium text-fg">{entry.term}</dt>
                  <dd className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted">{entry.detail}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Container>
      </main>

      <footer className="border-t border-border-subtle bg-surface">
        <Container width="wide" className="py-6">
          <p className="text-[0.625rem] leading-relaxed text-faint">
            {brandConfig.website.demoContentNotice} No certification, uptime guarantee or compliance approval is
            claimed anywhere in this build.
          </p>
        </Container>
      </footer>
    </div>
  );
}
