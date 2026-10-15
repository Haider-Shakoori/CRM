import { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { websiteLocales } from '@crm/localization';
import { cn } from '@crm/ui';

/**
 * Locale switcher.
 *
 * Only locales actually enabled for the website are listed, and each shows its honest
 * translation completeness. Selecting a locale applies the direction and language
 * attributes immediately so RTL mirroring can be verified — the URL prefix and full
 * translated routing are handled by the locale-prefixed route table, which is a later
 * batch. Until then this changes presentation and states that clearly.
 */
export default function LocaleSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('en');

  const apply = (code: string, direction: 'ltr' | 'rtl') => {
    setSelected(code);
    setOpen(false);
    document.documentElement.setAttribute('lang', code);
    document.documentElement.setAttribute('dir', direction);
    try {
      const raw = localStorage.getItem('crm.ui.preferences');
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem('crm.ui.preferences', JSON.stringify({ ...parsed, locale: code }));
    } catch {
      /* ignore */
    }
  };

  const current = websiteLocales.find((l) => l.code === selected) ?? websiteLocales[0]!;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-inset px-2 text-xs font-medium text-muted transition-colors hover:text-fg"
      >
        <Globe className="size-3.5" aria-hidden />
        {current.nativeName}
        <span className="text-faint" aria-hidden>
          ·
        </span>
        <span className="tabular-nums text-faint">{current.completeness}%</span>
      </button>

      {open ? (
        <>
          {/* Click-away layer keeps the popover dismissible without a modal. */}
          <button
            type="button"
            className="fixed inset-0 z-[40] cursor-default"
            aria-label="Close language list"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Language"
            className="absolute bottom-full z-[45] mb-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-overlay p-1 shadow-xl"
          >
            <li className="px-2 py-1.5 text-2xs text-faint">
              Translation status is shown per language. Missing strings fall back to English.
            </li>
            {websiteLocales.map((locale) => (
              <li key={locale.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={locale.code === selected}
                  onClick={() => apply(locale.code, locale.direction)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-hover',
                    locale.code === selected && 'text-brand-fg',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{locale.nativeName}</span>
                    <span className="block truncate text-2xs text-muted">
                      {locale.englishName}
                      {locale.direction === 'rtl' ? ' · right-to-left' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs tabular-nums text-subtle">{locale.completeness}%</span>
                  {locale.code === selected ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
