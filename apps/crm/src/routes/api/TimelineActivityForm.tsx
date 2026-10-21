import * as React from 'react';
import {
  ApiError, type ActivityInput, type ApiActivityKind, type ApiActivityStatus,
  type ApiAssignee, type ApiTimelineSubject, createLaravelClient,
} from '../../app/laravelClient';

type Client = ReturnType<typeof createLaravelClient>;
type Props = {
  client: Client;
  subjectType: ApiTimelineSubject;
  subjectId: string;
  onSaved: () => void;
  onCancel: () => void;
};

export default function TimelineActivityForm({ client, subjectType, subjectId, onSaved, onCancel }: Props) {
  const [kind, setKind] = React.useState<ApiActivityKind>('task');
  const [status, setStatus] = React.useState<ApiActivityStatus>('open');
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [due, setDue] = React.useState('');
  const [assignedTo, setAssignedTo] = React.useState('');
  const [assignees, setAssignees] = React.useState<ApiAssignee[]>([]);
  const [assigneesError, setAssigneesError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    void client.listAssignees().then((data) => {
      if (active) { setAssignees(data); setAssigneesError(''); }
    }).catch((cause: unknown) => {
      if (active) setAssigneesError(cause instanceof ApiError ? cause.message : 'Could not load assignees.');
    });
    return () => { active = false; };
  }, [client]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    const selected = subjectType + '_id';
    const payload: ActivityInput = {
      title: title.trim(), kind, status, notes: notes.trim() || null,
      ...(due ? { due_at: new Date(due).toISOString() } : {}),
      ...(assignedTo ? { assigned_to: assignedTo } : {}),
      [selected]: subjectId,
    };
    setBusy(true); setError('');
    try {
      await client.createActivity(payload);
      onSaved();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save the activity.');
    } finally { setBusy(false); }
  };

  return <form aria-label="Log customer interaction" onSubmit={(event) => { void submit(event); }}
    className="space-y-3 rounded-xl border p-4">
    <h3 className="font-semibold">Log an interaction or plan a follow-up</h3>
    <p className="text-sm text-muted">This saves a real CRM activity. It does not place calls, deliver reminders or send messages.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">Type
        <select aria-label="Interaction type" className="mt-1 block w-full rounded border p-2"
          value={kind} onChange={(event) => {
            setKind(event.target.value as ApiActivityKind);
            setStatus('open');
          }}>
          <option value="task">Follow-up task</option>
          <option value="call">Call log</option>
          <option value="meeting">Meeting</option>
        </select>
      </label>
      <label className="block text-sm">State
        <select aria-label="Interaction status" className="mt-1 block w-full rounded border p-2"
          value={status} onChange={(event) => setStatus(event.target.value as ApiActivityStatus)}>
          <option value="open">Planned / open</option>
          <option value="completed">Completed / already happened</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
    </div>
    <label className="block text-sm">Subject
      <input required maxLength={200} className="mt-1 block w-full rounded border p-2"
        value={title} onChange={(event) => setTitle(event.target.value)}
        placeholder={kind === 'task' ? 'Follow up on quotation' : kind === 'call' ? 'Discuss contract renewal' : 'Product demonstration'}/>
    </label>
    <label className="block text-sm">Details / outcome
      <textarea className="mt-1 block w-full rounded border p-2" rows={3} maxLength={10000}
        value={notes} onChange={(event) => setNotes(event.target.value)}
        placeholder="What was discussed, what happens next…"/>
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">{status === 'completed' ? 'Interaction date / time (optional)' : 'Due date / time (optional)'}
        <input type="datetime-local" className="mt-1 block w-full rounded border p-2"
          value={due} onChange={(event) => setDue(event.target.value)}/>
      </label>
      <label className="block text-sm">Assign to
        <select aria-label="Assign to" className="mt-1 block w-full rounded border p-2"
          value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
          <option value="">Me (current logged-in member)</option>
          {assignees.map((person) =>
            <option key={person.id} value={person.id}>{person.name} ({person.role})</option>)}
        </select>
      </label>
    </div>
    {assigneesError && <p role="alert" className="text-sm">{assigneesError} Assigning to another member is unavailable.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex gap-3">
      <button disabled={busy || !title.trim()} type="submit"
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Save interaction</button>
      <button type="button" disabled={busy} onClick={onCancel} className="rounded border px-4 py-2">Cancel</button>
    </div>
  </form>;
}
