import type { Types } from "mongoose";
import { Activity } from "../models";
import type { ActivityType } from "../constants";

type Id = Types.ObjectId | string | null | undefined;

export async function logActivity(a: { lead?: Id; customer?: Id; type: ActivityType; message: string; user?: Id; meta?: Record<string, unknown> }) {
  return Activity.create({
    lead: a.lead || undefined,
    customer: a.customer || undefined,
    type: a.type,
    message: a.message,
    user: a.user || undefined,
    meta: a.meta,
  });
}
