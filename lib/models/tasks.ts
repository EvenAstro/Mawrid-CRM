import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Data-access layer for the `tasks` and `task_types` tables. */

export interface Task {
  id: string;
  title: string | null;
  description: string | null;
  due_at: string | null;
  entity_type: string | null;
  completion_note: string | null;
  assignee_uid: string | null;
  task_types: { label: string; color: string | null } | null;
}

export interface TaskType {
  id: string;
  label: string;
}

/**
 * Loads open tasks assigned to the given user (everyone, regardless of
 * role, only sees their own tasks) plus the list of task types.
 */
export async function fetchTasksPage(
  userId: string | null,
  limit: number,
): Promise<{ tasks: Task[]; total: number; types: TaskType[] }> {
  let tasksQuery = supabase
    .from("tasks")
    .select("*, task_types(label, color)", { count: "exact" })
    .is("completed_at", null)
    .order("due_at", { ascending: true })
    .range(0, limit - 1);
  if (userId) {
    tasksQuery = tasksQuery.eq("assignee_uid", userId);
  }

  const [tk, tt] = await Promise.all([tasksQuery, supabase.from("task_types").select("id, label")]);
  if (tk.error) throw tk.error;
  if (tt.error) throw tt.error;

  const tasks = (tk.data as unknown as Task[]) ?? [];
  return { tasks, total: tk.count ?? tasks.length, types: (tt.data as TaskType[]) ?? [] };
}

/** Marks a task complete with the given note. */
export async function completeTask(taskId: string, note: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("tasks")
    .update({ completed_at: new Date().toISOString(), completion_note: note })
    .eq("id", taskId);
  return { error };
}

export interface NewTaskInput {
  title: string;
  description: string | null;
  dueAt: string | null;
  taskTypeId: string | null;
  assigneeId: string | null;
}

/** Creates a new task. */
export async function createTask(input: NewTaskInput): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("tasks").insert({
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    due_at: input.dueAt,
    task_type_id: input.taskTypeId,
    assignee_uid: input.assigneeId,
    created_at: now,
    updated_at: now,
  });
  return { error };
}

/** Edits a task's title/due date. */
export async function editTask(taskId: string, title: string, dueAt: string | null): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("tasks")
    .update({ title, due_at: dueAt, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  return { error };
}

/** Soonest-due open tasks across the whole app — used by the dashboard home page. */
export async function fetchUpcomingTasks(limit: number) {
  return supabase.from("tasks").select("*").is("completed_at", null).order("due_at", { ascending: true }).limit(limit);
}

/** Marks a task complete without a note (dashboard home page's quick-complete). */
export async function completeTaskQuick(taskId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", taskId);
  return { error };
}

export interface NewLeadTaskInput {
  title: string;
  dueAt: string | null;
  taskTypeId: string | null;
  assigneeId: string | null;
  dependsOnTaskId: string | null;
  leadId: string | number;
}

/** Creates a task linked to a lead — used by LeadSlideOver's "add task" form. */
export async function createLeadTask(input: NewLeadTaskInput): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("tasks").insert({
    id: crypto.randomUUID(),
    title: input.title,
    description: null,
    due_at: input.dueAt,
    task_type_id: input.taskTypeId,
    assignee_uid: input.assigneeId,
    depends_on_task_id: input.dependsOnTaskId,
    lead_id: String(input.leadId),
    entity_type: "lead",
    entity_id: input.leadId,
    created_at: now,
    updated_at: now,
  });
  return { error };
}

/** Tasks due today for a user, for the daily briefing. */
export async function fetchTasksDueToday(userId: string, todayStr: string, tomorrowIso: string) {
  return supabase
    .from("tasks")
    .select("id, title, due_at, depends_on_task_id")
    .gte("due_at", todayStr)
    .lt("due_at", tomorrowIso)
    .is("completed_at", null)
    .eq("assignee_uid", userId)
    .order("due_at", { ascending: true });
}

/** A user's 5 most-overdue open tasks, for the daily briefing. */
export async function fetchOverdueTasks(userId: string, todayStr: string) {
  return supabase
    .from("tasks")
    .select("id, title, due_at, depends_on_task_id")
    .lt("due_at", todayStr)
    .is("completed_at", null)
    .eq("assignee_uid", userId)
    .order("due_at", { ascending: true })
    .limit(5);
}

/** Title/completion status for a batch of tasks — used to resolve "blocked by" dependencies. */
export async function fetchTasksByIds(ids: string[]) {
  return supabase.from("tasks").select("id, title, completed_at").in("id", ids);
}

/** Up to 200 open tasks app-wide, soonest-due first — used by the Copilot business snapshot. */
export async function fetchOpenTasksForSnapshot() {
  return supabaseAdmin.from("tasks").select("title, due_at").is("completed_at", null).order("due_at", { ascending: true }).limit(200);
}

/** Overdue open tasks for the rep-coach briefing. */
export async function fetchRepCoachOverdueTasks(userId: string, beforeIso: string) {
  return supabaseAdmin.from("tasks").select("id, title, due_at")
    .eq("assignee_uid", userId).lt("due_at", beforeIso).is("completed_at", null)
    .order("due_at", { ascending: true }).limit(10);
}

/** Tasks due today for the rep-coach briefing. */
export async function fetchRepCoachTodayTasks(userId: string, dayStartIso: string, dayEndIso: string) {
  return supabaseAdmin.from("tasks").select("id, title, due_at")
    .eq("assignee_uid", userId).gte("due_at", dayStartIso).lt("due_at", dayEndIso).is("completed_at", null)
    .order("due_at", { ascending: true }).limit(10);
}

/** Tasks due tomorrow through N days out, for the rep-coach briefing. */
export async function fetchRepCoachUpcomingTasks(userId: string, fromIso: string, toIso: string) {
  return supabaseAdmin.from("tasks").select("id, title, due_at")
    .eq("assignee_uid", userId).gte("due_at", fromIso).lte("due_at", toIso).is("completed_at", null)
    .order("due_at", { ascending: true }).limit(10);
}

/** Tasks completed today, for the rep-coach briefing. */
export async function fetchRepCoachCompletedToday(userId: string, dayStartIso: string, dayEndIso: string) {
  return supabaseAdmin.from("tasks").select("id, title, completed_at")
    .eq("assignee_uid", userId).gte("completed_at", dayStartIso).lt("completed_at", dayEndIso).limit(20);
}

/** Open tasks with no due date, for the rep-coach briefing. */
export async function fetchRepCoachNoDueDateTasks(userId: string) {
  return supabaseAdmin.from("tasks").select("id, title, created_at")
    .eq("assignee_uid", userId).is("due_at", null).is("completed_at", null)
    .order("created_at", { ascending: false }).limit(10);
}

/** Count of tasks completed yesterday, for the rep-coach briefing's streak calc. */
export async function fetchRepCoachYesterdayCompletedIds(userId: string, yesterdayStartIso: string, todayStartIso: string) {
  return supabaseAdmin.from("tasks").select("id").eq("assignee_uid", userId)
    .gte("completed_at", yesterdayStartIso).lt("completed_at", todayStartIso);
}

/** Open tasks linked to a lead (by either lead_id or entity_id/type), for LeadSlideOver. */
export async function fetchLeadOpenTasks(leadId: string | number) {
  const filter = `lead_id.eq.${leadId},and(entity_id.eq.${leadId},entity_type.eq.lead)`;
  return supabase.from("tasks").select("*, task_types(label, color)").or(filter).is("completed_at", null)
    .order("due_at", { ascending: true, nullsFirst: false }).limit(30);
}

/** Completed tasks linked to a lead, for LeadSlideOver. */
export async function fetchLeadCompletedTasks(leadId: string | number) {
  const filter = `lead_id.eq.${leadId},and(entity_id.eq.${leadId},entity_type.eq.lead)`;
  return supabase.from("tasks").select("*, task_types(label, color)").or(filter).not("completed_at", "is", null)
    .order("completed_at", { ascending: false }).limit(20);
}

/** Every task linked to a lead (compact fields), for LeadSlideOver's dependency-chain logic. */
export async function fetchLeadAllTasksCompact(leadId: string | number) {
  const filter = `lead_id.eq.${leadId},and(entity_id.eq.${leadId},entity_type.eq.lead)`;
  return supabase.from("tasks").select("id, title, completed_at, depends_on_task_id, lead_id").or(filter)
    .order("due_at", { ascending: true, nullsFirst: false }).limit(50);
}

/** Marks a lead-linked task complete with a note. */
export async function completeLeadTask(taskId: string, note: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("tasks").update({ completed_at: new Date().toISOString(), completion_note: note }).eq("id", taskId);
  return { error };
}

/** Tasks completed since a date, by assignee — used by the rep leaderboard. */
export async function fetchCompletedTasksSince(sinceIso: string) {
  return supabase.from("tasks").select("assignee_uid, completed_at").not("completed_at", "is", null).gte("completed_at", sinceIso);
}

/** A user's overdue open tasks, newest-due-first, for the notifications dropdown. */
export async function fetchNotifOverdueTasks(userId: string, beforeIso: string) {
  return supabase.from("tasks").select("id, title, due_at")
    .lt("due_at", beforeIso).is("completed_at", null).eq("assignee_uid", userId)
    .order("due_at", { ascending: false }).limit(5);
}

/** A user's tasks due today, for the notifications dropdown. */
export async function fetchNotifTodayTasks(userId: string, dayStartIso: string, dayEndIso: string) {
  return supabase.from("tasks").select("id, title, due_at")
    .gte("due_at", dayStartIso).lt("due_at", dayEndIso).is("completed_at", null).eq("assignee_uid", userId)
    .order("due_at", { ascending: true }).limit(5);
}

/** Open tasks linked to any of these deals, by either deal_id or the generic
 * entity_type/entity_id pair. Returns the deal ids that have one — the health
 * score only needs existence, not the tasks themselves. */
export async function fetchOpenTaskDealIds(dealIds: string[]) {
  return supabase
    .from("tasks")
    .select("entity_id")
    .eq("entity_type", "deal")
    .in("entity_id", dealIds)
    .is("completed_at", null);
}

/** Open tasks on one deal, for the deal panel. */
export async function fetchDealOpenTasks(dealId: string) {
  return supabase
    .from("tasks")
    .select("id, title, due_at, completed_at")
    .eq("entity_type", "deal")
    .eq("entity_id", dealId)
    .is("completed_at", null)
    .order("due_at", { ascending: true })
    .limit(10);
}
