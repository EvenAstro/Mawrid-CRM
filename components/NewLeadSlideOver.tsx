"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

interface Source {
  id: string;
  label: string;
}

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
      const [{ data: src }, { data: stages }] = await Promise.all([
        supabase
          .from("sources")
          .select("id, label")
          .eq("is_archived", false)
          .order("sort_order", { ascending: true }),
        supabase.from("pipeline_stages").select("id, label, terminal_type"),
      ]);
      if (src) setSources(src as Source[]);
      const list = (stages as { id: string; label: string; terminal_type: string | null }[]) || [];
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
      toast("Please enter a full name", "error");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("leads").insert({
      id: crypto.randomUUID(),
      full_name: fullName.trim(),
      normalized_phone: phone.trim() || null,
      primary_source_id: sourceId || null,
      stage_id: defaultStageId,
      notes: notes.trim() || null,
      created_at: now,
      updated_at: now,
    });
    setSaving(false);
    if (error) {
      console.error("[NewLead] insert failed", error);
      toast("Could not save lead — please try again", "error");
      return;
    }
    toast("Lead added successfully");
    reset();
    onCreated?.();
    onClose();
  }

  const inputCls =
    "h-11 w-full rounded-xl border border-[#e8ece9] bg-white px-3.5 text-[15px] text-[#334155] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15";
  const labelCls =
    "mb-1.5 block text-[13px] font-semibold uppercase tracking-wide text-[#94a3b8]";

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-[#e8ece9] bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e8ece9] p-6">
          <div>
            <h2 className="text-xl font-bold text-[#1e1b4b]">New Lead</h2>
            <p className="mt-0.5 text-[13px] text-[#94a3b8]">Add a lead to your pipeline</p>
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
            <label className={labelCls} htmlFor="nl-name">Full Name *</label>
            <input
              id="nl-name"
              dir="auto"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sara Al-Otaibi"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="nl-phone">Phone</label>
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
            <label className={labelCls} htmlFor="nl-source">Source</label>
            <select
              id="nl-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select a source…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="nl-notes">Notes</label>
            <textarea
              id="nl-notes"
              dir="auto"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anything worth remembering about this lead…"
              className="w-full rounded-xl border border-[#e8ece9] bg-white px-3.5 py-2.5 text-[15px] text-[#334155] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15"
            />
          </div>
        </form>

        <div className="flex gap-3 border-t border-[#e8ece9] p-6">
          <button
            onClick={onClose}
            type="button"
            className="h-11 flex-1 rounded-xl border border-[#e8ece9] text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-[#1a5c4f] text-[15px] font-semibold text-white shadow-sm shadow-[#1a5c4f]/25 transition hover:bg-[#15503f] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      </aside>
    </>
  );
}
