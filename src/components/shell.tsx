"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarClock,
  CircleUserRound,
  Contact,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Target,
  UsersRound,
  X,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, displayPhone, money, timeAgo } from "@/lib/format";
import { Avatar, Button, LeadStatusBadge, Menu, MenuItem, Modal, Field, useUi, InvoiceStatusBadge } from "./ui";
import { Logo, LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { useMe } from "./session";
import { LeadFormModal, FollowUpFormModal } from "./forms";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/customers", label: "Customers", icon: Contact },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  { href: "/inbox", label: "WhatsApp Inbox", icon: MessageCircle, badge: "inbox" as const },
  { href: "/ai-demo", label: "AI Chat Demos", icon: Bot },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/reports", label: "Reports", icon: BarChart3, admin: true },
  { href: "/team", label: "Team", icon: UsersRound, admin: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

type Notif = { items: { _id: string; title: string; body: string; link: string; read: boolean; createdAt: string; type: string }[]; unread: number; reminders: { _id: string; title: string; dueAt: string; lead?: { name: string }; customer?: { name: string } }[] };

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const { data: inbox } = useApi<{ counts: { unread: number; handoff: number } }>("/api/conversations?limit=1", { refreshInterval: 30000 });
  const nav = NAV.filter((n) => !n.admin || me.user.role === "admin");
  useEffect(() => setDrawer(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const NavLinks = ({ onDark }: { onDark?: boolean }) => (
    <nav className="space-y-0.5">
      {nav.map((n) => {
        const active = isActive(n.href);
        const count = n.badge === "inbox" ? (inbox?.counts.unread ?? 0) : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition",
              onDark ? (active ? "bg-gradient-to-r from-brand to-brand/70 text-white shadow-[0_8px_20px_-10px_rgb(var(--brand))]" : "text-white/65 hover:bg-white/[0.06] hover:text-white") : active ? "bg-brand-soft text-brand-ink" : "text-ink/70 hover:bg-surface-2",
            )}
          >
            <n.icon className={cn("h-[18px] w-[18px]", !active && onDark && "text-white/55 group-hover:text-white")} />
            <span className="flex-1">{n.label}</span>
            {n.href === "/ai-demo" && <Sparkles className="h-3.5 w-3.5 text-accent" />}
            {count > 0 && <span className="rounded-full bg-[#25D366] px-1.5 py-px text-[11px] font-bold text-[#073B2F]">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-gradient-to-b from-sidebar via-sidebar to-sidebar-2 px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo name={me.company.name} light />
        </div>
        <div className="mt-7 flex-1 overflow-y-auto no-scrollbar">
          <NavLinks onDark />
        </div>
        <IntegrationCard />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] animate-slide-in flex-col bg-gradient-to-b from-sidebar via-sidebar to-sidebar-2 px-4 py-5">
            <div className="flex items-center justify-between px-2">
              <Logo name={me.company.name} light />
              <button onClick={() => setDrawer(false)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavLinks onDark />
            </div>
            <IntegrationCard />
          </aside>
        </div>
      )}

      <Topbar onMenu={() => setDrawer(true)} />
      <main className="app-main mx-auto max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {[NAV[0], NAV[1], NAV[4], NAV[3]].map((n) => {
            const active = isActive(n.href);
            const count = n.badge === "inbox" ? (inbox?.counts.unread ?? 0) : 0;
            return (
              <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold", active ? "text-brand" : "text-muted")}>
                <span className="relative">
                  <n.icon className="h-[21px] w-[21px]" />
                  {count > 0 && <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-[#25D366] px-1 text-center text-[10px] font-bold leading-4 text-[#073B2F] ring-2 ring-surface">{count}</span>}
                </span>
                {n.label.replace("WhatsApp ", "")}
              </Link>
            );
          })}
          <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold text-muted">
            <MenuIcon className="h-[21px] w-[21px]" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

function IntegrationCard() {
  const me = useMe();
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Automation</p>
      <div className="mt-2 space-y-1.5 text-[12.5px] font-medium text-white/80">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", me.integrations.ai === "claude" ? "bg-[#4ADE80]" : "bg-accent")} />
          AI replies: {me.integrations.ai === "claude" ? "Claude (live)" : "Built-in demo AI"}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", me.integrations.whatsapp ? "bg-[#25D366]" : "bg-white/30")} />
          WhatsApp API: {me.integrations.whatsapp ? "Connected" : "Not connected"}
        </div>
      </div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const me = useMe();
  const router = useRouter();
  const { toast } = useUi();
  const [newLead, setNewLead] = useState(false);
  const [newFu, setNewFu] = useState(false);
  const [pwd, setPwd] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="-ml-1 rounded-xl p-2 text-ink/80 hover:bg-surface-2 lg:hidden" aria-label="Open menu">
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="hidden truncate font-display text-[16px] font-extrabold tracking-tight min-[400px]:block">{me.company.name}</span>
        </div>
        <div className="hidden flex-1 md:block">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <button onClick={() => setMobileSearch(true)} className="rounded-xl p-2 text-ink/80 hover:bg-surface-2 md:hidden" aria-label="Search">
            <Search className="h-5 w-5" />
          </button>
          <Menu
            trigger={() => (
              <Button size="sm" className="h-9 px-2.5 sm:px-3.5" icon={<Plus className="h-4 w-4" />}>
                <span className="hidden sm:inline">New</span>
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon={<Target className="h-4 w-4 text-brand" />} onClick={() => (close(), setNewLead(true))}>
                  New lead
                </MenuItem>
                <MenuItem icon={<CalendarClock className="h-4 w-4 text-sun" />} onClick={() => (close(), setNewFu(true))}>
                  Schedule follow-up
                </MenuItem>
                <MenuItem icon={<Contact className="h-4 w-4 text-sky" />} onClick={() => (close(), router.push("/customers?new=1"))}>
                  New customer
                </MenuItem>
                <MenuItem icon={<ReceiptText className="h-4 w-4 text-leaf" />} onClick={() => (close(), router.push("/invoices/new"))}>
                  New invoice
                </MenuItem>
              </>
            )}
          </Menu>
          <Notifications />
          <ThemeToggle className="hidden rounded-xl p-2 text-ink/80 hover:bg-surface-2 sm:block" />
          <Menu
            trigger={() => (
              <button className="ml-0.5 flex items-center gap-2 rounded-full p-0.5 hover:bg-surface-2 sm:pr-3" aria-label="Account menu">
                <Avatar name={me.user.name} color="rgb(var(--brand))" size={34} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[13px] font-bold">{me.user.name.split(" ")[0]}</span>
                  <span className="block text-[11px] capitalize text-muted">{me.user.role === "agent" ? "Sales agent" : "Admin"}</span>
                </span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 pb-2 pt-1.5">
                  <p className="text-sm font-bold">{me.user.name}</p>
                  <p className="text-xs text-muted">{me.user.email}</p>
                </div>
                <MenuItem icon={<KeyRound className="h-4 w-4" />} onClick={() => (close(), setPwd(true))}>
                  Change password
                </MenuItem>
                <div className="sm:hidden">
                  <MenuItem icon={<CircleUserRound className="h-4 w-4" />}>
                    <ThemeToggle className="flex items-center gap-2" /> Theme
                  </MenuItem>
                </div>
                <MenuItem icon={<LogOut className="h-4 w-4" />} danger onClick={logout}>
                  Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>
      {mobileSearch && (
        <div className="fixed inset-0 z-[75] bg-bg p-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <GlobalSearch autoFocus onNavigate={() => setMobileSearch(false)} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setMobileSearch(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <LeadFormModal open={newLead} onClose={() => setNewLead(false)} onSaved={(id) => router.push(`/leads/${id}`)} />
      <FollowUpFormModal open={newFu} onClose={() => setNewFu(false)} onSaved={() => (toast("Follow-up scheduled"), router.push("/follow-ups"))} />
      <PasswordModal open={pwd} onClose={() => setPwd(false)} />
    </header>
  );
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const { toast } = useUi();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      await api(`/api/users/${me.user.id}`, { method: "PATCH", body: { currentPassword: cur, password: next } });
      toast("Password updated");
      setCur("");
      setNext("");
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm" footer={<Button onClick={save} loading={busy} disabled={!cur || next.length < 8}>Update password</Button>}>
      <div className="space-y-3">
        <Field label="Current password">
          <input type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password" hint="At least 8 characters" error={err}>
          <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  );
}

function Notifications() {
  const { data, mutate } = useApi<Notif>("/api/notifications", { refreshInterval: 45000 });
  const router = useRouter();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => setPerm(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"), []);
  // Desktop alerts for new notifications and follow-ups that become due (only for items that appear after page load)
  useEffect(() => {
    if (!data) return;
    const items = [
      ...data.reminders.map((r) => ({ id: "r" + r._id, title: `⏰ Follow-up due: ${r.title}`, body: r.lead?.name ?? r.customer?.name ?? "", link: "/follow-ups" })),
      ...data.items.filter((n) => !n.read).map((n) => ({ id: "n" + n._id, title: n.title, body: n.body, link: n.link })),
    ];
    if (!seen.current) {
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    for (const i of items) {
      if (seen.current.has(i.id)) continue;
      seen.current.add(i.id);
      if (perm === "granted") {
        try {
          const n = new Notification(i.title, { body: i.body, icon: "/brand/favicon-64.png", tag: i.id });
          n.onclick = () => {
            window.focus();
            if (i.link) router.push(i.link);
          };
        } catch {}
      }
    }
  }, [data, perm, router]);
  const count = (data?.unread ?? 0) + (data?.reminders.length ?? 0);
  const markAll = async () => {
    await api("/api/notifications", { body: {} });
    mutate();
  };
  return (
    <Menu
      trigger={() => (
        <button className="relative rounded-xl p-2 text-ink/80 hover:bg-surface-2" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {count > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{count > 9 ? "9+" : count}</span>}
        </button>
      )}
    >
      {(close) => (
        <div className="w-[min(92vw,360px)]">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-display font-bold">Notifications</p>
            {!!data?.unread && (
              <button className="text-xs font-semibold text-brand" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {perm === "default" && (
            <button onClick={async () => setPerm(await Notification.requestPermission())} className="mx-1 mb-1.5 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-left text-xs font-semibold text-brand-ink">
              <Bell className="h-3.5 w-3.5" /> Enable desktop alerts for reminders & new leads
            </button>
          )}
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
            {data?.reminders.map((r) => (
              <button key={r._id} onClick={() => (close(), router.push("/follow-ups"))} className="flex w-full gap-3 rounded-xl bg-sun-soft/60 px-3 py-2.5 text-left hover:bg-sun-soft">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{r.title}</p>
                  <p className="text-xs text-muted">
                    {r.lead?.name ?? r.customer?.name} · {new Date(r.dueAt) < new Date() ? "overdue" : "due"} {timeAgo(r.dueAt)}
                  </p>
                </div>
              </button>
            ))}
            {data?.items.length === 0 && !data.reminders.length && <p className="px-3 py-8 text-center text-sm text-muted">You&apos;re all caught up ✨</p>}
            {data?.items.map((n) => (
              <button
                key={n._id}
                onClick={async () => {
                  close();
                  if (!n.read) await api("/api/notifications", { body: { ids: [n._id] } }).then(() => mutate());
                  if (n.link) router.push(n.link);
                }}
                className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2"
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{n.title}</p>
                  {n.body && <p className="line-clamp-2 text-xs text-muted">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Menu>
  );
}

type SearchRes = { leads: { _id: string; name: string; phone: string; status: string; destination: string }[]; customers: { _id: string; name: string; phone: string; city: string }[]; invoices: { _id: string; number: string; total: number; status: string; tripTitle: string }[] };

function GlobalSearch({ autoFocus, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, []);
  const { data } = useApi<SearchRes>(debounced.length >= 2 ? `/api/search?q=${encodeURIComponent(debounced)}` : null);
  const go = (href: string) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    router.push(href);
  };
  const empty = data && !data.leads.length && !data.customers.length && !data.invoices.length;
  return (
    <div ref={ref} className="relative max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        placeholder="Search leads, customers, invoices…"
        className="input h-10 rounded-full bg-surface pl-9 pr-14"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 text-[10px] font-semibold text-muted md:block">Ctrl K</kbd>
      {open && debounced.length >= 2 && data && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 animate-scale-in rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {empty && <p className="px-3 py-6 text-center text-sm text-muted">No matches for “{debounced}”</p>}
          {!!data.leads.length && <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Leads</p>}
          {data.leads.map((l) => (
            <button key={l._id} onClick={() => go(`/leads/${l._id}`)} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-surface-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{l.name}</span>
                <span className="block text-xs text-muted">
                  {displayPhone(l.phone)} {l.destination && `· ${l.destination}`}
                </span>
              </span>
              <LeadStatusBadge status={l.status} />
            </button>
          ))}
          {!!data.customers.length && <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Customers</p>}
          {data.customers.map((c) => (
            <button key={c._id} onClick={() => go(`/customers/${c._id}`)} className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-surface-2">
              <span className="text-sm font-semibold">{c.name}</span>
              <span className="text-xs text-muted">
                {displayPhone(c.phone)} {c.city && `· ${c.city}`}
              </span>
            </button>
          ))}
          {!!data.invoices.length && <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Invoices</p>}
          {data.invoices.map((i) => (
            <button key={i._id} onClick={() => go(`/invoices/${i._id}`)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-surface-2">
              <span>
                <span className="block text-sm font-semibold">{i.number}</span>
                <span className="block text-xs text-muted">
                  {money(i.total)} {i.tripTitle && `· ${i.tripTitle}`}
                </span>
              </span>
              <InvoiceStatusBadge status={i.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

