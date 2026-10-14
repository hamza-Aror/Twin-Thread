/**
 * Shared building blocks. Every component styles itself with theme tokens only
 * (bg-panel, text-muted, border-line ...), so light and dark mode come for free.
 *
 * Shape scale: cards 16 px radius, controls 10 px, chips/badges fully rounded.
 */
import type { ReactNode } from 'react';
import { CATEGORY_COLORS, CATEGORY_INK, tint } from '../services/risk/categories';
import type { AssessmentCategory } from '../types/risk';
import { useI18n } from '../i18n';

export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 id="page-title" tabIndex={-1} className="text-[22px] font-semibold tracking-tight text-fg outline-none sm:text-2xl">
          {title}
        </h1>
        {intro && <p className="mt-1.5 text-muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

export function Panel({
  title,
  children,
  className = '',
  aside,
  padded = true,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-panel shadow-card ${padded ? 'p-4 sm:p-5' : ''} ${className}`} aria-label={title}>
      {title && (
        <div className={`mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${padded ? '' : 'px-4 pt-4 sm:px-5 sm:pt-5'}`}>
          <h2 className="shrink-0 text-[15px] font-semibold text-fg">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function CategoryBadge({ category, size = 'md' }: { category: AssessmentCategory; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const ink = CATEGORY_INK[category];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]'}`}
      style={{ color: ink, backgroundColor: tint(CATEGORY_COLORS[category], 14) }}
    >
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
      {t(`cat.${category}`)}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
  disabled,
  ariaPressed,
  className = '',
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaPressed?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const styles = {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover font-semibold',
    secondary: 'border border-line bg-panel text-fg hover:bg-raised',
    ghost: 'text-accent hover:bg-raised',
  }[variant];
  const sizes = size === 'sm' ? 'min-h-8 px-2.5 py-1 text-[13px]' : 'min-h-10 px-3.5 py-2 text-sm';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * A pill toggle for filters. "On" is shown by a filled swatch and stronger text,
 * "off" by a hollow swatch and faint text, so the state never depends on colour alone.
 */
export function Chip({ pressed, onClick, color, children }: { pressed: boolean; onClick: () => void; color?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
        pressed ? 'border-line-strong bg-raised font-medium text-fg' : 'border-line bg-transparent text-faint hover:text-muted'
      }`}
    >
      {color && (
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={pressed ? { backgroundColor: color } : { boxShadow: `inset 0 0 0 1.5px ${color}` }}
        />
      )}
      {children}
    </button>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'num min-h-10 w-full rounded-[10px] border border-line bg-panel px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

export function Notice({ tone = 'info', children, role }: { tone?: 'info' | 'warn' | 'danger' | 'demo'; children: ReactNode; role?: 'status' | 'alert' }) {
  const styles = {
    info: 'border-line bg-raised text-fg',
    warn: 'border-amber/40 bg-amber/10 text-fg',
    danger: 'border-alert/40 bg-alert/10 text-fg',
    demo: 'border-accent/40 bg-panel text-fg demo-hatch',
  }[tone];
  return (
    <div role={role} className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </div>
  );
}
