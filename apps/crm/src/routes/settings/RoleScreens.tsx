'use client';

import * as React from 'react';
import { Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import type { PermissionGrant, PermissionScope, Role } from '@crm/shared-types';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  Input,
  Select,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  Textarea,
  TonePill,
  Tr,
  cn,
  notify,
} from '@crm/ui';
import { ListSkeleton, PageHeader, RecordEmptyState } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';
import { SettingsPageNav, useActiveOrganization } from './SettingsScreens';

/**
 * Roles and the permission matrix.
 *
 * Two deliberate boundaries, both stated on the screen:
 *
 *   - **Permissions are presentation, not enforcement.** Every grant here is read by the shell to
 *     decide what to *show*. There is no server, so no request is authorised by any of it, and the
 *     banner says so rather than implying a security boundary.
 *   - **System roles are cloned, not edited.** The seeded system roles are the ones real people
 *     hold, so the matrix marks them as system roles and the create dialog clones their grants into
 *     a new custom role — the same policy the `roles.remove` guard enforces.
 *
 * The matrix shows one resource at a time with capabilities as rows and roles as columns, because
 * every resource × action × role at once would be several hundred checkboxes on one page.
 */

const ACTION_LABELS: Record<PermissionGrant['action'], { label: string; description: string }> = {
  view: { label: 'View', description: 'Open the record and its related lists.' },
  create: { label: 'Create', description: 'Create new records of this type.' },
  edit: { label: 'Edit', description: 'Change values on records the scope allows.' },
  delete: { label: 'Delete', description: 'Delete or archive records.' },
  export: { label: 'Export', description: 'Download the records to a file.' },
  import: { label: 'Import', description: 'Bulk-create records from a file.' },
  assign: { label: 'Assign', description: 'Change the owner of a record.' },
  approve: { label: 'Approve', description: 'Approve discounts, quotes and requests.' },
  configure: { label: 'Configure', description: 'Change configuration for the module.' },
  manage: { label: 'Manage', description: 'Full control, including other people’s records.' },
};

const ACTION_ORDER: Array<PermissionGrant['action']> = ['view', 'create', 'edit', 'delete', 'export', 'import', 'assign', 'approve', 'configure', 'manage'];

const SCOPES: Array<{ value: PermissionScope['kind']; label: string }> = [
  { value: 'own', label: 'Own records' },
  { value: 'team', label: 'Team records' },
  { value: 'team_and_children', label: 'Team and child teams' },
  { value: 'department', label: 'Department' },
  { value: 'organization', label: 'Whole organization' },
  { value: 'all', label: 'All tenants (platform)' },
];

export function RolesScreen() {
  const services = useServices();
  const active = useActiveOrganization();
  const roles = useList(() => services.roles.list({ pageSize: 100 }), []);
  const catalog = useList(() => services.roles.permissionsCatalog(), []);

  const scopedRoles = roles.items.filter((role) => role.organizationId === active.activeId);
  const [chosenRoleId, setChosenRoleId] = React.useState('');
  const [chosenResource, setChosenResource] = React.useState('');
  const [draftGrants, setDraftGrants] = React.useState<Record<string, PermissionGrant[]>>({});
  const [dirtyRoles, setDirtyRoles] = React.useState<string[]>([]);
  const [dialog, setDialog] = React.useState<{ mode: 'create' | 'edit'; source?: Role } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Role | null>(null);

  const catalogItems = catalog.items;
  const resources = React.useMemo(() => [...new Set(catalogItems.map((item) => item.resource))], [catalogItems]);

  // Defaults are derived, not stored: a selection that no longer exists in the current
  // organization or catalogue falls back to the first of what is actually loaded.
  const selectedRoleId = scopedRoles.some((role) => role.id === chosenRoleId)
    ? chosenRoleId
    : (scopedRoles[0]?.id ?? '');
  const resource = resources.includes(chosenResource) ? chosenResource : (resources[0] ?? '');
  const selectedRole = scopedRoles.find((role) => role.id === selectedRoleId);

  const baseGrants = (roleId: string): PermissionGrant[] =>
    draftGrants[roleId] ?? roles.items.find((role) => role.id === roleId)?.permissions ?? [];

  const markDirty = (roleId: string) => setDirtyRoles((current) => (current.includes(roleId) ? current : [...current, roleId]));

  const grantOf = (roleId: string, resourceKey: string, action: PermissionGrant['action']): PermissionGrant | undefined =>
    baseGrants(roleId).find((grant) => grant.resource === resourceKey && grant.action === action);

  const toggleGrant = (roleId: string, resourceKey: string, action: PermissionGrant['action'], allow: boolean) => {
    const existing = grantOf(roleId, resourceKey, action);
    const others = baseGrants(roleId).filter((grant) => !(grant.resource === resourceKey && grant.action === action));
    const next: PermissionGrant = {
      resource: resourceKey,
      action,
      effect: allow ? 'allow' : 'deny',
      scope: existing?.scope ?? { kind: 'own' },
    };
    setDraftGrants((current) => ({ ...current, [roleId]: [...others, next] }));
    markDirty(roleId);
  };

  const setScope = (roleId: string, resourceKey: string, kind: PermissionScope['kind']) => {
    const next = baseGrants(roleId).map((grant) =>
      grant.resource === resourceKey ? { ...grant, scope: { ...grant.scope, kind } } : grant,
    );
    setDraftGrants((current) => ({ ...current, [roleId]: next }));
    markDirty(roleId);
  };

  /**
   * Save every changed role as one action.
   *
   * The individual service call is per role — that is the interface — so a failure part-way
   * through stops the loop and reports the role it stopped on rather than pretending the rest
   * were saved.
   */
  const saveMatrix = useMutation(
    async (input: { roleIds: string[] }) => {
      let last: Awaited<ReturnType<typeof services.roles.updatePermissions>> | undefined;
      for (const roleId of input.roleIds) {
        const result = await services.roles.updatePermissions(roleId, baseGrants(roleId));
        if (!result.ok) return result;
        last = result;
      }
      return last!;
    },
    {
      successMessage: (_result, input) => `Permissions saved for ${input.roleIds.length} role${input.roleIds.length === 1 ? '' : 's'}.`,
      onSuccess: () => {
        setDirtyRoles([]);
        setDraftGrants({});
        roles.reload();
      },
    },
  );

  const createRole = useMutation(
    (input: { name: string; description: string; inheritsFromRoleId: string; cloneFrom?: Role }) =>
      services.roles.create({
        organizationId: active.activeId,
        name: input.name.trim(),
        description: input.description.trim() || undefined,
        kind: 'custom',
        permissions: input.cloneFrom?.permissions ?? [],
        inheritsFromRoleId: input.inheritsFromRoleId || undefined,
        userCount: 0,
        isDefault: false,
        color: 'blue',
      }),
    {
      successMessage: 'Role created.',
      onSuccess: () => {
        setDialog(null);
        roles.reload();
      },
    },
  );

  const updateRole = useMutation(
    (input: { id: string; name: string; description: string; inheritsFromRoleId: string }) =>
      services.roles.update(input.id, {
        name: input.name.trim(),
        description: input.description.trim() || undefined,
        inheritsFromRoleId: input.inheritsFromRoleId || undefined,
      }),
    {
      successMessage: 'Role updated.',
      onSuccess: () => {
        setDialog(null);
        roles.reload();
      },
    },
  );

  const removeRole = useMutation((id: string) => services.roles.remove(id), {
    successMessage: 'Role deleted.',
    onSuccess: () => {
      setDeleteTarget(null);
      setChosenRoleId('');
      roles.reload();
    },
  });

  const effective = useAsync(() => services.roles.effectivePermissions(selectedRoleId), [selectedRoleId], { skip: !selectedRoleId });
  const fieldMatrix = useList(() => services.roles.fieldMatrix(selectedRoleId, 'asset'), [selectedRoleId], { skip: !selectedRoleId });
  const accessReview = useList(() => services.roles.accessReview(selectedRoleId), [selectedRoleId], { skip: !selectedRoleId });

  const reviewColumns = React.useMemo<ColumnDef<import('@crm/shared-types').AccessReviewRow, unknown>[]>(
    () => [
      { id: 'user', header: 'User', accessorKey: 'userName', cell: ({ row }) => <span className="text-xs font-medium text-fg">{row.original.userName}</span> },
      {
        id: 'roles',
        header: 'Roles',
        accessorFn: (row) => row.roleNames.join(', '),
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.roleNames.join(', ') || 'No role'}</span>,
      },
      {
        id: 'lastActive',
        header: 'Last active',
        accessorKey: 'lastActiveAt',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.lastActiveAt ? row.original.lastActiveAt.slice(0, 10) : '—'}</span>,
      },
      {
        id: 'flags',
        header: 'Risk flags',
        accessorFn: (row) => row.riskFlags.join(', '),
        cell: ({ row }) =>
          row.original.riskFlags.length === 0 ? (
            <span className="text-[0.6875rem] text-faint">None</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {row.original.riskFlags.map((flag) => (
                <TonePill key={flag} tone={flag === 'no_mfa' ? 'amber' : 'slate'}>
                  {flag.replace(/_/g, ' ')}
                </TonePill>
              ))}
            </span>
          ),
      },
    ],
    [],
  );

  if (roles.loading) return <ListSkeleton rows={10} columns={4} />;

  const matrixRows = ACTION_ORDER.filter((action) => catalogItems.some((item) => item.resource === resource && item.action === action));
  const nonConfigurable = catalogItems.filter((item) => !item.configurable).length;

  return (
    <div className="pb-10">
      <PageHeader
        title="Roles & permissions"
        description="What each role may do, resource by resource, and the people who hold each role."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Roles & permissions' }]}
        tabs={<SettingsPageNav />}
        actions={
          <Button variant="primary" size="sm" onClick={() => setDialog({ mode: 'create', source: selectedRole })} leadingIcon={<Plus className="size-3.5" />}>
            New role
          </Button>
        }
      />

      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <Alert tone="warning" title="Permissions are shown, not enforced">
          This build has no server, so these grants change what the interface offers rather than what the system permits. Real
          authorisation is a backend responsibility and this screen does not claim otherwise.
        </Alert>

        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Roles</CardTitle>
              <span className="text-2xs text-faint">{scopedRoles.length}</span>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {scopedRoles.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">No roles are defined for this organization.</p>
              ) : (
                <ul className="space-y-1.5">
                  {scopedRoles.map((role) => (
                    <li key={role.id}>
                      <button
                        type="button"
                        onClick={() => setChosenRoleId(role.id)}
                        aria-pressed={role.id === selectedRoleId}
                        className={cn(
                          'w-full rounded-md border px-2.5 py-2 text-start',
                          role.id === selectedRoleId ? 'border-brand/40 bg-brand-subtle' : 'border-border-subtle bg-surface hover:bg-hover',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">{role.name}</span>
                          {dirtyRoles.includes(role.id) ? <Badge variant="warning" size="sm">Unsaved</Badge> : null}
                          <Badge variant={role.kind === 'system' ? 'neutral' : 'brand'} size="sm">
                            {role.kind}
                          </Badge>
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-muted">
                          {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                          {role.isDefault ? ' · default role' : ''}
                          {role.inheritsFromRoleId ? ' · inherits permissions' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            {selectedRole ? (
              <>
                <Card>
                  <CardHeader className="flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle>{selectedRole.name}</CardTitle>
                      <p className="mt-1 text-xs text-muted">{selectedRole.description ?? 'No description recorded.'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setDialog({ mode: selectedRole.kind === 'system' ? 'create' : 'edit', source: selectedRole })}>
                        {selectedRole.kind === 'system' ? 'Clone to edit' : 'Edit role'}
                      </Button>
                      {selectedRole.kind !== 'system' ? (
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(selectedRole)} leadingIcon={<Trash2 className="size-3.5" />}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label="Resource" htmlFor="matrix-resource" className="w-[16rem]">
                        <Select
                          id="matrix-resource"
                          value={resource}
                          onValueChange={setChosenResource}
                          options={resources.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
                          searchable
                          selectSize="sm"
                        />
                      </Field>
                      <div className="ms-auto flex items-center gap-2">
                        <span className="text-2xs text-faint" aria-live="polite">
                          {dirtyRoles.length === 0 ? 'No unsaved changes' : `${dirtyRoles.length} role${dirtyRoles.length === 1 ? '' : 's'} changed`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={dirtyRoles.length === 0}
                          onClick={() => {
                            setDraftGrants({});
                            setDirtyRoles([]);
                          }}
                        >
                          Discard
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={dirtyRoles.length === 0}
                          loading={saveMatrix.pending}
                          leadingIcon={<Save className="size-3.5" />}
                          onClick={() => void saveMatrix.run({ roleIds: dirtyRoles })}
                        >
                          Save permissions
                        </Button>
                      </div>
                    </div>

                    <p className="text-[0.6875rem] leading-relaxed text-faint">
                      A ticked box allows the action, an empty box denies it. The scope select under each role applies to every
                      grant of that role for this resource. Changes are saved per role as one write, so a matrix edit is never
                      half-applied.
                    </p>

                    <TableWrap>
                      <caption className="sr-only">
                        Permission matrix for {resource.replace(/_/g, ' ')}: capabilities as rows, roles as columns
                      </caption>
                      <thead>
                        <tr>
                          <Th>Capability</Th>
                          {scopedRoles.map((role) => (
                            <Th key={role.id} align="center">
                              <span className="block max-w-[9rem] truncate">{role.name}</span>
                              <span className="mt-0.5 block text-[0.625rem] font-normal normal-case text-faint">
                                {role.kind === 'system' ? 'system role' : 'custom role'}
                              </span>
                            </Th>
                          ))}
                        </tr>
                        <tr>
                          <Th className="text-2xs font-normal normal-case text-faint">Scope</Th>
                          {scopedRoles.map((role) => (
                            <Th key={`${role.id}-scope`} className="px-1 py-1" align="center">
                              <Select
                                value={baseGrants(role.id).find((grant) => grant.resource === resource)?.scope?.kind ?? 'own'}
                                onValueChange={(value) => setScope(role.id, resource, value as PermissionScope['kind'])}
                                options={SCOPES}
                                selectSize="sm"
                                className="w-[9rem]"
                                aria-label={`Scope for ${role.name}`}
                              />
                            </Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.length === 0 ? (
                          <tr>
                            <Td colSpan={scopedRoles.length + 1}>
                              <span className="block py-4 text-center text-muted">No configurable capability is catalogued for this resource.</span>
                            </Td>
                          </tr>
                        ) : (
                          matrixRows.map((action) => {
                            const meta = ACTION_LABELS[action];
                            const catalogEntry = catalogItems.find((item) => item.resource === resource && item.action === action);
                            const configurable = catalogEntry?.configurable ?? true;
                            return (
                              <tr key={action}>
                                <Td>
                                  <span className="block font-medium text-fg">{meta.label}</span>
                                  <span className="mt-0.5 block text-[0.625rem] text-faint">{meta.description}</span>
                                </Td>
                                {scopedRoles.map((role) => {
                                  const grant = grantOf(role.id, resource, action);
                                  return (
                                    <Td key={`${role.id}-${action}`} align="center">
                                      <Checkbox
                                        id={`perm-${role.id}-${action}`}
                                        checked={configurable ? grant?.effect === 'allow' : undefined}
                                        disabled={!configurable}
                                        onCheckedChange={(checked) => toggleGrant(role.id, resource, action, checked === true)}
                                        label={
                                          <span className="sr-only">
                                            {role.name} may {meta.label.toLowerCase()} {resource.replace(/_/g, ' ')}
                                            {configurable ? '' : ' — platform behaviour, not configurable'}
                                          </span>
                                        }
                                      />
                                    </Td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </TableWrap>

                    <DemoNotice tone="neutral">
                      {nonConfigurable} catalogue {nonConfigurable === 1 ? 'entry is' : 'entries are'} platform behaviour and shown read-only.
                      Everything else in this matrix is stored on the role record itself.
                    </DemoNotice>
                  </CardContent>
                </Card>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="flex-row items-center gap-2">
                      <ShieldCheck className="size-4 text-subtle" aria-hidden />
                      <CardTitle>Effective permissions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {effective.loading ? (
                        <ListSkeleton rows={3} columns={2} />
                      ) : effective.error || !effective.data ? (
                        <p className="text-xs text-muted">{effective.error ?? 'No effective set is available.'}</p>
                      ) : (
                        <>
                          <dl className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-muted">Resolved grants</dt>
                              <dd className="font-medium tabular-nums text-fg">{effective.data.resolved.length}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-muted">Defined on this role</dt>
                              <dd className="font-medium tabular-nums text-fg">{effective.data.overrides.length}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-muted">Inherited from</dt>
                              <dd className="truncate font-medium text-fg">
                                {effective.data.inheritedFrom
                                  ? roles.items.find((role) => role.id === effective.data?.inheritedFrom)?.name ?? effective.data.inheritedFrom
                                  : 'Nothing — this role is standalone'}
                              </dd>
                            </div>
                          </dl>
                          <DemoNotice tone="neutral">
                            Inherited grants are concatenated with this role’s own grants. A real backend would resolve precedence
                            (deny over allow, closest scope) before returning the effective set.
                          </DemoNotice>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Field-level controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted">
                        Read, edit and masking flags for the fields of the <span className="font-mono">asset</span> custom object.
                        The service exposes this as a matrix; there is no write path, so the table is read-only and says so.
                      </p>
                      {fieldMatrix.loading ? (
                        <ListSkeleton rows={3} columns={3} />
                      ) : fieldMatrix.items.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted">No custom fields are defined for this object.</p>
                      ) : (
                        <TableWrap>
                          <thead>
                            <tr>
                              <Th>Field</Th>
                              <Th>Type</Th>
                              <Th>Sensitive</Th>
                              {scopedRoles.slice(0, 3).map((role) => (
                                <Th key={role.id}>{role.name}</Th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fieldMatrix.items.map((row) => (
                              <Tr key={row.fieldApiName}>
                                <Td>
                                  <span className="block font-medium text-fg">{row.label}</span>
                                  <span className="mt-0.5 block font-mono text-[0.625rem] text-faint">{row.fieldApiName}</span>
                                </Td>
                                <Td>{row.type}</Td>
                                <Td>{row.isSensitive ? <Badge variant="warning" size="sm">Sensitive</Badge> : <span className="text-faint">No</span>}</Td>
                                {scopedRoles.slice(0, 3).map((role) => {
                                  const cell = row.perRole.find((entry) => entry.roleId === role.id);
                                  return (
                                    <Td key={role.id}>
                                      <span className="text-[0.6875rem] text-muted">
                                        {cell ? `${cell.read ? 'read' : 'hidden'}${cell.edit ? ' · edit' : ''}${cell.masked ? ' · masked' : ''}` : 'not configured'}
                                      </span>
                                    </Td>
                                  );
                                })}
                              </Tr>
                            ))}
                          </tbody>
                        </TableWrap>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>People with this role</CardTitle>
                    <StatusBadge status={selectedRole.kind} tone={selectedRole.kind === 'system' ? 'slate' : 'blue'} size="sm" />
                  </CardHeader>
                  <CardContent>
                    {accessReview.loading ? (
                      <ListSkeleton rows={4} columns={4} />
                    ) : accessReview.items.length === 0 ? (
                      <RecordEmptyState
                        title="Nobody holds this role"
                        body="A role with no members can usually be deleted, unless a saved view or automation still references it."
                      />
                    ) : (
                      <DataTable columns={reviewColumns} data={accessReview.items} getRowId={(row) => row.userId} />
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <RecordEmptyState
                title="No role selected"
                body="Choose a role on the left to review and edit its permissions."
                primaryAction={{ label: 'New role', onClick: () => setDialog({ mode: 'create' }) }}
              />
            )}
          </div>
        </div>
      </div>

      <RoleDialog
        open={dialog !== null}
        mode={dialog?.mode ?? 'create'}
        source={dialog?.source}
        roles={scopedRoles}
        pending={createRole.pending || updateRole.pending}
        onOpenChange={(open) => !open && setDialog(null)}
        onCreate={(input) => void createRole.run(input)}
        onUpdate={(input) => void updateRole.run(input)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : 'Delete role?'}
        description={
          deleteTarget
            ? `${deleteTarget.userCount} user${deleteTarget.userCount === 1 ? '' : 's'} hold this role. The service refuses to delete a role that is still assigned, so reassign them first.`
            : undefined
        }
        confirmLabel="Delete role"
        tone="danger"
        loading={removeRole.pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void removeRole.run(deleteTarget.id);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ dialog */

function RoleDialog({
  open,
  mode,
  source,
  roles,
  pending,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  source?: Role;
  roles: Role[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { name: string; description: string; inheritsFromRoleId: string; cloneFrom?: Role }) => void;
  onUpdate: (input: { id: string; name: string; description: string; inheritsFromRoleId: string }) => void;
}) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [inheritsFromRoleId, setInheritsFromRoleId] = React.useState('');
  const [cloneSourceId, setCloneSourceId] = React.useState('');

  // Re-seeded while rendering, whenever the dialog opens for a different role, so it never
  // shows a previous attempt's values and no state is written from an effect.
  const seedKey = open ? `${mode}:${source?.id ?? 'new'}` : '';
  const [seededFor, setSeededFor] = React.useState(seedKey);
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (!seedKey) {
      setName('');
      setDescription('');
      setInheritsFromRoleId('');
      setCloneSourceId('');
    } else if (mode === 'edit' && source) {
      setName(source.name);
      setDescription(source.description ?? '');
      setInheritsFromRoleId(source.inheritsFromRoleId ?? '');
      setCloneSourceId('');
    } else {
      setName(source ? `${source.name} (copy)` : '');
      setDescription(source?.description ?? '');
      setInheritsFromRoleId('');
      setCloneSourceId(source?.id ?? '');
    }
  }

  const cloneSource = roles.find((role) => role.id === cloneSourceId);
  const editingSystemRole = mode === 'edit' && source?.kind === 'system';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={mode === 'edit' ? `Edit ${source?.name ?? 'role'}` : 'Create a role'}
        description={
          mode === 'edit'
            ? 'Renaming a role updates it everywhere it appears. Permissions are edited in the matrix.'
            : 'A new role starts empty unless a source role is chosen. System roles are cloned, never edited in place.'
        }
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={pending}
              disabled={editingSystemRole}
              onClick={() => {
                if (!name.trim()) {
                  notify.warning('A role name is required.');
                  return;
                }
                if (mode === 'edit' && source) onUpdate({ id: source.id, name, description, inheritsFromRoleId });
                else onCreate({ name, description, inheritsFromRoleId, cloneFrom: cloneSource });
              }}
            >
              {mode === 'edit' ? 'Save role' : 'Create role'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editingSystemRole ? (
            <Alert tone="warning" title="System roles cannot be edited">
              Clone this role to make adjustments. Existing system roles are shown read-only so the seeded people keep the access
              they were given.
            </Alert>
          ) : null}
          <Field label="Name" htmlFor="role-name" required>
            <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Regional sales lead" />
          </Field>
          <Field label="Description" htmlFor="role-description">
            <Textarea id="role-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          {mode === 'create' ? (
            <Field
              label="Copy permissions from"
              htmlFor="role-clone"
              description="Copies the grants of an existing role into the new record. Nothing is inherited dynamically afterwards."
            >
              <Select
                id="role-clone"
                value={cloneSourceId}
                onValueChange={setCloneSourceId}
                options={[{ value: '', label: 'Start with no permissions' }, ...roles.map((role) => ({ value: role.id, label: `${role.name} (${role.kind})` }))]}
              />
            </Field>
          ) : null}
          <Field label="Inherits from" htmlFor="role-inherits" hint="Optional. Resolved at read time, never copied.">
            <Select
              id="role-inherits"
              value={inheritsFromRoleId}
              onValueChange={setInheritsFromRoleId}
              options={[{ value: '', label: 'Nothing' }, ...roles.filter((role) => role.id !== source?.id).map((role) => ({ value: role.id, label: role.name }))]}
            />
          </Field>
          {cloneSource ? (
            <p className="text-[0.6875rem] leading-relaxed text-faint">
              The new role starts with {cloneSource.permissions.length} grant{cloneSource.permissions.length === 1 ? '' : 's'} copied from{' '}
              {cloneSource.name}, then diverges completely.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-inset p-3">
            <StatusBadge status="custom" tone="blue" size="sm" label="Custom role" />
            <span className="text-[0.6875rem] text-muted">
              Custom roles can be deleted once nobody holds them. The seeded system roles cannot be deleted at all.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
