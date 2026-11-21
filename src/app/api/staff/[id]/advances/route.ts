import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { SalaryAdvance, Staff } from "@/lib/models";
import { AdvanceInput } from "@/lib/validators";

type P = { id: string };
export const GET = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  return { items: await SalaryAdvance.find({ staff: oid(id) }).sort({ date: -1 }).lean() };
});
export const POST = route<P>(async (req, { params }) => {
  const user = await requireUser("admin");
  const { id } = await params;
  if (!(await Staff.exists({ _id: oid(id) }))) throw new HttpError(404, "Staff member not found.");
  const data = await body(req, AdvanceInput);
  return { advance: await SalaryAdvance.create({ ...data, staff: oid(id), createdBy: user._id }) };
});
