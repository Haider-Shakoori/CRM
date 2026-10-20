import { Link, Navigate, useLocation } from 'react-router-dom';

export const isLiveCrmMode = import.meta.env.VITE_CRM_DATA_MODE === 'live';

const liveRouteMap: Record<string, string> = {
  '/app/home': '/crm/dashboard',
  '/app/leads': '/crm/leads',
  '/app/contacts': '/crm/contacts',
  '/app/accounts': '/crm/accounts',
  '/app/deals': '/crm/deals',
  '/app/deals/list': '/crm/deals',
  '/app/deals/forecast': '/crm/dashboard',
  '/app/activities': '/crm/my-work',
  '/app/activities/all': '/crm/activities',
  '/app/tasks': '/crm/tasks',
  '/app/calendar': '/crm/calendar',
};

/**
 * Explicit opt-in live bridge: never renders a demo service, mock-owned
 * navigation shell, synthetic records or a silent fallback on API failures.
 * Unsupported deep links remain blocked until a real contract exists.
 */
export function LiveRouteBridge() {
  const pathname = useLocation().pathname.replace(/\/$/, '') || '/app';
  if (!import.meta.env.VITE_CRM_API_URL) {
    return <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Live CRM API not configured</h1>
      <p role="alert">Live mode requires VITE_CRM_API_URL. Demo data cannot substitute for tenant records.</p>
    </main>;
  }
  const destination = liveRouteMap[pathname === '/app' ? '/app/home' : pathname];
  if (destination) return <Navigate to={destination} replace />;
  return <main className="mx-auto max-w-2xl space-y-4 p-6">
    <h1 className="text-xl font-semibold">Not yet available with live CRM data</h1>
    <p role="alert">This workflow has no Laravel-backed implementation yet. It has been disabled in live mode to prevent accidental use of demonstration data.</p>
    <p className="text-sm text-muted">Requested route: <code>{pathname}</code></p>
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link className="underline" to="/crm/dashboard">Live Dashboard</Link>
      <Link className="underline" to="/crm/leads">Live Leads</Link>
      <Link className="underline" to="/crm/activities">Live Activities</Link>
      <Link className="underline" to="/crm/calendar">Live Calendar</Link>
    </nav>
  </main>;
}
