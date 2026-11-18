// Demo data generator. Every record is flagged isDemo so it can be removed in one click.
import bcrypt from "bcryptjs";
import { Activity, Conversation, Customer, FollowUp, Invoice, Lead, Message, Notification, User } from "./models";
import { SCENARIOS } from "./demo-scenarios";
import { computeTotals, deriveStatus, nextInvoiceNumber, shareToken } from "./services/invoices";
import { getSettings } from "./services/settings";
import { round2 } from "./format";
import type { LeadSource, LeadStatus } from "./constants";

export const DEMO_EMAIL_DOMAIN = "demo.aalattravels.in";
export const DEMO_PASSWORD = "Demo@1234";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const FIRST = ["Aarav", "Diya", "Rohan", "Sneha", "Kabir", "Isha", "Aditya", "Meera", "Siddharth", "Pooja", "Nikhil", "Kavya", "Rahul", "Anjali", "Varun", "Neha", "Arjun", "Tanvi", "Manish", "Ritika", "Suresh", "Lakshmi", "Imran", "Fatima", "Gurpreet", "Harleen", "Debashish", "Moumita", "Joseph", "Sarah", "Amit", "Shreya", "Prakash", "Divya", "Farhan", "Nandini"];
const LAST = ["Sharma", "Verma", "Gupta", "Reddy", "Nair", "Iyer", "Banerjee", "Chatterjee", "Khan", "Singh", "Patel", "Joshi", "Mehta", "Kapoor", "Das", "Ghosh", "Pillai", "Menon", "Agarwal", "Bose"];
const CITIES = ["Kolkata", "Delhi", "Mumbai", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Jaipur", "Ahmedabad", "Lucknow", "Siliguri", "Bhubaneswar", "Guwahati", "Indore"];
const DESTS: { d: string; price: number; pkg: string }[] = [
  { d: "Goa", price: 14999, pkg: "Goa Beach Escape (4N/5D)" },
  { d: "Kashmir", price: 21999, pkg: "Kashmir Paradise (5N/6D)" },
  { d: "Kerala", price: 18499, pkg: "Kerala Backwaters & Hills (5N/6D)" },
  { d: "Manali", price: 12999, pkg: "Manali Snow Adventure (4N/5D)" },
  { d: "Darjeeling", price: 16999, pkg: "Darjeeling & Gangtok Delight (5N/6D)" },
  { d: "Dubai", price: 49999, pkg: "Dubai Delight (4N/5D)" },
  { d: "Bali", price: 54999, pkg: "Bali Honeymoon Special (5N/6D)" },
  { d: "Maldives", price: 79999, pkg: "Maldives Overwater Bliss (3N/4D)" },
  { d: "Thailand", price: 39999, pkg: "Thailand Fun Tour (5N/6D)" },
  { d: "Rajasthan", price: 22999, pkg: "Royal Rajasthan (6N/7D)" },
];
const POINTS: Record<string, [string, string]> = {
  Goa: ["Goa Airport (GOI)", "Goa Airport (GOI)"],
  Kashmir: ["Srinagar Airport", "Srinagar Airport"],
  Kerala: ["Kochi Airport (COK)", "Trivandrum Airport"],
  Manali: ["Delhi (Volvo pickup)", "Delhi (Volvo drop)"],
  Darjeeling: ["NJP / Bagdogra", "NJP / Bagdogra"],
  Dubai: ["Kolkata Airport (CCU)", "Kolkata Airport (CCU)"],
  Bali: ["Kolkata Airport (CCU)", "Kolkata Airport (CCU)"],
  Maldives: ["Kolkata Airport (CCU)", "Kolkata Airport (CCU)"],
  Thailand: ["Kolkata Airport (CCU)", "Kolkata Airport (CCU)"],
  Rajasthan: ["Jaipur Airport", "Udaipur Airport"],
};
const SOURCES: LeadSource[] = ["meta_ads", "meta_ads", "meta_ads", "google_ads", "google_ads", "whatsapp", "whatsapp", "website", "referral", "walk_in", "phone_call"];
const MONTHS = ["December", "January", "February", "March", "April", "May", "June", "October", "November"];
const NOTES = [
  "Asked for a 4★ hotel option and early check-in.",
  "Prefers vegetarian meals; travelling with elderly parents.",
  "Comparing with another agency — share best price by evening.",
  "Wants flights from Kolkata included in the quote.",
  "Interested in adding a 1-night extension.",
  "Requested EMI option on HDFC credit card.",
  "Will confirm after checking leave from office.",
  "Anniversary trip — suggest a candlelight dinner add-on.",
];
const CAMPAIGNS: Partial<Record<LeadSource, string[]>> = {
  meta_ads: ["Goa Winter Offer – FB", "Honeymoon Specials – Instagram", "Kashmir Snow Sale – FB", "Dubai Shopping Festival – IG"],
  google_ads: ["Kashmir Tour Packages – Search", "Kerala Packages – Search", "Bali Honeymoon – Search"],
};

export async function seedDemo(adminId?: string) {
  await clearDemo();
  const settings = await getSettings();
  const r = rng(20261117);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const now = Date.now();
  const H = 3600000;
  const D = 24 * H;

  // ── team
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const agents = await User.insertMany([
    { name: "Priya Nair", email: `priya@${DEMO_EMAIL_DOMAIN}`, phone: "919000000101", passwordHash: hash, role: "agent", color: "#E2725B" },
    { name: "Arjun Das", email: `arjun@${DEMO_EMAIL_DOMAIN}`, phone: "919000000102", passwordHash: hash, role: "agent", color: "#3B82F6" },
  ]);
  const admin = adminId ? await User.findById(adminId) : await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
  const team = [...agents.map((a) => a._id), ...(admin ? [admin._id] : [])];

  // ── leads
  const statusPlan: LeadStatus[] = [
    ...Array(8).fill("new"),
    ...Array(9).fill("interested"),
    ...Array(7).fill("follow_up"),
    ...Array(5).fill("not_interested"),
    ...Array(11).fill("converted"),
  ];
  const leads = [];
  for (let i = 0; i < statusPlan.length; i++) {
    const status = statusPlan[i];
    const first = FIRST[i % FIRST.length];
    const last = pick(LAST);
    const dest = pick(DESTS);
    const source = pick(SOURCES);
    const adults = 1 + Math.floor(r() * 5);
    const children = r() < 0.35 ? 1 + Math.floor(r() * 2) : 0;
    const createdAt = new Date(now - Math.floor(r() * 58 * D) - Math.floor(r() * 10 * H));
    leads.push({
      name: `${first} ${last}`,
      phone: `91${9000000000 + Math.floor(r() * 999999999)}`.slice(0, 12),
      email: r() < 0.6 ? `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(r() * 90 + 10)}@gmail.com` : "",
      city: pick(CITIES),
      source,
      campaign: CAMPAIGNS[source] ? pick(CAMPAIGNS[source]!) : "",
      status,
      destination: dest.d,
      travelDate: `${Math.ceil(r() * 28)} ${pick(MONTHS)}`,
      travellers: { adults, children },
      budget: r() < 0.7 ? Math.round((dest.price * adults * (0.85 + r() * 0.4)) / 1000) * 1000 : 0,
      requirements: pick(NOTES),
      language: pick(["en", "en", "hi", "hi-Latn", "bn"]),
      assignedTo: team[i % team.length],
      lastContactAt: new Date(createdAt.getTime() + Math.floor(r() * 3 * D)),
      convertedAt: status === "converted" ? new Date(createdAt.getTime() + Math.floor((2 + r() * 6) * D)) : undefined,
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
    });
  }
  const leadDocs = await Lead.insertMany(leads);

  // ── customers for converted leads
  const activities: Record<string, unknown>[] = [];
  const customers = [];
  for (const l of leadDocs) {
    activities.push({ lead: l._id, type: "created", message: `Lead captured from ${l.source === "meta_ads" ? "Meta Ads (FB / IG)" : l.source === "google_ads" ? "Google Ads" : l.source.replace("_", " ")}${l.campaign ? ` (${l.campaign})` : ""}`, createdAt: l.createdAt });
    activities.push({ lead: l._id, type: "assignment", message: `Auto-assigned to ${[...agents, admin].find((u) => u && String(u._id) === String(l.assignedTo))?.name ?? "agent"}`, createdAt: new Date(l.createdAt!.getTime() + 1000) });
    if (l.status !== "new") {
      activities.push({ lead: l._id, type: "call", message: `Call: discussed ${l.destination} package, shared itinerary on WhatsApp`, user: l.assignedTo, createdAt: new Date(l.createdAt!.getTime() + 5 * H) });
      activities.push({ lead: l._id, type: "status_change", message: `Status changed from New to ${l.status === "follow_up" ? "Follow-up Required" : l.status === "not_interested" ? "Not Interested" : "Interested"}`, user: l.assignedTo, createdAt: new Date(l.createdAt!.getTime() + 6 * H) });
    }
    if (l.status === "converted") {
      customers.push({
        name: l.name,
        phone: l.phone,
        email: l.email,
        city: l.city,
        language: l.language,
        preferences: {
          destinations: [l.destination],
          travelStyle: l.travellers!.children ? "Family" : l.travellers!.adults === 2 ? pick(["Honeymoon", "Family"]) : pick(["Friends / Group", "Corporate", "Family"]),
          hotelCategory: pick(["3 Star", "4 Star", "4 Star", "5 Star", "Resort / Villa"]),
          mealPreference: pick(["No preference", "Vegetarian", "Vegetarian", "Non-vegetarian", "Jain"]),
          budgetRange: l.budget ? `₹${l.budget.toLocaleString("en-IN")}` : "",
          notes: l.requirements,
        },
        tags: r() < 0.4 ? ["Repeat"] : [],
        sourceLead: l._id,
        isDemo: true,
        createdAt: l.convertedAt,
        updatedAt: l.convertedAt,
      });
    }
  }
  const custDocs = await Customer.insertMany(customers);
  for (const c of custDocs) {
    const lead = leadDocs.find((l) => String(l._id) === String(c.sourceLead))!;
    await Lead.updateOne({ _id: lead._id }, { $set: { customer: c._id } });
    activities.push({ lead: lead._id, customer: c._id, type: "converted", message: `Lead converted to customer · ${lead.destination}`, user: lead.assignedTo, createdAt: lead.convertedAt });
  }

  // ── invoices (one per customer)
  const invoicePlans = ["paid", "paid", "paid", "partial", "partial", "sent", "overdue", "overdue", "draft", "paid", "partial"];
  const invDocs = [];
  for (let i = 0; i < custDocs.length; i++) {
    const c = custDocs[i];
    const lead = leadDocs.find((l) => String(l._id) === String(c.sourceLead))!;
    const dest = DESTS.find((d) => d.d === lead.destination)!;
    const plan = invoicePlans[i % invoicePlans.length];
    const adults = lead.travellers!.adults || 2;
    const children = lead.travellers!.children || 0;
    const items = [
      { description: `${dest.pkg} — adults (twin sharing)`, quantity: adults, rate: dest.price },
      ...(children ? [{ description: `${dest.pkg} — child without extra bed`, quantity: children, rate: Math.round(dest.price / 2) }] : []),
      ...(r() < 0.5 ? [{ description: "Airport transfers & travel insurance", quantity: 1, rate: 2500 + Math.floor(r() * 4) * 500 }] : []),
    ];
    const discount = r() < 0.4 ? 1000 * Math.ceil(r() * 3) : 0;
    const totals = computeTotals(items, discount, settings.invoice?.defaultTaxRate ?? 5);
    const issueDate = plan === "overdue" ? new Date(now - (20 + i) * D) : new Date(lead.convertedAt!.getTime());
    const dueDate = plan === "overdue" ? new Date(now - (6 + i) * D) : new Date(Math.max(issueDate.getTime() + 7 * D, now + (3 + i) * D));
    const payments: Record<string, unknown>[] = [];
    if (plan === "paid") payments.push({ amount: round2(totals.total / 2), date: new Date(issueDate.getTime() + D), method: "upi", reference: `UPI${Math.floor(r() * 1e10)}` }, { amount: round2(totals.total - round2(totals.total / 2)), date: new Date(issueDate.getTime() + 5 * D), method: "bank_transfer", reference: `NEFT${Math.floor(r() * 1e8)}` });
    if (plan === "partial" || plan === "overdue") payments.push({ amount: round2(Math.round(totals.total * 0.5)), date: new Date(issueDate.getTime() + D), method: pick(["upi", "bank_transfer", "card"]), reference: `TXN${Math.floor(r() * 1e9)}` });
    if (plan === "overdue" && i % 2) payments.length = 0;
    const amountPaid = round2(payments.reduce((s, p) => s + (p.amount as number), 0));
    const state = plan === "draft" ? "draft" : "issued";
    invDocs.push({
      number: await nextInvoiceNumber({ style: settings.invoice?.numberStyle, prefix: settings.invoice?.prefix, startNumber: settings.invoice?.startNumber }, issueDate),
      customer: c._id,
      lead: lead._id,
      tripTitle: `${dest.pkg.replace(/ \(.*\)$/, "")}`,
      tour: (() => {
        const m = dest.pkg.match(/\((\d+)N\/(\d+)D\)/);
        const nights = m ? +m[1] : 4;
        const start = new Date(issueDate.getTime() + (12 + (i % 5) * 9) * D);
        start.setHours(0, 0, 0, 0);
        const pts = POINTS[dest.d] ?? ["Pickup point", "Drop point"];
        return {
          name: dest.pkg.replace(/ \(.*\)$/, ""),
          duration: m ? `${nights} Nights / ${m[2]} Days` : "",
          adults,
          children,
          rooms: Math.max(1, Math.ceil(adults / 2)),
          startDate: start,
          endDate: new Date(start.getTime() + nights * D),
          startPoint: pts[0],
          endPoint: pts[1],
          foodPlan: ["CP (Breakfast)", "MAP (Breakfast + Dinner)", "MAP (Breakfast + Dinner)", "AP (All meals)"][i % 4],
          propertyType: dest.d === "Kashmir" ? "Hotel + Houseboat" : dest.d === "Maldives" ? "Resort" : ["Hotel", "Resort", "Hotel"][i % 3],
          vehicleSeat: adults + children > 4 ? "7 Seater" : "4 Seater",
          vehicleType: adults + children > 4 ? "SUV (Innova / Ertiga)" : "Sedan (Dzire / Etios)",
        };
      })(),
      issueDate,
      dueDate,
      ...totals,
      amountPaid,
      balance: round2(Math.max(totals.total - amountPaid, 0)),
      payments,
      state,
      status: deriveStatus({ state, total: totals.total, amountPaid, dueDate }),
      notes: "Thank you for choosing Aalat Travels! Have a wonderful journey.",
      terms: settings.invoice?.terms ?? "",
      shareToken: shareToken(),
      isDemo: true,
      createdBy: lead.assignedTo,
    });
    activities.push({ customer: c._id, lead: lead._id, type: "invoice", message: `Invoice created · ₹${totals.total.toLocaleString("en-IN")}`, createdAt: issueDate });
  }
  await Invoice.insertMany(invDocs);

  // ── follow-ups
  const open = leadDocs.filter((l) => ["new", "interested", "follow_up"].includes(l.status));
  const fus: { title: string; type: string; dueAt: Date; status: string; lead?: unknown; customer?: unknown; assignedTo?: unknown; isDemo: boolean; notes?: string; completedAt?: Date; outcome?: string }[] = [];
  const titles = ["Call to discuss itinerary", "Share revised quote on WhatsApp", "Confirm travel dates", "Send hotel options", "Check if they discussed with family", "Collect advance payment", "Share visa document checklist"];
  open.forEach((l, i) => {
    const bucket = i % 4; // 0 overdue, 1 today, 2 upcoming, 3 completed
    const due = bucket === 0 ? now - (1 + (i % 3)) * D - 2 * H : bucket === 1 ? now + (((i % 5) - 2) * H) : bucket === 2 ? now + (1 + (i % 6)) * D : now - (2 + (i % 4)) * D;
    fus.push({
      title: titles[i % titles.length],
      type: (["call", "whatsapp", "call", "meeting", "email"] as const)[i % 5],
      dueAt: new Date(due),
      status: bucket === 3 ? "completed" : "pending",
      completedAt: bucket === 3 ? new Date(due + H) : undefined,
      outcome: bucket === 3 ? "Spoke to customer — they will confirm dates by the weekend." : "",
      notes: l.requirements,
      lead: l._id,
      assignedTo: l.assignedTo,
      isDemo: true,
    });
  });
  // customer follow-ups (balance collection)
  for (const inv of invDocs.filter((x) => x.balance > 0 && x.state === "issued").slice(0, 3)) {
    fus.push({ title: "Remind about pending balance payment", type: "whatsapp", dueAt: new Date(now + 26 * H), status: "pending", customer: inv.customer, assignedTo: team[0], isDemo: true, notes: `Invoice ${inv.number} balance due` });
  }
  await FollowUp.insertMany(fus);
  for (const l of open) {
    const next = fus.filter((f) => String(f.lead) === String(l._id) && f.status === "pending").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
    if (next) await Lead.updateOne({ _id: l._id }, { $set: { nextFollowUpAt: next.dueAt } });
  }

  // ── WhatsApp conversations from the showcase scenarios
  for (let si = 0; si < SCENARIOS.length; si++) {
    const s = SCENARIOS[si];
    const start = now - (si * 7 + 2) * H - si * 1.3 * D;
    const assignee = team[si % team.length];
    const lead = await Lead.create({
      name: s.customer.name,
      phone: s.customer.phone,
      email: s.steps.map((x) => x.text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]).find(Boolean) ?? "",
      city: s.customer.city,
      source: s.source,
      campaign: s.campaign ?? "",
      status: s.finalStatus,
      destination: s.destination,
      travelDate: s.travelDate,
      travellers: { adults: s.adults, children: s.children },
      budget: s.budget ?? 0,
      requirements: s.steps[0].text,
      language: s.language,
      aiSummary: s.summary,
      assignedTo: assignee,
      lastContactAt: new Date(start + s.steps.length * 3 * 60000),
      isDemo: true,
    });
    await Lead.collection.updateOne({ _id: lead._id }, { $set: { createdAt: new Date(start), updatedAt: new Date(start) } });
    const conv = await Conversation.create({
      phone: s.customer.phone,
      name: s.customer.name,
      lead: lead._id,
      language: s.language,
      aiEnabled: true,
      interest: s.finalStatus,
      unread: si < 2 ? 1 : 0,
      lastMessage: s.steps[s.steps.length - 1].text.slice(0, 200),
      lastMessageAt: new Date(start + (s.steps.length - 1) * 3 * 60000),
      lastInboundAt: new Date(start + (s.steps.length - 2) * 3 * 60000),
      isDemo: true,
    });
    await Lead.updateOne({ _id: lead._id }, { $set: { conversation: conv._id } });
    await Message.insertMany(
      s.steps.map((st, k) => ({
        conversation: conv._id,
        direction: st.from === "customer" ? "in" : "out",
        sender: st.from === "customer" ? "customer" : "ai",
        body: st.text,
        status: st.from === "customer" ? "received" : "read",
        createdAt: new Date(start + k * 3 * 60000 + (st.from === "ai" ? 4000 : 0)),
        meta: st.from === "ai" ? { engine: "claude", language: s.language } : undefined,
      })),
    );
    activities.push(
      { lead: lead._id, type: "created", message: `Lead captured from WhatsApp${s.campaign ? ` (${s.campaign})` : ""}`, createdAt: new Date(start) },
      { lead: lead._id, type: "ai", message: `AI captured destination, travel date and travellers from the WhatsApp chat`, createdAt: new Date(start + 7 * 60000) },
      { lead: lead._id, type: "ai", message: `Status changed from New to ${s.finalStatus === "follow_up" ? "Follow-up Required" : s.finalStatus === "not_interested" ? "Not Interested" : "Interested"} by AI (conversation analysis)`, createdAt: new Date(start + 8 * 60000) },
    );
    if (s.finalStatus !== "not_interested") {
      const due = new Date(s.finalStatus === "follow_up" ? now + 6 * D : now + (si + 1) * 2 * H);
      await FollowUp.create({ title: s.finalStatus === "follow_up" ? `Follow up on ${s.destination} trip (customer asked for time)` : `Call to confirm ${s.destination} booking`, type: s.finalStatus === "follow_up" ? "whatsapp" : "call", dueAt: due, lead: lead._id, assignedTo: assignee, autoCreated: true, notes: `Auto-scheduled by AI. ${s.summary}`, isDemo: true });
      await Lead.updateOne({ _id: lead._id }, { $set: { nextFollowUpAt: due } });
    }
  }

  // ── a few notes
  for (const l of leadDocs.slice(0, 14)) activities.push({ lead: l._id, type: "note", message: pick(NOTES), user: l.assignedTo, createdAt: new Date(l.createdAt!.getTime() + 9 * H) });
  await Activity.insertMany(activities.map((a) => ({ ...a, meta: { demo: true } })));

  // ── notifications for admins
  const admins = await User.find({ role: "admin" }, { _id: 1 }).lean();
  await Notification.insertMany(
    admins.flatMap((a) => [
      { user: a._id, type: "lead", title: `🔥 Booking intent: ${SCENARIOS[1].customer.name}`, body: SCENARIOS[1].summary, link: `/inbox` },
      { user: a._id, type: "lead", title: `New lead: ${SCENARIOS[0].customer.name}`, body: "Meta Ads (FB / IG) · Goa", link: `/leads` },
      { user: a._id, type: "invoice", title: "2 invoices are overdue", body: "Follow up on pending balances", link: `/invoices?status=overdue` },
    ]),
  );
  return { leads: leadDocs.length + SCENARIOS.length, customers: custDocs.length, invoices: invDocs.length, followUps: fus.length + SCENARIOS.length - 1, conversations: SCENARIOS.length };
}

export async function clearDemo() {
  const demoLeads = await Lead.find({ isDemo: true }, { _id: 1 }).lean();
  const demoCustomers = await Customer.find({ isDemo: true }, { _id: 1 }).lean();
  const leadIds = demoLeads.map((l) => l._id);
  const custIds = demoCustomers.map((c) => c._id);
  const convs = await Conversation.find({ isDemo: true }, { _id: 1 }).lean();
  await Promise.all([
    Activity.deleteMany({ $or: [{ lead: { $in: leadIds } }, { customer: { $in: custIds } }, { "meta.demo": true }] }),
    Message.deleteMany({ conversation: { $in: convs.map((c) => c._id) } }),
    FollowUp.deleteMany({ $or: [{ isDemo: true }, { lead: { $in: leadIds } }, { customer: { $in: custIds } }] }),
    Invoice.deleteMany({ $or: [{ isDemo: true }, { customer: { $in: custIds } }] }),
  ]);
  await Promise.all([Conversation.deleteMany({ isDemo: true }), Lead.deleteMany({ isDemo: true }), Customer.deleteMany({ isDemo: true })]);
  const demoUsers = await User.find({ email: new RegExp(`@${DEMO_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`) }, { _id: 1 }).lean();
  if (demoUsers.length) {
    const ids = demoUsers.map((u) => u._id);
    await Lead.updateMany({ assignedTo: { $in: ids } }, { $unset: { assignedTo: 1 } });
    await FollowUp.updateMany({ assignedTo: { $in: ids } }, { $unset: { assignedTo: 1 } });
    await Notification.deleteMany({ user: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
  }
}
