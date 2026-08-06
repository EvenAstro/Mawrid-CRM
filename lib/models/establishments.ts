import { supabase } from "@/lib/supabase";

/** Data-access layer for the `establishments` (companies) table. */

export interface Establishment {
  id: string;
  name: string;
}

/** Loads up to 500 active establishments for a company picker. */
export async function fetchEstablishments(): Promise<Establishment[]> {
  const { data, error } = await supabase
    .from("establishments")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data as Establishment[]) ?? [];
}
