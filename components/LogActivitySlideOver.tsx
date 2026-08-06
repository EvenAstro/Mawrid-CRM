"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { todayInput } from "@/lib/format";
import { createActivity } from "@/lib/models/activities";
import { fetchActiveActivityTypes } from "@/lib/models/refData";
import { searchLeadsByName } from "@/lib/models/leads";

interface ActivityType {
  id: string;
  label: string;
}
interface LeadHit {
  id: string;
  full_name: string | null;
}

export default function LogActivitySlideOver({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [selected, setSelected] = useState<LeadHit | null>(null);
  const [typeId, setTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayInput());
  const [saving, setSaving] = useState(false);
  // Default to outbound — this form is framed as the rep recording their own
  // touchpoint ("Record a touchpoint with a contact"); inbound is the explicit choice.
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");

  useEffect(() => {
    if (!open || types.length) return;
    fetchActiveActivityTypes().then(setTypes).catch((err) => console.error("[LogActivity] fetchActiveActivityTypes failed", err));
  }, [open, types.length]);

  // Live lead search
  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const data = await searchLeadsByName(query.trim());
      if (active) setHits(data.map((l) => ({ id: String(l.id), full_name: l.full_name })));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, selected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function reset() {
    setQuery("");
    setSelected(null);
    setHits([]);
    setTypeId("");
    setNotes("");
    setDate(todayInput());
    setDirection("outbound");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast("Please select a contact", "error");
      return;
    }
    if (!typeId) {
      toast("Please choose an activity type", "error");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const trimmedNotes = notes.trim();
    const { error, id: activityId } = await createActivity({
      entityType: "lead",
      entityId: selected.id,
      activityTypeId: typeId,
      body: trimmedNotes || null,
      direction,
      occurredAt: new Date(date + "T00:00:00").toISOString(),
      userId: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      console.error("[LogActivity] insert failed", error);
      toast("Could not log activity — please try again", "error");
      return;
    }
    toast("Activity logged");

    // Fire-and-forget: classify inbound replies in the background. The form
    // closes immediately regardless of how long — or whether — this succeeds.
    if (direction === "inbound" && trimmedNotes) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch("/api/classify-activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ activityId, body: trimmedNotes }),
        }).catch((err) => console.error("[LogActivity] classify trigger failed", err));
      });
    }

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
            <h2 className="text-xl font-bold text-[#1e1b4b]">تسجيل نشاط</h2>
            <p className="mt-0.5 text-[13px] text-[#94a3b8]">Record a touchpoint with a contact</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#94a3b8] transition hover:text-[#334155]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {/* Contact search */}
          <div className="relative">
            <label className={labelCls} htmlFor="la-contact">العميل *</label>
            {selected ? (
              <div className="flex items-center justify-between rounded-xl border border-[#1a5c4f]/30 bg-[#f0faf8] px-3.5 py-2.5">
                <span dir="auto" className="text-[15px] font-medium text-[#1e1b4b]">
                  {selected.full_name || "عميل بدون اسم"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setQuery("");
                  }}
                  className="text-[13px] font-semibold text-[#1a5c4f] hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <input
                id="la-contact"
                dir="auto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن عميل بالاسم..."
                className={inputCls}
                autoComplete="off"
              />
            )}
            {!selected && hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[#e8ece9] bg-white shadow-lg">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setSelected(h);
                      setHits([]);
                    }}
                    dir="auto"
                    className="block w-full px-3.5 py-2.5 text-left text-[15px] text-[#334155] transition hover:bg-[#f8fafc]"
                  >
                    {h.full_name || "عميل بدون اسم"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>الاتجاه *</label>
            <div className="flex gap-2">
              <button
                type="button"
                dir="auto"
                onClick={() => setDirection("outbound")}
                className={`h-11 flex-1 rounded-xl border text-[14px] font-semibold transition ${
                  direction === "outbound"
                    ? "border-[#1a5c4f] bg-[#f0faf8] text-[#1a5c4f]"
                    : "border-[#e8ece9] text-[#334155] hover:border-[#1a5c4f]/40"
                }`}
              >
                اتصلت بالعميل
              </button>
              <button
                type="button"
                dir="auto"
                onClick={() => setDirection("inbound")}
                className={`h-11 flex-1 rounded-xl border text-[14px] font-semibold transition ${
                  direction === "inbound"
                    ? "border-[#1a5c4f] bg-[#f0faf8] text-[#1a5c4f]"
                    : "border-[#e8ece9] text-[#334155] hover:border-[#1a5c4f]/40"
                }`}
              >
                رد العميل
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="la-type">نوع النشاط *</label>
            <select id="la-type" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
              <option value="">اختر نوع...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="la-date">التاريخ *</label>
            <input id="la-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="la-notes">الملاحظات</label>
            <textarea
              id="la-notes"
              dir="auto"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="ماذا حصل في هذا التواصل..."
              className="w-full rounded-xl border border-[#e8ece9] bg-white px-3.5 py-2.5 text-[15px] text-[#334155] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15"
            />
          </div>
        </form>

        <div className="flex gap-3 border-t border-[#e8ece9] p-6">
          <button onClick={onClose} type="button" className="h-11 flex-1 rounded-xl border border-[#e8ece9] text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]">
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-[#1a5c4f] text-[15px] font-semibold text-white shadow-sm shadow-[#1a5c4f]/25 transition hover:bg-[#15503f] disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : "تسجيل نشاط"}
          </button>
        </div>
      </aside>
    </>
  );
}
