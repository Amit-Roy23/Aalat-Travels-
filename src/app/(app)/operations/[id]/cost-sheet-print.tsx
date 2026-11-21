"use client";
import { displayPhone, fmtDate, money } from "@/lib/format";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/constants";
import { useMe } from "@/components/session";
import type { Summary, TourDoc } from "./page";
import type { Line } from "./line-modals";

const d = (x?: string | null) => (x ? fmtDate(x, { day: "2-digit", month: "short" }) : "—");
const th = "border border-neutral-300 bg-neutral-100 px-1.5 py-1 text-left font-bold";
const td = "border border-neutral-300 px-1.5 py-1 align-top";
const num = "border border-neutral-300 px-1.5 py-1 text-right tabular-nums align-top";

function Block({ title, head, lines, row }: { title: string; head: string[]; lines: Line[]; row: (l: Line) => React.ReactNode[] }) {
  if (!lines.length) return null;
  const sum = (k: "amount" | "paid" | "due") => lines.reduce((s, l) => s + l[k], 0);
  return (
    <div className="mb-3 break-inside-avoid">
      <p className="mb-1 text-[12px] font-bold uppercase tracking-wide" style={{ color: "#C80E16" }}>{title}</p>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr>
            {head.map((h) => <th key={h} className={th}>{h}</th>)}
            <th className={th + " text-right"}>Total</th>
            <th className={th + " text-right"}>Advance</th>
            <th className={th + " text-right"}>Due</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l._id}>
              {row(l).map((c, i) => <td key={i} className={td}>{c}</td>)}
              <td className={num}>{money(l.amount)}</td>
              <td className={num}>{money(l.paid)}</td>
              <td className={num}>{money(l.due)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={td} colSpan={head.length}>Total</td>
            <td className={num}>{money(sum("amount"))}</td>
            <td className={num}>{money(sum("paid"))}</td>
            <td className={num}>{money(sum("due"))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function CostSheetPrint({ tour, summary: s }: { tour: TourDoc; summary: Summary }) {
  const me = useMe();
  const vn = (l: Line) => (l.vendor && typeof l.vendor === "object" ? l.vendor.name : "");
  const expenses = [...tour.expenses].sort((a, b) => EXPENSE_CATEGORIES.findIndex((c) => c.value === a.category) - EXPENSE_CATEGORIES.findIndex((c) => c.value === b.category));
  return (
    <div className="print-area hidden bg-white p-6 text-black print:block">
      <div className="mb-3 flex items-end justify-between border-b-4 pb-2" style={{ borderColor: "#C80E16" }}>
        <div>
          <p className="text-[18px] font-extrabold" style={{ color: "#C80E16" }}>{me.company?.name ?? "Aalat Travels"}</p>
          <p className="text-[11px]">Tour cost sheet</p>
        </div>
        <div className="text-right text-[11px]">
          <p className="text-[14px] font-bold">{tour.name}</p>
          <p>{fmtDate(tour.startDate)}{tour.endDate ? ` – ${fmtDate(tour.endDate)}` : ""}{tour.destination ? ` · ${tour.destination}` : ""}{tour.pax ? ` · ${tour.pax} pax` : ""}</p>
        </div>
      </div>
      <Block title="Hotels" head={["Hotel", "City / vendor", "Check-in", "Check-out", "Rooms"]} lines={tour.hotels} row={(l) => [l.hotelName, [l.city, vn(l)].filter(Boolean).join(" · "), d(l.checkIn), d(l.checkOut), `${l.rooms || ""} ${l.roomType ?? ""}`]} />
      <Block title="Cars / transport" head={["Car number", "Vehicle", "Driver", "Driver phone", "Dates"]} lines={tour.cars} row={(l) => [l.carNumber, l.vehicleType, l.driverName, l.driverPhone ? displayPhone(l.driverPhone) : "", `${d(l.fromDate)} → ${d(l.toDate)}`]} />
      <Block title="Staff salary" head={["Name", "Role", "Days"]} lines={tour.staff} row={(l) => [l.name, l.role, l.days || ""]} />
      <Block title="Other expenses" head={["Head", "Description", "Date", "Qty"]} lines={expenses} row={(l) => [expenseCategoryLabel(l.category ?? "misc"), l.description, d(l.date), l.quantity ? `${l.quantity} ${l.unit ?? ""}` : ""]} />
      <table className="ml-auto mt-2 w-72 border-collapse text-[11px]">
        <tbody>
          <tr><td className={td}>Total investment</td><td className={num + " font-bold"}>{money(s.cost)}</td></tr>
          <tr><td className={td}>Advance / paid</td><td className={num}>{money(s.paid)}</td></tr>
          <tr><td className={td}>Due to pay</td><td className={num + " font-bold"}>{money(s.due)}</td></tr>
          {s.revenue > 0 && (
            <>
              <tr><td className={td}>Billed to guests</td><td className={num}>{money(s.revenue)}</td></tr>
              <tr><td className={td}>Profit</td><td className={num + " font-bold"}>{money(s.profit)}</td></tr>
            </>
          )}
        </tbody>
      </table>
      <p className="mt-4 text-[9px] text-neutral-500">Printed {fmtDate(new Date())}</p>
    </div>
  );
}
