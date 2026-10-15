'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { WorkflowRun } from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  DemoNotice,
  Input,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  PageHeader,
  formatDate,
} from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';

export function WorkflowList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  
  const workflows = useList(
    () => services.workflows.list({ pageSize: 200, q: search || undefined }),
    [search]
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Workflows"
        description="Visual automation with validation, simulation and run history. (Demo only — no real automation runs.)"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Automation' }, { label: 'Workflows' }]}
        sample
        actions={<Button size="sm" onClick={() => navigate('/app/workflows/new')}>New workflow</Button>}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search workflows"
        resultCount={workflows.meta ? `${workflows.meta.total.toLocaleString()} workflows` : undefined}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          Simulation only. Workflows in this demo are validated and simulated in your browser. No external systems are triggered.
        </DemoNotice>
        <div className="grid gap-3">
          {workflows.items.map((wf) => (
            <Card key={wf.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/app/workflows/${wf.id}`} className="text-sm font-semibold hover:underline">
                    {wf.name}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">{wf.description || 'No description'}</p>
                </div>
                <Badge variant={wf.status === 'active' ? 'success' : wf.status === 'draft' ? 'neutral' : 'warning'} size="sm">
                  {wf.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-subtle">
                <span>Target: {wf.target}</span>
                <span>Nodes: {wf.nodes.length}</span>
                <span>Runs: {wf.stats.runCount}</span>
                <span>Last updated: {formatDate(wf.updatedAt)}</span>
              </div>
              <div className="flex gap-2">
                <Button size="xs" variant="secondary" asChild>
                  <Link to={`/app/workflows/${wf.id}`}>Edit</Link>
                </Button>
                <Button size="xs" variant="ghost" asChild>
                  <Link to={`/app/workflows/${wf.id}/runs`}>Runs</Link>
                </Button>
              </div>
            </Card>
          ))}
          {workflows.items.length === 0 && !workflows.loading && (
            <Card className="p-6 text-center text-sm text-muted">No workflows found.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkflowDetail() {
  const services = useServices();
  const { workflowId } = useParams<{ workflowId: string }>();
  const [simulateResult, setSimulateResult] = React.useState<any>(null);
  const [sampleRecordId, setSampleRecordId] = React.useState('');
  const [validating, setValidating] = React.useState(false);
  const [activating, setActivating] = React.useState(false);

  const workflow = useAsync(() => services.workflows.get(workflowId ?? ''), [workflowId], { skip: !workflowId });

  const simulate = async () => {
    if (!workflowId) return;
    const result = await services.workflows.simulate(workflowId, sampleRecordId || undefined);
    if (result.ok) {
      setSimulateResult(result.data);
      notify.success('Simulation completed (demo only)');
    } else {
      notify.error(result.error.message);
    }
  };

  const validate = async () => {
    if (!workflowId) return;
    setValidating(true);
    const result = await services.workflows.validate(workflowId);
    setValidating(false);
    if (result.ok) {
      notify.success(result.data.valid ? 'Workflow is valid' : 'Validation found issues');
    } else {
      notify.error(result.error.message);
    }
  };

  const activate = async () => {
    if (!workflowId) return;
    setActivating(true);
    const result = await services.workflows.activate(workflowId);
    setActivating(false);
    if (result.ok) {
      notify.success('Workflow marked active (simulated — demo only)');
      workflow.reload();
    } else {
      notify.error(result.error.message);
    }
  };

  if (!workflow.data) {
    return <div className="p-6 text-sm text-muted">Loading workflow...</div>;
  }

  const wf = workflow.data;

  return (
    <div className="pb-8">
      <PageHeader
        title={wf.name}
        description="Workflow detail/editor — visual step canvas concept. (Demo only, deterministic simulation.)"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Automation' }, { label: 'Workflows', to: '/app/workflows' }, { label: wf.name }]}
        sample
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={validate} disabled={validating}>Validate</Button>
            <Button size="sm" onClick={activate} disabled={activating}>Enable</Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to={`/app/workflows/${wf.id}/runs`}>Run history</Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          Simulation only. Nothing is executed in external systems. All traces are deterministic.
        </DemoNotice>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Validation</h2>
          <div className="text-xs space-y-1">
            <div>Valid: {wf.validation.valid ? 'Yes' : 'No'}</div>
            {wf.validation.errors.length > 0 && (
              <div>
                Errors:
                <ul className="list-disc ml-4">
                  {wf.validation.errors.map((e) => (
                    <li key={e.id}>{e.message} {e.fixHint && `(${e.fixHint})`}</li>
                  ))}
                </ul>
              </div>
            )}
            {wf.validation.warnings.length > 0 && (
              <div>
                Warnings:
                <ul className="list-disc ml-4">
                  {wf.validation.warnings.map((e) => (
                    <li key={e.id}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Visual step canvas (concept)</h2>
          <div className="grid gap-2 text-xs">
            {wf.nodes.map((node, idx) => (
              <div key={node.id} className="border border-border-subtle rounded p-2">
                <div className="font-medium">Step {idx + 1}: {node.label} ({node.kind})</div>
                {node.description && <div className="text-subtle">{node.description}</div>}
              </div>
            ))}
            {wf.edges.length > 0 && (
              <div className="text-subtle">Edges: {wf.edges.map((e) => `${e.fromNodeId}→${e.toNodeId}`).join(', ')}</div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Simulate against a sample record</h2>
          <div className="flex gap-2 items-end">
            <Input
              value={sampleRecordId}
              onChange={(e) => setSampleRecordId(e.target.value)}
              placeholder="Sample record ID (optional)"
              className="max-w-xs"
            />
            <Button size="sm" onClick={simulate}>Run simulation</Button>
          </div>
          <Alert tone="warning" title="Simulation only" className="mt-2">
            This simulates execution deterministically in the browser. No data changes, no messages sent, no external systems contacted.
          </Alert>
          {simulateResult && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="text-subtle">{simulateResult.disclaimer}</div>
              <div>Records affected: {simulateResult.recordsAffected}, Emails simulated: {simulateResult.emailsSimulated}, Tasks created: {simulateResult.tasksCreated}</div>
              <div className="space-y-1">
                {simulateResult.steps?.map((step: any) => (
                  <div key={step.id} className="border-l-2 border-border pl-2">
                    <div className="font-medium">{step.order}. {step.nodeLabel} [{step.outcome}]</div>
                    <div className="text-subtle">{step.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function WorkflowRuns() {
  const services = useServices();
  const { workflowId } = useParams<{ workflowId: string }>();
  const runs = useList(
    () => services.workflows.runs({ workflowId: workflowId ?? undefined, pageSize: 100 }),
    [workflowId]
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Run history / audit"
        description="Run history is recorded for simulation runs in this demo."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Automation' }, { label: 'Workflows', to: '/app/workflows' }, { label: 'Runs' }]}
        sample
      />
      <div className="space-y-3 p-4 sm:p-6">
        {runs.items.map((run: WorkflowRun) => (
          <Card key={run.id} className="p-3 text-xs">
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{run.workflowName} — {run.recordLabel}</div>
                <div className="text-subtle">Started: {formatDate(run.startedAt)} | Duration: {run.durationMs}ms | Mode: {run.mode} (simulated)</div>
              </div>
              <Badge variant={run.state === 'success' ? 'success' : 'warning'} size="sm">{run.state}</Badge>
            </div>
            {run.errorSummary && <div className="text-danger-fg mt-1">{run.errorSummary}</div>}
          </Card>
        ))}
        {runs.items.length === 0 && <Card className="p-6 text-center text-sm text-muted">No runs yet.</Card>}
      </div>
    </div>
  );
}

export function WorkflowNew() {
  const navigate = useNavigate();
  return (
    <div className="pb-8">
      <PageHeader
        title="New workflow"
        description="Create a draft workflow. Validation prevents enabling invalid workflows."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Automation' }, { label: 'Workflows', to: '/app/workflows' }, { label: 'New' }]}
        sample
      />
      <div className="p-4 sm:p-6">
        <Card className="p-4 max-w-2xl">
          <DemoNotice tone="warning">Demo only — new workflows are stored in browser mock store.</DemoNotice>
          <p className="text-xs text-muted mt-2">Use the editor after creation (demo flow).</p>
          <Button className="mt-3" size="sm" onClick={() => navigate('/app/workflows')}>Back to workflows</Button>
        </Card>
      </div>
    </div>
  );
}
