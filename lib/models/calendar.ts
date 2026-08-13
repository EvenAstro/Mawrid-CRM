import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Calendar data access — working hours and free-slot resolution.
 *
 * The RPC does the heavy lifting; both browser callers (the calendar
 * page, the settings page) and the WhatsApp agent's find_available_slots
 * tool go through here. The agent uses the admin client because the
 * webhook has no session; the browser uses the anon client and gets RLS.
 */

export interface WorkingHours {
  user_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export async function fetchWorkingHours(userId: string): Promise<WorkingHours[]> {
  const { data, error } = await supabase
    .from("user_working_hours")
    .select("*")
    .eq("user_id", userId)
    .order("weekday", { ascending: true });
  if (error) {
    console.error("[calendar] fetchWorkingHours failed", error);
    return [];
  }
  return (data as WorkingHours[]) ?? [];
}

export async function saveWorkingHours(userId: string, rows: WorkingHours[]): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase.from("user_working_hours").delete().eq("user_id", userId);
  if (delErr) return { error: delErr };
  if (!rows.length) return { error: null };
  const { error } = await supabase.from("user_working_hours").insert(rows);
  return { error };
}

export interface FreeSlot {
  starts_at: string;
  ends_at: string;
}

/** Browser-side (RLS'd) slot lookup — the calendar page uses it to pick a
 *  time when creating a task by hand. */
export async function fetchFreeSlotsClient(input: {
  userId: string;
  from: string;
  to: string;
  durationMinutes?: number;
  max?: number;
}) {
  return supabase.rpc("find_available_slots", {
    p_user_id: input.userId,
    p_from: input.from,
    p_to: input.to,
    p_duration_minutes: input.durationMinutes ?? 30,
    p_max_slots: input.max ?? 5,
  });
}

/** Server-side (service-role) slot lookup — the WhatsApp agent uses it
 *  through the find_available_slots tool before offering a demo time. */
export async function fetchFreeSlotsAdmin(input: {
  userId: string;
  from: string;
  to: string;
  durationMinutes?: number;
  max?: number;
}): Promise<FreeSlot[]> {
  const { data, error } = await supabaseAdmin.rpc("find_available_slots", {
    p_user_id: input.userId,
    p_from: input.from,
    p_to: input.to,
    p_duration_minutes: input.durationMinutes ?? 30,
    p_max_slots: input.max ?? 5,
  });
  if (error) {
    console.error("[calendar] fetchFreeSlotsAdmin failed", error);
    return [];
  }
  return (data as FreeSlot[]) ?? [];
}

/** Tasks with a due_at inside the range for the given user — the calendar
 *  reads these to draw the busy blocks. */
export async function fetchScheduledTasksClient(input: { userId: string; from: string; to: string }) {
  return supabase
    .from("tasks")
    .select("id, title, due_at, completed_at, lead_id, task_types(label, color)")
    .eq("assignee_uid", input.userId)
    .not("due_at", "is", null)
    .gte("due_at", input.from)
    .lte("due_at", input.to)
    .is("completed_at", null)
    .order("due_at", { ascending: true });
}
