import { LogoMark } from "@/components/logo";

/** Decorative brand panel with a dotted flight route, used on the login & setup pages. */
export function AuthArt() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-sidebar via-sidebar-2 to-[#6b1032] p-10 text-white lg:flex lg:flex-col">
      <div className="flex items-center gap-3">
        <LogoMark className="h-11 w-11" />
        <div>
          <p className="font-display text-xl font-extrabold tracking-tight">Aalat Travels</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Travel CRM</p>
        </div>
      </div>
      <svg className="absolute inset-0 h-full w-full opacity-90" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id="g1" cx="80%" cy="20%" r="60%">
            <stop offset="0" stopColor="#E11D48" stopOpacity=".28" />
            <stop offset="1" stopColor="#E11D48" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="g2" cx="10%" cy="90%" r="60%">
            <stop offset="0" stopColor="#E8AA42" stopOpacity=".22" />
            <stop offset="1" stopColor="#E8AA42" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="600" height="800" fill="url(#g1)" />
        <rect width="600" height="800" fill="url(#g2)" />
        <path d="M60 640 C 180 520, 260 600, 330 450 S 470 260, 540 170" fill="none" stroke="#E8AA42" strokeWidth="2.5" strokeDasharray="2 10" strokeLinecap="round" />
        <circle cx="60" cy="640" r="7" fill="#FB7185" />
        <circle cx="330" cy="450" r="5" fill="#fff" fillOpacity=".7" />
        <circle cx="540" cy="170" r="9" fill="#E8AA42" />
        <g transform="translate(520 182) rotate(-38)">
          <path d="M0 0 L22 -6 L26 0 L22 6 Z" fill="#fff" />
        </g>
      </svg>
      <div className="relative mt-auto max-w-md">
        <p className="font-display text-[34px] font-extrabold leading-[1.1] tracking-tight">
          Every enquiry, every follow-up, <span className="text-hl">every journey</span> — in one place.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-white/65">Capture leads from ads and WhatsApp, let AI reply in 90+ languages, and turn conversations into confirmed bookings.</p>
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          {[
            ["24/7", "AI replies"],
            ["90+", "Languages"],
            ["0", "Missed leads"],
          ].map(([a, b]) => (
            <div key={b} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
              <p className="font-display text-2xl font-extrabold">{a}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
