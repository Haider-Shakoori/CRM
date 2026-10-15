'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { IndustryTemplate } from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  DemoNotice,
  EmptyState,
  TableWrap,
  Th,
  Tr,
  Td,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
  formatDate,
} from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';
import { CheckCircle, Eye, Download, Trash2, AlertTriangle, Package, Layers, Workflow } from 'lucide-react';

function TemplateGallery() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const templates = useList(
    () => services.industryTemplates.list({ pageSize: 200, q: search || undefined }),
    [search]
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Industry templates"
        description="Preview what a template adds before installing. Installation is simulated; uninstall does not lose your own data."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Templates' }]}
        sample
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search templates by industry or name"
        resultCount={templates.meta ? `${templates.meta.total.toLocaleString()} templates` : undefined}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          Installation and preview are simulated in the browser. No actual schema or data is created or modified.
        </DemoNotice>
        <Alert tone="info" title="Uninstall behavior (demo)">
          Uninstall does not lose your own data. Only template-defined artifacts are marked as removed in the simulation; any records, fields, or configurations you created remain intact.
        </Alert>

        {templates.loading ? (
          <ListSkeleton rows={10} />
        ) : templates.items.length === 0 ? (
          <EmptyState
            title="No templates"
            body="No industry templates are available in this demo."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.items.map((template: IndustryTemplate) => (
              <Card key={template.id} className="p-4 space-y-3 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{template.name}</h3>
                    <p className="text-xs text-muted mt-0.5">{template.industryLabel}</p>
                  </div>
                  <Badge variant={template.isInstalled ? 'success' : 'neutral'} size="sm">
                    {template.isInstalled ? 'Installed' : 'Not installed'}
                  </Badge>
                </div>
                {template.summary ? <p className="text-xs text-muted line-clamp-3">{template.summary}</p> : null}
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  {template.contents.customObjectCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Package className="size-3.5" />
                      {template.contents.customObjectCount} object{template.contents.customObjectCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {template.contents.customFieldCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3.5" />
                      {template.contents.customFieldCount} field{template.contents.customFieldCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {template.contents.workflowCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Workflow className="size-3.5" />
                      {template.contents.workflowCount} workflow{template.contents.workflowCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-2 mt-auto">
                  <Button size="xs" variant="secondary" asChild>
                    <Link to={`/app/templates/${template.id}`}>
                      <Eye className="size-3.5 mr-1" />
                      Preview
                    </Link>
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => notify.simulated(
                      template.isInstalled ? 'Uninstall (simulated)' : 'Install (simulated)',
                      template.isInstalled
                        ? 'Uninstall does not lose your own data in this simulation. Only template artifacts are marked as removed.'
                        : 'Install is simulated; no actual objects, fields, pipelines, workflows, or dashboards are created.'
                    )}
                  >
                    {template.isInstalled ? (
                      <>
                        <Trash2 className="size-3.5 mr-1" />
                        Uninstall (simulated)
                      </>
                    ) : (
                      <>
                        <Download className="size-3.5 mr-1" />
                        Install (simulated)
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateDetail() {
  const { templateId } = useParams();
  const services = useServices();
  const navigate = useNavigate();

  const template = useAsync(() => services.industryTemplates.get(templateId!), [templateId!]);
  const preview = useAsync(() => services.industryTemplates.previewChanges(templateId!), [templateId!], { skip: !templateId });

  return (
    <div className="pb-8">
      <PageHeader
        title={template.data?.name || 'Template preview'}
        description="Preview exactly what this template adds before installing. Install is simulated; uninstall does not lose your own data."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Templates', to: '/app/templates' }, { label: template.data?.name || 'Preview' }]}
        sample
        backTo={{ to: '/app/templates', label: 'Templates' }}
        actions={
          <Button
            size="sm"
            onClick={() => notify.simulated(
              template.data?.isInstalled ? 'Uninstall (simulated)' : 'Install (simulated)',
              template.data?.isInstalled
                ? 'Uninstall does not lose your own data. Only template-defined artifacts are removed in simulation.'
                : 'Install is simulated — no actual schema or configuration changes occur.'
            )}
          >
            {template.data?.isInstalled ? (
              <>
                <Trash2 className="size-4 mr-1.5" />
                Uninstall (simulated)
              </>
            ) : (
              <>
                <Download className="size-4 mr-1.5" />
                Install (simulated)
              </>
            )}
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          <strong>Install is simulated.</strong> No backend changes are made. This preview shows what would be added based on the template definition.
        </DemoNotice>
        <Alert tone="info" title="Important">
          <strong>Uninstall does not lose your own data.</strong> If you uninstall (simulated), only the template's own artifacts are affected. Any custom objects, fields, records, or configurations you created yourself remain intact.
        </Alert>

        {template.loading ? (
          <ListSkeleton rows={6} />
        ) : !template.data ? (
          <EmptyState
            title="Template not found"
            body="The requested template could not be found."
            action={<Button size="sm" onClick={() => navigate('/app/templates')}>Back to templates</Button>}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold">Template summary</h2>
              <p className="text-xs text-muted">{template.data.summary || 'No summary provided.'}</p>
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <div className="text-muted">Industry</div>
                  <div className="font-medium mt-0.5">{template.data.industryLabel}</div>
                </div>
                <div>
                  <div className="text-muted">Status</div>
                  <div className="mt-0.5">
                    <Badge variant={template.data.isInstalled ? 'success' : 'neutral'} size="sm">
                      {template.data.isInstalled ? 'Installed' : 'Not installed'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-muted">Installs</div>
                  <div className="font-medium mt-0.5">{template.data.installsCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted">Updated</div>
                  <div className="font-medium mt-0.5">{formatDate(template.data.updatedAt)}</div>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">What this template adds</h2>
                {preview.loading && <span className="text-xs text-muted">Loading preview...</span>}
              </div>
              {preview.data ? (
                <div className="space-y-2">
                  {preview.data.additions.map((addition, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-inset">
                      <CheckCircle className="size-4 text-success mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{addition.label}</div>
                        <div className="text-[11px] text-muted mt-0.5">Kind: {addition.kind} • Count: {addition.count}</div>
                      </div>
                    </div>
                  ))}
                  {preview.data.conflicts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-warning-fg">
                        <AlertTriangle className="size-4" />
                        Potential conflicts
                      </div>
                      {preview.data.conflicts.map((conflict, idx) => (
                        <div key={idx} className="p-2 rounded-md border border-warning/40 bg-warning-subtle text-xs">
                          <div className="font-medium">{conflict.kind}: {conflict.label}</div>
                          <div className="text-[11px] mt-0.5">Existing: {conflict.existingLabel}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.data.additions.length === 0 && (
                    <p className="text-xs text-muted">No additions defined by this template.</p>
                  )}
                </div>
              ) : preview.loading ? null : (
                <p className="text-xs text-muted">Preview unavailable.</p>
              )}
            </Card>
          </div>
        )}

        {template.data && (
          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Detailed contents</h2>
            <TableWrap>
              <thead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Count</Th>
                </Tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>Custom objects</Td>
                  <Td>{template.data.contents.customObjectCount}</Td>
                </Tr>
                <Tr>
                  <Td>Custom fields</Td>
                  <Td>{template.data.contents.customFieldCount}</Td>
                </Tr>
                <Tr>
                  <Td>Pipelines</Td>
                  <Td>{template.data.contents.pipelineCount}</Td>
                </Tr>
                <Tr>
                  <Td>Workflows</Td>
                  <Td>{template.data.contents.workflowCount}</Td>
                </Tr>
                <Tr>
                  <Td>Dashboards</Td>
                  <Td>{template.data.contents.dashboardCount}</Td>
                </Tr>
                <Tr>
                  <Td>Reports</Td>
                  <Td>{template.data.contents.reportCount}</Td>
                </Tr>
                <Tr>
                  <Td>Email templates</Td>
                  <Td>{template.data.contents.templateCounts.emailTemplates}</Td>
                </Tr>
                <Tr>
                  <Td>Document templates</Td>
                  <Td>{template.data.contents.templateCounts.documentTemplates}</Td>
                </Tr>
                <Tr>
                  <Td>Task templates</Td>
                  <Td>{template.data.contents.templateCounts.taskTemplates}</Td>
                </Tr>
              </tbody>
            </TableWrap>
          </Card>
        )}

        <div className="flex gap-3">
          <Button size="sm" onClick={() => navigate('/app/templates')}>Back to gallery</Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => notify.simulated(
              template.data?.isInstalled ? 'Uninstall (simulated)' : 'Install (simulated)',
              template.data?.isInstalled
                ? 'Uninstall does not lose your own data. This is a simulated action in the demo.'
                : 'Install is simulated; preview shown above is what would be added.'
            )}
          >
            {template.data?.isInstalled ? 'Uninstall (simulated)' : 'Install (simulated)'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TemplateScreens() {
  return <TemplateGallery />;
}

export { TemplateGallery, TemplateDetail };
