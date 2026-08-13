"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWorkingHours, saveWorkingHours, type WorkingHours } from "@/lib/models/calendar";
import { fetchCurrentProfile, type Profile } from "@/lib/profiles";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import { useToast } from "@/components/Toast";

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/**
 * إعدادات ساعات العمل — الوكيل يستعمل هذي الساعات لما يقترح مواعيد للعميل.
 *
 * Each rep manages their own hours; a manager could impersonate through
 * the RLS policy but the UI stays first-person on purpose — nobody wants
 * their availability set for them without knowing. Saudi work week
 * defaults (Sun-Thu, 9-5) come from the migration seed, so a rep who
 * never touches this page still has sensible hours.
 */
export default function WorkingHoursPage() {
  const toast = useToast();
  const [me, setMe] = useState<Profile | null>(null);
  const [rows, setRows] = useState<WorkingHours[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (userId: string) => {
    const wh = await fetchWorkingHours(userId);
    // Fill in every weekday so the toggle UI has all seven, even for
    // days the rep never enabled.
    const byDay = new Map(wh.map((r) => [r.weekday, r]));
    setRows(
      Array.from({ length: 7 }).map((_, i) => byDay.get(i) ?? { user_id: userId, weekday: i, start_time: "", end_time: "" }),
    );
  }, []);

  useEffect(() => {
    fetchCurrentProfile().then((p) => {
      setMe(p);
      if (p) load(p.id);
    });
  }, [load]);

  function update(weekday: number, patch: Partial<WorkingHours>) {
    setRows((prev) => prev?.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)) ?? null);
  }

  async function save() {
    if (!me || !rows) return;
    // Persist only the days that carry a full window — an empty pair
    // means "off that day", and RLS ensures the rep can only write their
    // own rows.
    const valid = rows.filter((r) => r.start_time && r.end_time && r.start_time < r.end_time);
    setSaving(true);
    const { error } = await saveWorkingHours(me.id, valid);
    setSaving(false);
    if (error) toast("تعذر الحفظ", "error");
    else toast("تم الحفظ");
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <header>
        <h1 className="t-title-1 text-[color:var(--content-primary)]">ساعات العمل</h1>
        <p className="t-body-sm mt-1 text-[color:var(--content-tertiary)]">
          الوكيل يعرض للعملاء مواعيد داخل هذي الساعات فقط. اترك اليوم فارغ إذا ما تشتغل فيه.
        </p>
      </header>

      <LedgerSection label="الأيام">
        <Panel className="overflow-hidden">
          {rows === null ? (
            <p className="t-body-sm p-5 text-center text-[color:var(--content-tertiary)]">جارٍ التحميل…</p>
          ) : (
            <ul>
              {rows.map((r) => (
                <li
                  key={r.weekday}
                  className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-0"
                >
                  <span className="t-body min-w-[80px] font-semibold text-[color:var(--content-primary)]">
                    {WEEKDAYS_AR[r.weekday]}
                  </span>
                  <label className="t-caption flex items-center gap-2 text-[color:var(--content-secondary)]">
                    من
                    <input
                      type="time"
                      value={r.start_time}
                      onChange={(e) => update(r.weekday, { start_time: e.target.value })}
                      className={inputCls}
                    />
                  </label>
                  <label className="t-caption flex items-center gap-2 text-[color:var(--content-secondary)]">
                    إلى
                    <input
                      type="time"
                      value={r.end_time}
                      onChange={(e) => update(r.weekday, { end_time: e.target.value })}
                      className={inputCls}
                    />
                  </label>
                  {r.start_time && r.end_time && r.start_time >= r.end_time && (
                    <span className="t-micro text-[color:var(--status-danger-fg)]">وقت البداية لازم يكون قبل النهاية</span>
                  )}
                  {(!r.start_time || !r.end_time) && (
                    <span className="t-micro text-[color:var(--content-tertiary)]">إجازة</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </LedgerSection>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || !rows}
          className="t-caption rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-5 py-2 font-bold text-[color:var(--content-on-accent)] disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "t-caption rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 py-1 text-[color:var(--content-primary)]";
