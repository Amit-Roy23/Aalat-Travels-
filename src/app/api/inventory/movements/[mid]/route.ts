import { HttpError, oid, requireUser, route } from "@/lib/api";
import { StockMovement } from "@/lib/models";
import { reverseMovement } from "@/lib/services/tours";
import { round2 } from "@/lib/format";
import { z } from "zod";

type P = { mid: string };

// Record a payment to the vendor against a store purchase
export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const mv = await StockMovement.findById(oid((await params).mid));
  if (!mv || mv.type !== "in") throw new HttpError(404, "Purchase not found.");
  const { paid } = z.object({ paid: z.coerce.number().min(0) }).parse(await req.json());
  if (paid > mv.amount + 0.001) throw new HttpError(400, "Paid can't be more than the purchase amount.");
  mv.paid = round2(paid);
  await mv.save();
  return { movement: mv };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  await reverseMovement(oid((await params).mid));
  return { ok: true };
});
