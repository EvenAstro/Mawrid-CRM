import { supabase } from "@/lib/supabase";
import { fetchTasksDueToday, fetchOverdueTasks, fetchTasksByIds } from "@/lib/models/tasks";
import { fetchStaleDealsForBriefing } from "@/lib/models/deals";
import { fetchActivityTimestampsByEntityIds } from "@/lib/models/activities";

export interface BriefingTask {
  id: string;
  title: string | null;
  due_at: string | null;
  depends_on_task_id: string | null;
  isBlocked?: boolean;
  blockedByTitle?: string | null;
}

export interface StuckDeal {
  id: string;
  name: string | null;
  leadName: string | null;
  daysSinceContact: number;
  expectedValueMinor: number | null;
}

export interface BriefingData {
  todayTasks: BriefingTask[];
  overdueTasks: BriefingTask[];
  stuckDeals: StuckDeal[];
}

const MS_PER_DAY = 86_400_000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Fetches morning-briefing data: today's tasks, overdue tasks, and deals stale 7+ days. */
export async function fetchBriefingData(): Promise<BriefingData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;

  const [todayRes, overdueRes, dealsRes] = await Promise.all([
<<<<<<< HEAD
    supabase
      .from("tasks")
      .select("id, title, due_at, depends_on_task_id")
      .gte("due_at", todayStr)
      .lt("due_at", tomorrow.toISOString())
      .is("completed_at", null)
      .eq("assignee_uid", userId ?? "")
      .order("due_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, due_at, depends_on_task_id")
      .lt("due_at", todayStr)
      .is("completed_at", null)
      .eq("assignee_uid", userId ?? "")
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("deals")
      .select("id, name, lead_id, updated_at, expected_value_minor, leads(full_name), pipeline_stages(terminal_type)")
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(30),
=======
    fetchTasksDueToday(userId ?? "", todayStr, tomorrow.toISOString()),
    fetchOverdueTasks(userId ?? "", todayStr),
    fetchStaleDealsForBriefing(),
>>>>>>> main
  ]);

  let todayTasks = (todayRes.data as unknown as BriefingTask[]) ?? [];
  let overdueTasks = (overdueRes.data as unknown as BriefingTask[]) ?? [];

  const allBriefingTasks = [...todayTasks, ...overdueTasks];
  const depIds = allBriefingTasks.map((t) => t.depends_on_task_id).filter((id): id is string => !!id);
  if (depIds.length > 0) {
<<<<<<< HEAD
    const { data: depData } = await supabase
      .from("tasks")
      .select("id, title, completed_at")
      .in("id", depIds);
=======
    const { data: depData } = await fetchTasksByIds(depIds);
>>>>>>> main
    const depMap = new Map((depData as { id: string; title: string | null; completed_at: string | null }[] ?? []).map((d) => [d.id, d]));
    function markBlocked(tasks: BriefingTask[]): BriefingTask[] {
      return tasks.map((t) => {
        if (!t.depends_on_task_id) return t;
        const dep = depMap.get(t.depends_on_task_id);
        if (dep && !dep.completed_at) return { ...t, isBlocked: true, blockedByTitle: dep.title };
        return t;
      });
    }
    todayTasks = markBlocked(todayTasks);
    overdueTasks = markBlocked(overdueTasks);
  }

  type RawDeal = {
    id: string;
    name: string | null;
    lead_id: string | null;
    updated_at: string | null;
    expected_value_minor: number | null;
    leads: { full_name: string | null } | null;
    pipeline_stages: { terminal_type: string | null } | null;
  };
  const activeDeals = ((dealsRes.data as unknown as RawDeal[]) ?? []).filter(
    (d) => d.pipeline_stages?.terminal_type == null,
  );

  const dealIds = activeDeals.map((d) => d.id);
  const leadIds = activeDeals.map((d) => d.lead_id).filter((id): id is string => !!id);

  const lastActivityAt = new Map<string, string>();
  const [dealActRes, leadActRes] = await Promise.all([
    dealIds.length
      ? Promise.all(chunk(dealIds, 50).map((c) => fetchActivityTimestampsByEntityIds("deal", c)))
      : Promise.resolve([]),
    leadIds.length
      ? Promise.all(chunk(leadIds, 50).map((c) => fetchActivityTimestampsByEntityIds("lead", c)))
      : Promise.resolve([]),
  ]);
  type Act = { entity_type: string; entity_id: string; occurred_at: string | null };
  type ActRes = { data: unknown };
  const allActs: Act[] = [
    ...(dealActRes as ActRes[]).flatMap((r) => (r.data as unknown as Act[]) ?? []),
    ...(leadActRes as ActRes[]).flatMap((r) => (r.data as unknown as Act[]) ?? []),
  ];
  for (const a of allActs) {
    if (!a.occurred_at) continue;
    const key = `${a.entity_type}:${a.entity_id}`;
    const prev = lastActivityAt.get(key);
    if (!prev || a.occurred_at > prev) lastActivityAt.set(key, a.occurred_at);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY);
  const stuckDeals: StuckDeal[] = [];
  for (const d of activeDeals) {
    const dealLast = lastActivityAt.get(`deal:${d.id}`);
    const leadLast = d.lead_id ? lastActivityAt.get(`lead:${d.lead_id}`) : undefined;
    const candidates = [dealLast, leadLast, d.updated_at].filter((v): v is string => !!v);
    const lastTouch = candidates.length ? candidates.reduce((a, b) => (a > b ? a : b)) : null;
    if (!lastTouch) continue;
    const lastTouchDate = new Date(lastTouch);
    if (lastTouchDate <= sevenDaysAgo) {
      const days = Math.floor((Date.now() - lastTouchDate.getTime()) / MS_PER_DAY);
      stuckDeals.push({
        id: d.id,
        name: d.name,
        leadName: d.leads?.full_name ?? null,
        daysSinceContact: days,
        expectedValueMinor: d.expected_value_minor,
      });
    }
  }
  stuckDeals.sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  return { todayTasks, overdueTasks, stuckDeals: stuckDeals.slice(0, 10) };
}
