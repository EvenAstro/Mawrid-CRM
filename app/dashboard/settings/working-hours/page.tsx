"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWorkingHours, saveWorkingHours, seedWorkingHours, type WorkingHours } from "@/lib/models/calendar";
import { fetchCurrentProfile, fetchProfiles, type Profile } from "@/lib/profiles";
import { canViewAllData } from "@/lib/permissions";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import { useToast } from "@/components/Toast";

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function emptyWeek(userId: string): WorkingHours[] {
  return Array.from({ length: 7 }).map((_, i) => ({
    user_id: userId,
    weekday: i,
    start_time: "",
    end_time: "",
  }));
}

/**
 * إعدادات ساعات العمل — الوكيل يستعمل هذي الساعات لما يقترح مواعيد للعميل.
 *
 * A rep manages their own week; an admin or manager gets a picker and can
 * manage anyone's. That split matches the RLS policy on user_working_hours
 * exactly, so the UI never offers an edit the database will refuse.
 *
 * The seed button matters more than it looks: the migration only gave
 * default hours to sales-role users, so a manager who later becomes the
 * target of an assignment rule has an empty week, and find_available_slots
 * quietly returns nothing for them — the agent then can't offer any demo
 * time at all. One click fixes that.
 */
export default function WorkingHoursPage() {
  const toast = useToast();
  const [me, setMe] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [rows, setRows] = useState<WorkingHours[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (userId: string) => {
    setRows(null);
    const wh = await fetchWorkingHours(userId);
    const byDay = new Map(wh.map((r) => [r.weekday, r]));
    setRows(emptyWeek(userId).map((blank) => byDay.get(blank.weekday) ?? blank));
  }, []);

  useEffect(() => {
    (async () => {
      const [p, all] = await Promise.all([fetchCurrentProfile(), fetchProfiles()]);
      setMe(p);
      setUsers(all);
      if (p) {
        setTargetId(p.id);
        load(p.id);
      }
    })();
  }, [load]);

  const isAdmin = me ? canViewAllData(me.role) : false;
  const target = users.find((u) => u.id === targetId) ?? me;
  const editingSelf = targetId === me?.id;

  function switchUser(id: string) {
    setTargetId(id);
    load(id);
  }

  function update(weekday: number, patch: Partial<WorkingHours>) {
    setRows((prev) => prev?.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)) ?? null);
  }

  function applyToWeekdays() {
    // Copies whatever Sunday has across Sunday–Thursday, the Saudi work
    // week. Faster than typing the same window five times, which is what
    // almost every setup actually is.
    setRows((prev) => {
      if (!prev) return prev;
      const sunday = prev.find((r) => r.weekday === 0);
      if (!sunday?.start_time || !sunday?.end_time) {
        toast("عبّي وقت الأحد أول", "error");
        return prev;
      }
      return prev.map((r) =>
        r.weekday >= 1 && r.weekday <= 4
          ? { ...r, start_time: sunday.start_time, end_time: sunday.end_time }
          : r,
      );
    });
  }

  async function seedDefaults() {
    if (!targetId) return;
    const { error } = await seedWorkingHours(targetId);
    if (error) toast("تعذّر التطبيق", "error");
    else {
      toast("طُبّق الدوام الافتراضي");
      load(targetId);
    }
  }

  async function save() {
    if (!targetId || !rows) return;
    const invalid = rows.some((r) => r.start_time && r.end_time && r.start_time >= r.end_time);
    if (invalid) {
      toast("فيه يوم وقت بدايته بعد نهايته", "error");
      return;
    }
    // Only days with a complete window are persisted — an empty pair means
    // "off that day", and the absence of a row is how the slot finder
    // reads a day off.
    const valid = rows.filter((r) => r.start_time && r.end_time);
    setSaving(true);
    const { error } = await saveWorkingHours(targetId, valid);
    setSaving(false);
    if (error) toast("تعذر الحفظ — تحقق من صلاحيتك", "error");
    else toast("تم الحفظ");
  }

  const targetName = target ? target.full_name || target.first_name || target.email : "";

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <header>
        <h1 className="t-title-1 text-[color:var(--content-primary)]">ساعات العمل</h1>
        <p className="t-body-sm mt-1 text-[color:var(--content-tertiary)]">
          الوكيل يعرض للعملاء مواعيد داخل هذي الساعات فقط. اترك اليوم فارغ إذا ما فيه دوام.
        </p>
      </header>

      {isAdmin && (
        <Panel className="flex flex-wrap items-center gap-3 p-4">
          <span className="t-caption font-bold text-[color:var(--content-tertiary)]">الموظف</span>
          <select
            value={targetId ?? ""}
            onChange={(e) => switchUser(e.target.value)}
            className="t-body-sm min-w-[220px] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[color:var(--content-primary)]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.first_name || u.email} — {u.role}
                {u.id === me?.id ? " (أنت)" : ""}
              </option>
            ))}
          </select>
          {!editingSelf && (
            <span className="t-caption rounded-[var(--radius-sm)] bg-[var(--surface-accent-subtle)] px-2.5 py-1 text-[color:var(--content-accent)]">
              تعدّل دوام {targetName}
            </span>
          )}
        </Panel>
      )}

      <LedgerSection
        label="الأيام"
        meta={rows ? `${rows.filter((r) => r.start_time && r.end_time).length} أيام دوام` : undefined}
      >
        <Panel className="overflow-hidden">
          {rows === null ? (
            <p className="t-body-sm p-5 text-center text-[color:var(--content-tertiary)]">جارٍ التحميل…</p>
          ) : (
            <ul>
              {rows.map((r) => {
                const off = !r.start_time || !r.end_time;
                const bad = !!r.start_time && !!r.end_time && r.start_time >= r.end_time;
                return (
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
                    {bad && (
                      <span className="t-micro text-[color:var(--status-danger-fg)]">
                        وقت البداية لازم يكون قبل النهاية
                      </span>
                    )}
                    {off && <span className="t-micro text-[color:var(--content-tertiary)]">إجازة</span>}
                    {!off && !bad && (
                      <button
                        onClick={() => update(r.weekday, { start_time: "", end_time: "" })}
                        className="t-micro ms-auto text-[color:var(--content-tertiary)] hover:text-[color:var(--status-danger-fg)]"
                      >
                        اجعله إجازة
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </LedgerSection>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={applyToWeekdays} disabled={!rows} className={secondaryBtn}>
            انسخ وقت الأحد على أيام الأسبوع
          </button>
          <button onClick={seedDefaults} disabled={!targetId} className={secondaryBtn}>
            طبّق الدوام الافتراضي (أحد–خميس ٩–٥)
          </button>
        </div>
        <button
          onClick={save}
          disabled={saving || !rows}
          className="t-caption rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-5 py-2 font-bold text-[color:var(--content-on-accent)] disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ…" : editingSelf ? "حفظ" : `حفظ دوام ${targetName}`}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "t-caption rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 py-1 text-[color:var(--content-primary)]";
const secondaryBtn =
  "t-caption rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 py-2 text-[color:var(--content-primary)] hover:bg-[var(--surface-sunken)] disabled:opacity-50";
