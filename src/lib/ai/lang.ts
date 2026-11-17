// Lightweight language detection + text utilities (used by the built-in demo AI engine).

const SCRIPT_RANGES: [RegExp, string][] = [
  [/[ঀ-৿]/g, "bn"],
  [/[਀-੿]/g, "pa"],
  [/[઀-૿]/g, "gu"],
  [/[଀-୿]/g, "or"],
  [/[஀-௿]/g, "ta"],
  [/[ఀ-౿]/g, "te"],
  [/[ಀ-೿]/g, "kn"],
  [/[ഀ-ൿ]/g, "ml"],
  [/[฀-๿]/g, "th"],
  [/[ऀ-ॿ]/g, "hi"],
  [/[؀-ۿ]/g, "ar"],
  [/[Ѐ-ӿ]/g, "ru"],
  [/[぀-ヿ]/g, "ja"],
  [/[가-힯]/g, "ko"],
  [/[一-鿿]/g, "zh"],
];

const LATIN_MARKERS: Record<string, { strong: string[]; weak: string[] }> = {
  "hi-Latn": {
    strong: ["kya", "hai", "hain", "chahiye", "chahte", "kitna", "kitne", "nahi", "nahin", "mujhe", "humko", "hamein", "jaana", "jana", "ghumne", "batao", "bataiye", "bataye", "kijiye", "karna", "karenge", "accha", "acha", "theek", "thik", "haan", "bhai", "aap", "hum", "mera", "naam", "liye", "mein", "kab", "kaise", "kaisa", "baad", "abhi", "wala", "wali", "jayenge", "rahe", "dijiye", "shukriya", "dhanyavad", "namaste", "chalega", "hoga"],
    weak: ["ji", "ke", "ki", "ka", "ko", "se", "aur", "log", "par", "toh", "to", "bhi", "sab", "mai", "main"],
  },
  es: { strong: ["hola", "quiero", "queremos", "viaje", "viajar", "precio", "cuánto", "cuanto", "gracias", "personas", "interesa", "días", "buenos", "buenas", "necesito", "paquete", "cuesta", "también", "nosotros", "familia", "mañana", "semana"], weak: ["para", "por", "con", "una", "el", "los", "las", "y", "de"] },
  fr: { strong: ["bonjour", "voyage", "voyager", "prix", "merci", "voudrais", "voudrions", "personnes", "combien", "s'il", "plaît", "vous", "nous", "forfait", "semaine", "enfants", "salut", "aimerions", "réserver"], weak: ["pour", "avec", "le", "la", "les", "et", "est", "un", "une", "des"] },
  de: { strong: ["hallo", "reise", "preis", "danke", "möchte", "möchten", "personen", "wieviel", "kostet", "bitte", "urlaub", "wir", "ich"], weak: ["und", "der", "die", "das", "mit", "für"] },
  pt: { strong: ["olá", "viagem", "preço", "obrigado", "obrigada", "quero", "pessoas", "quanto", "você", "gostaria"], weak: ["para", "com", "uma", "os", "as"] },
  id: { strong: ["halo", "saya", "mau", "berapa", "terima", "kasih", "harga", "liburan", "orang", "kami"], weak: ["dan", "untuk", "ke"] },
};

const URDU_MARKERS = /[ٹڈڑںےۓہھ]/;
const MARATHI_MARKERS = /(आहे|आहोत|मला|आम्हाला|करायचा|करायची|जायचे|जायचं|किती|नाही|पाहिजे)/;

export type Detected = { code: string; confident: boolean };

export function detectLanguage(text: string): Detected {
  const t = text.trim();
  if (!t) return { code: "en", confident: false };
  let best = "";
  let bestCount = 0;
  for (const [re, code] of SCRIPT_RANGES) {
    const n = t.match(re)?.length ?? 0;
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }
  if (bestCount >= 2) {
    if (best === "ar" && URDU_MARKERS.test(t)) return { code: "ur", confident: true };
    if (best === "hi" && MARATHI_MARKERS.test(t)) return { code: "mr", confident: true };
    return { code: best, confident: true };
  }
  const words = tokenize(t.toLowerCase());
  let lang = "en";
  let score = 0;
  for (const [code, m] of Object.entries(LATIN_MARKERS)) {
    let s = 0;
    for (const w of words) {
      if (m.strong.includes(w)) s += 2;
      else if (m.weak.includes(w)) s += 0.5;
    }
    if (s > score) {
      score = s;
      lang = code;
    }
  }
  if (score >= 2) return { code: lang, confident: score >= 3 || words.length <= 4 };
  const letters = words.filter((w) => /[a-z]/.test(w));
  return { code: "en", confident: letters.length >= 4 };
}

export function tokenize(text: string) {
  return text
    .split(/[\s,.!?;:()"“”'‘’।॥\-–—/\\|]+/u)
    .map((w) => w.trim())
    .filter(Boolean);
}

const DIGIT_BLOCKS = [0x0966, 0x09e6, 0x0660, 0x06f0, 0x0ae6, 0x0a66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66];
export function normalizeDigits(s: string) {
  return s.replace(/[०-९০-৯٠-٩۰-۹૦-૯੦-੯௦-௯౦-౯೦-೯൦-൯]/g, (ch) => {
    const c = ch.charCodeAt(0);
    for (const base of DIGIT_BLOCKS) if (c >= base && c <= base + 9) return String(c - base);
    return ch;
  });
}

/** True when any keyword is present. Latin keywords match on word boundaries; others by substring. */
export function hasAny(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((k) => {
    const kw = k.toLowerCase();
    if (/^[a-z0-9' ]+$/.test(kw)) return new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(lower);
    return lower.includes(kw);
  });
}
