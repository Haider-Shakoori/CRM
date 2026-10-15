/**
 * Central branding configuration.
 *
 * The single rule this file exists to enforce: **the product name, logo and palette
 * live in exactly one place.** Every application, the website metadata, the CRM
 * shell, the customer portal and the email-template chrome read from here, so a
 * final product name and identity can be dropped in without touching a single
 * component.
 *
 * The values below are provisional development placeholders. They are deliberately
 * generic and must not be treated as a permanent brand decision.
 */

import type { ThemePreference, DensityPreference } from '@crm/shared-types';

export interface BrandAsset {
  /** Path under the app's `public/` directory. Generated locally, never a stock asset. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Marks the asset as a placeholder so the UI can label it honestly. */
  placeholder: true;
}

export interface BrandColorConfig {
  /** Accent preset id from `@crm/design-tokens` `accentPresets`. */
  accentPresetId: 'violet' | 'teal' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  /** Optional explicit override; when set it wins over the preset in the runtime theme. */
  primaryOverride?: string;
  secondaryOverride?: string;
  /** Additional accents exposed to tenant admins as pickable options. */
  selectablePresetIds: string[];
  allowTenantOverride: boolean;
}

export interface BrandConfig {
  /** Development name. Replace with the final product name when decided. */
  productDisplayName: string;
  shortName: string;
  /** Used in <title> templates, e.g. `%s · CRM Platform`. */
  titleTemplate: string;
  productTagline: string;
  productDescription: string;
  /** A single sentence used in meta descriptions and app manifests. */
  productSummary: string;

  assets: {
    /** Wordmark used in the website header and CRM sidebar. */
    logo: BrandAsset;
    /** Square mark for favicons, app icons, collapsed sidebar and email headers. */
    logoMark: BrandAsset;
    favicon: BrandAsset;
    appleTouchIcon: BrandAsset;
    /** Neutral placeholder for social sharing cards. */
    socialShareImage: BrandAsset;
    /** Illustration used on empty/error states. */
    emptyStateIllustration: BrandAsset;
    /** Loading mark. */
    loadingMark: BrandAsset;
  };

  colors: BrandColorConfig;

  /** Defaults applied to a brand-new organization before the admin customises them. */
  defaults: {
    theme: ThemePreference;
    density: DensityPreference;
    contrast: 'default' | 'high';
    reducedMotion: boolean;
    locale: string;
    timezone: string;
    currency: string;
    weekStartsOn: 0 | 1 | 6;
    dateFormat: string;
    numberFormat: string;
    startPage: string;
  };

  /** Website-specific identity. */
  website: {
    /** Configurable production domain; never hardcoded in components. */
    productionDomain: string;
    canonicalBaseUrl: string;
    organizationNamePlaceholder: string;
    legalEntityPlaceholder: string;
    supportEmailPlaceholder: string;
    salesEmailPlaceholder: string;
    newsletterSenderPlaceholder: string;
    socialProfiles: Array<{ id: string; label: string; urlPlaceholder: string; enabled: boolean }>;
    /** Honest label rendered wherever demonstration content appears. */
    demoContentNotice: string;
    announcementBanner: {
      enabled: boolean;
      message: string;
      href: string;
      ctaLabel: string;
      tone: 'brand' | 'info' | 'accent';
      dismissible: boolean;
    } | null;
  };

  /** Application chrome identity. */
  application: {
    appTitle: string;
    appShortTitle: string;
    /** Shown in the browser tab and the mobile home-screen label. */
    pwaName: string;
    loginHeadline: string;
    loginSubheadline: string;
    portalTitleTemplate: string;
    platformAdminTitleTemplate: string;
    supportUrlPlaceholder: string;
    statusPageUrlPlaceholder: string;
    documentationUrlPlaceholder: string;
    /** Rendered in the shell footer for the demo build. */
    environmentBanner: string | null;
  };

  /** Email template chrome. Nothing is sent, but previews must look correct. */
  email: {
    headerDisplayName: string;
    footerAddressPlaceholder: string;
    unsubscribeLabel: string;
    /** Neutral, clearly-a-placeholder postal line required by most jurisdictions. */
    physicalAddressNotice: string;
    accentPresetId: string;
  };

  /** Legal and trust identity. */
  legal: {
    companyNamePlaceholder: string;
    registeredAddressPlaceholder: string;
    privacyEmailPlaceholder: string;
    dpoEmailPlaceholder: string;
    jurisdictionPlaceholder: string;
    /** Where legal review is still outstanding. */
    pendingReviewNotice: string;
    pendingReviewPages: string[];
  };
}

export const brandConfig: BrandConfig = {
  productDisplayName: 'CRM Platform',
  shortName: 'CRM',
  titleTemplate: '%s · CRM Platform',
  productTagline: 'The customer platform your whole company can actually use',
  productDescription:
    'A multi-tenant CRM platform for sales, marketing, service, revenue operations and customer success, designed to be configured by the people who use it.',
  productSummary:
    'Enterprise functionality without enterprise complexity: one configurable platform for the entire customer lifecycle.',

  assets: {
    logo: {
      src: '/brand/logo-wordmark.svg',
      alt: 'CRM Platform wordmark (placeholder)',
      width: 148,
      height: 32,
      placeholder: true,
    },
    logoMark: {
      src: '/brand/logo-mark.svg',
      alt: 'CRM Platform mark (placeholder)',
      width: 32,
      height: 32,
      placeholder: true,
    },
    favicon: {
      src: '/brand/favicon.svg',
      alt: 'Favicon (placeholder)',
      width: 64,
      height: 64,
      placeholder: true,
    },
    appleTouchIcon: {
      // NOTE: iOS expects a PNG here. The SVG is referenced so the link resolves in this
      // build; producing the raster asset is part of finalising the brand identity.
      src: '/brand/favicon.svg',
      alt: 'App icon (placeholder). A PNG should replace this once the identity is final.',
      width: 180,
      height: 180,
      placeholder: true,
    },
    socialShareImage: {
      src: '/brand/social-share.svg',
      alt: 'Social sharing image placeholder',
      width: 1200,
      height: 630,
      placeholder: true,
    },
    emptyStateIllustration: {
      src: '/brand/illustration-empty.svg',
      alt: 'No records illustration',
      width: 240,
      height: 180,
      placeholder: true,
    },
    loadingMark: {
      src: '/brand/logo-mark.svg',
      alt: 'Loading',
      width: 40,
      height: 40,
      placeholder: true,
    },
  },

  colors: {
    accentPresetId: 'violet',
    selectablePresetIds: ['violet', 'teal', 'blue', 'emerald', 'amber', 'rose', 'slate'],
    allowTenantOverride: true,
  },

  defaults: {
    theme: 'system',
    density: 'comfortable',
    contrast: 'default',
    reducedMotion: false,
    locale: 'en',
    timezone: 'UTC',
    currency: 'USD',
    weekStartsOn: 1,
    dateFormat: 'medium',
    numberFormat: 'standard',
    startPage: '/app/home',
  },

  website: {
    productionDomain: 'example-crm.test',
    canonicalBaseUrl: 'https://example-crm.test',
    organizationNamePlaceholder: '[Company name pending]',
    legalEntityPlaceholder: '[Legal entity pending registration]',
    supportEmailPlaceholder: 'support@example-crm.test',
    salesEmailPlaceholder: 'sales@example-crm.test',
    newsletterSenderPlaceholder: 'news@example-crm.test',
    socialProfiles: [
      { id: 'linkedin', label: 'LinkedIn', urlPlaceholder: 'https://example-crm.test/social/linkedin', enabled: false },
      { id: 'x', label: 'X', urlPlaceholder: 'https://example-crm.test/social/x', enabled: false },
      { id: 'youtube', label: 'YouTube', urlPlaceholder: 'https://example-crm.test/social/youtube', enabled: false },
      { id: 'github', label: 'GitHub', urlPlaceholder: 'https://example-crm.test/social/github', enabled: false },
    ],
    demoContentNotice:
      'Demonstration content: figures, names, customers and metrics on this site are synthetic examples produced for design review.',
    announcementBanner: {
      enabled: true,
      message: 'Interactive product demo is available — explore the CRM without creating an account.',
      href: '/demo',
      ctaLabel: 'Open the demo',
      tone: 'brand',
      dismissible: true,
    },
  },

  application: {
    appTitle: 'CRM Platform',
    appShortTitle: 'CRM',
    pwaName: 'CRM Platform',
    loginHeadline: 'Welcome back',
    loginSubheadline: 'Sign in to your workspace. This is a simulated sign-in for demonstration purposes.',
    portalTitleTemplate: '%s · Customer Portal',
    platformAdminTitleTemplate: '%s · Platform Administration',
    supportUrlPlaceholder: '/resources/help-center',
    statusPageUrlPlaceholder: '/trust/status',
    documentationUrlPlaceholder: '/docs',
    environmentBanner: 'Frontend demonstration build — all data is synthetic and no backend is connected.',
  },

  email: {
    headerDisplayName: 'CRM Platform',
    footerAddressPlaceholder: '[Registered address pending]',
    unsubscribeLabel: 'Manage subscription preferences',
    physicalAddressNotice: 'A postal address is required in most jurisdictions for commercial email.',
    accentPresetId: 'violet',
  },

  legal: {
    companyNamePlaceholder: '[Legal entity name pending]',
    registeredAddressPlaceholder: '[Registered address pending]',
    privacyEmailPlaceholder: 'privacy@example-crm.test',
    dpoEmailPlaceholder: 'dpo@example-crm.test',
    jurisdictionPlaceholder: '[Governing jurisdiction pending legal review]',
    pendingReviewNotice:
      'This page is a design placeholder. It has not been reviewed by legal counsel and must not be relied on as a legal document.',
    pendingReviewPages: [
      '/legal/privacy',
      '/legal/terms',
      '/legal/cookies',
      '/legal/dpa',
      '/legal/sla',
      '/legal/acceptable-use',
      '/trust/compliance',
      '/trust/subprocessors',
      '/trust/data-residency',
    ],
  },
};

/**
 * Resolve the effective brand for a tenant organization.
 *
 * Tenant overrides are shallow-merged over the platform defaults so an organization
 * can change its accent and logo without forking the whole configuration.
 */
export function resolveBrand(overrides?: Partial<BrandConfig> | Record<string, unknown>): BrandConfig {
  if (!overrides) return brandConfig;
  return {
    ...brandConfig,
    ...overrides,
    assets: { ...brandConfig.assets, ...(overrides as Partial<BrandConfig>).assets },
    colors: { ...brandConfig.colors, ...(overrides as Partial<BrandConfig>).colors },
    defaults: { ...brandConfig.defaults, ...(overrides as Partial<BrandConfig>).defaults },
    website: { ...brandConfig.website, ...(overrides as Partial<BrandConfig>).website },
    application: { ...brandConfig.application, ...(overrides as Partial<BrandConfig>).application },
    email: { ...brandConfig.email, ...(overrides as Partial<BrandConfig>).email },
    legal: { ...brandConfig.legal, ...(overrides as Partial<BrandConfig>).legal },
  };
}

/** Convenience accessors so components never reach into the object by hand. */
export const brand = {
  name: brandConfig.productDisplayName,
  shortName: brandConfig.shortName,
  tagline: brandConfig.productTagline,
  logo: brandConfig.assets.logo,
  mark: brandConfig.assets.logoMark,
  favicon: brandConfig.assets.favicon,
  accentPresetId: brandConfig.colors.accentPresetId,
  /** True while the identity is still a placeholder. Used to show the demo ribbon. */
  isProvisional: true,
} as const;

/** Canonical page title builder shared by every app. */
export function pageTitle(page?: string): string {
  return page ? brandConfig.titleTemplate.replace('%s', page) : brandConfig.productDisplayName;
}
