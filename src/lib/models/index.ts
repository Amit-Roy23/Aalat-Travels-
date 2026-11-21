import { DEFAULT_PARTNER_LOGOS, INVOICE_DEFAULTS } from "../invoice-defaults";
import mongoose, { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";
import {
  ACTIVITY_TYPES,
  FOLLOWUP_STATUSES,
  FOLLOWUP_TYPE_VALUES,
  LEAD_SOURCE_VALUES,
  LEAD_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
} from "../constants";

const { ObjectId } = Schema.Types;

function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T>) || model<T>(name, schema);
}

/* ───────────────────────── User ───────────────────────── */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "agent"], default: "agent" },
    active: { type: Boolean, default: true },
    color: { type: String, default: "#0E9F8E" },
    lastLoginAt: Date,
  },
  { timestamps: true },
);
export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export const User = getModel("User", UserSchema);

/* ───────────────────────── Customer ───────────────────────── */
const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", index: true },
    altPhone: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    city: { type: String, default: "" },
    address: { type: String, default: "" },
    dob: Date,
    anniversary: Date,
    gstin: { type: String, default: "" },
    preferences: {
      destinations: { type: [String], default: [] },
      travelStyle: { type: String, default: "" },
      hotelCategory: { type: String, default: "" },
      mealPreference: { type: String, default: "" },
      budgetRange: { type: String, default: "" },
      notes: { type: String, default: "" },
    },
    tags: { type: [String], default: [] },
    language: { type: String, default: "" },
    sourceLead: { type: ObjectId, ref: "Lead" },
    createdBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Customer = getModel("Customer", CustomerSchema);

/* ───────────────────────── Lead ───────────────────────── */
const LeadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", index: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    city: { type: String, default: "" },
    source: { type: String, enum: LEAD_SOURCE_VALUES, default: "manual" },
    campaign: { type: String, default: "" },
    status: { type: String, enum: LEAD_STATUS_VALUES, default: "new", index: true },
    destination: { type: String, default: "" },
    travelDate: { type: String, default: "" }, // free text ("Dec 2026", "20 Dec") or ISO date
    travellers: {
      adults: { type: Number, default: 0, min: 0 },
      children: { type: Number, default: 0, min: 0 },
    },
    budget: { type: Number, default: 0, min: 0 },
    requirements: { type: String, default: "" },
    tags: { type: [String], default: [] },
    language: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    assignedTo: { type: ObjectId, ref: "User", index: true },
    customer: { type: ObjectId, ref: "Customer" },
    conversation: { type: ObjectId, ref: "Conversation" },
    nextFollowUpAt: { type: Date, index: true },
    lastContactAt: Date,
    convertedAt: Date,
    createdBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
LeadSchema.index({ createdAt: -1 });
export const Lead = getModel("Lead", LeadSchema);

/* ───────────────────────── Activity (timeline) ───────────────────────── */
const ActivitySchema = new Schema(
  {
    lead: { type: ObjectId, ref: "Lead", index: true },
    customer: { type: ObjectId, ref: "Customer", index: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    message: { type: String, required: true },
    user: { type: ObjectId, ref: "User" },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ActivitySchema.index({ createdAt: -1 });
export const Activity = getModel("Activity", ActivitySchema);

/* ───────────────────────── FollowUp ───────────────────────── */
const FollowUpSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: FOLLOWUP_TYPE_VALUES, default: "call" },
    dueAt: { type: Date, required: true, index: true },
    status: { type: String, enum: FOLLOWUP_STATUSES, default: "pending", index: true },
    notes: { type: String, default: "" },
    outcome: { type: String, default: "" },
    lead: { type: ObjectId, ref: "Lead", index: true },
    customer: { type: ObjectId, ref: "Customer", index: true },
    assignedTo: { type: ObjectId, ref: "User", index: true },
    createdBy: { type: ObjectId, ref: "User" },
    autoCreated: { type: Boolean, default: false },
    completedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const FollowUp = getModel("FollowUp", FollowUpSchema);

/* ───────────────────────── WhatsApp Conversation & Message ───────────────────────── */
const ConversationSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    lead: { type: ObjectId, ref: "Lead" },
    customer: { type: ObjectId, ref: "Customer" },
    language: { type: String, default: "" },
    aiEnabled: { type: Boolean, default: true },
    handoff: { type: Boolean, default: false },
    handoffReason: { type: String, default: "" },
    interest: { type: String, default: "" },
    unread: { type: Number, default: 0 },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, index: true },
    lastInboundAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Conversation = getModel("Conversation", ConversationSchema);

const MessageSchema = new Schema(
  {
    conversation: { type: ObjectId, ref: "Conversation", required: true, index: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    sender: { type: String, enum: ["customer", "ai", "agent", "system"], required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ["received", "queued", "sent", "delivered", "read", "failed", "simulated"], default: "sent" },
    waMessageId: { type: String },
    agent: { type: ObjectId, ref: "User" },
    error: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
MessageSchema.index({ waMessageId: 1 }, { unique: true, partialFilterExpression: { waMessageId: { $type: "string" } } });
MessageSchema.index({ conversation: 1, createdAt: 1 });
export const Message = getModel("Message", MessageSchema);

/* ───────────────────────── Invoice ───────────────────────── */
const InvoiceItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
const PaymentSchema = new Schema({
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, required: true },
  method: { type: String, enum: PAYMENT_METHOD_VALUES, default: "upi" },
  reference: { type: String, default: "" },
  note: { type: String, default: "" },
  recordedBy: { type: ObjectId, ref: "User" },
});
const InvoiceSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    customer: { type: ObjectId, ref: "Customer", required: true, index: true },
    lead: { type: ObjectId, ref: "Lead" },
    tripTitle: { type: String, default: "" },
    tour: {
      name: { type: String, default: "" },
      duration: { type: String, default: "" },
      adults: { type: Number, default: 0, min: 0 },
      children: { type: Number, default: 0, min: 0 },
      rooms: { type: Number, default: 0, min: 0 },
      startDate: Date,
      endDate: Date,
      startPoint: { type: String, default: "" },
      endPoint: { type: String, default: "" },
      foodPlan: { type: String, default: "" },
      propertyType: { type: String, default: "" },
      vehicleSeat: { type: String, default: "" },
      vehicleType: { type: String, default: "" },
    },
    taxType: { type: String, enum: ["cgst_sgst", "igst"], default: "cgst_sgst" },
    remarks: { type: String, default: "" },
    // Part-payment schedule: amounts are derived from percent × total (last instalment takes any rounding remainder)
    installments: {
      type: [new Schema({ label: { type: String, required: true }, percent: { type: Number, required: true, min: 0.01, max: 100 }, amount: { type: Number, default: 0 }, dueDate: { type: Date, required: true } }, { _id: true })],
      default: [],
    },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    items: { type: [InvoiceItemSchema], default: [] },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 5, min: 0, max: 100 },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    payments: { type: [PaymentSchema], default: [] },
    state: { type: String, enum: ["draft", "issued", "cancelled"], default: "issued" },
    status: { type: String, enum: ["draft", "sent", "partial", "paid", "overdue", "cancelled"], default: "sent", index: true },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
    shareToken: { type: String, required: true, unique: true },
    createdBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Invoice = getModel("Invoice", InvoiceSchema);

const CounterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const Counter = getModel("Counter", CounterSchema);

/* ───────────────────────── Notification ───────────────────────── */
const NotificationSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    type: { type: String, default: "info" }, // lead | followup | whatsapp | handoff | invoice | info
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // auto-clean after 60 days
export const Notification = getModel("Notification", NotificationSchema);

/* ───────────────────────── Settings (singleton) ───────────────────────── */
const PackageSchema = new Schema(
  {
    name: { type: String, required: true },
    destination: { type: String, required: true },
    keywords: { type: [String], default: [] },
    duration: { type: String, default: "" },
    pricePerPerson: { type: Number, default: 0 },
    inclusions: { type: String, default: "" },
    highlights: { type: String, default: "" },
    bestTime: { type: String, default: "" },
  },
  { _id: true },
);
const FaqSchema = new Schema({ question: { type: String, required: true }, answer: { type: String, required: true } }, { _id: true });

const SettingsSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    company: {
      name: { type: String, default: "Aalat Travels" },
      tagline: { type: String, default: "A Creative Mind" },
      phone: { type: String, default: "+91 7980330940 / +91 8918497160" },
      email: { type: String, default: "" },
      website: { type: String, default: "" },
      address: { type: String, default: "126, Feeder Road, Belgharia, Kolkata - 700056" },
      gstin: { type: String, default: "" },
      regNo: { type: String, default: "PM01592N2023000001" },
      msmeNo: { type: String, default: "UDYAM-WB-10-0091056" }, // MSME / Udyam registration
      logo: { type: String, default: "" }, // small PNG data URL, uploaded in Settings
    },
    invoice: {
      template: { type: String, enum: ["classic", "modern"], default: "classic" },
      numberStyle: { type: String, enum: ["plain", "prefixed"], default: "plain" },
      startNumber: { type: Number, default: 1, min: 1 },
      taxType: { type: String, enum: ["cgst_sgst", "igst"], default: "cgst_sgst" },
      cancellationPolicy: { type: String, default: INVOICE_DEFAULTS.cancellationPolicy },
      childPolicy: { type: String, default: INVOICE_DEFAULTS.childPolicy },
      paymentTerms: { type: String, default: INVOICE_DEFAULTS.paymentTerms },
      refundNote: { type: String, default: INVOICE_DEFAULTS.refundNote },
      footerNote: { type: String, default: INVOICE_DEFAULTS.footerNote },
      showPartnerLogos: { type: Boolean, default: true },
      paymentQr: { type: String, default: "" }, // uploaded UPI / bank QR (data URL)
      showPaymentQr: { type: Boolean, default: true },
      autoUpiQr: { type: Boolean, default: true }, // generate a UPI QR for the amount due when no image is uploaded
      partnerDefaultsVersion: { type: Number, default: 0 },
      partnerTitle: { type: String, default: "" },
      partnerLogos: {
        type: [new Schema({ name: { type: String, default: "" }, src: { type: String, required: true } }, { _id: false })],
        default: () => DEFAULT_PARTNER_LOGOS.map((l) => ({ ...l })),
      },
      prefix: { type: String, default: "AAL" },
      defaultTaxRate: { type: Number, default: 5 },
      dueDays: { type: Number, default: 7 },
      terms: {
        type: String,
        default:
          "50% advance to confirm the booking; balance due 7 days before departure.\nCancellation charges apply as per hotel / airline policies.\nPrices are subject to availability at the time of confirmation.",
      },
      bankDetails: { type: String, default: "" },
      upiId: { type: String, default: "" },
    },
    ai: {
      enabled: { type: Boolean, default: true },
      model: { type: String, default: "claude-opus-5-5" },
      assistantName: { type: String, default: "Aria" },
      tone: { type: String, default: "Warm, friendly and professional. Short WhatsApp-style messages with a few relevant emojis." },
      about: { type: String, default: "" },
      services: { type: String, default: "" },
      policies: { type: String, default: "" },
      officeHours: { type: String, default: "Mon–Sat, 10:00 AM – 7:00 PM IST" },
      packages: { type: [PackageSchema], default: [] },
      faqs: { type: [FaqSchema], default: [] },
      autoCreateLead: { type: Boolean, default: true },
      autoFollowUp: { type: Boolean, default: true },
      autoStatus: { type: Boolean, default: true },
    },
    payroll: {
      weeklyOff: { type: [Number], default: [0] }, // 0 = Sunday
      officeStart: { type: String, default: "10:00" },
      graceMinutes: { type: Number, default: 15, min: 0 },
      unmarkedAs: { type: String, enum: ["absent", "present"], default: "absent" },
    },
    leads: {
      autoAssign: { type: String, enum: ["none", "round_robin"], default: "round_robin" },
      lastAssignedIndex: { type: Number, default: -1 },
      captureApiKey: { type: String, default: "" },
    },
  },
  { timestamps: true },
);
export const Settings = getModel("Settings", SettingsSchema);

export { mongoose };

export * from "./ops";
