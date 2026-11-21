import { HttpError, route } from "@/lib/api";
import { Itinerary } from "@/lib/models";
import { getSettings } from "@/lib/services/settings";

export const GET = route<{ token: string }>(async (_req, { params }) => {
  const { token } = await params;
  if (!token || token.length < 10) throw new HttpError(404, "Itinerary not found.");
  const it = await Itinerary.findOne({ shareToken: token }, { createdBy: 0, notes: 0, lead: 0, customer: 0, invoice: 0 }).lean();
  if (!it) throw new HttpError(404, "Itinerary not found.");
  const s = await getSettings();
  return { itinerary: it, company: { name: s.company?.name, tagline: s.company?.tagline, phone: s.company?.phone, email: s.company?.email, address: s.company?.address, logo: s.company?.logo } };
});
