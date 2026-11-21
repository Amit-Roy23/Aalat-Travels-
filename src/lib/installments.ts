// Part-payment schedule logic, shared by the API, the invoice screens and the printed bill.
import { round2 } from "./format";

export type InstallmentInput = { label: string; percent: number; dueDate: string | Date; amount?: number; _id?: string };
export type InstallmentRow = InstallmentInput & { amount: number; paid: number; remaining: number; status: "paid" | "partial" | "due" | "overdue" };

/** Amounts from percentages; the last instalment takes the rounding remainder so the sum equals the total exactly. */
export function installmentAmounts(total: number, list: { percent: number }[]) {
  let used = 0;
  return list.map((it, i) => {
    const amt = i === list.length - 1 ? round2(total - used) : round2((total * it.percent) / 100);
    used = round2(used + amt);
    return amt;
  });
}

/** Applies the amount paid to instalments in order (oldest first). */
export function allocateInstallments(total: number, list: InstallmentInput[], amountPaid: number, startOfDay = localStartOfDay()): InstallmentRow[] {
  const amounts = installmentAmounts(total, list);
  let left = round2(amountPaid);
  const sod = startOfDay;
  return list.map((it, i) => {
    const amount = amounts[i];
    const paid = round2(Math.min(amount, Math.max(left, 0)));
    left = round2(left - paid);
    const remaining = round2(amount - paid);
    const overdue = remaining > 0.005 && new Date(it.dueDate).getTime() < sod.getTime();
    return { ...it, amount, paid, remaining, status: remaining <= 0.005 ? "paid" : overdue ? "overdue" : paid > 0 ? "partial" : "due" };
  });
}

/** Amount that should have been paid by today according to the schedule. */
export function dueByToday(total: number, list: InstallmentInput[], startOfDay = localStartOfDay()) {
  const sod = startOfDay;
  const amounts = installmentAmounts(total, list);
  return round2(list.reduce((s, it, i) => (new Date(it.dueDate).getTime() < sod.getTime() ? s + amounts[i] : s), 0));
}

function localStartOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function percentTotal(list: { percent: number }[]) {
  return round2(list.reduce((s, i) => s + (Number(i.percent) || 0), 0));
}

/** Default schedule from the payment terms: 30% now, 50% 60 days before travel, 20% 7 days before travel. */
export function defaultSchedule(issueDate: string, tourStart?: string) {
  const issue = new Date(issueDate || new Date());
  const start = tourStart ? new Date(tourStart) : null;
  const day = 86400000;
  const clamp = (d: Date) => (d.getTime() < issue.getTime() ? issue : d);
  const interim = start ? clamp(new Date(start.getTime() - 60 * day)) : new Date(issue.getTime() + 15 * day);
  const final = start ? clamp(new Date(start.getTime() - 7 * day)) : new Date(issue.getTime() + 30 * day);
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return [
    { label: "Advance token", percent: 30, dueDate: iso(issue) },
    { label: "Interim payment", percent: 50, dueDate: iso(interim) },
    { label: "Final payment", percent: 20, dueDate: iso(final) },
  ];
}
