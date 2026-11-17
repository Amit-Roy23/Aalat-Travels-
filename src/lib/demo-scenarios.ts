// Scripted showcase conversations demonstrating the AI WhatsApp automation.
// Used by the AI Demo page (animated playback) and by the demo-data seeder (inbox history).

export type Effect = { kind: "lead" | "lang" | "status" | "field" | "followup" | "handoff" | "assign"; label: string };
export type Step = { from: "customer" | "ai"; text: string; effects?: Effect[] };
export type Scenario = {
  id: string;
  title: string;
  subtitle: string;
  flag: string;
  language: string;
  customer: { name: string; phone: string; city: string };
  source: "meta_ads" | "google_ads" | "whatsapp" | "website";
  campaign?: string;
  destination: string;
  finalStatus: "interested" | "follow_up" | "not_interested";
  travelDate: string;
  adults: number;
  children: number;
  budget?: number;
  summary: string;
  steps: Step[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "goa-hindi",
    title: "Family Goa trip",
    subtitle: "Hindi · Facebook ad → booking intent",
    flag: "🇮🇳",
    language: "hi",
    customer: { name: "राजेश शर्मा", phone: "919876501234", city: "Jaipur" },
    source: "meta_ads",
    campaign: "Goa Winter Offer – FB",
    destination: "Goa",
    finalStatus: "interested",
    travelDate: "22 December",
    adults: 2,
    children: 2,
    summary: "Wants to book Goa Beach Escape for 2 adults + 2 kids from 22 Dec; asked for a call to confirm.",
    steps: [
      { from: "customer", text: "नमस्ते, मैंने आपका गोवा वाला विज्ञापन देखा। दिसंबर में परिवार के साथ जाना है।", effects: [{ kind: "lead", label: "Lead captured from Meta Ads (Click-to-WhatsApp)" }, { kind: "lang", label: "Language detected: Hindi" }, { kind: "assign", label: "Auto-assigned to Priya (round-robin)" }] },
      { from: "ai", text: "नमस्ते राजेश जी! 🙏 मैं Aria, Aalat Travels की ट्रैवल असिस्टेंट हूँ। गोवा के लिए हमारा सबसे लोकप्रिय पैकेज:\n\n🏖️ *Goa Beach Escape* — 4 रातें / 5 दिन\n💰 ₹14,999 प्रति व्यक्ति से शुरू\n✅ 3★ बीच रिसॉर्ट, नाश्ता, एयरपोर्ट ट्रांसफ़र, नॉर्थ और साउथ गोवा साइटसीइंग, सनसेट क्रूज़\n\nकितने लोग जा रहे हैं, और दिसंबर में किस तारीख़ से? 😊", effects: [{ kind: "field", label: "Destination → Goa" }, { kind: "status", label: "Status → Interested" }] },
      { from: "customer", text: "हम 2 बड़े और 2 बच्चे हैं। 22 दिसंबर से जाना है। बच्चों का कितना लगेगा?" , effects: [{ kind: "field", label: "Travellers → 2 adults, 2 children" }, { kind: "field", label: "Travel date → 22 December" }] },
      { from: "ai", text: "बढ़िया! 👨‍👩‍👧‍👦 आपके परिवार के लिए अनुमानित खर्च:\n\n👥 2 बड़े + 2 बच्चे (5–11 वर्ष)\n🗓️ 22 – 26 दिसंबर\n💰 बड़े: ₹14,999 × 2 = ₹29,998\n💰 बच्चे (बिना अलग बेड): ₹7,500 × 2 = ₹15,000\n✨ कुल लगभग *₹44,998*\n\nध्यान दें: क्रिसमस वीक में होटल जल्दी भर जाते हैं। क्या मैं ये तारीख़ें होल्ड करवा दूँ? 🙌" },
      { from: "customer", text: "हाँ, बुक कर दीजिए। पेमेंट कैसे करना है?" },
      { from: "ai", text: "बहुत बढ़िया! 🎉 मैंने आपकी बुकिंग रिक्वेस्ट नोट कर ली है।\n\n✅ बुकिंग कन्फर्म करने के लिए 50% एडवांस (₹22,499) UPI या बैंक ट्रांसफ़र से\n✅ बाकी राशि यात्रा से 7 दिन पहले\n\nहमारी ट्रैवल एक्सपर्ट प्रिया अगले 2 घंटे में आपको कॉल करके होटल ऑप्शन और पेमेंट डिटेल्स भेजेंगी। धन्यवाद! 🙏", effects: [{ kind: "followup", label: "Follow-up created: Call to confirm booking (in 2 hrs)" }, { kind: "handoff", label: "Sales agent notified: 🔥 Booking intent" }] },
    ],
  },
  {
    id: "bali-english",
    title: "Bali honeymoon",
    subtitle: "English · Instagram ad → quote → booking",
    flag: "🇬🇧",
    language: "en",
    customer: { name: "Ananya Iyer", phone: "919820044556", city: "Mumbai" },
    source: "meta_ads",
    campaign: "Honeymoon Specials – Instagram",
    destination: "Bali",
    finalStatus: "interested",
    travelDate: "14 February",
    adults: 2,
    children: 0,
    budget: 130000,
    summary: "Honeymoon couple, Bali 5N/6D from 14 Feb, budget ₹1.3L total, wants private pool villa; ready to book.",
    steps: [
      { from: "customer", text: "Hi! Saw your Bali honeymoon post on Instagram 😍 We're getting married in Feb, can you share details?", effects: [{ kind: "lead", label: "Lead captured from Meta Ads (Instagram)" }, { kind: "lang", label: "Language detected: English" }] },
      { from: "ai", text: "Congratulations to you both! 💍✨ I'm Aria from Aalat Travels. Here's our most-loved honeymoon trip:\n\n🌺 *Bali Honeymoon Special* — 5 Nights / 6 Days\n💰 ₹54,999 per person\n✅ Return flights, 2 nights private pool villa + 3 nights resort, breakfast, candlelight dinner, Ubud & Nusa Penida tours\n\nWhat dates are you looking at, and which city will you fly from? 😊", effects: [{ kind: "field", label: "Destination → Bali" }, { kind: "status", label: "Status → Interested" }] },
      { from: "customer", text: "From Mumbai, around 14th Feb. Our budget is about 1.3 lakh for both. Is the pool villa included?", effects: [{ kind: "field", label: "Travel date → 14 February" }, { kind: "field", label: "Budget → ₹1,30,000" }] },
      { from: "ai", text: "Perfect timing — Valentine's in Bali! 💕\n\n👥 2 adults · 🗓️ 14 – 19 Feb · ✈️ ex-Mumbai\n💰 ₹54,999 × 2 = *₹1,09,998* — well within your budget 🙌\n\nYes, the private pool villa is included for 2 nights, plus a floating breakfast and a candlelight dinner on the beach. With the ₹20k left in your budget, I'd suggest a sunset dinner cruise or upgrading the resort to beachfront.\n\nShall I ask our travel expert to block these dates for you?" },
      { from: "customer", text: "Yes please, let's go ahead! Can my fiancé also get the itinerary on email? rohit.menon@gmail.com", effects: [{ kind: "field", label: "Email captured" }] },
      { from: "ai", text: "Wonderful! 🎉 I've noted your booking request for the *Bali Honeymoon Special*.\n\n📧 The detailed itinerary will be emailed to rohit.menon@gmail.com\n💳 A 50% advance confirms the booking; the balance is due 7 days before travel.\n\nOur travel expert will call you within 2 hours to confirm flights and the villa. Wishing you a beautiful wedding! 💐", effects: [{ kind: "followup", label: "Follow-up created: Call to confirm Bali booking" }, { kind: "handoff", label: "Sales agent notified: 🔥 Booking intent" }] },
    ],
  },
  {
    id: "kashmir-hinglish",
    title: "Kashmir on a budget",
    subtitle: "Hinglish · price objection → follow-up next week",
    flag: "🇮🇳",
    language: "hi-Latn",
    customer: { name: "Vikram Singh", phone: "919811122233", city: "Delhi" },
    source: "google_ads",
    campaign: "Kashmir Tour Packages – Search",
    destination: "Kashmir",
    finalStatus: "follow_up",
    travelDate: "April",
    adults: 4,
    children: 0,
    budget: 18000,
    summary: "Group of 4 friends, Kashmir in April, budget ~₹18k pp; found it costly, will confirm with friends next week.",
    steps: [
      { from: "customer", text: "Hello bhai, Kashmir ka package kitne ka hai? Hum 4 dost hain, April mein jaana hai", effects: [{ kind: "lead", label: "Lead captured from Google Ads" }, { kind: "lang", label: "Language detected: Hinglish" }, { kind: "field", label: "Destination → Kashmir · 4 adults · April" }] },
      { from: "ai", text: "Namaste Vikram ji! 🙏 April Kashmir ke liye best time hai — Tulip Garden bhi khila hota hai 🌷\n\n🏔️ *Kashmir Paradise* — 5 Nights / 6 Days\n💰 ₹21,999 per person\n✅ Houseboat + hotels, breakfast & dinner, private cab, Shikara ride, Gulmarg & Pahalgam\n\n4 logon ke liye total lagbhag *₹87,996*. Aap kis city se travel karenge?", effects: [{ kind: "status", label: "Status → Interested" }] },
      { from: "customer", text: "Thoda mehenga hai yaar. 18k per person tak ho jayega kya?", effects: [{ kind: "field", label: "Budget → ₹18,000 per person" }] },
      { from: "ai", text: "Bilkul samajh sakti hoon 🙂 Aapke budget mein ye option perfect rahega:\n\n✨ *Kashmir Budget Saver* — 4 Nights / 5 Days\n🏨 3★ hotels + 1 night houseboat\n🚗 Sharing cab for Gulmarg & Pahalgam\n💰 Approx. *₹17,499 per person* (4 logon ke group rate par)\n\nKya main dono options ka detailed itinerary bhej doon taaki aap doston se discuss kar sakein?" },
      { from: "customer", text: "Haan bhej do. Doston se baat karke next week batata hoon" },
      { from: "ai", text: "Zaroor! 📄 Dono itineraries isi chat mein thodi der mein mil jayengi.\n\nMain hamare travel expert ko *agle hafte* aapse contact karne ko bol deti hoon. April ki bookings jaldi bhar jaati hain, toh jaldi confirm karenge toh best rates milenge 😊", effects: [{ kind: "status", label: "Status → Follow-up Required" }, { kind: "followup", label: "Follow-up scheduled: next week (WhatsApp)" }] },
    ],
  },
  {
    id: "darjeeling-bengali",
    title: "Puja holidays in the hills",
    subtitle: "Bengali · website enquiry → details captured",
    flag: "🇮🇳",
    language: "bn",
    customer: { name: "সৌরভ বন্দ্যোপাধ্যায়", phone: "919830077889", city: "Kolkata" },
    source: "website",
    destination: "Darjeeling",
    finalStatus: "interested",
    travelDate: "Puja holidays (October)",
    adults: 3,
    children: 1,
    summary: "Family of 3 adults + 1 child, Darjeeling & Gangtok during Puja holidays, ex-Kolkata; wants train + package.",
    steps: [
      { from: "customer", text: "নমস্কার, পুজোর ছুটিতে দার্জিলিং যেতে চাই। প্যাকেজ আছে?", effects: [{ kind: "lead", label: "Lead captured from Website chat" }, { kind: "lang", label: "Language detected: Bengali" }, { kind: "field", label: "Destination → Darjeeling" }] },
      { from: "ai", text: "নমস্কার! 🙏 আমি Aria, Aalat Travels থেকে। পুজোর সময় পাহাড় দারুণ সুন্দর থাকে 🏔️\n\n🍃 *Darjeeling & Gangtok Delight* — 5 রাত / 6 দিন\n💰 মাথাপিছু ₹16,999 থেকে\n✅ হোটেল, ব্রেকফাস্ট ও ডিনার, NJP/বাগডোগরা ট্রান্সফার, প্রাইভেট গাড়ি\n✨ টাইগার হিল সূর্যোদয়, টয় ট্রেন, ছাঙ্গু লেক\n\nকতজন যাবেন আর কোন তারিখে রওনা দিতে চান?", effects: [{ kind: "status", label: "Status → Interested" }] },
      { from: "customer", text: "আমরা 3 জন বড় আর 1টা বাচ্চা। অষ্টমীর পরের দিন কলকাতা থেকে ট্রেনে যাব।", effects: [{ kind: "field", label: "Travellers → 3 adults, 1 child" }, { kind: "field", label: "Travel date → after Ashtami" }] },
      { from: "ai", text: "দারুণ! 👨‍👩‍👦 আপনাদের জন্য আনুমানিক খরচ:\n\n👥 3 জন বড় + 1 জন বাচ্চা\n🗓️ নবমী থেকে 6 দিন\n💰 ₹16,999 × 3 + বাচ্চা ₹8,500 = মোট প্রায় *₹59,497*\n🚆 পদাতিক / দার্জিলিং মেল-এর টিকিটও আমরা করে দিতে পারি।\n\nপুজোর সময় ট্রেন ও হোটেল তাড়াতাড়ি ভরে যায় — আজই আমাদের এক্সপার্ট আপনাকে ফোন করবেন? 🙌" },
      { from: "customer", text: "হ্যাঁ, আজ সন্ধ্যায় ফোন করুন।" },
      { from: "ai", text: "অবশ্যই! 🙋 আমাদের ট্রাভেল এক্সপার্ট আজ সন্ধ্যা 6টার মধ্যে আপনাকে ফোন করবেন। ততক্ষণ কোনো প্রশ্ন থাকলে এখানে জিজ্ঞেস করুন। শুভ পুজো! 🪔", effects: [{ kind: "followup", label: "Follow-up created: Call this evening" }] },
    ],
  },
  {
    id: "kerala-arabic",
    title: "Kerala wellness retreat",
    subtitle: "Arabic · international enquiry → follow-up",
    flag: "🇴🇲",
    language: "ar",
    customer: { name: "أحمد البلوشي", phone: "96891234567", city: "Muscat" },
    source: "meta_ads",
    campaign: "Kerala Ayurveda – GCC",
    destination: "Kerala",
    finalStatus: "interested",
    travelDate: "January",
    adults: 2,
    children: 0,
    summary: "Couple from Oman, Kerala backwaters + Ayurveda in January, needs halal food and Muscat–Kochi flights.",
    steps: [
      { from: "customer", text: "السلام عليكم، أريد رحلة إلى كيرالا مع زوجتي في يناير. هل يوجد علاج أيورفيدا؟", effects: [{ kind: "lead", label: "Lead captured from Meta Ads (GCC campaign)" }, { kind: "lang", label: "Language detected: Arabic" }, { kind: "field", label: "Destination → Kerala · 2 adults · January" }] },
      { from: "ai", text: "وعليكم السلام ورحمة الله! 🌴 أهلاً بك، أنا Aria من Aalat Travels.\n\nكيرالا في يناير رائعة جداً والطقس معتدل ✨\n\n🌴 *Kerala Backwaters & Hills* — 5 ليالٍ / 6 أيام\n💰 يبدأ من ₹18,499 للشخص\n✅ فنادق + ليلة في قارب منزلي خاص، الإفطار، سيارة خاصة، جولات سياحية\n\nونعم، يمكننا إضافة باقة أيورفيدا علاجية (3 جلسات) في منتجع معتمد 🧘\n\nهل تحتاجون طعاماً حلالاً، ومن أي مدينة ستسافرون؟", effects: [{ kind: "status", label: "Status → Interested" }] },
      { from: "customer", text: "نعم طعام حلال من فضلك. سنسافر من مسقط إلى كوتشي." },
      { from: "ai", text: "ممتاز 👍 سنرتب لكما:\n\n🍽️ وجبات حلال في جميع الفنادق والقارب المنزلي\n✈️ رحلات مسقط ⇄ كوتشي (نؤكد السعر حسب التاريخ)\n🧘 3 جلسات أيورفيدا للزوجين\n\n💰 التقدير: ₹18,499 × 2 = *₹36,998* للباقة + الأيورفيدا والطيران حسب التاريخ.\n\nسيتواصل معك خبير السفر لدينا غداً بعرض سعر نهائي. هل يناسبك التواصل عبر واتساب؟", effects: [{ kind: "followup", label: "Follow-up created: Send final quote tomorrow" }] },
      { from: "customer", text: "نعم واتساب مناسب، شكراً جزيلاً" },
      { from: "ai", text: "على الرحب والسعة! 😊 سنرسل لك العرض الكامل هنا غداً. نتمنى لكما رحلة سعيدة إلى كيرالا 🌴🛶" },
    ],
  },
  {
    id: "rajasthan-spanish",
    title: "Royal Rajasthan tour",
    subtitle: "Spanish · foreign tourist → interested",
    flag: "🇪🇸",
    language: "es",
    customer: { name: "María García", phone: "34612345678", city: "Madrid" },
    source: "website",
    destination: "Rajasthan",
    finalStatus: "interested",
    travelDate: "November",
    adults: 2,
    children: 0,
    summary: "Spanish couple, Royal Rajasthan 6N/7D in November, wants Spanish-speaking guide and heritage hotels.",
    steps: [
      { from: "customer", text: "¡Hola! Somos dos personas de España y queremos visitar Rajasthan en noviembre. ¿Tienen guías que hablen español?", effects: [{ kind: "lead", label: "Lead captured from Website" }, { kind: "lang", label: "Language detected: Spanish" }, { kind: "field", label: "Destination → Rajasthan · 2 adults · November" }] },
      { from: "ai", text: "¡Hola María! 👋 Soy Aria, de Aalat Travels. ¡Noviembre es la mejor época para Rajasthan! 🏰\n\n🏰 *Royal Rajasthan* — 6 noches / 7 días\n💰 Desde ₹22,999 por persona (≈ 255 €)\n✅ Hoteles heritage, desayuno, coche privado con chófer, campamento en el desierto con noche cultural\n✨ Jaipur, Udaipur, Jaisalmer\n\n¡Y sí! Podemos organizar guías locales que hablan español en Jaipur y Udaipur 🇪🇸\n\n¿Llegarán por Delhi o por Mumbai?", effects: [{ kind: "status", label: "Status → Interested" }] },
      { from: "customer", text: "Llegamos a Delhi el 10 de noviembre. ¿Cuánto sería en total con el guía?", effects: [{ kind: "field", label: "Travel date → 10 November" }] },
      { from: "ai", text: "¡Perfecto! Aquí tienes tu presupuesto estimado:\n\n👥 2 adultos · 🗓️ 10 – 16 noviembre · 📍 desde Delhi\n💰 Paquete: ₹22,999 × 2 = ₹45,998\n🗣️ Guía en español (3 días): ₹12,000\n✨ Total aprox. *₹57,998* (≈ 640 €)\n\n¿Quieres que nuestro experto prepare el itinerario detallado y te lo envíe por correo? 🙌" },
      { from: "customer", text: "Sí, por favor. Mi correo es maria.garcia@email.es", effects: [{ kind: "field", label: "Email captured" }] },
      { from: "ai", text: "¡Genial! 📧 Te enviaremos el itinerario completo a maria.garcia@email.es en las próximas 24 horas. ¡Gracias por elegir Aalat Travels! 🙏✨", effects: [{ kind: "followup", label: "Follow-up created: Email detailed itinerary" }] },
    ],
  },
  {
    id: "not-interested",
    title: "Polite opt-out",
    subtitle: "English · not interested → closed gracefully",
    flag: "🇮🇳",
    language: "en",
    customer: { name: "Karan Mehta", phone: "919900112233", city: "Pune" },
    source: "meta_ads",
    campaign: "Thailand Summer Sale – FB",
    destination: "Thailand",
    finalStatus: "not_interested",
    travelDate: "",
    adults: 0,
    children: 0,
    summary: "Clicked Thailand ad by mistake / already booked elsewhere. Not interested.",
    steps: [
      { from: "customer", text: "Hi, I clicked your Thailand ad", effects: [{ kind: "lead", label: "Lead captured from Meta Ads" }, { kind: "lang", label: "Language detected: English" }] },
      { from: "ai", text: "Hello Karan! 👋 I'm Aria from Aalat Travels. Thailand is a great choice! 🐘\n\n🐘 *Thailand Fun Tour* — 5 Nights / 6 Days\n💰 ₹39,999 per person incl. return flights, 3★ hotels, Coral Island & Bangkok city tour\n\nWhen are you planning to travel, and how many people? 😊", effects: [{ kind: "field", label: "Destination → Thailand" }] },
      { from: "customer", text: "Actually we already booked with someone else. Not interested, thanks." },
      { from: "ai", text: "No problem at all 🙏 Thank you for letting us know, Karan — have a wonderful trip to Thailand! 🌴\n\nWhenever you plan your next holiday, just message us here. We'd be happy to help! 😊", effects: [{ kind: "status", label: "Status → Not Interested" }, { kind: "followup", label: "Pending auto follow-ups cancelled" }] },
    ],
  },
];
