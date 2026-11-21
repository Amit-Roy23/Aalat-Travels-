// Unit tests for the guest booking register maths.  Run: npx tsx scripts/test-bookings.ts
import { bookingMoney, bookingTotals, parseAmounts } from "../src/lib/bookings";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const p = (...a: number[]) => a.map((amount) => ({ amount }));

eq("parse 10,000+24,000+11,000", parseAmounts("10,000+24,000+11,000"), [10000, 24000, 11000]);
eq("parse ₹ and spaces", parseAmounts(" ₹ 5000 + 7,500 "), [5000, 7500]);
eq("parse empty", parseAmounts(""), []);
eq("parse rejects text", parseAmounts("5000+abc"), null);
eq("parse rejects zero", parseAmounts("5000+0"), null);

const full = bookingMoney({ amount: 45000, payments: p(10000, 24000, 11000) });
eq("full paid package", [full.pkgDue, full.payStatus], [0, "paid"]);
const part = bookingMoney({ amount: 44000, extraAmount: 7000, payments: p(4000, 7000, 9000) });
eq("extra room adds to package", [part.pkg, part.pkgDue, part.payStatus], [51000, 31000, "partial"]);
eq("unpaid", bookingMoney({ amount: 22500 }).payStatus, "unpaid");

const own = bookingMoney({ amount: 1000, payments: p(1000), ticket: { mode: "own", amount: 5000 } });
eq("own ticket charges nothing", [own.ticketCharge, own.due], [0, 0]);
const tk = bookingMoney({ amount: 0, ticket: { mode: "by_us", amount: 21400, payments: p(11800, 9600), status: "booked" } });
eq("ticket paid in two parts", [tk.ticketPaid, tk.ticketDue], [21400, 0]);
const toCancel = bookingMoney({ amount: 0, ticket: { mode: "by_us", amount: 1500, status: "to_cancel" } });
eq("ticket to cancel still due until cancelled", toCancel.ticketDue, 1500);
const refunded = bookingMoney({ amount: 0, ticket: { mode: "by_us", amount: 10000, payments: p(10000), refunded: 10000, status: "cancelled" } });
eq("cancelled & fully refunded ticket nets to zero", [refunded.ticketCharge, refunded.ticketNet, refunded.ticketDue, refunded.billed], [0, 0, 0, 0]);
const kept = bookingMoney({ amount: 0, ticket: { mode: "by_us", amount: 10000, payments: p(10000), refunded: 8500, status: "cancelled" } });
eq("cancellation charge kept is billed & received", [kept.ticketCharge, kept.ticketNet, kept.ticketDue], [1500, 1500, 0]);

const act = bookingMoney({ amount: 0, addOns: [{ name: "Jeep safari", persons: 3, rate: 700 }, { name: "Camel ride", persons: 2, rate: 200 }], addOnPayments: p(2500) });
eq("3 jeep + 2 camel = 2500 paid", [act.addOn, act.addOnDue], [2500, 0]);
const spot = bookingMoney({ amount: 0, addOns: [{ name: "Jeep safari", persons: 3, rate: 900 }], payAtSpot: true });
eq("pay at spot is tracked separately", [spot.addOnDue, spot.dueOnSpot], [2700, 2700]);

const t = bookingTotals([
  { amount: 45000, adults: 2, rooms: 1, payments: p(45000), addOns: [{ name: "Jeep safari", persons: 2, rate: 700 }] },
  { amount: 64500, adults: 3, children: 2, rooms: 2, payments: p(30000), ticket: { mode: "by_us", amount: 7500, payments: p(7500), status: "booked" } },
  { amount: 22500, adults: 1, rooms: 1, payments: p(2500), status: "cancelled" },
]);
eq("totals skip cancelled booking", [t.bookings, t.cancelled, t.adults, t.children, t.rooms], [2, 1, 5, 2, 3]);
eq("totals billed / paid / due", [t.billed, t.paid, t.due], [118400, 82500, 35900]);
eq("activity persons counted", t.activities, { "Jeep safari": 2 });

console.log(`\nPASSED ${pass}  FAILED ${fail}`);
process.exit(fail ? 1 : 0);
