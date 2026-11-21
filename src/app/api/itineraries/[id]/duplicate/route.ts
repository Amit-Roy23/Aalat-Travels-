import { HttpError, oid, requireUser, route } from "@/lib/api";
import { Itinerary } from "@/lib/models";
import { itineraryToken } from "@/lib/services/itineraries";

/** Copies an itinerary (e.g. to reuse a popular plan for another guest). */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const src = await Itinerary.findById(oid(id)).lean();
  if (!src) throw new HttpError(404, "Itinerary not found.");
  const { _id, createdAt, updatedAt, shareToken, invoice, ...rest } = src as typeof src & { createdAt?: Date; updatedAt?: Date };
  void _id; void createdAt; void updatedAt; void shareToken; void invoice;
  const copy = await Itinerary.create({
    ...rest,
    title: `${src.title} (copy)`,
    days: ((src.days ?? []) as Record<string, unknown>[]).map((d) => {
      const { _id: _d, ...day } = d as typeof d & { _id?: unknown };
      void _d;
      return day;
    }),
    status: "draft",
    shareToken: itineraryToken(),
    createdBy: user._id,
    isDemo: false,
  });
  return { itinerary: copy };
});
