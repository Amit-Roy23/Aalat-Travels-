import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Itinerary } from "@/lib/models";
import { ItineraryInput } from "@/lib/validators";
import { resolveGuest } from "@/lib/services/itineraries";
import { getSettings } from "@/lib/services/settings";
import { logActivity } from "@/lib/services/activity";

type P = { id: string };

export const GET = route<P>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const it = await Itinerary.findById(oid(id)).populate("customer", "name phone email").populate("lead", "name phone").populate("invoice", "number total status").lean();
  if (!it) throw new HttpError(404, "Itinerary not found.");
  const s = await getSettings();
  return { itinerary: it, company: s.company };
});

export const PATCH = route<P>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const it = await Itinerary.findById(oid(id));
  if (!it) throw new HttpError(404, "Itinerary not found.");
  const data = await body(req, ItineraryInput.partial());
  if (data.customer !== undefined || data.lead !== undefined || data.guestName !== undefined) {
    const guest = await resolveGuest(user, { customer: data.customer ?? null, lead: data.lead ?? null, guestName: data.guestName ?? it.guestName });
    it.set({ customer: guest.customer ?? undefined, lead: guest.lead ?? undefined, guestName: guest.guestName });
  }
  const before = it.status;
  for (const [k, v] of Object.entries(data)) {
    if (["customer", "lead", "guestName"].includes(k) || v === undefined) continue;
    it.set(k, k === "startDate" ? v || undefined : v);
  }
  await it.save();
  if (it.lead && data.status && data.status !== before) await logActivity({ lead: it.lead, type: "note", message: `Itinerary “${it.title}” marked ${data.status === "sent" ? "sent to customer" : data.status}`, user: user._id });
  return { itinerary: it };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const it = await Itinerary.findById(oid(id));
  if (!it) throw new HttpError(404, "Itinerary not found.");
  await it.deleteOne();
  return { ok: true };
});
