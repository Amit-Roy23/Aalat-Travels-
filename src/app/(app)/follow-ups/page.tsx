"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, CalendarClock, CalendarPlus, Check, Mail, MessageCircle, MoreHorizontal, Phone, Sparkles, Trash2, Users, Pencil, AlarmClockPlus, RotateCcw } from "lucide-react";
import { api, qs, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDate, fmtTime, waLink, timeAgo } from "@/lib/format";
import { FOLLOWUP_TYPES, followUpTypeLabel } from "@/lib/constants";
import { Avatar, Button, EmptyState, ErrorState, LeadStatusBadge, Menu, MenuItem, PageHeader, Pagination, Skeleton, Tabs, useUi } from "@/components/ui";
import { FollowUpFormModal, useTeam, type FollowUpLike } from "@/components/forms";
import { CompleteFollowUpModal } from "@/components/complete-followup";
import { useMe } from "@/components/session";

type Item = FollowUpLike & {
  status: string;
  outcome?: string;
  completedAt?: string;
  autoCreated?: boolean;
  lead?: { _id: string; name: string; phone: string; status: string; destination: string };
  customer?: { _id: string; name: string; phone: string };
  assignedTo?: { _id: string; name: string; color: string } | null;
};
type Res = { items: Item[]; total: number; page: number; pages: number; counts: Record<string, number> };
type Bucket = "overdue" | "today" | "upcoming" | "completed";

const TYPE_ICON = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users } as Record<string, typeof Phone>;

export default function FollowUpsPage() {
  const me = useMe();
  const team = useTeam();
  const { toast, confirm } = useUi();
  const [bucket, setBucket] = useState<Bucket>("today");
  const [assignedTo, setAssignedTo] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Item | undefined>();
  const [completing, setCompleting] = useState<Item | null>(null);
  const { data, error, mutate } = useApi<Res>(`/api/followups${qs({ bucket, assignedTo, type, page })}`, { refreshInterval: 60000 });

  const groups = useMemo(() => {
    const g = new Map<string, Item[]>();
    for (const i of data?.items ?? []) {
      const d = bucket === "completed" && i.completedAt ? i.completedAt : i.dueAt;
      const key = fmtDate(d, { weekday: "long", day: "numeric", month: "short" });
      g.set(key, [...(g.get(key) ?? []), i]);
    }
    return [...g.entries()];
  }, [data, bucket]);

  const snooze = async (i: Item, hours: number) => {
    const base = Math.max(Date.now(), new Date(i.dueAt).getTime());
    const d = new Date(hours >= 24 ? new Date(base + hours * 3600000).setHours(11, 0, 0, 0) : Date.now() + hours * 3600000);
    await api(`/api/followups/${i._id}`, { method: "PATCH", body: { dueAt: d.toISOString() } });
    toast(`Rescheduled to ${fmtDate(d, { day: "numeric", month: "short" })} ${fmtTime(d)}`);
    mutate();
  };
  const reopen = async (i: Item) => {
    await api(`/api/followups/${i._id}`, { method: "PATCH", body: { status: "pending" } });
    toast("Follow-up re-opened");
    mutate();
  };
  const remove = async (i: Item) => {
    if (!(await confirm({ title: "Delete follow-up?", message: i.title, danger: true, confirmText: "Delete" }))) return;
    await api(`/api/followups/${i._id}`, { method: "DELETE" });
    toast("Follow-up deleted");
    mutate();
  };

  const c = data?.counts;
  return (
    <div className="animate-fade-up">
      <PageHeader title="Follow-ups" subtitle="Calls, WhatsApps and meetings to keep every lead warm." actions={<Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => (setEditing(undefined), setCreating(true))}>Schedule</Button>} />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={bucket}
          onChange={(v) => (setBucket(v), setPage(1))}
          items={[
            { value: "overdue", label: "Overdue", count: c?.overdue },
            { value: "today", label: "Today", count: c?.today },
            { value: "upcoming", label: "Upcoming", count: c?.upcoming },
            { value: "completed", label: "Done", count: c?.completed },
          ]}
        />
        <div className="flex gap-2">
          <select className="input lg:w-40" value={type} onChange={(e) => (setType(e.target.value), setPage(1))} aria-label="Type">
            <option value="">All types</option>
            {FOLLOWUP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {me.user.role === "admin" && (
            <select className="input lg:w-44" value={assignedTo} onChange={(e) => (setAssignedTo(e.target.value), setPage(1))} aria-label="Assignee">
              <option value="">Whole team</option>
              <option value="me">Mine</option>
              {team.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CalendarCheck2 className="h-6 w-6" />}
            title={bucket === "overdue" ? "Nothing overdue 🎉" : bucket === "today" ? "No more follow-ups today" : bucket === "upcoming" ? "Nothing scheduled ahead" : "No completed follow-ups yet"}
            description="Schedule follow-ups from a lead's page, or let the AI create them automatically from WhatsApp chats."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{day}</h3>
              <ul className="card divide-y divide-line overflow-hidden">
                {items.map((i) => {
                  const Icon = TYPE_ICON[i.type] ?? Phone;
                  const who = i.lead ?? i.customer;
                  const overdue = i.status === "pending" && new Date(i.dueAt) < new Date();
                  return (
                    <li key={i._id} className="flex items-start gap-3 px-4 py-3.5 sm:items-center sm:px-5">
                      {i.status === "pending" ? (
                        <button onClick={() => setCompleting(i)} className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent transition hover:border-leaf hover:bg-leaf-soft hover:text-leaf sm:mt-0" aria-label="Mark done" title="Mark done">
                          <Check className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf text-white sm:mt-0">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className={cn("font-semibold", i.status !== "pending" && "text-muted line-through")}>{i.title}</p>
                          {i.autoCreated && (
                            <span className="chip bg-brand-soft text-brand-ink">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                          <span className={cn("flex items-center gap-1 font-semibold", overdue ? "text-coral" : "text-ink/80")}>
                            <CalendarClock className="h-3.5 w-3.5" />
                            {fmtTime(i.dueAt)} {overdue && `· ${timeAgo(i.dueAt)}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon className="h-3.5 w-3.5" /> {followUpTypeLabel(i.type)}
                          </span>
                          {who && (
                            <Link href={i.lead ? `/leads/${i.lead._id}` : `/customers/${i.customer!._id}`} className="font-medium text-ink hover:text-brand">
                              {who.name}
                            </Link>
                          )}
                          {i.lead && <LeadStatusBadge status={i.lead.status} />}
                        </p>
                        {i.outcome && <p className="mt-1 text-xs text-ink/80">✓ {i.outcome}</p>}
                        {!i.outcome && i.notes && <p className="mt-1 line-clamp-1 text-xs text-muted">{i.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {i.assignedTo && <Avatar name={i.assignedTo.name} color={i.assignedTo.color} size={26} className="hidden sm:inline-flex" />}
                        {who?.phone && i.status === "pending" && (
                          <>
                            <a href={`tel:+${who.phone}`} className="hidden rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink sm:block" title={`Call ${displayPhone(who.phone)}`} aria-label="Call">
                              <Phone className="h-4 w-4" />
                            </a>
                            <a href={waLink(who.phone)} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-[#128C4B] hover:bg-[#25D366]/10" title="WhatsApp" aria-label="WhatsApp">
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </>
                        )}
                        <Menu
                          trigger={() => (
                            <button className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="More actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              {i.status === "pending" ? (
                                <>
                                  <MenuItem icon={<AlarmClockPlus className="h-4 w-4" />} onClick={() => (close(), snooze(i, 1))}>Snooze 1 hour</MenuItem>
                                  <MenuItem icon={<AlarmClockPlus className="h-4 w-4" />} onClick={() => (close(), snooze(i, 24))}>Tomorrow 11 AM</MenuItem>
                                  <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => (close(), setEditing(i), setCreating(true))}>Edit</MenuItem>
                                </>
                              ) : (
                                <MenuItem icon={<RotateCcw className="h-4 w-4" />} onClick={() => (close(), reopen(i))}>Re-open</MenuItem>
                              )}
                              <MenuItem icon={<Trash2 className="h-4 w-4" />} danger onClick={() => (close(), remove(i))}>Delete</MenuItem>
                            </>
                          )}
                        </Menu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </div>
      )}
      <FollowUpFormModal open={creating} onClose={() => setCreating(false)} followUp={editing} onSaved={() => (!editing && toast("Follow-up scheduled"), mutate())} />
      <CompleteFollowUpModal fu={completing} leadStatus={completing?.lead?.status} onClose={() => setCompleting(null)} onDone={() => mutate()} />
    </div>
  );
}
