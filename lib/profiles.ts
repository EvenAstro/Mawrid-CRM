import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type Role = "admin" | "manager" | "sales";

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  role: Role;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, email, role")
    .order("full_name", { ascending: true });
  if (error) {
    console.error("[profiles] fetchProfiles failed", error);
    return [];
  }
  return (data as Profile[]) || [];
}

export async function fetchCurrentProfile(): Promise<Profile | null> {
  let userRes;
  try {
    ({ data: userRes } = await supabase.auth.getUser());
  } catch (err) {
    console.warn("[profiles] getUser failed", err);
    return null;
  }
  if (!userRes.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, email, role")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (error) {
    console.error("[profiles] fetchCurrentProfile failed", error);
    return null;
  }
  return (data as Profile | null) ?? null;
}

/** Updates a user's role. */
export async function updateProfileRole(profileId: string, role: Role): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", profileId);
  return { error };
}

/**
 * Belt-and-suspenders profile upsert right after signup — the DB trigger
 * creates this row too, but this covers the case where the trigger isn't
 * set up yet on a given Supabase project.
 */
export async function upsertProfileFromSignup(userId: string, firstName: string, lastName: string, email: string): Promise<void> {
  await supabase.from("profiles").upsert({
    id: userId,
    first_name: firstName,
    last_name: lastName,
    email,
  });
}

/** First name / full name only, for a personalized greeting — used by rep-coach. */
export async function fetchProfileGreetingName(userId: string) {
  return supabaseAdmin.from("profiles").select("first_name, full_name").eq("id", userId).maybeSingle();
}

/** A single profile's role — used by admin routes to authorize the caller/target. */
export async function fetchProfileRole(client: SupabaseClient, userId: string): Promise<Role | undefined> {
  const { data } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role;
}

/** Updates a profile's basic info (name/email) — used after an admin edits a teammate's account. */
export async function updateProfileInfo(
  client: SupabaseClient,
  userId: string,
  info: { firstName: string; lastName: string; email: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("profiles")
    .update({ first_name: info.firstName, last_name: info.lastName, email: info.email, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return { error };
}

/** Creates or overwrites a profile row with role — used by the admin create-user route. */
export async function upsertProfileWithRole(
  client: SupabaseClient,
  userId: string,
  info: { firstName: string; lastName: string; email: string; role: Role },
): Promise<{ error: Error | null }> {
  const { error } = await client.from("profiles").upsert({
    id: userId,
    first_name: info.firstName,
    last_name: info.lastName,
    email: info.email,
    role: info.role,
    updated_at: new Date().toISOString(),
  });
  return { error };
}

/** Every profile with a display name, for server-side context builders.
 * Admin client because API routes carry no browser session. */
export async function fetchProfilesAdmin(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, full_name, email");
  if (error) {
    console.error("[profiles] fetchProfilesAdmin failed", error);
    return [];
  }
  return ((data as Profile[]) ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "مستخدم",
  }));
}

/** Display name for one user id — used by the Supervisor to address them. */
export async function fetchProfileName(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("first_name, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const p = data as { first_name: string | null; full_name: string | null; email: string | null };
  return p.first_name || p.full_name || p.email || null;
}
