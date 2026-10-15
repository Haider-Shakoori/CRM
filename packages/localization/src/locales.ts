/**
 * Locale catalogue.
 *
 * English is the complete reference language. Every other locale declares an honest
 * `completeness` figure measured against the reference key count, and missing keys
 * fall back to English rather than rendering a raw key in the interface.
 *
 * RTL locales (Arabic, Dari, Pashto) are first-class: they flip layout direction,
 * mirror navigation order and use logical CSS properties throughout.
 */

export type Direction = 'ltr' | 'rtl';

export interface LocaleDefinition {
  /** BCP-47 tag used by `Intl` and by the URL prefix. */
  code: string;
  /** Shorter tag used when a region is not needed. */
  intlCode: string;
  /** Name written in the language itself. */
  nativeName: string;
  englishName: string;
  direction: Direction;
  /** Percentage of the reference key set that has a translation. */
  completeness: number;
  /** Whether the translation is maintained by a human review process. */
  quality: 'reference' | 'reviewed' | 'machine_assisted' | 'community' | 'draft';
  /** Enabled for the public website. */
  website: boolean;
  /** Enabled for the CRM application. */
  crm: boolean;
  /** Enabled for the customer portal. */
  portal: boolean;
  /** Default currency suggested when this locale is selected during onboarding. */
  suggestedCurrency: string;
  /** Default time zone suggested for this locale. */
  suggestedTimezone: string;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStartsOn: 0 | 1 | 6;
  /** Fallback chain, resolved left to right. */
  fallbackChain: string[];
  /** Free-form note surfaced in the platform admin localization screen. */
  note: string;
}

export const referenceLocale = 'en';

export const locales: LocaleDefinition[] = [
  {
    code: 'en',
    intlCode: 'en',
    nativeName: 'English',
    englishName: 'English',
    direction: 'ltr',
    completeness: 100,
    quality: 'reference',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'USD',
    suggestedTimezone: 'UTC',
    weekStartsOn: 1,
    fallbackChain: [],
    note: 'Reference language. All keys are authored here first.',
  },
  {
    code: 'es',
    intlCode: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    direction: 'ltr',
    completeness: 62,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'EUR',
    suggestedTimezone: 'Europe/Madrid',
    weekStartsOn: 1,
    fallbackChain: ['en'],
    note: 'Core navigation, forms and CRM list surfaces translated. Long-form marketing copy pending.',
  },
  {
    code: 'fr',
    intlCode: 'fr',
    nativeName: 'Français',
    englishName: 'French',
    direction: 'ltr',
    completeness: 58,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'EUR',
    suggestedTimezone: 'Europe/Paris',
    weekStartsOn: 1,
    fallbackChain: ['en'],
    note: 'Interface strings largely complete; help content and email templates pending.',
  },
  {
    code: 'de',
    intlCode: 'de',
    nativeName: 'Deutsch',
    englishName: 'German',
    direction: 'ltr',
    completeness: 55,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'EUR',
    suggestedTimezone: 'Europe/Berlin',
    weekStartsOn: 1,
    fallbackChain: ['en'],
    note: 'CRM interface translated. Compound-word length testing still in progress for narrow layouts.',
  },
  {
    code: 'ar',
    intlCode: 'ar',
    nativeName: 'العربية',
    englishName: 'Arabic',
    direction: 'rtl',
    completeness: 45,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'AED',
    suggestedTimezone: 'Asia/Dubai',
    weekStartsOn: 0,
    fallbackChain: ['en'],
    note: 'RTL reference locale. Direction flipping, mirrored icons and logical properties verified across the shell.',
  },
  {
    code: 'fa-AF',
    intlCode: 'fa-AF',
    nativeName: 'دری',
    englishName: 'Dari',
    direction: 'rtl',
    completeness: 34,
    quality: 'community',
    website: true,
    crm: true,
    portal: false,
    suggestedCurrency: 'AFN',
    suggestedTimezone: 'Asia/Kabul',
    weekStartsOn: 6,
    fallbackChain: ['fa', 'en'],
    note: 'Community-contributed translation. Uses the Arabic-script font fallback stack and Solar Hijri date presentation support.',
  },
  {
    code: 'ps',
    intlCode: 'ps',
    nativeName: 'پښتو',
    englishName: 'Pashto',
    direction: 'rtl',
    completeness: 30,
    quality: 'community',
    website: true,
    crm: true,
    portal: false,
    suggestedCurrency: 'AFN',
    suggestedTimezone: 'Asia/Kabul',
    weekStartsOn: 6,
    fallbackChain: ['fa-AF', 'en'],
    note: 'Community-contributed translation. Numerals presented with Eastern Arabic digits where the user prefers them.',
  },
  {
    code: 'pt-BR',
    intlCode: 'pt-BR',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese (Brazil)',
    direction: 'ltr',
    completeness: 52,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'BRL',
    suggestedTimezone: 'America/Sao_Paulo',
    weekStartsOn: 0,
    fallbackChain: ['pt', 'en'],
    note: 'Brazilian Portuguese. Regional number and currency formatting verified.',
  },
  {
    code: 'tr',
    intlCode: 'tr',
    nativeName: 'Türkçe',
    englishName: 'Turkish',
    direction: 'ltr',
    completeness: 48,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: false,
    suggestedCurrency: 'TRY',
    suggestedTimezone: 'Europe/Istanbul',
    weekStartsOn: 1,
    fallbackChain: ['en'],
    note: 'Dotted/dotless i casing rules accounted for in search and sorting.',
  },
  {
    code: 'hi',
    intlCode: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    direction: 'ltr',
    completeness: 42,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'INR',
    suggestedTimezone: 'Asia/Kolkata',
    weekStartsOn: 0,
    fallbackChain: ['en'],
    note: 'Devanagari font fallback configured. Lakh/crore number grouping available as a preference.',
  },
  {
    code: 'zh-Hans',
    intlCode: 'zh-Hans',
    nativeName: '简体中文',
    englishName: 'Chinese (Simplified)',
    direction: 'ltr',
    completeness: 50,
    quality: 'reviewed',
    website: true,
    crm: true,
    portal: true,
    suggestedCurrency: 'CNY',
    suggestedTimezone: 'Asia/Shanghai',
    weekStartsOn: 1,
    fallbackChain: ['zh', 'en'],
    note: 'No plural forms required. Date format follows the year-month-day order by default.',
  },
  {
    code: 'ja',
    intlCode: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    direction: 'ltr',
    completeness: 38,
    quality: 'machine_assisted',
    website: false,
    crm: true,
    portal: false,
    suggestedCurrency: 'JPY',
    suggestedTimezone: 'Asia/Tokyo',
    weekStartsOn: 0,
    fallbackChain: ['en'],
    note: 'Machine-assisted draft. Requires human review before being enabled on the public website.',
  },
  {
    code: 'id',
    intlCode: 'id',
    nativeName: 'Bahasa Indonesia',
    englishName: 'Indonesian',
    direction: 'ltr',
    completeness: 35,
    quality: 'machine_assisted',
    website: false,
    crm: true,
    portal: false,
    suggestedCurrency: 'IDR',
    suggestedTimezone: 'Asia/Jakarta',
    weekStartsOn: 1,
    fallbackChain: ['en'],
    note: 'Machine-assisted draft. Not yet reviewed by a native speaker.',
  },
];

export const localeByCode = new Map(locales.map((l) => [l.code, l]));
export const rtlLocales = locales.filter((l) => l.direction === 'rtl').map((l) => l.code);

export function getLocale(code: string): LocaleDefinition {
  return localeByCode.get(code) ?? localeByCode.get(referenceLocale)!;
}

export function isRtl(code: string): boolean {
  return getLocale(code).direction === 'rtl';
}

export function directionOf(code: string): Direction {
  return getLocale(code).direction;
}

/** Languages advertised on the website language switcher. */
export const websiteLocales = locales.filter((l) => l.website);

/** Locales selectable inside the CRM. */
export const crmLocales = locales.filter((l) => l.crm);

/** Timezone options with honest labels. Not an exhaustive IANA list. */
export const timezoneOptions: Array<{ value: string; label: string; offsetLabel: string }> = [
  { value: 'UTC', label: 'UTC', offsetLabel: 'UTC+00:00' },
  { value: 'Europe/London', label: 'London', offsetLabel: 'UTC+00:00 / +01:00' },
  { value: 'Europe/Dublin', label: 'Dublin', offsetLabel: 'UTC+00:00 / +01:00' },
  { value: 'Europe/Lisbon', label: 'Lisbon', offsetLabel: 'UTC+00:00 / +01:00' },
  { value: 'Europe/Madrid', label: 'Madrid', offsetLabel: 'UTC+01:00 / +02:00' },
  { value: 'Europe/Paris', label: 'Paris', offsetLabel: 'UTC+01:00 / +02:00' },
  { value: 'Europe/Berlin', label: 'Berlin', offsetLabel: 'UTC+01:00 / +02:00' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam', offsetLabel: 'UTC+01:00 / +02:00' },
  { value: 'Europe/Rome', label: 'Rome', offsetLabel: 'UTC+01:00 / +02:00' },
  { value: 'Europe/Warsaw', label: 'Warsaw', offsetLabel: 'UTC+01:00 / +02:00' },
  { value: 'Europe/Istanbul', label: 'Istanbul', offsetLabel: 'UTC+03:00' },
  { value: 'Europe/Moscow', label: 'Moscow', offsetLabel: 'UTC+03:00' },
  { value: 'Africa/Cairo', label: 'Cairo', offsetLabel: 'UTC+02:00' },
  { value: 'Africa/Lagos', label: 'Lagos', offsetLabel: 'UTC+01:00' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg', offsetLabel: 'UTC+02:00' },
  { value: 'Africa/Nairobi', label: 'Nairobi', offsetLabel: 'UTC+03:00' },
  { value: 'Asia/Dubai', label: 'Dubai', offsetLabel: 'UTC+04:00' },
  { value: 'Asia/Riyadh', label: 'Riyadh', offsetLabel: 'UTC+03:00' },
  { value: 'Asia/Tehran', label: 'Tehran', offsetLabel: 'UTC+03:30' },
  { value: 'Asia/Kabul', label: 'Kabul', offsetLabel: 'UTC+04:30' },
  { value: 'Asia/Karachi', label: 'Karachi', offsetLabel: 'UTC+05:00' },
  { value: 'Asia/Kolkata', label: 'Kolkata', offsetLabel: 'UTC+05:30' },
  { value: 'Asia/Dhaka', label: 'Dhaka', offsetLabel: 'UTC+06:00' },
  { value: 'Asia/Jakarta', label: 'Jakarta', offsetLabel: 'UTC+07:00' },
  { value: 'Asia/Singapore', label: 'Singapore', offsetLabel: 'UTC+08:00' },
  { value: 'Asia/Shanghai', label: 'Shanghai', offsetLabel: 'UTC+08:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo', offsetLabel: 'UTC+09:00' },
  { value: 'Australia/Sydney', label: 'Sydney', offsetLabel: 'UTC+10:00 / +11:00' },
  { value: 'Pacific/Auckland', label: 'Auckland', offsetLabel: 'UTC+12:00 / +13:00' },
  { value: 'America/Sao_Paulo', label: 'São Paulo', offsetLabel: 'UTC-03:00' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', offsetLabel: 'UTC-03:00' },
  { value: 'America/New_York', label: 'New York', offsetLabel: 'UTC-05:00 / -04:00' },
  { value: 'America/Chicago', label: 'Chicago', offsetLabel: 'UTC-06:00 / -05:00' },
  { value: 'America/Denver', label: 'Denver', offsetLabel: 'UTC-07:00 / -06:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles', offsetLabel: 'UTC-08:00 / -07:00' },
  { value: 'America/Mexico_City', label: 'Mexico City', offsetLabel: 'UTC-06:00' },
  { value: 'America/Toronto', label: 'Toronto', offsetLabel: 'UTC-05:00 / -04:00' },
];

/** Countries offered in address and organization forms. */
export const countryOptions: Array<{ code: string; name: string; dialCode: string; currency: string }> = [
  { code: 'US', name: 'United States', dialCode: '+1', currency: 'USD' },
  { code: 'CA', name: 'Canada', dialCode: '+1', currency: 'CAD' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', currency: 'GBP' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', currency: 'EUR' },
  { code: 'DE', name: 'Germany', dialCode: '+49', currency: 'EUR' },
  { code: 'FR', name: 'France', dialCode: '+33', currency: 'EUR' },
  { code: 'ES', name: 'Spain', dialCode: '+34', currency: 'EUR' },
  { code: 'IT', name: 'Italy', dialCode: '+39', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', dialCode: '+32', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', currency: 'EUR' },
  { code: 'AT', name: 'Austria', dialCode: '+43', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', currency: 'CHF' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', currency: 'SEK' },
  { code: 'NO', name: 'Norway', dialCode: '+47', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', dialCode: '+45', currency: 'DKK' },
  { code: 'FI', name: 'Finland', dialCode: '+358', currency: 'EUR' },
  { code: 'PL', name: 'Poland', dialCode: '+48', currency: 'PLN' },
  { code: 'CZ', name: 'Czechia', dialCode: '+420', currency: 'CZK' },
  { code: 'RO', name: 'Romania', dialCode: '+40', currency: 'RON' },
  { code: 'TR', name: 'Türkiye', dialCode: '+90', currency: 'TRY' },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', currency: 'UAH' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', currency: 'AED' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', currency: 'SAR' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', currency: 'QAR' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', currency: 'KWD' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', currency: 'BHD' },
  { code: 'OM', name: 'Oman', dialCode: '+968', currency: 'OMR' },
  { code: 'JO', name: 'Jordan', dialCode: '+962', currency: 'JOD' },
  { code: 'LB', name: 'Lebanon', dialCode: '+961', currency: 'LBP' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', currency: 'EGP' },
  { code: 'MA', name: 'Morocco', dialCode: '+212', currency: 'MAD' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', currency: 'NGN' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', currency: 'KES' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', currency: 'GHS' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', currency: 'ZAR' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', currency: 'TZS' },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', currency: 'ETB' },
  { code: 'AF', name: 'Afghanistan', dialCode: '+93', currency: 'AFN' },
  { code: 'IR', name: 'Iran', dialCode: '+98', currency: 'IRR' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', currency: 'PKR' },
  { code: 'IN', name: 'India', dialCode: '+91', currency: 'INR' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', currency: 'BDT' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', currency: 'LKR' },
  { code: 'NP', name: 'Nepal', dialCode: '+977', currency: 'NPR' },
  { code: 'CN', name: 'China', dialCode: '+86', currency: 'CNY' },
  { code: 'HK', name: 'Hong Kong SAR', dialCode: '+852', currency: 'HKD' },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', currency: 'TWD' },
  { code: 'JP', name: 'Japan', dialCode: '+81', currency: 'JPY' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', currency: 'KRW' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', currency: 'SGD' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', currency: 'MYR' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', currency: 'IDR' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', currency: 'THB' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', currency: 'VND' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', currency: 'PHP' },
  { code: 'AU', name: 'Australia', dialCode: '+61', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', currency: 'NZD' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', currency: 'BRL' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', currency: 'ARS' },
  { code: 'CL', name: 'Chile', dialCode: '+56', currency: 'CLP' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', currency: 'COP' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', currency: 'MXN' },
  { code: 'PE', name: 'Peru', dialCode: '+51', currency: 'PEN' },
];

export const currencyOptions: Array<{ code: string; name: string; symbol: string }> = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'AFN', name: 'Afghan Afghani', symbol: '؋' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
];

/** Fiscal-year start months offered in organization settings. */
export const fiscalYearOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April (common for India, Japan, UK tax year starts in April)' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July (common for Australia and Pakistan)' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October (US federal fiscal year)' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

/** Alternative calendar systems referenced in date settings. */
export const calendarSystems = [
  { value: 'gregorian', label: 'Gregorian', note: 'Default in all locales.' },
  { value: 'hijri', label: 'Hijri', note: 'Presented as a display option; no conversion service is called.' },
  { value: 'solar_hijri', label: 'Solar Hijri', note: 'Relevant for Dari, Pashto and Persian locales.' },
  { value: 'buddhist', label: 'Buddhist', note: 'Relevant for Thai and some regional locales.' },
] as const;

/** Number presentation preferences. */
export const numberFormatOptions = [
  { value: 'standard', label: 'Standard (1,234,567.89)' },
  { value: 'indian', label: 'Indian grouping (12,34,567.89)' },
  { value: 'space', label: 'Space separated (1 234 567,89)' },
  { value: 'plain', label: 'No grouping (1234567.89)' },
] as const;
