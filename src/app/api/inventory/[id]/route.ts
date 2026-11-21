import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { InventoryItem, StockMovement } from "@/lib/models";
import { InventoryItemInput } from "@/lib/validators";

type P = { id: string };

export const GET = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const item = await InventoryItem.findById(oid((await params).id)).lean();
  if (!item) throw new HttpError(404, "Item not found.");
  const movements = await StockMovement.find({ item: item._id }).sort({ date: -1, createdAt: -1 }).limit(200).populate("vendor", "name").populate("tour", "name").lean();
  return { item, movements };
});

export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const item = await InventoryItem.findById(oid((await params).id));
  if (!item) throw new HttpError(404, "Item not found.");
  item.set(await body(req, InventoryItemInput));
  await item.save();
  return { item };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const id = oid((await params).id);
  if (await StockMovement.exists({ item: id })) throw new HttpError(409, "This item has stock history. Remove its entries first, or keep it with zero stock.");
  const r = await InventoryItem.deleteOne({ _id: id });
  if (!r.deletedCount) throw new HttpError(404, "Item not found.");
  return { ok: true };
});
