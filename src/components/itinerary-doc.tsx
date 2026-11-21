// Branded, printable itinerary (Aalat red + yellow), used for the editor preview, the share link and printing.
import { BedDouble, Bus, CheckCircle2, MapPin, Sparkles, Utensils, XCircle } from "lucide-react";
import { fmtDate, money } from "@/lib/format";

const RED = "#C80E16";
const YEL = "#F8C00B";

export type ItineraryDay = { title: string; description?: string; stay?: string; meals?: { breakfast?: boolean; lunch?: boolean; dinner?: boolean }; activities?: string; transport?: string };
export type ItineraryDocData = {
  title: string;
  guestName?: string;
  destination?: string;
  startDate?: string | null;
  adults?: number;
  children?: number;
  startPoint?: string;
  endPoint?: string;
  days: ItineraryDay[];
  inclusions?: string;
  exclusions?: string;
  pricePerAdult?: number;
  pricePerChild?: number;
  priceNote?: string;
};
export type ItineraryCompany = { name?: string; tagline?: string; phone?: string; email?: string; address?: string; logo?: string };

export function dayDate(start: string | null | undefined, i: number) {
  if (!start) return null;
  const d = new Date(start);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + i * 86400000);
}
export function durationLabel(days: number) {
  if (!days) return "";
  return days === 1 ? "1 Day" : `${days - 1} Night${days - 1 > 1 ? "s" : ""} / ${days} Days`;
}
const lines = (s?: string) => (s ?? "").split("\n").map((l) => l.replace(/^[-•*✓✔]\s*/, "").trim()).filter(Boolean);

export function ItineraryDocument({ it, company }: { it: ItineraryDocData; company: ItineraryCompany }) {
  const end = dayDate(it.startDate, Math.max(it.days.length - 1, 0));
  const total = (it.adults ?? 0) * (it.pricePerAdult ?? 0) + (it.children ?? 0) * (it.pricePerChild ?? 0);
  const inc = lines(it.inclusions);
  const exc = lines(it.exclusions);
  const pax = [it.adults ? `${it.adults} Adult${it.adults > 1 ? "s" : ""}` : "", it.children ? `${it.children} Child${it.children > 1 ? "ren" : ""}` : ""].filter(Boolean).join(" + ");
  const facts = [
    ["Guest", it.guestName],
    ["Destination", it.destination],
    ["Dates", it.startDate ? `${fmtDate(it.startDate)}${end && it.days.length > 1 ? ` – ${fmtDate(end)}` : ""}` : ""],
    ["Duration", durationLabel(it.days.length)],
    ["Travellers", pax],
    ["Start / End", [it.startPoint, it.endPoint].filter(Boolean).join(" → ")],
  ].filter(([, v]) => v);

  return (
    <article className="itinerary-doc mx-auto w-full max-w-[820px] overflow-hidden border-[2.5px] bg-[#fffdf8] text-[13px] leading-relaxed text-[#1d1d1f] shadow-card" style={{ borderColor: RED }}>
      <div className="flex h-[7px]">
        <div className="flex-[3]" style={{ background: RED }} />
        <div className="flex-[2]" style={{ background: YEL }} />
      </div>
      <header className="flex items-center gap-3 px-4 pb-3 pt-4 sm:gap-5 sm:px-7">
        <img src={company.logo || "/brand/aalat-seal.png"} alt="" className="h-16 w-16 shrink-0 rounded-full object-contain sm:h-20 sm:w-20" />
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-sm px-3 py-[1px] text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ background: YEL, color: RED, boxShadow: `2px 2px 0 ${RED}` }}>
            Travel Itinerary
          </span>
          <h1 className="mt-1.5 font-display text-[22px] font-extrabold leading-tight sm:text-[30px]" style={{ color: RED }}>
            {it.title}
          </h1>
          <p className="text-[12px] font-semibold text-[#6b6b6b]">
            {company.name || "Aalat Travels"}
            {company.tagline && ` — ${company.tagline}`}
          </p>
        </div>
      </header>
      {facts.length > 0 && (
        <dl className="mx-4 mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border-[1.5px] p-3 sm:mx-7 sm:grid-cols-3" style={{ borderColor: YEL, background: "#FFF8DF" }}>
          {facts.map(([l, v]) => (
            <div key={l} className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RED }}>
                {l}
              </dt>
              <dd className="truncate font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="px-4 sm:px-7">
        <h2 className="mb-3 py-1 text-center text-[12px] font-bold uppercase tracking-[0.18em] text-white" style={{ background: RED, borderBottom: `3px solid ${YEL}` }}>
          Day-wise plan
        </h2>
        {it.days.length === 0 && <p className="py-6 text-center text-[#888]">No days added yet.</p>}
        <ol className="space-y-3">
          {it.days.map((d, i) => {
            const date = dayDate(it.startDate, i);
            const meals = [d.meals?.breakfast && "Breakfast", d.meals?.lunch && "Lunch", d.meals?.dinner && "Dinner"].filter(Boolean).join(" · ");
            return (
              <li key={i} className="itinerary-day flex gap-3" style={{ breakInside: "avoid" }}>
                <div className="flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 text-center text-white sm:w-16" style={{ background: RED }}>
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: YEL }}>
                    Day
                  </span>
                  <span className="font-display text-xl font-extrabold leading-none">{i + 1}</span>
                  {date && <span className="mt-0.5 text-[9.5px] font-semibold opacity-90">{fmtDate(date, { day: "numeric", month: "short" })}</span>}
                </div>
                <div className="min-w-0 flex-1 border-b border-dashed pb-3" style={{ borderColor: "#E7B92E" }}>
                  <p className="font-bold text-[14px]">{d.title || `Day ${i + 1}`}</p>
                  {d.description && <p className="mt-0.5 whitespace-pre-line text-[#333]">{d.description}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#444]">
                    {d.activities && (
                      <span className="inline-flex items-start gap-1">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: RED }} /> {d.activities}
                      </span>
                    )}
                    {d.stay && (
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5" style={{ color: RED }} /> Stay: <b>{d.stay}</b>
                      </span>
                    )}
                    {meals && (
                      <span className="inline-flex items-center gap-1">
                        <Utensils className="h-3.5 w-3.5" style={{ color: RED }} /> {meals}
                      </span>
                    )}
                    {d.transport && (
                      <span className="inline-flex items-center gap-1">
                        <Bus className="h-3.5 w-3.5" style={{ color: RED }} /> {d.transport}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {(inc.length > 0 || exc.length > 0) && (
        <section className="mt-4 grid gap-3 px-4 sm:grid-cols-2 sm:px-7" style={{ breakInside: "avoid" }}>
          {inc.length > 0 && (
            <div className="rounded-xl border-[1.5px] p-3" style={{ borderColor: "#cfe9d6" }}>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#1d7a43]">Inclusions</p>
              <ul className="space-y-0.5">
                {inc.map((l) => (
                  <li key={l} className="flex gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1d7a43]" /> {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {exc.length > 0 && (
            <div className="rounded-xl border-[1.5px] p-3" style={{ borderColor: "#f3c9cb" }}>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: RED }}>
                Exclusions
              </p>
              <ul className="space-y-0.5">
                {exc.map((l) => (
                  <li key={l} className="flex gap-1.5">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: RED }} /> {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {total > 0 && (
        <section className="mx-4 mt-4 rounded-xl p-3 sm:mx-7" style={{ background: "#FFF5D1", boxShadow: `inset 0 0 0 1.5px ${YEL}`, breakInside: "avoid" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[12.5px]">
              {!!it.pricePerAdult && (
                <p>
                  {money(it.pricePerAdult)} per adult{it.adults ? ` × ${it.adults}` : ""}
                </p>
              )}
              {!!it.pricePerChild && !!it.children && (
                <p>
                  {money(it.pricePerChild)} per child × {it.children}
                </p>
              )}
              {it.priceNote && <p className="text-[#6b6b6b]">{it.priceNote}</p>}
            </div>
            <p className="font-display text-xl font-extrabold" style={{ color: RED }}>
              Total {money(total)}
            </p>
          </div>
        </section>
      )}

      <footer className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-center text-[11.5px] font-semibold text-white" style={{ background: RED, borderTop: `3px solid ${YEL}` }}>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {company.address || company.name}
        </span>
        {company.phone && <span>📞 {company.phone}</span>}
        {company.email && <span>✉ {company.email}</span>}
      </footer>
    </article>
  );
}
