"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { fetchActiveSources, fetchAllPipelineStages, type Source } from "@/lib/models/refData";
import { createLead } from "@/lib/models/leads";

export default function NewLeadSlideOver({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [defaultStageId, setDefaultStageId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load dropdown data once when first opened
  useEffect(() => {
    if (!open || sources.length) return;
    (async () => {
      const [src, list] = await Promise.all([fetchActiveSources(), fetchAllPipelineStages()]);
      setSources(src);
      const start =
        list.find((s) => s.label.toLowerCase() === "new") ||
        list.find((s) => s.terminal_type == null);
      setDefaultStageId(start?.id ?? null);
    })();
  }, [open, sources.length]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function reset() {
    setFullName("");
    setPhone("");
    setSourceId("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast("يرجى إدخال الاسم الكامل", "error");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await createLead({
      fullName: fullName.trim(),
      normalizedPhone: phone.trim() || null,
      primarySourceId: sourceId || null,
      stageId: defaultStageId,
      notes: notes.trim() || null,
      ownerId: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      console.error("[NewLead] insert failed", error);
      toast("تعذّر حفظ العميل — حاول مرة أخرى", "error");
      return;
    }
    toast("تم إضافة العميل بنجاح");
    reset();
    onCreated?.();
    onClose();
  }

  const inputCls =
    "h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 t-body text-[#334155] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15";
  const labelCls =
    "mb-1.5 block t-body-sm font-semibold uppercase tracking-wide text-[#94a3b8]";

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-6">
          <div>
            <h2 className="text-xl font-bold text-[#1e1b4b]">عميل جديد</h2>
            <p className="mt-0.5 t-body-sm text-[#94a3b8]">أضف عميل لمسار المبيعات</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#94a3b8] transition hover:text-[#334155]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div>
            <label className={labelCls} htmlFor="nl-name">الاسم الكامل *</label>
            <input
              id="nl-name"
              dir="auto"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثلاً: سارة العتيبي"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="nl-phone">الجوال</label>
            <input
              id="nl-phone"
              dir="auto"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966 5X XXX XXXX"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="nl-source">المصدر</label>
            <select
              id="nl-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className={inputCls}
            >
              <option value="">اختر مصدر...</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="nl-notes">الملاحظات</label>
            <textarea
              id="nl-notes"
              dir="auto"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="أي ملاحظات عن هذا العميل..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5 t-body text-[#334155] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15"
            />
          </div>
        </form>

        <div className="flex gap-3 border-t border-[var(--border-subtle)] p-6">
          <button
            onClick={onClose}
            type="button"
            className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] t-body font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-11 flex-1 rounded-[var(--radius-md)] bg-[#1a5c4f] t-body font-semibold text-white shadow-sm shadow-[#1a5c4f]/25 transition hover:bg-[#15503f] disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : "حفظ العميل"}
          </button>
        </div>
      </aside>
    </>
  );
}
