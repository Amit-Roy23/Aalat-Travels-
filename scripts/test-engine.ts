import { demoReply } from "../src/lib/ai/demo-engine";
import { DEFAULT_KNOWLEDGE } from "../src/lib/ai/knowledge-defaults";
import type { HistoryItem } from "../src/lib/ai/types";

const convs: string[][] = [
  ["Hi", "I want Goa package for 4 people in December", "yes please book it"],
  ["नमस्ते, गोवा जाना है", "हम 2 बड़े और 2 बच्चे हैं, 22 दिसंबर से", "बाद में बताऊंगा"],
  ["Kashmir ka package kitne ka hai? Hum 4 log hain", "April mein", "thoda mehenga hai"],
  ["নমস্কার, দার্জিলিং যেতে চাই", "আমরা 3 জন, পরের মাসে"],
  ["مرحبا، أريد رحلة إلى دبي لشخصين", "في يناير"],
  ["Hola, queremos viajar a Bali", "somos 2 personas en marzo"],
  ["Bonjour, combien pour les Maldives ?", "2 personnes en mars"],
  ["my budget is 20k per person, suggest something", "not interested, thanks"],
  ["Can I talk to an agent?"],
  ["Do you provide visa for Dubai?"],
  ["hello", "my name is Rahul, family of 5 for kerala 20/12/2026"],
];
for (const c of convs) {
  const h: HistoryItem[] = [];
  console.log("=".repeat(70));
  for (const m of c) {
    const r = demoReply({ message: m, history: h, kb: DEFAULT_KNOWLEDGE as never, companyName: "Aalat Travels" });
    console.log(`👤 ${m}\n🤖 [${r.language}|${r.intent}|${r.interest}${r.followUp ? "|FU:" + r.followUp.inHours + "h" : ""}${r.handoff ? "|HANDOFF" : ""}] ${r.reply.split("\n").slice(0, 3).join(" / ").slice(0, 230)}\n   extracted: ${JSON.stringify(Object.fromEntries(Object.entries(r.extracted).filter(([, v]) => v)))}`);
    h.push({ role: "customer", text: m }, { role: "ai", text: r.reply });
  }
}
