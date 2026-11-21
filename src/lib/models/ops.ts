// Models for itineraries, operations (tours, vendors, inventory) and staff (attendance, payroll).
import { Schema, model, models, type Model } from "mongoose";
import {
  ATTENDANCE_STATUS_VALUES,
  EXPENSE_CATEGORY_VALUES,
  INVENTORY_CATEGORY_VALUES,
  ITINERARY_STATUS_VALUES,
  LEAVE_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
  STAFF_TYPE_VALUES,
  TOUR_STATUS_VALUES,
  VENDOR_TYPE_VALUES,
} from "../constants";

const { ObjectId } = Schema.Types;
function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T>) || model<T>(name, schema);
}

/* ───────────────────────── Itinerary ───────────────────────── */
const ItineraryDaySchema = new Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    stay: { type: String, default: "" },
    meals: { breakfast: { type: Boolean, default: false }, lunch: { type: Boolean, default: false }, dinner: { type: Boolean, default: false } },
    activities: { type: String, default: "" },
    transport: { type: String, default: "" },
  },
  { _id: true },
);
const ItinerarySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    customer: { type: ObjectId, ref: "Customer" },
    lead: { type: ObjectId, ref: "Lead" },
    guestName: { type: String, default: "" },
    destination: { type: String, default: "" },
    startDate: Date,
    adults: { type: Number, default: 0, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    startPoint: { type: String, default: "" },
    endPoint: { type: String, default: "" },
    days: { type: [ItineraryDaySchema], default: [] },
    inclusions: { type: String, default: "" },
    exclusions: { type: String, default: "" },
    pricePerAdult: { type: Number, default: 0, min: 0 },
    pricePerChild: { type: Number, default: 0, min: 0 },
    priceNote: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, enum: ITINERARY_STATUS_VALUES, default: "draft" },
    shareToken: { type: String, required: true, unique: true },
    invoice: { type: ObjectId, ref: "Invoice" },
    createdBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Itinerary = getModel("Itinerary", ItinerarySchema);

/* ───────────────────────── Vendor ───────────────────────── */
const VendorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: VENDOR_TYPE_VALUES, default: "other" },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    city: { type: String, default: "" },
    address: { type: String, default: "" },
    gstin: { type: String, default: "" },
    bankDetails: { type: String, default: "" },
    upiId: { type: String, default: "" },
    notes: { type: String, default: "" },
    active: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Vendor = getModel("Vendor", VendorSchema);

/* ───────────────────────── Tour operation file ───────────────────────── */
// "advance" = sum of payments made so far; "due" = amount − paid (computed).
const LinePaymentSchema = new Schema({
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, required: true },
  method: { type: String, enum: PAYMENT_METHOD_VALUES, default: "cash" },
  note: { type: String, default: "" },
});
const base = {
  amount: { type: Number, required: true, min: 0 },
  payments: { type: [LinePaymentSchema], default: [] },
  notes: { type: String, default: "" },
};
const HotelLineSchema = new Schema({
  vendor: { type: ObjectId, ref: "Vendor" },
  hotelName: { type: String, required: true },
  city: { type: String, default: "" },
  checkIn: Date,
  checkOut: Date,
  rooms: { type: Number, default: 0, min: 0 },
  roomType: { type: String, default: "" },
  mealPlan: { type: String, default: "" },
  ...base,
});
const CarLineSchema = new Schema({
  vendor: { type: ObjectId, ref: "Vendor" },
  vehicleType: { type: String, default: "" },
  carNumber: { type: String, default: "" },
  driverName: { type: String, default: "" },
  driverPhone: { type: String, default: "" },
  fromDate: Date,
  toDate: Date,
  ...base,
});
const StaffLineSchema = new Schema({
  staff: { type: ObjectId, ref: "Staff" },
  name: { type: String, required: true },
  role: { type: String, default: "" },
  days: { type: Number, default: 0, min: 0 },
  ...base,
});
const ExpenseLineSchema = new Schema({
  category: { type: String, enum: EXPENSE_CATEGORY_VALUES, default: "misc" },
  description: { type: String, default: "" },
  vendor: { type: ObjectId, ref: "Vendor" },
  date: Date,
  quantity: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: "" },
  stockMovement: { type: ObjectId, ref: "StockMovement" },
  ...base,
});
const TourSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    destination: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: Date,
    pax: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: TOUR_STATUS_VALUES, default: "planned" },
    invoices: [{ type: ObjectId, ref: "Invoice" }],
    hotels: { type: [HotelLineSchema], default: [] },
    cars: { type: [CarLineSchema], default: [] },
    staff: { type: [StaffLineSchema], default: [] },
    expenses: { type: [ExpenseLineSchema], default: [] },
    notes: { type: String, default: "" },
    createdBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
TourSchema.index({ startDate: -1 });
export const Tour = getModel("Tour", TourSchema);

/* ───────────────────────── Inventory ───────────────────────── */
const InventoryItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: INVENTORY_CATEGORY_VALUES, default: "grocery" },
    unit: { type: String, default: "kg" },
    stock: { type: Number, default: 0 },
    avgCost: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const InventoryItem = getModel("InventoryItem", InventoryItemSchema);

const StockMovementSchema = new Schema(
  {
    item: { type: ObjectId, ref: "InventoryItem", required: true, index: true },
    type: { type: String, enum: ["in", "out", "adjust"], required: true },
    quantity: { type: Number, required: true }, // positive; adjust may be negative
    rate: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0 },
    paid: { type: Number, default: 0, min: 0 }, // purchases: amount paid to vendor
    date: { type: Date, required: true },
    vendor: { type: ObjectId, ref: "Vendor" },
    tour: { type: ObjectId, ref: "Tour" },
    note: { type: String, default: "" },
    createdBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
StockMovementSchema.index({ date: -1 });
export const StockMovement = getModel("StockMovement", StockMovementSchema);

/* ───────────────────────── Staff, attendance, payroll ───────────────────────── */
const StaffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    type: { type: String, enum: STAFF_TYPE_VALUES, default: "office" },
    designation: { type: String, default: "" },
    salaryType: { type: String, enum: ["monthly", "daily"], default: "monthly" },
    salary: { type: Number, default: 0, min: 0 }, // monthly salary or daily wage
    joinDate: Date,
    user: { type: ObjectId, ref: "User" }, // optional login → self check-in
    bankDetails: { type: String, default: "" },
    upiId: { type: String, default: "" },
    active: { type: Boolean, default: true },
    notes: { type: String, default: "" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Staff = getModel("Staff", StaffSchema);

const AttendanceSchema = new Schema(
  {
    staff: { type: ObjectId, ref: "Staff", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (IST)
    status: { type: String, enum: ATTENDANCE_STATUS_VALUES, required: true },
    leaveType: { type: String, enum: [...LEAVE_TYPE_VALUES, ""], default: "" },
    approval: { type: String, enum: ["approved", "pending", "rejected"], default: "approved" },
    inTime: Date,
    outTime: Date,
    late: { type: Boolean, default: false },
    note: { type: String, default: "" },
    source: { type: String, enum: ["self", "admin"], default: "admin" },
    updatedBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
AttendanceSchema.index({ staff: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });
export const Attendance = getModel("Attendance", AttendanceSchema);

const SalaryAdvanceSchema = new Schema(
  {
    staff: { type: ObjectId, ref: "Staff", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    recovered: { type: Number, default: 0, min: 0 },
    date: { type: Date, required: true },
    note: { type: String, default: "" },
    createdBy: { type: ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const SalaryAdvance = getModel("SalaryAdvance", SalaryAdvanceSchema);

const PayrollSchema = new Schema(
  {
    staff: { type: ObjectId, ref: "Staff", required: true },
    month: { type: String, required: true }, // YYYY-MM
    salaryType: { type: String, enum: ["monthly", "daily"], default: "monthly" },
    rate: { type: Number, default: 0 }, // monthly salary or daily wage used
    workingDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    paidLeaves: { type: Number, default: 0 },
    holidays: { type: Number, default: 0 },
    unpaidDays: { type: Number, default: 0 },
    unmarkedDays: { type: Number, default: 0 },
    pendingLeaves: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    earned: { type: Number, default: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    advanceDeduction: { type: Number, default: 0, min: 0 },
    otherDeduction: { type: Number, default: 0, min: 0 },
    net: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "paid"], default: "draft" },
    paidOn: Date,
    method: { type: String, default: "" },
    note: { type: String, default: "" },
    advanceAllocations: { type: [{ advance: { type: ObjectId, ref: "SalaryAdvance" }, amount: Number }], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
PayrollSchema.index({ staff: 1, month: 1 }, { unique: true });
export const Payroll = getModel("Payroll", PayrollSchema);
