// Attendance & payroll rules (all dates are India time; a day is identified by its "YYYY-MM-DD" key).
import type { Types } from "mongoose";
import { Payroll, SalaryAdvance, Staff } from "../models";
import { APP_TZ, LEAVE_TYPES } from "../constants";
import { round2 } from "../format";

export function dateKey(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function monthKey(d: Date = new Date()) {
  return dateKey(d).slice(0, 7);
}
/** IST wall-clock time on a given day → instant. */
export function istInstant(day: string, hhmm: string) {
  return new Date(`${day}T${hhmm.padStart(5, "0")}:00+05:30`);
}
export function istHHMM(d?: Date | null) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
export function weekday(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
export function isLate(inTime: Date, day: string, officeStart: string, graceMinutes: number) {
  return inTime.getTime() > istInstant(day, officeStart).getTime() + graceMinutes * 60000;
}
const PAID_LEAVE = new Set<string>(LEAVE_TYPES.filter((l) => l.paid).map((l) => l.value));

export type PayrollPolicy = { weeklyOff: number[]; unmarkedAs: "absent" | "present" };
type Rec = { date: string; status: string; leaveType?: string; approval?: string; late?: boolean };

/** Counts the month's attendance for one staff member, up to `upTo` (inclusive). */
export function summarise(month: string, records: Rec[], policy: PayrollPolicy, opts: { upTo: string; joinDate?: Date | null }) {
  const byDay = new Map(records.map((r) => [r.date, r]));
  const joinKey = opts.joinDate ? dateKey(opts.joinDate) : "";
  const s = { workingDays: 0, presentDays: 0, halfDays: 0, paidLeaves: 0, holidays: 0, unpaidDays: 0, unmarkedDays: 0, pendingLeaves: 0, lateDays: 0, elapsedWorkingDays: 0 };
  for (const day of monthDays(month)) {
    const off = policy.weeklyOff.includes(weekday(day));
    if (!off) s.workingDays++;
    if (day > opts.upTo) continue;
    if (!off) s.elapsedWorkingDays++;
    const r = byDay.get(day);
    if (joinKey && day < joinKey) {
      if (!off) s.unpaidDays++; // before joining
      continue;
    }
    if (r?.late) s.lateDays++;
    if (!r) {
      if (off) continue;
      s.unmarkedDays++;
      if (policy.unmarkedAs === "present") s.presentDays++;
      else s.unpaidDays++;
      continue;
    }
    switch (r.status) {
      case "present":
        s.presentDays++;
        break;
      case "half_day":
        s.halfDays++;
        if (!off) s.unpaidDays += 0.5;
        break;
      case "leave":
        if (r.approval === "pending") {
          s.pendingLeaves++;
          if (!off) s.unpaidDays++;
        } else if (r.approval === "rejected" || !PAID_LEAVE.has(r.leaveType ?? "")) {
          if (!off) s.unpaidDays++;
        } else s.paidLeaves++;
        break;
      case "absent":
        if (!off) s.unpaidDays++;
        break;
      case "holiday":
        s.holidays++;
        break;
      default:
        break; // week_off
    }
  }
  return s;
}

export function earnedFor(staff: { salaryType: string; salary: number }, sum: ReturnType<typeof summarise>) {
  if (staff.salaryType === "daily") return round2(staff.salary * (sum.presentDays + sum.halfDays * 0.5));
  if (!sum.workingDays) return round2(staff.salary);
  const perDay = staff.salary / sum.workingDays;
  return round2(Math.max(0, staff.salary - perDay * Math.min(sum.unpaidDays, sum.workingDays)));
}

export function netPay(p: { earned: number; allowances: number; bonus: number; advanceDeduction: number; otherDeduction: number }) {
  return round2(p.earned + p.allowances + p.bonus - p.advanceDeduction - p.otherDeduction);
}

export async function outstandingAdvances(staffId: Types.ObjectId | string) {
  const list = await SalaryAdvance.find({ staff: staffId }).sort({ date: 1, _id: 1 }).lean();
  return { list, total: round2(list.reduce((s, a) => s + Math.max(0, a.amount - (a.recovered ?? 0)), 0)) };
}

/**
 * Creates or refreshes draft payroll rows for a month.
 * Salary is the fixed monthly salary — attendance and leave are recorded but do not change pay.
 * Only monthly-salaried staff are on payroll; daily-wage tour staff are paid on each tour's cost sheet.
 * Paid rows are never touched; bonus and deductions entered by hand are kept.
 */
export async function generatePayroll(month: string, _policy?: PayrollPolicy) {
  void _policy;
  const days = monthDays(month);
  const staff = await Staff.find({ active: true, salaryType: "monthly" }).lean();
  // drafts left over for staff no longer on monthly payroll
  const keep = staff.filter((st) => !(st.joinDate && dateKey(st.joinDate) > days.at(-1)!)).map((s) => s._id);
  await Payroll.deleteMany({ month, status: "draft", staff: { $nin: keep } });
  let created = 0;
  let updated = 0;
  for (const st of staff) {
    if (st.joinDate && dateKey(st.joinDate) > days.at(-1)!) continue; // joins after this month
    const existing = await Payroll.findOne({ staff: st._id, month });
    if (existing?.status === "paid") continue;
    const earned = round2(st.salary);
    const adv = await outstandingAdvances(st._id);
    const extras = { allowances: 0, bonus: existing?.bonus ?? 0, otherDeduction: existing?.otherDeduction ?? 0 };
    const gross = earned + extras.bonus - extras.otherDeduction;
    const wantAdvance = existing ? existing.advanceDeduction : adv.total;
    const advanceDeduction = round2(Math.max(0, Math.min(wantAdvance, adv.total, gross)));
    const counts = { workingDays: 0, presentDays: 0, halfDays: 0, paidLeaves: 0, holidays: 0, unpaidDays: 0, unmarkedDays: 0, pendingLeaves: 0, lateDays: 0 };
    const doc = { staff: st._id, month, salaryType: "monthly", rate: st.salary, ...counts, earned, ...extras, advanceDeduction, net: netPay({ earned, ...extras, advanceDeduction }), isDemo: st.isDemo };
    if (existing) {
      existing.set(doc);
      await existing.save();
      updated++;
    } else {
      await Payroll.create(doc);
      created++;
    }
  }
  return { created, updated, provisional: false };
}

/** Applies a paid payroll's advance deduction to the oldest outstanding advances. */
export async function allocateAdvances(staffId: Types.ObjectId | string, amount: number) {
  const { list } = await outstandingAdvances(staffId);
  let left = round2(amount);
  const allocations: { advance: Types.ObjectId; amount: number }[] = [];
  for (const a of list) {
    if (left <= 0) break;
    const open = round2(a.amount - (a.recovered ?? 0));
    if (open <= 0) continue;
    const take = round2(Math.min(open, left));
    await SalaryAdvance.updateOne({ _id: a._id }, { $inc: { recovered: take } });
    allocations.push({ advance: a._id as Types.ObjectId, amount: take });
    left = round2(left - take);
  }
  return { allocations, unallocated: left };
}
