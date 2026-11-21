import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { InventoryItem, Vendor } from "@/lib/models";
import { StockMovementInput } from "@/lib/validators";
import { stockAdjust, stockIn, stockOut } from "@/lib/services/tours";

type P = { id: string };

export const POST = route<P>(async (req, { params }) => {
  const me = await requireUser("admin");
  const itemId = oid((await params).id);
  const d = await body(req, StockMovementInput);
  let mv;
  if (d.type === "in") {
    if (d.vendor && !(await Vendor.exists({ _id: oid(d.vendor) }))) throw new HttpError(400, "Vendor not found.");
    mv = await stockIn(itemId, { ...d, vendor: d.vendor ? oid(d.vendor) : undefined }, me._id);
  } else if (d.type === "out") mv = await stockOut(itemId, { ...d, tour: oid(d.tour) }, me._id);
  else mv = await stockAdjust(itemId, d, me._id);
  return { movement: mv, item: await InventoryItem.findById(itemId).lean() };
});
