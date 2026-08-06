import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
export async function fetchProfileGreetingName(client: SupabaseClient, userId: string) {
  return client.from("profiles").select("first_name, full_name").eq("id", userId).maybeSingle();
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
