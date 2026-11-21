// Demo data for itineraries, staff/attendance/payroll and operations (tours, vendors, inventory). All flagged isDemo.
import type { Types } from "mongoose";
import { Attendance, InventoryItem, Itinerary, Payroll, SalaryAdvance, Staff, StockMovement, Tour, Vendor } from "./models";
import { dateKey, generatePayroll, istInstant, monthDays, weekday } from "./services/staff";
import { stockIn, stockOut } from "./services/tours";
import { itineraryToken } from "./services/itineraries";
import { shiftDay } from "./format";

type Inv = { _id: Types.ObjectId; customer: Types.ObjectId; state: string; number: string; tour?: { name?: string; startDate?: Date; endDate?: Date; adults?: number; children?: number; endPoint?: string } | null };

export async function seedOpsDemo(o: { adminId?: Types.ObjectId; invoices: Inv[]; payroll?: { weeklyOff?: number[]; officeStart?: string; graceMinutes?: number; unmarkedAs?: string } | null }) {
  const D = 86400000;
  const by = o.adminId;
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  /* ── Staff */
  const staff = await Staff.insertMany([
    { name: "Sanjay Ghosh", phone: "919830011101", type: "office", designation: "Reservations executive", salaryType: "monthly", salary: 22000, joinDate: new Date(Date.now() - 400 * D), isDemo: true },
    { name: "Mitali Sen", phone: "919830011102", type: "office", designation: "Accounts", salaryType: "monthly", salary: 18000, joinDate: new Date(Date.now() - 250 * D), isDemo: true },
    { name: "Rakesh Yadav", phone: "919830011103", type: "tour_manager", designation: "Tour manager", salaryType: "daily", salary: 1500, isDemo: true },
    { name: "Bablu Mondal", phone: "919830011104", type: "cook", designation: "Cook", salaryType: "daily", salary: 1200, isDemo: true },
    { name: "Gopal Das", phone: "919830011105", type: "helper", designation: "Helper", salaryType: "daily", salary: 700, isDemo: true },
  ]);

  /* ── Attendance: last month + this month up to today */
  const pol = { weeklyOff: o.payroll?.weeklyOff ?? [0], officeStart: o.payroll?.officeStart ?? "10:00" };
  const today = dateKey();
  const thisMonth = today.slice(0, 7);
  const prevMonth = shiftDay(`${thisMonth}-01`, -1).slice(0, 7);
  const recs: Record<string, unknown>[] = [];
  for (const m of [prevMonth, thisMonth])
    for (const day of monthDays(m)) {
      if (day > today || pol.weeklyOff.includes(weekday(day))) continue;
      for (const s of staff.slice(0, 2)) {
        const x = r();
        const isToday = day === today;
        const [h, mi] = pol.officeStart.split(":").map(Number);
        const lateBy = x < 0.12 ? 25 + Math.floor(r() * 30) : Math.floor(r() * 12) - 8;
        const inT = istInstant(day, `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
        const inTime = new Date(inT.getTime() + lateBy * 60000);
        if (x > 0.95 && !isToday) recs.push({ staff: s._id, date: day, status: "leave", leaveType: "casual", approval: "approved", note: "Family function", isDemo: true });
        else if (x > 0.92 && !isToday) recs.push({ staff: s._id, date: day, status: "half_day", inTime, outTime: new Date(inTime.getTime() + 4 * 3600000), isDemo: true });
        else if (x > 0.9 && !isToday) recs.push({ staff: s._id, date: day, status: "absent", isDemo: true });
        else recs.push({ staff: s._id, date: day, status: "present", inTime, outTime: isToday ? undefined : new Date(inTime.getTime() + (8.5 + r()) * 3600000), late: lateBy > (o.payroll?.graceMinutes ?? 15), source: "admin", isDemo: true });
      }
    }
  // a pending leave request for later this week
  recs.push({ staff: staff[1]._id, date: shiftDay(today, 3), status: "leave", leaveType: "sick", approval: "pending", note: "Doctor's appointment", source: "self", isDemo: true });
  await Attendance.insertMany(recs, { ordered: false }).catch(() => undefined);
  await SalaryAdvance.create({ staff: staff[0]._id, amount: 5000, date: new Date(Date.now() - 12 * D), note: "Festival advance", createdBy: by, isDemo: true });
  await generatePayroll(prevMonth, { weeklyOff: pol.weeklyOff, unmarkedAs: (o.payroll?.unmarkedAs as "absent" | "present") ?? "absent" });
  await Payroll.updateMany({ staff: { $in: staff.map((s) => s._id) } }, { isDemo: true });

  /* ── Vendors */
  const v = await Vendor.insertMany([
    { name: "Hotel Lake Paradise", type: "hotel", contactPerson: "Imran Bhat", phone: "919419000201", city: "Srinagar", upiId: "lakeparadise@okaxis", isDemo: true },
    { name: "Royal Houseboats", type: "hotel", contactPerson: "Gulzar", phone: "919419000202", city: "Srinagar", isDemo: true },
    { name: "Valley Cabs", type: "transport", contactPerson: "Bashir Ahmad", phone: "919419000203", city: "Srinagar", isDemo: true },
    { name: "Hotel Desert Pearl", type: "hotel", contactPerson: "Mahendra Singh", phone: "919829000204", city: "Jaisalmer", isDemo: true },
    { name: "Marwar Travels", type: "transport", phone: "919829000205", city: "Jodhpur", isDemo: true },
    { name: "Ma Tara Bhandar", type: "grocery", contactPerson: "Tapan Saha", phone: "919830000206", city: "Kolkata", isDemo: true },
    { name: "Fresh Catch & Meat", type: "fresh", phone: "919830000207", city: "Kolkata", isDemo: true },
    { name: "Indane — Sen Gas Agency", type: "gas", phone: "919830000208", city: "Kolkata", isDemo: true },
  ]);
  const [lake, houseboat, cabs, desert, marwar, grocer, fresh, gas] = v;

  /* ── Tours (linked to real demo invoices where possible) */
  const issued = o.invoices.filter((i) => i.state === "issued" && i.tour?.startDate);
  const pay = (amount: number, daysAgo: number, method = "upi", note = "Advance") => ({ amount, date: new Date(Date.now() - daysAgo * D), method, note });
  const mk = (inv: Inv | undefined, fallback: { name: string; destination: string; start: number; nights: number; pax: number }) => {
    const start = inv?.tour?.startDate ?? new Date(Date.now() + fallback.start * D);
    return {
      name: inv?.tour?.name || fallback.name,
      destination: inv?.tour?.endPoint || fallback.destination,
      startDate: start,
      endDate: inv?.tour?.endDate ?? new Date(start.getTime() + fallback.nights * D),
      pax: inv ? (inv.tour?.adults ?? 0) + (inv.tour?.children ?? 0) || fallback.pax : fallback.pax,
      invoices: inv ? [inv._id] : [],
    };
  };
  const t1h = mk(undefined, { name: "Kashmir Group Tour — Behala Club", destination: "Srinagar · Gulmarg · Pahalgam", start: -2, nights: 6, pax: 18 });
  const t1 = await Tour.create({
    ...t1h,
    status: "ongoing",
    hotels: [
      { vendor: houseboat._id, hotelName: "Royal Houseboats (Dal Lake)", city: "Srinagar", checkIn: t1h.startDate, checkOut: new Date(t1h.startDate.getTime() + 2 * D), rooms: 6, roomType: "Deluxe houseboat", mealPlan: "MAP", amount: 54000, payments: [pay(20000, 20, "bank_transfer"), pay(34000, 2, "upi", "Balance at check-in")] },
      { vendor: lake._id, hotelName: "Hotel Lake Paradise", city: "Pahalgam", checkIn: new Date(t1h.startDate.getTime() + 2 * D), checkOut: new Date(t1h.startDate.getTime() + 6 * D), rooms: 6, roomType: "Super deluxe", mealPlan: "MAP", amount: 96000, payments: [pay(30000, 18, "bank_transfer")] },
    ],
    cars: [
      { vendor: cabs._id, vehicleType: "Tempo Traveller (17 seater)", carNumber: "JK01AB4521", driverName: "Bashir Ahmad", driverPhone: "919419000203", fromDate: t1h.startDate, toDate: t1h.endDate, amount: 42000, payments: [pay(10000, 10)] },
      { vendor: cabs._id, vehicleType: "Innova Crysta", carNumber: "JK01C7788", driverName: "Farooq", driverPhone: "919906012345", fromDate: t1h.startDate, toDate: t1h.endDate, amount: 21000, payments: [pay(5000, 10)] },
    ],
    staff: [
      { staff: staff[2]._id, name: staff[2].name, role: "Tour manager", days: 7, amount: 10500, payments: [pay(4000, 3, "cash")] },
      { staff: staff[3]._id, name: staff[3].name, role: "Cook", days: 7, amount: 8400, payments: [pay(3000, 3, "cash")] },
      { staff: staff[4]._id, name: staff[4].name, role: "Helper", days: 7, amount: 4900, payments: [] },
    ],
    expenses: [
      { category: "train", description: "18 × 3AC Howrah → Jammu Tawi (return)", date: new Date(t1h.startDate.getTime() - 40 * D), quantity: 36, unit: "ticket", amount: 68400, payments: [pay(68400, 40, "upi", "Paid on booking")] },
      { category: "gas", description: "LPG cylinder refill (on tour)", vendor: gas._id, date: t1h.startDate, quantity: 1, unit: "cylinder", amount: 1150, payments: [pay(1150, 1, "cash", "Paid")] },
      { category: "fresh", description: "Vegetables, fruits, milk — local market", date: t1h.startDate, amount: 6200, payments: [pay(4000, 1, "cash")] },
      { category: "entry", description: "Gulmarg Gondola phase 1 × 18", amount: 14400, payments: [] },
    ],
    notes: "Group of 18 from the club. Veg + non-veg meals cooked by our team.",
    createdBy: by,
    isDemo: true,
  });
  const inv2 = issued[0];
  const t2h = mk(inv2, { name: "Rajasthan Royal Tour", destination: "Jaipur · Jodhpur · Jaisalmer", start: 18, nights: 6, pax: 4 });
  await Tour.create({
    ...t2h,
    status: "planned",
    hotels: [{ vendor: desert._id, hotelName: "Hotel Desert Pearl", city: "Jaisalmer", checkIn: t2h.startDate, checkOut: new Date(t2h.startDate.getTime() + 2 * D), rooms: 2, roomType: "Swiss tent", mealPlan: "MAP", amount: 24000, payments: [pay(8000, 4, "bank_transfer")] }],
    cars: [{ vendor: marwar._id, vehicleType: "Innova Crysta", carNumber: "RJ14 TA 2210", driverName: "Ramesh", driverPhone: "919829000301", fromDate: t2h.startDate, toDate: t2h.endDate, amount: 28000, payments: [pay(5000, 4)] }],
    staff: [],
    expenses: [{ category: "flight_bus", description: "Flight CCU → JAI × 4", amount: 26800, payments: [pay(26800, 6, "card", "Paid")] }],
    createdBy: by,
    isDemo: true,
  });
  const inv3 = issued[1];
  const t3h = mk(inv3, { name: "Darjeeling & Gangtok Family Trip", destination: "Darjeeling · Gangtok", start: -25, nights: 5, pax: 5 });
  if (!inv3) t3h.startDate = new Date(Date.now() - 25 * D);
  await Tour.create({
    ...t3h,
    status: inv3 && t3h.startDate > new Date() ? "planned" : "completed",
    hotels: [{ hotelName: "Mayfair Hill Resort", city: "Darjeeling", checkIn: t3h.startDate, checkOut: new Date(t3h.startDate.getTime() + 3 * D), rooms: 2, roomType: "Deluxe", mealPlan: "CP", amount: 31500, payments: [pay(31500, 26, "bank_transfer", "Full payment")] }],
    cars: [{ vehicleType: "Scorpio", carNumber: "WB74 AK 1190", driverName: "Pemba Sherpa", driverPhone: "919733000401", fromDate: t3h.startDate, toDate: t3h.endDate, amount: 19500, payments: [pay(19500, 20, "cash", "Paid")] }],
    staff: [],
    expenses: [{ category: "entry", description: "Tiger Hill & toy train", amount: 4200, payments: [pay(4200, 24, "cash", "Paid")] }],
    createdBy: by,
    isDemo: true,
  });

  /* ── Group departure with a guest booking register (like the office's Excel sheet) */
  const gStart = new Date(Date.now() + 9 * D);
  gStart.setHours(0, 0, 0, 0);
  const ACT = [{ name: "Jeep safari", rate: 700 }, { name: "Camel ride", rate: 200 }];
  const P = (list: number[], daysBack: number, note = "Advance") => list.map((amount, i) => ({ amount, date: new Date(Date.now() - (daysBack - i * 6) * D), method: i % 2 ? "cash" : "upi", note: list.length > 1 ? `${note} ${i + 1}` : note }));
  type Bk = [string, string, string, number, number, number, string, number, number[], ("none" | "by_us" | "own")?, number?, number[]?, string?, number?, string?, number?, number?, number[]?, boolean?, string?, string?];
  // name, phone, bill, adults, children, rooms, roomType, amount, advances, ticketMode, ticketAmt, ticketPaid, ticketDetails, refunded, ticketStatus, jeep, camel, activityPaid, payAtSpot, remarks, status
  const rows: Bk[] = [
    ["Subhajit Roy", "9830528203", "Digital", 2, 0, 1, "Private room", 45000, [10000, 24000, 11000], "by_us", 11000, [10000, 1000], "3AC Howrah → Jaisalmer", 0, "booked", 2, 2, [1800]],
    ["Moumita Saha", "9831719232", "1482", 2, 0, 1, "Sharing", 44000, [10000, 10462], "own", 0, [], "", 0, "pending", 0, 2, [], true, "Balance before departure"],
    ["Debasish Pal", "9433199116", "BOTH", 3, 0, 1, "Sharing", 44000, [4000, 7000, 9000], "by_us", 5000, [5000], "AC Duranta", 0, "booked", 0, 0, [], false, "", ],
    ["Ananya Ghosh", "9874544070", "1483", 1, 0, 1, "Solo (sharing)", 22500, [5000, 10000, 7500], "by_us", 1500, [], "", 0, "to_cancel", 0, 0, [], false, "Ticket will be cancelled"],
    ["Rupa Mondal", "9007780747", "DG", 1, 0, 1, "Solo (sharing)", 22500, [3000, 18000], "own"],
    ["Tapas Banerjee", "9830083883", "1490", 3, 0, 1, "Triple share", 63000, [15000], "own", 0, [], "", 0, "pending", 0, 0, [], false, "Will pay balance on arrival in Jaipur"],
    ["Sourav Dutta", "9836653074", "1485", 3, 2, 2, "Private room", 90000, [20000, 30000, 20000, 20000], "by_us", 21400, [11800, 9600], "3AC", 0, "booked", 5, 0, [3500]],
    ["Priyanka Sen", "9051156806", "1486", 4, 0, 2, "Private room", 88000, [20000, 27778, 40222], "by_us", 20000, [20000], "Flight CCU → JAI", 0, "booked", 0, 0, [], false, "20K for flight ticket"],
    ["Arindam Kar", "9830001308", "1487", 2, 0, 1, "Private room", 45000, [10000, 14000], "by_us", 11220, [11220], "AC Duranta", 0, "booked", 0, 2, [400]],
    ["Kakoli Das", "9903539375", "1493", 2, 1, 1, "Private room", 64500, [36000, 28500], "by_us", 7500, [7500], "3AC", 0, "booked", 3, 2, [2500], false, "2 camel & 3 jeep"],
    ["Rahul Chatterjee", "9433360778", "1494", 2, 0, 1, "Private room", 45000, [6000, 14000, 764], "by_us", 10000, [10000], "3AC", 0, "booked", 0, 0, [], false, "Extra room needed", ],
    ["Sumana Biswas", "9831709078", "Digital", 3, 1, 1, "Private room", 58500, [10000, 10000, 30000], "own", 0, [], "", 0, "pending", 6, 6, [5400]],
    ["Joydeep Halder", "9007005275", "2505", 3, 0, 1, "Triple share", 64500, [15000, 21000, 28500], "by_us", 15000, [15000], "3AC", 0, "booked", 3, 3, [], true, "Jeep + camel — will pay there"],
    ["Rina Paul", "9830189737", "2507", 2, 0, 1, "Private room", 45000, [10000, 14000, 21000], "by_us", 10443, [10443], "3AC", 0, "booked", 2, 0, [1400]],
    ["Bikram Sarkar", "9874509583", "2511", 4, 1, 2, "Private room", 96000, [20000, 41334, 34666], "by_us", 22332, [10000, 12332], "3AC", 0, "booked", 5, 0, [3500], false, "Paid for jeep only"],
    ["Nandini Roy", "9163110654", "2313", 2, 0, 1, "Private room", 64500, [5000, 5000, 5000], "by_us", 10000, [10000], "", 10000, "cancelled", 0, 0, [], false, "Ticket refunded — 10K returned"],
    ["Ashok Kundu", "9830908938", "2315", 1, 0, 1, "Solo (own room)", 22500, [2500], "none", 0, [], "", 0, "pending", 0, 0, [], false, "", "cancelled"],
  ];
  const bookings = rows.map(([guestName, phone, billNo, adults, children, rooms, roomType, amount, adv, mode = "none", tAmt = 0, tPaid = [], tDet = "", refunded = 0, tStatus = "pending", jeep = 0, camel = 0, aPaid = [], payAtSpot = false, remarks = "", status = "confirmed"], i) => ({
    guestName, phone: "91" + phone, billNo, adults, children, rooms, roomType, amount,
    extraAmount: i === 10 ? 7000 : 0, extraNote: i === 10 ? "Extra room" : "",
    payments: P(adv, 40 - i),
    ticket: { mode, kind: tDet.startsWith("Flight") ? "flight" : "train", details: tDet.replace(/^Flight\s*/, ""), amount: tAmt, payments: P(tPaid, 35 - i, "Ticket"), refunded, status: tStatus },
    addOns: [{ name: "Jeep safari", persons: jeep, rate: 700 }, { name: "Camel ride", persons: camel, rate: 200 }].filter((a) => a.persons),
    addOnPayments: P(aPaid, 20, "Activities"),
    payAtSpot, remarks, status,
  }));
  await Tour.create({
    name: "Rajasthan Desert Group — Batch 1",
    destination: "Jaipur · Jaisalmer · Jodhpur",
    startDate: gStart,
    endDate: new Date(gStart.getTime() + 7 * D),
    pax: 40,
    status: "planned",
    activities: ACT,
    bookings,
    hotels: [
      { hotelName: "Hotel Pink Pearl", city: "Jaipur", checkIn: gStart, checkOut: new Date(gStart.getTime() + 2 * D), rooms: 19, roomType: "Deluxe", mealPlan: "MAP", amount: 190000, payments: [pay(60000, 15, "bank_transfer")] },
      { hotelName: "Blue City Residency", city: "Jodhpur", checkIn: new Date(gStart.getTime() + 4 * D), checkOut: new Date(gStart.getTime() + 7 * D), rooms: 19, roomType: "Deluxe", mealPlan: "MAP", amount: 228000, payments: [pay(50000, 12, "bank_transfer")] },
      { vendor: desert._id, hotelName: "Hotel Desert Pearl", city: "Jaisalmer", checkIn: new Date(gStart.getTime() + 2 * D), checkOut: new Date(gStart.getTime() + 4 * D), rooms: 18, roomType: "Swiss tent", mealPlan: "MAP", amount: 216000, payments: [pay(80000, 15, "bank_transfer")] },
    ],
    cars: [{ vendor: marwar._id, vehicleType: "AC Bus (45 seater)", carNumber: "RJ14 PB 7781", driverName: "Suresh Meena", driverPhone: "919829000501", fromDate: gStart, toDate: new Date(gStart.getTime() + 7 * D), amount: 112000, payments: [pay(30000, 15)] }],
    staff: [{ staff: staff[2]._id, name: staff[2].name, role: "Tour manager", days: 8, amount: 12000, payments: [] }, { staff: staff[3]._id, name: staff[3].name, role: "Cook", days: 8, amount: 9600, payments: [] }],
    expenses: [
      { category: "train", description: "Group 3AC Howrah → Jaisalmer (12 bookings)", amount: 133895, payments: [pay(133895, 30, "upi", "Paid on booking")] },
      { category: "guide", description: "Jeep safari & camel operator, Sam dunes", amount: 16800, payments: [] },
      { category: "entry", description: "Amber Fort, Mehrangarh & museum tickets", amount: 26400, payments: [] },
    ],
    notes: "Group departure. Jeep safari ₹700 and camel ride ₹200 per person at Sam dunes.",
    createdBy: by,
    isDemo: true,
  });

  /* ── Store inventory: buy in, then issue some to the Kashmir group */
  const items = await InventoryItem.insertMany([
    { name: "Basmati rice", category: "grocery", unit: "kg", minStock: 20, isDemo: true },
    { name: "Mustard oil", category: "grocery", unit: "litre", minStock: 10, isDemo: true },
    { name: "Moong dal", category: "grocery", unit: "kg", minStock: 10, isDemo: true },
    { name: "Chicken", category: "meat_fish", unit: "kg", minStock: 0, isDemo: true },
    { name: "Rohu fish", category: "meat_fish", unit: "kg", minStock: 0, isDemo: true },
    { name: "LPG cylinder (14.2 kg)", category: "gas", unit: "cylinder", minStock: 2, isDemo: true },
    { name: "Potatoes & onions", category: "fresh", unit: "kg", minStock: 15, isDemo: true },
  ]);
  const uid = by ?? staff[0]._id;
  const daysAgo = (n: number) => new Date(Date.now() - n * D);
  const buys: [number, number, number, number, Types.ObjectId][] = [
    // item idx, qty, rate, paid, vendor
    [0, 60, 95, 5700, grocer._id],
    [0, 40, 102, 0, grocer._id],
    [1, 30, 165, 4950, grocer._id],
    [2, 25, 118, 2000, grocer._id],
    [3, 25, 220, 5500, fresh._id],
    [4, 12, 260, 0, fresh._id],
    [5, 4, 905, 3620, gas._id],
    [6, 40, 32, 1280, grocer._id],
  ];
  for (const [i, q, rate, paid, vendor] of buys) await stockIn(items[i]._id, { quantity: q, rate, paid, vendor, date: daysAgo(8 - (i % 5)), note: "" }, uid);
  const issues: [number, number][] = [
    [0, 45],
    [1, 12],
    [2, 9],
    [3, 22],
    [4, 10],
    [5, 2],
    [6, 30],
  ];
  for (const [i, q] of issues) await stockOut(items[i]._id, { quantity: q, tour: t1._id, date: daysAgo(2), note: "Packed for Kashmir group" }, uid);
  await StockMovement.updateMany({ item: { $in: items.map((x) => x._id) } }, { isDemo: true });

  /* ── Itineraries */
  const base = issued[2] ?? issued[0];
  const day = (title: string, description: string, stay: string, b: boolean, l: boolean, d: boolean, activities: string, transport: string) => ({ title, description, stay, meals: { breakfast: b, lunch: l, dinner: d }, activities, transport });
  await Itinerary.create([
    {
      title: "Kashmir — Paradise on Earth (5N/6D)",
      customer: base?.customer,
      destination: "Kashmir",
      startDate: new Date(Date.now() + 30 * D),
      adults: 2,
      children: 1,
      startPoint: "Srinagar Airport",
      endPoint: "Srinagar Airport",
      days: [
        day("Arrival in Srinagar · Shikara ride", "Arrive at Srinagar airport. Our representative meets you and transfers you to the houseboat. Evening Shikara ride on Dal Lake.", "Deluxe houseboat, Dal Lake", false, false, true, "Shikara ride, floating market", "Airport pickup (Innova)"),
        day("Srinagar → Gulmarg", "After breakfast, drive to Gulmarg — the meadow of flowers. Enjoy the Gondola ride (own cost). Return to Srinagar.", "Hotel Lake Paradise, Srinagar", true, false, true, "Gulmarg Gondola, snow point", "Private vehicle"),
        day("Srinagar → Pahalgam", "Drive to Pahalgam via saffron fields and Awantipora ruins. Evening by the Lidder river.", "Pahalgam Grand", true, false, true, "Saffron fields, Betaab valley", "Private vehicle"),
        day("Pahalgam sightseeing", "Visit Aru valley, Chandanwari and Betaab valley by local union cab (own cost).", "Pahalgam Grand", true, false, true, "Aru, Chandanwari", "Local union cab"),
        day("Pahalgam → Srinagar · Mughal gardens", "Return to Srinagar. Visit Nishat Bagh, Shalimar Bagh and Chashme Shahi.", "Hotel Lake Paradise, Srinagar", true, false, true, "Mughal gardens, local market", "Private vehicle"),
        day("Departure", "After breakfast, check out and transfer to the airport with sweet memories.", "", true, false, false, "", "Drop to airport"),
      ],
      inclusions: "Accommodation on twin sharing\nBreakfast & dinner (MAP)\nAll transfers & sightseeing by private vehicle\nShikara ride (1 hour)\nAll taxes & driver allowance",
      exclusions: "Air / train fare\nGondola, pony & union cab charges\nLunch & personal expenses\nAnything not mentioned in inclusions",
      pricePerAdult: 24500,
      pricePerChild: 12000,
      priceNote: "Valid for travel till March. Rates may change on peak dates.",
      status: "sent",
      shareToken: itineraryToken(),
      createdBy: by,
      isDemo: true,
    },
    {
      title: "Royal Rajasthan (6N/7D)",
      guestName: "Mr. & Mrs. Banerjee",
      destination: "Rajasthan",
      startDate: new Date(Date.now() + 45 * D),
      adults: 2,
      startPoint: "Jaipur Airport",
      endPoint: "Jodhpur Airport",
      days: [
        day("Arrival in Jaipur", "Arrive in the Pink City and check in. Evening at Chokhi Dhani.", "Hotel in Jaipur", false, false, true, "Chokhi Dhani", "Airport pickup"),
        day("Jaipur sightseeing", "Amber Fort, Hawa Mahal, City Palace and Jantar Mantar.", "Hotel in Jaipur", true, false, true, "Amber Fort, Hawa Mahal", "Private vehicle"),
        day("Jaipur → Jaisalmer", "Long scenic drive to the Golden City.", "Hotel Desert Pearl", true, false, true, "", "Private vehicle"),
        day("Sam sand dunes", "Jaisalmer Fort, Patwon ki Haveli, then camel safari and cultural night at Sam dunes.", "Swiss tent, Sam", true, false, true, "Camel safari, folk dance", "Private vehicle"),
        day("Jaisalmer → Jodhpur", "Drive to the Blue City. Evening at Clock Tower market.", "Hotel in Jodhpur", true, false, true, "", "Private vehicle"),
        day("Jodhpur sightseeing", "Mehrangarh Fort, Jaswant Thada and Umaid Bhawan museum.", "Hotel in Jodhpur", true, false, true, "Mehrangarh Fort", "Private vehicle"),
        day("Departure", "Transfer to Jodhpur airport.", "", true, false, false, "", "Drop to airport"),
      ],
      inclusions: "Hotels on twin sharing\nBreakfast & dinner\nPrivate Innova for the whole tour\nCamel safari at Sam",
      exclusions: "Flights\nMonument entry tickets\nLunch",
      pricePerAdult: 31800,
      status: "draft",
      shareToken: itineraryToken(),
      createdBy: by,
      isDemo: true,
    },
  ]);
  return { staff: staff.length, vendors: v.length, tours: 4, items: items.length };
}

export async function clearOpsDemo() {
  const demoStaff = (await Staff.find({ isDemo: true }, { _id: 1 }).lean()).map((s) => s._id);
  const demoItems = (await InventoryItem.find({ isDemo: true }, { _id: 1 }).lean()).map((s) => s._id);
  await Promise.all([
    Attendance.deleteMany({ $or: [{ isDemo: true }, { staff: { $in: demoStaff } }] }),
    SalaryAdvance.deleteMany({ $or: [{ isDemo: true }, { staff: { $in: demoStaff } }] }),
    Payroll.deleteMany({ $or: [{ isDemo: true }, { staff: { $in: demoStaff } }] }),
    StockMovement.deleteMany({ $or: [{ isDemo: true }, { item: { $in: demoItems } }] }),
    Tour.deleteMany({ isDemo: true }),
    Itinerary.deleteMany({ isDemo: true }),
  ]);
  await Promise.all([Staff.deleteMany({ isDemo: true }), InventoryItem.deleteMany({ isDemo: true }), Vendor.deleteMany({ isDemo: true })]);
}
