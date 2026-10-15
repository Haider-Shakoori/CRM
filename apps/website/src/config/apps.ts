/**
 * Cross-application URLs.
 *
 * The website, the CRM application and the platform administration console are three
 * separate applications in one monorepo. A link from the marketing site into the CRM is
 * therefore a *cross-application* link, not an internal route, and it must be built from
 * a configured origin rather than a hardcoded path.
 *
 * Origins come from environment variables so a deployment can point them at a subdomain
 * (`https://app.example.com`) without touching component code. The development defaults
 * match the ports in each app's `package.json`.
 */

const env = import.meta.env as Record<string, string | undefined>;

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export const appOrigins = {
  crm: trimTrailingSlash(env.PUBLIC_CRM_URL ?? 'http://localhost:5173'),
  platformAdmin: trimTrailingSlash(env.PUBLIC_PLATFORM_ADMIN_URL ?? 'http://localhost:5174'),
  portal: trimTrailingSlash(env.PUBLIC_PORTAL_URL ?? 'http://localhost:5175'),
} as const;

/** Build an absolute URL into the CRM application. */
export function crmUrl(path: string, params?: Record<string, string | number>): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  const query = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : '';
  return `${appOrigins.crm}${normalised}${query}`;
}

/** Build an absolute URL into the platform administration console. */
export function platformAdminUrl(path = '/'): string {
  return `${appOrigins.platformAdmin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Build an absolute URL into the customer portal. */
export function portalUrl(path = '/'): string {
  return `${appOrigins.portal}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * True when a URL leaves the website. Used by the internal link checker so
 * cross-application links are validated against their own origin instead of being
 * mistaken for broken internal routes.
 */
export function isCrossApplicationHref(href: string): boolean {
  return (
    href.startsWith(appOrigins.crm) ||
    href.startsWith(appOrigins.platformAdmin) ||
    href.startsWith(appOrigins.portal)
  );
}
