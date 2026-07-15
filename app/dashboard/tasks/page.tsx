"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Task {
  id: string;
  title: string | null;
  description: string | null;
  due_at: string | null;
  entity_type: string | null;
  task_types: { label: string; color: string | null } | null;
}

function timeOf(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tasks")
        .select("*, task_types(label, color)")
        .is("completed_at", null)
        .order("due_at", { ascending: true })
        .limit(100);
      if (data) setTasks(data as unknown as Task[]);
      setLoading(false);
    }
    load();
  }, []);

  const today = startOfDay(new Date());
  const groups = useMemo(() => {
    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const upcoming: Task[] = [];
    tasks.forEach((t) => {
      if (!t.due_at) {
        upcoming.push(t);
        return;
      }
      const due = startOfDay(new Date(t.due_at));
      if (due.getTime() < today.getTime()) overdue.push(t);
      else if (due.getTime() === today.getTime()) todayTasks.push(t);
      else upcoming.push(t);
    });
    return { overdue, todayTasks, upcoming };
  }, [tasks, today]);

  // Days in current month that have tasks
  const taskDays = useMemo(() => {
    const set = new Set<number>();
    tasks.forEach((t) => {
      if (!t.due_at) return;
      const d = new Date(t.due_at);
      if (d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth())
        set.add(d.getDate());
    });
    return set;
  }, [tasks, month]);

  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isCurrentMonth =
    month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  function TaskCard({ t }: { t: Task }) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-4 w-4 flex-none rounded-full border-2 border-[#1a5c4f]/40" />
          <div className="min-w-0 flex-1">
            <p dir="auto" className="text-[15px] font-medium text-[#1e1b4b]">{t.title || "Untitled task"}</p>
            {t.description && <p dir="auto" className="mt-0.5 line-clamp-2 text-[13px] text-[#6b7280]">{t.description}</p>}
            <div className="mt-1.5 flex items-center gap-2">
              {t.task_types?.label && (
                <span className="rounded-full bg-[#f0faf8] px-2 py-0.5 text-[11px] font-semibold text-[#1a5c4f]">
                  {t.task_types.label}
                </span>
              )}
              {t.due_at && <span className="text-[12px] text-[#9ca3af]">{timeOf(t.due_at)}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-[#1e1b4b]">Tasks</h1>
          <p className="text-[15px] text-[#6b7280]">
            {loading ? "Loading…" : `${tasks.length} open tasks`}
          </p>
        </div>
        <button className="rounded-lg bg-[#1a5c4f] px-4 py-2 text-[15px] font-semibold text-white transition hover:bg-[#15503f]">
          Filter
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Task list */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-[#f1f5f9]" />
            ))
          ) : (
            <>
              {groups.overdue.length > 0 && (
                <section>
                  <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-red-700">
                    Overdue · {groups.overdue.length}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {groups.overdue.map((t) => <TaskCard key={t.id} t={t} />)}
                  </div>
                </section>
              )}
              <section>
                <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#1a5c4f]">
                  Today · {groups.todayTasks.length}
                </h2>
                {groups.todayTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#e5e7eb] py-5 text-center text-[15px] text-[#9ca3af]">
                    Nothing due today 🎉
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {groups.todayTasks.map((t) => <TaskCard key={t.id} t={t} />)}
                  </div>
                )}
              </section>
              {groups.upcoming.length > 0 && (
                <section>
                  <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                    Upcoming · {groups.upcoming.length}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {groups.upcoming.map((t) => <TaskCard key={t.id} t={t} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Calendar */}
        <div className="h-fit rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#1e1b4b]">
              {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="rounded px-2 py-0.5 text-[15px] text-[#6b7280] transition hover:bg-[#f8fafc]"
              >
                ‹
              </button>
              <button
                onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="rounded-lg bg-[#1a5c4f] px-2.5 py-0.5 text-[13px] font-semibold text-white transition hover:bg-[#15503f]"
              >
                Today
              </button>
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="rounded px-2 py-0.5 text-[15px] text-[#6b7280] transition hover:bg-[#f8fafc]"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-[#9ca3af]">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = isCurrentMonth && day === today.getDate();
              const hasTasks = taskDays.has(day);
              return (
                <div
                  key={day}
                  className={`flex h-8 flex-col items-center justify-center rounded-lg text-[13px] ${
                    isToday
                      ? "bg-[#1a5c4f] font-bold text-white"
                      : hasTasks
                        ? "font-semibold text-[#1a5c4f] hover:bg-[#f0faf8]"
                        : "text-[#6b7280] hover:bg-[#f8fafc]"
                  }`}
                >
                  {day}
                  {hasTasks && !isToday && <span className="h-1 w-1 rounded-full bg-[#1a5c4f]" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
