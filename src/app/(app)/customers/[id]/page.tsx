"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, CalendarPlus, Check, Gift, Heart, Hotel, MapPin, MessageCircle, Pencil, Phone, Plus, ReceiptText, Trash2, Utensils, Wallet, Compass, Mail } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDate, fmtDateTime, money, waLink } from "@/lib/format";
import { followUpTypeLabel, sourceLabel } from "@/lib/constants";
import { Avatar, Badge, Button, Card, ErrorState, InvoiceStatusBadge, LeadStatusBadge, PageLoader, Tabs, useUi } from "@/components/ui";
import { Timeline, type ActivityItem } from "@/components/bits";
import { CustomerFormModal, FollowUpFormModal, type CustomerLike } from "@/components/forms";
import { CompleteFollowUpModal } from "@/components/complete-followup";
import { useMe } from "@/components/session";

type Detail = {
  customer: CustomerLike & { _id: string; name: string; createdAt: string; language?: string };
  leads: { _id: string; name: string; status: string; destination: string; travelDate: string; source: string; createdAt: string; travellers: { adults: number; children: number }; assignedTo?: { name: string } }[];
  invoices: { _id: string; number: string; tripTitle: string; issueDate: string; dueDate: string; total: number; balance: number; status: string }[];
  followUps: { _id: string; title: string; type: string; dueAt: string; status: string; outcome?: string; assignedTo?: { name: string } }[];
  activities: ActivityItem[];
  conversation: { _id: string } | null;
  billing: { billed: number; paid: number; balance: number };
};

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const router = useRouter();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<Detail>(`/api/customers/${id}`);
  const [tab, setTab] = useState<"trips" | "invoices" | "followups" | "timeline">("trips");
  const [edit, setEdit] = useState(false);
  const [fu, setFu] = useState(false);
  const [done, setDone] = useState<{ _id: string; title: string } | null>(null);
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const c = data.customer;
  const p = c.preferences ?? {};

  const del = async () => {
    if (!(await confirm({ title: `Delete ${c.name}?`, message: "This removes the customer profile. Linked leads are kept.", danger: true, confirmText: "Delete" }))) return;
    try {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      toast("Customer deleted");
      router.push("/customers");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const prefs = [
    { icon: MapPin, label: "Destinations", value: p.destinations?.join(", ") },
    { icon: Compass, label: "Travel style", value: p.travelStyle },
    { icon: Hotel, label: "Hotel", value: p.hotelCategory },
    { icon: Utensils, label: "Meals", value: p.mealPreference },
    { icon: Wallet, label: "Budget", value: p.budgetRange },
  ];

  return (
    <div className="animate-fade-up">
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>
      <div className="card mb-4 flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3.5">
          <Avatar name={c.name} color="#2563EB" size={56} />
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{c.name}</h1>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
              {c.phone && <a href={`tel:+${c.phone}`} className="hover:text-brand">{displayPhone(c.phone)}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a>}
              {c.city && <span>{c.city}</span>}
            </p>
            {!!c.tags?.length && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <Badge key={t} tone="brand">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.phone && (
            <a href={`tel:+${c.phone}`}>
              <Button variant="outline" size="sm" icon={<Phone className="h-4 w-4" />}>Call</Button>
            </a>
          )}
          {data.conversation ? (
            <Link href={`/inbox?c=${data.conversation._id}`}>
              <Button variant="wa" size="sm" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp chat</Button>
            </Link>
          ) : (
            c.phone && (
              <a href={waLink(c.phone)} target="_blank" rel="noreferrer">
                <Button variant="wa" size="sm" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button>
              </a>
            )
          )}
          <Button variant="outline" size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setFu(true)}>Follow-up</Button>
          <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>Edit</Button>
          <Link href={`/invoices/new?customer=${c._id}`}>
            <Button size="sm" icon={<ReceiptText className="h-4 w-4" />}>New invoice</Button>
          </Link>
          {me.user.role === "admin" && (
            <Button variant="ghost" size="icon" className="text-coral" onClick={del} aria-label="Delete customer">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 min-[440px]:grid-cols-3 min-[440px]:gap-3">
        {[
          ["Total billed", money(data.billing.billed), ""],
          ["Paid", money(data.billing.paid), "text-leaf"],
          ["Outstanding", money(data.billing.balance), data.billing.balance > 0 ? "text-coral" : ""],
        ].map(([l, v, cls]) => (
          <div key={l} className="card flex items-center justify-between gap-2 p-3 min-[440px]:block sm:p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted sm:text-xs">{l}</p>
            <p className={cn("mt-1 font-display text-base font-extrabold sm:text-xl", cls)}>{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <div className="space-y-4">
          <Card title="Travel preferences" action={<button className="text-xs font-semibold text-brand" onClick={() => setEdit(true)}>Edit</button>}>
            <dl className="space-y-3">
              {prefs.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <div>
                    <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
                    <dd className="text-sm font-medium">{f.value || "—"}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {p.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{p.notes}</p>}
          </Card>
          <Card title="Personal">
            <div className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2"><Gift className="h-4 w-4 text-muted" /> Birthday: <b className="font-medium">{c.dob ? fmtDate(c.dob, { day: "numeric", month: "long" }) : "—"}</b></p>
              <p className="flex items-center gap-2"><Heart className="h-4 w-4 text-muted" /> Anniversary: <b className="font-medium">{c.anniversary ? fmtDate(c.anniversary, { day: "numeric", month: "long" }) : "—"}</b></p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" /> {c.address || "No address"}</p>
              {c.gstin && <p className="text-muted">GSTIN: <span className="text-ink">{c.gstin}</span></p>}
              <p className="text-xs text-muted">Customer since {fmtDate(c.createdAt)}</p>
            </div>
          </Card>
        </div>
        <div className="card min-w-0 p-4 sm:p-5">
          <Tabs
            value={tab}
            onChange={setTab}
            className="mb-4"
            items={[
              { value: "trips", label: "Enquiries & trips", count: data.leads.length },
              { value: "invoices", label: "Invoices", count: data.invoices.length },
              { value: "followups", label: "Follow-ups", count: data.followUps.filter((f) => f.status === "pending").length },
              { value: "timeline", label: "History" },
            ]}
          />
          {tab === "trips" &&
            (data.leads.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No enquiries linked.</p>
            ) : (
              <ul className="space-y-2">
                {data.leads.map((l) => (
                  <li key={l._id}>
                    <Link href={`/leads/${l._id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 hover:border-brand/40">
                      <div className="min-w-0">
                        <p className="font-semibold">{l.destination || "General enquiry"}</p>
                        <p className="text-xs text-muted">
                          {[l.travelDate, l.travellers?.adults ? `${l.travellers.adults + (l.travellers.children || 0)} pax` : "", sourceLabel(l.source), fmtDate(l.createdAt)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <LeadStatusBadge status={l.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          {tab === "invoices" && (
            <>
              <div className="mb-3 flex justify-end">
                <Link href={`/invoices/new?customer=${c._id}`}>
                  <Button size="sm" icon={<Plus className="h-4 w-4" />}>New invoice</Button>
                </Link>
              </div>
              {data.invoices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No invoices yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.invoices.map((i) => (
                    <li key={i._id}>
                      <Link href={`/invoices/${i._id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 hover:border-brand/40">
                        <div className="min-w-0">
                          <p className="font-semibold">{i.number}</p>
                          <p className="truncate text-xs text-muted">{i.tripTitle || "—"} · {fmtDate(i.issueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{money(i.total)}</p>
                          <InvoiceStatusBadge status={i.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {tab === "followups" && (
            <>
              <div className="mb-3 flex justify-end">
                <Button size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setFu(true)}>Schedule</Button>
              </div>
              {data.followUps.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No follow-ups.</p>
              ) : (
                <ul className="space-y-2">
                  {data.followUps.map((f) => (
                    <li key={f._id} className={cn("flex items-start gap-3 rounded-xl border border-line p-3", f.status !== "pending" && "opacity-60")}>
                      {f.status === "pending" ? (
                        <button onClick={() => setDone(f)} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent hover:border-leaf hover:text-leaf" aria-label="Complete">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-white"><Check className="h-3.5 w-3.5" /></span>
                      )}
                      <div>
                        <p className={cn("text-sm font-semibold", f.status !== "pending" && "line-through")}>{f.title}</p>
                        <p className={cn("flex items-center gap-1 text-xs", f.status === "pending" && new Date(f.dueAt) < new Date() ? "font-semibold text-coral" : "text-muted")}>
                          <CalendarClock className="h-3.5 w-3.5" /> {fmtDateTime(f.dueAt)} · {followUpTypeLabel(f.type)} {f.assignedTo && `· ${f.assignedTo.name}`}
                        </p>
                        {f.outcome && <p className="mt-1 text-xs">Outcome: {f.outcome}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {tab === "timeline" && <Timeline items={data.activities} />}
        </div>
      </div>
      <CustomerFormModal open={edit} onClose={() => setEdit(false)} customer={c} onSaved={() => mutate()} />
      <FollowUpFormModal open={fu} onClose={() => setFu(false)} preset={{ kind: "customer", id: c._id, name: c.name }} onSaved={() => (toast("Follow-up scheduled"), mutate(), setTab("followups"))} />
      <CompleteFollowUpModal fu={done} onClose={() => setDone(null)} onDone={() => mutate()} />
    </div>
  );
}
