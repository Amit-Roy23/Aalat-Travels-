// Builds a starting day-by-day plan from a tour package (Settings → AI & knowledge base → Packages).
export type PackageLike = { name: string; destination: string; duration?: string; pricePerPerson: number; inclusions?: string; highlights?: string };
export type DayDraft = { title: string; description: string; stay: string; meals: { breakfast: boolean; lunch: boolean; dinner: boolean }; activities: string; transport: string };

export function daysFromDuration(duration?: string) {
  const d = duration?.match(/(\d+)\s*D/i);
  const n = duration?.match(/(\d+)\s*N/i);
  return d ? +d[1] : n ? +n[1] + 1 : 0;
}

export function blankDay(title = ""): DayDraft {
  return { title, description: "", stay: "", meals: { breakfast: false, lunch: false, dinner: false }, activities: "", transport: "" };
}

export function planFromPackage(p: PackageLike) {
  const count = Math.min(Math.max(daysFromDuration(p.duration) || 4, 1), 30);
  const sights = (p.highlights ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const breakfast = /breakfast|meal|map|ap\b/i.test(p.inclusions ?? "");
  const dinner = /dinner|map|ap\b|all meals/i.test(p.inclusions ?? "");
  const days: DayDraft[] = [];
  for (let i = 0; i < count; i++) {
    const first = i === 0;
    const last = i === count - 1 && count > 1;
    const sight = sights[(i - 1 + sights.length) % Math.max(sights.length, 1)];
    days.push({
      title: first ? `Arrival in ${p.destination}` : last ? `Departure from ${p.destination}` : sight ? `${sight}` : `${p.destination} sightseeing`,
      description: first
        ? `Arrive at ${p.destination}. Our representative meets you and transfers you to the hotel. Check in and relax.`
        : last
          ? "After breakfast, check out and transfer for your onward journey with sweet memories."
          : sight
            ? `After breakfast, proceed for ${sight}. Return to the hotel in the evening.`
            : "Full day of sightseeing. Return to the hotel in the evening.",
      stay: last ? "" : `${p.destination} hotel`,
      meals: { breakfast: !first && breakfast, lunch: false, dinner: !last && dinner },
      activities: !first && !last && sight ? sight : "",
      transport: first ? "Airport / station pickup" : last ? "Drop to airport / station" : "Private vehicle",
    });
  }
  return {
    title: p.name,
    destination: p.destination,
    days,
    inclusions: (p.inclusions ?? "").split(/,|\n/).map((s) => s.trim()).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join("\n"),
    exclusions: "Flights / train tickets unless mentioned\nLunch unless mentioned\nEntry tickets and personal expenses\nAnything not mentioned in inclusions",
    pricePerAdult: p.pricePerPerson,
    pricePerChild: Math.round(p.pricePerPerson * 0.7),
    priceNote: "Per person on twin sharing. Child (3–7 years) at 70% as per our child policy.",
  };
}
