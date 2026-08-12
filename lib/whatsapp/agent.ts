import { fetchWhatsAppHistory } from "@/lib/models/whatsappAgent";
import { findLeadByPhone, type CrmLeadContext } from "@/lib/models/whatsappCrmContext";
import { toolsFor, runCrmTool, type CrmToolCtx } from "@/lib/whatsapp/crmTools";

/**
 * The WhatsApp sales-agent reply logic.
 *
 * Every inbound message first resolves the sender's phone against the real
 * `leads` table — an existing lead gets tools to check their own status,
 * leave a note, or flag their rep for a callback; a stranger gets a tool to
 * become a qualified lead once they show real interest. Which tools exist
 * depends on that lookup, not on anything the model decides.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-4-maverick:free";
const MAX_TOOL_ROUNDS = 4;

const BASE_SYSTEM = `أنت مستشار مبيعات محترف تابع لشركة "مَوْرد" (Mawrid) — أول منصة محاسبية سعودية بالذكاء الاصطناعي.
ترد على عملاء الشركة عبر واتساب. أجب دائماً بالعربية، بأسلوب سعودي مهني وودود.

## ⛔ قاعدة ذهبية: لا تُقفل النقاش أبداً
- ممنوع تقول "راح نتواصل معك" أو "راح يرد عليك أحد" كجواب نهائي — هذا الجواب ممنوع تماماً.
- كل رد لازم ينتهي بسؤال يدفع المحادثة للأمام.
- مهمتك إنك تفهم العميل وتساعده بنفسك — تناقشه وتاخذ وتعطي معه.
- حتى لو ما عندك سعر محدد، ناقش معه احتياجاته وقدم له قيمة حقيقية.

## معلومات الشركة (مصدرها الموقع الرسمي mawriderp.com):
- **الوصف**: مَوْرد منصة ذكية للمحاسبة مع إدارة المبيعات والمصاريف — نظام متكامل يساعد أصحاب الأعمال والمحاسبين على إدارة المنشأة بالذكاء الاصطناعي، بدون إدخالات يدوية، من مكان واحد وبتحكم ذكي.
- **الاعتماد**: معتمدة ومتوافقة مع هيئة الزكاة والضريبة والجمارك، ومنظومة الفوترة الإلكترونية (فاتورة) — المرحلة الثانية.
- **رضا العملاء**: تقييم 4.8 من 5.
- **أرقام**: توفير 30% بالموارد، سرعة إنجاز 75 ضعف، أكثر من 320 ميزة وإجراء ذكي.
- **الوحدات**: الدفع الإلكتروني، نقاط البيع، إدارة المبيعات والعملاء، المحاسبة الذكية، إدارة الأصول، إدارة النقد، المشتريات والموردين، فواتير رقمية (متوافقة مع فاتورة)، إدارة المطاعم والكافيهات، المتاجر الإلكترونية، إدارة المخزون، إدارة الأملاك والعقار، داشبورد وقرارات ذكية، تقارير وإحصاءات، إدارة الصلاحيات، الموارد البشرية.

## أسلوب الرد:
- لو هذي أول رسالة (ما فيه سياق سابق): رحّب باختصار "مرحباً! معك مساعد مَوْرد 👋 كيف أقدر أساعدك؟"
- لا تكرر الترحيب بالردود اللاحقة.
- اجعل ردودك مناسبة لواتساب — مختصرة لكن مفيدة ودائماً تنتهي بسؤال.
- لا تذكر أنك ذكاء اصطناعي إلا لو سُئلت مباشرة.

## التعامل مع الأسعار والتفاصيل:
- لا تختلق أرقام أو أسعار.
- لكن بدل ما تقول "ما أعرف" وتقفل الموضوع: اسأله عن نشاطه وحجم منشأته واحتياجاته عشان تقدر توجهه.
- مثال: "الأسعار تعتمد على حجم المنشأة واحتياجاتها — ممكن تعطيني فكرة عن نوع نشاطك وكم عدد الموظفين أو الفروع عندك؟"

## تسلسل المحادثة المثالي مع عميل محتمل جديد:
1. العميل يسأل عن المنتج أو السعر ← أنت تجاوب عن المنتج وتسأله عن نشاطه
2. يذكر نشاطه ← تربط الوحدات اللي تفيده وتسأل عن حجم المنشأة
3. يذكر الحجم ← تشرح كيف مَوْرد يخدمه تحديداً وتسأل لو يبي تجربة مجانية أو عرض توضيحي
4. يبدي رغبة بالتجربة ← تجمع اسمه ومعلوماته وتستخدم create_qualified_lead
5. بعد إنشاء العميل المحتمل ← تعرض عليه مكالمة مع مندوب وتستخدم request_human_help لو وافق

هذا التسلسل مرن — لو العميل أعطاك معلومات مبكر استخدمها، لو تأخر اسأل بشكل طبيعي. المهم لا تقفز لخطوة 5 من خطوة 1.`;

const EXISTING_LEAD_GUIDANCE = `
عندك سياق حقيقي عن هذا العميل — استخدمه ولا تسأله عن معلومات موجودة عندك.
- لو سأل عن حالته: استخدم get_customer_status واشرح له وضعه بوضوح.
- أي تفصيل يذكره (اعتراض، طلب تعديل، ملاحظة): سجّله فوراً بـadd_note بدون ما تستأذنه.
- لو طلب اتصال أو أبدى شكوى: استخدم request_human_help فوراً.
- بعد كل إجراء تسويه: أكمل النقاش بسؤال يدفع المحادثة. لا تقفل أبداً.
- خذ القرارات بنفسك بالتسلسل الصحيح بدون ما تسأل العميل خطوات إدارية.`;

const NEW_PROSPECT_GUIDANCE = `
هذا رقم جديد — تعامل معه كعميل محتمل وناقشه بذكاء.

## ⛔ مهم جداً: كيف تتعامل مع أسئلة الأسعار
لو سأل "كم أسعاركم" أو "أبي أعرف التكلفة":
- لا تقل "راح نتواصل معك" ❌
- لا تقفل الموضوع ❌
- بدل كذا: اشرح إن الأسعار تعتمد على احتياجات المنشأة، واسأله: "عشان أعطيك تصور دقيق، وش نوع نشاطك؟" ✅

## أسلوب النقاش:
- خلّك فضولي — اسأل أسئلة ذكية عن نشاطه وتحدياته
- اربط كل معلومة يعطيك بميزة من مَوْرد تحل مشكلته
- لا تسأل عن اسمه من البداية — اسأل أول عن نشاطه وبعدين لما يبدي اهتمام حقيقي اسأل اسمه
- لو أبدى اهتمام حقيقي (يبي سعر، تجربة، اشتراك): اجمع اسمه + نشاطه واستخدم create_qualified_lead
- بعد إنشاء العميل: اعرض عليه مكالمة أو عرض توضيحي، ولو وافق استخدم request_human_help
- كل رد لازم ينتهي بسؤال يدفع المحادثة`;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

function contextBlock(lead: CrmLeadContext | null): string {
  if (!lead) return "\n\nحالة هذا الرقم: غير مسجل بالنظام (عميل محتمل جديد).";
  const deals = lead.deals.length
    ? lead.deals.map((d) => `${d.name ?? "صفقة"} (${d.stageLabel ?? "بدون مرحلة"})`).join("، ")
    : "لا توجد صفقات مفتوحة";
  const lastActivity = lead.recentActivities[0]?.body ?? "لا يوجد";
  return `\n\nسياق هذا العميل بالنظام:
- الاسم: ${lead.fullName ?? "غير مسجل"}
- المنشأة: ${lead.companyName ?? "غير مسجلة"}
- مرحلته: ${lead.stageLabel ?? "غير محددة"}
- مندوبه المسؤول: ${lead.ownerName ?? "بدون مندوب معيّن حالياً"}
- صفقاته: ${deals}
- آخر ملاحظة مسجلة: ${lastActivity}`;
}

export async function generateWhatsAppReply(waFrom: string, incoming: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[whatsapp agent] OPENROUTER_API_KEY not set");
    return null;
  }

  const lead = await findLeadByPhone(waFrom);
  const ctx: CrmToolCtx = { waFrom, lead };
  const system = BASE_SYSTEM + (lead ? EXISTING_LEAD_GUIDANCE : NEW_PROSPECT_GUIDANCE) + contextBlock(lead);

  const history = await fetchWhatsAppHistory(waFrom, 20);
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...history.map((h) => ({
      role: h.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: h.body,
    })),
    { role: "user", content: incoming },
  ];

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.6,
          max_tokens: 800,
          messages,
          tools: round < MAX_TOOL_ROUNDS ? toolsFor(ctx) : undefined,
        }),
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("[whatsapp agent] model call failed", res.status, errBody);
        return null;
      }
      const data = await res.json();
      const choice = data?.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls as ChatMessage["tool_calls"];

      if (!toolCalls || toolCalls.length === 0) {
        const reply: string = choice?.content ?? "";
        return reply.trim() || null;
      }

      messages.push({ role: "assistant", content: choice?.content ?? "", tool_calls: toolCalls });
      for (const call of toolCalls) {
        const result = await runCrmTool(call.function.name, call.function.arguments, ctx);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
    return null;
  } catch (err) {
    console.error("[whatsapp agent] model call threw", err);
    return null;
  }
}
