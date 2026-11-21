// Text printed on Aalat Travels' invoice (taken from the client's paper invoice). Editable in Settings → Invoices.
export const INVOICE_DEFAULTS = {
  cancellationPolicy: [
    "60 Days - 50% refund of the land package.",
    "50 Days - 40% refund of the land package.",
    "40 Days - 30% refund of the land package.",
    "30 Days - 20% refund of the land package.",
    "25 Days or less - NO REFUND.",
  ].join("\n"),
  childPolicy: [
    "For Domestic Tour: 0 to 3 Years - Free",
    "3 to 7 Years - 70% of package",
    "7 Years & Above - Full package",
    "For International Tour: 2 Years & Above - Full package",
  ].join("\n"),
  paymentTerms: [
    "Advance Token Money 30%; while booking.",
    "Interim Payment 50%; before 60 days of departure.",
    "Final Payment 20%; 7 days before the day of departure.",
  ].join("\n"),
  refundNote:
    "Please note that all payments for land packages are Non-Refundable. In the event of a cancellation, the amount paid will be issued as a travel credit, which may be applied toward any future group tour or customized itinerary. Direct cash refunds are not available.",
  footerNote: "Your journey begins here. Thank you for choosing us to guide the way.",
};

/** Logos printed in a strip at the bottom of the bill (editable in Settings → Invoices). */
export const DEFAULT_PARTNER_LOGOS = [
  { name: "J&K Tourism", src: "/brand/partners/jk-tourism.png" },
  { name: "Rajasthan Tourism", src: "/brand/partners/rajasthan-tourism.png" },
  { name: "Assam Tourism", src: "/brand/partners/assam-tourism.png" },
  { name: "West Bengal Tourism", src: "/brand/partners/bengal-tourism.png" },
  { name: "Gujarat Tourism", src: "/brand/partners/gujarat-tourism.png" },
];

export const FOOD_PLANS = ["EP (Room only)", "CP (Breakfast)", "MAP (Breakfast + Dinner)", "AP (All meals)"];
export const PROPERTY_TYPES = ["Hotel", "Resort", "Homestay", "Houseboat", "Cottage", "Camp / Tent", "Villa", "Hotel + Houseboat"];
export const VEHICLE_TYPES = ["Sedan (Dzire / Etios)", "SUV (Innova / Ertiga)", "Innova Crysta", "Tempo Traveller", "Mini Bus", "Bus", "Not included"];
