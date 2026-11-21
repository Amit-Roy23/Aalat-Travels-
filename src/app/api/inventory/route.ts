import { body, requireUser, route } from "@/lib/api";
import { InventoryItem, StockMovement } from "@/lib/models";
import { InventoryItemInput } from "@/lib/validators";
import { round2 } from "@/lib/format";

export const GET = route(async () => {
  await requireUser("admin");
  const items = await InventoryItem.find().sort({ category: 1, name: 1 }).lean();
  const since = new Date(Date.now() - 30 * 86400000);
  const used = await StockMovement.aggregate([{ $match: { type: "out", date: { $gte: since } } }, { $group: { _id: "$item", qty: { $sum: "$quantity" }, amount: { $sum: "$amount" } } }]);
  const u = new Map(used.map((x) => [String(x._id), x]));
  const out = items.map((i) => ({ ...i, value: round2(Math.max(i.stock, 0) * i.avgCost), low: i.minStock > 0 && i.stock <= i.minStock, used30: round2(u.get(String(i._id))?.qty ?? 0) }));
  const dues = await StockMovement.aggregate([{ $match: { type: "in" } }, { $group: { _id: null, due: { $sum: { $subtract: ["$amount", "$paid"] } } } }]);
  return { items: out, totals: { value: round2(out.reduce((s, i) => s + i.value, 0)), low: out.filter((i) => i.low).length, purchaseDue: round2(dues[0]?.due ?? 0) } };
});

export const POST = route(async (req) => {
  await requireUser("admin");
  const data = await body(req, InventoryItemInput);
  const item = await InventoryItem.create(data);
  return { item };
});
