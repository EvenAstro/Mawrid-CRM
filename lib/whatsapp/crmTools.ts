import {
  type CrmLeadContext,
  createLeadFromWhatsApp,
  createWhatsAppTask,
  appendLeadNotes,
  logWhatsAppActivity,
} from "@/lib/models/whatsappCrmContext";
import { playbookFor, sizeAdvice } from "@/lib/whatsapp/mawridKnowledge";
import { resolveLeadAssignment, setLeadOwner } from "@/lib/models/leadAssignmentRules";
import { fetchFreeSlotsAdmin } from "@/lib/models/calendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/resend";

/**
 * Tools the WhatsApp agent can act with.
 *
 * Two kinds live here. `recommend_solution` is pure knowledge lookup — it
 * reads lib/whatsapp/mawridKnowledge.ts and returns the industry playbook
 * so a small model doesn't have to invent which of 16 modules a restaurant
 * cares about. Everything else writes to the real CRM.
 *
 * The toolset offered depends on whether the sender's number matched an
 * existing lead (resolved once, up front, in agent.ts) — a stranger can't
 * fish for someone else's deal status, and an existing lead can't be
 * re-created. `ctx.lead` is mutated in place when create_qualified_lead
 * succeeds, so a schedule_demo call later in the same tool-calling turn
 * attaches to the lead that was just created.
 */

export interface CrmToolCtx {
  waFrom: string;
  lead: CrmLeadContext | null;
}

/** Offered to everyone: knowing what Mawrid can do for your business isn't
 *  privileged information, and it's the tool that makes the agent useful
 *  rather than merely polite. */
const SHARED_TOOLS = [
  {
    type: "function",
    function: {
      name: "recommend_solution",
      description:
        "يرجع لك تحليل جاهز لقطاع العميل: مشاكله الشائعة، وحدات مَوْرد اللي تحلها، والنتيجة المتوقعة، وسؤال ذكي تسأله بعدها. استخدمه فوراً أول ما تعرف نوع نشاط العميل — لا تخمّن الوحدات بنفسك.",
      parameters: {
        type: "object",
        properties: {
          business_type: { type: "string", description: "نوع نشاط العميل بكلماته، مثلاً: مطعم، متجر إلكتروني، مكتب عقاري" },
          size: { type: "string", description: "عدد الموظفين أو الفروع إن ذكره، وإلا اتركه فاضي" },
        },
        required: ["business_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description:
        "يرجع لك ٣ مواعيد فاضية بتقويم مندوب العميل ضمن الأيام القادمة. استخدمه قبل ما تعرض على العميل موعد للعرض التوضيحي — لا تقترح وقت بنفسك مثل 'بكرة الصبح' من رأسك. لازم يكون العميل عنده مندوب معيّن (لعميل موجود بالنظام أو بعد create_qualified_lead).",
      parameters: {
        type: "object",
        properties: {
          within_days: { type: "number", description: "خلال كم يوم من اليوم تبحث عن مواعيد — ٧ افتراضياً" },
        },
        required: [],
      },
    },
  },
] as const;

const TOOLS_FOR_EXISTING_LEAD = [
  ...SHARED_TOOLS,
  {
    type: "function",
    function: {
      name: "get_customer_status",
      description: "يرجع حالة العميل الحالية: مرحلته، صفقاته المفتوحة، وآخر تواصل معه. استخدمه أول ما يسأل 'وين وصلت معي؟' أو مشابه.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description:
        "يضيف ملاحظة على ملف العميل يشوفها مندوبه لاحقاً — استخدمه لأي تفصيل يذكره العميل يحتاج المندوب يعرفه (سبب اعتراض، طلب تعديل، ملاحظة عامة). سجّل بدون ما تستأذن العميل.",
      parameters: {
        type: "object",
        properties: { note: { type: "string", description: "نص الملاحظة بصيغة واضحة ومختصرة" } },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_discovery",
      description:
        "يحفظ معلومة جديدة عرفتها عن منشأة العميل (نوع النشاط، الحجم، الأنظمة الحالية، ما يبحث عنه) على ملفه بشكل دائم. استخدمه كل ما العميل يعطيك معلومة جوهرية عن شغله.",
      parameters: {
        type: "object",
        properties: {
          business_type: { type: "string", description: "نوع النشاط إن ذكره" },
          size: { type: "string", description: "عدد الموظفين/الفروع إن ذكره" },
          current_system: { type: "string", description: "النظام اللي يستخدمه حالياً إن ذكره" },
          interest: { type: "string", description: "وش يبحث عنه أو وش يزعجه بالضبط" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_demo",
      description:
        "يحجز عرض توضيحي بتقويم المندوب فعلياً وينشئ مهمة عليه. الطريقة الصح: استخدم find_available_slots أولاً، اعرض المواعيد للعميل، ولما يختار واحد ناديني بـslot_at = قيمة starts_at للموعد اللي اختاره. لو العميل ذكر وقت مو ضمن المواعيد المقترحة، ناديني بـpreferred_time بس بدون slot_at وبنسجل طلب مفتوح.",
      parameters: {
        type: "object",
        properties: {
          slot_at: {
            type: "string",
            description: "توقيت ISO للموعد اللي اختاره العميل من find_available_slots. مفضل يكون موجود.",
          },
          preferred_time: {
            type: "string",
            description: "الوقت اللي ذكره العميل بكلماته — للسجل والإيميل، حتى لو slot_at موجود.",
          },
          notes: { type: "string", description: "ملخص وش يبي يشوفه بالعرض" },
        },
        required: ["preferred_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_help",
      description: "ينبّه المندوب المسؤول فوراً (إيميل + تسجيل بملف العميل) إن العميل يحتاج تدخل بشري — شكوى، طلب لا تقدر تحسمه بنفسك.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "سبب الطلب بجملة مختصرة" },
          urgent: { type: "boolean", description: "true لو العميل يطلب رد سريع/عاجل أو كانت شكوى" },
        },
        required: ["reason", "urgent"],
      },
    },
  },
] as const;

const TOOLS_FOR_NEW_PROSPECT = [
  ...SHARED_TOOLS,
  {
    type: "function",
    function: {
      name: "create_qualified_lead",
      description:
        "ينشئ عميل محتمل جديد بالنظام بعد ما تجمع معلومات كافية عنه (اسمه + نشاطه + اهتمامه). لا تستخدمه إلا بعد ما يبدي اهتمام حقيقي ويعطيك اسمه — مو لمجرد سؤال عام.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          company_name: { type: "string", description: "اسم منشأته إن ذكرها، وإلا اتركه فاضي" },
          business_type: { type: "string", description: "نوع نشاطه" },
          size: { type: "string", description: "حجم منشأته إن ذكره" },
          notes: { type: "string", description: "ملخص اهتمامه: وش يبي بالضبط ووش يزعجه حالياً" },
        },
        required: ["full_name", "notes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_demo",
      description:
        "يحجز عرض توضيحي أو مكالمة وينشئ مهمة حقيقية عند فريق المبيعات. لازم تستخدم create_qualified_lead قبله. استخدمه أول ما العميل يوافق على مكالمة ويذكر وقت يناسبه.",
      parameters: {
        type: "object",
        properties: {
          preferred_time: { type: "string", description: "الوقت اللي ذكره العميل بكلماته" },
          days_from_now: { type: "number", description: "كم يوم من اليوم يقع الموعد تقريباً — 0 لليوم، 1 لبكرة" },
          notes: { type: "string", description: "ملخص وش يبي يشوفه بالعرض" },
        },
        required: ["preferred_time", "days_from_now"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_help",
      description: "ينبّه فريق المبيعات إن هذا العميل المحتمل جاهز يتكلم مع مندوب بشري. استخدمه بعد create_qualified_lead.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "سبب الطلب بجملة مختصرة، مثلاً: يبي عرض توضيحي" },
          urgent: { type: "boolean" },
        },
        required: ["reason", "urgent"],
      },
    },
  },
] as const;

export function toolsFor(ctx: CrmToolCtx) {
  return ctx.lead ? TOOLS_FOR_EXISTING_LEAD : TOOLS_FOR_NEW_PROSPECT;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "غير معروف";
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long", timeZone: "Asia/Riyadh" });
}

async function notifyOwnerEmail(ownerEmail: string | null, subject: string, bodyHtml: string) {
  if (!ownerEmail) return;
  await sendEmail({ to: ownerEmail, subject, html: bodyHtml });
}

/** Turns the model's rough "how many days out" into a real timestamp, at
 *  10am Riyadh — a demo slot, not midnight. Clamped so a hallucinated 900
 *  can't park a task three years out. */
function dueDateFrom(daysFromNow: unknown): string {
  const raw = typeof daysFromNow === "number" ? daysFromNow : Number(daysFromNow);
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 0), 30) : 1;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(7, 0, 0, 0); // 10:00 Riyadh (UTC+3)
  return d.toISOString();
}

export async function runCrmTool(name: string, rawArgs: string, ctx: CrmToolCtx): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return JSON.stringify({ error: "invalid arguments" });
  }

  try {
    switch (name) {
      case "recommend_solution": {
        const businessType = String(args.business_type ?? "").trim();
        const pb = playbookFor(businessType);
        const size = String(args.size ?? "").trim();
        const sz = size ? sizeAdvice(size) : null;
        return JSON.stringify({
          قطاع: pb.label,
          مشاكل_شائعة_اذكرها_له: pb.painPoints,
          وحدات_مناسبة: [...pb.modules, ...(sz?.extraModules ?? [])],
          النتيجة_المتوقعة: pb.outcome,
          ملاحظة_الحجم: sz?.note ?? null,
          اسأله_بعدها: pb.discoveryQuestion,
          تعليمات:
            "اذكر له مشكلة أو مشكلتين من القائمة بصيغتك أنت (مو نسخ حرفي) عشان يحس إنك فاهم شغله، اربطها بالوحدات، ثم اسأله السؤال. لا تسرد كل الوحدات دفعة وحدة.",
        });
      }

      case "find_available_slots": {
        if (!ctx.lead?.ownerId) {
          return JSON.stringify({
            error: "لا يوجد مندوب معيّن — لا تقدر تحجز موعد قبل ما يكون فيه مندوب. لعميل جديد استخدم create_qualified_lead أولاً.",
          });
        }
        const withinDays = Math.min(Math.max(Number(args.within_days ?? 7), 1), 21);
        const from = new Date();
        const to = new Date();
        to.setUTCDate(to.getUTCDate() + withinDays);
        const slots = await fetchFreeSlotsAdmin({
          userId: ctx.lead.ownerId,
          from: from.toISOString(),
          to: to.toISOString(),
          durationMinutes: 30,
          max: 3,
        });
        if (!slots.length) {
          return JSON.stringify({
            slots: [],
            تعليمات: "ما فيه مواعيد فاضية خلال المدة — اسأل العميل أي وقت يناسبه بشكل مفتوح وسجّلها بـschedule_demo بدون slot_at.",
          });
        }
        return JSON.stringify({
          slots: slots.map((s) => ({
            starts_at: s.starts_at,
            label: new Date(s.starts_at).toLocaleString("ar-SA", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Asia/Riyadh",
            }),
          })),
          تعليمات:
            "اعرض المواعيد الثلاثة على العميل بشكل طبيعي بجملة وحدة (مثلاً: 'متاح الأحد ١٠ص، أو الاثنين ٢م، أو الثلاثاء ١١ص — أيها أنسب؟'). لما يختار واحد، ناديe schedule_demo مع slot_at = قيمة starts_at للموعد اللي اختاره بالضبط.",
        });
      }

      case "get_customer_status": {
        if (!ctx.lead) return JSON.stringify({ error: "no lead in context" });
        return JSON.stringify({
          name: ctx.lead.fullName,
          company: ctx.lead.companyName,
          stage: ctx.lead.stageLabel,
          owner: ctx.lead.ownerName,
          deals: ctx.lead.deals.map((d) => ({ name: d.name, stage: d.stageLabel })),
          last_activity: ctx.lead.recentActivities[0]
            ? { note: ctx.lead.recentActivities[0].body, date: fmtDate(ctx.lead.recentActivities[0].occurredAt) }
            : null,
        });
      }

      case "add_note": {
        if (!ctx.lead) return JSON.stringify({ error: "no lead in context" });
        const note = String(args.note ?? "").trim();
        if (!note) return JSON.stringify({ error: "note required" });
        const { error } = await logWhatsAppActivity(ctx.lead.leadId, `[من واتساب] ${note}`);
        return JSON.stringify(error ? { ok: false, error } : { ok: true });
      }

      case "save_discovery": {
        if (!ctx.lead) return JSON.stringify({ error: "no lead in context" });
        const parts = [
          args.business_type ? `النشاط: ${String(args.business_type).trim()}` : null,
          args.size ? `الحجم: ${String(args.size).trim()}` : null,
          args.current_system ? `النظام الحالي: ${String(args.current_system).trim()}` : null,
          args.interest ? `يبحث عن: ${String(args.interest).trim()}` : null,
        ].filter(Boolean);
        if (!parts.length) return JSON.stringify({ error: "nothing to save" });
        const stamp = new Date().toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" });
        const { error } = await appendLeadNotes(ctx.lead.leadId, `[واتساب ${stamp}] ${parts.join(" — ")}`);
        return JSON.stringify(error ? { ok: false, error } : { ok: true, saved: parts });
      }

      case "schedule_demo": {
        if (!ctx.lead) {
          return JSON.stringify({ error: "لازم تنشئ العميل المحتمل أولاً بـcreate_qualified_lead" });
        }
        const preferred = String(args.preferred_time ?? "").trim();
        if (!preferred) return JSON.stringify({ error: "preferred_time required" });
        const notes = String(args.notes ?? "").trim();

        // Prefer the exact slot the customer picked; fall back to a
        // rough day-based guess when the model didn't run
        // find_available_slots first (customer named a time nobody
        // offered, or the calendar was empty).
        let dueAt: string;
        const slotAtRaw = args.slot_at ? String(args.slot_at).trim() : "";
        const parsedSlot = slotAtRaw ? new Date(slotAtRaw) : null;
        if (parsedSlot && !Number.isNaN(parsedSlot.valueOf()) && parsedSlot > new Date()) {
          dueAt = parsedSlot.toISOString();
        } else {
          dueAt = dueDateFrom(args.days_from_now ?? 1);
        }
        const who = ctx.lead.fullName ?? "عميل من واتساب";

        const { error } = await createWhatsAppTask({
          leadId: ctx.lead.leadId,
          title: `عرض توضيحي — ${who}`,
          description: `طلب عبر واتساب (${ctx.waFrom}).\nالوقت المفضل بكلمات العميل: ${preferred}\n${notes}`,
          dueAt,
          assigneeId: ctx.lead.ownerId,
        });
        if (error) return JSON.stringify({ ok: false, error });

        await logWhatsAppActivity(ctx.lead.leadId, `[من واتساب] حجز عرض توضيحي — الوقت المفضل: ${preferred}`);
        await notifyOwnerEmail(
          ctx.lead.ownerEmail,
          `📅 ${who} طلب عرض توضيحي`,
          `<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif;">
            <p><strong>${who}</strong> طلب عرض توضيحي عبر واتساب.</p>
            <p>الوقت المفضل: <strong>${preferred}</strong></p>
            ${notes ? `<blockquote style="margin:12px 0;padding:10px 14px;border-inline-start:3px solid #14b8a6;background:#f4f4f5;">${notes}</blockquote>` : ""}
            <p style="color:#71717a;font-size:13px;">أُنشئت مهمة بالنظام على ملف العميل.</p>
          </div>`,
        );
        return JSON.stringify({
          ok: true,
          تعليمات: "أكّد للعميل إن الموعد انحجز وإن الفريق راح يتواصل لتأكيد الوقت بالضبط، واسأله لو عنده شيء معين يحب يشوفه بالعرض.",
        });
      }

      case "request_human_help": {
        const reason = String(args.reason ?? "").trim();
        const urgent = Boolean(args.urgent);
        if (!reason) return JSON.stringify({ error: "reason required" });

        if (ctx.lead) {
          const flag = urgent ? "🔴 عاجل" : "🟡";
          await logWhatsAppActivity(ctx.lead.leadId, `[من واتساب] طلب تدخل بشري ${flag}: ${reason}`);
          await notifyOwnerEmail(
            ctx.lead.ownerEmail,
            `${urgent ? "🔴 عاجل — " : ""}${ctx.lead.fullName ?? "عميل"} يحتاج تواصل`,
            `<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif;">
              <p><strong>${ctx.lead.fullName ?? "عميل"}</strong> راسل واتساب وطلب تدخل بشري${urgent ? " بشكل عاجل" : ""}:</p>
              <blockquote style="margin:12px 0;padding:10px 14px;border-inline-start:3px solid #14b8a6;background:#f4f4f5;">${reason}</blockquote>
            </div>`,
          );
          return JSON.stringify({
            ok: true,
            notified: !!ctx.lead.ownerEmail,
            تعليمات: "أكّد للعميل إن الفريق تنبّه، وأكمل النقاش معه بسؤال — لا تنهي المحادثة عند هذا الحد.",
          });
        }

        // No lead yet — this is a brand-new prospect asking for a human
        // before create_qualified_lead ran. Still worth a heads-up, just
        // with no owner to address it to.
        console.warn("[whatsapp crm] request_human_help with no lead in context", { waFrom: ctx.waFrom, reason });
        return JSON.stringify({ ok: true, notified: false, note: "no lead yet — create_qualified_lead first if possible" });
      }

      case "create_qualified_lead": {
        if (ctx.lead) return JSON.stringify({ error: "lead already exists" });
        const fullName = String(args.full_name ?? "").trim();
        const notes = String(args.notes ?? "").trim();
        if (!fullName || !notes) return JSON.stringify({ error: "full_name and notes required" });
        const companyName = args.company_name ? String(args.company_name).trim() : null;
        const businessType = args.business_type ? String(args.business_type).trim() : null;
        const size = args.size ? String(args.size).trim() : null;

        const detail = [
          businessType ? `النشاط: ${businessType}` : null,
          size ? `الحجم: ${size}` : null,
          notes,
        ]
          .filter(Boolean)
          .join("\n");

        const { leadId, error } = await createLeadFromWhatsApp({
          waFrom: ctx.waFrom,
          fullName,
          companyName,
          notes: `[عميل محتمل من واتساب] ${detail}`,
        });
        if (error || !leadId) return JSON.stringify({ ok: false, error });

        // Route the new lead to the right rep automatically, then load
        // that rep's contact info back into ctx so a schedule_demo /
        // request_human_help later in the same turn attaches to the
        // owner instead of finding no one to email.
        const sizeNum = size ? parseInt(size.replace(/\D/g, ""), 10) : null;
        const assignment = await resolveLeadAssignment({
          leadId,
          industry: businessType,
          size: Number.isFinite(sizeNum) ? sizeNum : null,
          source: "واتساب",
        });
        let ownerId: string | null = null;
        let ownerName: string | null = null;
        let ownerEmail: string | null = null;
        if (assignment?.assignee_id) {
          ownerId = assignment.assignee_id;
          await setLeadOwner(leadId, ownerId);
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("full_name, first_name, last_name, email")
            .eq("id", ownerId)
            .maybeSingle();
          if (prof) {
            ownerName = prof.full_name || [prof.first_name, prof.last_name].filter(Boolean).join(" ") || null;
            ownerEmail = prof.email ?? null;
          }
        }

        ctx.lead = {
          leadId,
          fullName,
          companyName,
          ownerId,
          ownerName,
          ownerEmail,
          stageLabel: null,
          deals: [],
          recentActivities: [],
        };
        return JSON.stringify({
          ok: true,
          lead_id: leadId,
          assigned_to: ownerName,
          rule: assignment?.rule_name ?? null,
          تعليمات: ownerName
            ? `تم توجيه العميل تلقائياً للمندوب ${ownerName}. اذكر اسمه للعميل بصيغة طبيعية (مثلاً: "${ownerName} راح يتابع معك") واعرض عليه ترتيب موعد.`
            : "لا تخبر العميل إنك 'سجلته بالنظام' — بدلها اعرض عليه الخطوة التالية (عرض توضيحي) واسأله عن وقت مناسب.",
        });
      }

      default:
        return JSON.stringify({ error: `unknown tool ${name}` });
    }
  } catch (err) {
    console.error(`[whatsapp crm] tool ${name} threw`, err);
    return JSON.stringify({ error: "internal error" });
  }
}
