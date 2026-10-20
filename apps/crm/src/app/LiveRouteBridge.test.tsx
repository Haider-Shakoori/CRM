import { describe, expect, it } from 'vitest';
import { liveRouteDestination } from './LiveRouteBridge';

describe('Live CRM route bridge', () => {
  it('maps only known working Laravel-backed workspace modules', () => {
    expect(liveRouteDestination('/app')).toBe('/crm/dashboard');
    expect(liveRouteDestination('/app/home')).toBe('/crm/dashboard');
    expect(liveRouteDestination('/app/leads/')).toBe('/crm/leads');
    expect(liveRouteDestination('/app/contacts')).toBe('/crm/contacts');
    expect(liveRouteDestination('/app/accounts')).toBe('/crm/accounts');
    expect(liveRouteDestination('/app/deals/forecast')).toBe('/crm/dashboard');
    expect(liveRouteDestination('/app/activities/all')).toBe('/crm/activities');
    expect(liveRouteDestination('/app/tasks')).toBe('/crm/tasks');
    expect(liveRouteDestination('/app/calendar')).toBe('/crm/calendar');
  });
  it('does not silently route unsupported workflows to a mock or wrong record', () => {
    for (const path of [
      '/app/leads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '/app/deals/new', '/app/contacts/import', '/app/marketing',
      '/app/campaigns', '/app/invoices', '/app/unknown',
    ]) {
      expect(liveRouteDestination(path)).toBeNull();
    }
  });
});
