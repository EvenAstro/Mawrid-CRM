import {
  type CrmLeadContext,
  createLeadFromWhatsApp,
  logWhatsAppActivity,
} from "@/lib/models/whatsappCrmContext";
import { sendEmail } from "@/lib/email/resend";

/**
 * Tools that act on the real CRM (leads/activities) — separate from
 * lib/whatsapp/tools.ts, which is the unrelated sandbox booking demo.
 *
 * The toolset offered depends on whether the sender's number matched an
 * existing lead (resolved once, up front, in agent.ts) — a stranger can't
 * fish for someone else's deal status, and an existing lead can't be
 * re-created. `ctx.lead` is mutated in place when create_qualified_lead
 * succeeds, so a request_human_help call later in the same tool-calling
 * turn attaches to the lead that was just created.
 */

export interface CrmToolCtx {
  waFrom: string;
  lead: CrmLeadContext | null;
}

const TOOLS_FOR_EXISTING_LEAD = [
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
      description: "يضيف ملاحظة على ملف العميل يشوفها مندوبه لاحقاً — استخدمه لأي تفصيل يذكره العميل يحتاج المندوب يعرفه (سبب اعتراض، طلب تعديل، ملاحظة عامة).",
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
      name: "request_human_help",
      description: "ينبّه المندوب المسؤول فوراً (إيميل + تسجيل بملف العميل) إن العميل يحتاج تدخل بشري — طلب اتصال، شكوى، أي شيء لا تقدر تحسمه بنفسك.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "سبب الطلب بجملة مختصرة" },
          urgent: { type: "boolean", description: "true لو العميل يطلب رد سريع/عاجل" },
        },
        required: ["reason", "urgent"],
      },
    },
  },
] as const;

const TOOLS_FOR_NEW_PROSPECT = [
  {
    type: "function",
    function: {
      name: "create_qualified_lead",
      description:
        "ينشئ عميل محتمل جديد بالنظام بعد ما تجمع معلومات كافية عنه (اسمه، نشاطه، اهتمامه). لا تستخدمه إلا بعد ما العميل يبدي اهتمام حقيقي (يسأل عن سعر، يبي تجربة، يبي يشترك) — مو لمجرد سؤال عام.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          company_name: { type: "string", description: "اسم منشأته إن ذكرها، وإلا اتركه فاضي" },
          notes: { type: "string", description: "ملخص اهتمامه: نوع نشاطه، حجمه، وش يبي بالضبط" },
        },
        required: ["full_name", "notes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_help",
      description: "ينبّه فريق المبيعات فوراً (إيميل) إن هذا العميل المحتمل جاهز يتكلم مع مندوب بشري. استخدمه بعد create_qualified_lead لو أبدى رغبة بمكالمة أو عرض توضيحي.",
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

export async function runCrmTool(name: string, rawArgs: string, ctx: CrmToolCtx): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return JSON.stringify({ error: "invalid arguments" });
  }

  try {
    switch (name) {
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
          return JSON.stringify({ ok: true, notified: !!ctx.lead.ownerEmail });
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

        const { leadId, error } = await createLeadFromWhatsApp({
          waFrom: ctx.waFrom,
          fullName,
          companyName,
          notes: `[عميل محتمل من واتساب] ${notes}`,
        });
        if (error || !leadId) return JSON.stringify({ ok: false, error });

        // Mutate ctx so a following request_human_help in this same turn
        // attaches to the lead that was just created instead of finding
        // nothing.
        ctx.lead = {
          leadId,
          fullName,
          companyName,
          ownerId: null,
          ownerName: null,
          ownerEmail: null,
          stageLabel: null,
          deals: [],
          recentActivities: [],
        };
        return JSON.stringify({ ok: true, lead_id: leadId });
      }

      default:
        return JSON.stringify({ error: `unknown tool ${name}` });
    }
  } catch (err) {
    console.error(`[whatsapp crm] tool ${name} threw`, err);
    return JSON.stringify({ error: "internal error" });
  }
}
