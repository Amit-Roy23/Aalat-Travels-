"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, CalendarClock, CheckCircle2, ExternalLink, Gauge, Hand, Languages, Megaphone, Pause, Play, RotateCcw, Send, Sparkles, UserPlus, UserRoundCog, Zap, Trash2, RefreshCw, Target } from "lucide-react";
import { api } from "@/lib/client";
import { cn, fmtDateTime } from "@/lib/format";
import { languageName, leadStatusMeta, LEAD_SOURCES } from "@/lib/constants";
import { SCENARIOS, type Effect, type Scenario } from "@/lib/demo-scenarios";
import { Badge, Button, LeadStatusBadge, Tabs, useUi } from "@/components/ui";
import { Bubble, PhoneFrame, Typing } from "@/components/whatsapp";
import { useMe } from "@/components/session";

const EFFECT_ICON: Record<Effect["kind"], { icon: typeof Bot; cls: string }> = {
  lead: { icon: UserPlus, cls: "bg-sky-soft text-sky" },
  lang: { icon: Languages, cls: "bg-brand-soft text-brand" },
  status: { icon: Target, cls: "bg-leaf-soft text-leaf" },
  field: { icon: Sparkles, cls: "bg-sun-soft text-sun" },
  followup: { icon: CalendarClock, cls: "bg-sun-soft text-sun" },
  handoff: { icon: Hand, cls: "bg-coral-soft text-coral" },
  assign: { icon: UserRoundCog, cls: "bg-slate2-soft text-slate2" },
};

export default function AiDemoPage() {
  const me = useMe();
  const [tab, setTab] = useState<"showcase" | "sandbox">("showcase");
  return (
    <div className="animate-fade-up">
      <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-sidebar via-sidebar-2 to-[#6b1032] px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-hl/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="chip bg-white/10 text-hl">
              <Sparkles className="h-3 w-3" /> AI-powered WhatsApp automation
            </span>
            <h1 className="mt-3 font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-4xl">Watch the AI turn chats into bookings</h1>
            <p className="mt-2 text-[15px] text-white/65">Replies in the customer&apos;s own language, captures trip details, scores interest, and schedules follow-ups — automatically, 24/7.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[12.5px] font-semibold">
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className={cn("h-2 w-2 rounded-full", me.integrations.ai === "claude" ? "bg-hl" : "bg-accent")} />
              Engine: {me.integrations.ai === "claude" ? "Claude AI (live, 90+ languages)" : "Built-in demo AI (7 languages)"}
            </span>
          </div>
        </div>
      </div>
      <Tabs
        className="mb-5 w-fit"
        value={tab}
        onChange={setTab}
        items={[
          { value: "showcase", label: "▶ Showcase conversations" },
          { value: "sandbox", label: "💬 Live sandbox — chat with the AI" },
        ]}
      />
      {tab === "showcase" ? <Showcase /> : <Sandbox />}
    </div>
  );
}

/* ───────────────────────── Showcase (scripted playback) ───────────────────────── */
function Showcase() {
  const [sc, setSc] = useState<Scenario>(SCENARIOS[0]);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShown(0);
    setTyping(false);
    setPlaying(true);
  }, []);
  useEffect(() => restart(), [sc, restart]);

  useEffect(() => {
    if (!playing || shown >= sc.steps.length) {
      if (shown >= sc.steps.length) setPlaying(false);
      return;
    }
    const next = sc.steps[shown];
    if (next.from === "ai") {
      setTyping(true);
      const t = Math.min(2600, 900 + next.text.length * 6) / speed;
      timer.current = setTimeout(() => {
        setTyping(false);
        setShown((s) => s + 1);
      }, t);
    } else {
      timer.current = setTimeout(() => setShown((s) => s + 1), (shown === 0 ? 500 : 1700) / speed);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [shown, playing, sc, speed]);

  useEffect(() => {
    const el = scrollRef.current?.closest(".wa-wallpaper");
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);

  const effects = sc.steps.slice(0, shown).flatMap((s) => s.effects ?? []);
  const done = shown >= sc.steps.length;
  const statusNow = effects.filter((e) => e.kind === "status").pop()?.label.split("→ ")[1];

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,400px)_minmax(0,1fr)]">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0">
        {SCENARIOS.map((s) => (
          <button key={s.id} onClick={() => setSc(s)} className={cn("w-[220px] shrink-0 rounded-2xl border p-3.5 text-left transition xl:w-auto", sc.id === s.id ? "border-brand bg-brand-soft/60 shadow-card" : "border-line bg-surface hover:border-brand/40")}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{s.flag}</span>
              <p className="font-semibold">{s.title}</p>
            </div>
            <p className="mt-1 text-xs text-muted">{s.subtitle}</p>
          </button>
        ))}
      </div>

      <div>
        <PhoneFrame name={sc.customer.name} subtitle={done ? "online" : typing ? "Aalat Travels is typing…" : "online"} avatar={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">{sc.flag}</span>}>
          <div className="flex justify-center py-1">
            <span className="rounded-lg bg-[#FFF5C4] px-3 py-1 text-center text-[11px] text-[#54473F] shadow-sm dark:bg-[#1F2C34] dark:text-[#FFD279]">🔒 Messages are end-to-end encrypted</span>
          </div>
          {sc.source === "meta_ads" && (
            <div className="mx-auto max-w-[85%] rounded-xl bg-surface/90 p-2.5 text-[11.5px] text-muted shadow-sm">
              <p className="flex items-center gap-1 font-semibold text-ink">
                <Megaphone className="h-3 w-3" /> From an ad: {sc.campaign}
              </p>
            </div>
          )}
          {sc.steps.slice(0, shown).map((st, i) => (
            <Bubble key={sc.id + i} compact m={{ direction: st.from === "customer" ? "in" : "out", sender: st.from === "customer" ? "customer" : "ai", body: st.text, status: "read", createdAt: new Date(Date.now() - (sc.steps.length - i) * 45000).toISOString() }} />
          ))}
          {typing && <Typing />}
          <div ref={scrollRef} />
        </PhoneFrame>
        <div className="mx-auto mt-3 flex max-w-[380px] items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={restart} icon={<RotateCcw className="h-4 w-4" />}>
            Replay
          </Button>
          <Button size="sm" onClick={() => (done ? restart() : setPlaying((p) => !p))} icon={playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
            {playing ? "Pause" : done ? "Play again" : "Play"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))} icon={<Gauge className="h-4 w-4" />}>
            {speed}×
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display font-bold">Lead record · updating live</p>
            {statusNow ? <LeadStatusBadge status={statusToValue(statusNow)} /> : <Badge tone="sky">New</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              ["Customer", sc.customer.name, shown > 0],
              ["Language", languageName(sc.language), effects.some((e) => e.kind === "lang")],
              ["Source", LEAD_SOURCES.find((s) => s.value === sc.source)?.label, shown > 0],
              ["Destination", sc.destination, effects.some((e) => e.label.includes("Destination"))],
              ["Travel date", sc.travelDate || "—", effects.some((e) => /Travel date|January|November|April|December|February/.test(e.label))],
              ["Travellers", sc.adults ? `${sc.adults}${sc.children ? ` + ${sc.children} kids` : ""}` : "—", effects.some((e) => /Travellers|adults/.test(e.label))],
            ].map(([l, v, ok]) => (
              <div key={l as string} className={cn("rounded-xl p-2.5 transition-all duration-500", ok ? "bg-brand-soft/60" : "bg-surface-2/60")}>
                <dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{l}</dt>
                <dd className={cn("truncate font-semibold transition", ok ? "text-ink" : "text-muted/50 blur-[3px]")}>{v as string}</dd>
              </div>
            ))}
          </dl>
          {done && (
            <div className="mt-3 animate-fade-up rounded-xl border border-brand/25 bg-brand-soft/50 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                <Sparkles className="h-3 w-3" /> AI summary for the sales team
              </p>
              {sc.summary}
            </div>
          )}
        </div>
        <div className="card p-4 sm:p-5">
          <p className="mb-3 font-display font-bold">Automation log</p>
          {effects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Waiting for the first message…</p>
          ) : (
            <ol className="space-y-2.5">
              {effects.map((e, i) => {
                const m = EFFECT_ICON[e.kind];
                return (
                  <li key={i} className="flex animate-fade-up items-center gap-3">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.cls)}>
                      <m.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[13.5px] font-medium">{e.label}</span>
                    <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-leaf" />
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <p className="px-1 text-xs text-muted">These conversations are also loaded into the WhatsApp Inbox as demo data, so you can open the matching leads and follow-ups in the CRM.</p>
      </div>
    </div>
  );
}

function statusToValue(label: string) {
  if (/Not Interested/i.test(label)) return "not_interested";
  if (/Follow/i.test(label)) return "follow_up";
  if (/Interested/i.test(label)) return "interested";
  return "new";
}

/* ───────────────────────── Live sandbox ───────────────────────── */
type SimMsg = { id: string; direction: "in" | "out"; sender: string; body: string; createdAt: string };
type SimRes = {
  result: {
    leadId?: string;
    leadCreated: boolean;
    statusChanged?: { from: string; to: string };
    followUpCreated?: { title: string; dueAt: string };
    ai?: { engine: string; reply: string; language: string; intent: string; interest: string; handoff: boolean; summary: string; error?: string; extracted: Record<string, string | number | null> };
  };
  lead: { _id: string; name: string; status: string; destination: string; travelDate: string; travellers: { adults: number; children: number }; budget: number; assignedTo?: { name: string } } | null;
  mode: string;
};

const SAMPLES: { label: string; text: string }[] = [
  { label: "🇬🇧 English", text: "Hi! We're a family of 4 planning a Goa trip in December. What packages do you have?" },
  { label: "🇮🇳 हिंदी", text: "नमस्ते, कश्मीर का पैकेज कितने का है? हम 2 लोग हैं, अप्रैल में जाना है" },
  { label: "🇮🇳 Hinglish", text: "Bhai Manali ka package batao, hum 5 dost hain next month" },
  { label: "🇮🇳 বাংলা", text: "নমস্কার, দার্জিলিং যেতে চাই। আমরা 3 জন, পুজোর ছুটিতে" },
  { label: "🇦🇪 العربية", text: "مرحبا، أريد رحلة إلى دبي لشخصين في يناير" },
  { label: "🇪🇸 Español", text: "Hola, queremos viajar a Bali en marzo, somos 2 personas" },
  { label: "🇫🇷 Français", text: "Bonjour, combien coûte un voyage aux Maldives pour 2 personnes ?" },
];
const FOLLOWUPS = ["Yes please, book it!", "My budget is around 15k per person", "Too expensive for us", "Let me discuss with family, will let you know next week", "Can I talk to an agent?", "Do you help with visa?", "Not interested, thanks"];

function sandboxPhone() {
  try {
    const k = "aalat-sandbox-phone";
    let p = localStorage.getItem(k);
    if (!p) {
      p = "91999" + String(Math.floor(1000000 + Math.random() * 8999999));
      localStorage.setItem(k, p);
    }
    return p;
  } catch {
    return "919990000001";
  }
}

function Sandbox() {
  const me = useMe();
  const { toast } = useUi();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("Neha Kapoor");
  const [source, setSource] = useState("meta_ads");
  const [msgs, setMsgs] = useState<SimMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SimRes | null>(null);
  const [log, setLog] = useState<{ icon: typeof Bot; cls: string; text: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => setPhone(sandboxPhone()), []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  const send = async (t = text) => {
    const body = t.trim();
    if (!body || busy || !phone) return;
    setText("");
    setMsgs((m) => [...m, { id: crypto.randomUUID(), direction: "in", sender: "customer", body, createdAt: new Date().toISOString() }]);
    setBusy(true);
    try {
      const [r] = await Promise.all([
        api<SimRes>("/api/ai/simulate", { body: { phone, name, text: body, source, campaign: source === "meta_ads" ? "Sandbox ad campaign" : undefined } }),
        new Promise((res) => setTimeout(res, 700)),
      ]);
      setLast(r);
      const ai = r.result.ai;
      if (ai) setMsgs((m) => [...m, { id: crypto.randomUUID(), direction: "out", sender: "ai", body: ai.reply, createdAt: new Date().toISOString() }]);
      const entries: { icon: typeof Bot; cls: string; text: string }[] = [];
      if (r.result.leadCreated) entries.push({ icon: UserPlus, cls: "bg-sky-soft text-sky", text: `Lead captured · assigned to ${r.lead?.assignedTo?.name ?? "team"}` });
      if (ai) entries.push({ icon: Languages, cls: "bg-brand-soft text-brand", text: `Replied in ${languageName(ai.language)} · intent: ${ai.intent.replace(/_/g, " ")}` });
      if (r.result.statusChanged) entries.push({ icon: Target, cls: "bg-leaf-soft text-leaf", text: `Status → ${leadStatusMeta(r.result.statusChanged.to).label}` });
      if (r.result.followUpCreated) entries.push({ icon: CalendarClock, cls: "bg-sun-soft text-sun", text: `Follow-up: ${r.result.followUpCreated.title} (${fmtDateTime(r.result.followUpCreated.dueAt)})` });
      if (ai?.handoff) entries.push({ icon: Hand, cls: "bg-coral-soft text-coral", text: "Handed over to a human agent — AI paused" });
      if (ai?.error) entries.push({ icon: Zap, cls: "bg-coral-soft text-coral", text: `AI provider error, used built-in engine: ${ai.error}` });
      setLog((l) => [...entries.reverse(), ...l].slice(0, 30));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (phone) await api(`/api/ai/simulate?phone=${phone}`, { method: "DELETE" }).catch(() => undefined);
    try {
      localStorage.removeItem("aalat-sandbox-phone");
    } catch {}
    setPhone(sandboxPhone());
    setMsgs([]);
    setLast(null);
    setLog([]);
    toast("Sandbox reset — new customer number");
  };

  const ai = last?.result.ai;
  const handoff = ai?.handoff;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <div>
        <PhoneFrame
          name={name || "Customer"}
          subtitle={busy ? "Aalat Travels is typing…" : `+${phone}`}
          avatar={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{(name || "C")[0]}</span>}
          footer={
            <div className="border-t border-line bg-surface-2 p-2">
              {msgs.length > 0 && !handoff && (
                <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
                  {FOLLOWUPS.map((f) => (
                    <button key={f} onClick={() => send(f)} disabled={busy} className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium hover:border-brand disabled:opacity-50">
                      {f}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type as the customer…"
                  className="h-10 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-brand"
                  disabled={busy}
                />
                <button onClick={() => send()} disabled={busy || !text.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-[#073B2F] disabled:opacity-50" aria-label="Send">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        >
          {msgs.length === 0 && (
            <div className="space-y-2 py-4">
              <p className="rounded-xl bg-surface/90 p-3 text-center text-[12.5px] text-muted shadow-sm">Pretend you&apos;re a customer who just clicked an ad. Type in any language or tap a sample below 👇</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SAMPLES.map((s) => (
                  <button key={s.label} onClick={() => send(s.text)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm hover:border-brand">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m) => (
            <Bubble key={m.id} compact m={{ ...m, status: "read" }} />
          ))}
          {busy && <Typing />}
          {handoff && <p className="rounded-xl bg-sun-soft p-2.5 text-center text-xs font-medium text-sun">AI paused — a human agent takes over in the Inbox. Reset the sandbox to start again.</p>}
          <div ref={endRef} />
        </PhoneFrame>
      </div>

      <div className="space-y-4">
        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display font-bold">Sandbox customer</p>
            <Button variant="outline" size="sm" onClick={reset} icon={<RefreshCw className="h-4 w-4" />}>
              Reset sandbox
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="label">WhatsApp profile name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={msgs.length > 0} />
            </label>
            <label className="text-sm">
              <span className="label">Came from</span>
              <select className="input" value={source} onChange={(e) => setSource(e.target.value)} disabled={msgs.length > 0}>
                <option value="meta_ads">Facebook / Instagram ad (Click-to-WhatsApp)</option>
                <option value="google_ads">Google ad</option>
                <option value="whatsapp">Direct WhatsApp message</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-muted">
            Messages run through the real automation pipeline ({me.integrations.ai === "claude" ? "Claude AI" : "built-in multilingual demo engine"}) and create a demo lead in the CRM. Nothing is sent to WhatsApp.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display font-bold">AI analysis · last message</p>
              {ai && <Badge tone={ai.engine === "claude" ? "brand" : "sun"}>{ai.engine === "claude" ? "Claude" : "Demo engine"}</Badge>}
            </div>
            {!ai ? (
              <p className="py-6 text-center text-sm text-muted">Send a message to see what the AI understands.</p>
            ) : (
              <dl className="space-y-2.5 text-sm">
                <Row label="Language" value={languageName(ai.language)} />
                <Row label="Intent" value={ai.intent.replace(/_/g, " ")} />
                <Row label="Interest" value={<Badge tone={ai.interest === "interested" ? "leaf" : ai.interest === "not_interested" ? "coral" : ai.interest === "follow_up" ? "sun" : "slate"}>{ai.interest.replace("_", " ")}</Badge>} />
                {Object.entries(ai.extracted)
                  .filter(([, v]) => v !== null && v !== "")
                  .map(([k, v]) => (
                    <Row key={k} label={k.replace(/([A-Z])/g, " $1")} value={k === "budget" ? `₹${Number(v).toLocaleString("en-IN")}` : String(v)} />
                  ))}
                {ai.summary && <p className="rounded-xl bg-surface-2 p-2.5 text-[13px]">{ai.summary}</p>}
              </dl>
            )}
          </div>
          <div className="card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display font-bold">CRM lead</p>
              {last?.lead && <LeadStatusBadge status={last.lead.status} />}
            </div>
            {!last?.lead ? (
              <p className="py-6 text-center text-sm text-muted">The lead is created on the first message.</p>
            ) : (
              <div className="space-y-2.5 text-sm">
                <Row label="Name" value={last.lead.name} />
                <Row label="Destination" value={last.lead.destination || "—"} />
                <Row label="Travel date" value={last.lead.travelDate || "—"} />
                <Row label="Travellers" value={last.lead.travellers?.adults ? `${last.lead.travellers.adults}${last.lead.travellers.children ? ` + ${last.lead.travellers.children}` : ""}` : "—"} />
                <Row label="Owner" value={last.lead.assignedTo?.name ?? "—"} />
                <div className="flex gap-2 pt-1">
                  <Link href={`/leads/${last.lead._id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" icon={<ExternalLink className="h-4 w-4" />}>
                      Open lead
                    </Button>
                  </Link>
                  <Link href="/inbox" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      Inbox
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display font-bold">Automation log</p>
            {log.length > 0 && (
              <button onClick={() => setLog([])} className="text-xs font-semibold text-muted hover:text-ink" aria-label="Clear log">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {log.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Every automated action will be listed here.</p>
          ) : (
            <ol className="space-y-2.5">
              {log.map((e, i) => (
                <li key={i} className="flex animate-fade-up items-center gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", e.cls)}>
                    <e.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[13.5px] font-medium">{e.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="capitalize text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
