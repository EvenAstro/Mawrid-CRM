import {
  listActiveDoctors,
  findDoctorsByName,
  openSlotsForDoctor,
  bookSlot,
  myUpcomingBookings,
} from "@/lib/models/whatsappBooking";

/**
 * The sandbox agent's toolset — OpenAI/OpenRouter tool-calling schema plus
 * the executor that runs the one the model picked. Kept together so a new
 * tool can't be defined without also being wired to a handler.
 */

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_doctors",
      description: "يرجع قائمة كل الأطباء المتاحين اليوم بالعيادة مع تخصصهم.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "check_doctor_availability",
      description:
        "يتحقق من موعد طبيب معين بالاسم: هل هو مداوم، وإذا كان مداوم يرجع المواعيد المتاحة (غير محجوزة) اليوم. استخدمه أول ما العميل يسأل عن دكتور بالاسم.",
      parameters: {
        type: "object",
        properties: {
          doctor_name: { type: "string", description: "اسم الطبيب كما ذكره العميل، حتى لو جزء من الاسم" },
        },
        required: ["doctor_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_slot",
      description: "يحجز موعد محدد (slot_id) لعميل باسمه. استخدمه فقط بعد ما العميل يختار موعد ويأكد اسمه.",
      parameters: {
        type: "object",
        properties: {
          slot_id: { type: "string", description: "معرّف الموعد اللي رجع من check_doctor_availability" },
          patient_name: { type: "string", description: "اسم العميل اللي بيحجز باسمه" },
        },
        required: ["slot_id", "patient_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_bookings",
      description: "يرجع كل المواعيد القادمة المحجوزة من نفس رقم الواتساب اللي يراسل الآن.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
] as const;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-SA", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Riyadh",
  });
}

/** Runs one tool call and returns the string to feed back to the model as
 *  the tool result. Never throws — a tool failure becomes a result the
 *  model can talk about, not a crashed request. */
export async function runTool(name: string, rawArgs: string, waFrom: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return JSON.stringify({ error: "invalid arguments" });
  }

  try {
    switch (name) {
      case "list_doctors": {
        const doctors = await listActiveDoctors();
        return JSON.stringify(doctors.map((d) => ({ name: d.name, specialty: d.specialty })));
      }

      case "check_doctor_availability": {
        const query = String(args.doctor_name ?? "").trim();
        if (!query) return JSON.stringify({ error: "doctor_name required" });
        const matches = await findDoctorsByName(query);
        const doctor = matches.find((d) => d.active) ?? matches[0];
        if (!doctor) return JSON.stringify({ found: false });
        if (!doctor.active) {
          return JSON.stringify({ found: true, name: doctor.name, active: false, message: "هذا الطبيب غير مداوم" });
        }
        const slots = await openSlotsForDoctor(doctor.id);
        return JSON.stringify({
          found: true,
          name: doctor.name,
          specialty: doctor.specialty,
          active: true,
          available_slots: slots.map((s) => ({ slot_id: s.id, time: fmtTime(s.slot_time) })),
        });
      }

      case "book_slot": {
        const slotId = String(args.slot_id ?? "");
        const patientName = String(args.patient_name ?? "").trim();
        if (!slotId || !patientName) return JSON.stringify({ error: "slot_id and patient_name required" });
        const result = await bookSlot(slotId, waFrom, patientName);
        return JSON.stringify(result);
      }

      case "list_my_bookings": {
        const bookings = await myUpcomingBookings(waFrom);
        return JSON.stringify(
          bookings.map((b) => ({ doctor: b.doctor_name, time: fmtTime(b.slot_time), patient: b.patient_name })),
        );
      }

      default:
        return JSON.stringify({ error: `unknown tool ${name}` });
    }
  } catch (err) {
    console.error(`[whatsapp agent] tool ${name} threw`, err);
    return JSON.stringify({ error: "internal error" });
  }
}
