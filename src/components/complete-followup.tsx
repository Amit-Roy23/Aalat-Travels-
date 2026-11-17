"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { api } from "@/lib/client";
import { LEAD_STATUSES } from "@/lib/constants";
import { Button, Field, Modal, useUi } from "./ui";

export function CompleteFollowUpModal({ fu, onClose, onDone, leadStatus }: { fu: { _id: string; title: string } | null; onClose: () => void; onDone: () => void; leadStatus?: string }) {
  const { toast } = useUi();
  const [outcome, setOutcome] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!fu) return;
    setBusy(true);
    try {
      await api(`/api/followups/${fu._id}`, { method: "PATCH", body: { status: "completed", outcome, ...(status ? { leadStatus: status } : {}) } });
      toast("Follow-up completed ✅");
      setOutcome("");
      setStatus("");
      onClose();
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!fu} onClose={onClose} title="Complete follow-up" description={fu?.title} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy} icon={<Check className="h-4 w-4" />}>Mark done</Button></>}>
      <div className="space-y-3">
        <Field label="Outcome">
          <textarea className="input" rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Customer confirmed dates, sending quote tonight" autoFocus />
        </Field>
        {leadStatus !== undefined && leadStatus !== "converted" && (
          <Field label="Update lead status (optional)">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Keep current</option>
              {LEAD_STATUSES.filter((s) => s.value !== "converted").map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
