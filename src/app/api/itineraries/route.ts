/* eslint-disable @typescript-eslint/no-explicit-any */
import { body, escapeRegex, paging, requireUser, route, searchParams } from "@/lib/api";
import { Itinerary } from "@/lib/models";
import { ItineraryInput } from "@/lib/validators";
import { itineraryToken, itineraryTotal, resolveGuest } from "@/lib/services/itineraries";
import { logActivity } from "@/lib/services/activity";

export const GET = route(async (req) => {
  await requireUser();
  const sp = searchParams(req);
  const filter: Record<string, any> = {};
  const q = sp.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: rx }, { guestName: rx }, { destination: rx }];
  }
  if (sp.get("status")) filter.status = sp.get("status");
  if (sp.get("lead")) filter.lead = sp.get("lead");
  if (sp.get("customer")) filter.customer = sp.get("customer");
  const { page, limit, skip } = paging(sp, 24, 100);
  const [items, total] = await Promise.all([
    Itinerary.find(filter, { title: 1, guestName: 1, destination: 1, startDate: 1, adults: 1, children: 1, pricePerAdult: 1, pricePerChild: 1, status: 1, updatedAt: 1, days: { $slice: 0 }, invoice: 1 })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Itinerary.countDocuments(filter),
  ]);
  const counts = await Itinerary.aggregate([{ $match: { _id: { $in: items.map((i) => i._id) } } }, { $project: { n: { $size: "$days" } } }]);
  const dayCount = new Map(counts.map((c) => [String(c._id), c.n]));
  return {
    items: items.map((i) => ({ ...i, dayCount: dayCount.get(String(i._id)) ?? 0, total: itineraryTotal(i) })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const data = await body(req, ItineraryInput);
  const guest = await resolveGuest(user, data);
  const it = await Itinerary.create({ ...data, ...guest, startDate: data.startDate || undefined, shareToken: itineraryToken(), createdBy: user._id });
  if (guest.lead) await logActivity({ lead: guest.lead as never, type: "note", message: `Itinerary created: ${it.title}`, user: user._id });
  return { itinerary: it };
});
