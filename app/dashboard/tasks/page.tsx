"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { formatTime } from "@/lib/format";
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Textarea, Select } from "@/components/ui/Field";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import { fetchProfiles, type Profile } from "@/lib/profiles";
import { useRole } from "@/components/RoleProvider";
import { canViewAllData } from "@/lib/permissions";

interface Task {
  id: string;
  title: string | null;
  description: string | null;
  due_at: string | null;
  entity_type: string | null;
  completion_note: string | null;
  assignee_id: string | null;
  task_types: { label: string; color: string | null } | null;
}
interface TaskType {
  id: string;
  label: string;
}

function profileName(p: Profile | undefined): string {
  if (!p) return "";
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || "";
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function TasksPage() {
  const toast = useToast();
  const { role, userId, loading: roleLoading } = useRole();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Task | null>(null);
  const [editingDetail, setEditingDetail] = useState(false);
  const [editDraft, setEditDraft] = useState({ title: "", due: "", time: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);

  const [nt, setNt] = useState({ title: "", description: "", due: "", time: "09:00", typeId: "", assigneeId: "" });
  const [saving, setSaving] = useState(false);
  const [ntErr, setNtErr] = useState("");

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const load = useCallback(async () => {
    let tasksQuery = supabase.from("tasks").select("*, task_types(label, color)").is("completed_at", null).order("due_at", { ascending: true }).limit(200);
    // Sales reps only see tasks assigned to them; managers/admins see all.
    if (!canViewAllData(role) && userId) {
      tasksQuery = tasksQuery.eq("assignee_id", userId);
    }
    const [tk, tt, pf] = await Promise.all([
      tasksQuery,
      supabase.from("task_types").select("id, label"),
      fetchProfiles(),
    ]);
    if (tk.data) setTasks(tk.data as unknown as Task[]);
    if (tt.data) setTypes(tt.data as TaskType[]);
    setProfiles(pf);
    setLoading(false);
  }, [role, userId]);
  useEffect(() => {
    if (roleLoading) return;
    load();
  }, [roleLoading, load]);

  const today = startOfDay(new Date());

  const visible = useMemo(() => {
    if (!dayFilter) return tasks;
    return tasks.filter((t) => t.due_at && new Date(t.due_at).toISOString().slice(0, 10) === dayFilter);
  }, [tasks, dayFilter]);

  const groups = useMemo(() => {
    const overdue: Task[] = [], todayT: Task[] = [], week: Task[] = [], upcoming: Task[] = [];
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    visible.forEach((t) => {
      if (!t.due_at) { upcoming.push(t); return; }
      const due = startOfDay(new Date(t.due_at));
      if (due < today) overdue.push(t);
      else if (due.getTime() === today.getTime()) todayT.push(t);
      else if (due <= weekEnd) week.push(t);
      else upcoming.push(t);
    });
    return { overdue, todayT, week, upcoming };
  }, [visible, today]);

  const taskDays = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => { if (t.due_at) set.add(new Date(t.due_at).toISOString().slice(0, 10)); });
    return set;
  }, [tasks]);

  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  const complete = useCallback(async (t: Task, note: string) => {
    if (completing.has(t.id)) return;
    setCompleting((p) => new Set(p).add(t.id));
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString(), completion_note: note })
      .eq("id", t.id);
    if (error) {
      console.error("[Tasks] complete failed", error);
      toast("تعذّر تحديث المهمة", "error");
      setCompleting((p) => { const n = new Set(p); n.delete(t.id); return n; });
      return;
    }
    setCompleteTarget(null);
    setDetail(null);
    toast("تم إنهاء المهمة");
    setTimeout(() => {
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      setCompleting((p) => { const n = new Set(p); n.delete(t.id); return n; });
    }, 800);
  }, [completing, toast]);

  async function createTask() {
    if (!nt.title.trim()) { setNtErr("Title is required"); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const dueAt = nt.due ? new Date(`${nt.due}T${nt.time || "09:00"}:00`).toISOString() : null;
    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      title: nt.title.trim(),
      description: nt.description.trim() || null,
      due_at: dueAt,
      task_type_id: nt.typeId || null,
      assignee_id: nt.assigneeId || null,
      created_at: now,
      updated_at: now,
    });
    setSaving(false);
    if (error) {
      console.error("[Tasks] create failed", error);
      toast("Could not create task", "error");
      return;
    }
    toast("Task created");
    setNt({ title: "", description: "", due: "", time: "09:00", typeId: "", assigneeId: "" });
    setNtErr("");
    setNewOpen(false);
    load();
  }

  function openDetail(t: Task) {
    setDetail(t);
    setEditingDetail(false);
    const d = t.due_at ? new Date(t.due_at) : null;
    setEditDraft({
      title: t.title || "",
      due: d ? d.toISOString().slice(0, 10) : "",
      time: d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "09:00",
    });
  }

  async function saveEdit() {
    if (!detail) return;
    if (!editDraft.title.trim()) { toast("العنوان مطلوب", "error"); return; }
    setSavingEdit(true);
    const dueAt = editDraft.due ? new Date(`${editDraft.due}T${editDraft.time || "09:00"}:00`).toISOString() : null;
    const { error } = await supabase
      .from("tasks")
      .update({ title: editDraft.title.trim(), due_at: dueAt, updated_at: new Date().toISOString() })
      .eq("id", detail.id);
    setSavingEdit(false);
    if (error) {
      console.error("[Tasks] edit failed", error);
      toast("تعذّر حفظ التعديل", "error");
      return;
    }
    toast("تم حفظ التعديل");
    setDetail((prev) => (prev ? { ...prev, title: editDraft.title.trim(), due_at: dueAt } : prev));
    setEditingDetail(false);
    load();
  }

  function TaskRow({ t, tone }: { t: Task; tone: string }) {
    const done = completing.has(t.id);
    const assignee = t.assignee_id ? profileMap.get(t.assignee_id) : undefined;
    return (
      <div className={`flex items-start gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm transition-all ${done ? "opacity-40" : "hover:shadow-md"}`}>
        <button onClick={() => setCompleteTarget(t)} aria-label="Complete task" className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors ${done ? "border-primary bg-primary text-white" : `${tone} hover:border-primary`}`}>
          {done && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M20 6 9 17l-5-5" /></svg>}
        </button>
        <button onClick={() => openDetail(t)} className="min-w-0 flex-1 text-left">
          <p dir="auto" className={`text-[15px] font-medium text-ink ${done ? "line-through" : ""}`}>{t.title || "Untitled task"}</p>
          {t.description && <p dir="auto" className="mt-0.5 line-clamp-1 text-[13px] text-muted">{t.description}</p>}
          <div className="mt-1.5 flex items-center gap-2">
            {t.task_types?.label && <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-primary">{t.task_types.label}</span>}
            {t.due_at && <span className="text-[12px] text-muted">{formatTime(t.due_at)}</span>}
            {assignee && <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-ink-secondary">{profileName(assignee)}</span>}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 dir="auto" className="text-2xl font-extrabold text-ink">المهام</h1>
          <p className="mt-1 text-[15px] text-muted">{loading ? "جارِ التحميل…" : `${tasks.length} مهمة مفتوحة`}</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>+ New Task</Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* List */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          {dayFilter && (
            <button onClick={() => setDayFilter(null)} className="self-start rounded-full bg-mint px-3 py-1 text-[13px] font-semibold text-primary">Showing {dayFilter} · clear ✕</button>
          )}
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
          ) : (
            <>
              {groups.overdue.length > 0 && (
                <section>
                  <h2 className="mb-3 inline-block rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider bg-red-50 text-red-500">Overdue · {groups.overdue.length}</h2>
                  <div className="flex flex-col gap-2">{groups.overdue.map((t) => <TaskRow key={t.id} t={t} tone="border-red-300" />)}</div>
                </section>
              )}
              <section>
                <h2 className="mb-3 inline-block rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700">Today · {groups.todayT.length}</h2>
                {groups.todayT.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border-light py-5 text-center text-[15px] text-muted">🎉 All clear for today!</p>
                ) : (
                  <div className="flex flex-col gap-2">{groups.todayT.map((t) => <TaskRow key={t.id} t={t} tone="border-primary/40" />)}</div>
                )}
              </section>
              {groups.week.length > 0 && (
                <section>
                  <h2 className="mb-3 inline-block rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider bg-gray-50 text-gray-600">This Week · {groups.week.length}</h2>
                  <div className="flex flex-col gap-2">{groups.week.map((t) => <TaskRow key={t.id} t={t} tone="border-border-light" />)}</div>
                </section>
              )}
              {groups.upcoming.length > 0 && (
                <section>
                  <h2 className="mb-3 inline-block rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider bg-gray-50 text-gray-500">Upcoming · {groups.upcoming.length}</h2>
                  <div className="flex flex-col gap-2">{groups.upcoming.map((t) => <TaskRow key={t.id} t={t} tone="border-border-light" />)}</div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Calendar */}
        <div className="h-fit rounded-2xl border border-border-light bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-ink">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <div className="flex gap-1">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded px-2 py-0.5 text-[15px] text-ink-secondary transition hover:bg-mint">‹</button>
              <button onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setDayFilter(null); }} className="rounded-lg bg-primary px-2.5 py-0.5 text-[13px] font-semibold text-white transition hover:bg-primary-dark">Today</button>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded px-2 py-0.5 text-[15px] text-ink-secondary transition hover:bg-mint">›</button>
            </div>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = isCurrentMonth && day === today.getDate();
              const hasTasks = taskDays.has(dateStr);
              const isSel = dayFilter === dateStr;
              return (
                <button key={day} onClick={() => setDayFilter(isSel ? null : dateStr)} className={`flex h-9 flex-col items-center justify-center rounded-lg text-[13px] transition ${isSel ? "bg-primary text-white" : isToday ? "bg-primary/10 font-bold text-primary" : hasTasks ? "font-semibold text-primary hover:bg-mint" : "text-ink-secondary hover:bg-gray-25"}`}>
                  {day}
                  {hasTasks && !isSel && !isToday && <span className="h-1 w-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* New task */}
      <SlideOver open={newOpen} onClose={() => setNewOpen(false)} title="New Task" subtitle="Add a follow-up"
        footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={() => setNewOpen(false)}>Cancel</Button><Button fullWidth loading={saving} onClick={createTask}>Create Task</Button></div>}>
        <div className="flex flex-col gap-5">
          <Input id="tk-title" label="Title *" dir="auto" value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} placeholder="e.g. Follow up with Al-Faihan" error={ntErr} autoFocus />
          <Textarea id="tk-desc" label="Description" dir="auto" value={nt.description} onChange={(e) => setNt({ ...nt, description: e.target.value })} placeholder="Details…" />
          <div className="grid grid-cols-2 gap-4">
            <Input id="tk-due" label="Due Date" type="date" value={nt.due} onChange={(e) => setNt({ ...nt, due: e.target.value })} />
            <Input id="tk-time" label="Time" type="time" value={nt.time} onChange={(e) => setNt({ ...nt, time: e.target.value })} />
          </div>
          <Select id="tk-type" label="Type" value={nt.typeId} onChange={(e) => setNt({ ...nt, typeId: e.target.value })}>
            <option value="">No type</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <Select id="tk-assignee" label="Assigned To" value={nt.assigneeId} onChange={(e) => setNt({ ...nt, assigneeId: e.target.value })}>
            <option value="">Unassigned</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{profileName(p)}</option>)}
          </Select>
        </div>
      </SlideOver>

      {/* Task detail */}
      <SlideOver
        open={!!detail}
        onClose={() => setDetail(null)}
        title={editingDetail ? "تعديل المهمة" : detail?.title || "Task"}
        subtitle={detail?.task_types?.label ?? undefined}
        footer={
          detail && (
            <div className="flex gap-3">
              {editingDetail ? (
                <>
                  <Button variant="secondary" fullWidth onClick={() => setEditingDetail(false)}>إلغاء</Button>
                  <Button fullWidth loading={savingEdit} onClick={saveEdit}>حفظ التعديل</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" fullWidth onClick={() => setEditingDetail(true)}>✏️ تعديل</Button>
                  <Button fullWidth onClick={() => setCompleteTarget(detail)}>Mark Complete</Button>
                </>
              )}
            </div>
          )
        }
      >
        {detail && (
          <div className="flex flex-col gap-5">
            {editingDetail ? (
              <>
                <Input id="tk-edit-title" label="العنوان" dir="auto" value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} autoFocus />
                <div className="grid grid-cols-2 gap-4">
                  <Input id="tk-edit-due" label="تاريخ الاستحقاق" type="date" value={editDraft.due} onChange={(e) => setEditDraft({ ...editDraft, due: e.target.value })} />
                  <Input id="tk-edit-time" label="الوقت" type="time" value={editDraft.time} onChange={(e) => setEditDraft({ ...editDraft, time: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Description</p>
                  <p dir="auto" className="mt-1 text-[15px] text-ink-secondary">{detail.description || "—"}</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Due</p>
                  <p className="mt-1 text-[15px] text-ink">{detail.due_at ? new Date(detail.due_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">المسؤول</p>
                  <p className="mt-1 text-[15px] text-ink">{detail.assignee_id ? profileName(profileMap.get(detail.assignee_id)) || "—" : "—"}</p>
                </div>
                {detail.completion_note && (
                  <div>
                    <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">ملاحظة الإنجاز</p>
                    <p dir="auto" className="mt-1 text-[15px] text-ink-secondary">{detail.completion_note}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </SlideOver>

      <CompleteTaskModal
        open={!!completeTarget}
        taskTitle={completeTarget?.title ?? null}
        onClose={() => setCompleteTarget(null)}
        onConfirm={(note) => { if (completeTarget) return complete(completeTarget, note); }}
      />
    </div>
  );
}
