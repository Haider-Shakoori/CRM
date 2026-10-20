import * as React from 'react';
import {
  ApiError, type ApiLead, type ApiLeadConversion, type ApiLeadMatches, type ApiAccount,
  type ApiPipeline, type LeadConversionInput, createLaravelClient,
} from '../../app/laravelClient';

type Client = ReturnType<typeof createLaravelClient>;
type Props = {
  client: Client;
  lead: Pick<ApiLead, 'id' | 'name' | 'email' | 'version'>;
  onConverted: (value: ApiLeadConversion) => void;
  onCancel: () => void;
};
const message = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Unable to complete this CRM request.';

export default function LeadConversionForm({ client, lead, onConverted, onCancel }: Props) {
  const [first, ...remaining] = lead.name.trim().split(/\s+/);
  const [firstName, setFirstName] = React.useState(first ?? '');
  const [lastName, setLastName] = React.useState(remaining.join(' '));
  const [accountMode, setAccountMode] = React.useState<'new' | 'existing'>('new');
  const [accountName, setAccountName] = React.useState('');
  const [accountQuery, setAccountQuery] = React.useState('');
  const [accounts, setAccounts] = React.useState<ApiAccount[]>([]);
  const [accountId, setAccountId] = React.useState('');
  const [accountsLoaded, setAccountsLoaded] = React.useState(false);
  const [matches, setMatches] = React.useState<ApiLeadMatches | null>(null);
  const [matchesError, setMatchesError] = React.useState('');
  const [ackDuplicates, setAckDuplicates] = React.useState(false);
  const [pipelines, setPipelines] = React.useState<ApiPipeline[]>([]);
  const [pipelineError, setPipelineError] = React.useState('');
  const [withDeal, setWithDeal] = React.useState(false);
  const [pipelineId, setPipelineId] = React.useState('');
  const [stageId, setStageId] = React.useState('');
  const [dealName, setDealName] = React.useState(lead.name + ' opportunity');
  const [dealAmount, setDealAmount] = React.useState('0');
  const [dealCurrency, setDealCurrency] = React.useState('USD');
  const [expectedClose, setExpectedClose] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const hasMatches = !!matches && (matches.contact_email_matches.length + matches.lead_email_matches.length > 0);
  const chosenPipeline = pipelines.find((item) => item.id === pipelineId);

  React.useEffect(() => {
    let active = true;
    void client.leadMatches(lead.id).then((result) => {
      if (active) { setMatches(result); setMatchesError(''); }
    }).catch((cause: unknown) => {
      if (active) setMatchesError(message(cause));
    });
    void client.listPipelines().then((result) => {
      if (active) setPipelines(result);
    }).catch((cause: unknown) => {
      if (active) setPipelineError(message(cause));
    });
    return () => { active = false; };
  }, [client, lead.id]);

  const searchAccounts = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true); setError('');
    try {
      const result = await client.listAccounts({ q: accountQuery.trim() || undefined, pageSize: 25 });
      setAccounts(result.items); setAccountsLoaded(true); setAccountId('');
    } catch (cause) { setError(message(cause)); }
    finally { setSearching(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !matches || matchesError || (hasMatches && !ackDuplicates)) return;
    if (accountMode === 'existing' && !accountId) {
      setError('Select an existing Account first.'); return;
    }
    if (accountMode === 'new' && !accountName.trim()) {
      setError('Enter the new Account name.'); return;
    }
    const payload: LeadConversionInput = {
      expected_version: lead.version,
      first_name: firstName.trim(), last_name: lastName.trim(),
      ...(accountMode === 'existing' ? { account_id: accountId } : { account_name: accountName.trim() }),
      ...(hasMatches ? { allow_duplicate_contact: ackDuplicates } : {}),
    };
    if (withDeal) {
      const value = Number(dealAmount);
      if (!pipelineId || !stageId || !dealName.trim() || !Number.isFinite(value) || value < 0 ||
          !/^[A-Za-z]{3}$/.test(dealCurrency)) {
        setError('Complete the Deal name, pipeline, stage, amount and three-letter currency.'); return;
      }
      payload.deal = {
        name: dealName.trim(), pipeline_id: pipelineId, stage_id: stageId,
        amount: value, currency: dealCurrency.toUpperCase(),
        expected_close_date: expectedClose || null,
      };
    }
    setBusy(true); setError('');
    try {
      const result = await client.convertLead(lead.id, payload);
      onConverted(result);
    } catch (cause) {
      setError(message(cause));
    } finally { setBusy(false); }
  };

  return <form className="space-y-4 rounded border p-4" aria-label="Convert lead to contact and account"
    onSubmit={(event) => { void submit(event); }}>
    <h2 className="text-lg font-semibold">Convert Lead</h2>
    <p className="text-sm text-muted">Creates a linked Contact and Account, with an optional Deal. The original Lead and its conversion history remain available.</p>
    <section className="space-y-2 rounded border p-3" aria-label="Possible duplicate records">
      <h3 className="font-medium">Possible duplicates</h3>
      {!matches && !matchesError && <p role="status">Checking existing Contacts and Leads…</p>}
      {matchesError && <p role="alert">Duplicate check failed: {matchesError}. Conversion is blocked until it succeeds.</p>}
      {matches && !hasMatches && <p className="text-sm">No existing Contacts or other Leads with the same email in this organization.</p>}
      {matches && hasMatches && <>
        <p role="alert" className="text-sm">Records with the same email were found. Review them before creating a separate Contact.</p>
        <ul className="list-disc pl-5 text-sm">
          {matches.contact_email_matches.map((entry) => <li key={entry.id}>Contact: {entry.first_name} {entry.last_name} ({entry.email})</li>)}
          {matches.lead_email_matches.map((entry) => <li key={entry.id}>Lead: {entry.name} ({entry.status})</li>)}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ackDuplicates} onChange={(event) => setAckDuplicates(event.target.checked)}/>
          I reviewed the matches and intend to create a separate Contact.
        </label>
      </>}
      <p className="text-xs text-muted">Matching uses exact, case-insensitive email within the selected organization, not fuzzy identity matching.</p>
    </section>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">First name
        <input required maxLength={120} className="mt-1 block w-full rounded border p-2" value={firstName}
          onChange={(event) => setFirstName(event.target.value)}/>
      </label>
      <label className="text-sm">Last name
        <input required maxLength={120} className="mt-1 block w-full rounded border p-2" value={lastName}
          onChange={(event) => setLastName(event.target.value)}/>
      </label>
    </div>
    <p className="text-xs text-muted">Contact email: {lead.email || 'Not specified'}</p>
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="px-1 font-medium">Account choice</legend>
      <label className="mr-4 text-sm"><input type="radio" name="account-choice" checked={accountMode === 'new'}
        onChange={() => setAccountMode('new')}/> Create new Account</label>
      <label className="text-sm"><input type="radio" name="account-choice" checked={accountMode === 'existing'}
        onChange={() => setAccountMode('existing')}/> Use existing Account</label>
      {accountMode === 'new'
        ? <label className="block text-sm">New Account name
          <input required maxLength={200} className="mt-1 block w-full rounded border p-2"
            value={accountName} onChange={(event) => setAccountName(event.target.value)}/>
          <span className="text-xs text-muted">Existing Accounts with the same normalized name must be selected rather than duplicated.</span>
        </label>
        : <>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-sm">Search existing Accounts
              <input className="mt-1 block w-full rounded border p-2" value={accountQuery}
                onChange={(event) => setAccountQuery(event.target.value)} placeholder="Account name" />
            </label>
            <button type="button" className="rounded border px-3 py-2" disabled={searching || busy}
              onClick={() => { void searchAccounts({ preventDefault: () => {} } as React.FormEvent); }}>Search</button>
          </div>
          <label className="block text-sm">Account
            <select required className="mt-1 block w-full rounded border p-2" value={accountId}
              onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Select an Account</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          {accountsLoaded && <p className="text-xs text-muted">Showing up to 25 matching Accounts. Refine the search for other records.</p>}
        </>}
    </fieldset>
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="px-1 font-medium">Opportunity (optional)</legend>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={withDeal} onChange={(event) => setWithDeal(event.target.checked)}/>
        Create a Deal linked to the chosen Account
      </label>
      {withDeal && <>
        {pipelineError && <p role="alert">{pipelineError}</p>}
        <label className="block text-sm">Deal name
          <input required maxLength={200} className="mt-1 block w-full rounded border p-2"
            value={dealName} onChange={(event) => setDealName(event.target.value)}/>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Pipeline
            <select required className="mt-1 block w-full rounded border p-2" value={pipelineId}
              onChange={(event) => { setPipelineId(event.target.value); setStageId(''); }}>
              <option value="">Select pipeline</option>
              {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Stage
            <select required className="mt-1 block w-full rounded border p-2" value={stageId}
              onChange={(event) => setStageId(event.target.value)}>
              <option value="">Select stage</option>
              {chosenPipeline?.stages.map((stage) =>
                <option value={stage.id} key={stage.id}>{stage.name} ({stage.kind})</option>)}
            </select>
          </label>
          <label className="text-sm">Amount
            <input required type="number" step="0.01" min={0} className="mt-1 block w-full rounded border p-2"
              value={dealAmount} onChange={(event) => setDealAmount(event.target.value)}/>
          </label>
          <label className="text-sm">Currency
            <input required minLength={3} maxLength={3} className="mt-1 block w-full rounded border p-2"
              value={dealCurrency} onChange={(event) => setDealCurrency(event.target.value)}/>
          </label>
          <label className="text-sm">Expected close date
            <input type="date" className="mt-1 block w-full rounded border p-2" value={expectedClose}
              onChange={(event) => setExpectedClose(event.target.value)}/>
          </label>
        </div>
      </>}
    </fieldset>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={busy || !matches || !!matchesError || (hasMatches && !ackDuplicates)}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Confirm conversion</button>
      <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancel</button>
    </div>
  </form>;
}
