import { z } from "zod";
import { FOLLOWUP_TYPE_VALUES, LEAD_SOURCE_VALUES, LEAD_STATUS_VALUES, PAYMENT_METHOD_VALUES } from "../constants";

const str = (max = 500) => z.string().trim().max(max);
const optStr = (max = 500) => str(max).optional().default("");
const email = z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).optional().default("");
const phone = z.string().trim().max(20).optional().default("");

export const LeadInput = z.object({
  name: str(120).min(2, "Name is required"),
  phone,
  email,
  city: optStr(80),
  source: z.enum(LEAD_SOURCE_VALUES).default("manual"),
  campaign: optStr(120),
  status: z.enum(LEAD_STATUS_VALUES).default("new"),
  destination: optStr(120),
  travelDate: optStr(60),
  travellers: z.object({ adults: z.coerce.number().int().min(0).max(500).default(0), children: z.coerce.number().int().min(0).max(500).default(0) }).default({ adults: 0, children: 0 }),
  budget: z.coerce.number().min(0).max(1e9).default(0),
  requirements: optStr(4000),
  tags: z.array(str(40)).max(20).default([]),
  assignedTo: z.string().optional().nullable(),
  language: optStr(20),
});
// Patch schemas must not carry defaults: an omitted field means "leave unchanged".
const emailPatch = z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).optional();
export const LeadPatch = z.object({
  name: str(120).min(2, "Name is required").optional(),
  phone: z.string().trim().max(20).optional(),
  email: emailPatch,
  city: str(80).optional(),
  source: z.enum(LEAD_SOURCE_VALUES).optional(),
  campaign: str(120).optional(),
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  destination: str(120).optional(),
  travelDate: str(60).optional(),
  travellers: z.object({ adults: z.coerce.number().int().min(0).max(500), children: z.coerce.number().int().min(0).max(500) }).optional(),
  budget: z.coerce.number().min(0).max(1e9).optional(),
  requirements: str(4000).optional(),
  tags: z.array(str(40)).max(20).optional(),
  assignedTo: z.string().optional().nullable(),
  language: str(20).optional(),
});

export const CustomerInput = z.object({
  name: str(120).min(2, "Name is required"),
  phone,
  altPhone: phone,
  email,
  city: optStr(80),
  address: optStr(400),
  dob: z.string().optional().nullable(),
  anniversary: z.string().optional().nullable(),
  gstin: optStr(20),
  language: optStr(20),
  tags: z.array(str(40)).max(20).default([]),
  preferences: z
    .object({
      destinations: z.array(str(80)).max(30).default([]),
      travelStyle: optStr(60),
      hotelCategory: optStr(60),
      mealPreference: optStr(60),
      budgetRange: optStr(60),
      notes: optStr(2000),
    })
    .default({ destinations: [], travelStyle: "", hotelCategory: "", mealPreference: "", budgetRange: "", notes: "" }),
});
export const CustomerPatch = z.object({
  name: str(120).min(2, "Name is required").optional(),
  phone: z.string().trim().max(20).optional(),
  altPhone: z.string().trim().max(20).optional(),
  email: emailPatch,
  city: str(80).optional(),
  address: str(400).optional(),
  dob: z.string().optional().nullable(),
  anniversary: z.string().optional().nullable(),
  gstin: str(20).optional(),
  language: str(20).optional(),
  tags: z.array(str(40)).max(20).optional(),
  preferences: z
    .object({
      destinations: z.array(str(80)).max(30).optional(),
      travelStyle: str(60).optional(),
      hotelCategory: str(60).optional(),
      mealPreference: str(60).optional(),
      budgetRange: str(60).optional(),
      notes: str(2000).optional(),
    })
    .optional(),
});

export const FollowUpInput = z
  .object({
    title: str(160).min(2, "Title is required"),
    type: z.enum(FOLLOWUP_TYPE_VALUES).default("call"),
    dueAt: z.coerce.date(),
    notes: optStr(2000),
    lead: z.string().optional().nullable(),
    customer: z.string().optional().nullable(),
    assignedTo: z.string().optional().nullable(),
  })
  .refine((v) => v.lead || v.customer, { message: "Link the follow-up to a lead or customer", path: ["lead"] });

export const FollowUpPatch = z.object({
  title: str(160).min(2).optional(),
  type: z.enum(FOLLOWUP_TYPE_VALUES).optional(),
  dueAt: z.coerce.date().optional(),
  notes: str(2000).optional(),
  assignedTo: z.string().optional().nullable(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  outcome: str(2000).optional(),
  leadStatus: z.enum(LEAD_STATUS_VALUES).optional(),
});

export const InvoiceItem = z.object({
  description: str(300).min(1, "Item description is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0").max(10000),
  rate: z.coerce.number().min(0, "Rate cannot be negative").max(1e9),
});
export const TourInput = z
  .object({
    name: optStr(200),
    duration: optStr(60),
    adults: z.coerce.number().int().min(0).max(1000).default(0),
    children: z.coerce.number().int().min(0).max(1000).default(0),
    rooms: z.coerce.number().int().min(0).max(500).default(0),
    startDate: z.union([z.literal(""), z.null(), z.coerce.date()]).optional(),
    endDate: z.union([z.literal(""), z.null(), z.coerce.date()]).optional(),
    startPoint: optStr(120),
    endPoint: optStr(120),
    foodPlan: optStr(80),
    propertyType: optStr(80),
    vehicleSeat: optStr(40),
    vehicleType: optStr(80),
  })
  .refine((t) => !(t.startDate instanceof Date && t.endDate instanceof Date) || t.endDate >= t.startDate, { message: "Tour ending date cannot be before the starting date", path: ["endDate"] });

export const InvoiceInput = z
  .object({
    customer: z.string().optional().nullable(),
    lead: z.string().optional().nullable(),
    tripTitle: optStr(200),
    tour: TourInput.optional(),
    taxType: z.enum(["cgst_sgst", "igst"]).optional(),
    remarks: optStr(1000),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    items: z.array(InvoiceItem).min(1, "Add at least one line item"),
    discount: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).max(100).default(5),
    notes: optStr(2000),
    terms: optStr(4000),
    state: z.enum(["draft", "issued"]).default("issued"),
  })
  .refine((v) => v.customer || v.lead, { message: "Choose the customer (or lead) to bill", path: ["customer"] })
  .refine((v) => v.dueDate.getTime() >= new Date(v.issueDate).setHours(0, 0, 0, 0), { message: "Due date cannot be before the issue date", path: ["dueDate"] });

export const PaymentInput = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.coerce.date(),
  method: z.enum(PAYMENT_METHOD_VALUES).default("upi"),
  reference: optStr(120),
  note: optStr(300),
});
