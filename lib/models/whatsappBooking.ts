import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Data access for the sandbox booking domain the WhatsApp agent's tools act
 * on. Admin client only — this is called from tool execution inside the
 * webhook route, which has no browser session. See the migration for the
 * shape and why it's sandboxed.
 */

export interface DoctorRow {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
}

export interface SlotRow {
  id: string;
  doctor_id: string;
  slot_time: string;
  is_booked: boolean;
}

export async function listActiveDoctors(): Promise<DoctorRow[]> {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_doctors")
    .select("id, name, specialty, active")
    .eq("active", true)
    .order("name");
  if (error) {
    console.error("[whatsapp booking] listActiveDoctors failed", error);
    return [];
  }
  return (data as DoctorRow[]) ?? [];
}

/** Doctors whose name loosely matches — the model passes free text, not an id. */
export async function findDoctorsByName(query: string): Promise<DoctorRow[]> {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_doctors")
    .select("id, name, specialty, active")
    .ilike("name", `%${query}%`);
  if (error) {
    console.error("[whatsapp booking] findDoctorsByName failed", error);
    return [];
  }
  return (data as DoctorRow[]) ?? [];
}

/** Open (unbooked, future) slots for one doctor, soonest first. */
export async function openSlotsForDoctor(doctorId: string): Promise<SlotRow[]> {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_slots")
    .select("id, doctor_id, slot_time, is_booked")
    .eq("doctor_id", doctorId)
    .eq("is_booked", false)
    .gte("slot_time", new Date().toISOString())
    .order("slot_time")
    .limit(10);
  if (error) {
    console.error("[whatsapp booking] openSlotsForDoctor failed", error);
    return [];
  }
  return (data as SlotRow[]) ?? [];
}

/**
 * Books a slot atomically — the WHERE is_booked=false guard means two
 * concurrent bookings for the same slot can't both succeed, same as a real
 * scheduler needs.
 */
export async function bookSlot(
  slotId: string,
  waFrom: string,
  patientName: string,
): Promise<{ ok: boolean; reason?: string }> {
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("_whatsapp_agent_slots")
    .update({ is_booked: true })
    .eq("id", slotId)
    .eq("is_booked", false)
    .select("id")
    .maybeSingle();
  if (updateErr) {
    console.error("[whatsapp booking] slot update failed", updateErr);
    return { ok: false, reason: "خطأ بالنظام" };
  }
  if (!updated) return { ok: false, reason: "الموعد هذا محجوز بالفعل" };

  const { error: insertErr } = await supabaseAdmin
    .from("_whatsapp_agent_bookings")
    .insert({ slot_id: slotId, wa_from: waFrom, patient_name: patientName });
  if (insertErr) {
    // Roll back the slot so it doesn't look taken with no booking behind it.
    await supabaseAdmin.from("_whatsapp_agent_slots").update({ is_booked: false }).eq("id", slotId);
    console.error("[whatsapp booking] booking insert failed", insertErr);
    return { ok: false, reason: "خطأ بالنظام" };
  }
  return { ok: true };
}

export interface BookingWithDoctor {
  slot_time: string;
  patient_name: string;
  doctor_name: string;
}

/** This WhatsApp number's upcoming bookings. */
export async function myUpcomingBookings(waFrom: string): Promise<BookingWithDoctor[]> {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_bookings")
    .select("patient_name, slot:_whatsapp_agent_slots(slot_time, doctor:_whatsapp_agent_doctors(name))")
    .eq("wa_from", waFrom);
  if (error) {
    console.error("[whatsapp booking] myUpcomingBookings failed", error);
    return [];
  }
  type Row = {
    patient_name: string;
    slot: { slot_time: string; doctor: { name: string } | null } | null;
  };
  return ((data as unknown as Row[]) ?? [])
    .filter((r) => r.slot && new Date(r.slot.slot_time) >= new Date())
    .map((r) => ({
      slot_time: r.slot!.slot_time,
      patient_name: r.patient_name,
      doctor_name: r.slot!.doctor?.name ?? "غير معروف",
    }))
    .sort((a, b) => a.slot_time.localeCompare(b.slot_time));
}
