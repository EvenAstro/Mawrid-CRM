"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import NextBestActionCard from "@/components/NextBestActionCard";
import NewDealSlideOver from "@/components/NewDealSlideOver";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import { fetchProfiles, type Profile } from "@/lib/profiles";
import { initials, formatDate, formatDateTime, formatPhone, todayInput, profileName } from "@/lib/format";
import { useRole } from "@/components/RoleProvider";
import { canActOnTask } from "@/lib/permissions";
import { logAudit, fieldChangeMessage } from "@/lib/auditLog";
import { markLeadResponded, markLeadNoResponse, markLeadJunk, updateLead, type Lead } from "@/lib/models/leads";
import { createLeadTask, fetchLeadOpenTasks, fetchLeadCompletedTasks, fetchLeadAllTasksCompact, completeLeadTask } from "@/lib/models/tasks";
import { fetchLeadActivities } from "@/lib/models/activities";
import {
  fetchActiveActivityTypes,
  fetchJunkReasons,
  fetchPipelineStages,
  fetchAllSources,
  fetchTaskTypes,
} from "@/lib/models/refData";
import { createActivity } from "@/lib/models/activities";
import { BanIcon, CheckIcon } from "@/components/icons";

interface Activity {
  id: number | string;
  occurred_at: string | null;
  body?: string | null;
  direction?: string | null;
  is_system?: boolean | null;
  activity_types: { label: string } | null;
}
interface ActivityType { id: string; label: string }
interface JunkReason { id: number | string; label: string }
interface DealStage { id: string; label: string }
interface Task {
  id: string;
  title: string | null;
  description: string | null;
  due_at: string | null;
  assignee_uid: string | null;
  depends_on_task_id: string | null;
  lead_id: string | null;
  completed_at: string | null;
  completion_note: string | null;
  task_types: { label: string; color: string | null } | null;
}
interface TaskType { id: string; label: string }





function nowTimeInput() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ─── Section wrapper ───────────────────────────────────────────────── */
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--border-default)_80%,transparent)] bg-[var(--surface-raised)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
        <h3 className="t-body font-bold text-[var(--content-primary)]">{title}</h3>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

/* ─── Styled form input ─────────────────────────────────────────────── */
const inputCls = "h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-sunken)_60%,transparent)] px-4 t-body-sm text-[var(--content-secondary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-400)] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-400)]/20 transition";
const selectCls = "h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-sunken)_60%,transparent)] px-4 t-body-sm text-[var(--content-secondary)] focus:border-[var(--brand-teal-400)] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-400)]/20 transition appearance-none";
const textareaCls = "w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-sunken)_60%,transparent)] px-4 py-3 t-body-sm text-[var(--content-secondary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-400)] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-400)]/20 transition resize-none";
const btnPrimary = "h-11 w-full rounded-[var(--radius-md)] bg-[var(--brand-teal-700)] t-body-sm font-semibold text-white shadow-sm shadow-[var(--brand-teal-700)]/20 transition hover:bg-[var(--brand-teal-800)] active:scale-[0.98] disabled:opacity-50";

export default function LeadSlideOver({
  lead,
  onClose,
  onUpdated,
}: {
  lead: Lead | null;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const toast = useToast();
  const { role, userId } = useRole();
  const [shown, setShown] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [junkReasons, setJunkReasons] = useState<JunkReason[]>([]);
  const [dealStages, setDealStages] = useState<DealStage[]>([]);
  const [leadStages, setLeadStages] = useState<DealStage[]>([]);
  const [sourcesList, setSourcesList] = useState<{ id: string; label: string }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [outcomeMode, setOutcomeMode] = useState<"responded" | "junk" | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [respondedMethodId, setRespondedMethodId] = useState<string | null>(null);
  const [respondedNote, setRespondedNote] = useState("");

  const [addingActivity, setAddingActivity] = useState(false);
  const [actTypeId, setActTypeId] = useState("");
  const [actDirection, setActDirection] = useState<"outbound" | "inbound">("outbound");
  const [actDate, setActDate] = useState(todayInput());
  const [actTime, setActTime] = useState(nowTimeInput());
  const [actNotes, setActNotes] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskTime, setTaskTime] = useState("09:00");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDependsOn, setTaskDependsOn] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [allLeadTasks, setAllLeadTasks] = useState<Task[]>([]);

  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"activities" | "tasks">("activities");

  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStageId, setEditStageId] = useState("");
  const [editSourceId, setEditSourceId] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const open = lead != null;

  useEffect(() => { if (lead) setShown(lead); }, [lead]);

  async function refetchActivities(leadId: string | number) {
    const { data } = await fetchLeadActivities(leadId);
    setActivities((data as unknown as Activity[]) || []);
  }

  async function refetchTasks(leadId: string | number) {
    const [openRes, doneRes, allRes] = await Promise.all([
      fetchLeadOpenTasks(leadId),
      fetchLeadCompletedTasks(leadId),
      fetchLeadAllTasksCompact(leadId),
    ]);
    setTasks((openRes.data as unknown as Task[]) || []);
    setCompletedTasks((doneRes.data as unknown as Task[]) || []);
    setAllLeadTasks((allRes.data as unknown as Task[]) || []);
  }

  useEffect(() => {
    if (!lead) return;
    setActivities([]);
    setTasks([]);
    setCompletedTasks([]);
    setAllLeadTasks([]);
    setShowHistory(false);
    setOutcomeMode(null);
    setAddingActivity(false);
    setAddingTask(false);
    setActiveTab("activities");
    setRespondedMethodId(null);
    setRespondedNote("");

    const fetchAll = async () => {
      await Promise.all([
        refetchActivities(lead.id),
        refetchTasks(lead.id),
        fetchActiveActivityTypes().then(setActivityTypes),
        fetchJunkReasons().then(setJunkReasons),
        fetchPipelineStages("deal").then(setDealStages),
        fetchPipelineStages("lead").then(setLeadStages),
        fetchAllSources().then(setSourcesList),
        fetchTaskTypes().then(setTaskTypes),
        fetchProfiles().then(setProfiles),
      ]);
    };
    fetchAll();
  }, [lead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !dealOpen && !completeTarget && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dealOpen, completeTarget]);

  const data = shown;

  const isJunkLead = !!data?.junk_reason_id;
  const isResponded = data?.contact_outcome === "responded";
  const isNoResponse = data?.contact_outcome === "no_response";
  const canConvert = !!data && !isJunkLead && isResponded;

  function patchShown(patch: Partial<Lead>) {
    setShown((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function markResponded() {
    if (!data || !respondedMethodId) return;
    if (!respondedNote.trim()) { toast("اكتب ملخص ما دار في التواصل", "error"); return; }
    setSavingOutcome(true);
    const now = new Date().toISOString();
    const t = activityTypes.find((x) => x.id === respondedMethodId);
    const { data: userData } = await supabase.auth.getUser();
    const { error: actErr } = await createActivity({
      entityType: "lead",
      entityId: data.id,
      activityTypeId: respondedMethodId,
      body: respondedNote.trim(),
      direction: "inbound",
      occurredAt: now,
      userId: userData.user?.id ?? null,
    });
    const { error: leadErr } = await markLeadResponded(data.id, now);
    setSavingOutcome(false);
    if (actErr || leadErr) { toast("تعذّر حفظ التصنيف", "error"); return; }
    toast(`تم تسجيل الرد عبر ${t?.label ?? "اتصال"}`);
    patchShown({ contact_outcome: "responded", contact_outcome_at: now });
    setOutcomeMode(null);
    setRespondedMethodId(null);
    setRespondedNote("");
    refetchActivities(data.id);
    onUpdated?.();
  }

  async function markNoResponse() {
    if (!data) return;
    setSavingOutcome(true);
    const now = new Date().toISOString();
    const { error } = await markLeadNoResponse(data.id, now);
    setSavingOutcome(false);
    if (error) { toast("تعذّر حفظ التصنيف", "error"); return; }
    toast("تم تصنيف العميل كـ لم يرد");
    patchShown({ contact_outcome: "no_response", contact_outcome_at: now });
    onUpdated?.();
  }

  async function markJunk(reasonId: string | number) {
    if (!data) return;
    setSavingOutcome(true);
    const now = new Date().toISOString();
    const { error } = await markLeadJunk(data.id, String(reasonId), now);
    setSavingOutcome(false);
    if (error) { toast("تعذّر حفظ التصنيف", "error"); return; }
    const r = junkReasons.find((x) => String(x.id) === String(reasonId));
    toast(`تم تصنيف العميل كـ جنك (${r?.label ?? ""})`);
    patchShown({ junk_reason_id: Number(reasonId), junk_reasons: r ? { label: r.label } : data.junk_reasons });
    setOutcomeMode(null);
    onUpdated?.();
  }

  async function submitActivity() {
    if (!data) return;
    if (!actTypeId) { toast("اختر نوع النشاط", "error"); return; }
    setSavingActivity(true);
    const { data: userData } = await supabase.auth.getUser();
    const occurred = new Date(`${actDate}T${actTime || "00:00"}:00`).toISOString();
    const { error } = await createActivity({
      entityType: "lead",
      entityId: data.id,
      activityTypeId: actTypeId,
      body: actNotes.trim() || null,
      direction: actDirection,
      occurredAt: occurred,
      userId: userData.user?.id ?? null,
    });
    setSavingActivity(false);
    if (error) { toast("تعذّر تسجيل النشاط", "error"); return; }
    toast("تم تسجيل النشاط");
    setActTypeId(""); setActNotes(""); setActDirection("outbound");
    setActDate(todayInput()); setActTime(nowTimeInput()); setAddingActivity(false);
    refetchActivities(data.id);
  }

  async function submitTask() {
    if (!data) return;
    if (!taskTitle.trim()) { toast("اكتب عنوان المهمة", "error"); return; }
    setSavingTask(true);
    const dueAt = taskDue ? new Date(`${taskDue}T${taskTime || "09:00"}:00`).toISOString() : null;
    const { error } = await createLeadTask({
      title: taskTitle.trim(),
      dueAt,
      taskTypeId: taskTypeId || null,
      assigneeId: taskAssigneeId || null,
      dependsOnTaskId: taskDependsOn || null,
      leadId: data.id,
    });
    setSavingTask(false);
    if (error) { toast("تعذّر إضافة المهمة", "error"); return; }
    toast("تمت إضافة المهمة");
    logAudit(data.id, userId, `تمت إضافة مهمة جديدة: «${taskTitle.trim()}»`);
    setTaskTitle(""); setTaskDue(""); setTaskTime("09:00"); setTaskTypeId(""); setTaskAssigneeId(""); setTaskDependsOn(""); setAddingTask(false);
    refetchTasks(data.id);
    refetchActivities(data.id);
  }

  async function completeTask(note: string) {
    if (!completeTarget || !data) return;
    setCompletingId(completeTarget.id);
    const { error } = await completeLeadTask(String(completeTarget.id), note);
    setCompletingId(null);
    if (error) { toast("تعذّر إنهاء المهمة", "error"); return; }
    const unblocked = allLeadTasks.filter((t) => t.depends_on_task_id === completeTarget.id && !t.completed_at);
    if (unblocked.length > 0) {
      toast(`تم إنهاء المهمة — المهمة التالية جاهزة: ${unblocked[0].title || "مهمة"}`);
    } else {
      toast("تم إنهاء المهمة");
    }
    logAudit(data.id, userId, `تم إنهاء مهمة: «${completeTarget.title || "مهمة"}»\nملاحظة: ${note}`);
    setCompleteTarget(null);
    refetchTasks(data.id);
    refetchActivities(data.id);
  }

  function startEditingInfo() {
    if (!data) return;
    setEditName(data.full_name || "");
    setEditPhone(data.phone || "");
    setEditEmail(data.email || "");
    setEditNotes(data.notes || "");
    setEditOwnerId(data.owner || "");
    setEditStageId("");
    setEditSourceId("");
    setEditingInfo(true);
  }

  async function saveInfoEdit() {
    if (!data) return;
    setSavingInfo(true);
    const now = new Date().toISOString();
    const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    if (editName.trim() !== (data.full_name || "")) changes.push({ field: "full_name", oldValue: data.full_name, newValue: editName.trim() });
    if (editPhone.trim() !== (data.phone || "")) changes.push({ field: "phone", oldValue: data.phone, newValue: editPhone.trim() });
    if (editEmail.trim() !== (data.email || "")) changes.push({ field: "email", oldValue: data.email, newValue: editEmail.trim() });
    if (editNotes.trim() !== (data.notes || "")) changes.push({ field: "notes", oldValue: data.notes ?? null, newValue: editNotes.trim() });
    if (editOwnerId !== (data.owner || "")) {
      const oldOwnerName = data.owner ? profileName(profiles.find((p) => p.id === data.owner)) || data.owner : null;
      const newOwnerName = editOwnerId ? profileName(profiles.find((p) => p.id === editOwnerId)) || editOwnerId : null;
      changes.push({ field: "owner", oldValue: oldOwnerName, newValue: newOwnerName });
    }
    if (editStageId) {
      const newStage = leadStages.find((s) => s.id === editStageId);
      changes.push({ field: "stage", oldValue: data.pipeline_stages?.label ?? null, newValue: newStage?.label ?? null });
    }
    if (editSourceId) {
      const newSource = sourcesList.find((s) => s.id === editSourceId);
      changes.push({ field: "source", oldValue: data.sources?.label ?? null, newValue: newSource?.label ?? null });
    }

    if (changes.length === 0) { setSavingInfo(false); setEditingInfo(false); return; }

    const patch: Record<string, unknown> = {
      full_name: editName.trim() || null,
      normalized_phone: editPhone.trim() || null,
      normalized_email: editEmail.trim() || null,
      notes: editNotes.trim() || null,
      owner_id: editOwnerId || null,
      updated_at: now,
    };
    if (editStageId) patch.stage_id = editStageId;
    if (editSourceId) patch.primary_source_id = editSourceId;

    const { error } = await updateLead(data.id, patch);
    setSavingInfo(false);
    if (error) { toast("تعذّر حفظ التعديلات", "error"); console.error("[saveInfoEdit]", error); return; }
    toast("تم حفظ بيانات العميل");
    await logAudit(data.id, userId, fieldChangeMessage(changes));
    const newPatch: Partial<Lead> = { full_name: editName.trim() || null, phone: editPhone.trim() || null, email: editEmail.trim() || null, notes: editNotes.trim() || null, owner: editOwnerId || null };
    if (editStageId) {
      const s = leadStages.find((x) => x.id === editStageId);
      newPatch.pipeline_stages = s ? { label: s.label, color: null } : data.pipeline_stages;
    }
    if (editSourceId) {
      const s = sourcesList.find((x) => x.id === editSourceId);
      newPatch.sources = s ? { label: s.label } : data.sources;
    }
    patchShown(newPatch);
    setEditingInfo(false);
    refetchActivities(data.id);
    onUpdated?.();
  }

  const outcomeBadge = isJunkLead
    ? { label: "جنك", cls: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] ring-1 ring-[var(--status-danger-border)]" }
    : isResponded
    ? { label: "رد العميل", cls: "bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-700)] ring-1 ring-[var(--brand-teal-200)]" }
    : isNoResponse
    ? { label: "لم يرد", cls: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] ring-1 ring-[var(--status-warning-border)]" }
    : { label: "جديد", cls: "bg-[var(--surface-sunken)] text-[var(--content-tertiary)] ring-1 ring-[var(--border-default)]" };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--surface-inverse)_50%,transparent)] backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* ─── Centered Modal ─────────────────────────────────────── */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <aside
          onClick={(e) => e.stopPropagation()}
          className={`relative flex h-full max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-b from-[var(--surface-sunken)] to-white shadow-2xl ring-1 ring-[color-mix(in_srgb,var(--border-default)_60%,transparent)] transition-transform duration-200 ${open ? "scale-100" : "scale-95"}`}
        >
        {data && (
          <>
            {/* ─── Header ──────────────────────────────────────── */}
            <div className="relative flex-none border-b border-[color-mix(in_srgb,var(--border-default)_70%,transparent)] bg-[var(--surface-raised)]">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-teal-700)]/[0.03] to-transparent" />
              <div className="relative flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--brand-teal-700)] text-xl font-bold text-white shadow-sm shadow-[var(--brand-teal-700)]/20">
                      {initials(data.full_name)}
                    </span>
                    <span className={`absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${isResponded ? "bg-[var(--brand-teal-600)]" : isNoResponse ? "bg-[var(--brand-amber-500)]" : isJunkLead ? "bg-[var(--brand-red-500)]" : "bg-[var(--border-default)]"}`}>
                      <span className="block h-2 w-2 rounded-full bg-[var(--surface-raised)]" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 dir="auto" className="truncate t-title-2 font-bold text-[var(--content-primary)]">{data.full_name || "عميل بدون اسم"}</h2>
                    <div className="mt-1 flex items-center gap-3">
                      {data.phone && <span dir="ltr" className="t-body-sm text-[var(--content-tertiary)]">{formatPhone(data.phone)}</span>}
                      {data.email && <span className="t-body-sm text-[var(--content-tertiary)]">{data.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3.5 py-1.5 t-body-sm font-semibold ${outcomeBadge.cls}`}>{outcomeBadge.label}</span>
                  <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--content-tertiary)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--content-secondary)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Scrollable Body ─────────────────────────────── */}
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-6">

              {/* AI Next Best Action */}
              <NextBestActionCard dealId={String(data.id)} entityType="lead" hideWhenEmpty />

              {/* ─── Contact Classification ────────────────────── */}
              <Section title="تصنيف التواصل">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setOutcomeMode(outcomeMode === "responded" ? null : "responded");
                      setRespondedMethodId(null);
                      setRespondedNote("");
                    }}
                    className={`flex items-center gap-2 rounded-[var(--radius-md)] border-2 px-5 py-3 t-body-sm font-semibold transition-all ${
                      outcomeMode === "responded" || isResponded
                        ? "border-[var(--brand-teal-600)] bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-800)] shadow-sm shadow-[var(--brand-teal-600)]/10"
                        : "border-[var(--border-default)] text-[var(--content-secondary)] hover:border-[var(--brand-teal-300)] hover:bg-[var(--surface-accent-subtle)]/50"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand-teal-100)] t-body-sm"><CheckIcon className="h-4 w-4" /></span>رد العميل</button>
                  <button
                    onClick={markNoResponse}
                    disabled={savingOutcome}
                    className={`flex items-center gap-2 rounded-[var(--radius-md)] border-2 px-5 py-3 t-body-sm font-semibold transition-all disabled:opacity-50 ${
                      isNoResponse
                        ? "border-[var(--brand-amber-500)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] shadow-sm shadow-[color-mix(in_srgb,var(--brand-amber-500)_10%,transparent)]"
                        : "border-[var(--border-default)] text-[var(--content-secondary)] hover:border-[var(--status-warning-border)] hover:bg-[color-mix(in_srgb,var(--status-warning-bg)_50%,transparent)]"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--status-warning-bg)] t-body-sm">⏳</span>لم يرد</button>
                  <button
                    onClick={() => setOutcomeMode(outcomeMode === "junk" ? null : "junk")}
                    className={`flex items-center gap-2 rounded-[var(--radius-md)] border-2 px-5 py-3 t-body-sm font-semibold transition-all ${
                      outcomeMode === "junk" || isJunkLead
                        ? "border-[var(--brand-red-500)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] shadow-sm shadow-[color-mix(in_srgb,var(--brand-red-500)_10%,transparent)]"
                        : "border-[var(--border-default)] text-[var(--content-secondary)] hover:border-[var(--status-danger-border)] hover:bg-[color-mix(in_srgb,var(--status-danger-bg)_50%,transparent)]"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--status-danger-bg)] t-body-sm"><BanIcon className="h-4 w-4" /></span>جنك</button>

                  {canConvert && (
                    <button
                      onClick={() => setDealOpen(true)}
                      className="ml-auto flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand-teal-700)] px-6 py-3 t-body-sm font-bold text-white shadow-sm shadow-[var(--brand-teal-700)]/25 transition hover:bg-[var(--brand-teal-800)] active:scale-[0.98]"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>تحويل إلى صفقة</button>
                  )}
                </div>

                {outcomeMode === "responded" && (
                  <div className="mt-5 space-y-4 rounded-[var(--radius-md)] border border-[var(--brand-teal-200)] bg-[var(--surface-accent-subtle)]/50 p-5">
                    <div>
                      <p className="mb-3 t-body-sm font-semibold text-[var(--brand-teal-800)]">1. اختر طريقة الرد:</p>
                      <div className="flex flex-wrap gap-2.5">
                        {activityTypes.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setRespondedMethodId(t.id)}
                            className={`rounded-[var(--radius-md)] border-2 px-5 py-2.5 t-body-sm font-semibold shadow-sm transition ${
                              respondedMethodId === t.id
                                ? "border-[var(--brand-teal-700)] bg-[var(--brand-teal-700)] text-white shadow-[var(--brand-teal-700)]/20"
                                : "border-[var(--brand-teal-300)] bg-[var(--surface-raised)] text-[var(--brand-teal-800)] hover:bg-[var(--brand-teal-100)]"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {respondedMethodId && (
                      <div className="border-t border-[var(--brand-teal-200)] pt-4">
                        <p className="mb-2 t-body-sm font-semibold text-[var(--brand-teal-800)]">
                          2. وش صار في التواصل؟<span className="text-[var(--brand-red-500)]">*</span>
                        </p>
                        <textarea
                          dir="auto"
                          value={respondedNote}
                          onChange={(e) => setRespondedNote(e.target.value)}
                          rows={4}
                          autoFocus
                          placeholder="اكتب ملخص التواصل… مثلاً: العميل مهتم بنظام كاشير لمطعمه، طلب عرض سعر بكرة"
                          className="w-full rounded-[var(--radius-md)] border-2 border-[var(--brand-teal-200)] bg-[var(--surface-raised)] px-4 py-3 t-body-sm text-[var(--content-secondary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-600)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-600)]/20 transition resize-none"
                        />
                        <div className="mt-3 flex gap-2.5">
                          <button
                            onClick={markResponded}
                            disabled={savingOutcome || !respondedNote.trim()}
                            className="flex-1 h-11 rounded-[var(--radius-md)] bg-[var(--brand-teal-700)] t-body-sm font-bold text-white shadow-sm shadow-[var(--brand-teal-700)]/20 transition hover:bg-[var(--brand-teal-800)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingOutcome ? "جارِ الحفظ…" : "حفظ الرد"}
                          </button>
                          <button
                            onClick={() => { setRespondedMethodId(null); setRespondedNote(""); }}
                            className="h-11 rounded-[var(--radius-md)] border-2 border-[var(--border-default)] bg-[var(--surface-raised)] px-5 t-body-sm font-semibold text-[var(--content-tertiary)] transition hover:bg-[var(--surface-sunken)]"
                          >إلغاء</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {outcomeMode === "junk" && (
                  <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[color-mix(in_srgb,var(--status-danger-bg)_50%,transparent)] p-5">
                    <p className="mb-3 t-body-sm font-semibold text-[var(--status-danger-fg)]">السبب:</p>
                    <div className="flex flex-wrap gap-2.5">
                      {junkReasons.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => markJunk(r.id)}
                          disabled={savingOutcome}
                          className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--surface-raised)] px-5 py-2.5 t-body-sm font-semibold text-[var(--status-danger-fg)] shadow-sm transition hover:bg-[var(--status-danger-bg)] hover:shadow disabled:opacity-50"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* ─── Lead Details ──────────────────────────────── */}
              <Section
                title="بيانات العميل"
                action={
                  editingInfo ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingInfo(false)} className="rounded-[var(--radius-sm)] px-3 py-1.5 t-body-sm font-semibold text-[var(--content-tertiary)] transition hover:bg-[var(--surface-sunken)]">إلغاء</button>
                      <button onClick={saveInfoEdit} disabled={savingInfo} className="rounded-[var(--radius-sm)] bg-[var(--brand-teal-700)] px-4 py-1.5 t-body-sm font-semibold text-white transition hover:bg-[var(--brand-teal-800)] disabled:opacity-50">
                        {savingInfo ? "جارِ الحفظ…" : "حفظ"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startEditingInfo}
                      className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 t-body-sm font-semibold text-[var(--brand-teal-800)] transition hover:bg-[var(--surface-accent-subtle)]"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>تعديل</button>
                  )
                }
              >
                {editingInfo ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block t-body-sm font-semibold text-[var(--content-tertiary)]">الاسم</label>
                        <input dir="auto" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block t-body-sm font-semibold text-[var(--content-tertiary)]">الجوال</label>
                        <input dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className={`${inputCls} text-left`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block t-body-sm font-semibold text-[var(--content-tertiary)]">الإيميل</label>
                        <input dir="ltr" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={`${inputCls} text-left`} />
                      </div>
                      <div>
                        <label className="mb-1 block t-body-sm font-semibold text-[var(--content-tertiary)]">المسؤول</label>
                        <select value={editOwnerId} onChange={(e) => setEditOwnerId(e.target.value)} className={selectCls}>
                          <option value="">بدون مسؤول</option>
                          {profiles.map((p) => <option key={p.id} value={p.id}>{profileName(p)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block t-body-sm font-semibold text-[var(--content-tertiary)]">المرحلة</label>
                        <select value={editStageId} onChange={(e) => setEditStageId(e.target.value)} className={selectCls}>
                          <option value="">{data.pipeline_stages?.label || "بدون مرحلة"}</option>
                          {leadStages.filter((s) => s.id !== editStageId).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block t-body-sm font-semibold text-[var(--content-tertiary)]">المصدر</label>
                        <select value={editSourceId} onChange={(e) => setEditSourceId(e.target.value)} className={selectCls}>
                          <option value="">{data.sources?.label || "بدون مصدر"}</option>
                          {sourcesList.filter((s) => s.id !== editSourceId).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block t-body-sm font-semibold text-[var(--content-tertiary)]">ملاحظات</label>
                      <textarea dir="auto" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className={textareaCls} />
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    <div className="grid grid-cols-2 gap-x-6">
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">الاسم</span>
                        <span className="t-body-sm font-medium text-[var(--content-primary)]">{data.full_name || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">الجوال</span>
                        <span dir="ltr" className="t-body-sm font-medium text-[var(--content-primary)]">{formatPhone(data.phone)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6">
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">الإيميل</span>
                        <span dir="ltr" className="t-body-sm font-medium text-[var(--content-primary)]">{data.email || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">الشركة</span>
                        <span className="t-body-sm font-medium text-[var(--content-primary)]">{data.establishment_name || "—"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6">
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">المرحلة</span>
                        <span className="rounded-[var(--radius-xs)] bg-[var(--surface-sunken)] px-2.5 py-1 t-body-sm font-semibold text-[var(--content-secondary)]">{data.pipeline_stages?.label || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">المصدر</span>
                        <span className="rounded-[var(--radius-xs)] bg-[var(--surface-sunken)] px-2.5 py-1 t-body-sm font-semibold text-[var(--content-secondary)]">{data.sources?.label || "—"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6">
                      <div className="flex items-center justify-between py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">المسؤول</span>
                        <span className="t-body-sm font-medium text-[var(--content-primary)]">{data.owner ? profileName(profiles.find((p) => p.id === data.owner)) || data.owner : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <span className="t-body-sm font-semibold text-[var(--content-tertiary)]">تاريخ الإنشاء</span>
                        <span className="t-body-sm font-medium text-[var(--content-primary)]">{formatDate(data.created_at)}</span>
                      </div>
                    </div>
                    {data.notes && (
                      <div className="pt-3">
                        <p className="mb-1.5 t-body-sm font-semibold text-[var(--content-tertiary)]">ملاحظات</p>
                        <p dir="auto" className="whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-3 t-body-sm leading-relaxed text-[var(--content-secondary)]">{data.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* ─── Activities & Tasks — Tabbed ───────────────── */}
              <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--border-default)_80%,transparent)] bg-[var(--surface-raised)] shadow-sm">
                {/* Tab bar */}
                <div className="flex border-b border-[var(--border-subtle)]">
                  <button
                    onClick={() => setActiveTab("activities")}
                    className={`flex-1 py-4 text-center t-body-sm font-semibold transition ${
                      activeTab === "activities"
                        ? "border-b-2 border-[var(--brand-teal-700)] text-[var(--brand-teal-800)]"
                        : "text-[var(--content-tertiary)] hover:text-[var(--content-secondary)]"
                    }`}
                  >النشاطات
                    {activities.length > 0 && <span className="mr-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--surface-sunken)] px-1.5 t-micro font-bold text-[var(--content-tertiary)]">{activities.length}</span>}
                  </button>
                  <button
                    onClick={() => setActiveTab("tasks")}
                    className={`flex-1 py-4 text-center t-body-sm font-semibold transition ${
                      activeTab === "tasks"
                        ? "border-b-2 border-[var(--brand-teal-700)] text-[var(--brand-teal-800)]"
                        : "text-[var(--content-tertiary)] hover:text-[var(--content-secondary)]"
                    }`}
                  >المهام
                    {tasks.length > 0 && <span className="mr-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--status-warning-bg)] px-1.5 t-micro font-bold text-[var(--status-warning-fg)]">{tasks.length}</span>}
                  </button>
                </div>

                <div className="p-6">
                  {/* ── Activities Tab ── */}
                  {activeTab === "activities" && (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="t-body-sm text-[var(--content-tertiary)]">سجّل تواصلك مع العميل</p>
                        <button
                          onClick={() => setAddingActivity((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 t-body-sm font-semibold transition ${addingActivity ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]" : "bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-800)] hover:bg-[var(--brand-teal-100)]"}`}
                        >
                          {addingActivity ? "إلغاء" : "+ إضافة نشاط"}
                        </button>
                      </div>

                      {addingActivity && (
                        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-sunken)_50%,transparent)] p-5 space-y-4">
                          <select value={actTypeId} onChange={(e) => setActTypeId(e.target.value)} className={selectCls}>
                            <option value="">اختر نوع التواصل…</option>
                            {activityTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                          <div className="grid grid-cols-2 gap-3">
                            <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className={inputCls} />
                            <input type="time" value={actTime} onChange={(e) => setActTime(e.target.value)} className={inputCls} />
                          </div>
                          <textarea dir="auto" value={actNotes} onChange={(e) => setActNotes(e.target.value)} rows={3} placeholder="ملاحظات عن التواصل…" className={textareaCls} />
                          <button onClick={submitActivity} disabled={savingActivity} className={btnPrimary}>
                            {savingActivity ? "جارِ الحفظ…" : "حفظ النشاط"}
                          </button>
                        </div>
                      )}

                      {activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-[var(--content-tertiary)]"><path fillRule="evenodd" d="M1 4.75C1 3.784 1.784 3 2.75 3h14.5c.966 0 1.75.784 1.75 1.75v10.515a1.75 1.75 0 01-1.75 1.75h-1.5a.75.75 0 01-.53-.22L13.06 14.5H2.75A1.75 1.75 0 011 12.75V4.75z" clipRule="evenodd" /></svg>
                          </div>
                          <p className="t-body-sm font-medium text-[var(--content-tertiary)]">لا توجد نشاطات مسجّلة</p>
                          <p className="mt-1 t-body-sm text-[var(--content-tertiary)]">ابدأ بتسجيل أول تواصل مع العميل</p>
                        </div>
                      ) : (
                        <div className="max-h-[420px] space-y-3 overflow-y-auto">
                          {activities.map((a) => (
                            <div
                              key={a.id}
                              className={`flex gap-3 rounded-[var(--radius-md)] border p-4 transition ${
                                a.is_system
                                  ? "border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-sunken)_30%,transparent)] hover:border-[var(--border-default)]"
                                  : "border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-sunken)_50%,transparent)] hover:border-[var(--border-default)]"
                              }`}
                            >
                              <div className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-md)] t-body-sm ${a.is_system ? "bg-[var(--surface-sunken)] text-[var(--content-tertiary)]" : "bg-[var(--brand-teal-100)] text-[var(--brand-teal-700)]"}`}>
                                {a.is_system ? "" : ""}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`t-body-sm font-semibold ${a.is_system ? "text-[var(--content-tertiary)]" : "text-[var(--content-primary)]"}`}>
                                    {a.is_system ? "سجلّ النظام" : a.activity_types?.label ?? "نشاط"}
                                  </span>
                                </div>
                                <p className="mt-0.5 t-caption text-[var(--content-tertiary)]">{formatDateTime(a.occurred_at)}</p>
                                {a.body && <p dir="auto" className="mt-1.5 whitespace-pre-wrap t-body-sm leading-relaxed text-[var(--content-secondary)]">{a.body}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Tasks Tab ── */}
                  {activeTab === "tasks" && (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="t-body-sm text-[var(--content-tertiary)]">المهام المرتبطة بهذا العميل</p>
                        <button
                          onClick={() => setAddingTask((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 t-body-sm font-semibold transition ${addingTask ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]" : "bg-[var(--surface-accent-subtle)] text-[var(--brand-teal-800)] hover:bg-[var(--brand-teal-100)]"}`}
                        >
                          {addingTask ? "إلغاء" : "+ إضافة مهمة"}
                        </button>
                      </div>

                      {addingTask && (
                        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-sunken)_50%,transparent)] p-5 space-y-4">
                          <input dir="auto" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="عنوان المهمة…" className={inputCls} />
                          <div className="grid grid-cols-2 gap-3">
                            <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className={inputCls} />
                            <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} className={inputCls} />
                          </div>
                          <select value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)} className={selectCls}>
                            <option value="">بدون نوع</option>
                            {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                          <select value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)} className={selectCls}>
                            <option value="">بدون مسؤول</option>
                            {profiles.map((p) => <option key={p.id} value={p.id}>{profileName(p)}</option>)}
                          </select>
                          {tasks.length > 0 && (
                            <select value={taskDependsOn} onChange={(e) => setTaskDependsOn(e.target.value)} className={selectCls}>
                              <option value="">بدون تسلسل (مستقلة)</option>
                              {tasks.map((t) => <option key={t.id} value={t.id}>بعد إنجاز: {t.title || "مهمة"}</option>)}
                            </select>
                          )}
                          <button onClick={submitTask} disabled={savingTask} className={btnPrimary}>
                            {savingTask ? "جارِ الحفظ…" : "إضافة المهمة"}
                          </button>
                        </div>
                      )}

                      {tasks.length === 0 && completedTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-[var(--content-tertiary)]"><path fillRule="evenodd" d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM1.99 4.75a1 1 0 011-1h.01a1 1 0 010 2h-.01a1 1 0 01-1-1zM1.99 10a1 1 0 011-1h.01a1 1 0 110 2h-.01a1 1 0 01-1-1zM1.99 15.25a1 1 0 011-1h.01a1 1 0 110 2h-.01a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                          </div>
                          <p className="t-body-sm font-medium text-[var(--content-tertiary)]">لا توجد مهام</p>
                          <p className="mt-1 t-body-sm text-[var(--content-tertiary)]">أضف مهمة لمتابعة هذا العميل</p>
                        </div>
                      ) : (
                        <div className="max-h-[420px] overflow-y-auto">
                          {/* Open tasks with sequence visualization */}
                          {tasks.length > 0 && (
                            <div className="relative">
                              {tasks.map((t, idx) => {
                                const canAct = canActOnTask(role, userId, t.assignee_uid);
                                const depTask = t.depends_on_task_id ? allLeadTasks.find((x) => x.id === t.depends_on_task_id) : null;
                                const isBlocked = !!depTask && !depTask.completed_at;
                                const hasDependent = allLeadTasks.some((x) => x.depends_on_task_id === t.id && !x.completed_at);
                                const isPartOfChain = !!t.depends_on_task_id || hasDependent;
                                return (
                                  <div key={t.id} className="relative">
                                    {/* Vertical connector line between chained tasks */}
                                    {isPartOfChain && idx < tasks.length - 1 && allLeadTasks.some((x) => x.depends_on_task_id === t.id) && (
                                      <div className="absolute left-[19px] top-[52px] bottom-0 w-0.5 bg-gradient-to-b from-[var(--brand-teal-300)] to-[var(--status-warning-border)] z-0" />
                                    )}
                                    <div className={`relative z-10 group flex items-start gap-3 rounded-[var(--radius-md)] border p-4 transition mb-2 ${isBlocked ? "border-[var(--status-warning-border)] bg-[color-mix(in_srgb,var(--status-warning-bg)_30%,transparent)]" : "border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-sunken)_50%,transparent)] hover:border-[var(--border-default)]"} ${completingId === t.id ? "opacity-40" : ""}`}>
                                      {/* Step indicator */}
                                      <div className="flex flex-col items-center gap-1 flex-none">
                                        {isBlocked ? (
                                          <span title="معلّقة بانتظار مهمة أخرى" className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-[var(--brand-amber-500)] bg-[var(--status-warning-bg)]">
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-[var(--brand-amber-500)]"><path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM7.25 4.5a.75.75 0 011.5 0v3.25H11a.75.75 0 010 1.5H7.25V4.5z" clipRule="evenodd" /></svg>
                                          </span>
                                        ) : canAct ? (
                                          <button
                                            onClick={() => setCompleteTarget(t)}
                                            aria-label="إنهاء المهمة"
                                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--brand-teal-400)] bg-[var(--surface-raised)] transition hover:bg-[var(--surface-accent-subtle)] group-hover:border-[var(--brand-teal-600)]"
                                          />
                                        ) : (
                                          <span title="بس المسؤول عن المهمة يقدر ينهيها" className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--border-default)] opacity-50" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p dir="auto" className={`t-body-sm font-semibold ${isBlocked ? "text-[var(--content-tertiary)]" : "text-[var(--content-primary)]"}`}>{t.title || "مهمة بدون عنوان"}</p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                          {isBlocked && (
                                            <span className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--status-warning-bg)] px-2.5 py-1 t-micro font-semibold text-[var(--status-warning-fg)]">
                                              ⏳ بانتظار: {depTask?.title || "مهمة"}
                                            </span>
                                          )}
                                          {!isBlocked && isPartOfChain && !t.depends_on_task_id && (
                                            <span className="rounded-[var(--radius-sm)] bg-[var(--surface-accent-subtle)] px-2.5 py-1 t-micro font-semibold text-[var(--brand-teal-700)]">الخطوة الأولى</span>
                                          )}
                                          {t.task_types?.label && (
                                            <span className="rounded-[var(--radius-sm)] bg-[var(--surface-accent-subtle)] px-2.5 py-1 t-caption font-semibold text-[var(--brand-teal-800)]">{t.task_types.label}</span>
                                          )}
                                          {t.due_at && (
                                            <span className="flex items-center gap-1 t-caption text-[var(--content-tertiary)]">
                                              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M4 1.75a.75.75 0 01.75.75V3h6.5V2.5a.75.75 0 011.5 0V3h.25A2.75 2.75 0 0115.75 5.75v6.5A2.75 2.75 0 0113 15H3A2.75 2.75 0 01.25 12.25v-6.5A2.75 2.75 0 013 3h.25V2.5A.75.75 0 014 1.75z" clipRule="evenodd" /></svg>
                                              {formatDateTime(t.due_at)}
                                            </span>
                                          )}
                                          {t.assignee_uid && (
                                            <span className="rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-2.5 py-1 t-caption font-medium text-[var(--content-tertiary)]">
                                              {profileName(profiles.find((p) => p.id === t.assignee_uid))}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Completed tasks history */}
                          {completedTasks.length > 0 && (
                            <div className="mt-4">
                              <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="flex w-full items-center justify-between rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 t-body-sm font-semibold text-[var(--content-tertiary)] transition hover:bg-[var(--surface-sunken)]"
                              >
                                <span className="flex items-center gap-2">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--content-tertiary)]"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" /></svg>مهام منجزة ({completedTasks.length})
                                </span>
                                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-[var(--content-tertiary)] transition-transform ${showHistory ? "rotate-180" : ""}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                              </button>
                              {showHistory && (
                                <div className="mt-2 space-y-2">
                                  {completedTasks.map((t) => (
                                    <div key={t.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
                                      <div className="flex items-start gap-3">
                                        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--brand-teal-100)]">
                                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--brand-teal-700)]"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p dir="auto" className="t-body-sm font-semibold text-[var(--content-secondary)] line-through">{t.title || "مهمة"}</p>
                                          {t.completion_note && (
                                            <div className="mt-2 rounded-[var(--radius-sm)] bg-[var(--surface-accent-subtle)] px-3 py-2">
                                              <p className="t-micro font-semibold text-[var(--brand-teal-800)] mb-0.5">ملاحظة الإنجاز:</p>
                                              <p dir="auto" className="t-body-sm leading-relaxed text-[var(--brand-teal-900)]">{t.completion_note}</p>
                                            </div>
                                          )}
                                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            {t.completed_at && (
                                              <span className="t-caption text-[var(--content-tertiary)]">تم بتاريخ {formatDateTime(t.completed_at)}</span>
                                            )}
                                            {t.assignee_uid && (
                                              <span className="rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-2.5 py-1 t-caption font-medium text-[var(--content-tertiary)]">
                                                {profileName(profiles.find((p) => p.id === t.assignee_uid))}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
        </aside>
      </div>

      {data && (
        <NewDealSlideOver
          open={dealOpen}
          onClose={() => setDealOpen(false)}
          onCreated={() => { onUpdated?.(); }}
          stages={dealStages}
          prefillLead={{ id: String(data.id), full_name: data.full_name }}
        />
      )}

      <CompleteTaskModal
        open={!!completeTarget}
        taskTitle={completeTarget?.title ?? null}
        onClose={() => setCompleteTarget(null)}
        onConfirm={completeTask}
      />
    </>
  );
}
