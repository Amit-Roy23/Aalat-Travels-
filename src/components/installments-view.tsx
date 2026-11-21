"use client";
import { CheckCircle2 } from "lucide-react";
import { allocateInstallments, type InstallmentInput } from "@/lib/installments";
import { cn, fmtDate, money } from "@/lib/format";
import { Badge } from "./ui";

const TONE = { paid: "leaf", partial: "sun", due: "sky", overdue: "coral" } as const;
const LABEL = { paid: "Paid", partial: "Partly paid", due: "Due", overdue: "Overdue" } as const;

export function InstallmentsTable({ total, installments, amountPaid }: { total: number; installments: InstallmentInput[]; amountPaid: number }) {
  const rows = allocateInstallments(total, installments, amountPaid);
  return (
    <ul className="divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r._id ?? i} className="flex items-center gap-3 px-5 py-3 text-sm">
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", r.status === "paid" ? "bg-leaf text-white" : "bg-surface-2 text-muted")}>
            {r.status === "paid" ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {r.label} <span className="font-normal text-muted">· {r.percent}%</span>
            </p>
            <p className={cn("text-xs", r.status === "overdue" ? "font-semibold text-coral" : "text-muted")}>
              Due {fmtDate(r.dueDate)}
              {r.paid > 0 && r.remaining > 0 && ` · paid ${money(r.paid)}, ${money(r.remaining)} left`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{money(r.amount)}</p>
            <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
