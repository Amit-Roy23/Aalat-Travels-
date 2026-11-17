// Default business knowledge used by the AI assistant (fully editable in Settings → AI & Knowledge Base).
export const DEFAULT_KNOWLEDGE = {
  enabled: true,
  model: "claude-opus-5-5",
  assistantName: "Aria",
  tone: "Warm, friendly and professional. Short WhatsApp-style messages with a few relevant emojis.",
  about:
    "Aalat Travels is a full-service tour & travel company from India offering domestic and international holiday packages, honeymoon specials, family vacations, group tours, corporate trips, hotel bookings, flights, visas and travel insurance. Every trip is customised by a dedicated travel expert.",
  services:
    "Customised holiday packages (domestic & international)\nHoneymoon packages\nFamily & group tours\nFlight & train ticket booking\nHotel & resort booking\nVisa assistance (Dubai, Thailand, Singapore, Bali, Maldives, Schengen)\nAirport transfers & cab rentals\nTravel insurance",
  policies:
    "Booking is confirmed with a 50% advance; the balance is due 7 days before departure. Payments accepted via UPI, bank transfer, card or cash at the office. Package prices are per person on twin sharing and may vary by dates and availability. Cancellation charges depend on hotel and airline policies.",
  officeHours: "Mon–Sat, 10:00 AM – 7:00 PM IST",
  autoCreateLead: true,
  autoFollowUp: true,
  autoStatus: true,
  packages: [
    { name: "Goa Beach Escape", destination: "Goa", keywords: ["goa", "गोवा", "গোয়া", "গোয়া", "غوا"], duration: "4 Nights / 5 Days", pricePerPerson: 14999, inclusions: "3★ beach resort, breakfast, airport transfers, North & South Goa sightseeing, sunset cruise", highlights: "Baga & Calangute beaches, Fort Aguada, Dudhsagar (seasonal), river cruise", bestTime: "October – March" },
    { name: "Kashmir Paradise", destination: "Kashmir", keywords: ["kashmir", "srinagar", "gulmarg", "pahalgam", "कश्मीर", "কাশ্মীর", "كشمير"], duration: "5 Nights / 6 Days", pricePerPerson: 21999, inclusions: "Houseboat stay + hotels, breakfast & dinner, private cab, Shikara ride", highlights: "Dal Lake shikara, Gulmarg gondola, Pahalgam valleys, Sonamarg", bestTime: "March – October (snow: Dec – Feb)" },
    { name: "Kerala Backwaters & Hills", destination: "Kerala", keywords: ["kerala", "munnar", "alleppey", "alappuzha", "केरल", "কেরালা", "كيرالا"], duration: "5 Nights / 6 Days", pricePerPerson: 18499, inclusions: "Hotels + 1 night private houseboat, breakfast, private cab, sightseeing", highlights: "Munnar tea gardens, Thekkady, Alleppey houseboat, Kochi", bestTime: "September – March" },
    { name: "Manali Snow Adventure", destination: "Manali", keywords: ["manali", "himachal", "shimla", "मनाली", "মানালি", "শিমলা"], duration: "4 Nights / 5 Days", pricePerPerson: 12999, inclusions: "Volvo tickets from Delhi, hotel, breakfast & dinner, local sightseeing", highlights: "Solang Valley, Atal Tunnel, Old Manali, Hadimba temple", bestTime: "October – June" },
    { name: "Darjeeling & Gangtok Delight", destination: "Darjeeling", keywords: ["darjeeling", "gangtok", "sikkim", "दार्जिलिंग", "दार्जिलिंग", "দার্জিলিং", "গ্যাংটক", "সিকিম"], duration: "5 Nights / 6 Days", pricePerPerson: 16999, inclusions: "Hotels, breakfast & dinner, NJP/Bagdogra transfers, private cab", highlights: "Tiger Hill sunrise, toy train, Tsomgo Lake, MG Marg", bestTime: "March – May, October – December" },
    { name: "Dubai Delight", destination: "Dubai", keywords: ["dubai", "uae", "abu dhabi", "दुबई", "দুবাই", "دبي", "dubái"], duration: "4 Nights / 5 Days", pricePerPerson: 49999, inclusions: "Return flights, 4★ hotel, breakfast, desert safari with BBQ dinner, Dubai city tour, Marina dhow cruise, visa", highlights: "Burj Khalifa, Desert safari, Dubai Mall, Miracle Garden", bestTime: "November – March" },
    { name: "Bali Honeymoon Special", destination: "Bali", keywords: ["bali", "indonesia", "बाली", "বালি", "بالي"], duration: "5 Nights / 6 Days", pricePerPerson: 54999, inclusions: "Return flights, private pool villa (2N) + resort (3N), breakfast, candlelight dinner, Ubud & Nusa Penida tours", highlights: "Private pool villa, Ubud swing, Kelingking beach, Tanah Lot sunset", bestTime: "April – October" },
    { name: "Maldives Overwater Bliss", destination: "Maldives", keywords: ["maldives", "मालदीव", "মালদ্বীপ", "المالديف", "maldivas"], duration: "3 Nights / 4 Days", pricePerPerson: 79999, inclusions: "Return flights, water villa, all meals, speedboat transfers", highlights: "Overwater villa, snorkelling, sandbank picnic", bestTime: "November – April" },
    { name: "Thailand Fun Tour", destination: "Thailand", keywords: ["thailand", "bangkok", "pattaya", "phuket", "थाईलैंड", "থাইল্যান্ড", "تايلاند", "tailandia"], duration: "5 Nights / 6 Days", pricePerPerson: 39999, inclusions: "Return flights, 3★ hotels, breakfast, Coral Island tour, Bangkok city tour, transfers", highlights: "Pattaya Coral Island, Bangkok temples, Safari World", bestTime: "November – April" },
    { name: "Royal Rajasthan", destination: "Rajasthan", keywords: ["rajasthan", "jaipur", "udaipur", "jaisalmer", "जयपुर", "राजस्थान", "রাজস্থান"], duration: "6 Nights / 7 Days", pricePerPerson: 22999, inclusions: "Heritage hotels, breakfast, private cab, desert camp with cultural night", highlights: "Amber Fort, Lake Pichola, Sam sand dunes, Jaisalmer fort", bestTime: "October – March" },
  ],
  faqs: [
    { question: "Do prices include flights?", answer: "Domestic packages are land-only by default (flights can be added at live fares). International packages include return economy flights from Delhi/Mumbai/Kolkata." },
    { question: "How do I confirm a booking?", answer: "Pay a 50% advance via UPI / bank transfer and we send the confirmation voucher within 24 hours. The balance is due 7 days before travel." },
    { question: "Can the itinerary be customised?", answer: "Yes — every package can be customised: hotel category, number of nights, sightseeing and meals." },
    { question: "Do you help with visas?", answer: "Yes, we provide complete visa assistance for Dubai, Thailand, Singapore, Bali, Maldives (on arrival) and Schengen countries." },
    { question: "Is there an EMI option?", answer: "Yes, no-cost EMI is available on select credit cards for bookings above ₹30,000." },
  ],
};
