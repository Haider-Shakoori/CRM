/**
 * Playbook seed.
 *
 * The `playbooks` collection is declared empty in `seed/index.ts`, so every screen has a real
 * collection to read. This module fills it deterministically: every value comes from the
 * organization's seeded `createRandom` generator and the fixed `DATASET_EPOCH`, so the same
 * eight playbooks with the same steps are produced on every run.
 *
 * `Math.random` is never used. Recovery is therefore reproducible: a test written against a
 * step's title or due offset keeps passing.
 *
 * It is called once per organization inside the loop in `seed/index.ts` and merged with
 * `add('playbooks', ...)`, so each tenant gets its own playbook set.
 */

import type { Playbook, PlaybookStep } from '@crm/shared-types';
import { DATASET_EPOCH, toDateTimeString } from '../lib/random';
import type { OrgContext } from './foundation';

interface StepTemplate {
  title: string;
  guidance: string;
  required: boolean;
  createsTask: boolean;
  taskDueOffsetDays: number;
  resources?: PlaybookStep['resources'];
}

interface PlaybookTemplate {
  purpose: Playbook['purpose'];
  name: string;
  description: string;
  /** Which stages the playbook is suggested on; resolved against the tenant's pipelines. */
  useSalesStages: boolean;
  steps: StepTemplate[];
}

/**
 * The catalogue.
 *
 * Steps marked `createsTask` are the ones `playbooks.apply` turns into real local tasks; the
 * rest are guidance the reader works through by hand. Keeping the two explicit is what stops
 * the UI presenting advice as an automation that ran.
 */
const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    purpose: 'qualification',
    name: 'Inbound qualification triage',
    description: 'A repeatable first pass over a new inbound lead before it reaches an account executive.',
    useSalesStages: true,
    steps: [
      { title: 'Confirm the buying context', guidance: 'Check the domain, the reported team size and the source against the firmographic record.', required: true, createsTask: false, taskDueOffsetDays: 1 },
      { title: 'Score against the ideal profile', guidance: 'Record a rating and note the two strongest fit signals.', required: true, createsTask: true, taskDueOffsetDays: 1 },
      { title: 'Identify the decision maker', guidance: 'Name the economic buyer or mark the lead as needing enrichment.', required: true, createsTask: true, taskDueOffsetDays: 2, resources: [{ kind: 'doc', label: 'Buying-committee checklist' }] },
      { title: 'Route or disqualify', guidance: 'Assign an owner, or record the disqualification reason so reporting stays honest.', required: true, createsTask: true, taskDueOffsetDays: 2, resources: [{ kind: 'script', label: 'Disqualification script' }] },
    ],
  },
  {
    purpose: 'discovery',
    name: 'Structured discovery call',
    description: 'The question set a rep works through on the first substantive call, with the evidence to capture.',
    useSalesStages: true,
    steps: [
      { title: 'Set the agenda', guidance: 'Agree the three outcomes of the call in the first two minutes.', required: true, createsTask: false, taskDueOffsetDays: 1 },
      { title: 'Map the current process', guidance: 'Capture the steps, the tools and the hand-offs the customer uses today.', required: true, createsTask: false, taskDueOffsetDays: 1, resources: [{ kind: 'template', label: 'Process map template' }] },
      { title: 'Quantify the impact', guidance: 'Attach a number to the cost of the status quo before proposing anything.', required: true, createsTask: true, taskDueOffsetDays: 2 },
      { title: 'Confirm success criteria', guidance: 'Write the customer\'s definition of done in their words.', required: true, createsTask: true, taskDueOffsetDays: 2 },
      { title: 'Log the follow-up', guidance: 'Send the summary within one business day while the detail is fresh.', required: true, createsTask: true, taskDueOffsetDays: 3 },
    ],
  },
  {
    purpose: 'objection_handling',
    name: 'Pricing objection response',
    description: 'A calm, evidence-first response to a price objection, without discounting by reflex.',
    useSalesStages: true,
    steps: [
      { title: 'Separate price from value', guidance: 'Ask what the customer is comparing against before defending the number.', required: true, createsTask: false, taskDueOffsetDays: 1 },
      { title: 'Restate the quantified impact', guidance: 'Return to the cost of the status quo captured during discovery.', required: true, createsTask: false, taskDueOffsetDays: 1, resources: [{ kind: 'script', label: 'Value restatement script' }] },
      { title: 'Offer a scoping option', guidance: 'Propose a smaller starting scope rather than an unmanaged discount.', required: true, createsTask: true, taskDueOffsetDays: 2, resources: [{ kind: 'doc', label: 'Scoping options worksheet' }] },
      { title: 'Escalate only if justified', guidance: 'Record why an exception is warranted so approvals stay auditable.', required: false, createsTask: true, taskDueOffsetDays: 3 },
    ],
  },
  {
    purpose: 'onboarding',
    name: 'Standard 8-week onboarding',
    description: 'The default onboarding path from kickoff to go-live, split into three phases of work.',
    useSalesStages: false,
    steps: [
      { title: 'Schedule the kickoff', guidance: 'Book the kickoff within five business days of the deal closing.', required: true, createsTask: true, taskDueOffsetDays: 3 },
      { title: 'Agree success criteria', guidance: 'Record the two or three measures the customer will judge the rollout by.', required: true, createsTask: true, taskDueOffsetDays: 5, resources: [{ kind: 'doc', label: 'Success-criteria worksheet' }] },
      { title: 'Configure objects and pipeline', guidance: 'Mirror the customer\'s stages before importing any data.', required: true, createsTask: true, taskDueOffsetDays: 14, resources: [{ kind: 'video_placeholder', label: 'Pipeline configuration walkthrough' }] },
      { title: 'Run the data import', guidance: 'Validate a sample before promoting the full extract.', required: true, createsTask: true, taskDueOffsetDays: 21 },
      { title: 'Train the admin team', guidance: 'Leave the customer with a named owner and a recording.', required: true, createsTask: true, taskDueOffsetDays: 35, resources: [{ kind: 'doc', label: 'Admin enablement guide' }] },
      { title: 'Hold the go-live review', guidance: 'Confirm the success criteria are measurable and set the first review date.', required: true, createsTask: true, taskDueOffsetDays: 56 },
    ],
  },
  {
    purpose: 'renewal',
    name: '90-day renewal motion',
    description: 'The cadence for a renewal inside the final quarter, from value review to signature.',
    useSalesStages: false,
    steps: [
      { title: 'Confirm the renewal owner', guidance: 'Name the internal owner and the customer counterpart before 90 days.', required: true, createsTask: true, taskDueOffsetDays: 3 },
      { title: 'Run the value review', guidance: 'Walk through adoption and outcomes against the original objectives.', required: true, createsTask: true, taskDueOffsetDays: 10, resources: [{ kind: 'template', label: 'Value-review deck outline' }] },
      { title: 'Resolve open risks', guidance: 'Close or formally accept every high-severity risk on the renewal record.', required: true, createsTask: true, taskDueOffsetDays: 21 },
      { title: 'Confirm budget availability', guidance: 'Establish who signs and when the budget cycle allows it.', required: true, createsTask: true, taskDueOffsetDays: 30 },
      { title: 'Send the renewal proposal', guidance: 'Include term, value and any expansion in one document.', required: true, createsTask: true, taskDueOffsetDays: 45, resources: [{ kind: 'doc', label: 'Renewal proposal template' }] },
    ],
  },
  {
    purpose: 'win_back',
    name: 'Churned account win-back',
    description: 'A measured re-engagement sequence for a logo that churned, without pretending the history is clean.',
    useSalesStages: false,
    steps: [
      { title: 'Review the churn reason', guidance: 'Read the recorded reason and the exit notes before making contact.', required: true, createsTask: false, taskDueOffsetDays: 2 },
      { title: 'Check the capability gap', guidance: 'Confirm whether the reason for leaving has actually changed.', required: true, createsTask: true, taskDueOffsetDays: 7 },
      { title: 'Reach out with a specific reason', guidance: 'Lead with the change, not a generic check-in.', required: true, createsTask: true, taskDueOffsetDays: 10, resources: [{ kind: 'script', label: 'Win-back outreach script' }] },
      { title: 'Offer the shortest path back', guidance: 'Propose a narrow re-entry rather than the original full scope.', required: false, createsTask: true, taskDueOffsetDays: 14 },
    ],
  },
  {
    purpose: 'escalation',
    name: 'Executive escalation response',
    description: 'What happens when an account escalates: acknowledge, contain, then communicate on a clock.',
    useSalesStages: false,
    steps: [
      { title: 'Acknowledge within the hour', guidance: 'A named person responds to the escalation before any diagnosis.', required: true, createsTask: true, taskDueOffsetDays: 1 },
      { title: 'Contain the impact', guidance: 'Stabilise the affected users before root-causing.', required: true, createsTask: true, taskDueOffsetDays: 1 },
      { title: 'Agree the communication cadence', guidance: 'Set a fixed update time and keep it, even with no news.', required: true, createsTask: true, taskDueOffsetDays: 2 },
      { title: 'Write the follow-up review', guidance: 'Publish what happened, what changed and what will prevent a repeat.', required: true, createsTask: true, taskDueOffsetDays: 7, resources: [{ kind: 'template', label: 'Incident review template' }] },
    ],
  },
  {
    purpose: 'custom',
    name: 'Quarterly business review',
    description: 'A lightweight structure for a recurring business review, adaptable per account.',
    useSalesStages: false,
    steps: [
      { title: 'Assemble the adoption summary', guidance: 'Pull usage and outcome figures before the agenda is written.', required: true, createsTask: true, taskDueOffsetDays: 5 },
      { title: 'Draft the agenda', guidance: 'Three topics maximum; leave time for the customer\'s own.', required: true, createsTask: false, taskDueOffsetDays: 6 },
      { title: 'Confirm attendees', guidance: 'Ensure the executive sponsor is invited, not only the day-to-day users.', required: true, createsTask: true, taskDueOffsetDays: 6 },
      { title: 'Record actions with owners', guidance: 'Every action leaves the review with a name and a date.', required: true, createsTask: true, taskDueOffsetDays: 8 },
    ],
  },
];

export function makePlaybooks(ctx: OrgContext): Playbook[] {
  const { random, organization, teams, pipelines } = ctx;
  const salesStageIds = (pipelines[0]?.stages ?? []).slice(0, 3).map((stage) => stage.id);
  const ownerTeamIds = teams.slice(0, 2).map((team) => team.id);

  return PLAYBOOK_TEMPLATES.map((template, playbookIndex) => {
    const steps: PlaybookStep[] = template.steps.map((step, stepIndex) => ({
      id: `pbs-${organization.id}-${playbookIndex + 1}-${stepIndex + 1}`,
      order: stepIndex + 1,
      title: step.title,
      guidance: step.guidance,
      resources: step.resources,
      createsTask: step.createsTask,
      taskDueOffsetDays: step.taskDueOffsetDays,
      required: step.required,
      completionCount: step.createsTask ? random.int(0, 48) : undefined,
    }));

    return {
      id: `pb-${organization.id}-${playbookIndex + 1}`,
      organizationId: organization.id,
      name: template.name,
      description: template.description,
      purpose: template.purpose,
      steps,
      applicableStageIds: template.useSalesStages && salesStageIds.length > 0 ? salesStageIds : undefined,
      ownerTeamIds,
      timesUsed: random.int(4, 120),
      avgCompletionRate: random.int(52, 96),
      // One playbook is archived-style inactive so an inactive state is representable.
      isActive: playbookIndex !== PLAYBOOK_TEMPLATES.length - 1,
      createdAt: toDateTimeString(random.pastDate(360, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(30, DATASET_EPOCH)),
    };
  });
}
