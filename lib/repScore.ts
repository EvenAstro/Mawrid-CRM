import { supabase } from "@/lib/supabase";

export interface RepScoreData {
  score: number;
  tasksCompleted: number;
  tasksTotal: number;
  overdueTasks: number;
  contacts: number;
  dealsAdvanced: number;
  avgResponseHours: number | null;
  staleLeads: number;
  topCompletedTasks: { title: string; completedAt: string; note: string | null }[];
  missedTasks: { title: string; dueAt: string }[];
  staleLeadNames: { name: string; daysSince: number }[];
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

export async function calcRepScore(userId: string, dateStr?: string): Promise<RepScoreData> {
  const target = dateStr ? new Date(dateStr) : new Date();
  const dayStart = new Date(target);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const ds = dayStart.toISOString();
  const de = dayEnd.toISOString();

  const [tasksRes, completedRes, activitiesRes, dealsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_at, completed_at, completion_note")
      .eq("assignee_uid", userId)
      .lte("due_at", de)
      .gte("due_at", ds),
    supabase
      .from("tasks")
      .select("id, title, completed_at, completion_note")
      .eq("assignee_uid", userId)
      .gte("completed_at", ds)
      .lt("completed_at", de),
    supabase
      .from("activities")
      .select("id, entity_type, entity_id, occurred_at, created_at, direction")
      .eq("user_id", userId)
      .gte("occurred_at", ds)
      .lt("occurred_at", de),
    supabase
      .from("deals")
      .select("id, name, updated_at, lead_id, leads(full_name)")
      .is("deleted_at", null)
      .gte("updated_at", ds)
      .lt("updated_at", de),
  ]);

  type Task = { id: string; title: string | null; due_at: string | null; completed_at: string | null; completion_note: string | null };
  type CompTask = { id: string; title: string | null; completed_at: string | null; completion_note: string | null };
  type Activity = { id: string; entity_type: string; entity_id: string; occurred_at: string | null; created_at: string | null; direction: string | null };

  const dayTasks = (tasksRes.data as unknown as Task[]) ?? [];
  const completed = (completedRes.data as unknown as CompTask[]) ?? [];
  const activities = (activitiesRes.data as unknown as Activity[]) ?? [];

  const tasksTotal = dayTasks.length;
  const tasksCompleted = completed.length;
  const overdueTasks = dayTasks.filter((t) => !t.completed_at && t.due_at && new Date(t.due_at) < new Date()).length;

  const outboundActs = activities.filter((a) => a.direction === "outbound" || a.entity_type === "lead");
  const contacts = new Set(outboundActs.map((a) => a.entity_id)).size;

  const inboundActs = activities.filter((a) => a.direction === "inbound" && a.created_at && a.occurred_at);
  let avgResponseHours: number | null = null;
  if (inboundActs.length > 0) {
    const responseTimes = inboundActs
      .map((a) => {
        const occurred = new Date(a.occurred_at!).getTime();
        const created = new Date(a.created_at!).getTime();
        return Math.abs(created - occurred) / MS_PER_HOUR;
      })
      .filter((h) => h < 72);
    if (responseTimes.length > 0) {
      avgResponseHours = Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10;
    }
  }

  type Deal = { id: string; name: string | null; updated_at: string | null; lead_id: string | null; leads: { full_name: string | null } | null };
  const dealsAdvanced = ((dealsRes.data as unknown as Deal[]) ?? []).length;

  const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY);
  const { data: staleRes } = await supabase
    .from("deals")
    .select("id, name, updated_at, leads(full_name)")
    .is("deleted_at", null)
    .lt("updated_at", sevenDaysAgo.toISOString())
    .order("updated_at", { ascending: true })
    .limit(10);

  type StaleDeal = { id: string; name: string | null; updated_at: string | null; leads: { full_name: string | null } | null };
  const staleDealData = (staleRes as unknown as StaleDeal[]) ?? [];
  const staleLeads = staleDealData.length;
  const staleLeadNames = staleDealData.slice(0, 5).map((d) => ({
    name: d.leads?.full_name || d.name || "عميل",
    daysSince: Math.floor((Date.now() - new Date(d.updated_at || Date.now()).getTime()) / MS_PER_DAY),
  }));

  // Score calculation (0–100)
  const completionRate = tasksTotal > 0 ? tasksCompleted / tasksTotal : 1;
  const overdueRate = tasksTotal > 0 ? overdueTasks / tasksTotal : 0;
  const contactScore = Math.min(contacts / 5, 1);
  const dealScore = Math.min(dealsAdvanced / 2, 1);
  const responseScore = avgResponseHours !== null ? Math.max(0, 1 - avgResponseHours / 24) : 0.5;

  const score = Math.round(
    completionRate * 35 +
    (1 - overdueRate) * 20 +
    contactScore * 20 +
    dealScore * 15 +
    responseScore * 10,
  );

  const topCompletedTasks = completed.slice(0, 5).map((t) => ({
    title: t.title || "مهمة",
    completedAt: t.completed_at || "",
    note: t.completion_note,
  }));

  const missedTasks = dayTasks
    .filter((t) => !t.completed_at && t.due_at && new Date(t.due_at) < new Date())
    .slice(0, 5)
    .map((t) => ({ title: t.title || "مهمة", dueAt: t.due_at || "" }));

  return {
    score,
    tasksCompleted,
    tasksTotal,
    overdueTasks,
    contacts,
    dealsAdvanced,
    avgResponseHours,
    staleLeads,
    topCompletedTasks,
    missedTasks,
    staleLeadNames,
  };
}
