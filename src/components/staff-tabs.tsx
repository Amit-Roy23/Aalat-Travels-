"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { useMe } from "./session";

export function StaffTabs() {
  const me = useMe();
  const path = usePathname();
  if (me.user.role !== "admin") return null;
  const tabs = [
    { href: "/staff", label: "Attendance & leave" },
    { href: "/staff/payroll", label: "Payroll" },
    { href: "/staff/people", label: "Staff list" },
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
