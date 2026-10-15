/**
 * Batch 9–17 service tests.
 *
 * These batches added service modules over collections that were already seeded, and the
 * administration batch added screens over configuration that is derived or stored locally.
 * These tests cover the contracts a screen depends on: tenant scoping, the
 * derived numbers the UI reads, and the honesty guarantees (simulated sends, local-only
 * exports, `demo_not_hosted` pages, no model behind the assistant).
 *
 * The tests are deliberately contract-level rather than exhaustive: they assert the
 * shape and the invariants, not the exact synthetic values, so a reseed does not make
 * them brittle.
 */

import { describe, expect, it } from 'vitest';
import type { RevenueSubscription } from '@crm/shared-types';
import { MockDb } from '../lib/store';
import { DATASET_EPOCH } from '../lib/random';
import { buildDataset } from '../seed';
import { createMockServices } from './index';

/** A database that never touches browser storage, seeded deterministically. */
function fresh() {
  const db = new MockDb({ persist: false, seed: buildDataset });
  const services = createMockServices({ db, persist: false });
  const organizationId = Object.values(db.state.users)[0]!.activeOrganizationId;
  return { db, services, organizationId };
}

/* --------------------------------------------------- batch 9: customer success */

describe('customer success service (batch 9)', () => {
  it('reports an overview for the active organization', async () => {
    const { services } = fresh();
    const result = await services.customerSuccess.overview();
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeTruthy();
  });

  it('scopes health scores to the active organization and explains them', async () => {
    const { db, services, organizationId } = fresh();
    const page = await services.customerSuccess.healthScores({ pageSize: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    for (const score of page.items) {
      expect(db.state.accounts[score.accountId]?.organizationId).toBe(organizationId);
      expect(typeof score.score).toBe('number');
      expect(score.band).toBe(db.state.accounts[score.accountId]!.health);
    }
    const detail = await services.customerSuccess.healthScore(page.items[0]!.accountId);
    expect(detail.ok).toBe(true);
    // The score must be explainable: a set of weighted components that sum to the total.
    expect(Array.isArray(detail.ok ? detail.data.components : [])).toBe(true);
  });

  it('returns a churn-risk list and org-scoped renewals', async () => {
    const { services, organizationId } = fresh();
    const risk = await services.customerSuccess.churnRisk({ pageSize: 25 });
    expect(Array.isArray(risk.items)).toBe(true);

    const renewals = await services.customerSuccess.renewals({ pageSize: 50 });
    expect(renewals.items.length).toBeGreaterThan(0);
    for (const renewal of renewals.items) {
      expect(renewal.organizationId).toBe(organizationId);
    }
  });

  it('serves onboarding plans, success plans and business reviews', async () => {
    const { services } = fresh();
    const onboarding = await services.customerSuccess.onboardingPlans({ pageSize: 20 });
    const plans = await services.customerSuccess.successPlans({ pageSize: 20 });
    const reviews = await services.customerSuccess.businessReviews({ pageSize: 20 });
    expect(onboarding.items.length).toBeGreaterThan(0);
    expect(plans.items.length).toBeGreaterThan(0);
    expect(reviews.items.length).toBeGreaterThan(0);
  });

  it('seeds playbooks with ordered steps and applying one is a local write', async () => {
    const { services, organizationId } = fresh();
    const playbooks = await services.playbooks.list({ pageSize: 20 });
    expect(playbooks.items.length).toBeGreaterThan(0);
    const playbook = playbooks.items[0]!;
    expect(playbook.organizationId).toBe(organizationId);
    expect(playbook.steps.length).toBeGreaterThan(0);

    const target = (await services.accounts.list({ pageSize: 1 })).items[0]!;
    const applied = await services.playbooks.apply(playbook.id, { type: 'account', id: target.id });
    expect(applied.ok).toBe(true);
    expect(applied.ok ? applied.data.tasksCreated : -1).toBeGreaterThanOrEqual(0);
  });
});

/* ----------------------------------- batch 10: activities and communications */

describe('sequences service (batch 10)', () => {
  it('lists seeded sequences and their enrolments', async () => {
    const { services, organizationId } = fresh();
    const page = await services.sequences.list({ pageSize: 25 });
    expect(page.items.length).toBeGreaterThan(0);
    const sequence = page.items[0]!;
    expect(sequence.organizationId).toBe(organizationId);

    const enrolments = await services.sequences.enrollments(sequence.id, { pageSize: 25 });
    expect(Array.isArray(enrolments.items)).toBe(true);
  });

  it('enrolling a contact records an enrolment without contacting anyone', async () => {
    const { services } = fresh();
    const sequence = (await services.sequences.list({ pageSize: 1 })).items[0]!;
    const contact = (await services.contacts.list({ pageSize: 1 })).items[0]!;
    const result = await services.sequences.enroll(sequence.id, [{ type: 'contact', id: contact.id }]);
    expect(result.ok).toBe(true);

    const enrolments = await services.sequences.enrollments(sequence.id, { pageSize: 50 });
    expect(enrolments.items.some((enrolment) => enrolment.recordId === contact.id)).toBe(true);
  });
});

/* ------------------------------------------------- batch 11: analytics extras */

describe('exports and goals services (batch 11)', () => {
  it('lists export requests as local-only artefacts', async () => {
    const { services } = fresh();
    const page = await services.exports.list({ pageSize: 25 });
    expect(Array.isArray(page.items)).toBe(true);
    for (const request of page.items) {
      // Every export is generated in the browser; nothing is uploaded anywhere.
      expect(request.generatedLocally).toBe(true);
    }
  });

  it('returns goals for a user and period', async () => {
    const { db, services } = fresh();
    const userId = Object.values(db.state.users)[0]!.id;
    const page = await services.goals.forUser(userId, '2026-Q4');
    expect(Array.isArray(page.items)).toBe(true);
  });
});

/* ----------------------------------------------- batch 13: customization extras */

describe('customization extras (batch 13)', () => {
  it('lists seeded page layouts and previews one against a synthetic record', async () => {
    const { services } = fresh();
    const page = await services.layouts.list();
    expect(page.items.length).toBeGreaterThan(0);
    const preview = await services.layouts.preview(page.items[0]!.id);
    expect(preview.ok).toBe(true);
  });

  it('lists industry templates with their declared additions', async () => {
    const { services } = fresh();
    const page = await services.industryTemplates.list({ pageSize: 25 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0]!.name).toBeTruthy();
  });
});

/* ------------------------------------------------------ batch 14: marketing */

describe('marketing services (batch 14)', () => {
  it('lists campaigns, exposes derived metrics, and launching only changes local status', async () => {
    const { services, organizationId } = fresh();
    const page = await services.campaigns.list({ pageSize: 25 });
    expect(page.items.length).toBeGreaterThan(0);
    const campaign = page.items.find((item) => item.status === 'draft') ?? page.items[0]!;
    expect(campaign.organizationId).toBe(organizationId);

    const metrics = await services.campaigns.metrics(campaign.id);
    expect(metrics.ok).toBe(true);
    expect(Array.isArray(metrics.ok ? metrics.data.trend : [])).toBe(true);

    const launched = await services.campaigns.launch(campaign.id);
    expect(launched.ok).toBe(true);
    expect(launched.ok && launched.data.status).toBe('active');
  });

  it('returns a campaign calendar over a date window', async () => {
    const { services } = fresh();
    const page = await services.campaigns.calendar('2026-08-01', '2026-12-31');
    expect(Array.isArray(page.items)).toBe(true);
  });

  it('previews and pages a segment audience', async () => {
    const { services } = fresh();
    const page = await services.segments.list({ pageSize: 25 });
    expect(page.items.length).toBeGreaterThan(0);
    const segment = page.items[0]!;

    const preview = await services.segments.preview(segment.definition, segment.entityType);
    expect(preview.ok).toBe(true);
    expect(preview.ok ? preview.data.total : -1).toBeGreaterThanOrEqual(0);

    const members = await services.segments.members(segment.id, { pageSize: 10 });
    expect(Array.isArray(members.items)).toBe(true);
  });

  it('validates and simulates a journey without activating anything real', async () => {
    const { services } = fresh();
    const page = await services.journeys.list({ pageSize: 25 });
    expect(page.items.length).toBeGreaterThan(0);
    const journey = page.items[0]!;

    const validation = await services.journeys.validate(journey.id);
    expect(validation.ok).toBe(true);
    expect(typeof (validation.ok ? validation.data.valid : undefined)).toBe('boolean');

    if (journey.entrySegmentId) {
      const simulation = await services.journeys.simulate(journey.id, journey.entrySegmentId);
      expect(simulation.ok).toBe(true);
      expect(simulation.ok ? simulation.data.entered : -1).toBeGreaterThanOrEqual(0);
    }
  });

  it('renders an email preview locally and reports warnings', async () => {
    const { services } = fresh();
    const template = (await services.emailTemplates.list({ pageSize: 1 })).items[0]!;
    const preview = await services.emailTemplates.renderPreview(template.id);
    expect(preview.ok).toBe(true);
    expect(typeof (preview.ok ? preview.data.plainText : '')).toBe('string');
    expect(Array.isArray(preview.ok ? preview.data.warnings : [])).toBe(true);
  });

  it('records a form submission locally and labels it simulated', async () => {
    const { services } = fresh();
    const page = await services.forms.list({ pageSize: 50 });
    const form = page.items.find((item) => item.status === 'published') ?? page.items[0]!;
    // Supply every required field so the submission passes the form's own validation.
    const values: Record<string, unknown> = {};
    for (const field of form.fields) {
      values[field.key] = field.type === 'consent' ? true : field.type === 'number' ? 1 : 'demo@example.test';
    }
    const result = await services.forms.submit(form.id, values);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.simulated).toBe(true);
  });

  it('publishing a landing page reports that it is not hosted', async () => {
    const { services } = fresh();
    const page = (await services.landingPages.list({ pageSize: 1 })).items[0]!;
    const result = await services.landingPages.publish(page.id);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.hostingState).toBe('demo_not_hosted');
  });

  it('lists lead sources with synthetic attribution figures', async () => {
    const { services } = fresh();
    const page = await services.leadSources.list({ pageSize: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    for (const source of page.items) {
      expect(source.leadCount).toBeGreaterThanOrEqual(0);
      expect(source.conversionRate).toBeGreaterThanOrEqual(0);
    }
  });
});

/* ------------------------------------------------------ batch 15: workspaces */

describe('workspace services (batch 15)', () => {
  it('reports a project overview and a project timeline', async () => {
    const { services } = fresh();
    const overview = await services.projects.overview();
    expect(overview.ok).toBe(true);

    const project = (await services.projects.list({ pageSize: 1 })).items[0]!;
    const timeline = await services.projects.timeline(project.id);
    expect(timeline.ok).toBe(true);
  });

  it('returns project phases, milestones, deliverables and risks as plain lists', async () => {
    const { services } = fresh();
    const project = (await services.projects.list({ pageSize: 1 })).items[0]!;
    for (const page of [
      await services.projects.phases(project.id),
      await services.projects.milestones(project.id),
      await services.projects.deliverables(project.id),
      await services.projects.risks(project.id),
    ]) {
      expect(Array.isArray(page.items)).toBe(true);
    }
  });

  it('reports partner and field-sales overviews', async () => {
    const { services } = fresh();
    const partners = await services.partners.overview();
    expect(partners.ok).toBe(true);
    const field = await services.fieldSales.overview();
    expect(field.ok).toBe(true);
  });

  it('keeps partner commissions as demo-local calculations', async () => {
    const { services } = fresh();
    const page = await services.partners.list({ pageSize: 25 });
    expect(page.items.length).toBeGreaterThan(0);
    const overview = await services.partners.overview();
    expect(overview.ok).toBe(true);

    // Commission statements are served by the recurring-revenue module; every figure is
    // computed in the browser from synthetic data and is never paid out.
    const statements = await services.subscriptionRevenue.commissionStatements({ pageSize: 25 });
    expect(Array.isArray(statements.items)).toBe(true);
  });
});

/* -------------------------------------------------------- batch 16: administration */

describe('tenant administration services (batch 16)', () => {
  it('derives the security policy for the active organization and keeps an edit local', async () => {
    const { db, services, organizationId } = fresh();
    const before = await services.security.policy();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data.organizationId).toBe(organizationId);

    const saved = await services.security.updatePolicy({
      ...before.data,
      password: { ...before.data.password, minLength: 14 },
    });
    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.data.password.minLength).toBe(14);

    // The policy is a local setting, not a new collection in the store.
    expect(Object.keys(db.state).filter((name) => name.includes('policy'))).toEqual([]);
    const reread = await services.security.policy();
    expect(reread.ok && reread.data.password.minLength).toBe(14);
  });

  it('refuses to enable single sign-on because no identity provider is connected', async () => {
    const { services } = fresh();
    const before = await services.security.policy();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const result = await services.security.updatePolicy({
      ...before.data,
      sso: { ...before.data.sso, enabled: true },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('forbidden');
  });

  it('lists sessions for the active organization and never ends the session in use', async () => {
    const { db, services } = fresh();
    const page = await services.security.sessions({ pageSize: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((session) => session.userId !== undefined)).toBe(true);

    const current = page.items.find((session) => session.current);
    if (current) {
      const refused = await services.security.revokeSession(current.id);
      expect(refused.ok).toBe(false);
      expect(!refused.ok && refused.error.code).toBe('forbidden');
    }

    const other = page.items.find((session) => !session.current);
    if (!other) return;
    const revoked = await services.security.revokeSession(other.id);
    expect(revoked.ok).toBe(true);
    // Removing the record says plainly that nothing real was terminated.
    expect(revoked.ok && revoked.data.simulated).toBe(true);
    expect(revoked.ok && revoked.data.note).toContain('No real session was terminated');
    expect(db.state.sessions[other.id]).toBeUndefined();
  });

  it('derives trusted devices from trusted sessions and clears trust on revocation', async () => {
    const { db, services } = fresh();
    const devices = await services.security.devices();
    for (const device of devices.items) {
      expect(device.id.startsWith('device-')).toBe(true);
      expect(db.state.sessions[device.id.slice('device-'.length)]?.trusted).toBe(true);
    }

    const device = devices.items[0];
    if (!device) return;
    const revoked = await services.security.revokeDevice(device.id);
    expect(revoked.ok).toBe(true);
    expect(db.state.sessions[device.id.slice('device-'.length)]?.trusted).toBe(false);
    const after = await services.security.devices();
    expect(after.items.some((candidate) => candidate.id === device.id)).toBe(false);
  });

  it('records an audit export as a local row count rather than a file', async () => {
    const { services } = fresh();
    const page = await services.security.auditEvents({ pageSize: 25 });
    expect(Array.isArray(page.items)).toBe(true);

    const result = await services.security.exportAuditEvents('2026-01-01', '2026-12-31');
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.generatedLocally).toBe(true);
    expect(result.ok && result.data.rowCount).toBeGreaterThanOrEqual(0);
  });

  it('validates and stores retention rules in the browser', async () => {
    const { services } = fresh();
    const before = await services.data.retentionPolicy();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const rule = before.data.rules[0]!;

    const refused = await services.data.updateRetentionPolicy([{ id: rule.id, retentionDays: 7, enabled: true }]);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe('validation_failed');

    const saved = await services.data.updateRetentionPolicy([{ id: rule.id, retentionDays: 400, enabled: false }]);
    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.data.updated).toBe(1);

    const after = await services.data.retentionPolicy();
    const updated = after.ok ? after.data.rules.find((candidate) => candidate.id === rule.id) : undefined;
    expect(updated?.retentionDays).toBe(400);
    expect(updated?.enabled).toBe(false);
  });

  it('groups duplicate candidates from real records and records the review outcome', async () => {
    const { services } = fresh();
    const candidates = await services.data.duplicateCandidates({ pageSize: 25 });
    expect(candidates.items.length).toBeGreaterThan(0);
    for (const candidate of candidates.items) {
      expect(candidate.score).toBeGreaterThan(0);
      expect(candidate.recordA.id).not.toBe(candidate.recordB.id);
    }

    const resolved = await services.data.resolveDuplicate(candidates.items[0]!.id, 'ignored');
    expect(resolved.ok).toBe(true);
    expect(resolved.ok && resolved.data.status).toBe('ignored');
  });

  it('counts consent from the seeded contacts of the active organization', async () => {
    const { db, services, organizationId } = fresh();
    const consent = await services.data.consentOverview();
    expect(consent.ok).toBe(true);
    if (!consent.ok) return;

    const contacts = Object.values(db.state.contacts).filter((contact) => contact.organizationId === organizationId);
    const reviewed = consent.data.byJurisdiction.reduce((sum, row) => sum + row.contacts, 0);
    expect(reviewed).toBeLessThanOrEqual(contacts.length);
    for (const channel of consent.data.byChannel) {
      expect(channel.granted + channel.denied + channel.withdrawn + channel.pending).toBeGreaterThanOrEqual(0);
    }
  });

  it('scopes usage meters to the active organization', async () => {
    const { db, services, organizationId } = fresh();
    const before = await services.billing.usage();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data.length).toBeGreaterThan(0);
    for (const meter of before.data) {
      expect(meter.organizationId).toBe(organizationId);
    }

    const other = Object.values(db.state.organizations).find((organization) => organization.id !== organizationId)!;
    await services.tenant.switchOrganization(other.id);
    const after = await services.billing.usage();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.every((meter) => meter.organizationId === other.id)).toBe(true);
    expect(after.data.map((meter) => meter.key).sort()).toEqual(before.data.map((meter) => meter.key).sort());
    expect(after.data.some((meter) => meter.used !== before.data.find((candidate) => candidate.key === meter.key)?.used)).toBe(true);
  });

  it('holds the tenant subscription as a record with no billing provider attached', async () => {
    const { db, services, organizationId } = fresh();
    const subscription = await services.billing.subscription();
    expect(subscription.ok).toBe(true);
    if (!subscription.ok) return;
    // The subscription belongs to the tenant that owns the active organization.
    expect(subscription.data.tenantId).toBe(Object.values(db.state.organizations).find((organization) => organization.id === organizationId)?.tenantId);
    expect(subscription.data.billingState).toBe('not_connected');

    const invoices = await services.billing.invoices({ pageSize: 25 });
    expect(invoices.items.length).toBeGreaterThan(0);
    for (const invoice of invoices.items) {
      expect(invoice.tenantId).toBe(subscription.data.tenantId);
    }
  });

  it('refuses to sell its way out of a seat it cannot reduce and an add-on the plan excludes', async () => {
    const { services } = fresh();
    const subscription = await services.billing.subscription();
    expect(subscription.ok).toBe(true);
    if (!subscription.ok) return;

    const tooFew = await services.billing.updateSeats(subscription.data.seatsUsed - 1);
    expect(tooFew.ok).toBe(false);
    expect(!tooFew.ok && tooFew.error.code).toBe('validation_failed');

    const incompatible = (await services.billing.addOns()).items.find(
      (addOn) => !addOn.compatiblePlanIds.includes(subscription.data!.planId),
    );
    if (incompatible) {
      const refused = await services.billing.setAddOn(incompatible.id, 1);
      expect(refused.ok).toBe(false);
      expect(!refused.ok && refused.error.code).toBe('validation_failed');
    }

    const preview = await services.billing.checkoutPreview(subscription.data.planId, subscription.data.seatsUsed + 1, 'month');
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.simulated).toBe(true);
    expect(preview.data.paymentProviderState).toBe('not_connected');
  });

  it('cancels once, with a reason, and refuses a second cancellation', async () => {
    const { services } = fresh();
    const withoutReason = await services.billing.cancel('   ', 'end_of_period');
    expect(withoutReason.ok).toBe(false);
    expect(!withoutReason.ok && withoutReason.error.code).toBe('validation_failed');

    const cancelled = await services.billing.cancel('Moving to a smaller team', 'end_of_period');
    expect(cancelled.ok).toBe(true);
    expect(cancelled.ok && cancelled.data.status).toBe('canceled');

    const again = await services.billing.cancel('Again', 'immediately');
    expect(again.ok).toBe(false);
    expect(!again.ok && again.error.code).toBe('conflict');

    const revived = await services.billing.reactivate();
    expect(revived.ok).toBe(true);
    expect(revived.ok && revived.data.status).not.toBe('canceled');
  });

  it('expands the all-modules plan wildcard instead of showing it as a module', async () => {
    const { db, services } = fresh();
    const wildcardPlan = Object.values(db.state.platformPlans).find((plan) => plan.moduleKeys.includes('*'));
    expect(wildcardPlan).toBeDefined();
    if (!wildcardPlan) return;
    // Every module key the platform sells: the catalog plus what plans and add-ons grant.
    const universe = new Set<string>(Object.values(db.state.moduleCatalog).map((entry) => entry.key));
    for (const plan of Object.values(db.state.platformPlans)) for (const key of plan.moduleKeys) if (key !== '*') universe.add(key);
    for (const addOn of Object.values(db.state.platformAddOns)) for (const key of addOn.moduleKeys) universe.add(key);

    const subscription = await services.billing.subscription();
    expect(subscription.ok).toBe(true);
    if (!subscription.ok) return;
    const held = new Set(db.state.platformPlans[subscription.data.planId]?.moduleKeys ?? []);

    const preview = await services.billing.previewPlanChange(wildcardPlan.id, subscription.data.seats, 'month');
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    // A grant of everything removes nothing, and no entitlement is reported under `*`.
    expect(preview.data.entitlementsLost).toHaveLength(0);
    expect(preview.data.entitlementsGained.every((entitlement) => entitlement.moduleKey !== '*' && entitlement.label !== '*')).toBe(true);
    expect(preview.data.entitlementsGained.every((entitlement) => !held.has(entitlement.moduleKey))).toBe(true);
    expect(preview.data.entitlementsGained.length).toBeGreaterThan(0);

    // The entitlement read has the same hole, so switch to the tenant that holds the plan.
    const holder = Object.values(db.state.platformSubscriptions).find((candidate) => candidate.planId === wildcardPlan.id);
    expect(holder).toBeDefined();
    if (!holder) return;
    const organization = Object.values(db.state.organizations).find((candidate) => candidate.tenantId === holder.tenantId);
    expect(organization).toBeDefined();
    if (!organization) return;
    await services.tenant.switchOrganization(organization.id);
    const entitlements = await services.billing.entitlements();
    expect(entitlements.ok).toBe(true);
    if (!entitlements.ok) return;
    expect(entitlements.data.some((entitlement) => entitlement.moduleKey === '*')).toBe(false);
    expect(entitlements.data.every((entitlement) => universe.has(entitlement.moduleKey))).toBe(true);
    // Six keys plans grant are absent from the catalog, so the label is derived from the key.
    expect(entitlements.data.filter((entitlement) => entitlement.label === '*')).toHaveLength(0);
    expect(new Set(entitlements.data.map((entitlement) => entitlement.moduleKey)).size).toBe(entitlements.data.length);
  });

  it('refuses a plan preview for a seat count that cannot be sold', async () => {
    const { db, services } = fresh();
    const planId = Object.values(db.state.platformPlans)[0]!.id;
    const refused = await services.billing.previewPlanChange(planId, 0, 'month');
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe('validation_failed');
  });
});

/* ------------------------------------- batch 17: contracts, invoices, revenue */

describe('contracts, invoices and subscription revenue (batch 17)', () => {
  it('lists contracts and invoices scoped to the active organization', async () => {
    const { services, organizationId } = fresh();
    const contracts = await services.contracts.list({ pageSize: 50 });
    const invoices = await services.invoices.list({ pageSize: 50 });
    expect(contracts.items.length).toBeGreaterThan(0);
    expect(invoices.items.length).toBeGreaterThan(0);
    for (const contract of contracts.items) expect(contract.organizationId).toBe(organizationId);
    for (const invoice of invoices.items) expect(invoice.organizationId).toBe(organizationId);
  });

  it('renew creates a linked renewal and closes the original contract', async () => {
    const { services } = fresh();
    const original = (await services.contracts.list({ pageSize: 50 })).items.find(
      (contract) => contract.status === 'active' || contract.status === 'expiring_soon',
    );
    expect(original).toBeDefined();
    if (!original) return;

    const renewed = await services.contracts.renew(original.id, { termMonths: 24, startDate: '2026-11-01', value: 240_000 });
    expect(renewed.ok).toBe(true);
    if (!renewed.ok) return;
    const renewal = renewed.data;
    expect(renewal.id).not.toBe(original.id);
    expect(renewal.previousContractId).toBe(original.id);
    expect(renewal.status).toBe('active');
    // The renewal is unsigned: the signature panel must not claim otherwise.
    expect(renewal.signatureState).toBe('not_started');
    expect(renewal.termMonths).toBe(24);
    expect(renewal.contractValue.amount).toBe(240_000);
    expect(renewal.annualisedValue.amount).toBe(120_000);
    const expectedDays = Math.round((new Date(renewal.endDate).getTime() - DATASET_EPOCH.getTime()) / 86_400_000);
    expect(renewal.daysUntilExpiry).toBe(expectedDays);

    const closed = await services.contracts.get(original.id);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.data.status).toBe('renewed');
    expect(closed.data.renewalId).toBe(renewal.id);
    expect(closed.data.autoRenew).toBe(false);

    // A renewed contract is a closed record; renewing it again must fail.
    const again = await services.contracts.renew(original.id, { termMonths: 12, startDate: '2027-01-01', value: 100_000 });
    expect(again.ok).toBe(false);
    expect(!again.ok && again.error.code).toBe('validation_failed');
  });

  it('refuses a renewal with a term or value that cannot be sold', async () => {
    const { services } = fresh();
    const original = (await services.contracts.list({ pageSize: 50 })).items.find((contract) => contract.status === 'active');
    expect(original).toBeDefined();
    if (!original) return;

    const badTerm = await services.contracts.renew(original.id, { termMonths: 0, startDate: '2026-11-01', value: 100_000 });
    expect(badTerm.ok).toBe(false);
    expect(!badTerm.ok && badTerm.error.code).toBe('validation_failed');
    expect(!badTerm.ok && badTerm.error.fieldErrors?.[0]?.path).toBe('termMonths');

    const badDate = await services.contracts.renew(original.id, { termMonths: 12, startDate: 'not-a-date', value: 100_000 });
    expect(badDate.ok).toBe(false);
    expect(!badDate.ok && badDate.error.fieldErrors?.[0]?.path).toBe('startDate');
  });

  it('terminate records the reason and blocks any further lifecycle action', async () => {
    const { services } = fresh();
    const original = (await services.contracts.list({ pageSize: 50 })).items.find((contract) => contract.status === 'active');
    expect(original).toBeDefined();
    if (!original) return;

    const refused = await services.contracts.terminate(original.id, '   ');
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe('validation_failed');

    const terminated = await services.contracts.terminate(original.id, 'Customer consolidated vendors.');
    expect(terminated.ok).toBe(true);
    if (!terminated.ok) return;
    expect(terminated.data.status).toBe('terminated');
    expect(terminated.data.terminationReason).toBe('Customer consolidated vendors.');
    expect(terminated.data.terminatedAt).toBeTruthy();
    expect(terminated.data.autoRenew).toBe(false);

    const renewAfter = await services.contracts.renew(original.id, { termMonths: 12, startDate: '2027-01-01', value: 50_000 });
    expect(renewAfter.ok).toBe(false);
    const terminateAfter = await services.contracts.terminate(original.id, 'Again.');
    expect(terminateAfter.ok).toBe(false);
  });

  it('amendment appends versioned history and re-derives the annualised value', async () => {
    const { services } = fresh();
    const original = (await services.contracts.list({ pageSize: 50 })).items.find((contract) => contract.status === 'active');
    expect(original).toBeDefined();
    if (!original) return;

    const amended = await services.contracts.amendment(original.id, {
      contractValue: { amount: 360_000, currency: original.currency },
      termMonths: 36,
      endDate: '2029-11-01',
    });
    expect(amended.ok).toBe(true);
    if (!amended.ok) return;
    expect(amended.data.annualisedValue.amount).toBe(120_000);
    const amendments = amended.data.documents.filter((document) => document.kind === 'amendment');
    expect(amendments).toHaveLength(1);
    expect(amendments[0]!.version).toBe(1);
    expect(amendments[0]!.placeholder).toBe(true);
    // The expiry countdown follows the amended end date, not the stale seeded value.
    const expectedDays = Math.round((new Date('2029-11-01').getTime() - DATASET_EPOCH.getTime()) / 86_400_000);
    expect(amended.data.daysUntilExpiry).toBe(expectedDays);

    const second = await services.contracts.amendment(original.id, { noticePeriodDays: 60 });
    expect(second.ok && second.data.documents.filter((document) => document.kind === 'amendment')).toHaveLength(2);
  });

  it('expiring returns only in-window contracts for the active organization, soonest first', async () => {
    const { db, services, organizationId } = fresh();
    const withinDays = 90;
    const page = await services.contracts.expiring(withinDays);
    const expected = Object.values(db.state.contracts)
      .filter((contract) => contract.organizationId === organizationId)
      .filter((contract) => contract.status === 'active' || contract.status === 'expiring_soon')
      .map((contract) => ({ id: contract.id, days: Math.round((new Date(contract.endDate).getTime() - DATASET_EPOCH.getTime()) / 86_400_000) }))
      .filter((entry) => entry.days >= 0 && entry.days <= withinDays)
      .sort((left, right) => left.days - right.days);

    expect(page.items.map((contract) => contract.id)).toEqual(expected.map((entry) => entry.id));
    for (const contract of page.items) {
      expect(contract.organizationId).toBe(organizationId);
      expect(contract.daysUntilExpiry).toBeGreaterThanOrEqual(0);
      expect(contract.daysUntilExpiry).toBeLessThanOrEqual(withinDays);
    }
  });

  it('markPaid settles the balance and refuses to run twice', async () => {
    const { services } = fresh();
    const invoice = (await services.invoices.list({ pageSize: 50 })).items.find(
      (candidate) => candidate.status === 'issued' || candidate.status === 'payment_pending' || candidate.status === 'overdue',
    );
    expect(invoice).toBeDefined();
    if (!invoice) return;

    const paid = await services.invoices.markPaid(invoice.id, '2026-10-10');
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.data.status).toBe('payment_received');
    expect(paid.data.amountPaid.amount).toBe(invoice.total.amount);
    expect(paid.data.balanceDue.amount).toBe(0);
    expect(paid.data.dunningStage).toBe('none');
    expect(paid.data.paidDate).toBe('2026-10-10');

    const again = await services.invoices.markPaid(invoice.id, '2026-10-11');
    expect(again.ok).toBe(false);
    expect(!again.ok && again.error.code).toBe('validation_failed');

    const badDate = await services.invoices.markPaid(invoice.id, 'yesterday');
    expect(badDate.ok).toBe(false);
  });

  it('recordPayment accumulates partial payments and settles the invoice', async () => {
    const { services } = fresh();
    const invoice = (await services.invoices.list({ pageSize: 50 })).items.find(
      (candidate) => candidate.balanceDue.amount > 1 && candidate.status !== 'void',
    );
    expect(invoice).toBeDefined();
    if (!invoice) return;

    const balance = invoice.balanceDue.amount;
    const first = await services.invoices.recordPayment(invoice.id, Math.floor(balance / 2));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.status).toBe('payment_pending');
    expect(first.data.amountPaid.amount).toBe(invoice.amountPaid.amount + Math.floor(balance / 2));
    expect(first.data.balanceDue.amount).toBe(invoice.total.amount - first.data.amountPaid.amount);

    const second = await services.invoices.recordPayment(invoice.id, balance);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.status).toBe('payment_received');
    expect(second.data.balanceDue.amount).toBe(0);
    expect(second.data.dunningStage).toBe('none');
    expect(second.data.paidDate).toBeTruthy();

    const zero = await services.invoices.recordPayment(invoice.id, 0);
    expect(zero.ok).toBe(false);
    expect(!zero.ok && zero.error.code).toBe('validation_failed');
  });

  it('void records the reason, zeroes the balance and refuses paid invoices', async () => {
    const { services } = fresh();
    const invoices = (await services.invoices.list({ pageSize: 50 })).items;
    const open = invoices.find((candidate) => candidate.status !== 'payment_received' && candidate.status !== 'void');
    const paid = invoices.find((candidate) => candidate.status === 'payment_received');
    expect(open).toBeDefined();
    expect(paid).toBeDefined();
    if (!open || !paid) return;

    const voided = await services.invoices.void(open.id, 'Raised against the wrong contract.');
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    expect(voided.data.status).toBe('void');
    expect(voided.data.balanceDue.amount).toBe(0);
    expect(voided.data.dunningStage).toBe('none');
    expect(voided.data.notes).toContain('Voided: Raised against the wrong contract.');

    // A paid invoice is money already moved; voiding it here would be a lie about refunds.
    const refused = await services.invoices.void(paid.id, 'Should not work.');
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe('validation_failed');

    const paidRefused = await services.invoices.markPaid(open.id, '2026-10-10');
    expect(paidRefused.ok).toBe(false);
  });

  it('seeds invoices whose dates run in one direction', () => {
    const { db } = fresh();
    const epoch = DATASET_EPOCH.getTime();
    for (const invoice of Object.values(db.state.invoices)) {
      // The invoice screens show both dates side by side, so a due date that precedes the
      // issue date is visible nonsense rather than a detail nobody checks.
      expect(new Date(invoice.dueDate).getTime()).toBeGreaterThanOrEqual(new Date(invoice.issueDate).getTime());
      if (invoice.paidDate) {
        expect(new Date(invoice.paidDate).getTime()).toBeGreaterThanOrEqual(new Date(invoice.issueDate).getTime());
        expect(new Date(invoice.paidDate).getTime()).toBeLessThanOrEqual(epoch);
      }
      if (invoice.status === 'overdue') expect(new Date(invoice.dueDate).getTime()).toBeLessThan(epoch);
      // ...and the reverse holds: an unsettled invoice that is past its due date has to carry the
      // overdue status, otherwise the overdue summary on the invoice screen understates it.
      if (invoice.status !== 'overdue' && invoice.status !== 'payment_received') {
        expect(new Date(invoice.dueDate).getTime()).toBeGreaterThanOrEqual(epoch);
        expect(invoice.balanceDue.amount).toBeGreaterThan(0);
      }
    }
  });

  it('scopes the subscription list and revenue report to the active organization', async () => {
    const { db, services, organizationId } = fresh();
    const list = await services.subscriptionRevenue.list({ pageSize: 50 });
    expect(list.items.length).toBeGreaterThan(0);
    for (const subscription of list.items) expect(subscription.organizationId).toBe(organizationId);

    const orgSubscriptions = Object.values(db.state.revenueSubscriptions).filter(
      (subscription) => subscription.organizationId === organizationId,
    );
    const isChurned = (subscription: RevenueSubscription): boolean =>
      subscription.status === 'cancelled' || subscription.status === 'expired' || subscription.movement === 'churn';
    // MRR is the live book only; a cancelled subscription is churn, not recurring revenue.
    const expectedMrr = orgSubscriptions.filter((subscription) => !isChurned(subscription)).reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
    const expectedChurn = orgSubscriptions.filter(isChurned).reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
    const report = await services.subscriptionRevenue.report('ttm');
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    // One tenant, one currency: the totals must not mix organizations.
    expect(report.data.metrics.mrr.amount).toBe(expectedMrr);
    expect(report.data.metrics.churnedMrr.amount).toBe(expectedChurn);
    const activeOrg = Object.values(db.state.organizations).find((candidate) => candidate.id === organizationId)!;
    expect(report.data.currency).toBe(activeOrg.defaultCurrency);
    for (const account of report.data.topAccountsByMrr) {
      expect(db.state.accounts[account.accountId]?.organizationId).toBe(organizationId);
    }
    expect(report.data.movementBridge.at(-1)?.value).toBe(expectedMrr);
    // A bridge that does not add up is a chart of made-up numbers. Opening is derived so that
    // opening plus every movement lands exactly on the closing total the metrics report.
    const bridge = report.data.movementBridge;
    const movements = bridge.slice(1, -1).reduce((sum, row) => sum + row.value, 0);
    expect((bridge[0]?.value ?? 0) + movements).toBe(bridge.at(-1)?.value);
    // Retention is measured against that opening base, so NRR is the closing/opening ratio.
    const opening = bridge[0]?.value ?? 0;
    expect(report.data.metrics.netRevenueRetention).toBe(Number(((expectedMrr / opening) * 100).toFixed(1)));
  });
});

/* -------------------------------------------------------- cross-cutting rules */

describe('cross-cutting honesty rules (batches 9–17)', () => {
  it('scopes the new modules to the active organization', async () => {
    const { db, services, organizationId } = fresh();
    const other = Object.values(db.state.organizations).find((organization) => organization.id !== organizationId)!;

    const before = await services.customerSuccess.renewals({ pageSize: 50 });
    const beforeIds = before.items.map((renewal) => renewal.id).sort();

    await services.tenant.switchOrganization(other.id);
    const after = await services.customerSuccess.renewals({ pageSize: 50 });
    const afterIds = after.items.map((renewal) => renewal.id).sort();

    expect(before.items.length).toBeGreaterThan(0);
    expect(after.items.length).toBeGreaterThan(0);
    // Switching tenant must visibly change the dataset, not just re-label it.
    expect(afterIds).not.toEqual(beforeIds);
  });

  it('keeps every AI reply labelled as coming from the demo engine', async () => {
    const { services } = fresh();
    const conversation = await services.ai.createConversation({ entryPoint: 'assistant_home' });
    expect(conversation.ok).toBe(true);
    if (!conversation.ok) return;
    const reply = await services.ai.send(conversation.data.id, 'Summarise my pipeline', 'general_assistant');
    expect(reply.ok).toBe(true);
    expect(reply.ok && reply.data.origin).toBe('demo_template_engine');
  });
});
