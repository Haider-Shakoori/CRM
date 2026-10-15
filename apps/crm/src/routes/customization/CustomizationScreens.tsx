'use client';

import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CustomField, CustomObject, SavedView } from '@crm/shared-types';
import {
  Badge,
  Button,
  Card,
  DemoNotice,
  EmptyState,
  Input,
  TableWrap,
  Th,
  Tr,
  Td,
  IconButton,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
} from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';
import { Plus, Edit, Trash2, Eye, Columns3 } from 'lucide-react';

const FIELD_TYPE_LABELS: Record<CustomField['type'], string> = {
  text: 'Text',
  textarea: 'Text area',
  rich_text: 'Rich text',
  email: 'Email',
  phone: 'Phone',
  url: 'URL',
  number: 'Number',
  currency: 'Currency',
  percent: 'Percent',
  date: 'Date',
  datetime: 'Date/Time',
  duration: 'Duration',
  boolean: 'Checkbox',
  picklist: 'Picklist',
  multi_picklist: 'Multi-select',
  lookup: 'Lookup',
  master_detail: 'Master-Detail',
  user_lookup: 'User lookup',
  team_lookup: 'Team lookup',
  file: 'File',
  image_placeholder: 'Image',
  address: 'Address',
  geolocation_placeholder: 'Location',
  formula: 'Formula',
  rollup: 'Rollup',
  auto_number: 'Auto number',
  json: 'JSON',
};

function ObjectsScreen() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const objects = useList(
    () => services.customObjects.list({ pageSize: 200, q: search || undefined }),
    [search]
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Custom objects & fields"
        description="Manage custom objects and their fields. (Demo only — simulated; no backend writes persist beyond session.)"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customize', to: '/app/customization' }, { label: 'Objects' }]}
        sample
        actions={
          <Button size="sm" onClick={() => notify.simulated('Add object (simulated)', 'Creating custom objects requires a backend; this is a simulated action in the demo.')}>
            <Plus className="size-4 mr-1.5" />
            Add object
          </Button>
        }
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search custom objects"
        resultCount={objects.meta ? `${objects.meta.total.toLocaleString()} objects` : undefined}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          Simulated configuration. Changes shown here are not persisted to a real database.
        </DemoNotice>

        {objects.loading ? (
          <ListSkeleton rows={10} />
        ) : objects.items.length === 0 ? (
          <EmptyState
            title="No custom objects"
            body="Create a custom object to extend the data model. In this demo, object creation is simulated."
            action={<Button onClick={() => notify.simulated('Add object (simulated)', 'Simulated action.')}>Add object</Button>}
          />
        ) : (
          <TableWrap>
            <thead>
              <Tr>
                <Th>Label</Th>
                <Th>API name</Th>
                <Th>Fields</Th>
                <Th>Records</Th>
                <Th>Status</Th>
                <Th>Kind</Th>
                <Th align="end">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {objects.items.map((object: CustomObject) => (
                <Tr key={object.id} interactive onClick={() => navigate(`/app/customization/objects/${object.id}`)}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium">{object.pluralLabel}</span>
                      {object.description ? <span className="text-xs text-muted mt-0.5">{object.description}</span> : null}
                    </div>
                  </Td>
                  <Td className="font-mono text-xs">{object.apiName}</Td>
                  <Td>{object.fieldCount.toLocaleString()}</Td>
                  <Td>{object.recordCount.toLocaleString()}</Td>
                  <Td>
                    <Badge variant={object.status === 'active' ? 'success' : object.status === 'draft' ? 'neutral' : 'warning'} size="sm">
                      {object.status}
                    </Badge>
                  </Td>
                  <Td>{object.kind}</Td>
                  <Td align="end">
                    <IconButton
                      label="Edit fields"
                      icon={<Edit className="size-4" />}
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/customization/objects/${object.id}`);
                      }}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </div>
  );
}

function ObjectDetailScreen() {
  const { objectId } = useParams();
  const services = useServices();
  const [search, setSearch] = React.useState('');

  const object = useAsync(() => services.customObjects.get(objectId!), [objectId!]);
  const fields = useList(
    () => services.customObjects.fields(objectId!, { pageSize: 200, q: search || undefined }),
    [objectId!, search]
  );

  return (
    <div className="pb-8">
      <PageHeader
        title={object.data?.pluralLabel || 'Custom object'}
        description="Manage fields for this custom object."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customize', to: '/app/customization' }, { label: 'Objects', to: '/app/customization/objects' }, { label: object.data?.pluralLabel || 'Object' }]}
        sample
        actions={
          <Button size="sm" onClick={() => notify.simulated('Add field (simulated)', 'Field creation is simulated in the demo.')}>
            <Plus className="size-4 mr-1.5" />
            Add field
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Fields ({fields.meta?.total ?? 0})</h2>
              <p className="text-xs text-muted mt-0.5">Fields define the schema for this object.</p>
            </div>
            <Input
              placeholder="Search fields"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs"
            />
          </div>
          {fields.loading ? (
            <ListSkeleton rows={8} />
          ) : fields.items.length === 0 ? (
            <EmptyState
              title="No fields yet"
              body="Add fields to capture data on this object."
              action={<Button size="sm" onClick={() => notify.simulated('Add field (simulated)', 'Simulated action.')}>Add field</Button>}
            />
          ) : (
            <TableWrap>
              <thead>
                <Tr>
                  <Th>Label</Th>
                  <Th>API name</Th>
                  <Th>Type</Th>
                  <Th>Required</Th>
                  <Th>Read-only</Th>
                  <Th>Usage</Th>
                  <Th align="end">Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {fields.items.map((field: CustomField) => (
                  <Tr key={field.id}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-medium">{field.label}</span>
                        {field.helpText ? <span className="text-xs text-muted mt-0.5">{field.helpText}</span> : null}
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">{field.apiName}</Td>
                    <Td>{FIELD_TYPE_LABELS[field.type]}</Td>
                    <Td>{field.required ? 'Yes' : 'No'}</Td>
                    <Td>{field.readOnly ? 'Yes' : 'No'}</Td>
                    <Td>{(field.usage.onLayouts + field.usage.inWorkflows + field.usage.inReports + field.usage.inFormulas).toLocaleString()} refs</Td>
                    <Td align="end">
                      <IconButton
                        label="Edit field"
                        icon={<Edit className="size-4" />}
                        size="icon-xs"
                        onClick={() => notify.simulated('Edit field (simulated)', 'Field editing is simulated in the demo.')}
                      />
                      <IconButton
                        label="Delete field"
                        icon={<Trash2 className="size-4" />}
                        size="icon-xs"
                        variant="ghost"
                        className="ml-1 text-danger-fg hover:text-danger-fg"
                        onClick={() => notify.simulated('Delete field (simulated)', 'Field deletion is simulated; conflicts are not actually checked.')}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}

function LayoutsScreen() {
  const services = useServices();
  const layouts = useList(
    () => services.layouts.list(undefined),
    []
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Page layouts"
        description="Drag-and-drop page layouts with live preview and conditional field visibility. (Simulated)"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customize', to: '/app/customization' }, { label: 'Layouts' }]}
        sample
        actions={
          <Button size="sm" onClick={() => notify.simulated('New layout (simulated)', 'Layout creation is simulated.')}>
            <Plus className="size-4 mr-1.5" />
            New layout
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          Layout editor is simulated. Preview uses mock data; no actual layout changes are persisted.
        </DemoNotice>

        {layouts.loading ? (
          <ListSkeleton rows={8} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layouts.items.map((layout) => (
              <Card key={layout.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{layout.name}</h3>
                    <p className="text-xs text-muted mt-0.5">{layout.objectApiName} • {layout.kind} • v{layout.version}</p>
                  </div>
                  <Badge variant={layout.isActive ? 'success' : 'neutral'} size="sm">
                    {layout.isActive ? 'Active' : 'Draft'}
                  </Badge>
                </div>
                {layout.description ? <p className="text-xs text-muted">{layout.description}</p> : null}
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Columns3 className="size-3.5" />
                  {layout.sections.length} sections • {layout.highlightsPanel.length} highlights
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="xs" variant="secondary" onClick={() => notify.simulated('Edit layout (simulated)', 'Simulated layout editor.')}>
                    <Edit className="size-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => notify.simulated('Live preview (simulated)', 'Simulated preview using mock data.')}>
                    <Eye className="size-3.5 mr-1" />
                    Preview
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

function ValidationRulesScreen() {
  return (
    <div className="pb-8">
      <PageHeader
        title="Validation rules"
        description="Define validation rules for data quality. Enforcement is described as frontend-only in demo."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customize', to: '/app/customization' }, { label: 'Validation' }]}
        sample
        actions={
          <Button size="sm" onClick={() => notify.simulated('New validation rule (simulated)', 'Simulated rule creation.')}>
            <Plus className="size-4 mr-1.5" />
            New rule
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          The rule manager is a preview. This build has no validation-rules service, so a rule cannot be stored or
          enforced — only the shape of the manager is shown.
        </DemoNotice>
        <Card className="p-4">
          <EmptyState
            title="Validation rules are not managed in this build"
            body="Rules belong to a custom object and would be evaluated on write. That service is not implemented here, so this manager is deliberately read-only."
            action={<Button size="sm" onClick={() => notify.simulated('Add rule (simulated)', 'No rule was created: validation rules are not implemented in this build.')}>Add rule</Button>}
          />
        </Card>
      </div>
    </div>
  );
}

function SavedViewsScreen() {
  const services = useServices();
  const savedViews = useList(
    () => services.savedViews.list(undefined),
    []
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Saved views"
        description="Manage saved views for custom objects and lists. (Simulated)"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customize', to: '/app/customization' }, { label: 'Views' }]}
        sample
        actions={
          <Button size="sm" onClick={() => notify.simulated('New saved view (simulated)', 'Simulated view creation.')}>
            <Plus className="size-4 mr-1.5" />
            New view
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          Saved views are managed in the UI only for demo purposes.
        </DemoNotice>

        {savedViews.loading ? (
          <ListSkeleton rows={8} />
        ) : savedViews.items.length === 0 ? (
          <EmptyState
            title="No saved views"
            body="Create saved views to quickly access filtered lists."
            action={<Button size="sm" onClick={() => notify.simulated('New view (simulated)', 'Simulated.')}>Add view</Button>}
          />
        ) : (
          <TableWrap>
            <thead>
              <Tr>
                <Th>Name</Th>
                <Th>Object</Th>
                <Th>Scope</Th>
                <Th>Default</Th>
                <Th>Pinned</Th>
                <Th>Columns</Th>
                <Th align="end">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {savedViews.items.map((view: SavedView) => (
                <Tr key={view.id}>
                  <Td>{view.name}</Td>
                  <Td>{view.objectApiName}</Td>
                  <Td>{view.scope}</Td>
                  <Td>{view.isDefault ? 'Yes' : 'No'}</Td>
                  <Td>{view.isPinned ? 'Yes' : 'No'}</Td>
                  <Td>{view.columns.filter((c) => c.visible).length}</Td>
                  <Td align="end">
                    <IconButton
                      label="Edit"
                      icon={<Edit className="size-4" />}
                      size="icon-xs"
                      onClick={() => notify.simulated('Edit view (simulated)', 'Simulated edit.')}
                    />
                    <IconButton
                      label="Delete"
                      icon={<Trash2 className="size-4" />}
                      size="icon-xs"
                      variant="ghost"
                      className="ml-1 text-danger-fg hover:text-danger-fg"
                      onClick={() => notify.simulated('Delete view (simulated)', 'Simulated delete.')}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </div>
  );
}

export function CustomizationScreens() {
  return <ObjectsScreen />;
}

export { ObjectsScreen, ObjectDetailScreen, LayoutsScreen, ValidationRulesScreen, SavedViewsScreen };
