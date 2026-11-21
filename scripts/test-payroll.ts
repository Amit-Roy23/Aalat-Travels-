// Unit tests for attendance → salary rules.  Run: npx tsx scripts/test-payroll.ts
import { earnedFor, netPay, summarise, weekday, monthDays, isLate, istInstant } from "../src/lib/services/staff";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const policy = { weeklyOff: [0], unmarkedAs: "absent" as const };
const M = "2026-10";
const working = monthDays(M).filter((d) => weekday(d) !== 0); // 27 days
eq("Oct 2026 has 27 working days (4 Sundays off)", working.length, 27);

const recs: { date: string; status: string; leaveType?: string; approval?: string; late?: boolean }[] = [];
working.slice(0, 20).forEach((d, i) => recs.push({ date: d, status: "present", late: i < 3 }));
recs.push({ date: working[20], status: "half_day" }, { date: working[21], status: "half_day" });
recs.push({ date: working[22], status: "leave", leaveType: "casual", approval: "approved" });
recs.push({ date: working[23], status: "leave", leaveType: "unpaid", approval: "approved" });
recs.push({ date: working[24], status: "leave", leaveType: "sick", approval: "pending" });
recs.push({ date: working[25], status: "absent" });
// working[26] left unmarked; a Sunday worked (present on week-off) doesn't change monthly pay
recs.push({ date: "2026-10-04", status: "present" });

const s = summarise(M, recs, policy, { upTo: "2026-10-31" });
eq("present days (incl. a worked Sunday)", s.presentDays, 21);
eq("half days", s.halfDays, 2);
eq("paid leaves (approved casual)", s.paidLeaves, 1);
eq("pending leaves", s.pendingLeaves, 1);
eq("unmarked days", s.unmarkedDays, 1);
eq("late days", s.lateDays, 3);
// unpaid = 2×0.5 + unpaid leave 1 + pending 1 + absent 1 + unmarked 1 = 5
eq("unpaid days", s.unpaidDays, 5);
eq("monthly ₹27,000 → ₹22,000 (₹1,000/day × 5 deducted)", earnedFor({ salaryType: "monthly", salary: 27000 }, s), 22000);
eq("daily ₹800 × (21 + 2×0.5) = ₹17,600", earnedFor({ salaryType: "daily", salary: 800 }, s), 17600);
eq("net = earned + allowances + bonus − advance − other", netPay({ earned: 22000, allowances: 1500, bonus: 1000, advanceDeduction: 3000, otherDeduction: 250 }), 21250);

const u = summarise(M, recs, { ...policy, unmarkedAs: "present" }, { upTo: "2026-10-31" });
eq("unmarked counted as present when configured", [u.presentDays, u.unpaidDays], [22, 4]);

const h = summarise(M, [{ date: working[0], status: "holiday" }], policy, { upTo: working[0] });
eq("holiday is paid (no deduction)", [h.holidays, h.unpaidDays], [1, 0]);

// joined on 15 Oct, present every working day after that
const after = working.filter((d) => d >= "2026-10-15");
const j = summarise(M, after.map((d) => ({ date: d, status: "present" })), policy, { upTo: "2026-10-31", joinDate: new Date("2026-10-15T00:00:00+05:30") });
eq("joined mid-month: days before joining unpaid", j.unpaidDays, working.filter((d) => d < "2026-10-15").length);
eq("joined mid-month: pro-rated salary", earnedFor({ salaryType: "monthly", salary: 27000 }, j), Math.round(27000 * after.length / 27 * 100) / 100);

// month not over yet: future days are not counted as absent
const p = summarise(M, working.slice(0, 5).map((d) => ({ date: d, status: "present" })), policy, { upTo: working[4] });
eq("mid-month: future days not deducted", [p.unpaidDays, p.unmarkedDays], [0, 0]);

eq("late after 10:00 + 15 min grace", [isLate(istInstant("2026-10-05", "10:14"), "2026-10-05", "10:00", 15), isLate(istInstant("2026-10-05", "10:16"), "2026-10-05", "10:00", 15)], [false, true]);
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
process.exit(fail ? 1 : 0);
