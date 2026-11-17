import { cn } from "@/lib/format";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0D1B2A" />
      <path d="M14 44 31 14h3l16 30h-7l-3.6-7H24l-3.5 7z" fill="#2CC2AE" />
      <path d="M26.7 31.5h10.2L31.8 21z" fill="#0D1B2A" />
      <path d="M10 40c10-4 26-6 44-14l-6 8c-11 4-24 6-38 6z" fill="#F0B43C" />
    </svg>
  );
}

export function Logo({ name = "Aalat Travels", light }: { name?: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <p className={cn("font-display text-[17px] font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>{name}</p>
        <p className={cn("mt-1 text-[10px] font-bold uppercase tracking-[0.18em]", light ? "text-[#2CC2AE]" : "text-brand")}>Travel CRM</p>
      </div>
    </div>
  );
}
