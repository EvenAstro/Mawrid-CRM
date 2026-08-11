import { money } from "@/lib/format";
import { fetchLeadsForSnapshot } from "@/lib/models/leads";
import { fetchDealsForSnapshot } from "@/lib/models/deals";
import { fetchActivitiesByEntityIdsAdmin, fetchRecentActivitiesAdmin, fetchLatestActivityTimestamp } from "@/lib/models/activities";
import { fetchOpenTasksForSnapshot } from "@/lib/models/tasks";
import { fetchConversationsForSnapshot, fetchConversationMembersForSnapshot } from "@/lib/models/conversations";
import { fetchRecentMessagesForSnapshot } from "@/lib/models/messages";
import { fetchProfilesAdmin } from "@/lib/profiles";

const DAY_MS = 86_400_000;
const STUCK_DAYS = 7;
const CHUNK_SIZE = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Row shapes ──────────────────────────────────────────────────────────────
interface LeadRow {
  id: string;
  junk_reason_id: number | null;
  created_at: string | null;
  sources: { label: string | null } | null;
}
interface DealRow {
  id: string;
  name: string | null;
  owner_id: string | null;
  lead_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  currency_code: string | null;
  probability_pct: number | null;
  created_at: string | null;
  updated_at: string | null;
  pipeline_stages: { label: string | null; terminal_type: string | null } | null;
  lost_reasons: { label: string | null } | null;
}
interface ActivityRow {
  entity_type: string | null;
  entity_id: string | null;
  body: string | null;
  direction: string | null;
  occurred_at: string | null;
  activity_types: { label: string | null } | null;
}
interface TaskRow {
  title: string | null;
  due_at: string | null;
}

export interface StuckDeal {
  id: string;
  name: string;
  stage: string;
  days: number;
  valueSAR: number;
}

export interface SnapshotSections {
  team: string;
  chat: string;
  leads: string;
  dealsOverview: string;
  closest: string;
  stuck: string;
  lost: string;
  weekly: string;
  activities: string;
  tasks: string;
}

export interface SnapshotStats {
  totalLeads: number;
  activeDeals: number;
  pipelineValueSAR: number;
  stuckCount: number;
}

export interface BusinessSnapshot {
  /** Compact always-on context (leads totals, deal counts, pipeline, weekly). */
  overview: string;
  /** Named detail sections — the route includes only what the question needs. */
  sections: SnapshotSections;
  /** Headline numbers for the Copilot full-page snapshot bar. */
  stats: SnapshotStats;
  stuckCount: number;
  upcomingCount: number;
  stuckDeals: StuckDeal[];
}

function valueSAR(d: DealRow): number {
  const minor = d.won_value_minor ?? d.expected_value_minor;
  return minor == null ? 0 : Math.round(minor / 100);
}

async function fetchActivitiesFor(dealIds: string[], leadIds: string[]): Promise<ActivityRow[]> {
  const out: ActivityRow[] = [];
  for (const c of chunk(dealIds, CHUNK_SIZE)) {
    if (!c.length) continue;
    const { data } = await fetchActivitiesByEntityIdsAdmin("deal", c);
    if (data) out.push(...(data as unknown as ActivityRow[]));
  }
  for (const c of chunk(leadIds, CHUNK_SIZE)) {
    if (!c.length) continue;
    const { data } = await fetchActivitiesByEntityIdsAdmin("lead", c);
    if (data) out.push(...(data as unknown as ActivityRow[]));
  }
  return out;
}

/**
 * Builds a live snapshot of the business for the Copilot system prompt.
 *
 * Time windows ("stuck 7+ days", "due in 48h") are anchored to the dataset's
 * latest activity date — not wall-clock now — because this CRM's data is
 * historical; anchoring to now would mark every deal stuck and every task past.
 */
export async function buildSnapshot(): Promise<BusinessSnapshot> {
  const [
    leadsRes, dealsRes, recentActsRes, latestActRes, tasksRes,
    profiles, convsRes, membersRes, msgsRes,
  ] = await Promise.all([
    fetchLeadsForSnapshot(),
    fetchDealsForSnapshot(),
    fetchRecentActivitiesAdmin(12),
    fetchLatestActivityTimestamp(),
    fetchOpenTasksForSnapshot(),
    fetchProfilesAdmin(),
    fetchConversationsForSnapshot(),
    fetchConversationMembersForSnapshot(),
    fetchRecentMessagesForSnapshot(40),
  ]);

  const leads = (leadsRes.data as unknown as LeadRow[]) ?? [];
  const deals = (dealsRes.data as unknown as DealRow[]) ?? [];
  const recentActs = (recentActsRes.data as unknown as ActivityRow[]) ?? [];
  const tasks = (tasksRes.data as unknown as TaskRow[]) ?? [];

  const latestActIso = (latestActRes.data as { occurred_at: string | null }[] | null)?.[0]?.occurred_at ?? null;
  const dataNow = latestActIso ? new Date(latestActIso).getTime() : Date.now();

  // ── Leads ────────────────────────────────────────────────────────────────
  const totalLeads = leads.length;
  const cleanLeads = leads.filter((l) => l.junk_reason_id == null).length;
  const junkLeads = totalLeads - cleanLeads;

  const bySource = new Map<string, number>();
  for (const l of leads) {
    const s = l.sources?.label || "غير محدد";
    bySource.set(s, (bySource.get(s) ?? 0) + 1);
  }
  const leadsBySource = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${s}: ${n}`)
    .join(" · ");

  // ── Deals ────────────────────────────────────────────────────────────────
  const activeDeals = deals.filter((d) => d.pipeline_stages?.terminal_type == null);
  const wonDeals = deals.filter((d) => d.pipeline_stages?.terminal_type === "won");
  const lostDeals = deals.filter((d) => d.pipeline_stages?.terminal_type === "lost");
  const pipelineValue = activeDeals.reduce((s, d) => s + valueSAR(d), 0);

  const stageCount = new Map<string, number>();
  for (const d of activeDeals) {
    const label = d.pipeline_stages?.label || "غير محدد";
    stageCount.set(label, (stageCount.get(label) ?? 0) + 1);
  }
  const dealsByStage = [...stageCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${s}: ${n}`)
    .join(" · ");

  const recentLostDeals = [...lostDeals]
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .slice(0, 5)
    .map((d) => `${d.name || "بدون اسم"} — ${d.lost_reasons?.label || "بدون سبب"} — SAR ${money(valueSAR(d))}`)
    .join("\n");

  // Ranked by the rep's own estimate, then value. probability_pct is typed by
  // hand in the new-deal form — nothing computes it — so this ordering is a
  // sort of the team's opinion, not a model output, and the prompt says so.
  const closest = [...activeDeals]
    .sort((a, b) => (b.probability_pct ?? -1) - (a.probability_pct ?? -1) || valueSAR(b) - valueSAR(a))
    .slice(0, 5)
    .map(
      (d) =>
        `${d.name || "بدون اسم"} — ${d.pipeline_stages?.label || "—"} — تقدير المندوب ${
          d.probability_pct != null ? d.probability_pct + "%" : "غير محددة"
        } — SAR ${money(valueSAR(d))}`,
    )
    .join("\n");

  // Weekly performance, anchored to the dataset's latest activity (not wall-clock).
  const weekStart = dataNow - 7 * DAY_MS;
  const inWeek = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= weekStart && t <= dataNow;
  };
  const newLeads7 = leads.filter((l) => inWeek(l.created_at)).length;
  const newDeals7 = deals.filter((d) => inWeek(d.created_at)).length;
  const won7 = wonDeals.filter((d) => inWeek(d.updated_at)).length;
  const lost7 = lostDeals.filter((d) => inWeek(d.updated_at)).length;

  // ── Stuck deals (no activity in 7+ days, anchored to dataNow) ─────────────
  const activeIds = activeDeals.map((d) => d.id);
  const activeLeadIds = activeDeals.map((d) => d.lead_id).filter((id): id is string => !!id);
  const acts = await fetchActivitiesFor(activeIds, activeLeadIds);

  const lastActByEntity = new Map<string, number>();
  for (const a of acts) {
    if (!a.entity_type || !a.entity_id || !a.occurred_at) continue;
    const key = `${a.entity_type}:${a.entity_id}`;
    const t = new Date(a.occurred_at).getTime();
    if (!lastActByEntity.has(key) || t > lastActByEntity.get(key)!) lastActByEntity.set(key, t);
  }

  const stuck: StuckDeal[] = [];
  for (const d of activeDeals) {
    const dealLast = lastActByEntity.get(`deal:${d.id}`) ?? 0;
    const leadLast = d.lead_id ? lastActByEntity.get(`lead:${d.lead_id}`) ?? 0 : 0;
    const last = Math.max(dealLast, leadLast) || (d.created_at ? new Date(d.created_at).getTime() : 0);
    if (!last) continue;
    const days = Math.floor((dataNow - last) / DAY_MS);
    if (days >= STUCK_DAYS) {
      stuck.push({
        id: d.id,
        name: d.name || "بدون اسم",
        stage: d.pipeline_stages?.label || "غير محدد",
        days,
        valueSAR: valueSAR(d),
      });
    }
  }
  stuck.sort((a, b) => b.days - a.days);
  const stuckTop = stuck.slice(0, 6);

  // ── Recent activities ────────────────────────────────────────────────────
  const recentActivities = recentActs
    .map((a) => {
      const when = a.occurred_at ? new Date(a.occurred_at).toLocaleDateString("en-CA") : "——";
      const body = (a.body || a.activity_types?.label || "نشاط").slice(0, 80);
      return `- [${a.direction ?? "?"}] ${when}: ${body}`;
    })
    .join("\n");

  // ── Upcoming tasks (within 48h of dataNow) ───────────────────────────────
  const windowEnd = dataNow + 2 * DAY_MS;
  const dated = tasks.filter((t) => t.due_at);
  let upcoming = dated.filter((t) => {
    const due = new Date(t.due_at as string).getTime();
    return due >= dataNow && due <= windowEnd;
  });
  // Historical fallback: if the 48h window is empty, show the soonest upcoming ones.
  if (upcoming.length === 0) {
    upcoming = dated.filter((t) => new Date(t.due_at as string).getTime() >= dataNow).slice(0, 5);
  }
  const upcomingTasks = upcoming.length
    ? upcoming
        .map((t) => `- ${t.title || "مهمة"} — ${t.due_at ? new Date(t.due_at).toLocaleDateString("en-CA") : "——"}`)
        .join("\n")
    : "(لا توجد مهام قادمة)";

  const stuckList = stuckTop.length
    ? stuckTop.map((s) => `- ${s.name} — ${s.stage} — ${s.days} يوم — SAR ${money(s.valueSAR)}`).join("\n")
    : "(لا توجد صفقات عالقة)";

  const overview = `نظرة عامة:
- العملاء المحتملون: الإجمالي ${totalLeads} (نظيف ${cleanLeads} · جانك ${junkLeads})
- الصفقات: نشطة ${activeDeals.length} · مربوحة ${wonDeals.length} · مخسورة ${lostDeals.length}
- قيمة الـ Pipeline النشطة: SAR ${money(pipelineValue)}
- صفقات عالقة (بلا نشاط ${STUCK_DAYS}+ أيام): ${stuck.length}`;

  // ── Team ─────────────────────────────────────────────────────────────────
  // Who owns what. The assistant was asked account-wide questions and had no
  // owner dimension at all, the same gap proposal 67 filled in the UI.
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));
  const dealsByOwner = new Map<string, { open: number; won: number; lost: number; valueSAR: number }>();
  for (const d of deals) {
    const key = d.owner_id ?? "—";
    const acc = dealsByOwner.get(key) ?? { open: 0, won: 0, lost: 0, valueSAR: 0 };
    const t = d.pipeline_stages?.terminal_type ?? null;
    if (t === "won") acc.won++;
    else if (t === "lost") acc.lost++;
    else {
      acc.open++;
      acc.valueSAR += valueSAR(d);
    }
    dealsByOwner.set(key, acc);
  }
  const teamLines = [...dealsByOwner.entries()]
    .sort((a, b) => b[1].valueSAR - a[1].valueSAR)
    .map(([id, a]) =>
      `- ${nameById.get(id) ?? (id === "—" ? "بدون مالك" : "مستخدم محذوف")}: ${a.open} مفتوحة (SAR ${money(a.valueSAR)}) · ${a.won} مربوحة · ${a.lost} مخسورة`,
    )
    .join("\n");

  // ── Internal chat ────────────────────────────────────────────────────────
  const convs = (convsRes.data as { id: string; kind: string; title: string | null; created_at: string | null; last_message_at: string | null }[] | null) ?? [];
  const members = (membersRes.data as { conversation_id: string; user_id: string }[] | null) ?? [];
  const msgs = (msgsRes.data as { conversation_id: string; sender_id: string | null; body: string | null; created_at: string | null }[] | null) ?? [];
  const membersByConv = new Map<string, string[]>();
  for (const m of members) {
    const arr = membersByConv.get(m.conversation_id) ?? [];
    arr.push(nameById.get(m.user_id) ?? "عضو");
    membersByConv.set(m.conversation_id, arr);
  }
  const convLines = convs.slice(0, 15).map((c) => {
    const who = (membersByConv.get(c.id) ?? []).join("، ") || "—";
    const label = c.kind === "group" ? `مجموعة «${c.title ?? "بدون اسم"}»` : c.kind === "dm" ? "محادثة مباشرة" : `نقاش مرتبط بـ${c.kind}`;
    return `- ${label} — الأعضاء: ${who}`;
  }).join("\n");
  const msgLines = msgs.slice(0, 15).map((m) => {
    const body = (m.body ?? "").replace(/\s+/g, " ").slice(0, 120);
    return `- ${nameById.get(m.sender_id ?? "") ?? "مستخدم"}: ${body}`;
  }).join("\n");

  const sections: SnapshotSections = {
    team: `فريق العمل وتوزيع الصفقات:
${teamLines || "(لا يوجد)"}`,
    chat: `المحادثات الداخلية بين أعضاء الفريق — الإجمالي ${convs.length} محادثة، ${msgs.length} رسالة أخيرة:
${convLines || "(لا توجد محادثات)"}

آخر الرسائل:
${msgLines || "(لا توجد رسائل)"}`,
    leads: `العملاء المحتملون:
- الإجمالي: ${totalLeads} (نظيف ${cleanLeads} · جانك ${junkLeads})
- توزيع حسب المصدر: ${leadsBySource || "—"}`,
    dealsOverview: `الصفقات:
- نشطة: ${activeDeals.length} · مربوحة: ${wonDeals.length} · مخسورة: ${lostDeals.length}
- قيمة الـ Pipeline النشطة: SAR ${money(pipelineValue)}
- توزيع الصفقات النشطة حسب المرحلة: ${dealsByStage || "—"}`,
    closest: `أقرب الصفقات للإغلاق (مرتبة حسب تقدير المندوب نفسه، وهو رقم يكتبه يدوياً وليس محسوباً):
${closest || "(لا يوجد)"}`,
    stuck: `صفقات عالقة (بلا نشاط ${STUCK_DAYS}+ أيام) — الإجمالي ${stuck.length}:
${stuckList}`,
    lost: `آخر ${Math.min(5, lostDeals.length)} صفقات مخسورة:
${recentLostDeals || "(لا يوجد)"}`,
    weekly: `أداء آخر 7 أيام (منتهية بأحدث نشاط في النظام):
- عملاء محتملون جدد: ${newLeads7}
- صفقات جديدة: ${newDeals7}
- صفقات مربوحة: ${won7} · صفقات مخسورة: ${lost7}
- قيمة الـ Pipeline الحالية: SAR ${money(pipelineValue)}`,
    activities: `الأنشطة الأخيرة:
${recentActivities || "(لا يوجد)"}`,
    tasks: `المهام القادمة:
${upcomingTasks}`,
  };

  return {
    overview,
    sections,
    stats: {
      totalLeads,
      activeDeals: activeDeals.length,
      pipelineValueSAR: pipelineValue,
      stuckCount: stuck.length,
    },
    stuckCount: stuck.length,
    upcomingCount: upcoming.length,
    stuckDeals: stuckTop,
  };
}
