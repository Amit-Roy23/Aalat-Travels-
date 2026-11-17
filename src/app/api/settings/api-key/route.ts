import { requireUser, route } from "@/lib/api";
import { getSettings, newApiKey } from "@/lib/services/settings";

export const POST = route(async () => {
  await requireUser("admin");
  const s = await getSettings();
  s.set("leads.captureApiKey", newApiKey());
  await s.save();
  return { apiKey: s.leads?.captureApiKey };
});
