"use client";
import { Fragment, type ReactNode } from "react";
import { Bot, Check, CheckCheck, Clock, AlertCircle, UserRound, ChevronLeft, MoreVertical, Phone, Video } from "lucide-react";
import { cn, fmtTime } from "@/lib/format";

/** Renders WhatsApp markdown: *bold*, _italic_, ~strike~ and line breaks. */
export function WaText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {line.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g).map((part, i) => {
            if (/^\*[^*]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
            if (/^_[^_]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
            if (/^~[^~]+~$/.test(part)) return <s key={i}>{part.slice(1, -1)}</s>;
            return <Fragment key={i}>{part}</Fragment>;
          })}
          {li < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

export type BubbleMsg = { direction: "in" | "out"; sender: string; body: string; createdAt?: string; status?: string; agentName?: string; error?: string };

export function Bubble({ m, compact }: { m: BubbleMsg; compact?: boolean }) {
  const out = m.direction === "out";
  const rtl = /[؀-ۿ]/.test(m.body.slice(0, 40));
  return (
    <div className={cn("flex animate-fade-up", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[86%] rounded-2xl px-3 pb-1.5 pt-2 text-[14px] leading-[1.45] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] sm:max-w-[75%]",
          compact && "text-[13px]",
          out ? "rounded-tr-md bg-wa-bubble text-ink" : "rounded-tl-md bg-surface text-ink",
        )}
      >
        {out && m.sender !== "customer" && (
          <p className={cn("mb-0.5 flex items-center gap-1 text-[11px] font-bold", m.sender === "ai" ? "text-brand" : "text-sky")}>
            {m.sender === "ai" ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {m.sender === "ai" ? "AI Assistant" : m.agentName || "Agent"}
          </p>
        )}
        <div dir={rtl ? "rtl" : "auto"} className="whitespace-pre-wrap break-words">
          <WaText text={m.body} />
        </div>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-muted">
          {m.createdAt && fmtTime(m.createdAt)}
          {out && <Tick status={m.status} />}
        </div>
        {m.status === "failed" && m.error && <p className="mt-1 flex items-start gap-1 text-[11px] text-coral"><AlertCircle className="mt-px h-3 w-3 shrink-0" />{m.error}</p>}
      </div>
    </div>
  );
}

function Tick({ status }: { status?: string }) {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-[#34B7F1]" />;
  if (status === "delivered" || status === "simulated") return <CheckCheck className="h-3.5 w-3.5" />;
  if (status === "queued") return <Clock className="h-3 w-3" />;
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-coral" />;
  return <Check className="h-3.5 w-3.5" />;
}

export function Typing() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-surface px-3.5 py-3 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-blink rounded-full bg-muted" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  );
}

/** A phone mock-up framing a WhatsApp chat. */
export function PhoneFrame({ name, subtitle, children, footer, avatar }: { name: string; subtitle?: string; children: ReactNode; footer?: ReactNode; avatar?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[380px] rounded-[44px] bg-[#0b0f14] p-2.5 shadow-pop ring-1 ring-black/40">
      <div className="relative flex h-[min(720px,78dvh)] flex-col overflow-hidden rounded-[36px] bg-bg">
        <div className="absolute left-1/2 top-2 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />
        <div className="flex items-center gap-2 bg-[#075E54] px-3 pb-2.5 pt-10 text-white dark:bg-[#1F2C34]">
          <ChevronLeft className="h-5 w-5 opacity-90" />
          {avatar}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-semibold">{name}</p>
            {subtitle && <p className="truncate text-[11.5px] text-white/75">{subtitle}</p>}
          </div>
          <Video className="h-5 w-5 opacity-90" />
          <Phone className="ml-3 h-[18px] w-[18px] opacity-90" />
          <MoreVertical className="ml-2 h-5 w-5 opacity-90" />
        </div>
        <div className="wa-wallpaper scrollbar-thin flex-1 space-y-2 overflow-y-auto px-3 py-3">{children}</div>
        {footer}
      </div>
    </div>
  );
}
