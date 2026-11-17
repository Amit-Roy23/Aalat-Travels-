import crypto from "crypto";
import { Settings } from "../models";
import { DEFAULT_KNOWLEDGE } from "../ai/knowledge-defaults";

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
  return s;
}

export function newApiKey() {
  return "alk_" + crypto.randomBytes(20).toString("hex");
}
