"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { formatTime, formatDateTime, profileName, downloadCSV } from "@/lib/format";
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Textarea, Select } from "@/components/ui/Field";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import { fetchProfiles, type Profile } from "@/lib/profiles";
import { useRole } from "@/components/RoleProvider";
import { canActOnTask } from "@/lib/permissions";
import { fetchTasksPage, completeTask, createTask as createTaskRow, editTask, type Task, type TaskType } from "@/lib/models/tasks";
import { CalendarIcon, ChatBubbleIcon, ClipboardIcon, MailIcon, MonitorIcon, PhoneIcon } from "@/components/icons";


function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const TASK_TYPE_STYLE: Record<string, { c: string; g: React.ReactNode }> = {
  call: { c: "var(--brand-teal-700)", g: <PhoneIcon className="h-4 w-4" /> },
  whatsapp: { c: "var(--brand-green-500)", g: <ChatBubbleIcon className="h-4 w-4" /> },
  email: { c: "var(--content-accent)", g: <MailIcon className="h-4 w-4" /> },
  meeting: { c: "var(--brand-amber-500)", g: <CalendarIcon className="h-4 w-4" /> },
  demo: { c: "var(--content-accent)", g: <MonitorIcon className="h-4 w-4" /> },
};
function taskTypeStyle(label?: string | null) {
  const l = (label || "").toLowerCase();
  for (const key in TASK_TYPE_STYLE) if (l.includes(key)) return TASK_TYPE_STYLE[key];
  return { c: "var(--brand-teal-700)", g: <ClipboardIcon className="h-4 w-4" /> };
}
const AVATAR_GRADIENTS = [
  "from-[var(--brand-teal-700)] to-[var(--brand-teal-900)]",
  "from-[var(--brand-indigo-500)] to-[var(--status-info-fg)]",
  "from-[var(--brand-amber-500)] to-[var(--status-warning-fg)]",
  "from-[var(--content-accent)] to-[var(--content-accent)]",
  "from-[var(--content-accent)] to-[var(--content-accent)]",
];
function hashColorIndex(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % AVATAR_GRADIENTS.length;
}

const PAGE = 200;

export default function TasksPage() {
  const toast = useToast();
  const { role, userId, loading: roleLoading } = useRole();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
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
    // Everyone only sees tasks assigned to them, regardless of role.
    const [{ tasks, total, types }, pf] = await Promise.all([fetchTasksPage(userId, limit), fetchProfiles()]);
    setTasks(tasks);
    setTotal(total);
    setTypes(types);
    setProfiles(pf);
    setLoading(false);
  }, [userId, limit]);
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
    const { error } = await completeTask(t.id, note);
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
    if (!nt.title.trim()) { setNtErr("العنوان مطلوب"); return; }
    setSaving(true);
    const dueAt = nt.due ? new Date(`${nt.due}T${nt.time || "09:00"}:00`).toISOString() : null;
    const { error } = await createTaskRow({
      title: nt.title.trim(),
      description: nt.description.trim() || null,
      dueAt,
      taskTypeId: nt.typeId || null,
      assigneeId: nt.assigneeId || null,
    });
    setSaving(false);
    if (error) {
      console.error("[Tasks] create failed", error);
      toast("تعذّر إنشاء المهمة", "error");
      return;
    }
    toast("تم إنشاء المهمة");
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
    const { error } = await editTask(detail.id, editDraft.title.trim(), dueAt);
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
    const assignee = t.assignee_uid ? profileMap.get(t.assignee_uid) : undefined;
    const canAct = canActOnTask(role, userId, t.assignee_uid);
    const ty = taskTypeStyle(t.task_types?.label);
    const avatarGrad = AVATAR_GRADIENTS[hashColorIndex(assignee ? profileName(assignee) : t.id)];
    return (
      <div className={`group relative flex items-start gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-compact)] e-1 transition-all ${done ? "opacity-40" : "hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(26,92,79,0.1)]"}`}>
        <span className="absolute inset-y-0 right-0 w-1" style={{ backgroundColor: ty.c, opacity: done ? 0.3 : 0.8 }} />

        {canAct ? (
          <button onClick={() => setCompleteTarget(t)} aria-label="Complete task" className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors ${done ? "border-[var(--brand-teal-700)] bg-[var(--brand-teal-700)] text-white" : `${tone} hover:border-[var(--brand-teal-700)]`}`}>
            {done && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M20 6 9 17l-5-5" /></svg>}
          </button>
        ) : (
          <span title="بس المسؤول عن المهمة يقدر ينهيها" className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-[var(--border-default)] opacity-50 ${tone}`} />
        )}

        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-md)] text-sm" style={{ backgroundColor: `${ty.c}17`, color: ty.c }}>{ty.g}</span>

        <button onClick={() => openDetail(t)} className="min-w-0 flex-1 text-left">
          <p dir="auto" className={`t-body font-semibold text-ink ${done ? "line-through" : ""}`}>{t.title || "مهمة بدون عنوان"}</p>
          {t.description && <p dir="auto" className="mt-0.5 line-clamp-1 t-body-sm text-muted">{t.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {t.task_types?.label && <span className="rounded-full px-2 py-0.5 t-micro font-semibold" style={{ backgroundColor: `${ty.c}17`, color: ty.c }}>{t.task_types.label}</span>}
            {t.due_at && (
              <span className="flex items-center gap-1 t-caption text-muted">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-3 w-3"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 1.5" strokeLinecap="round" /></svg>
                {formatTime(t.due_at)}
              </span>
            )}
            {assignee && (
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] py-0.5 pl-2 pr-0.5 t-micro font-medium text-ink-secondary">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br t-micro font-bold text-white ${avatarGrad}`}>{profileName(assignee).slice(0, 1)}</span>
                {profileName(assignee)}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero header */}
      <div className="rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] px-7 py-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[var(--radius-lg)] bg-white/10">
              <svg viewBox="0 0 20 20" fill="none" stroke="var(--surface-raised)" strokeWidth={1.8} className="h-6 w-6"><rect x="3.5" y="3.5" width="13" height="13" rx="3" /><path d="M6.5 10l2.2 2.2L13.5 7.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="t-title-1 font-bold tracking-[-0.02em] text-white">المهام</h1>
              <p className="mt-1 text-sm text-white/50">{loading ? "جارِ التحميل…" : `${total} مهمة مفتوحة`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => downloadCSV(`tasks-${new Date().toISOString().slice(0, 10)}.csv`, visible.map((t) => ({
                "العنوان": t.title ?? "",
                "النوع": t.task_types?.label ?? "",
                "تاريخ الاستحقاق": formatDateTime(t.due_at),
                "المسؤول": t.assignee_uid ? profileName(profileMap.get(t.assignee_uid)) : "",
              })))}
              disabled={!visible.length}
              className="rounded-[var(--radius-md)] border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-40"
            >تصدير CSV
            </button>
            <button onClick={() => setNewOpen(true)} className="rounded-[var(--radius-md)] bg-[var(--brand-teal-400)] px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--brand-teal-600)]">+ مهمة جديدة</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* List */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          {dayFilter && (
            <button onClick={() => setDayFilter(null)} className="self-start rounded-full bg-[var(--surface-accent-subtle)] px-3 py-1 t-body-sm font-semibold text-[var(--brand-teal-700)]">عرض {dayFilter} · مسح</button>
          )}
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
          ) : (
            <>
              {groups.overdue.length > 0 && (
                <section>
                  <h2 className="mb-3 inline-block rounded-[var(--radius-sm)] px-3 py-1.5 t-micro font-semibold uppercase tracking-wider bg-[var(--status-danger-bg)] text-[var(--brand-red-500)]">متأخرة · {groups.overdue.length}</h2>
                  <div className="flex flex-col gap-2">{groups.overdue.map((t) => <TaskRow key={t.id} t={t} tone="border-[var(--status-danger-border)]" />)}</div>
                </section>
              )}
              <section>
                <h2 className="mb-3 inline-block rounded-[var(--radius-sm)] px-3 py-1.5 t-micro font-semibold uppercase tracking-wider bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-700)]">اليوم · {groups.todayT.length}</h2>
                {groups.todayT.length === 0 ? (
                  <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] py-5 text-center t-body text-muted">لا توجد مهام لليوم!</p>
                ) : (
                  <div className="flex flex-col gap-2">{groups.todayT.map((t) => <TaskRow key={t.id} t={t} tone="border-[var(--brand-teal-700)]/40" />)}</div>
                )}
              </section>
              {groups.week.length > 0 && (
                <section>
                  <h2 className="mb-3 inline-block rounded-[var(--radius-sm)] px-3 py-1.5 t-micro font-semibold uppercase tracking-wider bg-[var(--surface-sunken)] text-[var(--content-secondary)]">هذا الأسبوع · {groups.week.length}</h2>
                  <div className="flex flex-col gap-2">{groups.week.map((t) => <TaskRow key={t.id} t={t} tone="border-[var(--border-subtle)]" />)}</div>
                </section>
              )}
              {groups.upcoming.length > 0 && (
                <section>
                  <h2 className="mb-3 inline-block rounded-[var(--radius-sm)] px-3 py-1.5 t-micro font-semibold uppercase tracking-wider bg-[var(--surface-sunken)] text-[var(--content-tertiary)]">قادمة · {groups.upcoming.length}</h2>
                  <div className="flex flex-col gap-2">{groups.upcoming.map((t) => <TaskRow key={t.id} t={t} tone="border-[var(--border-subtle)]" />)}</div>
                </section>
              )}
              {tasks.length < total && (
                <button onClick={() => setLimit((l) => l + PAGE)} className="self-start rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-2 t-body-sm font-semibold text-ink-secondary transition hover:border-[var(--brand-teal-700)] hover:text-[var(--brand-teal-700)]">تحميل المزيد ({total - tasks.length} متبقي)
                </button>
              )}
            </>
          )}
        </div>

        {/* Calendar */}
        <div className="h-fit rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)] e-1 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <span className="t-body font-semibold text-ink">{month.toLocaleDateString("ar-SA", { month: "long", year: "numeric" })}</span>
            <div className="flex gap-1">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded px-2 py-0.5 t-body text-ink-secondary transition hover:bg-[var(--surface-accent-subtle)]">‹</button>
              <button onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setDayFilter(null); }} className="rounded-[var(--radius-sm)] bg-[var(--brand-teal-700)] px-2.5 py-0.5 t-body-sm font-semibold text-white transition hover:bg-[var(--brand-teal-800)]">اليوم</button>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded px-2 py-0.5 t-body text-ink-secondary transition hover:bg-[var(--surface-accent-subtle)]">›</button>
            </div>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center t-micro font-semibold uppercase text-muted">
            {["أح", "إث", "ثل", "أر", "خم", "جم", "سب"].map((d) => <span key={d}>{d}</span>)}
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
                <button key={day} onClick={() => setDayFilter(isSel ? null : dateStr)} className={`flex h-9 flex-col items-center justify-center rounded-[var(--radius-sm)] t-body-sm transition ${isSel ? "bg-[var(--brand-teal-700)] text-white" : isToday ? "bg-[var(--brand-teal-700)]/10 font-bold text-[var(--brand-teal-700)]" : hasTasks ? "font-semibold text-[var(--brand-teal-700)] hover:bg-[var(--surface-accent-subtle)]" : "text-ink-secondary hover:bg-[var(--surface-page)]"}`}>
                  {day}
                  {hasTasks && !isSel && !isToday && <span className="h-1 w-1 rounded-full bg-[var(--brand-teal-700)]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* New task */}
      <SlideOver open={newOpen} onClose={() => setNewOpen(false)} title="مهمة جديدة" subtitle="أضف متابعة"
        footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={() => setNewOpen(false)}>إلغاء</Button><Button fullWidth loading={saving} onClick={createTask}>{saving ? "جاري الإنشاء..." : "إنشاء مهمة"}</Button></div>}>
        <div className="flex flex-col gap-5">
          <Input id="tk-title" label="العنوان *" dir="auto" value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} placeholder="مثلاً: متابعة مع الفيحان" error={ntErr} autoFocus />
          <Textarea id="tk-desc" label="الوصف" dir="auto" value={nt.description} onChange={(e) => setNt({ ...nt, description: e.target.value })} placeholder="التفاصيل…" />
          <div className="grid grid-cols-2 gap-4">
            <Input id="tk-due" label="تاريخ الاستحقاق" type="date" value={nt.due} onChange={(e) => setNt({ ...nt, due: e.target.value })} />
            <Input id="tk-time" label="الوقت" type="time" value={nt.time} onChange={(e) => setNt({ ...nt, time: e.target.value })} />
          </div>
          <Select id="tk-type" label="النوع" value={nt.typeId} onChange={(e) => setNt({ ...nt, typeId: e.target.value })}>
            <option value="">بدون نوع</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <Select id="tk-assignee" label="المسؤول" value={nt.assigneeId} onChange={(e) => setNt({ ...nt, assigneeId: e.target.value })}>
            <option value="">غير محدد</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{profileName(p)}</option>)}
          </Select>
        </div>
      </SlideOver>

      {/* Task detail */}
      <SlideOver
        open={!!detail}
        onClose={() => setDetail(null)}
        title={editingDetail ? "تعديل المهمة" : detail?.title || "مهمة"}
        subtitle={detail?.task_types?.label ?? undefined}
        footer={
          detail && canActOnTask(role, userId, detail.assignee_uid) && (
            <div className="flex gap-3">
              {editingDetail ? (
                <>
                  <Button variant="secondary" fullWidth onClick={() => setEditingDetail(false)}>إلغاء</Button>
                  <Button fullWidth loading={savingEdit} onClick={saveEdit}>حفظ التعديل</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" fullWidth onClick={() => setEditingDetail(true)}>تعديل</Button>
                  <Button fullWidth onClick={() => setCompleteTarget(detail)}>إنجاز المهمة</Button>
                </>
              )}
            </div>
          )
        }
      >
        {detail && (
          <div className="flex flex-col gap-5">
            {!canActOnTask(role, userId, detail.assignee_uid) && (
              <div className="rounded-[var(--radius-md)] border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-2.5 t-body-sm font-medium text-[var(--status-warning-fg)]">للعرض فقط — بس المسؤول عن هذي المهمة يقدر يعدّلها أو ينهيها</div>
            )}
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
                  <p className="t-body-sm font-semibold uppercase tracking-wide text-muted">الوصف</p>
                  <p dir="auto" className="mt-1 t-body text-ink-secondary">{detail.description || "—"}</p>
                </div>
                <div>
                  <p className="t-body-sm font-semibold uppercase tracking-wide text-muted">تاريخ الاستحقاق</p>
                  <p className="mt-1 t-body text-ink">{detail.due_at ? new Date(detail.due_at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
                </div>
                <div>
                  <p className="t-body-sm font-semibold uppercase tracking-wide text-muted">المسؤول</p>
                  <p className="mt-1 t-body text-ink">{detail.assignee_uid ? profileName(profileMap.get(detail.assignee_uid)) || "—" : "—"}</p>
                </div>
                {detail.completion_note && (
                  <div>
                    <p className="t-body-sm font-semibold uppercase tracking-wide text-muted">ملاحظة الإنجاز</p>
                    <p dir="auto" className="mt-1 t-body text-ink-secondary">{detail.completion_note}</p>
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
