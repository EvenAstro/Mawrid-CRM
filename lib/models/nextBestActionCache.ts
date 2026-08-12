import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Data-access layer for the `next_best_action_cache` table. Takes the
 * caller's Supabase client rather than importing one, since the route this
 * is used from constructs its own client scoped to the request.
 */

export interface CachedRecommendation {
  recommendation: unknown;
  generated_at: string;
  activity_count_at_generation: number;
}

export async function fetchCachedRecommendation(client: SupabaseClient, dealId: string): Promise<CachedRecommendation | null> {
  const { data } = await client
    .from("next_best_action_cache")
    .select("recommendation, generated_at, activity_count_at_generation")
    .eq("deal_id", dealId)
    .maybeSingle();
  return (data as CachedRecommendation | null) ?? null;
}

export async function upsertRecommendationCache(
  client: SupabaseClient,
  dealId: string,
  recommendation: unknown,
  generatedAt: string,
  activityCount: number,
): Promise<{ error: Error | null }> {
  const { error } = await client.from("next_best_action_cache").upsert({
    deal_id: dealId,
    recommendation,
    generated_at: generatedAt,
    activity_count_at_generation: activityCount,
  });
  return { error };
}
