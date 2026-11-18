import { useId } from "react";
import { cn } from "@/lib/format";

export function LogoMark({ className }: { className?: string }) {
  const gid = "lm" + useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E11D48" />
          <stop offset="1" stopColor="#881337" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <path d="M14 45 31 14h3l16 31h-7l-3.6-7H24l-3.5 7z" fill="#fff" />
      <path d="M26.7 32.5h10.2L31.8 22z" fill="#BE123C" />
      <path d="M9 41c10-4 27-6.5 46-15l-6 8.5c-11 4-25 6.5-40 6.5z" fill="#E8AA42" />
    </svg>
  );
}

export function Logo({ name = "Aalat Travels", light }: { name?: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <p className={cn("font-display text-[17px] font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>{name}</p>
        <p className={cn("mt-1 text-[10px] font-bold uppercase tracking-[0.18em]", light ? "text-accent" : "text-brand")}>Travel CRM</p>
      </div>
    </div>
  );
}
