"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

export default function CompleteTaskModal({
  open,
  taskTitle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  taskTitle: string | null;
  onClose: () => void;
  onConfirm: (note: string) => void | Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleConfirm() {
    if (!note.trim()) {
      setErr("اكتب وش سويت بالمهمة قبل ما تقفلها");
      return;
    }
    setSaving(true);
    await onConfirm(note.trim());
    setSaving(false);
    setNote("");
    setErr("");
  }

  function handleClose() {
    setNote("");
    setErr("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] rounded-[var(--radius-lg)] border border-border-light bg-[var(--surface-raised)] p-[var(--space-card-pad)] shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">إنهاء المهمة</h3>
            <p dir="auto" className="mt-0.5 truncate t-body-sm text-muted">{taskTitle || "—"}</p>
          </div>
          <button onClick={handleClose} className="flex-none text-muted transition hover:text-ink-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <Textarea
          id="ct-note"
          dir="auto"
          label="وش سويت بالمهمة؟ *"
          value={note}
          onChange={(e) => { setNote(e.target.value); if (err) setErr(""); }}
          placeholder="اكتب ملاحظة عن اللي تم إنجازه…"
          error={err}
          autoFocus
        />

        <div className="mt-5 flex gap-3">
          <Button variant="secondary" fullWidth onClick={handleClose}>إلغاء</Button>
          <Button fullWidth loading={saving} onClick={handleConfirm}>تم الإنجاز</Button>
        </div>
      </div>
    </div>
  );
}
