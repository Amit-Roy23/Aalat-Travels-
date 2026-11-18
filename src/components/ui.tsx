"use client";
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X } from "lucide-react";
import { cn, initials } from "@/lib/format";
import { invoiceStatusMeta, leadStatusMeta, type Tone } from "@/lib/constants";

/* ───────── Button ───────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "wa";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: ReactNode;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-[15px]",
        size === "icon" && "h-9 w-9 text-sm",
        variant === "primary" && "bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_20px_-10px_rgb(var(--brand))] hover:brightness-110",
        variant === "secondary" && "bg-surface-2 text-ink hover:bg-line/70",
        variant === "outline" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink/80 hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "bg-coral text-white hover:brightness-110",
        variant === "wa" && "bg-[#25D366] text-[#073B2F] hover:brightness-105",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ───────── Field ───────── */
export function Field({ label, hint, error, children, className, required }: { label?: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-coral"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-coral">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/* ───────── Badges ───────── */
const toneCls: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  sun: "bg-sun-soft text-sun",
  coral: "bg-coral-soft text-coral",
  sky: "bg-sky-soft text-sky",
  leaf: "bg-leaf-soft text-leaf",
  slate: "bg-slate2-soft text-slate2",
};
const dotCls: Record<Tone, string> = { brand: "bg-brand", sun: "bg-sun", coral: "bg-coral", sky: "bg-sky", leaf: "bg-leaf", slate: "bg-slate2" };
export function Badge({ tone = "slate", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("chip", toneCls[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotCls[tone])} />}
      {children}
    </span>
  );
}
export function LeadStatusBadge({ status }: { status: string }) {
  const m = leadStatusMeta(status);
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}
export function InvoiceStatusBadge({ status }: { status: string }) {
  const m = invoiceStatusMeta(status);
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
export const toneText: Record<Tone, string> = { brand: "text-brand", sun: "text-sun", coral: "text-coral", sky: "text-sky", leaf: "text-leaf", slate: "text-slate2" };
export const toneBg = toneCls;
export const toneDot = dotCls;

/* ───────── Avatar ───────── */
export function Avatar({ name, color, size = 32, className }: { name?: string | null; color?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-surface", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: color || "rgb(var(--slate2))" }}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}

/* ───────── Card / layout bits ───────── */
export function Card({ children, className, title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cn("card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h3 className="font-display text-[15px] font-bold tracking-tight">{title}</h3>
          {action}
        </header>
      )}
      <div className={cn(padded && "p-4 sm:p-5")}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand", className)} />;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} />;
}
export function PageLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-coral" />
      <p className="font-semibold">{error instanceof Error ? error.message : "Something went wrong"}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ───────── Tabs (segmented) ───────── */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn("no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1", className)}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition", value === it.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}
        >
          {it.label}
          {it.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px]", value === it.value ? "bg-brand-soft text-brand-ink" : "bg-line/70")}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, onChange, total }: { page: number; pages: number; onChange: (p: number) => void; total?: number }) {
  if (pages <= 1) return total !== undefined ? <p className="px-4 py-3 text-xs text-muted">{total} record{total === 1 ? "" : "s"}</p> : null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-xs text-muted">
        Page {page} of {pages}
        {total !== undefined && ` · ${total} records`}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ───────── Modal ───────── */
export function Modal({ open, onClose, title, children, footer, size = "md", description }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[rgb(var(--sidebar))]/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-scale-in flex-col rounded-t-3xl border border-line bg-surface shadow-pop sm:rounded-3xl",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-4xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────── Toasts + confirm ───────── */
type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type ConfirmOpts = { title: string; message?: ReactNode; confirmText?: string; danger?: boolean };
const UiCtx = createContext<{ toast: (text: string, kind?: Toast["kind"]) => void; confirm: (o: ConfirmOpts) => Promise<boolean> } | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const idRef = useRef(0);
  const toast = useCallback((text: string, kind: Toast["kind"] = "success") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 5500 : 3200);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };
  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm animate-fade-up items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium shadow-pop">
            {t.kind === "success" ? <CheckCircle2 className="mt-px h-[18px] w-[18px] shrink-0 text-leaf" /> : t.kind === "error" ? <AlertTriangle className="mt-px h-[18px] w-[18px] shrink-0 text-coral" /> : <Info className="mt-px h-[18px] w-[18px] shrink-0 text-sky" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={dialog?.danger ? "danger" : "primary"} onClick={() => close(true)}>
              {dialog?.confirmText ?? "Confirm"}
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted">{dialog?.message}</div>
      </Modal>
    </UiCtx.Provider>
  );
}
export function useUi() {
  const c = useContext(UiCtx);
  if (!c) throw new Error("useUi must be used inside UiProvider");
  return c;
}

/* ───────── Popover menu ───────── */
export function Menu({ trigger, children, align = "right" }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && <div className={cn("absolute top-full z-50 mt-2 min-w-[200px] animate-scale-in rounded-2xl border border-line bg-surface p-1.5 shadow-pop", align === "right" ? "right-0" : "left-0")}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-surface-2", danger ? "text-coral" : "text-ink")}>
      {icon}
      {children}
    </button>
  );
}

export function StatPill({ label, value, tone = "slate" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className={cn("rounded-xl px-3 py-2", toneCls[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}
