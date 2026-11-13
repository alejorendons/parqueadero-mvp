import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { ApiError } from './api';

export function Button({
  children,
  variant = 'primary',
  busy = false,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${className}`}
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Field({
  label,
  id,
  children,
  hint,
}: {
  label: string;
  id: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Notice({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}
export function ErrorNotice({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <strong>
          {error instanceof ApiError && error.status === 401
            ? 'La sesión terminó'
            : 'No pudimos completar la operación'}
        </strong>
        <p>{error.message}</p>
        {error instanceof ApiError && error.status === 401 && (
          <a href="/signin-with-chatgpt?return_to=/" target="_top">
            Volver a iniciar sesión <ArrowRight size={14} />
          </a>
        )}
      </div>
      {onRetry && (
        <Button variant="quiet" onClick={onRetry}>
          <RefreshCw size={15} />
          Actualizar
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = ref.current;
    element?.showModal();
    return () => {
      element?.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-title">
        <h2 id={heading}>{title}</h2>
        <Button variant="quiet" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}>
          <X size={19} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function LoadingWorkspace() {
  return (
    <div className="workspace-skeleton" role="status" aria-label="Cargando operación">
      <div className="skeleton skeleton-strip" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-list" />
        <div className="skeleton skeleton-form" />
      </div>
      <span className="sr-only">Cargando operación</span>
    </div>
  );
}
