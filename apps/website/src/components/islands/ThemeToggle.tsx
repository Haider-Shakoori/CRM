import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@crm/ui';

/**
 * Theme toggle island.
 *
 * Reads and writes the same `crm.ui.preferences` key the application shell uses, so a
 * visitor's choice carries from the marketing site into the CRM. The actual DOM
 * attribute is applied by the inline script in `BaseLayout`, and this component mirrors
 * that state on mount so the control never disagrees with the page.
 */
type Theme = 'light' | 'dark' | 'system';

const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem('crm.ui.preferences');
    const parsed = raw ? (JSON.parse(raw) as { theme?: Theme }) : {};
    return parsed.theme ?? 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  try {
    const raw = localStorage.getItem('crm.ui.preferences');
    const parsed = raw ? JSON.parse(raw) : {};
    localStorage.setItem('crm.ui.preferences', JSON.stringify({ ...parsed, theme }));
  } catch {
    /* storage unavailable — the theme still applies for this session */
  }
}

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  const update = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-inset p-0.5', className)}
      role="radiogroup"
      aria-label="Colour theme"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${option.label} theme`}
            title={`${option.label} theme`}
            onClick={() => update(option.value)}
            className={cn(
              'inline-flex size-6 items-center justify-center rounded transition-colors',
              active ? 'bg-surface text-fg shadow-xs' : 'text-subtle hover:text-fg',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
