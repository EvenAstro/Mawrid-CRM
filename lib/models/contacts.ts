import { supabase } from "@/lib/supabase";

/** Data-access layer for the `contacts` table. */

export interface Contact {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: string | null;
  notes: string | null;
  created_at: string | null;
  establishment_id: string | null;
  establishments: { name: string } | null;
}

/** Loads one page of contacts (newest first), plus the total row count. */
export async function fetchContactsPage(limit: number): Promise<{ contacts: Contact[]; total: number }> {
  const { data, error, count } = await supabase
    .from("contacts")
    .select("*, establishments(name)", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(0, limit - 1);
  if (error) throw error;
  const contacts = (data as unknown as Contact[]) ?? [];
  return { contacts, total: count ?? contacts.length };
}

/** Loads a single contact by id — used for deep-linked contacts not on the current page. */
export async function fetchContactById(id: string): Promise<Contact | null> {
  const { data, error } = await supabase.from("contacts").select("*, establishments(name)").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Contact) ?? null;
}

/** Soft-deletes the given contacts. */
export async function softDeleteContacts(ids: string[]): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).in("id", ids);
  return { error };
}
