import type { Types } from "mongoose";
import { Conversation, Customer, FollowUp, Lead, Settings, User } from "../models";
import { leadStatusMeta, sourceLabel, type LeadSource, type LeadStatus } from "../constants";
import { normalizePhone } from "../format";
import { logActivity } from "./activity";
import { notify } from "./notify";
import type { AuthUser } from "../api";

type Id = Types.ObjectId | string;
export type LeadDoc = InstanceType<typeof Lead>;

/** Data-visibility rule: agents only see leads / follow-ups assigned to them. */
export function leadScope(user: AuthUser): Record<string, unknown> {
  return user.role === "agent" ? { assignedTo: user._id } : {};
}

export async function canAccessLead(user: AuthUser, lead: { assignedTo?: unknown }) {
  if (user.role === "admin") return true;
  return lead.assignedTo != null && String(lead.assignedTo) === user.id;
}

/** Round-robin assignment among active sales agents (falls back to admins). */
export async function pickAssignee(): Promise<Types.ObjectId | undefined> {
  const s = await Settings.findById("global").lean();
  if (s && s.leads?.autoAssign === "none") return undefined;
  let pool = await User.find({ active: true, role: "agent" }, { _id: 1 }).sort({ createdAt: 1 }).lean();
  if (!pool.length) pool = await User.find({ active: true, role: "admin" }, { _id: 1 }).sort({ createdAt: 1 }).lean();
  if (!pool.length) return undefined;
  const updated = await Settings.findOneAndUpdate({ _id: "global" }, { $inc: { "leads.lastAssignedIndex": 1 } }, { returnDocument: "after", upsert: true }).lean();
  const idx = Math.abs(updated?.leads?.lastAssignedIndex ?? 0) % pool.length;
  return pool[idx]._id as Types.ObjectId;
}

export type CaptureInput = {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  source: LeadSource;
  campaign?: string;
  destination?: string;
  travelDate?: string;
  adults?: number;
  children?: number;
  budget?: number;
  requirements?: string;
  language?: string;
  isDemo?: boolean;
};

/**
 * Captures an inbound lead (ads, website, WhatsApp). De-duplicates by phone:
 *  • an open lead with the same phone is updated instead of creating a duplicate;
 *  • a lead converted in the last 30 days is reused (same trip conversation);
 *  • otherwise a fresh lead is created and linked to an existing customer, if any.
 */
export async function captureLead(input: CaptureInput, actor?: Id): Promise<{ lead: LeadDoc; created: boolean }> {
  const phone = normalizePhone(input.phone);
  const email = (input.email || "").trim().toLowerCase();
  if (!phone && !email) throw new Error("A phone number or email is required to capture a lead.");

  const existing = phone
    ? await Lead.findOne({ phone }).sort({ createdAt: -1 })
    : await Lead.findOne({ email }).sort({ createdAt: -1 });

  const recentConversion = existing?.status === "converted" && existing.convertedAt && Date.now() - existing.convertedAt.getTime() < 30 * 86400000;

  if (existing && (existing.status !== "converted" || recentConversion)) {
    fillEmpty(existing, input, email);
    existing.lastContactAt = new Date();
    if (existing.status === "not_interested") {
      existing.status = "new";
      await logActivity({ lead: existing._id, type: "status_change", message: "Lead re-opened: customer enquired again", user: actor, meta: { from: "not_interested", to: "new" } });
    }
    await existing.save();
    await logActivity({
      lead: existing._id,
      customer: existing.customer,
      type: "capture",
      message: `New enquiry received via ${sourceLabel(input.source)}${input.campaign ? ` · ${input.campaign}` : ""}${input.requirements ? `: “${input.requirements.slice(0, 160)}”` : ""}`,
      user: actor,
    });
    return { lead: existing, created: false };
  }

  const customer = phone ? await Customer.findOne({ phone }) : email ? await Customer.findOne({ email }) : null;
  const assignedTo = await pickAssignee();
  const lead = await Lead.create({
    name: input.name?.trim() || customer?.name || "WhatsApp User",
    phone,
    email,
    city: input.city || customer?.city || "",
    source: input.source,
    campaign: input.campaign || "",
    destination: input.destination || "",
    travelDate: input.travelDate || "",
    travellers: { adults: input.adults || 0, children: input.children || 0 },
    budget: input.budget || 0,
    requirements: input.requirements || "",
    language: input.language || "",
    assignedTo,
    customer: customer?._id,
    lastContactAt: new Date(),
    createdBy: actor,
    isDemo: Boolean(input.isDemo),
  });
  await logActivity({
    lead: lead._id,
    customer: customer?._id,
    type: "created",
    message: `Lead captured from ${sourceLabel(input.source)}${input.campaign ? ` (${input.campaign})` : ""}${customer ? " · returning customer" : ""}`,
    user: actor,
  });
  if (assignedTo) {
    const u = await User.findById(assignedTo, { name: 1 }).lean();
    await logActivity({ lead: lead._id, type: "assignment", message: `Auto-assigned to ${u?.name ?? "agent"}`, meta: { to: String(assignedTo) } });
  }
  await notify({
    to: [assignedTo],
    type: "lead",
    title: `New lead: ${lead.name}`,
    body: `${sourceLabel(input.source)}${lead.destination ? ` · ${lead.destination}` : ""}`,
    link: `/leads/${lead._id}`,
  });
  return { lead, created: true };
}

function fillEmpty(lead: LeadDoc, input: CaptureInput, email: string) {
  if ((!lead.name || lead.name === "WhatsApp User") && input.name) lead.name = input.name.trim();
  if (!lead.email && email) lead.email = email;
  if (!lead.city && input.city) lead.city = input.city;
  if (!lead.destination && input.destination) lead.destination = input.destination;
  if (!lead.travelDate && input.travelDate) lead.travelDate = input.travelDate;
  if (!lead.travellers?.adults && input.adults) lead.set("travellers.adults", input.adults);
  if (!lead.travellers?.children && input.children) lead.set("travellers.children", input.children);
  if (!lead.budget && input.budget) lead.budget = input.budget;
  if (!lead.language && input.language) lead.language = input.language;
  if (input.requirements && !lead.requirements) lead.requirements = input.requirements;
}

export async function setLeadStatus(lead: LeadDoc, status: LeadStatus, actor?: Id | null, via?: string) {
  if (lead.status === status) return false;
  const from = lead.status;
  lead.status = status;
  if (status === "converted" && !lead.convertedAt) lead.convertedAt = new Date();
  await lead.save();
  await logActivity({
    lead: lead._id,
    customer: lead.customer,
    type: via === "ai" ? "ai" : "status_change",
    message: `Status changed from ${leadStatusMeta(from).label} to ${leadStatusMeta(status).label}${via === "ai" ? " by AI (conversation analysis)" : ""}`,
    user: actor ?? undefined,
    meta: { from, to: status },
  });
  return true;
}

/** Keeps lead.nextFollowUpAt equal to its earliest pending follow-up. */
export async function syncNextFollowUp(leadId?: Id | null) {
  if (!leadId) return;
  const next = await FollowUp.findOne({ lead: leadId, status: "pending" }).sort({ dueAt: 1 }).lean();
  await Lead.updateOne({ _id: leadId }, next ? { $set: { nextFollowUpAt: next.dueAt } } : { $unset: { nextFollowUpAt: 1 } });
}

/** Converts a lead into a customer (re-using an existing customer with the same phone/email). */
export async function convertLead(lead: LeadDoc, actor: Id, extra?: { travelStyle?: string }) {
  let customer = lead.customer ? await Customer.findById(lead.customer) : null;
  if (!customer && lead.phone) customer = await Customer.findOne({ phone: lead.phone });
  if (!customer && lead.email) customer = await Customer.findOne({ email: lead.email });
  if (!customer) {
    customer = await Customer.create({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      language: lead.language,
      preferences: { destinations: lead.destination ? [lead.destination] : [], travelStyle: extra?.travelStyle || "", budgetRange: lead.budget ? `₹${lead.budget.toLocaleString("en-IN")}` : "" },
      sourceLead: lead._id,
      createdBy: actor,
      isDemo: lead.isDemo,
    });
    await logActivity({ customer: customer._id, lead: lead._id, type: "created", message: `Customer profile created from lead`, user: actor });
  } else if (lead.destination && !customer.preferences?.destinations?.includes(lead.destination)) {
    customer.set("preferences.destinations", [...(customer.preferences?.destinations ?? []), lead.destination]);
    await customer.save();
  }
  lead.customer = customer._id;
  await setLeadStatus(lead, "converted", actor);
  if (lead.isModified()) await lead.save();
  await logActivity({ customer: customer._id, lead: lead._id, type: "converted", message: `Lead converted to customer${lead.destination ? ` · ${lead.destination}` : ""}`, user: actor });
  if (lead.phone) await Conversation.updateOne({ phone: lead.phone }, { $set: { customer: customer._id } });
  return customer;
}
