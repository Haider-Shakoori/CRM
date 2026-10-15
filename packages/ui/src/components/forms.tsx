'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, Eye, EyeOff, Minus, Search, X } from 'lucide-react';
import { cn, focusRing, transitionBase } from '../lib/utils';

/* ------------------------------------------------------------------ Field */

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  /** Rendered to the right of the label, e.g. a character count or "Optional". */
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Adds the required asterisk with an accessible explanation. */
  showRequiredMark?: boolean;
}

/**
 * Field wrapper. Owns label/description/error wiring so every control in the product
 * gets identical semantics: the error is linked by id, announced politely, and marked
 * with `aria-invalid` on the control itself.
 */
export function Field({
  label,
  htmlFor,
  description,
  error,
  required,
  hint,
  children,
  className,
  showRequiredMark = true,
}: FieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={htmlFor} className="flex items-center gap-1">
            {label}
            {required && showRequiredMark ? (
              <span className="text-danger-fg" aria-hidden>
                *
              </span>
            ) : null}
            {required ? <span className="sr-only">(required)</span> : null}
          </Label>
          {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
        </div>
      ) : null}
      {React.isValidElement(children) && (descriptionId || errorId)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
            'aria-invalid': error ? true : undefined,
          })
        : children}
      {description && !error ? (
        <p id={descriptionId} className="text-xs text-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-xs text-danger-fg">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-sm font-medium text-fg peer-disabled:opacity-60', className)}
      {...props}
    />
  );
});

/** Fieldset with a legend for grouped controls. */
export function FieldGroup({
  legend,
  description,
  children,
  className,
}: {
  legend: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="text-sm font-semibold text-fg">{legend}</legend>
      {description ? <p className="text-xs text-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ input */

const controlBase = cn(
  'flex w-full rounded-md border border-border bg-surface text-fg placeholder:text-faint',
  'transition-[border-color,box-shadow] duration-150 ease-standard',
  'focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/25',
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-inset',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25',
  // File inputs inherit the same shape so they do not look like a browser default.
  'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg',
);

const controlSizes = {
  sm: 'h-[var(--control-h-sm)] px-2.5 text-sm',
  md: 'h-[var(--control-h-md)] px-3 text-sm',
  lg: 'h-[var(--control-h-lg)] px-3.5 text-sm',
} as const;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: keyof typeof controlSizes;
  /** Icon or adornment placed before the input text. */
  leading?: React.ReactNode;
  /** Icon, unit label or button placed after the input text. */
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, inputSize = 'md', leading, trailing, ...props },
  ref,
) {
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(controlBase, controlSizes[inputSize], className)} {...props} />;
  }
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading ? <span className="pointer-events-none absolute start-2.5 flex text-subtle [&_svg]:size-4">{leading}</span> : null}
      <input
        ref={ref}
        className={cn(controlBase, controlSizes[inputSize], leading && 'ps-8', trailing && 'pe-9')}
        {...props}
      />
      {trailing ? <span className="absolute end-2 flex items-center text-subtle [&_svg]:size-4">{trailing}</span> : null}
    </div>
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autoResize?: boolean }>(
  function Textarea({ className, autoResize, onChange, ...props }, ref) {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoResize) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 420)}px`;
    }, [autoResize]);

    React.useEffect(resize, [resize, props.value]);

    return (
      <textarea
        ref={innerRef}
        className={cn(controlBase, 'min-h-[4.5rem] resize-y px-3 py-2 text-sm leading-relaxed', className)}
        onChange={(event) => {
          onChange?.(event);
          resize();
        }}
        {...props}
      />
    );
  },
);

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'trailing'> {
  /** Adds a strength meter. Required for signup and password-reset screens. */
  showStrength?: boolean;
}

export function PasswordInput({ showStrength, value, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  const strength = React.useMemo(() => {
    const raw = typeof value === 'string' ? value : '';
    let score = 0;
    if (raw.length >= 8) score += 1;
    if (raw.length >= 12) score += 1;
    if (/[A-Z]/.test(raw) && /[a-z]/.test(raw)) score += 1;
    if (/\d/.test(raw)) score += 1;
    if (/[^A-Za-z0-9]/.test(raw)) score += 1;
    return Math.min(score, 5);
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Input
        {...props}
        value={value}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className={cn('rounded p-0.5 hover:text-fg', focusRing)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff /> : <Eye />}
          </button>
        }
      />
      {showStrength ? (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  index >= strength ? 'bg-inset' : strength <= 2 ? 'bg-danger' : strength <= 3 ? 'bg-warning' : 'bg-success',
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted" role="status">
            {['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][strength]}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export interface SearchInputProps extends Omit<InputProps, 'leading'> {
  onClear?: () => void;
  /** Renders a keyboard hint, e.g. the ⌘K affordance. */
  shortcutHint?: string;
}

export function SearchInput({ className, onClear, value, shortcutHint, ...props }: SearchInputProps) {
  const hasValue = typeof value === 'string' && value.length > 0;
  return (
    <Input
      type="search"
      role="searchbox"
      value={value}
      className={className}
      leading={<Search />}
      trailing={
        hasValue && onClear ? (
          <button type="button" onClick={onClear} className={cn('rounded p-0.5 hover:text-fg', focusRing)} aria-label="Clear search">
            <X />
          </button>
        ) : shortcutHint ? (
          <kbd className="hidden rounded border border-border bg-inset px-1.5 py-0.5 font-mono text-2xs text-subtle sm:inline-block">
            {shortcutHint}
          </kbd>
        ) : undefined
      }
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ Select */

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  selectSize?: keyof typeof controlSizes;
  className?: string;
  /** Adds a searchable filter above the list. Not a combobox — use Combobox for that. */
  searchable?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  id,
  name,
  disabled,
  required,
  selectSize = 'md',
  className,
  searchable,
  ...aria
}: SelectProps) {
  const [query, setQuery] = React.useState('');
  const groups = React.useMemo(() => {
    const filtered = searchable && query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;
    const map = new Map<string, SelectOption[]>();
    for (const option of filtered) {
      const key = option.group ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(option);
    }
    return [...map.entries()];
  }, [options, query, searchable]);

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} required={required} name={name}>
      <SelectPrimitive.Trigger
        id={id}
        className={cn(controlBase, controlSizes[selectSize], 'justify-between gap-2 text-start', className)}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={aria['aria-invalid']}
      >
        <SelectPrimitive.Value placeholder={<span className="text-faint">{placeholder}</span>} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-subtle" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[70] max-h-[min(22rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[10rem] overflow-hidden rounded-lg border border-border bg-overlay shadow-lg"
        >
          {searchable ? (
            <div className="border-b border-border-subtle p-2">
              <Input
                inputSize="sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter options"
                leading={<Search />}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>
          ) : null}
          <SelectPrimitive.Viewport className="max-h-[18rem] overflow-y-auto p-1">
            {groups.length === 0 ? <p className="px-2 py-3 text-sm text-muted">No options match “{query}”.</p> : null}
            {groups.map(([groupName, groupOptions]) => (
              <SelectPrimitive.Group key={groupName || 'ungrouped'}>
                {groupName ? (
                  <SelectPrimitive.Label className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
                    {groupName}
                  </SelectPrimitive.Label>
                ) : null}
                {groupOptions.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      'relative flex cursor-default select-none flex-col gap-0.5 rounded-md py-1.5 pe-8 ps-2 text-sm text-fg outline-none',
                      'data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    )}
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    {option.description ? <span className="text-xs text-muted">{option.description}</span> : null}
                    <SelectPrimitive.ItemIndicator className="absolute end-2 top-2">
                      <Check className="size-4 text-brand" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* --------------------------------------------------------------- Checkbox */

export interface CheckboxProps {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  'aria-describedby'?: string;
}

export function Checkbox({ checked, onCheckedChange, id, name, disabled, required, label, description, className, ...aria }: CheckboxProps) {
  const control = (
    <CheckboxPrimitive.Root
      id={id}
      name={name}
      disabled={disabled}
      required={required}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-describedby={aria['aria-describedby']}
      className={cn(
        'peer flex size-4 shrink-0 items-center justify-center rounded-[0.25rem] border border-border-strong bg-surface',
        transitionBase,
        focusRing,
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="text-brand-contrast">
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return control;

  return (
    <div className="flex items-start gap-2.5">
      {control}
      <div className="min-w-0 space-y-0.5 leading-tight">
        <Label htmlFor={id} className="cursor-pointer font-normal text-fg">
          {label}
        </Label>
        {description ? (
          <p id={aria['aria-describedby']} className="text-xs text-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Switch */

export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
  label,
  description,
  className,
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  const control = (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5',
        transitionBase,
        focusRing,
        'data-[state=checked]:bg-brand data-[state=unchecked]:bg-border-strong',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-standard data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-4" />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}

/* ------------------------------------------------------------- RadioGroup */

export function RadioGroup({
  value,
  onValueChange,
  options,
  orientation = 'vertical',
  name,
  className,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  options: Array<{ value: string; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean }>;
  orientation?: 'vertical' | 'horizontal';
  name?: string;
  className?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      orientation={orientation}
      name={name}
      className={cn('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap', className)}
    >
      {options.map((option) => (
        <div key={option.value} className="flex items-start gap-2.5">
          <RadioGroupPrimitive.Item
            value={option.value}
            id={`${name ?? 'radio'}-${option.value}`}
            disabled={option.disabled}
            className={cn(
              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface',
              focusRing,
              'data-[state=checked]:border-brand data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <RadioGroupPrimitive.Indicator className="size-1.5 rounded-full bg-brand-contrast" />
          </RadioGroupPrimitive.Item>
          <div className="space-y-0.5">
            <Label htmlFor={`${name ?? 'radio'}-${option.value}`} className="cursor-pointer font-normal">
              {option.label}
            </Label>
            {option.description ? <p className="text-xs text-muted">{option.description}</p> : null}
          </div>
        </div>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

/* ------------------------------------------------------------ MultiSelect */

/**
 * Chip-based multi select. Used for tags, picklist fields, saved-view filters and
 * segment rule values. Removable chips keep the selection visible without a dropdown.
 */
export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = 'Add…',
  id,
  className,
  /** Allows free-text entry for tag-style fields. */
  allowCustom = false,
  max,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  allowCustom?: boolean;
  max?: number;
}) {
  const [query, setQuery] = React.useState('');
  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value;
  const available = options.filter(
    (option) => !values.includes(option.value) && (!query || option.label.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn(controlBase, 'min-h-[var(--control-h-md)] flex-wrap gap-1 px-2 py-1.5')}>
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-md bg-neutral-subtle px-1.5 py-0.5 text-xs text-fg">
            {labelFor(value)}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              className={cn('rounded p-0.5 hover:bg-hover', focusRing)}
              aria-label={`Remove ${labelFor(value)}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {!max || values.length < max ? (
          <input
            id={id}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={values.length === 0 ? placeholder : ''}
            className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-sm placeholder:text-faint focus:outline-none"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && query && (allowCustom || available.length > 0)) {
                event.preventDefault();
                const match = available[0];
                onChange([...values, match ? match.value : query]);
                setQuery('');
              }
              if (event.key === 'Backspace' && !query && values.length > 0) {
                onChange(values.slice(0, -1));
              }
            }}
            aria-label="Add an option"
          />
        ) : (
          <span className="px-1 text-xs text-subtle">Limit of {max} reached</span>
        )}
      </div>
      {query && available.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-overlay p-1 shadow-md">
          {available.slice(0, 8).map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className={cn('w-full rounded px-2 py-1.5 text-start text-sm hover:bg-hover', focusRing)}
                onClick={() => {
                  onChange([...values, option.value]);
                  setQuery('');
                }}
              >
                {option.label}
                {option.description ? <span className="ms-2 text-xs text-muted">{option.description}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Number */

/**
 * Currency input.
 *
 * Locale-aware display with a controlled numeric value. No currency conversion,
 * tax calculation or financial rounding service is involved — the decimal places come
 * from the locale catalogue.
 */
export function CurrencyInput({
  value,
  onChange,
  currency = 'USD',
  symbol,
  locale = 'en',
  id,
  placeholder,
  className,
  disabled,
  'aria-describedby': describedBy,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  currency?: string;
  symbol?: string;
  locale?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
}) {
  const displaySymbol = symbol ?? new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;

  /**
   * The input is fully controlled by `value`; the local draft exists only while the user is
   * typing, so a value changed elsewhere (a form reset, a recalculated total) is reflected
   * immediately. Deriving the display value this way avoids the prop-to-state effect that
   * would otherwise cause a cascading render on every parent update.
   */
  const [draft, setDraft] = React.useState<string | null>(null);
  const text = draft ?? (value === null || value === undefined ? '' : String(value));

  return (
    <div className={cn('relative flex items-center', className)}>
      <span className="pointer-events-none absolute start-2.5 text-sm text-subtle" aria-hidden>
        {displaySymbol}
      </span>
      <input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d.,-]/g, '');
          // Keep the draft while typing so a partial entry such as "1200." is not rewritten
          // from the parsed number mid-keystroke.
          setDraft(raw);
          const normalised = raw.replace(/\s/g, '').replace(',', '.');
          const parsed = normalised === '' ? null : Number(normalised);
          onChange(parsed === null || Number.isNaN(parsed) ? null : parsed);
        }}
        onBlur={() => setDraft(null)}
        className={cn(controlBase, controlSizes.md, 'ps-8 tabular-nums')}
      />
      <span className="pointer-events-none absolute end-2.5 text-2xs font-medium text-subtle">{currency}</span>
    </div>
  );
}

/**
 * Phone input.
 *
 * Deliberately permissive: country-specific validation is a backend concern, and
 * guessing would reject valid international numbers. The country code drives the
 * dial-code prefix only.
 */
export function PhoneInput({
  value,
  onChange,
  countryCode,
  countries,
  id,
  placeholder = 'Phone number',
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  countryCode?: string;
  countries: Array<{ code: string; name: string; dialCode: string }>;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const selected = countries.find((c) => c.code === countryCode);
  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={countryCode}
        onValueChange={(code) => {
          const next = countries.find((c) => c.code === code);
          if (next && !value.startsWith(next.dialCode)) {
            const withoutOldPrefix = selected ? value.replace(new RegExp(`^\\${selected.dialCode}\\s?`), '') : value;
            onChange(`${next.dialCode} ${withoutOldPrefix}`.trim());
          }
        }}
        searchable
        className="w-[8.5rem] shrink-0"
        placeholder="Country"
        options={countries.map((c) => ({ value: c.code, label: `${c.dialCode} ${c.code}`, description: c.name }))}
        disabled={disabled}
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

export interface AddressValue {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

/**
 * International address input.
 *
 * Field order adapts to the selected country (postal code first in East Asia), and
 * secondary fields are optional because they are not universally used. No address
 * validation or geocoding service is called.
 */
export function AddressInput({
  value,
  onChange,
  countries,
  idPrefix = 'address',
  showLine2 = true,
  className,
}: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  countries: Array<{ code: string; name: string }>;
  idPrefix?: string;
  showLine2?: boolean;
  className?: string;
}) {
  const order = React.useMemo(() => {
    if (value.countryCode && ['JP', 'CN', 'KR', 'TW'].includes(value.countryCode)) {
      return ['postalCode', 'state', 'city', 'line1', 'line2'] as const;
    }
    return ['line1', 'line2', 'city', 'state', 'postalCode'] as const;
  }, [value.countryCode]);

  const labels: Record<string, string> = {
    line1: 'Address line 1',
    line2: 'Address line 2',
    city: 'City',
    state: 'State / province / region',
    postalCode: 'Postal code',
  };

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      {order
        .filter((field) => showLine2 || field !== 'line2')
        .map((field) => (
          <Field
            key={field}
            label={labels[field]}
            htmlFor={`${idPrefix}-${field}`}
            className={field === 'line1' ? 'sm:col-span-2' : undefined}
          >
            <Input
              id={`${idPrefix}-${field}`}
              value={(value[field] as string | undefined) ?? ''}
              onChange={(event) => onChange({ ...value, [field]: event.target.value })}
              autoComplete={field === 'postalCode' ? 'postal-code' : field === 'city' ? 'address-level2' : 'address-line1'}
            />
          </Field>
        ))}
      <Field label="Country" htmlFor={`${idPrefix}-country`} className="sm:col-span-2">
        <Select
          id={`${idPrefix}-country`}
          value={value.countryCode}
          onValueChange={(code) => onChange({ ...value, countryCode: code })}
          searchable
          placeholder="Select a country"
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
        />
      </Field>
    </div>
  );
}

/* ----------------------------------------------------------------- Slider */

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  id,
  label,
  formatValue,
  className,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  label: string;
  formatValue?: (value: number) => string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-medium tabular-nums text-fg">{formatValue ? formatValue(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-inset',
          'accent-[var(--brand)]',
          focusRing,
          disabled && 'cursor-not-allowed opacity-50',
        )}
      />
    </div>
  );
}

/* ----------------------------------------------------- Unsaved-change guard */

/**
 * Warns before navigating away with unsaved edits.
 * Browsers only allow a generic message, so we register the native guard and rely on
 * an in-app confirmation dialog for same-document navigation.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty || typeof window === 'undefined') return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
