import { body, HttpError, oid, requireUser, route, searchParams } from "@/lib/api";
import { findLine, loadTour, prepareLine } from "@/lib/services/tour-api";
import { Tour } from "@/lib/models";
import { TourLineInput } from "@/lib/validators";
import { paidOf, reverseMovement, SECTIONS, type Section } from "@/lib/services/tours";
import type { Types } from "mongoose";

type P = { id: string; lineId: string };


export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id, lineId } = await params;
  const data = await body(req, TourLineInput);
  const { t, line } = await findLine(id, lineId, data.section);
  if (line.stockMovement) throw new HttpError(409, "This line came from store stock. Delete it and issue the stock again to change it.");
  const { line: next } = await prepareLine(data);
  if ((next.amount as number) + 0.001 < paidOf(line)) throw new HttpError(400, "Amount can't be less than what's already been paid. Remove a payment first.");
  line.set(next);
  await t.save();
  return loadTour(id);
});

export const DELETE = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id, lineId } = await params;
  const { t, line } = await findLine(id, lineId, searchParams(req).get("section"));
  const mv = line.stockMovement;
  line.deleteOne();
  await t.save();
  if (mv) await reverseMovement(mv, { keepTourLine: true }).catch(() => undefined); // returns stock to the store
  return loadTour(id);
});
