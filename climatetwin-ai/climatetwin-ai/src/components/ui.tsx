/** Small shared building blocks. Kept deliberately plain. */
import type { ReactNode } from 'react';
import { CATEGORY_COLORS } from '../services/risk/categories';
import type { AssessmentCategory } from '../types/risk';
import { useI18n } from '../i18n';

export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 id="page-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight text-fg outline-none sm:text-3xl">
          {title}
        </h1>
        {intro && <p className="mt-2 text-muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

export function Panel({ title, children, className = '', aside }: { title?: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-panel p-4 sm:p-5 ${className}`} aria-label={title}>
      {title && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="shrink-0 text-base font-semibold text-fg">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function CategoryBadge({ category, size = 'md' }: { category: AssessmentCategory; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const color = CATEGORY_COLORS[category];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}
      style={{ borderColor: `${color}66`, color, backgroundColor: `${color}1a` }}
    >
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {t(`cat.${category}`)}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted">{label}</div>
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
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaPressed?: boolean;
  className?: string;
}) {
  const styles = {
    primary: 'bg-accent text-ink hover:bg-[#7fd6ef] font-semibold',
    secondary: 'border border-line bg-raised text-fg hover:border-accent/60',
    ghost: 'text-accent hover:bg-raised',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'num min-h-10 w-full rounded-lg border border-line bg-ink px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none';

export function Notice({ tone = 'info', children, role }: { tone?: 'info' | 'warn' | 'danger' | 'demo'; children: ReactNode; role?: 'status' | 'alert' }) {
  const styles = {
    info: 'border-line bg-raised text-muted',
    warn: 'border-amber/50 bg-amber/10 text-fg',
    danger: 'border-alert/60 bg-alert/10 text-fg',
    demo: 'border-accent/50 bg-panel text-fg demo-hatch',
  }[tone];
  return (
    <div role={role} className={`rounded-lg border px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </div>
  );
}
