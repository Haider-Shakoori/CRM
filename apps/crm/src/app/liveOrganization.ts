import type { ApiIdentity } from './laravelClient';

/**
 * A navigation preference only, never authorization or an access token.
 * A stored organization is selected ONLY if the newly authenticated user
 * currently has that membership. The API remains the final authority.
 */
const preferenceKey = 'crm.live.selected-organization';

export function preferredLiveOrganization(identity: ApiIdentity): string {
  const organizations = identity.organizations;
  if (!organizations.length) return '';
  try {
    const preferred = sessionStorage.getItem(preferenceKey);
    if (preferred && organizations.some((entry) => entry.id === preferred)) return preferred;
  } catch { /* Storage blocked: default to a valid live membership. */ }
  return organizations[0]?.id ?? '';
}

export function storeLiveOrganization(id: string): void {
  try {
    if (id) sessionStorage.setItem(preferenceKey, id);
    else sessionStorage.removeItem(preferenceKey);
  } catch { /* Storage is optional; secure data access does not depend on it. */ }
}
