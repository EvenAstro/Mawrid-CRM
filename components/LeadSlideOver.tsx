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
interface ActivityType {
  id: string;
  label: string;
}
interface JunkReason {
  id: number | string;
  label: string;
}
interface DealStage {
  id: string;
  label: string;
}
interface Task {
  id: string;
  title: string | null;
  description: string | null;
  due_at: string | null;
  task_types: { label: string; color: string | null } | null;
}
interface TaskType {
  id: string;
  label: string;
}

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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#94a3b8]">{label}</p>
      <p dir="auto" className="mt-0.5 text-[15px] font-medium text-[#1e1b4b]">{value || "—"}</p>
    </div>
  );
}

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

  // Quick-outcome UI state
  const [outcomeMode, setOutcomeMode] = useState<"responded" | "junk" | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);

  // Activity inline form
  const [addingActivity, setAddingActivity] = useState(false);
  const [actTypeId, setActTypeId] = useState("");
  const [actDirection, setActDirection] = useState<"outbound" | "inbound">("outbound");
  const [actDate, setActDate] = useState(todayInput());
  const [actTime, setActTime] = useState(nowTimeInput());
  const [actNotes, setActNotes] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  // Task inline form
  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskTime, setTaskTime] = useState("09:00");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [dealOpen, setDealOpen] = useState(false);

  const open = lead != null;

  useEffect(() => {
    if (lead) setShown(lead);
  }, [lead]);

  async function refetchActivities(leadId: string | number) {
    const { data } = await supabase
      .from("activities")
      .select("*, activity_types(label)")
      .eq("entity_id", leadId)
      .eq("entity_type", "lead")
      .order("occurred_at", { ascending: false })
      .limit(20);
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

    const fetchLeadDetails = async () => {
      const [tps, , , , , , ] = await Promise.all([
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
        pJunk: result.pJunk,
        pClean: 1 - result.pJunk,
        score: result.score,
        isJunk: result.pJunk >= 0.5,
        hasCampaign: has_campaign,
        matched,
        source,
      });
    };

    fetchLeadDetails();
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
  const color = leadScore ? scoreColor(leadScore.score) : "#1a5c4f";

  const isJunkLead = !!data?.junk_reason_id;
  const isResponded = data?.contact_outcome === "responded";
  const isNoResponse = data?.contact_outcome === "no_response";
  const canConvert = !!data && !isJunkLead && isResponded;

  function patchShown(patch: Partial<Lead>) {
    setShown((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function markResponded(activityTypeId: string) {
    if (!data) return;
    setSavingOutcome(true);
    const now = new Date().toISOString();
    const t = activityTypes.find((x) => x.id === activityTypeId);
    const activityId = crypto.randomUUID();
    const { data: userData } = await supabase.auth.getUser();
    const { error: actErr } = await supabase.from("activities").insert({
      id: activityId,
      entity_type: "lead",
      entity_id: data.id,
      activity_type_id: activityTypeId,
      body: null,
      direction: "inbound",
      occurred_at: now,
      user_id: userData.user?.id ?? null,
      created_at: now,
      updated_at: now,
    });
    const { error: leadErr } = await supabase
      .from("leads")
      .update({ contact_outcome: "responded", contact_outcome_at: now, updated_at: now })
      .eq("id", data.id);
    setSavingOutcome(false);
    if (actErr || leadErr) {
      console.error("[LeadSlideOver] markResponded failed", actErr, leadErr);
      toast("تعذّر حفظ التصنيف", "error");
      return;
    }
    toast(`تم تسجيل الرد عبر ${t?.label ?? "اتصال"}`);
    patchShown({ contact_outcome: "responded", contact_outcome_at: now });
    setOutcomeMode(null);
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
    if (error) {
      console.error("[LeadSlideOver] markNoResponse failed", error);
      toast("تعذّر حفظ التصنيف", "error");
      return;
    }
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
    if (error) {
      console.error("[LeadSlideOver] markJunk failed", error);
      toast("تعذّر حفظ التصنيف", "error");
      return;
    }
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
      id: crypto.randomUUID(),
      entity_type: "lead",
      entity_id: data.id,
      activity_type_id: actTypeId,
      body: actNotes.trim() || null,
      direction: actDirection,
      occurred_at: occurred,
      user_id: userData.user?.id ?? null,
      created_at: now,
      updated_at: now,
    });
    setSavingActivity(false);
    if (error) {
      console.error("[LeadSlideOver] submitActivity failed", error);
      toast("تعذّر تسجيل النشاط", "error");
      return;
    }
    toast("تم تسجيل النشاط");
    setActTypeId("");
    setActNotes("");
    setActDirection("outbound");
    setActDate(todayInput());
    setActTime(nowTimeInput());
    setAddingActivity(false);
    refetchActivities(data.id);
  }

  async function submitTask() {
    if (!data) return;
    if (!taskTitle.trim()) { toast("اكتب عنوان المهمة", "error"); return; }
    setSavingTask(true);
    const now = new Date().toISOString();
    const dueAt = taskDue ? new Date(`${taskDue}T${taskTime || "09:00"}:00`).toISOString() : null;
    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      title: taskTitle.trim(),
      description: null,
      due_at: dueAt,
      task_type_id: taskTypeId || null,
      entity_type: "lead",
      entity_id: data.id,
      created_at: now,
      updated_at: now,
    });
    setSavingTask(false);
    if (error) {
      console.error("[LeadSlideOver] submitTask failed", error);
      toast("تعذّر إضافة المهمة", "error");
      return;
    }
    toast("تمت إضافة المهمة");
    setTaskTitle("");
    setTaskDue("");
    setTaskTime("09:00");
    setTaskTypeId("");
    setAddingTask(false);
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
    if (error) {
      console.error("[LeadSlideOver] completeTask failed", error);
      toast("تعذّر إنهاء المهمة", "error");
      return;
    }
    toast("تم إنهاء المهمة");
    setCompleteTarget(null);
    refetchTasks(data.id);
  }

  const outcomeBadge = isJunkLead
    ? { label: "جنك", cls: "bg-red-50 text-red-700" }
    : isResponded
    ? { label: "رد العميل", cls: "bg-emerald-50 text-emerald-700" }
    : isNoResponse
    ? { label: "لم يرد", cls: "bg-amber-50 text-amber-700" }
    : { label: "جديد", cls: "bg-slate-100 text-slate-600" };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* Panel — wider than before */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[820px] flex-col border-l border-[#e8ece9] bg-[#f8fafc] shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {data && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#e8ece9] bg-white p-6">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-xl font-bold text-white">
                  {initials(data.full_name)}
                </span>
                <div className="min-w-0">
                  <h2 dir="auto" className="truncate text-2xl font-bold text-[#1e1b4b]">{data.full_name || "Unnamed lead"}</h2>
                  <p className="text-[15px] text-[#94a3b8]">{data.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${outcomeBadge.cls}`}>{outcomeBadge.label}</span>
                <button onClick={onClose} aria-label="Close" className="text-[#94a3b8] transition hover:text-[#334155]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
              {/* AI Next Best Action */}
              <NextBestActionCard dealId={String(data.id)} entityType="lead" hideWhenEmpty />

              {/* ─── Quick Outcome bar ────────────────────────────── */}
              <div className="rounded-2xl border border-[#e8ece9] bg-white p-5">
                <h3 className="mb-3 text-[15px] font-semibold text-[#1e1b4b]">تصنيف التواصل</h3>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => setOutcomeMode(outcomeMode === "responded" ? null : "responded")}
                    className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[14px] font-semibold transition ${
                      outcomeMode === "responded" || isResponded ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-[#e8ece9] text-[#334155] hover:border-emerald-300"
                    }`}
                  >
                    ✅ رد العميل
                  </button>
                  <button
                    onClick={markNoResponse}
                    disabled={savingOutcome}
                    className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[14px] font-semibold transition disabled:opacity-60 ${
                      isNoResponse ? "border-amber-500 bg-amber-50 text-amber-700" : "border-[#e8ece9] text-[#334155] hover:border-amber-300"
                    }`}
                  >
                    ⏳ لم يرد
                  </button>
                  <button
                    onClick={() => setOutcomeMode(outcomeMode === "junk" ? null : "junk")}
                    className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[14px] font-semibold transition ${
                      outcomeMode === "junk" || isJunkLead ? "border-red-500 bg-red-50 text-red-700" : "border-[#e8ece9] text-[#334155] hover:border-red-300"
                    }`}
                  >
                    🚫 جنك
                  </button>

                  {canConvert && (
                    <button
                      onClick={() => setDealOpen(true)}
                      className="mr-auto flex items-center gap-1.5 rounded-xl bg-[#1a5c4f] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-[#1a5c4f]/25 transition hover:bg-[#15503f]"
                    >
                      ➜ تحويل إلى صفقة
                    </button>
                  )}
                </div>

                {/* Method chips for "responded" */}
                {outcomeMode === "responded" && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e8ece9] pt-4">
                    <span className="w-full text-[13px] font-medium text-[#94a3b8]">طريقة الرد:</span>
                    {activityTypes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => markResponded(t.id)}
                        disabled={savingOutcome}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reason chips for "junk" */}
                {outcomeMode === "junk" && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e8ece9] pt-4">
                    <span className="w-full text-[13px] font-medium text-[#94a3b8]">السبب:</span>
                    {junkReasons.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => markJunk(r.id)}
                        disabled={savingOutcome}
                        className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 1 — Lead info */}
              <div className="rounded-2xl border border-[#e8ece9] bg-white p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name" value={data.full_name} />
                  <Field label="Company" value={data.establishment_name ?? null} />
                  <Field label="Stage" value={data.pipeline_stages?.label ?? null} />
                  <Field label="Source" value={data.sources?.label ?? null} />
                  <Field label="Phone" value={data.phone} />
                  <Field label="Email" value={data.email} />
                  <Field label="Owner" value={data.owner} />
                  <Field label="Created" value={formatDate(data.created_at)} />
                  <div className="col-span-2">
                    <Field label="Notes" value={data.notes ?? null} />
                  </div>
                </div>
              </div>

              {/* Section 2 — AI Analysis */}
              {!leadScore && (
                <div className="flex items-center gap-3 rounded-2xl border border-[#e8ece9] bg-white p-5">
                  <svg className="h-5 w-5 animate-spin text-[#1a5c4f]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  <span className="text-[15px] font-medium text-[#334155]">Calculating AI lead score…</span>
                </div>
              )}
              {leadScore && (
                <div className="rounded-2xl border border-[#e8ece9] bg-gradient-to-br from-[#1a5c4f]/10 to-transparent p-5">
                  <h3 className="mb-4 font-semibold text-[#1e1b4b]">🤖 AI Lead Score</h3>
                  <div className="flex items-center gap-5">
                    <div className="relative flex-none">
                      <svg width="80" height="80" className="-rotate-90">
                        <circle cx="40" cy="40" r={R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                        <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - leadScore.score / 100)}
                          style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold" style={{ color }}>
                        {leadScore.score}%
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#94a3b8]">Clean Lead Probability</p>
                      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div className="h-full rounded-full" style={{ width: `${leadScore.score}%`, backgroundColor: color, transition: "width 0.5s ease" }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[13px] text-[#94a3b8]">
                        <span>p_junk: {Math.round(leadScore.pJunk * 100)}%</span>
                        <span>p_clean: {Math.round(leadScore.pClean * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className={`mt-4 rounded-xl border p-3 text-center text-[15px] font-medium ${leadScore.isJunk ? "border-red-100 bg-red-50 text-red-700" : "border-green-100 bg-green-50 text-green-700"}`}>
                    {leadScore.isJunk ? "🚫 Likely Junk Lead — Low sales priority" : "✅ Promising Lead — Worth immediate follow-up"}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[13px] text-[#334155]">📍 {leadScore.source}</span>
                    {leadScore.hasCampaign ? (
                      <span className="rounded-full bg-[#f0faf8] px-3 py-1 text-[13px] text-[#1a5c4f]">💰 Paid Campaign</span>
                    ) : (
                      <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[13px] text-[#94a3b8]">💰 Organic</span>
                    )}
                    {leadScore.matched ? (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-[13px] text-green-700">🏢 Company Matched</span>
                    ) : (
                      <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[13px] text-[#94a3b8]">🏢 No Match</span>
                    )}
                  </div>
                </div>
              )}

              {/* Section 3 + 4 side by side */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Activities */}
                <div className="rounded-2xl border border-[#e8ece9] bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-[#1e1b4b]">النشاطات</h3>
                    <button onClick={() => setAddingActivity((v) => !v)} className="text-[13px] font-semibold text-[#1a5c4f] hover:underline">
                      {addingActivity ? "إلغاء" : "+ إضافة"}
                    </button>
                  </div>

                  {addingActivity && (
                    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e8ece9] bg-[#f8fafc] p-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setActDirection("outbound")} className={`h-9 flex-1 rounded-lg border text-[13px] font-semibold transition ${actDirection === "outbound" ? "border-[#1a5c4f] bg-[#f0faf8] text-[#1a5c4f]" : "border-[#e8ece9] text-[#334155]"}`}>
                          اتصلت بالعميل
                        </button>
                        <button type="button" onClick={() => setActDirection("inbound")} className={`h-9 flex-1 rounded-lg border text-[13px] font-semibold transition ${actDirection === "inbound" ? "border-[#1a5c4f] bg-[#f0faf8] text-[#1a5c4f]" : "border-[#e8ece9] text-[#334155]"}`}>
                          رد العميل
                        </button>
                      </div>
                      <select value={actTypeId} onChange={(e) => setActTypeId(e.target.value)} className="h-10 rounded-lg border border-[#e8ece9] bg-white px-3 text-[13px] text-[#334155]">
                        <option value="">اختر النوع…</option>
                        {activityTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="h-10 flex-1 rounded-lg border border-[#e8ece9] bg-white px-3 text-[13px] text-[#334155]" />
                        <input type="time" value={actTime} onChange={(e) => setActTime(e.target.value)} className="h-10 flex-1 rounded-lg border border-[#e8ece9] bg-white px-3 text-[13px] text-[#334155]" />
                      </div>
                      <textarea dir="auto" value={actNotes} onChange={(e) => setActNotes(e.target.value)} rows={2} placeholder="ملاحظات…" className="rounded-lg border border-[#e8ece9] bg-white px-3 py-2 text-[13px] text-[#334155]" />
                      <button onClick={submitActivity} disabled={savingActivity} className="h-9 rounded-lg bg-[#1a5c4f] text-[13px] font-semibold text-white transition hover:bg-[#15503f] disabled:opacity-60">
                        {savingActivity ? "جارِ الحفظ…" : "حفظ النشاط"}
                      </button>
                    </div>
                  )}

                  {activities.length === 0 ? (
                    <p className="text-[13px] text-[#94a3b8]">لا توجد نشاطات مسجّلة</p>
                  ) : (
                    <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto">
                      {activities.map((a) => (
                        <div key={a.id} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 flex-none rounded-full bg-[#1a5c4f]" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[#1e1b4b]">{a.activity_types?.label ?? "Activity"}</span>
                              <span className="text-[12px] text-[#94a3b8]">{formatDateTime(a.occurred_at)}</span>
                            </div>
                            {a.body && <p dir="auto" className="text-[13px] text-[#94a3b8]">{a.body}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tasks */}
                <div className="rounded-2xl border border-[#e8ece9] bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-[#1e1b4b]">المهام</h3>
                    <button onClick={() => setAddingTask((v) => !v)} className="text-[13px] font-semibold text-[#1a5c4f] hover:underline">
                      {addingTask ? "إلغاء" : "+ إضافة"}
                    </button>
                  </div>

                  {addingTask && (
                    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e8ece9] bg-[#f8fafc] p-4">
                      <input dir="auto" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="عنوان المهمة…" className="h-10 rounded-lg border border-[#e8ece9] bg-white px-3 text-[13px] text-[#334155]" />
                      <div className="flex gap-2">
                        <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="h-10 flex-1 rounded-lg border border-[#e8ece9] bg-white px-3 text-[13px] text-[#334155]" />
                        <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} className="h-10 flex-1 rounded-lg border border-[#e8ece9] bg-white px-3 text-[13px] text-[#334155]" />
                      </div>
                      <select value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)} className="h-10 rounded-lg border border-[#e8ece9] bg-white px-3 text-[13px] text-[#334155]">
                        <option value="">بدون نوع</option>
                        {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <button onClick={submitTask} disabled={savingTask} className="h-9 rounded-lg bg-[#1a5c4f] text-[13px] font-semibold text-white transition hover:bg-[#15503f] disabled:opacity-60">
                        {savingTask ? "جارِ الحفظ…" : "إضافة المهمة"}
                      </button>
                    </div>
                  )}

                  {tasks.length === 0 ? (
                    <p className="text-[13px] text-[#94a3b8]">لا توجد مهام مفتوحة</p>
                  ) : (
                    <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
                      {tasks.map((t) => (
                        <div key={t.id} className={`flex items-start gap-2.5 rounded-xl border border-[#e8ece9] bg-[#f8fafc] p-3 ${completingId === t.id ? "opacity-50" : ""}`}>
                          <button onClick={() => setCompleteTarget(t)} aria-label="Complete task" className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-[#94a3b8] transition hover:border-[#1a5c4f]" />
                          <div className="min-w-0 flex-1">
                            <p dir="auto" className="text-[13px] font-medium text-[#1e1b4b]">{t.title || "Untitled task"}</p>
                            <div className="mt-1 flex items-center gap-2">
                              {t.task_types?.label && <span className="rounded-full bg-[#f0faf8] px-2 py-0.5 text-[11px] font-semibold text-[#1a5c4f]">{t.task_types.label}</span>}
                              {t.due_at && <span className="text-[11px] text-[#94a3b8]">{formatDateTime(t.due_at)}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

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
