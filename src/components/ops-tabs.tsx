"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

export function OpsTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/operations", label: "Tour cost sheets" },
    { href: "/operations/vendors", label: "Vendors" },
    { href: "/operations/inventory", label: "Inventory" },
  ];
  return (
    <div className="no-scrollbar mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold", path === t.href ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Small "amount / paid / due" figure block used across operations pages. */
export function Money3({ amount, paid, due, className }: { amount: number; paid: number; due: number; className?: string }) {
  const f = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  return (
    <div className={cn("grid grid-cols-3 gap-2 text-sm", className)}>
      <div>
        <p className="text-[11px] text-muted">Total</p>
        <p className="font-semibold tabular-nums">{f(amount)}</p>
      </div>
      <div>
        <p className="text-[11px] text-muted">Advance paid</p>
        <p className="font-semibold tabular-nums text-leaf">{f(paid)}</p>
      </div>
      <div>
        <p className="text-[11px] text-muted">Due</p>
        <p className={cn("font-semibold tabular-nums", due > 0 ? "text-coral" : "text-muted")}>{f(due)}</p>
      </div>
    </div>
  );
}
