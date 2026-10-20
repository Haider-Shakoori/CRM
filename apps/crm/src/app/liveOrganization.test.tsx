import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preferredLiveOrganization, storeLiveOrganization } from './liveOrganization';
import type { ApiIdentity } from './laravelClient';

const fakeIdentity = (organizations: Array<{ id: string; name: string }>): ApiIdentity => ({
  user: { id: 'u-1', name: 'Example User', email: 'tester@example.test', email_verified: true },
  organizations: organizations.map(({ id, name }) => ({
    id, name, role: 'member', tenant_id: 'tenant-1',
  })),
} as unknown as ApiIdentity);

describe('Live CRM tenant preference', () => {
  beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

  it('only restores a saved organization with CURRENT verified membership', () => {
    const identity = fakeIdentity([{ id: 'org-1', name: 'One' }, { id: 'org-2', name: 'Two' }]);
    storeLiveOrganization('org-2');
    expect(preferredLiveOrganization(identity)).toBe('org-2');
    expect(preferredLiveOrganization(fakeIdentity([{ id: 'org-1', name: 'One' }]))).toBe('org-1');
  });

  it('does not fabricate access if no active organizations are returned', () => {
    storeLiveOrganization('org-removed');
    expect(preferredLiveOrganization(fakeIdentity([]))).toBe('');
  });

  it('falls back safely if preferences storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(preferredLiveOrganization(fakeIdentity([{ id: 'org-1', name: 'One' }]))).toBe('org-1');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => storeLiveOrganization('org-1')).not.toThrow();
  });
});
