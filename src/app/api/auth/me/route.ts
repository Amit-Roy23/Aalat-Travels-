import { requireUser, route } from "@/lib/api";
import { getSettings } from "@/lib/services/settings";
import { aiMode } from "@/lib/ai/engine";
import { whatsappConfigured } from "@/lib/services/whatsapp";

export const GET = route(async () => {
  const user = await requireUser();
  const s = await getSettings();
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    company: { name: s.company?.name ?? "Aalat Travels", tagline: s.company?.tagline ?? "" },
    integrations: { ai: aiMode(), whatsapp: whatsappConfigured() },
  };
});
