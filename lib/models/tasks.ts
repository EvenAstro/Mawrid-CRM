import { supabase } from "@/lib/supabase";

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
