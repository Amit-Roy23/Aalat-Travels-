import crypto from "crypto";
import { Settings } from "../models";
import { DEFAULT_KNOWLEDGE } from "../ai/knowledge-defaults";
import { DEFAULT_PARTNER_LOGOS, PARTNER_DEFAULTS_VERSION } from "../invoice-defaults";

export async function getSettings() {
  let s = await Settings.findById("global");
  if (!s) {
    s = await Settings.create({
      _id: "global",
      ai: DEFAULT_KNOWLEDGE,
      leads: { autoAssign: "round_robin", lastAssignedIndex: -1, captureApiKey: newApiKey() },
    });
  } else if (!s.leads?.captureApiKey) {
    s.set("leads.captureApiKey", newApiKey());
    await s.save();
  }
  await upgradePartnerLogos(s);
  return s;
}

export function newApiKey() {
  return "alk_" + crypto.randomBytes(20).toString("hex");
}

/**
 * One-time upgrade when new default bill logos are bundled: only logos introduced AFTER the
 * installation's stored version are added (in their default position). Logos an admin removed on
 * purpose are never re-added, and a customised list is otherwise left as it is.
 */
const ADDED_IN_VERSION: Record<string, number> = {
  "/brand/partners/incredible-india.png": 2,
  "/brand/partners/kerala-tourism.png": 2,
}; // logos not listed here shipped with the first version (0)

type Logo = { name: string; src: string };
type SettingsLike = {
  invoice?: { partnerDefaultsVersion?: number | null; partnerLogos?: Logo[] | null } | null;
  set(path: string, value: unknown): unknown;
  save(): Promise<unknown>;
};

export async function upgradePartnerLogos(s: SettingsLike) {
  const from = s.invoice?.partnerDefaultsVersion ?? 0;
  if (from >= PARTNER_DEFAULTS_VERSION) return;
  let next: Logo[] = (s.invoice?.partnerLogos ?? []).map((l) => ({ name: l.name, src: l.src }));
  const have = new Set(next.map((l) => l.src));
  DEFAULT_PARTNER_LOGOS.forEach((d, idx) => {
    if ((ADDED_IN_VERSION[d.src] ?? 0) > from && !have.has(d.src)) next = [...next.slice(0, idx), { ...d }, ...next.slice(idx)];
  });
  s.set("invoice.partnerLogos", next.slice(0, 12));
  s.set("invoice.partnerDefaultsVersion", PARTNER_DEFAULTS_VERSION);
  await s.save();
}
