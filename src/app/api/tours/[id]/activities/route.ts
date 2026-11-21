import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Tour } from "@/lib/models";
import { ActivitiesInput } from "@/lib/validators";
import { loadTour } from "@/lib/services/tour-api";

type P = { id: string };

// Activity price list for this departure (e.g. Jeep safari ₹700, Camel ride ₹200 per person)
export const PUT = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const { activities } = await body(req, ActivitiesInput);
  const names = activities.map((a) => a.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) throw new HttpError(400, "Each activity needs a different name.");
  const r = await Tour.updateOne({ _id: oid(id) }, { activities });
  if (!r.matchedCount) throw new HttpError(404, "Tour not found.");
  return loadTour(id);
});
