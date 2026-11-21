"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Download, HandCoins, MessageCircle, Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { api } from "@/lib/client";
import { cn, displayPhone, fmtDate, money, toDateInput, waLink } from "@/lib/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants";
import { bookingMoney, parseAmounts, type bookingTotals } from "@/lib/bookings";
import { Badge, Button, Field, Modal, useUi } from "@/components/ui";
import type { Summary, TourDoc } from "./page";

type Pay = { _id: string; amount: number; date: string; method: string; note: string };
export type Booking = {
  _id: string;
  guestName: string;
  phone: string;
  customer?: string | null;
  billNo: string;
  adults: number;
  children: number;
  rooms: number;
  roomType: string;
  amount: number;
  extraAmount: number;
  extraNote: string;
  payments: Pay[];
  ticket: { mode: "none" | "by_us" | "own"; kind: "train" | "flight" | "bus"; details: string; amount: number; payments: Pay[]; refunded: number; status: "pending" | "booked" | "to_cancel" | "cancelled" };
  addOns: { name: string; persons: number; rate: number }[];
  addOnPayments: Pay[];
  payAtSpot: boolean;
  remarks: string;
  status: "confirmed" | "cancelled";
  money: ReturnType<typeof bookingMoney>;
};
export type BookingTotals = ReturnType<typeof bookingTotals>;
type Res = { tour: TourDoc; summary: Summary; bookingTotals: BookingTotals };

const TICKET_STATUS: Record<string, { label: string; tone: "sky" | "leaf" | "coral" | "slate" }> = { pending: { label: "To book", tone: "sky" }, booked: { label: "Booked", tone: "leaf" }, to_cancel: { label: "To cancel", tone: "coral" }, cancelled: { label: "Cancelled", tone: "slate" } };
const KIND = { train: "Train", flight: "Flight", bus: "Bus" };
const ROOM_TYPES = ["Private room", "Sharing", "Triple share", "Solo (own room)", "Solo (sharing)", "Extra bed"];
const joinPays = (l: Pay[]) => (l.length ? l.map((p) => money(p.amount).replace("₹", "")).join(" + ") : "");
const pax = (b: { adults: number; children: number }) => `${b.adults}A${b.children ? ` + ${b.children}C` : ""}`;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "due", label: "Has due" },
  { value: "paid", label: "Fully paid" },
  { value: "tickets", label: "Tickets to cancel" },
  { value: "spot", label: "Pay at spot" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function BookingsPanel({ tour, totals, onSaved }: { tour: TourDoc & { bookings: Booking[]; activities: { name: string; rate: number }[] }; totals: BookingTotals; onSaved: (d: Res) => void }) {
  const { toast, confirm } = useUi();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [edit, setEdit] = useState<Booking | "new" | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [rates, setRates] = useState(false);
  const ql = q.trim().toLowerCase();
  const list = tour.bookings.filter((b) => {
    if (ql && ![b.guestName, b.phone, b.billNo, b.remarks].some((x) => x?.toLowerCase().includes(ql))) return false;
    if (filter === "cancelled") return b.status === "cancelled";
    if (b.status === "cancelled") return filter === "all";
    if (filter === "due") return b.money.due > 0;
    if (filter === "paid") return b.money.due <= 0;
    if (filter === "tickets") return b.ticket.status === "to_cancel";
    if (filter === "spot") return b.payAtSpot && b.money.addOnDue > 0;
    return true;
  });
  const remove = async (b: Booking) => {
    if (!(await confirm({ title: `Delete ${b.guestName}'s booking?`, message: b.money.paid > 0 ? `Payments of ${money(b.money.paid)} recorded on it are deleted too. To keep the record, edit it and mark it Cancelled instead.` : undefined, danger: true, confirmText: "Delete" }))) return;
    try {
      onSaved(await api(`/api/tours/${tour._id}/bookings/${b._id}`, { method: "DELETE" }));
      toast("Booking deleted");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const remind = (b: Booking) => {
    const m = b.money;
    const parts = [m.pkgDue && `package ${money(m.pkgDue)}`, m.ticketDue && `ticket ${money(m.ticketDue)}`, m.addOnDue && `activities ${money(m.addOnDue)}`].filter(Boolean).join(", ");
    return waLink(b.phone, `Namaskar ${b.guestName}, this is a gentle reminder from Aalat Travels for your ${tour.name} trip (${fmtDate(tour.startDate)}). Balance due: ${money(m.due)} (${parts}). Received so far: ${money(m.paid)}. Thank you!`);
  };
  const exportCsv = () => {
    const head = ["Contact No", "Guest", "Bill No", "Adults", "Children", "Rooms", "Room type", "Amount", "Extra", "Advance payments", "Package received", "Package due", "Ticket", "Ticket charge", "Ticket paid", "Ticket refunded", "Ticket due", "Activities", "Activities total", "Activities paid", "Activities due", "Pay at spot", "Total due", "Status", "Remarks"];
    const rows = tour.bookings.map((b) => [
      b.phone ? displayPhone(b.phone) : "",
      b.guestName,
      b.billNo,
      b.adults,
      b.children,
      b.rooms,
      b.roomType,
      b.amount,
      b.extraAmount ? `${b.extraAmount} ${b.extraNote}`.trim() : "",
      b.payments.map((p) => p.amount).join("+"),
      b.money.pkgPaid,
      b.money.due <= 0 && b.status !== "cancelled" ? "FULL PAID" : b.money.pkgDue,
      b.ticket.mode === "own" ? "OWN" : b.ticket.mode === "by_us" ? `${KIND[b.ticket.kind]} ${b.ticket.details} (${TICKET_STATUS[b.ticket.status].label})`.trim() : "",
      b.money.ticketCharge,
      b.money.ticketPaid,
      b.ticket.refunded,
      b.money.ticketDue,
      b.addOns.filter((a) => a.persons).map((a) => `${a.persons} ${a.name}`).join(", "),
      b.money.addOn,
      b.money.addOnPaid,
      b.money.addOnDue,
      b.payAtSpot ? "Yes" : "",
      b.money.due,
      b.status === "cancelled" ? "Cancelled" : b.money.due <= 0 ? "Full paid" : b.money.paid > 0 ? "Part paid" : "Not paid",
      b.remarks,
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${tour.name.replace(/[^\w]+/g, "-")}-bookings.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const t = totals;
  const payTarget = tour.bookings.find((b) => b._id === pay) ?? null;

  return (
    <div className="space-y-4">
      {/* Totals strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Bookings · guests" value={`${t.bookings} · ${t.adults}${t.children ? `+${t.children}` : ""} pax`} foot={`${t.adults} adults${t.children ? `, ${t.children} children` : ""} · ${t.rooms} rooms${t.cancelled ? ` · ${t.cancelled} cancelled` : ""}`} />
        <Tile label="Billed to guests" value={money(t.billed)} foot={`Package ${money(t.pkg)}${t.ticketCharge ? ` · tickets ${money(t.ticketCharge)}` : ""}${t.addOn ? ` · activities ${money(t.addOn)}` : ""}`} />
        <Tile label="Received" value={money(t.paid)} tone="text-leaf" foot={`${t.fullyPaid} of ${t.bookings} fully paid`} />
        <Tile label="Balance due" value={money(t.due)} tone={t.due > 0 ? "text-coral" : undefined} foot={`Package ${money(t.pkgDue)} · tickets ${money(t.ticketDue)} · activities ${money(t.addOnDue)}`} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="chip bg-surface-2 text-ink">Tickets by us: {t.ticketsByUs}</span>
        <span className="chip bg-surface-2 text-ink">Own tickets: {t.ticketsOwn}</span>
        {t.ticketsToCancel > 0 && <span className="chip bg-coral-soft text-coral">Tickets to cancel: {t.ticketsToCancel}</span>}
        {Object.entries(t.activities).map(([k, n]) => (
          <span key={k} className="chip bg-sun-soft text-sun">{k}: {n} persons</span>
        ))}
        {t.dueOnSpot > 0 && <span className="chip bg-sky-soft text-sky">To collect at spot: {money(t.dueOnSpot)}</span>}
        <button onClick={() => setRates(true)} className="chip border border-dashed border-line text-muted hover:text-ink">
          <Settings2 className="h-3.5 w-3.5" /> Activity rates{tour.activities.length ? `: ${tour.activities.map((a) => `${a.name} ${money(a.rate)}`).join(", ")}` : ""}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", filter === f.value ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-ink")}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Name, phone, bill no" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!tour.bookings.length}>Excel</Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Add booking</Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card px-4 py-10 text-center text-sm text-muted">{tour.bookings.length ? "No bookings match." : "No guests booked on this departure yet. Add each family's booking with their advance, ticket and jeep / camel details."}</div>
      ) : (
        <>
          {/* Wide screens: register table */}
          <div className="card hidden overflow-x-auto xl:block">
            <table className="w-full text-[13px]">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2.5">Guest</th>
                  <th className="px-3 py-2.5">Pax · rooms</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Advance payments</th>
                  <th className="px-3 py-2.5">Ticket</th>
                  <th className="px-3 py-2.5">Jeep / camel etc.</th>
                  <th className="px-3 py-2.5 text-right">Due</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((b) => (
                  <tr key={b._id} className={cn("align-top", rowTone(b))}>
                    <td className="max-w-[190px] px-3 py-2.5" style={stripe(b)}>
                      <p className="truncate font-semibold">{b.guestName}</p>
                      {b.phone && <a href={`tel:+${b.phone}`} className="block text-xs text-brand hover:underline">{displayPhone(b.phone)}</a>}
                      <p className="text-xs text-muted">{b.billNo ? `Bill ${b.billNo}` : "No bill no."}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{pax(b)}</p>
                      <p className="text-xs text-muted">{b.rooms} room{b.rooms === 1 ? "" : "s"}{b.roomType ? ` · ${b.roomType}` : ""}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <p className="font-semibold">{money(b.amount)}</p>
                      {b.extraAmount > 0 && <p className="text-xs text-muted">+ {money(b.extraAmount)} {b.extraNote}</p>}
                    </td>
                    <td className="max-w-[210px] px-3 py-2.5">
                      <p className="tabular-nums">{joinPays(b.payments) || <span className="text-muted">—</span>}</p>
                      <p className={cn("text-xs font-semibold", b.money.pkgDue > 0 ? "text-coral" : "text-leaf")}>{b.status === "cancelled" ? "" : b.money.pkgDue > 0 ? `Due ${money(b.money.pkgDue)}` : "Full paid"}</p>
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5"><TicketCell b={b} /></td>
                    <td className="max-w-[190px] px-3 py-2.5"><AddOnCell b={b} /></td>
                    <td className="px-3 py-2.5 text-right">
                      {b.status === "cancelled" ? <Badge tone="slate">Cancelled</Badge> : b.money.due > 0 ? <p className="font-bold tabular-nums text-coral">{money(b.money.due)}</p> : <Badge tone="leaf">Full paid</Badge>}
                      {b.remarks && <p className="mt-1 max-w-[160px] text-left text-[11px] text-muted">{b.remarks}</p>}
                    </td>
                    <td className="px-2 py-2"><Actions b={b} onPay={() => setPay(b._id)} onEdit={() => setEdit(b)} onDelete={() => remove(b)} remind={remind} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-surface-2/60 text-[13px] font-bold">
                  <td className="px-3 py-2.5">{t.bookings} bookings</td>
                  <td className="px-3 py-2.5">{t.adults}A{t.children ? ` + ${t.children}C` : ""} · {t.rooms} rooms</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(t.pkg)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-leaf">{money(t.pkgPaid)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{t.ticketCharge ? `${money(t.ticketNet)} / ${money(t.ticketCharge)}` : "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums">{t.addOn ? `${money(t.addOnPaid)} / ${money(t.addOn)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-coral">{money(t.due)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Phones & tablets: cards */}
          <div className="grid gap-3 md:grid-cols-2 xl:hidden">
            {list.map((b) => (
              <div key={b._id} className={cn("card p-4", rowTone(b))} style={stripe(b)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.guestName}</p>
                    <p className="text-xs text-muted">
                      {b.phone && <a href={`tel:+${b.phone}`} className="text-brand">{displayPhone(b.phone)}</a>}
                      {b.billNo && ` · Bill ${b.billNo}`}
                    </p>
                    <p className="text-xs text-muted">{pax(b)} · {b.rooms} room{b.rooms === 1 ? "" : "s"}{b.roomType ? ` · ${b.roomType}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {b.status === "cancelled" ? <Badge tone="slate">Cancelled</Badge> : b.money.due > 0 ? <><p className="text-[10px] text-muted">Due</p><p className="font-bold tabular-nums text-coral">{money(b.money.due)}</p></> : <Badge tone="leaf">Full paid</Badge>}
                  </div>
                </div>
                <div className="mt-3 space-y-2 rounded-xl bg-surface/60 p-2.5 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">Package</span>
                    <span className="text-right tabular-nums">
                      {money(b.money.pkg)} · paid {joinPays(b.payments) || "0"}
                      {b.money.pkgDue > 0 && <span className="font-semibold text-coral"> · due {money(b.money.pkgDue)}</span>}
                    </span>
                  </div>
                  {b.ticket.mode !== "none" && <div className="flex justify-between gap-2"><span className="text-muted">Ticket</span><div className="text-right"><TicketCell b={b} /></div></div>}
                  {b.addOns.some((a) => a.persons) && <div className="flex justify-between gap-2"><span className="text-muted">Activities</span><div className="text-right"><AddOnCell b={b} /></div></div>}
                  {b.remarks && <p className="text-xs text-muted">{b.remarks}</p>}
                </div>
                <div className="mt-2 flex justify-end"><Actions b={b} onPay={() => setPay(b._id)} onEdit={() => setEdit(b)} onDelete={() => remove(b)} remind={remind} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <BookingModal tour={tour} booking={edit} onClose={() => setEdit(null)} onSaved={onSaved} />
      <BookingPayModal tourId={tour._id} booking={payTarget} onClose={() => setPay(null)} onSaved={onSaved} />
      <RatesModal open={rates} onClose={() => setRates(false)} tourId={tour._id} activities={tour.activities} onSaved={onSaved} />
    </div>
  );
}

function rowTone(b: Booking) {
  return b.status === "cancelled" ? "opacity-55" : "";
}
/** Coloured stripe like the office sheet: green = full paid, amber = part paid, red = nothing paid. */
function stripe(b: Booking): CSSProperties | undefined {
  if (b.status === "cancelled") return undefined;
  const c = b.money.due <= 0 ? "--leaf" : b.money.paid > 0 ? "--sun" : "--coral";
  return { boxShadow: `inset 4px 0 0 rgb(var(${c}))` };
}
function Tile({ label, value, foot, tone }: { label: string; value: string; foot?: string; tone?: string }) {
  return (
    <div className="card p-3.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cn("mt-0.5 text-lg font-extrabold tabular-nums tracking-tight sm:text-xl", tone)}>{value}</p>
      {foot && <p className="mt-0.5 text-[11px] leading-snug text-muted">{foot}</p>}
    </div>
  );
}
function TicketCell({ b }: { b: Booking }) {
  const tk = b.ticket;
  if (tk.mode === "none") return <span className="text-muted">—</span>;
  if (tk.mode === "own") return <Badge tone="slate">Own ticket</Badge>;
  const st = TICKET_STATUS[tk.status];
  return (
    <div className="text-[13px]">
      <p className="flex flex-wrap items-center justify-end gap-1 xl:justify-start">
        <span className="font-medium">{KIND[tk.kind]}{tk.details ? ` · ${tk.details}` : ""}</span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </p>
      <p className="text-xs tabular-nums text-muted">
        {money(tk.amount)} · paid {joinPays(tk.payments) || "0"}
        {tk.refunded > 0 && <span className="text-sky"> · refunded {money(tk.refunded)}</span>}
      </p>
      {b.money.ticketDue > 0 && <p className="text-xs font-semibold text-coral">Due {money(b.money.ticketDue)}</p>}
    </div>
  );
}
function AddOnCell({ b }: { b: Booking }) {
  const used = b.addOns.filter((a) => a.persons);
  if (!used.length) return <span className="text-muted">—</span>;
  return (
    <div className="text-[13px]">
      <p className="font-medium">{used.map((a) => `${a.name} × ${a.persons}`).join(", ")}</p>
      <p className="text-xs tabular-nums text-muted">
        {money(b.money.addOn)} · paid {money(b.money.addOnPaid)}
      </p>
      {b.money.addOnDue > 0 && <p className={cn("text-xs font-semibold", b.payAtSpot ? "text-sky" : "text-coral")}>{b.payAtSpot ? `Pay at spot ${money(b.money.addOnDue)}` : `Due ${money(b.money.addOnDue)}`}</p>}
    </div>
  );
}
function Actions({ b, onPay, onEdit, onDelete, remind }: { b: Booking; onPay: () => void; onEdit: () => void; onDelete: () => void; remind: (b: Booking) => string }) {
  return (
    <div className="flex justify-end gap-0.5">
      {b.status !== "cancelled" && (
        <button onClick={onPay} className={cn("rounded-lg p-1.5 hover:bg-surface-2", b.money.due > 0 ? "text-brand" : "text-muted")} aria-label="Payments" title="Payments">
          <HandCoins className="h-4 w-4" />
        </button>
      )}
      {b.phone && b.money.due > 0 && b.status !== "cancelled" && (
        <a href={remind(b)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-[#1a9e4f] hover:bg-surface-2" aria-label="WhatsApp due reminder" title="WhatsApp due reminder">
          <MessageCircle className="h-4 w-4" />
        </a>
      )}
      <button onClick={onEdit} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Edit" title="Edit"><Pencil className="h-4 w-4" /></button>
      <button onClick={onDelete} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Delete" title="Delete"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

/* ───────── Add / edit booking ───────── */
type F = {
  guestName: string; phone: string; billNo: string; adults: string; children: string; rooms: string; roomType: string; amount: string; extraAmount: string; extraNote: string;
  advance: string; payDate: string; payMethod: string;
  tMode: "none" | "by_us" | "own"; tKind: "train" | "flight" | "bus"; tDetails: string; tAmount: string; tPaid: string; tRefunded: string; tStatus: string;
  addOns: { name: string; persons: string; rate: string }[]; addOnPaid: string; payAtSpot: boolean; remarks: string; status: "confirmed" | "cancelled";
};

function BookingModal({ tour, booking, onClose, onSaved }: { tour: { _id: string; activities: { name: string; rate: number }[] }; booking: Booking | "new" | null; onClose: () => void; onSaved: (d: Res) => void }) {
  const { toast } = useUi();
  const [f, setF] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!booking) return setF(null);
    setErr("");
    const b = booking === "new" ? null : booking;
    const names = [...tour.activities.map((a) => a.name), ...(b?.addOns ?? []).map((a) => a.name)].filter((n, i, arr) => arr.indexOf(n) === i);
    setF({
      guestName: b?.guestName ?? "", phone: b?.phone ? displayPhone(b.phone) : "", billNo: b?.billNo ?? "", adults: String(b?.adults ?? 2), children: String(b?.children ?? 0), rooms: String(b?.rooms ?? 1), roomType: b?.roomType ?? "",
      amount: b ? String(b.amount) : "", extraAmount: b?.extraAmount ? String(b.extraAmount) : "", extraNote: b?.extraNote ?? "",
      advance: "", payDate: toDateInput(new Date()), payMethod: "upi",
      tMode: b?.ticket.mode ?? "none", tKind: b?.ticket.kind ?? "train", tDetails: b?.ticket.details ?? "", tAmount: b?.ticket.amount ? String(b.ticket.amount) : "", tPaid: "", tRefunded: b?.ticket.refunded ? String(b.ticket.refunded) : "", tStatus: b?.ticket.status ?? "pending",
      addOns: names.map((n) => {
        const own = b?.addOns.find((a) => a.name === n);
        const rate = own?.rate ?? tour.activities.find((a) => a.name === n)?.rate ?? 0;
        return { name: n, persons: own?.persons ? String(own.persons) : "", rate: String(rate) };
      }),
      addOnPaid: "", payAtSpot: b?.payAtSpot ?? false, remarks: b?.remarks ?? "", status: b?.status ?? "confirmed",
    });
  }, [booking, tour.activities]);
  const addOnTotal = useMemo(() => (f ? f.addOns.reduce((s, a) => s + (Number(a.persons) || 0) * (Number(a.rate) || 0), 0) : 0), [f]);
  if (!booking || !f) return null;
  const isNew = booking === "new";
  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value } as F);
  const advList = parseAmounts(f.advance);
  const tPaidList = parseAmounts(f.tPaid);
  const aPaidList = parseAmounts(f.addOnPaid);
  const sumOf = (l: number[] | null) => (l ?? []).reduce((s, n) => s + n, 0);
  const pkg = (Number(f.amount) || 0) + (Number(f.extraAmount) || 0);

  const save = async () => {
    setErr("");
    if (f.guestName.trim().length < 2) return setErr("Enter the guest's name.");
    if (f.amount === "" || !(Number(f.amount) >= 0)) return setErr("Enter the package amount.");
    if (!advList || !tPaidList || !aPaidList) return setErr("Write received amounts as numbers, e.g. 10000+24000+11000.");
    if (sumOf(advList) > pkg) return setErr(`Advance (${money(sumOf(advList))}) is more than the package amount (${money(pkg)}).`);
    if (f.tMode === "by_us" && sumOf(tPaidList) > (Number(f.tAmount) || 0)) return setErr("Ticket money received is more than the ticket charge.");
    if (sumOf(aPaidList) > addOnTotal) return setErr("Activity money received is more than the activities total.");
    setBusy(true);
    try {
      const pays = (l: number[], note: string) => l.map((amount, i) => ({ amount, date: f.payDate, method: f.payMethod, note: l.length > 1 ? `${note} ${i + 1}` : note }));
      const body = {
        guestName: f.guestName, phone: f.phone, billNo: f.billNo, adults: Number(f.adults) || 0, children: Number(f.children) || 0, rooms: Number(f.rooms) || 0, roomType: f.roomType,
        amount: Number(f.amount) || 0, extraAmount: Number(f.extraAmount) || 0, extraNote: f.extraNote,
        ticket: { mode: f.tMode, kind: f.tKind, details: f.tDetails, amount: f.tMode === "by_us" ? Number(f.tAmount) || 0 : 0, refunded: Number(f.tRefunded) || 0, status: f.tStatus },
        addOns: f.addOns.filter((a) => Number(a.persons) > 0).map((a) => ({ name: a.name, persons: Number(a.persons), rate: Number(a.rate) || 0 })),
        payAtSpot: f.payAtSpot, remarks: f.remarks, status: f.status,
        ...(isNew ? { initial: { package: pays(advList, "Advance"), ticket: f.tMode === "by_us" ? pays(tPaidList, "Ticket") : [], addOn: pays(aPaidList, "Activities") } } : {}),
      };
      onSaved(isNew ? await api(`/api/tours/${tour._id}/bookings`, { body }) : await api(`/api/tours/${tour._id}/bookings/${booking._id}`, { method: "PATCH", body }));
      toast(isNew ? "Booking added" : "Booking saved");
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const plusHint = (l: number[] | null) => (l && l.length > 1 ? `= ${money(sumOf(l))} in ${l.length} payments` : "Several payments? Write 10000+24000+11000");
  return (
    <Modal open onClose={onClose} size="xl" title={isNew ? "Add booking" : `Edit booking · ${f.guestName}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{isNew ? "Add booking" : "Save"}</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="space-y-5">
        <Group title="Guest">
          <Field label="Guest name" required><input className="input" value={f.guestName} onChange={set("guestName")} autoFocus /></Field>
          <Field label="Contact no." hint="Matched to the customer in CRM"><input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
          <Field label="Bill no."><input className="input" value={f.billNo} onChange={set("billNo")} placeholder="e.g. 1485 or Digital" /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Adults"><input className="input" type="number" min={0} value={f.adults} onChange={set("adults")} /></Field>
            <Field label="Children"><input className="input" type="number" min={0} value={f.children} onChange={set("children")} /></Field>
            <Field label="Rooms"><input className="input" type="number" min={0} value={f.rooms} onChange={set("rooms")} /></Field>
          </div>
          <Field label="Room type">
            <input className="input" list="room-types" value={f.roomType} onChange={set("roomType")} placeholder="Sharing, triple share, solo…" />
            <datalist id="room-types">{ROOM_TYPES.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
          {!isNew && (
            <Field label="Booking status">
              <select className="input" value={f.status} onChange={set("status")}>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled (kept for records, left out of totals)</option>
              </select>
            </Field>
          )}
        </Group>

        <Group title="Package payment">
          <Field label="Package amount (₹)" required><input className="input font-semibold" type="number" min={0} value={f.amount} onChange={set("amount")} /></Field>
          <div className="grid grid-cols-[1fr_1.3fr] gap-2">
            <Field label="Extra (₹)"><input className="input" type="number" min={0} value={f.extraAmount} onChange={set("extraAmount")} /></Field>
            <Field label="Extra for"><input className="input" value={f.extraNote} onChange={set("extraNote")} placeholder="e.g. Extra room" /></Field>
          </div>
          {isNew ? (
            <>
              <Field label="Advance received (₹)" hint={advList ? `${plusHint(advList)}${pkg ? ` · due ${money(Math.max(0, pkg - sumOf(advList)))}` : ""}` : "Use numbers and + only"} error={advList ? undefined : "Invalid amount"}>
                <input className="input" value={f.advance} onChange={set("advance")} placeholder="10000+24000+11000" inputMode="decimal" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Received on"><input className="input" type="date" value={f.payDate} onChange={set("payDate")} /></Field>
                <Field label="Mode">
                  <select className="input" value={f.payMethod} onChange={set("payMethod")}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                </Field>
              </div>
            </>
          ) : (
            <p className="self-end pb-2 text-sm text-muted sm:col-span-2">Received {money(booking.money.pkgPaid)} ({joinPays(booking.payments) || "nothing yet"}). Use the payments button to add or remove instalments.</p>
          )}
        </Group>

        <Group title="Train / flight ticket">
          <div className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {([["none", "No ticket"], ["by_us", "Ticket booked by us"], ["own", "Own ticket (guest books)"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setF({ ...f, tMode: v })} className={cn("rounded-xl border px-3 py-2 text-sm font-semibold", f.tMode === v ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink")}>{l}</button>
              ))}
            </div>
          </div>
          {f.tMode === "by_us" && (
            <>
              <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
                <Field label="Type">
                  <select className="input" value={f.tKind} onChange={set("tKind")}><option value="train">Train</option><option value="flight">Flight</option><option value="bus">Bus</option></select>
                </Field>
                <Field label="Details"><input className="input" value={f.tDetails} onChange={set("tDetails")} placeholder="e.g. AC Duranta, 3AC" /></Field>
              </div>
              <Field label="Ticket charge (₹)"><input className="input" type="number" min={0} value={f.tAmount} onChange={set("tAmount")} /></Field>
              {isNew ? (
                <Field label="Ticket money received (₹)" hint={tPaidList ? plusHint(tPaidList) : undefined} error={tPaidList ? undefined : "Invalid amount"}>
                  <input className="input" value={f.tPaid} onChange={set("tPaid")} placeholder="11800+9600" inputMode="decimal" />
                </Field>
              ) : (
                <Field label="Refunded to guest (₹)" hint={`Received ${money(booking.money.ticketPaid)} for the ticket`}>
                  <input className="input" type="number" min={0} value={f.tRefunded} onChange={set("tRefunded")} />
                </Field>
              )}
              <Field label="Ticket status">
                <select className="input" value={f.tStatus} onChange={set("tStatus")}>
                  {Object.entries(TICKET_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </Field>
            </>
          )}
        </Group>

        <Group title="Jeep / camel & other activities">
          {f.addOns.length === 0 ? (
            <p className="text-sm text-muted sm:col-span-2">No activities on this tour. Set them with the “Activity rates” button (e.g. Jeep safari ₹700, Camel ride ₹200 per person).</p>
          ) : (
            <div className="space-y-2 sm:col-span-2">
              {f.addOns.map((a, i) => (
                <div key={a.name} className="grid grid-cols-[1fr_80px_100px] items-end gap-2 sm:grid-cols-[1fr_110px_130px_110px]">
                  <p className="pb-2.5 text-sm font-semibold">{a.name}</p>
                  <Field label="Persons"><input className="input" type="number" min={0} value={a.persons} onChange={(e) => setF({ ...f, addOns: f.addOns.map((x, j) => (j === i ? { ...x, persons: e.target.value } : x)) })} /></Field>
                  <Field label="Rate (₹)"><input className="input" type="number" min={0} value={a.rate} onChange={(e) => setF({ ...f, addOns: f.addOns.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)) })} /></Field>
                  <p className="hidden pb-2.5 text-right text-sm tabular-nums sm:block">{money((Number(a.persons) || 0) * (Number(a.rate) || 0))}</p>
                </div>
              ))}
              <p className="text-right text-sm font-semibold">Activities total {money(addOnTotal)}</p>
            </div>
          )}
          {f.addOns.length > 0 && (
            <>
              {isNew ? (
                <Field label="Activity money received (₹)" hint={aPaidList ? plusHint(aPaidList) : undefined} error={aPaidList ? undefined : "Invalid amount"}>
                  <input className="input" value={f.addOnPaid} onChange={set("addOnPaid")} placeholder="e.g. 2500" inputMode="decimal" />
                </Field>
              ) : (
                <p className="self-end pb-2 text-sm text-muted">Received {money(booking.money.addOnPaid)} for activities.</p>
              )}
              <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={f.payAtSpot} onChange={(e) => setF({ ...f, payAtSpot: e.target.checked })} />
                Guest will pay the balance at the spot
              </label>
            </>
          )}
        </Group>

        <Field label="Remarks"><textarea className="input" rows={2} value={f.remarks} onChange={set("remarks")} placeholder="e.g. Will pay balance on 15th Oct · 20K for flight ticket" /></Field>
      </div>
    </Modal>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/* ───────── Payments for a booking ───────── */
const KINDS = [
  { value: "package", label: "Package" },
  { value: "ticket", label: "Ticket" },
  { value: "addOn", label: "Activities" },
] as const;
function BookingPayModal({ tourId, booking, onClose, onSaved }: { tourId: string; booking: Booking | null; onClose: () => void; onSaved: (d: Res) => void }) {
  const { toast, confirm } = useUi();
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("package");
  const [f, setF] = useState({ amount: "", date: toDateInput(new Date()), method: "upi", note: "" });
  const [busy, setBusy] = useState(false);
  const id = booking?._id;
  const dueOf = (b: Booking, k: string) => (k === "package" ? b.money.pkgDue : k === "ticket" ? b.money.ticketDue : b.money.addOnDue);
  useEffect(() => {
    if (!booking) return;
    const first = KINDS.find((k) => dueOf(booking, k.value) > 0)?.value ?? "package";
    setKind(first);
    setF({ amount: dueOf(booking, first) ? String(dueOf(booking, first)) : "", date: toDateInput(new Date()), method: "upi", note: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!booking) return null;
  const b = booking;
  const kinds = KINDS.filter((k) => k.value === "package" || (k.value === "ticket" ? b.ticket.mode === "by_us" : b.addOns.some((a) => a.persons)));
  const list = kind === "package" ? b.payments : kind === "ticket" ? b.ticket.payments : b.addOnPayments;
  const total = kind === "package" ? b.money.pkg : kind === "ticket" ? b.money.ticketCharge : b.money.addOn;
  const due = dueOf(b, kind);
  const pick = (k: typeof kind) => {
    setKind(k);
    setF((p) => ({ ...p, amount: dueOf(b, k) ? String(dueOf(b, k)) : "" }));
  };
  const add = async () => {
    const amt = Number(f.amount);
    if (!(amt > 0)) return toast("Enter an amount", "error");
    if (amt > due + 0.001) return toast(`Only ${money(due)} is due`, "error");
    setBusy(true);
    try {
      onSaved(await api(`/api/tours/${tourId}/bookings/${b._id}/payments`, { body: { ...f, amount: amt, kind } }));
      toast("Payment recorded");
      setF((p) => ({ ...p, amount: "", note: "" }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (pid: string) => {
    if (!(await confirm({ title: "Remove this payment?", danger: true, confirmText: "Remove" }))) return;
    try {
      onSaved(await api(`/api/tours/${tourId}/bookings/${b._id}/payments?kind=${kind}&payment=${pid}`, { method: "DELETE" }));
      toast("Payment removed");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Modal open onClose={onClose} title={`Payments · ${b.guestName}`} description={`Total due ${money(b.money.due)} · received ${money(b.money.paid)}`} footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="mb-4 flex rounded-xl bg-surface-2 p-1">
        {kinds.map((k) => (
          <button key={k.value} onClick={() => pick(k.value)} className={cn("flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold", kind === k.value ? "bg-surface text-ink shadow-card" : "text-muted")}>
            {k.label}
            {dueOf(b, k.value) > 0 && <span className="ml-1 text-coral">•</span>}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-3 text-sm">
        <div><p className="text-[11px] text-muted">Total</p><p className="font-bold tabular-nums">{money(total)}</p></div>
        <div><p className="text-[11px] text-muted">Received{kind === "ticket" && b.ticket.refunded ? " (net)" : ""}</p><p className="font-bold tabular-nums text-leaf">{money(kind === "package" ? b.money.pkgPaid : kind === "ticket" ? b.money.ticketNet : b.money.addOnPaid)}</p></div>
        <div><p className="text-[11px] text-muted">Due</p><p className={cn("font-bold tabular-nums", due > 0 ? "text-coral" : "text-muted")}>{money(due)}</p></div>
      </div>
      {list.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
          {list.map((p) => (
            <li key={p._id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold tabular-nums">{money(p.amount)} <span className="font-normal text-muted">· {paymentMethodLabel(p.method)}</span></p>
                <p className="truncate text-xs text-muted">{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""}</p>
              </div>
              <button onClick={() => remove(p._id)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove payment"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {due > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (₹)"><input className="input" type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Mode">
            <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          </Field>
          <Field label="Note"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <Button className="sm:col-span-2" onClick={add} loading={busy}>Record payment</Button>
        </div>
      ) : (
        <p className="rounded-xl bg-leaf-soft px-3 py-2 text-center text-sm font-semibold text-leaf">{total > 0 ? "Fully paid" : "Nothing charged here"}</p>
      )}
    </Modal>
  );
}

/* ───────── Activity price list ───────── */
function RatesModal({ open, onClose, tourId, activities, onSaved }: { open: boolean; onClose: () => void; tourId: string; activities: { name: string; rate: number }[]; onSaved: (d: Res) => void }) {
  const { toast } = useUi();
  const [rows, setRows] = useState<{ name: string; rate: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setRows(activities.length ? activities.map((a) => ({ name: a.name, rate: String(a.rate) })) : [{ name: "Jeep safari", rate: "700" }, { name: "Camel ride", rate: "200" }]);
  }, [open, activities]);
  if (!open) return null;
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await api(`/api/tours/${tourId}/activities`, { method: "PUT", body: { activities: rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), rate: Number(r.rate) || 0 })) } }));
      toast("Activity rates saved");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Activity rates" description="Per-person prices for optional activities on this tour. Existing bookings keep the rate they were booked at." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_36px] items-center gap-2">
            <input className="input" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Activity" aria-label="Activity" />
            <input className="input" type="number" min={0} value={r.rate} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} aria-label="Rate per person" />
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setRows([...rows, { name: "", rate: "" }])}>Add activity</Button>
      </div>
    </Modal>
  );
}
