// Built-in rule-based multilingual travel assistant.
// Used when no ANTHROPIC_API_KEY is configured, so the WhatsApp automation can be demoed end-to-end.
// It understands English, Hindi, Hinglish, Bengali, Arabic, Spanish and French, keeps multi-turn
// context (destination, dates, travellers, budget) and classifies customer interest.

import { detectLanguage, hasAny, normalizeDigits, tokenize } from "./lang";
import type { AiContext, AiResult, KbPackage } from "./types";

type L = "en" | "hi" | "hi-Latn" | "bn" | "ar" | "es" | "fr";

type Labels = { duration: string; from: string; perPerson: string; includes: string; highlights: string; bestTime: string; adults: string; children: string; dateTBD: string; faqIntro: string };
type Tpl = {
  labels: Labels;
  join: string;
  missing: { dates: string; travellers: string };
  when: { d1: string; d7: string; d30: string; dx: string };
  greet: (name: string, a: string, c: string, list: string) => string;
  askMissing: (items: string) => string;
  quote: (name: string, trav: string, date: string, pp: string, total: string) => string;
  booking: (pkg: string) => string;
  notInterested: (c: string) => string;
  later: (when: string) => string;
  objection: () => string;
  human: (hours: string) => string;
  thanks: () => string;
  fallback: () => string;
  priceOverview: (min: string, list: string) => string;
  packagesList: (list: string) => string;
  budgetSuggest: (budget: string, list: string) => string;
};

const T: Record<L, Tpl> = {
  en: {
    labels: { duration: "Duration", from: "From", perPerson: "per person", includes: "Includes", highlights: "Highlights", bestTime: "Best time", adults: "adults", children: "children", dateTBD: "Dates to be decided", faqIntro: "" },
    join: " and ",
    missing: { dates: "your travel dates", travellers: "how many people are travelling (adults & children)" },
    when: { d1: "tomorrow", d7: "next week", d30: "next month", dx: "in a couple of days" },
    greet: (n, a, c, list) => `Hello${n ? ` ${n}` : ""}! 👋 I'm ${a}, the travel assistant at ${c}.\n\nWhere are you dreaming of going? Here are some of our popular trips:\n${list}\n\nJust tell me the destination, travel dates and number of travellers ✈️`,
    askMissing: (i) => `To share the best price, could you tell me ${i}? 😊`,
    quote: (n, t, d, pp, tot) => `Here's your estimate for *${n}*:\n👥 ${t}\n🗓️ ${d}\n💰 ₹${pp} per person → total approx. *₹${tot}* (twin sharing)\n\nWould you like our travel expert to prepare a customised itinerary and hold these dates for you? 🙌`,
    booking: (p) => `Wonderful! 🎉 I've noted your booking request${p ? ` for *${p}*` : ""}. Our travel expert will call you shortly to confirm all the details.\n\nA 50% advance (UPI / bank transfer) confirms the booking and the balance is due 7 days before travel. 🙏`,
    notInterested: (c) => `No problem at all 🙏 Thank you for considering ${c}. Whenever you plan your next trip, just message us here — we'll be happy to help! 😊`,
    later: (w) => `Sure, take your time! 😊 I'll ask our travel expert to check in with you ${w}. Meanwhile, feel free to ask me anything about the trip.`,
    objection: () => `I understand 🙂 We can definitely work around your budget — for example a 3★ hotel, fewer nights or flexible dates. What budget per person do you have in mind? I'll suggest the best options.`,
    human: (h) => `Of course! 🙋 I've informed our travel expert — they will call you shortly (${h}).`,
    thanks: () => `You're most welcome! 😊 Is there anything else I can help you with?`,
    fallback: () => `I'd love to help you plan this! 😊 Could you share the destination, your travel dates and the number of travellers?`,
    priceOverview: (m, list) => `Our packages start from just ₹${m} per person 🙂\n\n${list}\n\nWhich one interests you?`,
    packagesList: (list) => `Here are our most popular packages ✈️\n\n${list}\n\nWhich destination would you like details for?`,
    budgetSuggest: (b, list) => `Great — with a budget of about ₹${b} per person, these trips fit well:\n${list}\n\nShall I share the details of any of them?`,
  },
  hi: {
    labels: { duration: "अवधि", from: "शुरुआती कीमत", perPerson: "प्रति व्यक्ति", includes: "शामिल", highlights: "ख़ास", bestTime: "सबसे अच्छा समय", adults: "बड़े", children: "बच्चे", dateTBD: "तारीख तय होनी है", faqIntro: "जानकारी:" },
    join: " और ",
    missing: { dates: "यात्रा की तारीख", travellers: "कितने लोग जा रहे हैं (बड़े और बच्चे)" },
    when: { d1: "कल", d7: "अगले हफ़्ते", d30: "अगले महीने", dx: "कुछ दिनों में" },
    greet: (n, a, c, list) => `नमस्ते${n ? ` ${n} जी` : ""}! 🙏 मैं ${a}, ${c} की ट्रैवल असिस्टेंट हूँ।\n\nआप कहाँ घूमने जाना चाहते हैं? हमारे कुछ लोकप्रिय पैकेज:\n${list}\n\nबस अपनी डेस्टिनेशन, यात्रा की तारीख और कितने लोग जा रहे हैं, बता दीजिए ✈️`,
    askMissing: (i) => `सबसे अच्छी कीमत बताने के लिए, कृपया ${i} बताइए 😊`,
    quote: (n, t, d, pp, tot) => `*${n}* के लिए आपका अनुमानित खर्च:\n👥 ${t}\n🗓️ ${d}\n💰 ₹${pp} प्रति व्यक्ति → कुल लगभग *₹${tot}* (ट्विन शेयरिंग)\n\nक्या मैं हमारे ट्रैवल एक्सपर्ट से आपके लिए कस्टमाइज़्ड प्लान बनवाकर ये तारीखें होल्ड करवा दूँ? 🙌`,
    booking: (p) => `बहुत बढ़िया! 🎉 मैंने आपकी बुकिंग रिक्वेस्ट${p ? ` (*${p}*)` : ""} नोट कर ली है। हमारे ट्रैवल एक्सपर्ट जल्द ही आपको कॉल करके सारी डिटेल्स कन्फर्म करेंगे।\n\nबुकिंग कन्फर्म करने के लिए 50% एडवांस (UPI / बैंक ट्रांसफर) और बाकी राशि यात्रा से 7 दिन पहले देनी होती है। 🙏`,
    notInterested: (c) => `कोई बात नहीं 🙏 ${c} को याद करने के लिए धन्यवाद। जब भी अगली ट्रिप प्लान करें, यहीं मैसेज कर दीजिए — हमें मदद करके ख़ुशी होगी! 😊`,
    later: (w) => `ज़रूर, आराम से सोचिए! 😊 मैं हमारे ट्रैवल एक्सपर्ट को ${w} आपसे संपर्क करने के लिए कह देती हूँ। तब तक कोई भी सवाल हो तो पूछिए।`,
    objection: () => `मैं समझ सकती हूँ 🙂 हम आपके बजट के हिसाब से पैकेज बना सकते हैं — जैसे 3★ होटल, कम रातें या फ्लेक्सिबल तारीखें। आपका प्रति व्यक्ति बजट लगभग कितना है? मैं सबसे अच्छे विकल्प सुझाऊँगी।`,
    human: (h) => `ज़रूर! 🙋 मैंने हमारे ट्रैवल एक्सपर्ट को बता दिया है — वे जल्द ही आपको कॉल करेंगे (${h})।`,
    thanks: () => `आपका स्वागत है! 😊 क्या मैं आपकी और कोई मदद कर सकती हूँ?`,
    fallback: () => `मैं आपकी ट्रिप प्लान करने में ज़रूर मदद करूँगी! 😊 कृपया डेस्टिनेशन, यात्रा की तारीख और कितने लोग जा रहे हैं, बताइए।`,
    priceOverview: (m, list) => `हमारे पैकेज सिर्फ़ ₹${m} प्रति व्यक्ति से शुरू होते हैं 🙂\n\n${list}\n\nआपको कौन सा पसंद आया?`,
    packagesList: (list) => `हमारे सबसे लोकप्रिय पैकेज ✈️\n\n${list}\n\nकिस डेस्टिनेशन की डिटेल्स भेजूँ?`,
    budgetSuggest: (b, list) => `बढ़िया — लगभग ₹${b} प्रति व्यक्ति के बजट में ये ट्रिप्स बेहतरीन रहेंगी:\n${list}\n\nकिसी की डिटेल्स भेजूँ?`,
  },
  "hi-Latn": {
    labels: { duration: "Duration", from: "Starting", perPerson: "per person", includes: "Includes", highlights: "Highlights", bestTime: "Best time", adults: "adults", children: "bachche", dateTBD: "Dates abhi fix nahi", faqIntro: "Jaankari:" },
    join: " aur ",
    missing: { dates: "travel dates", travellers: "kitne log ja rahe hain (adults & bachche)" },
    when: { d1: "kal", d7: "agle hafte", d30: "agle mahine", dx: "kuch din mein" },
    greet: (n, a, c, list) => `Namaste${n ? ` ${n} ji` : ""}! 🙏 Main ${a} hoon, ${c} ki travel assistant.\n\nAap kahan ghumne jaana chahte hain? Hamare kuch popular packages:\n${list}\n\nBas destination, travel dates aur kitne log ja rahe hain — bata dijiye ✈️`,
    askMissing: (i) => `Best price batane ke liye please ${i} bata dijiye 😊`,
    quote: (n, t, d, pp, tot) => `*${n}* ke liye aapka estimate:\n👥 ${t}\n🗓️ ${d}\n💰 ₹${pp} per person → total lagbhag *₹${tot}* (twin sharing)\n\nKya main hamare travel expert se aapke liye customised plan banwa kar ye dates hold karwa doon? 🙌`,
    booking: (p) => `Bahut badhiya! 🎉 Maine aapki booking request${p ? ` (*${p}*)` : ""} note kar li hai. Hamare travel expert jaldi hi aapko call karke saari details confirm karenge.\n\nBooking confirm karne ke liye 50% advance (UPI / bank transfer) aur baaki amount travel se 7 din pehle dena hota hai. 🙏`,
    notInterested: (c) => `Koi baat nahi 🙏 ${c} ko consider karne ke liye shukriya. Jab bhi agli trip plan karein, yahin message kar dijiye — hum help ke liye ready hain! 😊`,
    later: (w) => `Bilkul, aaram se sochiye! 😊 Main hamare travel expert ko ${w} aapse contact karne ko bol deti hoon. Tab tak koi bhi sawaal ho toh poochiye.`,
    objection: () => `Main samajh sakti hoon 🙂 Hum aapke budget ke hisaab se package bana sakte hain — jaise 3★ hotel, kam nights ya flexible dates. Aapka per person budget lagbhag kitna hai? Main best options suggest karungi.`,
    human: (h) => `Zaroor! 🙋 Maine hamare travel expert ko inform kar diya hai — woh jaldi hi aapko call karenge (${h}).`,
    thanks: () => `Aapka swagat hai! 😊 Aur kuch help chahiye toh batayiye.`,
    fallback: () => `Main aapki trip plan karne mein zaroor help karungi! 😊 Please destination, travel dates aur kitne log ja rahe hain — bata dijiye.`,
    priceOverview: (m, list) => `Hamare packages sirf ₹${m} per person se shuru hote hain 🙂\n\n${list}\n\nAapko kaunsa pasand aaya?`,
    packagesList: (list) => `Hamare sabse popular packages ✈️\n\n${list}\n\nKis destination ki details bhejun?`,
    budgetSuggest: (b, list) => `Badhiya — lagbhag ₹${b} per person ke budget mein ye trips perfect rahengi:\n${list}\n\nKisi ki details bhejun?`,
  },
  bn: {
    labels: { duration: "সময়কাল", from: "শুরু", perPerson: "মাথাপিছু", includes: "অন্তর্ভুক্ত", highlights: "আকর্ষণ", bestTime: "সেরা সময়", adults: "বড়", children: "বাচ্চা", dateTBD: "তারিখ এখনও ঠিক হয়নি", faqIntro: "তথ্য:" },
    join: " এবং ",
    missing: { dates: "ভ্রমণের তারিখ", travellers: "কতজন যাবেন (বড় ও বাচ্চা)" },
    when: { d1: "আগামীকাল", d7: "পরের সপ্তাহে", d30: "পরের মাসে", dx: "কয়েক দিনের মধ্যে" },
    greet: (n, a, c, list) => `নমস্কার${n ? ` ${n}` : ""}! 🙏 আমি ${a}, ${c}-এর ট্রাভেল অ্যাসিস্ট্যান্ট।\n\nআপনি কোথায় বেড়াতে যেতে চান? আমাদের কিছু জনপ্রিয় প্যাকেজ:\n${list}\n\nশুধু গন্তব্য, ভ্রমণের তারিখ আর কতজন যাবেন জানিয়ে দিন ✈️`,
    askMissing: (i) => `সেরা দাম জানাতে, অনুগ্রহ করে ${i} জানান 😊`,
    quote: (n, t, d, pp, tot) => `*${n}*-এর জন্য আপনার আনুমানিক খরচ:\n👥 ${t}\n🗓️ ${d}\n💰 মাথাপিছু ₹${pp} → মোট প্রায় *₹${tot}* (টুইন শেয়ারিং)\n\nআমাদের ট্রাভেল এক্সপার্টকে দিয়ে আপনার জন্য কাস্টমাইজড প্ল্যান বানিয়ে তারিখগুলো হোল্ড করে দেব? 🙌`,
    booking: (p) => `দারুণ! 🎉 আপনার বুকিং অনুরোধ${p ? ` (*${p}*)` : ""} নোট করে নিয়েছি। আমাদের ট্রাভেল এক্সপার্ট শীঘ্রই আপনাকে ফোন করে সব বিস্তারিত কনফার্ম করবেন।\n\nবুকিং কনফার্ম করতে 50% অগ্রিম (UPI / ব্যাংক ট্রান্সফার) এবং বাকি টাকা যাত্রার 7 দিন আগে দিতে হয়। 🙏`,
    notInterested: (c) => `কোনো সমস্যা নেই 🙏 ${c}-কে বিবেচনা করার জন্য ধন্যবাদ। যখনই পরের ট্রিপ প্ল্যান করবেন, এখানে মেসেজ করবেন — সাহায্য করতে পেরে খুশি হব! 😊`,
    later: (w) => `অবশ্যই, সময় নিন! 😊 আমি আমাদের ট্রাভেল এক্সপার্টকে ${w} আপনার সাথে যোগাযোগ করতে বলে দিচ্ছি। এর মধ্যে কোনো প্রশ্ন থাকলে জিজ্ঞেস করুন।`,
    objection: () => `বুঝতে পারছি 🙂 আপনার বাজেট অনুযায়ী প্যাকেজ সাজিয়ে দিতে পারি — যেমন 3★ হোটেল, কম রাত বা ফ্লেক্সিবল তারিখ। মাথাপিছু আপনার বাজেট কত? আমি সেরা বিকল্পগুলো জানাব।`,
    human: (h) => `অবশ্যই! 🙋 আমাদের ট্রাভেল এক্সপার্টকে জানিয়ে দিয়েছি — উনি শীঘ্রই আপনাকে ফোন করবেন (${h})।`,
    thanks: () => `আপনাকেও ধন্যবাদ! 😊 আর কিছু সাহায্য লাগলে জানাবেন।`,
    fallback: () => `আপনার ট্রিপ প্ল্যান করতে অবশ্যই সাহায্য করব! 😊 অনুগ্রহ করে গন্তব্য, ভ্রমণের তারিখ আর কতজন যাবেন জানান।`,
    priceOverview: (m, list) => `আমাদের প্যাকেজ শুরু মাত্র মাথাপিছু ₹${m} থেকে 🙂\n\n${list}\n\nকোনটা আপনার পছন্দ?`,
    packagesList: (list) => `আমাদের সবচেয়ে জনপ্রিয় প্যাকেজ ✈️\n\n${list}\n\nকোন গন্তব্যের বিস্তারিত পাঠাব?`,
    budgetSuggest: (b, list) => `দারুণ — মাথাপিছু প্রায় ₹${b} বাজেটে এই ট্রিপগুলো দারুণ হবে:\n${list}\n\nকোনটার বিস্তারিত পাঠাব?`,
  },
  ar: {
    labels: { duration: "المدة", from: "يبدأ من", perPerson: "للشخص", includes: "يشمل", highlights: "أبرز المعالم", bestTime: "أفضل وقت", adults: "بالغين", children: "أطفال", dateTBD: "التاريخ غير محدد بعد", faqIntro: "المعلومات:" },
    join: " و",
    missing: { dates: "تواريخ السفر", travellers: "عدد المسافرين (بالغين وأطفال)" },
    when: { d1: "غداً", d7: "الأسبوع القادم", d30: "الشهر القادم", dx: "خلال أيام قليلة" },
    greet: (n, a, c, list) => `مرحباً${n ? ` ${n}` : ""}! 👋 أنا ${a}، مساعدة السفر في ${c}.\n\nإلى أين تحلم بالسفر؟ إليك بعض رحلاتنا الأكثر طلباً:\n${list}\n\nفقط أخبرني بالوجهة وتاريخ السفر وعدد المسافرين ✈️`,
    askMissing: (i) => `لأقدم لك أفضل سعر، هل يمكنك إخباري بـ${i}؟ 😊`,
    quote: (n, t, d, pp, tot) => `هذا تقدير التكلفة لباقة *${n}*:\n👥 ${t}\n🗓️ ${d}\n💰 ₹${pp} للشخص ← الإجمالي تقريباً *₹${tot}* (غرفة مزدوجة)\n\nهل تريد أن يُعدّ لك خبير السفر لدينا برنامجاً مخصصاً ويحجز هذه التواريخ؟ 🙌`,
    booking: (p) => `رائع! 🎉 لقد سجّلت طلب الحجز${p ? ` (*${p}*)` : ""}. سيتصل بك خبير السفر لدينا قريباً لتأكيد التفاصيل.\n\nلتأكيد الحجز يلزم دفع 50% مقدماً (تحويل بنكي / UPI) والباقي قبل السفر بـ7 أيام. 🙏`,
    notInterested: (c) => `لا مشكلة على الإطلاق 🙏 شكراً لاهتمامك بـ${c}. متى ما خططت لرحلتك القادمة، راسلنا هنا — يسعدنا مساعدتك! 😊`,
    later: (w) => `بالتأكيد، خذ وقتك! 😊 سأطلب من خبير السفر لدينا التواصل معك ${w}. وفي هذه الأثناء يمكنك سؤالي عن أي شيء.`,
    objection: () => `أتفهم ذلك 🙂 يمكننا تعديل الباقة لتناسب ميزانيتك — مثل فندق 3 نجوم أو ليالٍ أقل أو تواريخ مرنة. ما هي ميزانيتك التقريبية للشخص؟ سأقترح عليك أفضل الخيارات.`,
    human: (h) => `بالتأكيد! 🙋 أبلغت خبير السفر لدينا — سيتصل بك قريباً (${h}).`,
    thanks: () => `على الرحب والسعة! 😊 هل هناك أي شيء آخر يمكنني مساعدتك فيه؟`,
    fallback: () => `يسعدني مساعدتك في التخطيط لرحلتك! 😊 هل يمكنك إخباري بالوجهة وتواريخ السفر وعدد المسافرين؟`,
    priceOverview: (m, list) => `تبدأ باقاتنا من ₹${m} فقط للشخص 🙂\n\n${list}\n\nأيها يثير اهتمامك؟`,
    packagesList: (list) => `إليك باقاتنا الأكثر طلباً ✈️\n\n${list}\n\nأي وجهة تريد تفاصيلها؟`,
    budgetSuggest: (b, list) => `رائع — بميزانية حوالي ₹${b} للشخص، هذه الرحلات مناسبة جداً:\n${list}\n\nهل أرسل لك تفاصيل إحداها؟`,
  },
  es: {
    labels: { duration: "Duración", from: "Desde", perPerson: "por persona", includes: "Incluye", highlights: "Lo mejor", bestTime: "Mejor época", adults: "adultos", children: "niños", dateTBD: "Fechas por definir", faqIntro: "Información:" },
    join: " y ",
    missing: { dates: "las fechas del viaje", travellers: "cuántas personas viajan (adultos y niños)" },
    when: { d1: "mañana", d7: "la próxima semana", d30: "el próximo mes", dx: "en unos días" },
    greet: (n, a, c, list) => `¡Hola${n ? ` ${n}` : ""}! 👋 Soy ${a}, la asistente de viajes de ${c}.\n\n¿A dónde te gustaría viajar? Estos son algunos de nuestros viajes más populares:\n${list}\n\nSolo dime el destino, las fechas y cuántas personas viajan ✈️`,
    askMissing: (i) => `Para darte el mejor precio, ¿podrías decirme ${i}? 😊`,
    quote: (n, t, d, pp, tot) => `Este es tu presupuesto estimado para *${n}*:\n👥 ${t}\n🗓️ ${d}\n💰 ₹${pp} por persona → total aprox. *₹${tot}* (habitación doble)\n\n¿Quieres que nuestro experto prepare un itinerario personalizado y reserve estas fechas? 🙌`,
    booking: (p) => `¡Maravilloso! 🎉 He registrado tu solicitud de reserva${p ? ` (*${p}*)` : ""}. Nuestro experto en viajes te llamará pronto para confirmar los detalles.\n\nPara confirmar se requiere un anticipo del 50% (transferencia / UPI) y el resto 7 días antes del viaje. 🙏`,
    notInterested: (c) => `¡Ningún problema! 🙏 Gracias por considerar ${c}. Cuando planees tu próximo viaje, escríbenos aquí — estaremos encantados de ayudarte. 😊`,
    later: (w) => `¡Claro, tómate tu tiempo! 😊 Le pediré a nuestro experto que te contacte ${w}. Mientras tanto, pregúntame lo que quieras.`,
    objection: () => `Lo entiendo 🙂 Podemos ajustar el paquete a tu presupuesto — hotel de 3★, menos noches o fechas flexibles. ¿Qué presupuesto por persona tienes en mente? Te sugeriré las mejores opciones.`,
    human: (h) => `¡Por supuesto! 🙋 Ya informé a nuestro experto en viajes — te llamará pronto (${h}).`,
    thanks: () => `¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?`,
    fallback: () => `¡Me encantaría ayudarte a planear tu viaje! 😊 ¿Podrías decirme el destino, las fechas y cuántas personas viajan?`,
    priceOverview: (m, list) => `Nuestros paquetes empiezan desde solo ₹${m} por persona 🙂\n\n${list}\n\n¿Cuál te interesa?`,
    packagesList: (list) => `Estos son nuestros paquetes más populares ✈️\n\n${list}\n\n¿De qué destino quieres detalles?`,
    budgetSuggest: (b, list) => `Genial — con un presupuesto de unos ₹${b} por persona, estos viajes encajan muy bien:\n${list}\n\n¿Te envío detalles de alguno?`,
  },
  fr: {
    labels: { duration: "Durée", from: "À partir de", perPerson: "par personne", includes: "Inclus", highlights: "Points forts", bestTime: "Meilleure période", adults: "adultes", children: "enfants", dateTBD: "Dates à définir", faqIntro: "Informations :" },
    join: " et ",
    missing: { dates: "vos dates de voyage", travellers: "le nombre de voyageurs (adultes et enfants)" },
    when: { d1: "demain", d7: "la semaine prochaine", d30: "le mois prochain", dx: "dans quelques jours" },
    greet: (n, a, c, list) => `Bonjour${n ? ` ${n}` : ""} ! 👋 Je suis ${a}, l'assistante voyage de ${c}.\n\nOù rêvez-vous de partir ? Voici quelques-uns de nos voyages les plus populaires :\n${list}\n\nIndiquez-moi simplement la destination, les dates et le nombre de voyageurs ✈️`,
    askMissing: (i) => `Pour vous proposer le meilleur prix, pourriez-vous m'indiquer ${i} ? 😊`,
    quote: (n, t, d, pp, tot) => `Voici votre estimation pour *${n}* :\n👥 ${t}\n🗓️ ${d}\n💰 ₹${pp} par personne → total env. *₹${tot}* (chambre double)\n\nSouhaitez-vous que notre expert prépare un itinéraire personnalisé et bloque ces dates ? 🙌`,
    booking: (p) => `Merveilleux ! 🎉 J'ai bien noté votre demande de réservation${p ? ` (*${p}*)` : ""}. Notre expert voyage vous appellera très bientôt pour confirmer les détails.\n\nUn acompte de 50 % (virement / UPI) confirme la réservation, le solde est dû 7 jours avant le départ. 🙏`,
    notInterested: (c) => `Aucun souci 🙏 Merci d'avoir pensé à ${c}. Lorsque vous préparerez votre prochain voyage, écrivez-nous ici — nous serons ravis de vous aider ! 😊`,
    later: (w) => `Bien sûr, prenez votre temps ! 😊 Je demande à notre expert de vous recontacter ${w}. En attendant, n'hésitez pas à me poser vos questions.`,
    objection: () => `Je comprends 🙂 Nous pouvons adapter le forfait à votre budget — hôtel 3★, moins de nuits ou dates flexibles. Quel budget par personne envisagez-vous ? Je vous proposerai les meilleures options.`,
    human: (h) => `Bien sûr ! 🙋 J'ai prévenu notre expert voyage — il vous appellera très bientôt (${h}).`,
    thanks: () => `Avec plaisir ! 😊 Puis-je vous aider pour autre chose ?`,
    fallback: () => `Je serais ravie de vous aider à préparer votre voyage ! 😊 Pourriez-vous m'indiquer la destination, vos dates et le nombre de voyageurs ?`,
    priceOverview: (m, list) => `Nos forfaits commencent à seulement ₹${m} par personne 🙂\n\n${list}\n\nLequel vous intéresse ?`,
    packagesList: (list) => `Voici nos forfaits les plus populaires ✈️\n\n${list}\n\nPour quelle destination souhaitez-vous les détails ?`,
    budgetSuggest: (b, list) => `Parfait — avec un budget d'environ ₹${b} par personne, ces voyages conviennent très bien :\n${list}\n\nJe vous envoie les détails de l'un d'eux ?`,
  },
};

/* ───────────── keyword banks ───────────── */
const K = {
  notInterested: ["not interested", "no thanks", "no thank you", "don't want", "dont want", "do not want", "not looking", "already booked", "booked elsewhere", "booked with someone", "stop messaging", "unsubscribe", "nahi chahiye", "nhi chahiye", "interest nahi", "interested nahi", "mat bhejo", "nahi jana", "नहीं चाहिए", "रुचि नहीं", "इंटरेस्ट नहीं", "नहीं जाना", "দরকার নেই", "আগ্রহী নই", "আগ্রহ নেই", "লাগবে না", "no me interesa", "no gracias", "no estoy interesado", "no estoy interesada", "pas intéressé", "pas intéressée", "pas interessé", "non merci", "غير مهتم", "مش مهتم", "لست مهتما", "لا شكرا", "لا شكراً", "لا أريد"],
  human: ["agent", "human", "real person", "talk to someone", "speak to someone", "speak with", "talk to a person", "call me", "call back", "callback", "give me a call", "baat karni", "baat karwa", "baat karao", "call karo", "call kar do", "call kijiye", "call karein", "फोन करें", "फ़ोन करें", "कॉल करें", "कॉल कीजिए", "बात करनी", "बात करवाइए", "কল করুন", "ফোন করুন", "কথা বলতে চাই", "llámame", "llamame", "hablar con una persona", "hablar con alguien", "agente", "appelez-moi", "appelez moi", "parler à quelqu'un", "conseiller", "اتصل بي", "اتصلوا بي", "أريد التحدث", "موظف"],
  later: ["later", "not now", "will think", "let me think", "think about it", "discuss with", "will let you know", "let you know", "get back to you", "will confirm later", "baad me", "baad mein", "bad me", "soch ke", "sochkar", "soch kar", "sochenge", "bata dunga", "bata denge", "bataunga", "batata hu", "batata hoon", "बाद में", "सोचकर", "सोच के", "सोचते हैं", "बताऊंगा", "बताऊँगा", "बताएंगे", "পরে জানাব", "ভেবে দেখি", "ভেবে জানাব", "পরে কথা বলব", "পরে দেখব", "পরে যোগাযোগ", "más tarde", "lo pensaré", "lo pienso", "te aviso", "plus tard", "je vais réfléchir", "réfléchir", "je vous recontacte", "لاحقا", "لاحقاً", "بعدين", "سأفكر", "سأخبرك"],
  objection: ["too expensive", "very expensive", "expensive", "costly", "too much", "over budget", "out of budget", "mehenga", "mehnga", "bahut zyada", "महंगा", "महँगा", "बहुत ज़्यादा", "দাম বেশি", "অনেক দাম", "খুব দামি", "caro", "muy caro", "trop cher", "cher", "غالي", "مكلف"],
  book: ["book", "booking", "confirm", "proceed", "finalize", "finalise", "lock it", "reserve", "go ahead", "let's do it", "lets do it", "let's go ahead", "pakka", "final kar", "book kar", "book karna", "बुक", "कन्फर्म", "पक्का", "বুক", "কনফার্ম", "reservar", "confirmar", "réserver", "confirmer", "احجز", "حجز", "تأكيد", "أؤكد"],
  yes: ["yes", "yes please", "sure", "ok", "okay", "please do", "haan", "han", "ha ji", "haan ji", "ji haan", "theek hai", "thik hai", "हाँ", "हां", "जी हाँ", "ठीक है", "হ্যাঁ", "ঠিক আছে", "sí", "si", "claro", "oui", "d'accord", "نعم", "أكيد", "حسنا", "حسناً"],
  price: ["price", "prices", "cost", "rate", "rates", "charges", "how much", "budget", "kitna", "kitne", "kharcha", "kharch", "paisa", "कितना", "कितने", "खर्च", "कीमत", "दाम", "प्राइस", "দাম", "খরচ", "কত", "precio", "cuánto", "cuanto", "coste", "costo", "prix", "combien", "tarif", "سعر", "السعر", "كم", "تكلفة"],
  visa: ["visa", "वीज़ा", "वीजा", "ভিসা", "visado", "تأشيرة", "فيزا"],
  emi: ["emi", "installment", "instalment", "किस्त", "কিস্তি", "cuotas", "mensualités", "أقساط"],
  payment: ["payment", "pay", "advance", "upi", "bank transfer", "पेमेंट", "भुगतान", "এডভান্স", "পেমেন্ট", "pago", "paiement", "دفع"],
  flight: ["flight", "flights", "airfare", "air ticket", "फ्लाइट", "ফ্লাইট", "vuelo", "vuelos", "vol", "vols", "طيران", "تذاكر"],
  customize: ["customise", "customize", "customised", "customized", "custom", "change hotel", "modify", "कस्टमाइज़", "বদল"],
  thanks: ["thank", "thanks", "thank you", "thx", "dhanyavad", "dhanyawad", "shukriya", "धन्यवाद", "शुक्रिया", "ধন্যবাদ", "gracias", "merci", "شكرا", "شكراً"],
  greeting: ["hi", "hii", "hiii", "hello", "hey", "namaste", "namaskar", "नमस्ते", "नमस्कार", "নমস্কার", "হ্যালো", "hola", "bonjour", "salut", "مرحبا", "مرحباً", "السلام", "اهلا", "أهلا", "good morning", "good evening", "good afternoon", "assalam"],
  packages: ["package", "packages", "tour", "tours", "trip", "trips", "holiday", "holidays", "vacation", "options", "destinations", "पैकेज", "टूर", "ट्रिप", "প্যাকেজ", "ট্যুর", "paquete", "paquetes", "viaje", "forfait", "forfaits", "circuit", "باقة", "باقات", "رحلة", "عروض"],
};

const PEOPLE = ["बड़े", "बड़ा", "वयस्क", "bade", "bada", "বড়", "people", "persons", "person", "pax", "adults", "adult", "members", "member", "travellers", "travelers", "guests", "log", "logo", "logon", "jan", "जन", "लोग", "लोगों", "व्यक्ति", "सदस्य", "জন", "লোক", "personas", "personnes", "adultes", "adultos", "أشخاص", "اشخاص", "شخص", "أفراد", "افراد", "بالغين"];
const KIDS = ["kids", "kid", "children", "child", "bachche", "bacche", "bachhe", "baccha", "बच्चे", "बच्चों", "बच्चा", "বাচ্চা", "শিশু", "niños", "ninos", "enfants", "enfant", "أطفال", "اطفال", "طفل"];
const NUMWORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8,
  "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5, "ছয়": 6, "সাত": 7,
  uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  "اثنين": 2, "اثنان": 2, "ثلاثة": 3, "أربعة": 4, "اربعة": 4, "خمسة": 5, "ستة": 6,
};
const MONTHS: [string, string[]][] = [
  ["January", ["january", "जनवरी", "জানুয়ারি", "enero", "janvier", "يناير"]],
  ["February", ["february", "feb", "फ़रवरी", "फरवरी", "ফেব্রুয়ারি", "febrero", "février", "فبراير"]],
  ["March", ["march", "मार्च", "মার্চ", "marzo", "مارس"]],
  ["April", ["april", "apr", "अप्रैल", "এপ্রিল", "abril", "avril", "أبريل", "ابريل"]],
  ["May", ["मई", "mayo", "مايو"]],
  ["June", ["june", "जून", "জুন", "junio", "juin", "يونيو"]],
  ["July", ["july", "जुलाई", "জুলাই", "julio", "juillet", "يوليو"]],
  ["August", ["august", "aug", "अगस्त", "আগস্ট", "agosto", "août", "أغسطس", "اغسطس"]],
  ["September", ["september", "sept", "sep", "सितंबर", "सितम्बर", "সেপ্টেম্বর", "septiembre", "septembre", "سبتمبر"]],
  ["October", ["october", "oct", "अक्टूबर", "अक्तूबर", "অক্টোবর", "octubre", "octobre", "أكتوبر", "اكتوبر"]],
  ["November", ["november", "nov", "नवंबर", "नवम्बर", "নভেম্বর", "noviembre", "novembre", "نوفمبر"]],
  ["December", ["december", "dec", "दिसंबर", "दिसम्बर", "ডিসেম্বর", "diciembre", "décembre", "ديسمبر"]],
];
const RELATIVE_DATES: [string, string[]][] = [
  ["Next month", ["next month", "agle mahine", "agle month", "अगले महीने", "পরের মাসে", "আগামী মাসে", "próximo mes", "proximo mes", "mois prochain", "الشهر القادم"]],
  ["Next week", ["next week", "agle hafte", "agle week", "अगले हफ्ते", "अगले हफ़्ते", "পরের সপ্তাহে", "próxima semana", "semaine prochaine", "الأسبوع القادم"]],
  ["This weekend", ["this weekend", "weekend"]],
  ["Diwali holidays", ["diwali", "दिवाली", "দীপাবলি"]],
  ["Puja holidays", ["puja", "pujo", "পুজো", "पूजा"]],
  ["Christmas / New Year", ["christmas", "new year", "क्रिसमस", "नया साल", "বড়দিন", "navidad", "noël", "عيد الميلاد", "رأس السنة"]],
  ["Summer vacation", ["summer vacation", "summer holidays", "garmi ki chutti", "गर्मी की छुट्टी", "গরমের ছুটি"]],
  ["Eid holidays", ["eid", "عيد"]],
];

export type Facts = { name?: string; email?: string; destination?: string; travelDate?: string; adults?: number; children?: number; budget?: number };

export function extractFacts(raw: string, lang = "en"): Facts {
  const text = normalizeDigits(raw);
  const lower = text.toLowerCase();
  const f: Facts = {};
  const toks = tokenize(lower);

  // travellers
  for (let i = 0; i < toks.length; i++) {
    const n = /^\d{1,2}$/.test(toks[i]) ? parseInt(toks[i], 10) : NUMWORDS[toks[i]];
    if (!n) continue;
    const ahead = toks.slice(i + 1, i + 3);
    if (ahead.some((w) => PEOPLE.includes(w))) f.adults = f.adults ?? n;
    else if (ahead.some((w) => KIDS.includes(w))) f.children = f.children ?? n;
  }
  const fam = lower.match(/(?:family of|we are|group of|total)\s+(\d{1,2})/);
  if (!f.adults && fam) f.adults = parseInt(fam[1], 10);
  if (!f.adults && hasAny(lower, ["couple", "honeymoon", "my wife and", "my husband and", "wife and me", "husband and me", "for two", "for 2", "hum dono", "हम दोनों", "हनीमून", "আমরা দুজন", "হানিমুন", "luna de miel", "lune de miel", "شخصين", "لشخصين", "شهر العسل"])) f.adults = 2;

  // dates
  const dm = lower.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dm && +dm[2] >= 1 && +dm[2] <= 12 && +dm[1] >= 1 && +dm[1] <= 31) {
    f.travelDate = `${+dm[1]} ${MONTHS[+dm[2] - 1][0]}${dm[3] ? ` ${dm[3].length === 2 ? "20" + dm[3] : dm[3]}` : ""}`;
  } else {
    for (const [month, words] of MONTHS) {
      const extra = lang === "fr" ? (month === "March" ? ["mars"] : month === "May" ? ["mai"] : []) : [];
      const hit = [...words, ...extra].find((w) => hasAny(lower, [w]));
      const mayHit = month === "May" && /(\bin may\b|\b\d{1,2}(st|nd|rd|th)? may\b|\bmay \d{1,2}\b|\bmay 20\d\d\b)/.test(lower);
      if (hit || mayHit) {
        const idx = hit ? lower.indexOf(hit.toLowerCase()) : lower.search(/may/);
        const around = lower.slice(Math.max(0, idx - 8), idx + (hit?.length ?? 3) + 8);
        const day = around.match(/(?<!\d)(\d{1,2})(?:st|nd|rd|th)?(?!\d)/);
        f.travelDate = `${day && +day[1] <= 31 ? day[1] + " " : ""}${month}`;
        break;
      }
    }
    if (!f.travelDate) for (const [label, words] of RELATIVE_DATES) if (hasAny(lower, words)) { f.travelDate = label; break; }
  }

  // budget
  const cur = lower.match(/(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|lakhs|lac|l)?\b/);
  const unit = lower.match(/([\d,]+(?:\.\d+)?)\s*(k|lakh|lakhs|lac|thousand|हजार|हज़ार|लाख|হাজার|লাখ|mil)(?![a-z])/);
  const bword = lower.match(/(?:budget|बजट|বাজেট|presupuesto|ميزانية)\D{0,15}([\d,]{4,})/);
  const pick = cur ?? unit ?? (bword ? [bword[0], bword[1], ""] : null);
  if (pick) {
    let v = parseFloat(pick[1].replace(/,/g, ""));
    const u = (pick[2] || "").toLowerCase();
    if (["k", "thousand", "हजार", "हज़ार", "হাজার", "mil"].includes(u)) v *= 1000;
    if (["lakh", "lakhs", "lac", "l", "लाख", "লাখ"].includes(u)) v *= 100000;
    if (v >= 1000) f.budget = Math.round(v);
  }

  // name
  const nameRe = [
    /(?:my name is|myself|mera naam|mera nam|me llamo|mi nombre es|je m'appelle|je m’appelle)\s+([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+)?)/i,
    /(?:मेरा नाम)\s+([ऀ-ॿ]+(?:\s+[ऀ-ॿ]+)?)\s+(?:है|हूँ|हूं)/,
    /আমার নাম\s+([ঀ-৿]+)/,
    /اسمي\s+([؀-ۿ]+)/,
  ];
  for (const re of nameRe) {
    const m = text.match(re);
    if (m) {
      const stop = ["hai", "hu", "hoon", "and", "aur", "from", "se"];
      const parts = m[1].split(/\s+/).filter((p) => !stop.includes(p.toLowerCase()));
      if (parts.length) f.name = parts.map((p) => (/[a-z]/i.test(p) ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p)).join(" ");
      break;
    }
  }
  const em = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (em) f.email = em[0].toLowerCase();
  return f;
}

export function matchPackage(text: string, packages: KbPackage[]): KbPackage | undefined {
  const lower = text.toLowerCase();
  return packages.find((p) => hasAny(lower, [p.destination, ...(p.keywords ?? [])].filter(Boolean)));
}

const EMOJI: Record<string, string> = { goa: "🏖️", kashmir: "🏔️", kerala: "🌴", manali: "❄️", darjeeling: "🍃", dubai: "🏙️", bali: "🌺", maldives: "🏝️", thailand: "🐘", rajasthan: "🏰", singapore: "🦁", ladakh: "🏍️", andaman: "🐠" };
const emojiFor = (d: string) => EMOJI[d.toLowerCase()] ?? "📍";
const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

function pkgList(pkgs: KbPackage[], t: Tpl, max = 6) {
  return pkgs.slice(0, max).map((p) => `${emojiFor(p.destination)} *${p.destination}* — ${p.duration} · ₹${inr(p.pricePerPerson)} ${t.labels.perPerson}`).join("\n");
}
function pkgCard(p: KbPackage, t: Tpl) {
  const l = t.labels;
  return [
    `${emojiFor(p.destination)} *${p.name}*`,
    p.duration && `🕒 ${l.duration}: ${p.duration}`,
    p.pricePerPerson && `💰 ${l.from} ₹${inr(p.pricePerPerson)} ${l.perPerson}`,
    p.inclusions && `✅ ${l.includes}: ${p.inclusions}`,
    p.highlights && `✨ ${l.highlights}: ${p.highlights}`,
    p.bestTime && `🗓️ ${l.bestTime}: ${p.bestTime}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function followUpDays(text: string) {
  if (hasAny(text, ["tomorrow", "kal", "कल", "আগামীকাল", "কাল", "mañana", "demain", "غدا", "غداً", "بكرة"])) return 1;
  if (hasAny(text, ["next week", "agle hafte", "agle week", "अगले हफ्ते", "अगले हफ़्ते", "পরের সপ্তাহ", "próxima semana", "semaine prochaine", "الأسبوع القادم"])) return 7;
  if (hasAny(text, ["next month", "agle mahine", "अगले महीने", "পরের মাস", "próximo mes", "mois prochain", "الشهر القادم"])) return 30;
  return 3;
}

/** Merge facts from all customer messages (latest wins). */
function mergedFacts(inbound: string[], lang: string): Facts {
  const out: Facts = {};
  for (const msg of inbound) {
    const f = extractFacts(msg, lang);
    Object.assign(out, Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")));
  }
  return out;
}

export function demoReply(ctx: AiContext): AiResult {
  const latest = ctx.message;
  const inbound = [...ctx.history.filter((h) => h.role === "customer").map((h) => h.text), latest];

  // language: confident detection on latest message, else last confident language in the conversation
  let det = detectLanguage(latest);
  if (!det.confident) {
    for (let i = inbound.length - 2; i >= 0; i--) {
      const d = detectLanguage(inbound[i]);
      if (d.confident) {
        det = d;
        break;
      }
    }
    if (!det.confident && ctx.knownLanguage) det = { code: ctx.knownLanguage, confident: true };
  }
  const language = det.code;
  const tl: L = (["en", "hi", "hi-Latn", "bn", "ar", "es", "fr"] as L[]).includes(language as L) ? (language as L) : language === "mr" || language === "ne" ? "hi" : language === "ur" ? "hi-Latn" : "en";
  const t = T[tl];
  const kb = ctx.kb;
  const A = kb.assistantName || "Aria";
  const C = ctx.companyName || "Aalat Travels";
  const pkgs = kb.packages ?? [];
  const lower = normalizeDigits(latest).toLowerCase();

  const facts = mergedFacts(inbound, language);
  const latestFacts = extractFacts(latest, language);
  const latestPkg = matchPackage(latest, pkgs);
  let pkg = latestPkg;
  if (!pkg) for (let i = inbound.length - 2; i >= 0 && !pkg; i--) pkg = matchPackage(inbound[i], pkgs);
  if (!pkg && ctx.knownDestination) pkg = matchPackage(ctx.knownDestination, pkgs);
  const name = facts.name || (ctx.customerName && ctx.customerName !== "WhatsApp User" ? ctx.customerName.split(" ")[0] : "");

  const adults = facts.adults ?? ctx.knownAdults ?? 0;
  const children = facts.children ?? 0;
  const travelDate = facts.travelDate ?? ctx.knownTravelDate ?? "";
  const trav = `${adults} ${t.labels.adults}${children ? `, ${children} ${t.labels.children}` : ""}`;
  const missing = [!travelDate && t.missing.dates, !adults && t.missing.travellers].filter(Boolean) as string[];
  const minPrice = pkgs.length ? Math.min(...pkgs.map((p) => p.pricePerPerson || Infinity)) : 0;
  const quote = (p: KbPackage) => {
    const total = p.pricePerPerson * adults + p.pricePerPerson * 0.5 * children;
    return t.quote(p.name, trav, travelDate || t.labels.dateTBD, inr(p.pricePerPerson), inr(total));
  };

  const lastAiAskedToProceed = /🙌\s*$/.test(ctx.history.filter((h) => h.role !== "customer").slice(-1)[0]?.text ?? "");

  let reply = "";
  let intent = "general";
  let interest: AiResult["interest"] = "unknown";
  let handoff = false;
  let followUp: AiResult["followUp"] = null;

  if (hasAny(lower, K.notInterested)) {
    intent = "not_interested";
    interest = "not_interested";
    reply = t.notInterested(C);
  } else if (hasAny(lower, K.human)) {
    intent = "human_handoff";
    interest = "interested";
    handoff = true;
    reply = t.human(kb.officeHours || "10 AM – 7 PM");
    followUp = { title: "Customer requested a call back", inHours: 1, type: "call" };
  } else if (hasAny(lower, K.later)) {
    intent = "later";
    interest = "follow_up";
    const days = followUpDays(lower);
    reply = t.later(days === 1 ? t.when.d1 : days === 7 ? t.when.d7 : days === 30 ? t.when.d30 : t.when.dx);
    followUp = { title: `Follow up${pkg ? ` on ${pkg.destination} trip` : ""} (customer asked for time)`, inHours: days * 24, type: "whatsapp" };
  } else if (hasAny(lower, K.objection)) {
    intent = "price_objection";
    interest = "follow_up";
    reply = t.objection();
    followUp = { title: "Share budget-friendly options", inHours: 24, type: "whatsapp" };
  } else if (hasAny(lower, K.book) || (lastAiAskedToProceed && hasAny(lower, K.yes))) {
    intent = "booking";
    interest = "interested";
    reply = t.booking(pkg?.name ?? "");
    followUp = { title: `Call to confirm booking${pkg ? ` — ${pkg.name}` : ""}`, inHours: 2, type: "call" };
  } else if (hasAny(lower, K.visa) || hasAny(lower, K.emi) || hasAny(lower, K.payment) || hasAny(lower, K.flight) || hasAny(lower, K.customize)) {
    intent = "faq";
    const faq = findFaq(lower, kb.faqs ?? []);
    interest = pkg ? "interested" : "unknown";
    reply = faq ? `${t.labels.faqIntro ? t.labels.faqIntro + " " : ""}${faq.answer} 😊` : t.fallback();
    if (latestPkg) reply = `${pkgCard(latestPkg, t)}\n\n${reply}`;
  } else if (latestPkg) {
    intent = "package_inquiry";
    interest = "interested";
    reply = missing.length ? `${pkgCard(latestPkg, t)}\n\n${t.askMissing(missing.join(t.join))}` : `${pkgCard(latestPkg, t)}\n\n${quote(latestPkg)}`;
  } else if (pkg && (latestFacts.adults || latestFacts.travelDate || latestFacts.children || hasAny(lower, K.price))) {
    intent = "trip_details";
    interest = "interested";
    reply = missing.length ? t.askMissing(missing.join(t.join)) : quote(pkg);
  } else if (latestFacts.budget) {
    intent = "budget";
    interest = "interested";
    const fit = pkgs.filter((p) => p.pricePerPerson <= latestFacts.budget! * 1.1).sort((a, b) => b.pricePerPerson - a.pricePerPerson);
    reply = fit.length ? t.budgetSuggest(inr(latestFacts.budget), pkgList(fit, t, 4)) : t.objection();
  } else if (hasAny(lower, K.price)) {
    intent = "price_inquiry";
    interest = "interested";
    reply = t.priceOverview(inr(minPrice), pkgList(pkgs, t));
  } else if (hasAny(lower, K.packages)) {
    intent = "packages";
    reply = t.packagesList(pkgList(pkgs, t));
  } else if (hasAny(lower, K.thanks)) {
    intent = "thanks";
    reply = t.thanks();
  } else if (hasAny(lower, K.greeting) || inbound.length === 1) {
    intent = "greeting";
    reply = t.greet(name, A, C, pkgList(pkgs, t, 5));
  } else if (latestFacts.adults || latestFacts.travelDate) {
    intent = "trip_details";
    reply = t.packagesList(pkgList(pkgs, t));
  } else {
    intent = "general";
    reply = t.fallback();
  }

  const summaryBits = [pkg && `Destination: ${pkg.destination}`, travelDate && `Dates: ${travelDate}`, adults && `Travellers: ${adults}${children ? ` + ${children} children` : ""}`, facts.budget && `Budget: ₹${inr(facts.budget)}`].filter(Boolean);
  return {
    engine: "demo",
    reply,
    language,
    intent,
    interest,
    handoff,
    handoffReason: handoff ? "Customer asked to speak with a person" : "",
    followUp,
    extracted: {
      name: facts.name ?? null,
      email: facts.email ?? null,
      destination: pkg?.destination ?? null,
      travelDate: travelDate || null,
      adults: adults || null,
      children: children || null,
      budget: facts.budget ?? null,
    },
    summary: summaryBits.length ? `${intentLabel(intent)} — ${summaryBits.join(" · ")}` : intentLabel(intent),
  };
}

function findFaq(lower: string, faqs: { question: string; answer: string }[]) {
  const topic = hasAny(lower, K.visa) ? ["visa"] : hasAny(lower, K.emi) ? ["emi"] : hasAny(lower, K.flight) ? ["flight"] : hasAny(lower, K.customize) ? ["customis", "customiz"] : ["confirm", "booking", "advance", "pay"];
  return faqs.find((f) => topic.some((w) => (f.question + " " + f.answer).toLowerCase().includes(w)));
}

function intentLabel(i: string) {
  return (
    { not_interested: "Not interested", human_handoff: "Asked for a human agent", later: "Will decide later", price_objection: "Price concern", booking: "Wants to book", faq: "Asked a question", package_inquiry: "Package enquiry", trip_details: "Shared trip details", budget: "Shared budget", price_inquiry: "Price enquiry", packages: "Browsing packages", thanks: "Thanked", greeting: "Greeting", general: "General enquiry" } as Record<string, string>
  )[i] ?? i;
}
