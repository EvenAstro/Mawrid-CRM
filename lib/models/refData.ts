import { supabase } from "@/lib/supabase";

/**
 * Data-access layer for small reference/lookup tables shared across forms —
 * pipeline stages, sources, activity types, task types, and junk reasons.
 */

export interface Source {
  id: string;
  label: string;
}

/** Active lead sources, ordered for a dropdown. */
export async function fetchActiveSources(): Promise<Source[]> {
  const { data, error } = await supabase.from("sources").select("id, label").eq("is_archived", false).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as Source[]) ?? [];
}

/** All lead sources (including archived) — used where the caller filters itself. */
export async function fetchAllSources(): Promise<{ id: string; label: string }[]> {
  const { data, error } = await supabase.from("sources").select("id, label");
  if (error) throw error;
  return data ?? [];
}

export interface PipelineStage {
  id: string;
  label: string;
  terminal_type: string | null;
}

/** All pipeline stages, across both the lead and deal pipelines. */
export async function fetchAllPipelineStages(): Promise<PipelineStage[]> {
  const { data, error } = await supabase.from("pipeline_stages").select("id, label, terminal_type");
  if (error) throw error;
  return (data as PipelineStage[]) ?? [];
}

/** Stages for a single pipeline ("lead" or "deal"), ordered for display. */
export async function fetchPipelineStages(pipeline: "lead" | "deal"): Promise<{ id: string; label: string }[]> {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id, label")
    .eq("pipeline", pipeline)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ActivityType {
  id: string;
  label: string;
}

/** Active activity types, ordered for a dropdown. */
export async function fetchActiveActivityTypes(): Promise<ActivityType[]> {
  const { data, error } = await supabase.from("activity_types").select("id, label").eq("is_archived", false).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as ActivityType[]) ?? [];
}

export interface JunkReason {
  id: string;
  label: string;
}

/** All junk reasons, for the "mark as junk" picker. */
export async function fetchJunkReasons(): Promise<JunkReason[]> {
  const { data, error } = await supabase.from("junk_reasons").select("id, label");
  if (error) throw error;
  return (data as JunkReason[]) ?? [];
}

export interface TaskTypeRef {
  id: string;
  label: string;
}

/** All task types, for a dropdown. */
export async function fetchTaskTypes(): Promise<TaskTypeRef[]> {
  const { data, error } = await supabase.from("task_types").select("id, label");
  if (error) throw error;
  return (data as TaskTypeRef[]) ?? [];
}
