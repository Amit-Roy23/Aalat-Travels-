import { z } from "zod";
import { body, requireUser, route } from "@/lib/api";
import { clearDemo, seedDemo } from "@/lib/seed";

export const maxDuration = 60;

export const POST = route(async (req) => {
  const user = await requireUser("admin");
  const { action } = await body(req, z.object({ action: z.enum(["seed", "clear"]) }));
  if (action === "clear") {
    await clearDemo();
    return { ok: true };
  }
  return { ok: true, counts: await seedDemo(user.id) };
});
