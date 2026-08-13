"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchScheduledTasksClient } from "@/lib/models/calendar";
import { fetchCurrentProfile, fetchProfiles, type Profile } from "@/lib/profiles";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import { canViewAllData } from "@/lib/permissions";

interface ScheduledTask {
  id: string;
  title: string | null;
  due_at: string;
  completed_at: string | null;
  lead_id: string | null;
  task_types: { label: string; color: string | null } | null;
}

/**
 * تقويم أسبوعي — الأسبوع كامل بتقسيم لكل يوم، مع مهام كل مندوب المرتبطة بتوقيت.
 *
 * The whole point of showing this is to give the WhatsApp agent's
 * schedule_demo picks a visible home: a demo booked from a chat lands as
 * a task with a due_at, and that task shows up here in the same slot
 * find_available_slots said was free. A manager sees anyone; a sales rep
 * sees themselves. Days without any bookings are still rendered so the
 * calendar reads as a week, not a filtered list.
 */

const WEEKDAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function CalendarPage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => sundayOf(new Date()));
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null);

  useEffect(() => {
    fetchCurrentProfile().then((p) => {
      setMe(p);
      setSelectedUser(p?.id ?? null);
    });
    fetchProfiles().then(setUsers);
  }, []);

  const load = useCallback(async () => {
    if (!selectedUser) return;
    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await fetchScheduledTasksClient({ userId: selectedUser, from, to });
    if (error) console.error("[calendar] tasks failed", error);
    else setTasks((data as unknown as ScheduledTask[]) ?? []);
  }, [selectedUser, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        date: d,
        weekday: WEEKDAY_NAMES_AR[d.getDay()],
        label: d.toLocaleDateString("ar-SA", { day: "numeric", month: "long", timeZone: "Asia/Riyadh" }),
        items: (tasks ?? []).filter((t) => sameDay(new Date(t.due_at), d)),
      };
    });
  }, [tasks, weekStart]);

  const canPickUser = me ? canViewAllData(me.role) : false;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="t-title-1 text-[color:var(--content-primary)]">التقويم</h1>
          <p className="t-body-sm mt-1 text-[color:var(--content-tertiary)]">
            المواعيد اللي حجزها الوكيل من واتساب تظهر هنا مباشرة مع باقي مهامك المجدولة.
          </p>
        </div>
        <Link
          href="/dashboard/settings/working-hours"
          className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 py-1.5 text-[color:var(--content-primary)]"
        >
          ⚙️ ساعات العمل
        </Link>
      </header>

      <Panel className="flex flex-wrap items-center gap-3 p-3">
        <button onClick={() => setWeekStart((w) => new Date(w.getTime() - 7 * 86400_000))} className={navBtn}>
          ← الأسبوع السابق
        </button>
        <span className="t-body-sm px-2 font-semibold text-[color:var(--content-primary)]">
          {weekStart.toLocaleDateString("ar-SA", { day: "numeric", month: "long", timeZone: "Asia/Riyadh" })} —{" "}
          {new Date(weekStart.getTime() + 6 * 86400_000).toLocaleDateString("ar-SA", {
            day: "numeric",
            month: "long",
            timeZone: "Asia/Riyadh",
          })}
        </span>
        <button onClick={() => setWeekStart((w) => new Date(w.getTime() + 7 * 86400_000))} className={navBtn}>
          الأسبوع التالي →
        </button>
        <button onClick={() => setWeekStart(sundayOf(new Date()))} className={navBtn}>
          هذا الأسبوع
        </button>
        {canPickUser && (
          <select
            value={selectedUser ?? ""}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="t-caption ms-auto rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-1.5"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.first_name || u.email}
              </option>
            ))}
          </select>
        )}
      </Panel>

      <LedgerSection label="الأسبوع" meta={tasks ? `${tasks.length} موعد` : undefined}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((d) => (
            <Panel key={d.date.toISOString()} className={`p-3 ${isToday(d.date) ? "ring-2 ring-[var(--border-accent)]" : ""}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="t-caption font-bold text-[color:var(--content-primary)]">{d.weekday}</span>
                <span className="t-micro tabular-nums text-[color:var(--content-tertiary)]">{d.label}</span>
              </div>
              {d.items.length === 0 ? (
                <p className="t-micro text-[color:var(--content-tertiary)]">—</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {d.items.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-[var(--radius-sm)] bg-[var(--surface-accent-subtle)] px-2 py-1.5"
                    >
                      <p className="t-caption font-semibold text-[color:var(--content-primary)]">
                        {new Date(t.due_at).toLocaleTimeString("ar-SA", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "Asia/Riyadh",
                        })}
                      </p>
                      <p className="t-micro text-[color:var(--content-secondary)]">
                        {t.title ?? "مهمة"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      </LedgerSection>
    </div>
  );
}

const navBtn =
  "t-caption rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 py-1.5 text-[color:var(--content-primary)] hover:bg-[var(--surface-sunken)]";

function sundayOf(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}
