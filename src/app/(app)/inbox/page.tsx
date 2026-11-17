"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, BotOff, ExternalLink, Hand, MessageCircle, Search, Send, Sparkles, Info } from "lucide-react";
import { api, qs, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDate, timeAgo } from "@/lib/format";
import { languageName } from "@/lib/constants";
import { Avatar, Badge, Button, EmptyState, LeadStatusBadge, Skeleton, Tabs, useUi } from "@/components/ui";
import { Bubble } from "@/components/whatsapp";
import { useMe } from "@/components/session";

type Conv = { _id: string; phone: string; name: string; lastMessage: string; lastMessageAt: string; unread: number; aiEnabled: boolean; handoff: boolean; language: string; interest: string; isDemo: boolean; lead?: { _id: string; name: string; status: string; destination: string } };
type Msg = { _id: string; direction: "in" | "out"; sender: string; body: string; createdAt: string; status: string; error?: string; agent?: { name: string } };
type Thread = {
  conversation: Conv & { handoffReason: string; lastInboundAt?: string };
  messages: Msg[];
  lead: { _id: string; name: string; status: string; destination: string; travelDate: string; travellers: { adults: number; children: number }; budget: number; aiSummary: string; assignedTo?: { name: string; color: string } } | null;
};

function InboxInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [active, setActive] = useState<string | null>(sp.get("c"));
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setActive(sp.get("c")), [sp]);
  const { data, mutate } = useApi<{ items: Conv[]; counts: { unread: number; handoff: number } }>(`/api/conversations${qs({ q: dq, filter })}`, { refreshInterval: 10000 });
  const open = (id: string | null) => {
    setActive(id);
    router.replace(id ? `/inbox?c=${id}` : "/inbox", { scroll: false });
  };

  return (
    <div className="-mx-4 -mb-28 -mt-4 sm:-mx-6 lg:-mx-8 lg:-mb-10 lg:-mt-6">
      <div className="flex h-[calc(100dvh-4rem-64px)] overflow-hidden border-line bg-surface lg:h-[calc(100dvh-4rem)]">
        {/* list */}
        <aside className={cn("flex w-full flex-col border-r border-line md:w-[340px] md:shrink-0 xl:w-[380px]", active && "hidden md:flex")}>
          <div className="space-y-2.5 border-b border-line p-3">
            <div className="flex items-center justify-between px-1">
              <h1 className="font-display text-xl font-extrabold tracking-tight">WhatsApp Inbox</h1>
              <Link href="/ai-demo" className="chip bg-brand-soft text-brand-ink">
                <Sparkles className="h-3 w-3" /> Try AI demo
              </Link>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input h-9 rounded-full bg-surface-2 pl-9" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Tabs
              value={filter}
              onChange={setFilter}
              items={[
                { value: "", label: "All" },
                { value: "unread", label: "Unread", count: data?.counts.unread },
                { value: "handoff", label: "Needs agent", count: data?.counts.handoff },
                { value: "interested", label: "Interested" },
              ]}
            />
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {!data ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : data.items.length === 0 ? (
              <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No conversations" description="Incoming WhatsApp chats will appear here. Try the AI demo to simulate one." />
            ) : (
              data.items.map((c) => (
                <button key={c._id} onClick={() => open(c._id)} className={cn("flex w-full items-center gap-3 border-b border-line/60 px-3.5 py-3 text-left transition hover:bg-surface-2/70", active === c._id && "bg-brand-soft/50")}>
                  <div className="relative">
                    <Avatar name={c.name || c.phone} color="#128C7E" size={44} />
                    {c.aiEnabled && !c.handoff && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand text-white ring-2 ring-surface" title="AI auto-reply on">
                        <Bot className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14.5px] font-semibold">{c.name || displayPhone(c.phone)}</p>
                      <span className={cn("shrink-0 text-[11px]", c.unread ? "font-bold text-[#128C4B]" : "text-muted")}>{timeAgo(c.lastMessageAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="flex-1 truncate text-[13px] text-muted">{c.lastMessage.replace(/[*_~]/g, "").replace(/\s+/g, " ")}</p>
                      {c.handoff && <Hand className="h-3.5 w-3.5 shrink-0 text-sun" />}
                      {c.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold text-[#073B2F]">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
        {/* thread */}
        <section className={cn("min-w-0 flex-1", !active && "hidden md:flex")}>
          {active ? (
            <ThreadView key={active} id={active} onBack={() => open(null)} onChange={() => mutate()} />
          ) : (
            <div className="wa-wallpaper flex h-full w-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-surface shadow-card">
                <MessageCircle className="h-8 w-8 text-[#25D366]" />
              </div>
              <p className="font-display text-xl font-bold">Select a conversation</p>
              <p className="mt-1 max-w-sm text-sm text-muted">The AI assistant replies 24/7 in the customer&apos;s language. Jump in anytime — AI pauses automatically when you reply.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadView({ id, onBack, onChange }: { id: string; onBack: () => void; onChange: () => void }) {
  const me = useMe();
  const { toast } = useUi();
  const { data, mutate } = useApi<Thread>(`/api/conversations/${id}`, { refreshInterval: 5000 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: count > 0 ? "smooth" : "auto" });
  }, [count]);
  useEffect(() => {
    if (data && data.conversation.unread === 0) onChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  const grouped = useMemo(() => {
    const out: { day: string; items: Msg[] }[] = [];
    for (const m of data?.messages ?? []) {
      const day = fmtDate(m.createdAt, { day: "numeric", month: "long", year: "numeric" });
      if (out[out.length - 1]?.day !== day) out.push({ day, items: [] });
      out[out.length - 1].items.push(m);
    }
    return out;
  }, [data]);

  if (!data)
    return (
      <div className="flex h-full w-full flex-col">
        <Skeleton className="m-3 h-12" />
        <div className="wa-wallpaper flex-1" />
      </div>
    );
  const c = data.conversation;
  const windowOpen = c.lastInboundAt && Date.now() - new Date(c.lastInboundAt).getTime() < 24 * 3600 * 1000;

  const toggleAi = async () => {
    await api(`/api/conversations/${id}`, { method: "PATCH", body: { aiEnabled: !c.aiEnabled } });
    toast(c.aiEnabled ? "AI paused — you're handling this chat" : "AI auto-replies resumed");
    mutate();
    onChange();
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const r = await api<{ message: Msg }>(`/api/conversations/${id}/messages`, { body: { text: t } });
      setText("");
      if (r.message.status === "failed") toast(r.message.error || "WhatsApp could not deliver the message", "error");
      mutate();
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2.5 border-b border-line bg-surface px-3 py-2.5">
          <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-surface-2 md:hidden" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Avatar name={c.name || c.phone} color="#128C7E" size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{c.name || displayPhone(c.phone)}</p>
            <p className="truncate text-xs text-muted">
              {displayPhone(c.phone)}
              {c.language && ` · ${languageName(c.language)}`}
              {c.isDemo && " · demo chat"}
            </p>
          </div>
          <button
            onClick={toggleAi}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition", c.aiEnabled ? "bg-brand-soft text-brand-ink hover:brightness-95" : "bg-surface-2 text-muted hover:text-ink")}
            title={c.aiEnabled ? "AI is replying automatically — click to pause" : "AI paused — click to resume"}
          >
            {c.aiEnabled ? <Bot className="h-4 w-4" /> : <BotOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{c.aiEnabled ? "AI on" : "AI paused"}</span>
          </button>
          <button onClick={() => setShowInfo((s) => !s)} className="rounded-lg p-2 text-muted hover:bg-surface-2 xl:hidden" aria-label="Lead info">
            <Info className="h-5 w-5" />
          </button>
        </header>
        {c.handoff && (
          <div className="flex items-center gap-2 border-b border-sun/30 bg-sun-soft px-4 py-2 text-[13px] font-medium text-sun">
            <Hand className="h-4 w-4 shrink-0" />
            <span className="flex-1">Customer asked for a human: {c.handoffReason || "handover requested"}. Reply below to take over.</span>
          </div>
        )}
        <div className="wa-wallpaper scrollbar-thin flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
          {grouped.map((g) => (
            <div key={g.day} className="space-y-2">
              <div className="flex justify-center py-1">
                <span className="rounded-lg bg-surface/90 px-3 py-1 text-[11.5px] font-medium text-muted shadow-sm">{g.day}</span>
              </div>
              {g.items.map((m) => (
                <Bubble key={m._id} m={{ ...m, agentName: m.agent?.name }} />
              ))}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="safe-bottom border-t border-line bg-surface p-2.5 sm:p-3">
          {!c.isDemo && me.integrations.whatsapp && !windowOpen && (
            <p className="mb-2 rounded-lg bg-sun-soft px-3 py-1.5 text-xs text-sun">The 24-hour customer-service window has closed. WhatsApp only allows approved template messages until the customer writes again.</p>
          )}
          {(c.isDemo || !me.integrations.whatsapp) && <p className="mb-2 px-1 text-[11.5px] text-muted">{c.isDemo ? "Demo chat — messages are saved but not sent to WhatsApp." : "WhatsApp API not connected — replies are saved in the CRM only."}</p>}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={c.aiEnabled ? "Type a reply (AI will pause for this chat)…" : "Type a message"}
              className="input max-h-36 min-h-[42px] flex-1 resize-none rounded-2xl bg-surface-2 py-2.5"
            />
            <Button variant="wa" size="icon" className="h-[42px] w-[42px] rounded-full" onClick={send} loading={sending} disabled={!text.trim()} aria-label="Send">
              {!sending && <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
      <aside className={cn("scrollbar-thin w-[300px] shrink-0 overflow-y-auto border-l border-line bg-surface p-4", showInfo ? "fixed inset-y-0 right-0 z-50 shadow-pop xl:static xl:shadow-none" : "hidden xl:block")}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display font-bold">Lead details</p>
          <button className="text-xs font-semibold text-muted xl:hidden" onClick={() => setShowInfo(false)}>
            Close
          </button>
        </div>
        {data.lead ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <Link href={`/leads/${data.lead._id}`} className="font-semibold hover:text-brand">
                {data.lead.name}
              </Link>
              <LeadStatusBadge status={data.lead.status} />
            </div>
            {data.lead.aiSummary && (
              <div className="rounded-xl bg-brand-soft/60 p-3 text-[13px]">
                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                  <Sparkles className="h-3 w-3" /> AI summary
                </p>
                {data.lead.aiSummary}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Destination", data.lead.destination || "—"],
                ["Travel date", data.lead.travelDate || "—"],
                ["Travellers", data.lead.travellers?.adults ? `${data.lead.travellers.adults}${data.lead.travellers.children ? ` + ${data.lead.travellers.children}` : ""}` : "—"],
                ["Budget", data.lead.budget ? `₹${data.lead.budget.toLocaleString("en-IN")}` : "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{l}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted">Owner: {data.lead.assignedTo?.name ?? "Unassigned"}</p>
            <Link href={`/leads/${data.lead._id}`}>
              <Button variant="outline" size="sm" className="mt-1 w-full" icon={<ExternalLink className="h-4 w-4" />}>
                Open lead
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">No lead linked to this chat.</p>
        )}
        <div className="mt-5 rounded-xl border border-line p-3 text-xs text-muted">
          <p className="mb-1 font-semibold text-ink">How automation works</p>
          AI replies instantly, detects language, captures trip details, updates the lead status and schedules follow-ups. When you reply, AI pauses for this chat.
          {c.interest && (
            <p className="mt-2">
              Detected interest: <Badge tone={c.interest === "interested" ? "leaf" : c.interest === "not_interested" ? "coral" : "sun"}>{c.interest.replace("_", " ")}</Badge>
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <InboxInner />
    </Suspense>
  );
}
