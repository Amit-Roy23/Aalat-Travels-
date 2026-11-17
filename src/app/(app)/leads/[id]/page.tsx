"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, CalendarClock, CalendarPlus, Check, Mail, MessageCircle, Pencil, Phone, Sparkles, Trash2, UserRoundCheck, MapPin, Users, Wallet, CalendarDays, Megaphone, Languages, ReceiptText } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDate, fmtDateTime, money, timeAgo, waLink } from "@/lib/format";
import { LEAD_STATUSES, languageName, sourceLabel, followUpTypeLabel, TRAVEL_STYLES } from "@/lib/constants";
import { Avatar, Badge, Button, Card, ErrorState, Field, InvoiceStatusBadge, LeadStatusBadge, Modal, PageLoader, Tabs, toneDot, useUi } from "@/components/ui";
import { Timeline, type ActivityItem } from "@/components/bits";
import { FollowUpFormModal, LeadFormModal, useTeam, type FollowUpLike, type LeadLike } from "@/components/forms";
import { useMe } from "@/components/session";
import { CompleteFollowUpModal } from "@/components/complete-followup";

type FU = FollowUpLike & { status: string; outcome?: string; completedAt?: string; autoCreated?: boolean; assignedTo?: { _id: string; name: string; color: string } | null };
type Detail = {
  lead: LeadLike & { _id: string; name: string; status: string; source: string; language?: string; aiSummary?: string; createdAt: string; lastContactAt?: string; customer?: string; assignedTo?: { _id: string; name: string; color: string; email: string } | null; createdBy?: { name: string } };
  activities: ActivityItem[];
  followUps: FU[];
  conversation: { _id: string; aiEnabled: boolean; handoff: boolean; lastMessage: string; lastMessageAt: string; language: string; unread: number } | null;
  customer: { _id: string; name: string } | null;
  invoices: { _id: string; number: string; total: number; balance: number; status: string; issueDate: string }[];
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const team = useTeam();
  const router = useRouter();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<Detail>(`/api/leads/${id}`);
  const [tab, setTab] = useState<"timeline" | "followups">("timeline");
  const [editing, setEditing] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const [fuEdit, setFuEdit] = useState<FU | undefined>();
  const [converting, setConverting] = useState(false);
  const [completeFu, setCompleteFu] = useState<FU | null>(null);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"note" | "call" | "email" | "whatsapp">("note");
  const [posting, setPosting] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const { lead } = data;
  const pendingFus = data.followUps.filter((f) => f.status === "pending");

  const setStatus = async (s: string) => {
    try {
      await api(`/api/leads/${id}`, { method: "PATCH", body: { status: s } });
      toast("Status updated");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const assign = async (uid: string) => {
    try {
      await api(`/api/leads/${id}`, { method: "PATCH", body: { assignedTo: uid || null } });
      toast("Owner updated");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const postNote = async () => {
    if (!note.trim()) return;
    setPosting(true);
    try {
      await api(`/api/leads/${id}/activities`, { body: { type: noteType, message: note } });
      setNote("");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPosting(false);
    }
  };
  const del = async () => {
    if (!(await confirm({ title: "Delete this lead?", message: "The lead, its timeline and follow-ups will be removed permanently.", danger: true, confirmText: "Delete lead" }))) return;
    try {
      await api(`/api/leads/${id}`, { method: "DELETE" });
      toast("Lead deleted");
      router.push("/leads");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const facts = [
    { icon: MapPin, label: "Destination", value: lead.destination || "—" },
    { icon: CalendarDays, label: "Travel date", value: lead.travelDate || "—" },
    { icon: Users, label: "Travellers", value: lead.travellers?.adults ? `${lead.travellers.adults} adult${lead.travellers.adults > 1 ? "s" : ""}${lead.travellers.children ? `, ${lead.travellers.children} child${lead.travellers.children > 1 ? "ren" : ""}` : ""}` : "—" },
    { icon: Wallet, label: "Budget", value: lead.budget ? money(lead.budget) : "—" },
    { icon: Megaphone, label: "Source", value: `${sourceLabel(lead.source)}${lead.campaign ? ` · ${lead.campaign}` : ""}` },
    { icon: Languages, label: "Language", value: languageName(lead.language) },
  ];

  return (
    <div className="animate-fade-up">
      <Link href="/leads" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      <div className="card mb-4 overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar name={lead.name} color={lead.assignedTo?.color ?? "#0E8F80"} size={52} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{lead.name}</h1>
                <LeadStatusBadge status={lead.status} />
              </div>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
                {lead.phone && (
                  <a href={`tel:+${lead.phone}`} className="hover:text-brand">
                    {displayPhone(lead.phone)}
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="hover:text-brand">
                    {lead.email}
                  </a>
                )}
                {lead.city && <span>{lead.city}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {lead.phone && (
              <a href={`tel:+${lead.phone}`}>
                <Button variant="outline" size="sm" icon={<Phone className="h-4 w-4" />}>
                  Call
                </Button>
              </a>
            )}
            {data.conversation ? (
              <Link href={`/inbox?c=${data.conversation._id}`}>
                <Button variant="wa" size="sm" icon={<MessageCircle className="h-4 w-4" />}>
                  WhatsApp chat
                </Button>
              </Link>
            ) : (
              lead.phone && (
                <a href={waLink(lead.phone, `Hi ${lead.name.split(" ")[0]}, this is ${me.user.name} from ${me.company.name}.`)} target="_blank" rel="noreferrer">
                  <Button variant="wa" size="sm" icon={<MessageCircle className="h-4 w-4" />}>
                    WhatsApp
                  </Button>
                </a>
              )
            )}
            <Button variant="outline" size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => (setFuEdit(undefined), setFuOpen(true))}>
              Follow-up
            </Button>
            <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            {lead.status !== "converted" ? (
              <Button size="sm" icon={<UserRoundCheck className="h-4 w-4" />} onClick={() => setConverting(true)}>
                Convert to customer
              </Button>
            ) : (
              data.customer && (
                <Link href={`/customers/${data.customer._id}`}>
                  <Button size="sm" icon={<UserRoundCheck className="h-4 w-4" />}>
                    View customer
                  </Button>
                </Link>
              )
            )}
            {me.user.role === "admin" && (
              <Button variant="ghost" size="icon" onClick={del} aria-label="Delete lead" className="text-coral">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {lead.status !== "converted" && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-line bg-surface-2/50 px-4 py-2.5 sm:px-5">
            <span className="mr-1 self-center text-xs font-semibold text-muted">Status:</span>
            {LEAD_STATUSES.filter((s) => s.value !== "converted").map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition", lead.status === s.value ? "border-ink bg-ink text-surface" : "border-line bg-surface hover:border-ink/40")}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[s.tone])} />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="space-y-4">
          {lead.aiSummary && (
            <div className="rounded-2xl border border-brand/25 bg-brand-soft/60 p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-brand">
                <Sparkles className="h-3.5 w-3.5" /> AI summary
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{lead.aiSummary}</p>
            </div>
          )}
          <Card title="Trip details">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
              {facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                    <f.icon className="h-3.5 w-3.5" />
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 break-words text-sm font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
            {lead.requirements && (
              <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
                <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Requirements</p>
                <p className="whitespace-pre-line">{lead.requirements}</p>
              </div>
            )}
          </Card>
          <Card title="Ownership">
            <div className="space-y-3 text-sm">
              {me.user.role === "admin" ? (
                <Field label="Assigned to">
                  <select className="input" value={lead.assignedTo?._id ?? ""} onChange={(e) => assign(e.target.value)}>
                    <option value="">Unassigned</option>
                    {team.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="flex items-center gap-2">
                  {lead.assignedTo && <Avatar name={lead.assignedTo.name} color={lead.assignedTo.color} size={24} />}
                  {lead.assignedTo?.name ?? "Unassigned"}
                </p>
              )}
              <div className="flex justify-between text-muted">
                <span>Created</span>
                <span className="text-ink">{fmtDateTime(lead.createdAt)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Last contact</span>
                <span className="text-ink">{lead.lastContactAt ? timeAgo(lead.lastContactAt) : "—"}</span>
              </div>
            </div>
          </Card>
          {data.conversation && (
            <Card title="WhatsApp" action={data.conversation.aiEnabled && !data.conversation.handoff ? <Badge tone="brand"><Bot className="h-3 w-3" /> AI on</Badge> : <Badge tone="sun">Agent handling</Badge>}>
              <p className="line-clamp-3 text-sm text-muted">“{data.conversation.lastMessage}”</p>
              <Link href={`/inbox?c=${data.conversation._id}`} className="mt-3 inline-flex text-sm font-semibold text-brand">
                Open conversation →
              </Link>
            </Card>
          )}
          {data.invoices.length > 0 && (
            <Card title="Invoices" padded={false}>
              <ul className="divide-y divide-line">
                {data.invoices.map((i) => (
                  <li key={i._id}>
                    <Link href={`/invoices/${i._id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2">
                      <span className="flex items-center gap-2 font-semibold">
                        <ReceiptText className="h-4 w-4 text-muted" />
                        {i.number}
                      </span>
                      <span className="flex items-center gap-2">
                        {money(i.total)} <InvoiceStatusBadge status={i.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="card min-w-0 p-4 sm:p-5">
          <Tabs
            value={tab}
            onChange={setTab}
            className="mb-4 w-fit"
            items={[
              { value: "timeline", label: "Timeline", count: data.activities.length },
              { value: "followups", label: "Follow-ups", count: pendingFus.length },
            ]}
          />
          {tab === "timeline" ? (
            <>
              <div className="mb-5 rounded-2xl border border-line bg-surface-2/50 p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["note", "Note"],
                      ["call", "Log call"],
                      ["whatsapp", "Log WhatsApp"],
                      ["email", "Log email"],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} onClick={() => setNoteType(v)} className={cn("chip", noteType === v ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink")}>
                      {l}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input min-h-[72px] bg-surface"
                  placeholder={noteType === "call" ? "What did you discuss on the call?" : noteType === "note" ? "Add an internal note…" : "Summary of the conversation…"}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && postNote()}
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={postNote} loading={posting} disabled={!note.trim()}>
                    Save
                  </Button>
                </div>
              </div>
              <Timeline items={data.activities} />
            </>
          ) : (
            <div>
              <div className="mb-3 flex justify-end">
                <Button size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => (setFuEdit(undefined), setFuOpen(true))}>
                  Schedule
                </Button>
              </div>
              {data.followUps.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No follow-ups yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.followUps.map((f) => {
                    const overdue = f.status === "pending" && new Date(f.dueAt) < new Date();
                    return (
                      <li key={f._id} className={cn("flex items-start gap-3 rounded-xl border p-3", f.status === "pending" ? "border-line" : "border-transparent bg-surface-2/60 opacity-75")}>
                        {f.status === "pending" ? (
                          <button onClick={() => setCompleteFu(f)} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent hover:border-leaf hover:text-leaf" aria-label="Complete">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-semibold", f.status !== "pending" && "line-through")}>{f.title}</p>
                          <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 text-xs", overdue ? "font-semibold text-coral" : "text-muted")}>
                            <CalendarClock className="h-3.5 w-3.5" />
                            {fmtDateTime(f.dueAt)} · {followUpTypeLabel(f.type)}
                            {f.autoCreated && (
                              <span className="inline-flex items-center gap-1 text-brand">
                                <Sparkles className="h-3 w-3" /> AI
                              </span>
                            )}
                            {f.assignedTo && <span>· {f.assignedTo.name}</span>}
                          </p>
                          {f.outcome && <p className="mt-1 text-xs text-ink/80">Outcome: {f.outcome}</p>}
                        </div>
                        {f.status === "pending" && (
                          <Button variant="ghost" size="sm" onClick={() => (setFuEdit(f), setFuOpen(true))}>
                            Edit
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <LeadFormModal open={editing} onClose={() => setEditing(false)} lead={lead} onSaved={() => mutate()} />
      <FollowUpFormModal open={fuOpen} onClose={() => setFuOpen(false)} followUp={fuEdit} preset={{ kind: "lead", id: lead._id, name: lead.name }} onSaved={() => (toast(fuEdit ? "Follow-up updated" : "Follow-up scheduled"), mutate(), setTab("followups"))} />
      <ConvertModal open={converting} onClose={() => setConverting(false)} lead={lead} onDone={(cid) => (toast("Converted to customer 🎉"), router.push(`/customers/${cid}`))} />
      <CompleteFollowUpModal fu={completeFu} onClose={() => setCompleteFu(null)} onDone={() => mutate()} leadStatus={lead.status} />
    </div>
  );
}

function ConvertModal({ open, onClose, lead, onDone }: { open: boolean; onClose: () => void; lead: { _id: string; name: string }; onDone: (customerId: string) => void }) {
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ customerId: string }>(`/api/leads/${lead._id}/convert`, { body: { travelStyle: style || undefined } });
      onClose();
      onDone(r.customerId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Convert ${lead.name} to a customer?`} description="A customer profile is created (or linked if one already exists with this phone/email) and the lead is marked Converted." size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={go} loading={busy}>Convert</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral">{err}</p>}
      <Field label="Travel style (optional)">
        <select className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="">—</option>
          {TRAVEL_STYLES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}

