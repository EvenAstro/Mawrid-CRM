"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
<<<<<<< HEAD
import { todayInput } from "@/lib/format";
=======
import { nowLocalInput } from "@/lib/format";
import { createActivity } from "@/lib/models/activities";
import { triggerClassification } from "@/lib/classifyTrigger";
import { fetchActiveActivityTypes } from "@/lib/models/refData";
import { searchLeadsByName } from "@/lib/models/leads";
import { searchDealsForPalette } from "@/lib/models/deals";
>>>>>>> main

interface ActivityType {
  id: string;
  label: string;
}
interface Hit {
  id: string;
  name: string | null;
}

<<<<<<< HEAD
=======
/**
 * What the activity is about.
 *
 * Until now every activity in the product was written with
 * entity_type = "lead" — all three call sites hardcoded it. Meanwhile the
 * stalled-deal detection, the investigation report and the deal health score
 * all read entity_type = "deal". Imported history had deal-linked rows, so
 * the gap was invisible: the signals worked on seeded data and would have
 * decayed as real usage added lead-only activity.
 */
type TargetType = "lead" | "deal";

>>>>>>> main
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
  const [targetType, setTargetType] = useState<TargetType>("lead");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [typeId, setTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState(nowLocalInput());
  const [saving, setSaving] = useState(false);
  // Default to outbound — this form is framed as the rep recording their own
  // touchpoint ("Record a touchpoint with a contact"); inbound is the explicit choice.
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");

  useEffect(() => {
    if (!open || types.length) return;
    fetchActiveActivityTypes().then(setTypes).catch((err) => console.error("[LogActivity] fetchActiveActivityTypes failed", err));
  }, [open, types.length]);

  // Live search over whichever target type is selected.
  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const q = query.trim();
      if (targetType === "lead") {
        const data = await searchLeadsByName(q);
        if (active) setHits(data.map((l) => ({ id: String(l.id), name: l.full_name })));
      } else {
        const { data, error } = await searchDealsForPalette(`%${q}%`, 8);
        if (error) console.error("[LogActivity] deal search failed", error);
        if (active) {
          setHits(((data as { id: string; name: string | null }[]) ?? []).map((d) => ({ id: String(d.id), name: d.name })));
        }
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, selected, targetType]);

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
    setWhen(nowLocalInput());
    setDirection("outbound");
    setTargetType("lead");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast(targetType === "lead" ? "اختر العميل أولاً" : "اختر الصفقة أولاً", "error");
      return;
    }
    if (!typeId) {
      toast("اختر نوع النشاط", "error");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const trimmedNotes = notes.trim();
    const { error, id: activityId } = await createActivity({
      entityType: targetType,
      entityId: selected.id,
      activityTypeId: typeId,
      body: trimmedNotes || null,
      direction,
      // `when` carries a time, not just a date. The previous version parsed
      // "<date>T00:00:00", so every activity logged here landed at midnight —
      // which loses the ordering of a day's calls against each other and makes
      // every "days silent" figure coarse by up to a day.
      occurredAt: new Date(when).toISOString(),
      userId: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      console.error("[LogActivity] insert failed", error);
      toast("تعذّر تسجيل النشاط — حاول مرة ثانية", "error");
      return;
    }
    toast("تم تسجيل النشاط");

<<<<<<< HEAD
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
=======
    triggerClassification(activityId, trimmedNotes, direction);
>>>>>>> main

    reset();
    onCreated?.();
    onClose();
  }

  const inputCls =
    "h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 t-body text-[var(--content-secondary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-700)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/15";
  const labelCls =
    "mb-1.5 block t-body-sm font-semibold uppercase tracking-wide text-[var(--content-tertiary)]";

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
<<<<<<< HEAD
            <h2 className="text-xl font-bold text-[#1e1b4b]">تسجيل نشاط</h2>
            <p className="mt-0.5 text-[13px] text-[#94a3b8]">Record a touchpoint with a contact</p>
=======
            <h2 className="text-xl font-bold text-[var(--content-primary)]">تسجيل نشاط</h2>
            <p className="mt-0.5 t-body-sm text-[var(--content-tertiary)]">سجّل تواصلاً مع عميل أو على صفقة</p>
>>>>>>> main
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="text-[var(--content-tertiary)] transition hover:text-[var(--content-secondary)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {/* What is this activity about — a person, or a deal? */}
          <div>
            <label className={labelCls}>النشاط يخص *</label>
            <div className="flex gap-2">
              {(["lead", "deal"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTargetType(t);
                    setSelected(null);
                    setQuery("");
                    setHits([]);
                  }}
                  className={`h-11 flex-1 rounded-[var(--radius-md)] border t-body-sm font-semibold transition ${
                    targetType === t
                      ? "border-[var(--brand-teal-700)] bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-700)]"
                      : "border-[var(--border-subtle)] text-[var(--content-secondary)] hover:border-[var(--brand-teal-700)]/40"
                  }`}
                >
                  {t === "lead" ? "عميل" : "صفقة"}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
<<<<<<< HEAD
            <label className={labelCls} htmlFor="la-contact">العميل *</label>
            {selected ? (
              <div className="flex items-center justify-between rounded-xl border border-[#1a5c4f]/30 bg-[#f0faf8] px-3.5 py-2.5">
                <span dir="auto" className="text-[15px] font-medium text-[#1e1b4b]">
                  {selected.full_name || "عميل بدون اسم"}
=======
            <label className={labelCls} htmlFor="la-contact">
              {targetType === "lead" ? "العميل *" : "الصفقة *"}
            </label>
            {selected ? (
              <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--brand-teal-700)]/30 bg-[var(--surface-accent-subtle)] px-3.5 py-2.5">
                <span dir="auto" className="t-body font-medium text-[var(--content-primary)]">
                  {selected.name || (targetType === "lead" ? "عميل بدون اسم" : "صفقة بدون اسم")}
>>>>>>> main
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setQuery("");
                  }}
                  className="t-body-sm font-semibold text-[var(--brand-teal-700)] hover:underline"
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
<<<<<<< HEAD
                placeholder="ابحث عن عميل بالاسم..."
=======
                placeholder={targetType === "lead" ? "ابحث عن عميل بالاسم..." : "ابحث عن صفقة بالاسم..."}
>>>>>>> main
                className={inputCls}
                autoComplete="off"
              />
            )}
            {!selected && hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-lg">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setSelected(h);
                      setHits([]);
                    }}
                    dir="auto"
                    className="block w-full px-3.5 py-2.5 text-left t-body text-[var(--content-secondary)] transition hover:bg-[var(--surface-sunken)]"
                  >
<<<<<<< HEAD
                    {h.full_name || "عميل بدون اسم"}
=======
                    {h.name || (targetType === "lead" ? "عميل بدون اسم" : "صفقة بدون اسم")}
>>>>>>> main
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
                className={`h-11 flex-1 rounded-[var(--radius-md)] border t-body-sm font-semibold transition ${
                  direction === "outbound"
                    ? "border-[var(--brand-teal-700)] bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-700)]"
                    : "border-[var(--border-subtle)] text-[var(--content-secondary)] hover:border-[var(--brand-teal-700)]/40"
                }`}
              >اتصلت بالعميل</button>
              <button
                type="button"
                dir="auto"
                onClick={() => setDirection("inbound")}
                className={`h-11 flex-1 rounded-[var(--radius-md)] border t-body-sm font-semibold transition ${
                  direction === "inbound"
                    ? "border-[var(--brand-teal-700)] bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-700)]"
                    : "border-[var(--border-subtle)] text-[var(--content-secondary)] hover:border-[var(--brand-teal-700)]/40"
                }`}
              >رد العميل</button>
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
<<<<<<< HEAD
            <label className={labelCls} htmlFor="la-date">التاريخ *</label>
            <input id="la-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
=======
            <label className={labelCls} htmlFor="la-date">وقت النشاط *</label>
            <input
              id="la-date"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className={inputCls}
            />
>>>>>>> main
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
<<<<<<< HEAD
              className="w-full rounded-xl border border-[#e8ece9] bg-white px-3.5 py-2.5 text-[15px] text-[#334155] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15"
=======
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5 t-body text-[var(--content-secondary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-700)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/15"
>>>>>>> main
            />
          </div>
        </form>

<<<<<<< HEAD
        <div className="flex gap-3 border-t border-[#e8ece9] p-6">
          <button onClick={onClose} type="button" className="h-11 flex-1 rounded-xl border border-[#e8ece9] text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]">
            إلغاء
          </button>
=======
        <div className="flex gap-3 border-t border-[var(--border-subtle)] p-6">
          <button onClick={onClose} type="button" className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] t-body font-semibold text-[var(--content-secondary)] transition hover:bg-[var(--surface-sunken)]">إلغاء</button>
>>>>>>> main
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-11 flex-1 rounded-[var(--radius-md)] bg-[var(--brand-teal-700)] t-body font-semibold text-white shadow-sm shadow-[var(--brand-teal-700)]/25 transition hover:bg-[var(--brand-teal-800)] disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : "تسجيل نشاط"}
          </button>
        </div>
      </aside>
    </>
  );
}
