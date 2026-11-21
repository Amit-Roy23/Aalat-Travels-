"use client";
import Link from "next/link";
import { use, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BedDouble, Car, CalendarRange, HandCoins, Link2, MapPin, Pencil, Plus, Printer, ReceiptText, Trash2, UsersRound, Wallet, X } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDate, money } from "@/lib/format";
import { EXPENSE_CATEGORIES, expenseCategoryLabel, TOUR_STATUSES } from "@/lib/constants";
import { Badge, Button, Card, ErrorState, InvoiceStatusBadge, Menu, MenuItem, PageLoader, useUi } from "@/components/ui";
import { useMe } from "@/components/session";
import { TourModal } from "../tour-modal";
import { LineModal, PayModal, type Line, type Section } from "./line-modals";
import { InvoiceLinkModal } from "./invoice-link";
import { CostSheetPrint } from "./cost-sheet-print";

type Bucket = { amount: number; paid: number; due: number; count: number };
export type Summary = { sections: Record<Section, Bucket>; categories: Record<string, Bucket>; cost: number; paid: number; due: number; revenue: number; collected: number; profit: number; margin: number | null };
type Inv = { _id: string; number: string; total: number; amountPaid: number; balance: number; status: string; tripTitle: string; customer?: { name: string; phone: string } | null };
export type TourDoc = { _id: string; name: string; destination: string; startDate: string; endDate?: string | null; pax: number; status: string; notes: string; invoices: Inv[]; hotels: Line[]; cars: Line[]; staff: Line[]; expenses: Line[] };

const nights = (a?: string | null, b?: string | null) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)) : null);
const short = (d?: string | null) => (d ? fmtDate(d, { day: "2-digit", month: "short" }) : "—");

export default function TourPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const router = useRouter();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<{ tour: TourDoc; summary: Summary }>(me.user.role === "admin" ? `/api/tours/${id}` : null);
  const [edit, setEdit] = useState(false);
  const [lineModal, setLineModal] = useState<{ section: Section; line?: Line } | null>(null);
  const [pay, setPay] = useState<{ section: Section; line: Line } | null>(null);
  const [linkInv, setLinkInv] = useState(false);
  if (me.user.role !== "admin") return <ErrorState error={new Error("Only admins can see operations.")} />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const { tour, summary: s } = data;
  const st = TOUR_STATUSES.find((x) => x.value === tour.status)!;
  const set = (d: { tour: TourDoc; summary: Summary }) => mutate(d, { revalidate: false });

  const removeLine = async (section: Section, l: Line) => {
    const fromStore = !!l.stockMovement;
    if (!(await confirm({ title: "Delete this line?", message: fromStore ? "This came from store stock — the quantity goes back into inventory." : l.paid > 0 ? `Its payments (${money(l.paid)}) are removed too.` : undefined, danger: true, confirmText: "Delete" }))) return;
    try {
      set(await api(`/api/tours/${id}/lines/${l._id}?section=${section}`, { method: "DELETE" }));
      toast(fromStore ? "Deleted — stock returned to inventory" : "Line deleted");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const removeTour = async () => {
    if (!(await confirm({ title: `Delete ${tour.name}?`, message: "All hotel, car, staff and expense lines of this tour are deleted. Store stock issued to it goes back to inventory. Invoices are not affected.", danger: true, confirmText: "Delete tour" }))) return;
    try {
      await api(`/api/tours/${id}`, { method: "DELETE" });
      toast("Tour deleted");
      router.push("/operations");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const unlink = async (invId: string) => {
    try {
      set(await api(`/api/tours/${id}`, { method: "PATCH", body: { ...tour, endDate: tour.endDate || null, invoices: tour.invoices.filter((i) => i._id !== invId).map((i) => i._id) } }));
      toast("Invoice unlinked");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const actions = (section: Section, l: Line) => (
    <div className="flex justify-end gap-0.5">
      <button onClick={() => setPay({ section, line: l })} className={cn("rounded-lg p-1.5 hover:bg-surface-2", l.due > 0 ? "text-brand" : "text-muted")} aria-label="Payments" title="Payments">
        <HandCoins className="h-4 w-4" />
      </button>
      {!l.stockMovement && (
        <button onClick={() => setLineModal({ section, line: l })} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Edit" title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <button onClick={() => removeLine(section, l)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Delete" title="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
  const vendorName = (l: Line) => (l.vendor && typeof l.vendor === "object" ? l.vendor.name : "");

  const breakdown = [
    { label: "Hotels", b: s.sections.hotels },
    { label: "Cars / transport", b: s.sections.cars },
    { label: "Staff salary", b: s.sections.staff },
    ...EXPENSE_CATEGORIES.filter((c) => s.categories[c.value]).map((c) => ({ label: c.label, b: s.categories[c.value] })),
  ].filter((x) => x.b.count > 0);
  const max = Math.max(1, ...breakdown.map((x) => x.b.amount));
  const expenses = [...tour.expenses].sort((a, b) => EXPENSE_CATEGORIES.findIndex((c) => c.value === a.category) - EXPENSE_CATEGORIES.findIndex((c) => c.value === b.category));

  return (
    <div className="animate-fade-up">
      <div className="no-print">
        <Link href="/operations" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Operations
        </Link>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">{tour.name}</h1>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-4 w-4" />{fmtDate(tour.startDate)}{tour.endDate && ` – ${fmtDate(tour.endDate)}`}</span>
              {tour.destination && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{tour.destination}</span>}
              {tour.pax > 0 && <span className="inline-flex items-center gap-1.5"><UsersRound className="h-4 w-4" />{tour.pax} guests</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>Edit</Button>
            <Menu trigger={() => <span className="inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface-2">More</span>}>
              {(close) => (
                <>
                  <MenuItem icon={<Link2 className="h-4 w-4" />} onClick={() => { close(); setLinkInv(true); }}>Link an invoice</MenuItem>
                  <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { close(); removeTour(); }}>Delete tour</MenuItem>
                </>
              )}
            </Menu>
          </div>
        </div>

        {/* Totals */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total investment" value={money(s.cost)} foot={`${breakdown.length} heads`} />
          <Stat label="Advance / paid" value={money(s.paid)} tone="text-leaf" foot={s.cost ? `${Math.round((s.paid / s.cost) * 100)}% paid` : "—"} />
          <Stat label="Due to pay" value={money(s.due)} tone={s.due > 0 ? "text-coral" : undefined} foot="Hotels, cars, staff & expenses" />
          <Stat label="Profit" value={s.revenue ? money(s.profit) : "—"} tone={s.revenue ? (s.profit < 0 ? "text-coral" : "text-leaf") : undefined} foot={s.revenue ? `Billed ${money(s.revenue)}${s.margin !== null ? ` · ${s.margin}% margin` : ""}` : "Link the guest invoice to see profit"} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <SectionCard icon={<BedDouble className="h-4 w-4" />} title="Hotels" b={s.sections.hotels} onAdd={() => setLineModal({ section: "hotels" })} empty="No hotel booked yet.">
              <Rows
                lines={tour.hotels}
                cols={[
                  { head: "Hotel", cell: (l) => <><p className="font-semibold">{l.hotelName}</p><p className="text-xs text-muted">{[l.city, vendorName(l)].filter(Boolean).join(" · ") || "—"}</p></> },
                  { head: "Check-in → out", cell: (l) => <><p>{short(l.checkIn)} → {short(l.checkOut)}</p><p className="text-xs text-muted">{nights(l.checkIn, l.checkOut) !== null ? `${nights(l.checkIn, l.checkOut)} night(s)` : ""}</p></> },
                  { head: "Rooms", cell: (l) => <><p>{l.rooms || "—"}{l.roomType ? ` · ${l.roomType}` : ""}</p><p className="text-xs text-muted">{l.mealPlan}</p></> },
                ]}
                actions={(l) => actions("hotels", l)}
              />
            </SectionCard>

            <SectionCard icon={<Car className="h-4 w-4" />} title="Cars / transport" b={s.sections.cars} onAdd={() => setLineModal({ section: "cars" })} empty="No vehicle added yet.">
              <Rows
                lines={tour.cars}
                cols={[
                  { head: "Vehicle", cell: (l) => <><p className="font-semibold">{l.carNumber || "No number yet"}</p><p className="text-xs text-muted">{[l.vehicleType, vendorName(l)].filter(Boolean).join(" · ") || "—"}</p></> },
                  { head: "Driver", cell: (l) => <><p>{l.driverName || "—"}</p>{l.driverPhone ? <a href={`tel:${l.driverPhone}`} className="text-xs font-medium text-brand hover:underline">{displayPhone(l.driverPhone)}</a> : <p className="text-xs text-muted">No number</p>}</> },
                  { head: "Dates", cell: (l) => <p>{short(l.fromDate)} → {short(l.toDate)}</p> },
                ]}
                actions={(l) => actions("cars", l)}
              />
            </SectionCard>

            <SectionCard icon={<UsersRound className="h-4 w-4" />} title="Staff salary (name-wise)" b={s.sections.staff} onAdd={() => setLineModal({ section: "staff" })} empty="No staff added — add tour manager, cook, helpers…">
              <Rows
                lines={tour.staff}
                cols={[
                  { head: "Name", cell: (l) => <><p className="font-semibold">{l.name}</p><p className="text-xs text-muted">{l.role || (l.staff ? "Staff" : "Outside help")}</p></> },
                  { head: "Days", cell: (l) => <p>{l.days || "—"}</p> },
                ]}
                actions={(l) => actions("staff", l)}
                total
              />
            </SectionCard>

            <SectionCard icon={<Wallet className="h-4 w-4" />} title="Other expenses" b={s.sections.expenses} onAdd={() => setLineModal({ section: "expenses" })} empty="Add train tickets, gas, grocery, fresh items, fish / chicken / mutton and more.">
              <Rows
                lines={expenses}
                cols={[
                  { head: "Head", cell: (l) => <><p className="font-semibold">{expenseCategoryLabel(l.category ?? "misc")}</p><p className="text-xs text-muted">{l.description || "—"}{vendorName(l) ? ` · ${vendorName(l)}` : ""}</p></> },
                  { head: "Date / qty", cell: (l) => <><p>{short(l.date)}</p><p className="text-xs text-muted">{l.quantity ? `${l.quantity} ${l.unit ?? ""}` : ""}{l.stockMovement ? " · from store" : ""}</p></> },
                ]}
                actions={(l) => actions("expenses", l)}
                total
              />
            </SectionCard>
          </div>

          <div className="space-y-5">
            <Card title="Where the money goes">
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted">Nothing added yet.</p>
              ) : (
                <ul className="space-y-3">
                  {breakdown.map((x) => (
                    <li key={x.label}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{x.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{money(x.b.amount)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(x.b.amount / max) * 100}%` }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Paid {money(x.b.paid)} · <span className={x.b.due > 0 ? "font-semibold text-coral" : ""}>Due {money(x.b.due)}</span>
                      </p>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between border-t border-line pt-3 text-sm font-bold">
                    <span>Total investment</span>
                    <span className="tabular-nums">{money(s.cost)}</span>
                  </li>
                </ul>
              )}
            </Card>

            <Card title="Guest billing" action={<Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setLinkInv(true)}>Link</Button>}>
              {tour.invoices.length === 0 ? (
                <p className="text-sm text-muted">Link the guest&apos;s invoice to compare billing against cost and see the profit.</p>
              ) : (
                <ul className="space-y-2.5">
                  {tour.invoices.map((i) => (
                    <li key={i._id} className="flex items-start gap-2 rounded-xl bg-surface-2/70 p-2.5">
                      <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      <Link href={`/invoices/${i._id}`} className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold hover:text-brand">{i.number} <InvoiceStatusBadge status={i.status} /></p>
                        <p className="truncate text-xs text-muted">{i.customer?.name}{i.tripTitle ? ` · ${i.tripTitle}` : ""}</p>
                        <p className="text-xs">Billed {money(i.total)} · received {money(i.amountPaid)}</p>
                      </Link>
                      <button onClick={() => unlink(i._id)} className="rounded-lg p-1 text-muted hover:bg-surface hover:text-coral" aria-label={`Unlink ${i.number}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                  <li className="space-y-1 border-t border-line pt-2.5 text-sm">
                    <Kv k="Billed to guests" v={money(s.revenue)} />
                    <Kv k="Received from guests" v={money(s.collected)} />
                    <Kv k="Total investment" v={`− ${money(s.cost)}`} />
                    <Kv k="Profit" v={money(s.profit)} bold tone={s.profit < 0 ? "text-coral" : "text-leaf"} />
                    <Kv k="Cash in hand (received − paid out)" v={money(s.collected - s.paid)} />
                  </li>
                </ul>
              )}
            </Card>
            {tour.notes && (
              <Card title="Notes">
                <p className="whitespace-pre-wrap text-sm text-muted">{tour.notes}</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      <CostSheetPrint tour={tour} summary={s} />
      <TourModal open={edit} onClose={() => setEdit(false)} onSaved={() => mutate()} tour={{ ...tour, invoices: tour.invoices }} />
      <LineModal tourId={id} target={lineModal} onClose={() => setLineModal(null)} onSaved={set} tourStart={tour.startDate} tourEnd={tour.endDate} />
      <PayModal tourId={id} target={pay ? { section: pay.section, line: [...tour[pay.section]].find((l) => l._id === pay.line._id) ?? pay.line } : null} onClose={() => setPay(null)} onSaved={set} />
      <InvoiceLinkModal open={linkInv} onClose={() => setLinkInv(false)} tour={tour} onSaved={set} />
    </div>
  );
}

function Stat({ label, value, foot, tone }: { label: string; value: ReactNode; foot?: ReactNode; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl", tone)}>{value}</p>
      {foot && <p className="mt-0.5 truncate text-[11px] text-muted">{foot}</p>}
    </div>
  );
}
function Kv({ k, v, bold, tone }: { k: string; v: ReactNode; bold?: boolean; tone?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2", bold && "font-bold")}>
      <span className={bold ? "" : "text-muted"}>{k}</span>
      <span className={cn("shrink-0 tabular-nums", tone)}>{v}</span>
    </div>
  );
}

function SectionCard({ icon, title, b, onAdd, empty, children }: { icon: ReactNode; title: string; b: Bucket; onAdd: () => void; empty: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-brand">{icon}</span>
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {b.count > 0 && (
            <p className="hidden text-xs text-muted sm:block">
              {money(b.amount)} · paid {money(b.paid)} · <span className={b.due > 0 ? "font-semibold text-coral" : ""}>due {money(b.due)}</span>
            </p>
          )}
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={onAdd}>Add</Button>
        </div>
      </div>
      {b.count === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p> : children}
    </section>
  );
}

type Col = { head: string; cell: (l: Line) => ReactNode };
function Rows({ lines, cols, actions, total }: { lines: Line[]; cols: Col[]; actions: (l: Line) => ReactNode; total?: boolean }) {
  const sum = (k: "amount" | "paid" | "due") => lines.reduce((x, l) => x + l[k], 0);
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              {cols.map((c) => (
                <th key={c.head} className="px-4 py-2.5">{c.head}</th>
              ))}
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="px-3 py-2.5 text-right">Advance</th>
              <th className="px-3 py-2.5 text-right">Due</th>
              <th className="w-24 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l) => (
              <tr key={l._id} className="align-top hover:bg-surface-2/40">
                {cols.map((c) => (
                  <td key={c.head} className="px-4 py-2.5">{c.cell(l)}</td>
                ))}
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(l.amount)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-leaf">{money(l.paid)}</td>
                <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", l.due > 0 ? "text-coral" : "text-muted")}>{l.due > 0 ? money(l.due) : "Paid"}</td>
                <td className="px-2 py-1.5">{actions(l)}</td>
              </tr>
            ))}
          </tbody>
          {total && lines.length > 1 && (
            <tfoot>
              <tr className="border-t border-line bg-surface-2/50 font-bold">
                <td className="px-4 py-2.5" colSpan={cols.length}>Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(sum("amount"))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-leaf">{money(sum("paid"))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-coral">{money(sum("due"))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/* Phones */}
      <ul className="divide-y divide-line md:hidden">
        {lines.map((l) => (
          <li key={l._id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                {cols.map((c, i) => (
                  <div key={c.head} className={i ? "text-[13px]" : ""}>
                    {i > 0 && <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{c.head}</p>}
                    {c.cell(l)}
                  </div>
                ))}
              </div>
              {actions(l)}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-2 text-sm">
              <div><p className="text-[10px] text-muted">Total</p><p className="font-semibold tabular-nums">{money(l.amount)}</p></div>
              <div><p className="text-[10px] text-muted">Advance</p><p className="font-semibold tabular-nums text-leaf">{money(l.paid)}</p></div>
              <div><p className="text-[10px] text-muted">Due</p><p className={cn("font-semibold tabular-nums", l.due > 0 ? "text-coral" : "text-muted")}>{l.due > 0 ? money(l.due) : "Paid"}</p></div>
            </div>
          </li>
        ))}
        {total && lines.length > 1 && (
          <li className="flex flex-wrap justify-between gap-2 bg-surface-2/50 px-4 py-2.5 text-sm font-bold">
            <span>Total {money(sum("amount"))}</span>
            <span className="text-coral">Due {money(sum("due"))}</span>
          </li>
        )}
      </ul>
    </>
  );
}
