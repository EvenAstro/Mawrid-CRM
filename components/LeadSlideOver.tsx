"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import NextBestActionCard from "@/components/NextBestActionCard";
import NewDealSlideOver from "@/components/NewDealSlideOver";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import { fetchLeadScoreModel, scoreWithModel } from "@/lib/leadScore/computeLeadScore";

export interface Lead {
  id: string | number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  owner: string | null;
  created_at: string | null;
  junk_reason_id: number | null;
  establishment_id?: number | string | null;
  establishment_name?: string | null;
  notes?: string | null;
  contact_outcome?: string | null;
  contact_outcome_at?: string | null;
  pipeline_stages: { label: string; color: string | null } | null;
  sources: { label: string } | null;
  junk_reasons: { label: string } | null;
}

interface Activity {
  id: number | string;
  occurred_at: string | null;
  body?: string | null;
  direction?: string | null;
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
  task_types: { label: string; color: string | null } | null;
}
interface TaskType { id: string; label: string }

interface LeadScore {
  pJunk: number;
  pClean: number;
  score: number;
  isJunk: boolean;
  hasCampaign: boolean;
  matched: boolean;
  source: string;
}

function initials(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scoreColor(pct: number): string {
  if (pct >= 70) return "#059669";
  if (pct >= 40) return "#f59e0b";
  return "#dc2626";
}

function todayInput() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function nowTimeInput() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ─── Reusable field row ────────────────────────────────────────────── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p dir="auto" className="mt-0.5 text-[15px] font-medium text-slate-800">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ─── Section wrapper ───────────────────────────────────────────────── */
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

/* ─── Styled form input ─────────────────────────────────────────────── */
const inputCls = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-[14px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition";
const selectCls = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-[14px] text-slate-700 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition appearance-none";
const textareaCls = "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[14px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition resize-none";
const btnPrimary = "h-11 w-full rounded-xl bg-emerald-600 text-[14px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50";
const btnOutline = "h-11 w-full rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]";

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
  const [shown, setShown] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [junkReasons, setJunkReasons] = useState<JunkReason[]>([]);
  const [dealStages, setDealStages] = useState<DealStage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [leadScore, setLeadScore] = useState<LeadScore | null>(null);

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
  const [savingTask, setSavingTask] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [dealOpen, setDealOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"activities" | "tasks">("activities");

  const open = lead != null;

  useEffect(() => { if (lead) setShown(lead); }, [lead]);

  async function refetchActivities(leadId: string | number) {
    const { data } = await supabase
      .from("activities")
      .select("*, activity_types(label)")
      .eq("entity_id", leadId)
      .eq("entity_type", "lead")
      .order("occurred_at", { ascending: false })
      .limit(30);
    setActivities((data as unknown as Activity[]) || []);
  }

  async function refetchTasks(leadId: string | number) {
    const { data } = await supabase
      .from("tasks")
      .select("*, task_types(label, color)")
      .eq("entity_id", leadId)
      .eq("entity_type", "lead")
      .is("completed_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(30);
    setTasks((data as unknown as Task[]) || []);
  }

  useEffect(() => {
    if (!lead) return;
    setActivities([]);
    setTasks([]);
    setLeadScore(null);
    setOutcomeMode(null);
    setAddingActivity(false);
    setAddingTask(false);
    setActiveTab("activities");
    setRespondedMethodId(null);
    setRespondedNote("");

    const fetchAll = async () => {
      const [tps] = await Promise.all([
        supabase.from("lead_touchpoints").select("campaign_id, raw_payload").eq("lead_id", lead.id),
        refetchActivities(lead.id),
        refetchTasks(lead.id),
        supabase.from("activity_types").select("id, label").eq("is_archived", false).order("sort_order", { ascending: true }).then(({ data }) => data && setActivityTypes(data as ActivityType[])),
        supabase.from("junk_reasons").select("id, label").then(({ data }) => data && setJunkReasons(data as JunkReason[])),
        supabase.from("pipeline_stages").select("id, label").eq("pipeline", "deal").order("sort_order", { ascending: true }).then(({ data }) => data && setDealStages(data as DealStage[])),
        supabase.from("task_types").select("id, label").then(({ data }) => data && setTaskTypes(data as TaskType[])),
      ]);

      const has_campaign = tps.data?.some((t: { campaign_id: string | null }) => t.campaign_id && t.campaign_id !== "--") || false;
      const matched = !!lead.establishment_id;
      const source = lead.sources?.label || "غير محدد";
      const model = await fetchLeadScoreModel();
      const result = scoreWithModel(model, { source, matched, hasCampaign: has_campaign });
      setLeadScore({
        pJunk: result.pJunk, pClean: 1 - result.pJunk, score: result.score,
        isJunk: result.pJunk >= 0.5, hasCampaign: has_campaign, matched, source,
      });
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
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const color = leadScore ? scoreColor(leadScore.score) : "#059669";

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
    const { error: actErr } = await supabase.from("activities").insert({
      id: crypto.randomUUID(), entity_type: "lead", entity_id: data.id,
      activity_type_id: respondedMethodId, body: respondedNote.trim(), direction: "inbound",
      occurred_at: now, user_id: userData.user?.id ?? null, created_at: now, updated_at: now,
    });
    const { error: leadErr } = await supabase
      .from("leads")
      .update({ contact_outcome: "responded", contact_outcome_at: now, updated_at: now })
      .eq("id", data.id);
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
    const { error } = await supabase
      .from("leads")
      .update({ contact_outcome: "no_response", contact_outcome_at: now, updated_at: now })
      .eq("id", data.id);
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
    const { error } = await supabase.from("leads").update({ junk_reason_id: reasonId, updated_at: now }).eq("id", data.id);
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
    const now = new Date().toISOString();
    const occurred = new Date(`${actDate}T${actTime || "00:00"}:00`).toISOString();
    const { error } = await supabase.from("activities").insert({
      id: crypto.randomUUID(), entity_type: "lead", entity_id: data.id,
      activity_type_id: actTypeId, body: actNotes.trim() || null, direction: actDirection,
      occurred_at: occurred, user_id: userData.user?.id ?? null, created_at: now, updated_at: now,
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
    const now = new Date().toISOString();
    const dueAt = taskDue ? new Date(`${taskDue}T${taskTime || "09:00"}:00`).toISOString() : null;
    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(), title: taskTitle.trim(), description: null, due_at: dueAt,
      task_type_id: taskTypeId || null, entity_type: "lead", entity_id: data.id,
      created_at: now, updated_at: now,
    });
    setSavingTask(false);
    if (error) { toast("تعذّر إضافة المهمة", "error"); return; }
    toast("تمت إضافة المهمة");
    setTaskTitle(""); setTaskDue(""); setTaskTime("09:00"); setTaskTypeId(""); setAddingTask(false);
    refetchTasks(data.id);
  }

  async function completeTask(note: string) {
    if (!completeTarget || !data) return;
    setCompletingId(completeTarget.id);
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString(), completion_note: note })
      .eq("id", completeTarget.id);
    setCompletingId(null);
    if (error) { toast("تعذّر إنهاء المهمة", "error"); return; }
    toast("تم إنهاء المهمة");
    setCompleteTarget(null);
    refetchTasks(data.id);
  }

  const outcomeBadge = isJunkLead
    ? { label: "جنك", cls: "bg-red-50 text-red-600 ring-1 ring-red-200" }
    : isResponded
    ? { label: "رد العميل", cls: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" }
    : isNoResponse
    ? { label: "لم يرد", cls: "bg-amber-50 text-amber-600 ring-1 ring-amber-200" }
    : { label: "جديد", cls: "bg-slate-50 text-slate-500 ring-1 ring-slate-200" };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* ─── Centered Modal ─────────────────────────────────────── */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <aside
          onClick={(e) => e.stopPropagation()}
          className={`relative flex h-full max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-slate-50 to-white shadow-2xl ring-1 ring-slate-200/60 transition-transform duration-200 ${open ? "scale-100" : "scale-95"}`}
        >
        {data && (
          <>
            {/* ─── Header ──────────────────────────────────────── */}
            <div className="relative flex-none border-b border-slate-200/70 bg-white">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/[0.03] to-transparent" />
              <div className="relative flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-xl font-bold text-white shadow-lg shadow-emerald-600/20">
                      {initials(data.full_name)}
                    </span>
                    <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${isResponded ? "bg-emerald-500" : isNoResponse ? "bg-amber-400" : isJunkLead ? "bg-red-400" : "bg-slate-300"}`}>
                      <span className="block h-2 w-2 rounded-full bg-white" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 dir="auto" className="truncate text-[22px] font-bold text-slate-900">{data.full_name || "Unnamed lead"}</h2>
                    <div className="mt-1 flex items-center gap-3">
                      {data.phone && <span className="text-[14px] text-slate-500">{data.phone}</span>}
                      {data.email && <span className="text-[14px] text-slate-500">{data.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${outcomeBadge.cls}`}>{outcomeBadge.label}</span>
                  <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
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
                    className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-[14px] font-semibold transition-all ${
                      outcomeMode === "responded" || isResponded
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10"
                        : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-[13px]">✅</span>
                    رد العميل
                  </button>
                  <button
                    onClick={markNoResponse}
                    disabled={savingOutcome}
                    className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-[14px] font-semibold transition-all disabled:opacity-50 ${
                      isNoResponse
                        ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm shadow-amber-500/10"
                        : "border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50/50"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-[13px]">⏳</span>
                    لم يرد
                  </button>
                  <button
                    onClick={() => setOutcomeMode(outcomeMode === "junk" ? null : "junk")}
                    className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-[14px] font-semibold transition-all ${
                      outcomeMode === "junk" || isJunkLead
                        ? "border-red-500 bg-red-50 text-red-700 shadow-sm shadow-red-500/10"
                        : "border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50/50"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-[13px]">🚫</span>
                    جنك
                  </button>

                  {canConvert && (
                    <button
                      onClick={() => setDealOpen(true)}
                      className="mr-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-[14px] font-bold text-white shadow-md shadow-emerald-600/25 transition hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.98]"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                      تحويل إلى صفقة
                    </button>
                  )}
                </div>

                {outcomeMode === "responded" && (
                  <div className="mt-5 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                    <div>
                      <p className="mb-3 text-[13px] font-semibold text-emerald-700">1. اختر طريقة الرد:</p>
                      <div className="flex flex-wrap gap-2.5">
                        {activityTypes.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setRespondedMethodId(t.id)}
                            className={`rounded-xl border-2 px-5 py-2.5 text-[14px] font-semibold shadow-sm transition ${
                              respondedMethodId === t.id
                                ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/20"
                                : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {respondedMethodId && (
                      <div className="border-t border-emerald-200 pt-4">
                        <p className="mb-2 text-[13px] font-semibold text-emerald-700">
                          2. وش صار في التواصل؟ <span className="text-red-500">*</span>
                        </p>
                        <textarea
                          dir="auto"
                          value={respondedNote}
                          onChange={(e) => setRespondedNote(e.target.value)}
                          rows={4}
                          autoFocus
                          placeholder="اكتب ملخص التواصل… مثلاً: العميل مهتم بنظام كاشير لمطعمه، طلب عرض سعر بكرة"
                          className="w-full rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-[14px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition resize-none"
                        />
                        <div className="mt-3 flex gap-2.5">
                          <button
                            onClick={markResponded}
                            disabled={savingOutcome || !respondedNote.trim()}
                            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-[14px] font-bold text-white shadow-md shadow-emerald-600/20 transition hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingOutcome ? "جارِ الحفظ…" : "✓ حفظ الرد"}
                          </button>
                          <button
                            onClick={() => { setRespondedMethodId(null); setRespondedNote(""); }}
                            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-5 text-[14px] font-semibold text-slate-500 transition hover:bg-slate-50"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {outcomeMode === "junk" && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50/50 p-5">
                    <p className="mb-3 text-[13px] font-semibold text-red-700">السبب:</p>
                    <div className="flex flex-wrap gap-2.5">
                      {junkReasons.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => markJunk(r.id)}
                          disabled={savingOutcome}
                          className="rounded-xl border border-red-300 bg-white px-5 py-2.5 text-[14px] font-semibold text-red-700 shadow-sm transition hover:bg-red-100 hover:shadow disabled:opacity-50"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* ─── Lead Details ──────────────────────────────── */}
              <Section title="بيانات العميل">
                <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>} label="الاسم" value={data.full_name} />
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 010-1.5h12.5a.75.75 0 010 1.5H16v13h.25a.75.75 0 010 1.5h-3.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75h-3.5a.75.75 0 010-1.5z" clipRule="evenodd" /></svg>} label="الشركة" value={data.establishment_name ?? null} />
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" /></svg>} label="الجوال" value={data.phone} />
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.161V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>} label="الإيميل" value={data.email} />
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v11.75A2.75 2.75 0 0016.75 18h-12A2.75 2.75 0 012 15.25V3.5zm3.75 7a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0-3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" clipRule="evenodd" /></svg>} label="المرحلة" value={data.pipeline_stages?.label ?? null} />
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>} label="المصدر" value={data.sources?.label ?? null} />
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>} label="المسؤول" value={data.owner} />
                  <InfoRow icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" /></svg>} label="تاريخ الإنشاء" value={formatDate(data.created_at)} />
                </div>
                {data.notes && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="mb-1 text-[12px] font-medium uppercase tracking-wider text-slate-400">ملاحظات</p>
                    <p dir="auto" className="whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700">{data.notes}</p>
                  </div>
                )}
              </Section>

              {/* ─── AI Lead Score ──────────────────────────────── */}
              {!leadScore && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                  <svg className="h-5 w-5 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  <span className="text-[15px] font-medium text-slate-600">جارِ حساب تقييم الذكاء الاصطناعي…</span>
                </div>
              )}
              {leadScore && (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
                    <h3 className="text-[15px] font-bold text-white">تقييم AI للعميل</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-6">
                      <div className="relative flex-none">
                        <svg width="88" height="88" className="-rotate-90">
                          <circle cx="44" cy="44" r={R} fill="none" stroke="#f1f5f9" strokeWidth="7" />
                          <circle cx="44" cy="44" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
                            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - leadScore.score / 100)}
                            style={{ transition: "stroke-dashoffset 0.6s ease" }} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[22px] font-extrabold" style={{ color }}>
                          {leadScore.score}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <div className="flex justify-between text-[13px]">
                            <span className="font-medium text-slate-500">احتمالية العميل الحقيقي</span>
                            <span className="font-bold" style={{ color }}>{leadScore.score}%</span>
                          </div>
                          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${leadScore.score}%`, backgroundColor: color }} />
                          </div>
                        </div>
                        <div className="flex gap-4 text-[13px]">
                          <span className="text-slate-400">p_junk: <b className="text-slate-600">{Math.round(leadScore.pJunk * 100)}%</b></span>
                          <span className="text-slate-400">p_clean: <b className="text-slate-600">{Math.round(leadScore.pClean * 100)}%</b></span>
                        </div>
                      </div>
                    </div>
                    <div className={`mt-5 rounded-xl p-3.5 text-center text-[14px] font-semibold ${leadScore.isJunk ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
                      {leadScore.isJunk ? "🚫 عميل محتمل جنك — أولوية منخفضة" : "✅ عميل واعد — يستحق المتابعة الفورية"}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-600">📍 {leadScore.source}</span>
                      <span className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${leadScore.hasCampaign ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        {leadScore.hasCampaign ? "💰 حملة مدفوعة" : "💰 عضوي"}
                      </span>
                      <span className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${leadScore.matched ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        {leadScore.matched ? "🏢 تم المطابقة" : "🏢 لم يطابق"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Activities & Tasks — Tabbed ───────────────── */}
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                {/* Tab bar */}
                <div className="flex border-b border-slate-100">
                  <button
                    onClick={() => setActiveTab("activities")}
                    className={`flex-1 py-4 text-center text-[14px] font-semibold transition ${
                      activeTab === "activities"
                        ? "border-b-2 border-emerald-600 text-emerald-700"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    النشاطات
                    {activities.length > 0 && <span className="mr-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-500">{activities.length}</span>}
                  </button>
                  <button
                    onClick={() => setActiveTab("tasks")}
                    className={`flex-1 py-4 text-center text-[14px] font-semibold transition ${
                      activeTab === "tasks"
                        ? "border-b-2 border-emerald-600 text-emerald-700"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    المهام
                    {tasks.length > 0 && <span className="mr-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-600">{tasks.length}</span>}
                  </button>
                </div>

                <div className="p-6">
                  {/* ── Activities Tab ── */}
                  {activeTab === "activities" && (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-[13px] text-slate-400">سجّل تواصلك مع العميل</p>
                        <button
                          onClick={() => setAddingActivity((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${addingActivity ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                        >
                          {addingActivity ? "✕ إلغاء" : "+ إضافة نشاط"}
                        </button>
                      </div>

                      {addingActivity && (
                        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
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
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400"><path fillRule="evenodd" d="M1 4.75C1 3.784 1.784 3 2.75 3h14.5c.966 0 1.75.784 1.75 1.75v10.515a1.75 1.75 0 01-1.75 1.75h-1.5a.75.75 0 01-.53-.22L13.06 14.5H2.75A1.75 1.75 0 011 12.75V4.75z" clipRule="evenodd" /></svg>
                          </div>
                          <p className="text-[14px] font-medium text-slate-500">لا توجد نشاطات مسجّلة</p>
                          <p className="mt-1 text-[13px] text-slate-400">ابدأ بتسجيل أول تواصل مع العميل</p>
                        </div>
                      ) : (
                        <div className="max-h-[420px] space-y-3 overflow-y-auto">
                          {activities.map((a) => (
                            <div key={a.id} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-200">
                              <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-100 text-[14px] text-emerald-600">
                                📞
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[14px] font-semibold text-slate-800">{a.activity_types?.label ?? "نشاط"}</span>
                                </div>
                                <p className="mt-0.5 text-[12px] text-slate-400">{formatDateTime(a.occurred_at)}</p>
                                {a.body && <p dir="auto" className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{a.body}</p>}
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
                        <p className="text-[13px] text-slate-400">المهام المرتبطة بهذا العميل</p>
                        <button
                          onClick={() => setAddingTask((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${addingTask ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                        >
                          {addingTask ? "✕ إلغاء" : "+ إضافة مهمة"}
                        </button>
                      </div>

                      {addingTask && (
                        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                          <input dir="auto" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="عنوان المهمة…" className={inputCls} />
                          <div className="grid grid-cols-2 gap-3">
                            <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className={inputCls} />
                            <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} className={inputCls} />
                          </div>
                          <select value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)} className={selectCls}>
                            <option value="">بدون نوع</option>
                            {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                          <button onClick={submitTask} disabled={savingTask} className={btnPrimary}>
                            {savingTask ? "جارِ الحفظ…" : "إضافة المهمة"}
                          </button>
                        </div>
                      )}

                      {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400"><path fillRule="evenodd" d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM1.99 4.75a1 1 0 011-1h.01a1 1 0 010 2h-.01a1 1 0 01-1-1zM1.99 10a1 1 0 011-1h.01a1 1 0 110 2h-.01a1 1 0 01-1-1zM1.99 15.25a1 1 0 011-1h.01a1 1 0 110 2h-.01a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                          </div>
                          <p className="text-[14px] font-medium text-slate-500">لا توجد مهام مفتوحة</p>
                          <p className="mt-1 text-[13px] text-slate-400">أضف مهمة لمتابعة هذا العميل</p>
                        </div>
                      ) : (
                        <div className="max-h-[420px] space-y-3 overflow-y-auto">
                          {tasks.map((t) => (
                            <div key={t.id} className={`group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-200 ${completingId === t.id ? "opacity-40" : ""}`}>
                              <button
                                onClick={() => setCompleteTarget(t)}
                                aria-label="إنهاء المهمة"
                                className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 border-slate-300 transition hover:border-emerald-500 hover:bg-emerald-50 group-hover:border-emerald-400"
                              />
                              <div className="min-w-0 flex-1">
                                <p dir="auto" className="text-[14px] font-semibold text-slate-800">{t.title || "مهمة بدون عنوان"}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  {t.task_types?.label && (
                                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">{t.task_types.label}</span>
                                  )}
                                  {t.due_at && (
                                    <span className="flex items-center gap-1 text-[12px] text-slate-400">
                                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M4 1.75a.75.75 0 01.75.75V3h6.5V2.5a.75.75 0 011.5 0V3h.25A2.75 2.75 0 0115.75 5.75v6.5A2.75 2.75 0 0113 15H3A2.75 2.75 0 01.25 12.25v-6.5A2.75 2.75 0 013 3h.25V2.5A.75.75 0 014 1.75z" clipRule="evenodd" /></svg>
                                      {formatDateTime(t.due_at)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
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
