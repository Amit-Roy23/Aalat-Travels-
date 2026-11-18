"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bot, CalendarClock, CheckCircle2, FileText, IndianRupee, MessageCircle, Phone, PenLine, RefreshCcw, Sparkles, UserPlus, UserRoundCheck, Mail, ArrowRightLeft, Megaphone } from "lucide-react";
import { cn, displayPhone, fmtDateTime, timeAgo } from "@/lib/format";
import { Avatar } from "./ui";

export function KpiCard({ label, value, icon, foot, tone = "brand", href }: { label: string; value: ReactNode; icon: ReactNode; foot?: ReactNode; tone?: "brand" | "sun" | "coral" | "sky" | "leaf"; href?: string }) {
  const iconBg = { brand: "bg-brand-soft text-brand", sun: "bg-sun-soft text-sun", coral: "bg-coral-soft text-coral", sky: "bg-sky-soft text-sky", leaf: "bg-leaf-soft text-leaf" }[tone];
  const body = (
    <div className="card relative h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted sm:text-[12px] sm:tracking-wider">{label}</p>
          <p className="mt-1.5 font-display text-[24px] sm:text-[28px] font-extrabold leading-none tracking-tight">{value}</p>
        </div>
        <span className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl min-[400px]:flex", iconBg)}>{icon}</span>
      </div>
      {foot && (
        <>
          <div className="relative mx-0">
            <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-line bg-bg" />
            <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-line bg-bg" />
            <div className="perforation mx-4" />
          </div>
          <div className="px-4 py-2.5 text-[11.5px] leading-snug text-muted sm:text-xs">{foot}</div>
        </>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

const ACT_ICON: Record<string, { icon: typeof Bot; cls: string }> = {
  created: { icon: UserPlus, cls: "bg-sky-soft text-sky" },
  capture: { icon: Megaphone, cls: "bg-sky-soft text-sky" },
  note: { icon: PenLine, cls: "bg-slate2-soft text-slate2" },
  call: { icon: Phone, cls: "bg-leaf-soft text-leaf" },
  email: { icon: Mail, cls: "bg-sky-soft text-sky" },
  status_change: { icon: RefreshCcw, cls: "bg-sun-soft text-sun" },
  assignment: { icon: ArrowRightLeft, cls: "bg-slate2-soft text-slate2" },
  whatsapp: { icon: MessageCircle, cls: "bg-[#25D366]/15 text-[#128C4B]" },
  ai: { icon: Sparkles, cls: "bg-brand-soft text-brand" },
  followup: { icon: CalendarClock, cls: "bg-sun-soft text-sun" },
  converted: { icon: UserRoundCheck, cls: "bg-brand-soft text-brand" },
  invoice: { icon: FileText, cls: "bg-leaf-soft text-leaf" },
  payment: { icon: IndianRupee, cls: "bg-leaf-soft text-leaf" },
  updated: { icon: CheckCircle2, cls: "bg-slate2-soft text-slate2" },
};

export type ActivityItem = { _id: string; type: string; message: string; createdAt: string; user?: { name: string; color?: string } | null; lead?: { _id: string; name: string } | null; customer?: { _id: string; name: string } | null };

export function Timeline({ items, showTarget }: { items: ActivityItem[]; showTarget?: boolean }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
      {items.map((a) => {
        const m = ACT_ICON[a.type] ?? ACT_ICON.updated;
        const Icon = m.icon;
        return (
          <li key={a._id} className="relative flex gap-3">
            <span className={cn("relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", m.cls)}>
              <Icon className="h-[15px] w-[15px]" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13.5px] leading-snug">
                {showTarget && (a.lead || a.customer) && (
                  <Link href={a.lead ? `/leads/${a.lead._id}` : `/customers/${a.customer!._id}`} className="font-semibold hover:text-brand">
                    {a.lead?.name ?? a.customer?.name}:{" "}
                  </Link>
                )}
                <span className="whitespace-pre-line">{a.message}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                {a.user ? (
                  <>
                    <Avatar name={a.user.name} color={a.user.color} size={16} className="ring-0" /> {a.user.name} ·
                  </>
                ) : a.type === "ai" || a.type === "capture" || a.type === "created" ? (
                  <>
                    <Bot className="h-3 w-3" /> Automation ·
                  </>
                ) : null}
                <span title={fmtDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PhoneLink({ phone, className }: { phone?: string; className?: string }) {
  if (!phone) return <span className="text-muted">—</span>;
  return (
    <a href={`tel:+${phone}`} className={cn("hover:text-brand", className)} onClick={(e) => e.stopPropagation()}>
      {displayPhone(phone)}
    </a>
  );
}
