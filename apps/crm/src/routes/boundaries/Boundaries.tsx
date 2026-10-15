'use client';

import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Lock, LogIn, SearchX, ShieldAlert } from 'lucide-react';
import { Button, Container } from '@crm/ui';
import { PageHeader } from '../../components/shared';

/**
 * Boundary states.
 *
 * Four screens that most products get wrong by collapsing them into a generic error page.
 * They are genuinely different situations and each needs a different next step:
 *
 *   - **Not entitled** — the tenant has not bought the module. The route is to billing.
 *   - **Access denied** — the tenant has it, the role does not. The route is to an administrator.
 *   - **Session expired** — nothing is wrong; sign in again. Unsaved work is preserved.
 *   - **Not found** — the record is gone or the link is wrong. The route is back into the section.
 *
 * Conflating them means a person reads "Access denied" when they could have fixed it by
 * upgrading, or contacts an administrator over a typo in a URL.
 */

function BoundaryLayout({
  title,
  description,
  icon,
  tone = 'danger',
  children,
  reference,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  tone?: 'danger' | 'warning' | 'info';
  children: React.ReactNode;
  reference?: string | null;
}) {
  const toneClasses = {
    danger: 'border-danger/30 bg-danger-subtle text-danger-fg',
    warning: 'border-warning/30 bg-warning-subtle text-warning-fg',
    info: 'border-info/30 bg-info-subtle text-info-fg',
  } as const;

  return (
    <div className="flex min-h-[70dvh] items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-4">
        <div className={`flex size-11 items-center justify-center rounded-xl border ${toneClasses[tone]}`} aria-hidden>
          {icon}
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold tracking-tight text-fg">{title}</h1>
          <p className="text-sm leading-relaxed text-muted">{description}</p>
          {reference ? (
            <p className="pt-1 font-mono text-[0.6875rem] text-faint">Reference: {reference}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function NotEntitled() {
  const [params] = useSearchParams();
  const moduleKey = params.get('module');
  const resource = params.get('resource');

  return (
    <div className="pb-6">
      <PageHeader
        title="Not included in your plan"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Not entitled' }]}
      />
      <BoundaryLayout
        tone="warning"
        icon={<Lock className="size-5" />}
        title={moduleKey ? `${moduleKey.replace(/_/g, ' ')} is not enabled` : 'This module is not enabled for your organization'}
        description="Your organization does not currently include this capability. An administrator can enable it from billing, and the change takes effect immediately."
        reference={resource}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" asChild>
            <Link to="/app/settings/billing/plans">Compare plans</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/app/settings/billing">Manage subscription</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/home">Back to the dashboard</Link>
          </Button>
        </div>
        <p className="rounded-lg border border-border-subtle bg-inset p-3 text-[0.6875rem] leading-relaxed text-muted">
          Entitlement is presented here for demonstration. Real enforcement belongs to the backend —
          hiding a route in the interface is not access control, and the build does not pretend otherwise.
        </p>
      </BoundaryLayout>
    </div>
  );
}

export function AccessDenied() {
  const [params] = useSearchParams();
  return (
    <div className="pb-6">
      <PageHeader
        title="Access restricted"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Access denied' }]}
      />
      <BoundaryLayout
        tone="danger"
        icon={<ShieldAlert className="size-5" />}
        title="Your role does not include this area"
        description={
          params.get('resource')
            ? `The ${params.get('resource')} area is available to other roles in your organization. An administrator can grant it from Roles and permissions.`
            : 'This area is available to other roles. An administrator can grant access from Roles and permissions.'
        }
        reference={params.get('permission')}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" asChild>
            <Link to="/app/settings/roles">See which roles have access</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/app/home">Back to the dashboard</Link>
          </Button>
        </div>
        <p className="rounded-lg border border-border-subtle bg-inset p-3 text-[0.6875rem] leading-relaxed text-muted">
          Roles and permissions are configured per organization. The matrix in settings shows exactly
          which grants each role holds, including field-level visibility.
        </p>
      </BoundaryLayout>
    </div>
  );
}

export function SessionExpired() {
  const minutes = 30;
  return (
    <div className="pb-6">
      <PageHeader title="Session expired" breadcrumbs={[{ label: 'Home', to: '/app/home' }]} />
      <BoundaryLayout
        tone="info"
        icon={<Clock className="size-5" />}
        title="You were signed out for inactivity"
        description={`Sessions end after ${minutes} minutes without activity. Anything you had typed but not saved is still in this browser, so signing in again returns you to where you left off.`}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" leadingIcon={<LogIn className="size-3.5" />} asChild>
            <Link to="/app/home">Continue working</Link>
          </Button>
        </div>
        <p className="rounded-lg border border-dashed border-border-strong bg-inset p-3 text-[0.6875rem] leading-relaxed text-muted">
          No session is actually issued or expired in this build. Sign-in is simulated and nothing
          is transmitted, stored or validated.
        </p>
      </BoundaryLayout>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="pb-6">
      <PageHeader title="Page not found" breadcrumbs={[{ label: 'Home', to: '/app/home' }]} />
      <BoundaryLayout
        tone="info"
        icon={<SearchX className="size-5" />}
        title="That screen does not exist"
        description="The link may be out of date, or the address was mistyped. Nothing is broken on your side."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" asChild>
            <Link to="/app/home">Back to the dashboard</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/app/leads">Go to leads</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/deals">Go to deals</Link>
          </Button>
        </div>
      </BoundaryLayout>
    </div>
  );
}

export function OfflineState() {
  return (
    <Container width="narrow" className="py-16">
      <BoundaryLayout
        tone="warning"
        icon={<Clock className="size-5" />}
        title="You appear to be offline"
        description="Reconnect to continue. Your unsaved changes are held in this browser and will not be lost."
      >
        <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </BoundaryLayout>
    </Container>
  );
}
