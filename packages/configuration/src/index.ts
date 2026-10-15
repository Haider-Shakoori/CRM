/**
 * `@crm/configuration` — the single source of truth for branding, plans, module
 * navigation, industry profiles and public-site information architecture.
 *
 * Nothing in the applications hardcodes a product name, a price, a navigation label
 * or a route list; they all read from here.
 */

export * from './branding';
export * from './plans';
export * from './modules';
export * from './industries';
export * from './site';
export * from './demo';

import { brandConfig } from './branding';
import { plans, addOns } from './plans';
import { modules, navSections } from './modules';
import { industries } from './industries';

/** A compact integrity view used by the settings UI and the platform admin console. */
export const configurationSummary = {
  productDisplayName: brandConfig.productDisplayName,
  provisionalIdentity: true as const,
  planCount: plans.length,
  addOnCount: addOns.length,
  moduleCount: modules.length,
  navSectionCount: navSections.length,
  industryCount: industries.length,
  commercialState: 'illustrative_not_final' as const,
} as const;
