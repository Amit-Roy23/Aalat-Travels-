import { cn } from "@/lib/format";

/** Official Aalat emblem on a white tile (reads well on light and dark backgrounds). */
export function LogoMark({ className }: { className?: string }) {
  return <img src="/brand/aalat-icon.png" alt="Aalat Travels" width={36} height={36} className={cn("h-9 w-9 shrink-0 rounded-[10px] shadow-sm ring-1 ring-black/5", className)} />;
}

/** Full round Aalat seal ("Aalat Travels & Events"). */
export function LogoSeal({ className }: { className?: string }) {
  return <img src="/brand/aalat-seal.png" alt="Aalat Travels & Events" className={cn("h-24 w-24 rounded-full", className)} />;
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
