import crypto from "crypto";
import { Customer, Lead } from "../models";
import { HttpError, oid, type AuthUser } from "../api";
import { canAccessLead } from "./leads";

export function itineraryToken() {
  return crypto.randomBytes(16).toString("base64url");
}

/** Validates the linked customer / lead and returns the guest name to show. */
export async function resolveGuest(user: AuthUser, data: { customer?: string | null; lead?: string | null; guestName?: string }) {
  let customer: { _id: unknown; name: string } | null = null;
  let lead: { _id: unknown; name: string; assignedTo?: unknown } | null = null;
  if (data.customer) {
    customer = await Customer.findById(oid(data.customer), { name: 1 }).lean();
    if (!customer) throw new HttpError(400, "Selected customer not found.");
  }
  if (data.lead) {
    lead = await Lead.findById(oid(data.lead), { name: 1, assignedTo: 1 }).lean();
    if (!lead) throw new HttpError(400, "Selected lead not found.");
    if (!(await canAccessLead(user, lead))) throw new HttpError(403, "This lead is assigned to another team member.");
  }
  return {
    customer: customer?._id,
    lead: lead?._id,
    guestName: (data.guestName || customer?.name || lead?.name || "").trim(),
  };
}

export function itineraryTotal(it: { adults?: number; children?: number; pricePerAdult?: number; pricePerChild?: number }) {
  return Math.round(((it.adults ?? 0) * (it.pricePerAdult ?? 0) + (it.children ?? 0) * (it.pricePerChild ?? 0)) * 100) / 100;
}
