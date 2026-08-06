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
