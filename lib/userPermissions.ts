import { supabase } from "@/lib/supabase";

export type PermissionOverrides = Record<string, boolean>;

export async function fetchUserPermissions(userId: string): Promise<PermissionOverrides> {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("feature_key, allowed")
    .eq("user_id", userId);
  if (error) {
    console.error("[userPermissions] fetch failed", error);
    return {};
  }
  const map: PermissionOverrides = {};
  (data as { feature_key: string; allowed: boolean }[] | null)?.forEach((r) => {
    map[r.feature_key] = r.allowed;
  });
  return map;
}

export async function saveUserPermissions(
  userId: string,
  entries: { key: string; allowed: boolean }[],
): Promise<string | null> {
  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    user_id: userId,
    feature_key: e.key,
    allowed: e.allowed,
    updated_at: now,
  }));
  const { error } = await supabase.from("user_permissions").upsert(rows, { onConflict: "user_id,feature_key" });
  if (error) {
    console.error("[userPermissions] save failed", error);
    return error.message;
  }
  return null;
}
