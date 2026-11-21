// Tour operation file maths: every cost line has amount, paid (advance so far) and due.
import { Types } from "mongoose";
import { InventoryItem, StockMovement, Tour } from "../models";
import { HttpError } from "../api";
import { round2 } from "../format";
import { EXPENSE_CATEGORIES } from "../constants";

export const SECTIONS = ["hotels", "cars", "staff", "expenses"] as const;
export type Section = (typeof SECTIONS)[number];
export const SECTION_LABEL: Record<Section, string> = { hotels: "Hotels", cars: "Cars / transport", staff: "Staff salary", expenses: "Other expenses" };

type Line = { amount: number; payments?: { amount: number }[]; category?: string };
export function paidOf(l: Line) {
  return round2((l.payments ?? []).reduce((s, p) => s + (p.amount || 0), 0));
}
export function withTotals<T extends Line>(l: T) {
  const paid = paidOf(l);
  return { ...l, paid, due: round2(Math.max(l.amount - paid, 0)) };
}

type TourLike = { hotels?: Line[]; cars?: Line[]; staff?: Line[]; expenses?: Line[] };
export function tourSummary(t: TourLike, invoices: { total: number; amountPaid: number; status?: string }[] = []) {
  const bucket = () => ({ amount: 0, paid: 0, due: 0, count: 0 });
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, bucket()])) as Record<Section, ReturnType<typeof bucket>>;
  const categories = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, bucket()])) as Record<string, ReturnType<typeof bucket>>;
  for (const s of SECTIONS)
    for (const l of t[s] ?? []) {
      const paid = paidOf(l);
      const b = sections[s];
      b.amount += l.amount;
      b.paid += paid;
      b.due += Math.max(l.amount - paid, 0);
      b.count++;
      if (s === "expenses") {
        const c = categories[l.category ?? "misc"] ?? (categories[l.category ?? "misc"] = bucket());
        c.amount += l.amount;
        c.paid += paid;
        c.due += Math.max(l.amount - paid, 0);
        c.count++;
      }
    }
  const r = (b: ReturnType<typeof bucket>) => ({ amount: round2(b.amount), paid: round2(b.paid), due: round2(b.due), count: b.count });
  const cost = SECTIONS.reduce((x, s) => x + sections[s].amount, 0);
  const paid = SECTIONS.reduce((x, s) => x + sections[s].paid, 0);
  const valid = invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const revenue = round2(valid.reduce((x, i) => x + i.total, 0));
  const collected = round2(valid.reduce((x, i) => x + i.amountPaid, 0));
  return {
    sections: Object.fromEntries(SECTIONS.map((s) => [s, r(sections[s])])) as Record<Section, ReturnType<typeof r>>,
    categories: Object.fromEntries(Object.entries(categories).filter(([, b]) => b.count).map(([k, b]) => [k, r(b)])),
    cost: round2(cost),
    paid: round2(paid),
    due: round2(cost - paid),
    revenue,
    collected,
    profit: round2(revenue - cost),
    margin: revenue ? round2(((revenue - cost) / revenue) * 100) : null,
  };
}

/* ───────── Inventory (moving average cost) ───────── */

const ITEM_TO_EXPENSE: Record<string, string> = { grocery: "grocery", fresh: "fresh", meat_fish: "meat_fish", gas: "gas", misc: "misc" };
const q3 = (n: number) => Math.round(n * 1000) / 1000;

export async function stockIn(itemId: Types.ObjectId, d: { quantity: number; rate: number; paid: number; vendor?: Types.ObjectId; date: Date; note: string }, userId: Types.ObjectId) {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new HttpError(404, "Item not found.");
  const amount = round2(d.quantity * d.rate);
  if (d.paid > amount + 0.001) throw new HttpError(400, "Paid can't be more than the purchase amount.");
  const old = Math.max(item.stock, 0);
  item.avgCost = old + d.quantity > 0 ? round2((old * item.avgCost + amount) / (old + d.quantity)) : d.rate;
  item.stock = q3(item.stock + d.quantity);
  await item.save();
  return StockMovement.create({ item: item._id, type: "in", quantity: d.quantity, rate: d.rate, amount, paid: d.paid, vendor: d.vendor, date: d.date, note: d.note, createdBy: userId, isDemo: item.isDemo });
}

/** Issues stock to a tour: stock falls at average cost and the tour gets a matching expense line. */
export async function stockOut(itemId: Types.ObjectId, d: { quantity: number; tour: Types.ObjectId; date: Date; note: string }, userId: Types.ObjectId) {
  const tour = await Tour.findById(d.tour);
  if (!tour) throw new HttpError(400, "Tour not found.");
  const item = await InventoryItem.findOneAndUpdate({ _id: itemId, stock: { $gte: d.quantity - 1e-9 } }, { $inc: { stock: -d.quantity } }, { returnDocument: "after" });
  if (!item) {
    const it = await InventoryItem.findById(itemId).lean();
    if (!it) throw new HttpError(404, "Item not found.");
    throw new HttpError(400, `Only ${q3(it.stock)} ${it.unit} of ${it.name} in stock.`);
  }
  const amount = round2(d.quantity * item.avgCost);
  const mv = await StockMovement.create({ item: item._id, type: "out", quantity: d.quantity, rate: item.avgCost, amount, date: d.date, tour: tour._id, note: d.note, createdBy: userId, isDemo: item.isDemo });
  tour.expenses.push({
    category: ITEM_TO_EXPENSE[item.category] ?? "misc",
    description: `${item.name} (from store)${d.note ? ` — ${d.note}` : ""}`,
    date: d.date,
    quantity: d.quantity,
    unit: item.unit,
    stockMovement: mv._id,
    amount,
    payments: amount > 0 ? [{ amount, date: d.date, method: "cash", note: "Issued from store stock" }] : [],
  });
  await tour.save();
  return mv;
}

export async function stockAdjust(itemId: Types.ObjectId, d: { quantity: number; date: Date; note: string }, userId: Types.ObjectId) {
  const filter = d.quantity < 0 ? { _id: itemId, stock: { $gte: -d.quantity - 1e-9 } } : { _id: itemId };
  const item = await InventoryItem.findOneAndUpdate(filter, { $inc: { stock: d.quantity } }, { returnDocument: "after" });
  if (!item) throw new HttpError(400, "Stock can't go below zero.");
  return StockMovement.create({ item: item._id, type: "adjust", quantity: d.quantity, rate: item.avgCost, amount: round2(d.quantity * item.avgCost), date: d.date, note: d.note, createdBy: userId, isDemo: item.isDemo });
}

/** Undoes a stock movement (and, for an issue, removes the tour's expense line). */
export async function reverseMovement(mvId: Types.ObjectId, opts: { keepTourLine?: boolean } = {}) {
  const mv = await StockMovement.findById(mvId);
  if (!mv) throw new HttpError(404, "Stock entry not found.");
  const item = await InventoryItem.findById(mv.item);
  if (item) {
    if (mv.type === "in") {
      if (item.stock + 1e-9 < mv.quantity) throw new HttpError(409, `Can't remove this purchase — ${q3(mv.quantity - item.stock)} ${item.unit} of it has already been used. Delete those issues first or record an adjustment.`);
      const left = q3(item.stock - mv.quantity);
      if (left > 0) item.avgCost = round2(Math.max(0, (item.stock * item.avgCost - mv.amount) / left));
      item.stock = left;
    } else if (mv.type === "out") {
      const total = item.stock + mv.quantity;
      item.avgCost = total > 0 ? round2((Math.max(item.stock, 0) * item.avgCost + mv.amount) / total) : item.avgCost;
      item.stock = q3(total);
    } else {
      if (item.stock - mv.quantity < -1e-9) throw new HttpError(409, "Can't undo — stock would go below zero.");
      item.stock = q3(item.stock - mv.quantity);
    }
    await item.save();
  }
  if (mv.type === "out" && mv.tour && !opts.keepTourLine) await Tour.updateOne({ _id: mv.tour }, { $pull: { expenses: { stockMovement: mv._id } } });
  await mv.deleteOne();
}
