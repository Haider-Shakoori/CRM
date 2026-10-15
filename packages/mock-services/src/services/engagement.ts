/**
 * Sales engagement services: sequences (cadences).
 *
 * Split from `index.ts` for the same reason as `extra.ts`: the container assembly stays
 * readable, and the domain logic lives beside the domain. Everything here follows the
 * established rules — reads are complete over the seeded store, writes mutate local state
 * through the store, derived values are computed rather than stored twice, and anything that
 * genuinely depends on a backend is labelled honestly instead of fabricating a result.
 *
 * ## Why enrolments are synthetic
 *
 * The seeded store has a `sequences` collection but **no** `sequenceEnrollments` collection.
 * A sequence stores aggregate counters (`enrolledCount`, `activeCount`, `completedCount`) but
 * not the per-record rows a real product would keep. Rather than invent a second collection
 * (which would require editing the seed and the store), this service *derives* a deterministic,
 * stable set of enrolment rows from the sequence's own counters and the seeded lead/contact
 * pool. The mapping from a sequence to its people is therefore a pure function of the dataset:
 * the same sequence always produces the same rows, so the builder, the list and any test agree.
 *
 * Status changes made from the UI (pause, resume, remove, enroll) are held in a session-local
 * override map. They are real against this browser session and are reported as such; nothing is
 * transmitted anywhere.
 */

import type {
  BulkActionOutcome,
  Contact,
  Id,
  Lead,
  Result,
  Sequence,
  SequenceEnrollment,
  ServiceContainer,
} from '@crm/shared-types';
import { DATASET_EPOCH, toDateTimeString } from '../lib/random';
import { runQuery } from '../lib/query';
import { MockDb, type CollectionName } from '../lib/store';
import { createCrud, delay, err, ok } from './factory';

type Db = MockDb;

const asRecords = <T>(database: Db, collection: CollectionName): T[] => database.all(collection) as unknown as T[];

/** The organization a request belongs to. Mirrors the resolver in `services/index.ts`. */
function currentOrganizationId(db: Db): Id {
  return Object.values(db.state.users)[0]?.activeOrganizationId ?? Object.values(db.state.organizations)[0]?.id ?? 'org-vertex';
}

/** Stable, dependency-free string hash so derived rows never change between renders. */
function hashOf(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100_000;
  }
  return hash;
}

const DAY_MS = 86_400_000;

/** A person a sequence can be worked against, reduced to what the enrolment list shows. */
interface EnrollableRecord {
  id: Id;
  label: string;
}

function leadLabel(lead: Lead): string {
  const person = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim();
  return lead.companyName || person || lead.reference || 'Lead';
}

function contactLabel(contact: Contact): string {
  return contact.displayName || [contact.firstName, contact.lastName].join(' ').trim() || contact.reference || 'Contact';
}

export function makeSequencesService(db: Db): ServiceContainer['sequences'] {
  const sequences = createCrud<Sequence>(db, 'sequences', {
    label: 'Sequence',
    searchFields: ['name', 'description'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  /** Session-local enrolment edits. Real for this browser session; never transmitted. */
  const overrides = new Map<Id, Partial<SequenceEnrollment>>();
  const removed = new Set<Id>();

  /** The candidate pool for a sequence, chosen by its declared target type. */
  function poolFor(sequence: Sequence): EnrollableRecord[] {
    if (sequence.targetType === 'lead') {
      return asRecords<Lead>(db, 'leads').map((lead) => ({ id: lead.id, label: leadLabel(lead) }));
    }
    return asRecords<Contact>(db, 'contacts').map((contact) => ({ id: contact.id, label: contactLabel(contact) }));
  }

  /** Resolve a display label for one record id, used when a person is enrolled by hand. */
  function labelFor(type: 'lead' | 'contact', id: Id): string {
    if (type === 'lead') {
      const lead = db.state.leads[id];
      return lead ? leadLabel(lead) : id;
    }
    const contact = db.state.contacts[id];
    return contact ? contactLabel(contact) : id;
  }

  /**
   * Derive a deterministic set of enrolment rows for a sequence.
   *
   * The row count is bounded so the detail screen paginates rather than rendering thousands
   * of synthetic rows, and it never exceeds the sequence's own `activeCount` when that is
   * smaller. Statuses are spread so every state the UI supports is visible somewhere.
   */
  function deriveEnrollments(sequence: Sequence): SequenceEnrollment[] {
    const pool = poolFor(sequence);
    if (pool.length === 0) return [];

    const ceiling = sequence.activeCount > 0 ? sequence.activeCount : 12;
    const wanted = Math.max(3, Math.min(28, Math.min(ceiling, pool.length)));
    const seed = hashOf(sequence.id);
    const stepCount = Math.max(1, sequence.steps.length);

    const rows: SequenceEnrollment[] = [];
    for (let index = 0; index < wanted; index += 1) {
      const record = pool[(seed + index * 7) % pool.length];
      if (!record) continue;

      const statusIndex = (seed + index * 13) % 100;
      const status: SequenceEnrollment['status'] =
        index % 17 === 0
          ? 'paused'
          : statusIndex % 23 === 0
            ? 'bounced'
            : statusIndex % 11 === 0
              ? 'replied'
              : statusIndex % 7 === 0
                ? 'completed'
                : 'active';

      const enrolledAt = toDateTimeString(new Date(DATASET_EPOCH.getTime() - (10 + (index % 40)) * DAY_MS));
      const lastStepAt = toDateTimeString(new Date(DATASET_EPOCH.getTime() - (index % 5) * DAY_MS));
      const nextStepAt =
        status === 'active' ? toDateTimeString(new Date(DATASET_EPOCH.getTime() + (1 + (index % 6)) * DAY_MS)) : undefined;

      rows.push({
        id: `enr-${sequence.id}-${index + 1}`,
        sequenceId: sequence.id,
        recordType: sequence.targetType,
        recordId: record.id,
        recordLabel: record.label,
        currentStepOrder: 1 + ((seed + index) % stepCount),
        status,
        enrolledAt,
        nextStepAt,
        lastStepAt,
        ownerId: sequence.ownerId,
      });
    }
    return rows;
  }

  /** Derived rows with this session's edits applied, and removals filtered out. */
  function buildEnrollments(sequence: Sequence): SequenceEnrollment[] {
    return deriveEnrollments(sequence)
      .filter((enrollment) => !removed.has(enrollment.id))
      .map((enrollment) => ({ ...enrollment, ...overrides.get(enrollment.id) }));
  }

  /** Every derived enrolment across every sequence, for id validation in bulk actions. */
  function allEnrollments(): SequenceEnrollment[] {
    return asRecords<Sequence>(db, 'sequences').flatMap((sequence) => buildEnrollments(sequence));
  }

  /** Drop any session-local enrolment state belonging to a sequence that is going away. */
  function forgetSequence(sequenceId: Id): void {
    const prefix = `enr-${sequenceId}-`;
    for (const key of [...overrides.keys()]) if (key.startsWith(prefix)) overrides.delete(key);
    for (const key of [...removed]) if (key.startsWith(prefix)) removed.delete(key);
  }

  /** Apply a patch to each id that resolves to a real derived enrolment; report the rest. */
  function patchEnrollments(ids: Id[], patch: Partial<SequenceEnrollment>): Result<BulkActionOutcome> {
    const known = new Set(allEnrollments().map((enrollment) => enrollment.id));
    const failures: Array<{ id: Id; reason: string }> = [];
    let succeeded = 0;
    for (const id of ids) {
      if (!known.has(id)) {
        failures.push({ id, reason: 'Enrolment not found' });
        continue;
      }
      overrides.set(id, { ...overrides.get(id), ...patch });
      succeeded += 1;
    }
    return ok({ requested: ids.length, succeeded, failed: failures.length, failures });
  }

  return {
    list: (query) => sequences.list(query),
    get: (id) => sequences.get(id),
    create: (input, options) =>
      sequences.create({ ...(input as object), organizationId: currentOrganizationId(db) }, options),
    update: (id, input, options) => sequences.update(id, input, options),
    remove: async (id, options) => {
      forgetSequence(id);
      return sequences.remove(id, options);
    },
    bulkRemove: async (ids, options) => {
      for (const id of ids) forgetSequence(id);
      return sequences.bulkRemove(ids, options);
    },

    enroll: async (sequenceId, records) => {
      await delay(`sequence-enroll:${sequenceId}`);
      const sequence = db.state.sequences[sequenceId];
      if (!sequence) return err<BulkActionOutcome>('not_found', 'That sequence could not be found.');
      if (records.length === 0) {
        return err<BulkActionOutcome>('validation_failed', 'Select at least one record to enrol.');
      }

      const now = new Date().toISOString();
      for (const record of records) {
        const id = `enr-${sequenceId}-manual-${record.id}`;
        overrides.set(id, {
          id,
          sequenceId,
          recordType: record.type,
          recordId: record.id,
          recordLabel: labelFor(record.type, record.id),
          currentStepOrder: 1,
          status: 'active',
          enrolledAt: now,
          ownerId: sequence.ownerId,
        });
      }

      // Counters are seeded aggregates; keep them consistent with the action that was taken.
      db.put('sequences', {
        ...sequence,
        enrolledCount: sequence.enrolledCount + records.length,
        activeCount: sequence.activeCount + records.length,
        updatedAt: now,
      });

      return ok({ requested: records.length, succeeded: records.length, failed: 0, failures: [] });
    },

    pauseEnrollments: async (ids) => {
      await delay('sequence-pause');
      return patchEnrollments(ids, { status: 'paused', nextStepAt: undefined });
    },

    resumeEnrollments: async (ids) => {
      await delay('sequence-resume');
      return patchEnrollments(ids, {
        status: 'active',
        nextStepAt: toDateTimeString(new Date(Date.now() + 2 * DAY_MS)),
      });
    },

    removeEnrollment: async (id) => {
      await delay(`sequence-remove-enrolment:${id}`);
      const exists = allEnrollments().some((enrollment) => enrollment.id === id);
      if (!exists) return err<{ id: Id }>('not_found', 'Enrolment not found.');
      overrides.delete(id);
      removed.add(id);
      return ok({ id });
    },

    enrollments: async (sequenceId, query = {}) => {
      await delay(`sequence-enrollments:${sequenceId}`, { latency: { min: 60, max: 180 } });
      const sequence = db.state.sequences[sequenceId];
      if (!sequence) {
        return {
          items: [],
          meta: { page: 1, pageSize: query.pageSize ?? 25, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
        };
      }
      return runQuery(buildEnrollments(sequence), query, {
        searchFields: ['recordLabel'],
        facetField: 'status',
        defaultSort: [{ field: 'enrolledAt', direction: 'desc' }],
      });
    },
  };
}
