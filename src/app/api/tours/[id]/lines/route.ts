import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { loadTour, prepareLine } from "@/lib/services/tour-api";
import { Staff, Tour, Vendor } from "@/lib/models";
import { TourLineInput } from "@/lib/validators";
import { round2 } from "@/lib/format";
import type { z } from "zod";

type P = { id: string };
type LineIn = z.infer<typeof TourLineInput>;


export const POST = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const t = await Tour.findById(oid(id));
  if (!t) throw new HttpError(404, "Tour not found.");
  const data = await body(req, TourLineInput);
  const { section, line } = await prepareLine(data);
  const adv = round2(data.advance || 0);
  if (adv > (line.amount as number) + 0.001) throw new HttpError(400, "Advance can't be more than the total amount.");
  line.payments = adv > 0 ? [{ amount: adv, date: data.advanceDate || new Date(), method: data.advanceMethod, note: "Advance" }] : [];
  (t[section] as unknown as { push: (x: unknown) => void }).push(line);
  await t.save();
  return loadTour(id);
});
