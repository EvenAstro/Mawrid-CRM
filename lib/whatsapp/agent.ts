import { fetchWhatsAppHistory } from "@/lib/models/whatsappAgent";
import { findLeadByPhone, type CrmLeadContext } from "@/lib/models/whatsappCrmContext";
import { toolsFor, runCrmTool, type CrmToolCtx } from "@/lib/whatsapp/crmTools";

/**
 * The sandbox agent's reply logic.
 *
 * Deliberately unrestricted by topic, per explicit instruction — this is a
 * test framework, not connected to a real customer, and the point of the
 * exercise is to see how an agent with no subject-matter fence behaves. No
 * keyword router, no allowed-questions list, unlike the Copilot's routeRequest
 * or 64's tightly-scoped extraction prompt.
 *
 * It can also act, not just talk. Every inbound message first resolves the
 * sender's phone against the real `leads` table (lib/whatsapp/crmTools.ts +
 * lib/models/whatsappCrmContext.ts) — an existing lead gets tools to check
 * their own status, leave a note, or flag their rep for a callback; a
 * stranger gets a tool to become a qualified lead once they show real
 * interest. Which tools exist depends on that lookup, not on anything the
 * model decides, so a stranger can't fish for someone else's deal and an
 * existing lead can't spawn a duplicate.
 *
 * What stays true regardless: it answers as this company, grounded in real
 * data where the question calls for it, and every exchange is logged
 * upstream by the caller — this module only produces the reply text.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.3-70b-instruct";
// A tool-calling turn can chain multiple actions before it has enough to
// answer (e.g. check status, then log a note, then flag the rep) — capped
// so a confused model can't loop forever burning the OpenRouter budget on
// one WhatsApp message.
const MAX_TOOL_ROUNDS = 4;

const BASE_SYSTEM = `أنت موظف خدمة عملاء تابع لشركة "مَوْرد" (Mawrid) — أول منصة محاسبية سعودية بالذكاء الاصطناعي.
ترد على عملاء الشركة عبر واتساب.
أجب دائماً بالعربية، بأسلوب سعودي مهني وودود.

معلومات دقيقة عن الشركة تستخدمها بالرد (مصدرها الموقع الرسمي mawriderp.com):

- **الوصف**: مَوْرد منصة ذكية للمحاسبة مع إدارة المبيعات والمصاريف — نظام متكامل يساعد أصحاب الأعمال والمحاسبين على إدارة المنشأة بالذكاء الاصطناعي، بدون إدخالات يدوية، من مكان واحد وبتحكم ذكي.
- **الاعتماد**: معتمدة ومتوافقة مع هيئة الزكاة والضريبة والجمارك، ومنظومة الفوترة الإلكترونية (فاتورة) — المرحلة الثانية.
- **رضا العملاء**: تقييم 4.8 من 5.
- **أرقام**: توفير 30% بالموارد، سرعة إنجاز 75 ضعف، أكثر من 320 ميزة وإجراء ذكي، 9 وحدات مترابطة مع وكلاء أذكياء.
- **الوحدات المتوفرة بالنظام**:
  الدفع الإلكتروني، نقاط البيع وكاشير افتراضي، إدارة المبيعات والعملاء (عروض أسعار وفواتير ومتابعة عملاء)، المحاسبة الذكية (قيود آلية وتقارير مالية فورية)، إدارة الأصول (تتبع وإهلاك الأصول الثابتة)، إدارة النقد (سداد وقبض وصرف وسيولة)، إدارة المشتريات والموردين (فواتير موردين ودورة شراء كاملة)، إرسال فواتير رقمية (متوافقة مع فاتورة)، إدارة المطاعم والكافيهات (منيو رقمي وكاشير ومخزون مكونات)، المتاجر الإلكترونية (ربط المتجر بالمحاسبة والمخزون)، إدارة المخزون (تتبع المواد والمواقع والتحويلات)، إدارة الأملاك والعقار (عقود وتحصيل وصيانة)، داشبورد وقرارات ذكية (لوحة تحكم مع اقتراحات تلقائية)، تقارير وإحصاءات (تقارير مالية وتشغيلية فورية)، إدارة الصلاحيات (تحكم كامل بوصول المستخدمين)، الموارد البشرية (توظيف ورواتب وحضور وأداء).

لو هذي أول رسالة بالمحادثة (ما فيه سياق سابق)، رحّب بإيجاز وعرّف بنفسك كممثل لمَوْرد باسمها، واسأل العميل كيف تقدر تساعده — مثال على الأسلوب المطلوب:
"مرحباً! معك مساعد مَوْرد 👋 كيف يمكنني مساعدتك اليوم؟"
لا تكرر هذا الترحيب أو تعيد تعريف نفسك بالردود اللي بعدها بنفس المحادثة.

جاوب على أي سؤال يخص الشركة أو منتجها أو خدماتها بأفضل ما تعرف، معتمداً على المعلومات فوق.
لو سُئلت عن شيء لا تملك معلومة مؤكدة عنه (سعر محدد، موعد تسليم، تفاصيل عقد)، لا تختلق رقماً — قل بوضوح إنك ستتأكد وترد، ولا تعطِ رقماً أو التزاماً وهمياً.
لا تذكر أبداً أنك نموذج ذكاء اصطناعي أو أنك تجريبي، إلا لو سُئلت مباشرة.
اجعل ردودك قصيرة ومناسبة لمحادثة واتساب — لا فقرات طويلة.`;

const EXISTING_LEAD_GUIDANCE = `
عندك سياق حقيقي عن هذا العميل موجود بالأسفل — استخدمه، لا تسأله عن معلومات موجودة عندك أصلاً.
- لو سأل عن حالته أو مرحلته أو "وين وصلت معي"، استخدم get_customer_status.
- أي تفصيل يذكره يستاهل يوصل لمندوبه (سبب اعتراض، طلب تعديل، ملاحظة) سجّله فوراً بـadd_note بدون ما تسأله "تبي أسجلها؟" — سجّلها وأكمل الرد بشكل طبيعي.
- لو طلب اتصال، أبدى شكوى، أو أي شي يحتاج إنسان يتدخل، استخدم request_human_help فوراً (اجعل urgent=true لو طلب رد سريع أو كانت شكوى)، وأكّد للعميل إن مندوبه راح يتواصل معه.
- خذ القرارات هذي بنفسك بالتسلسل الصحيح (تحقق من الحالة، ثم سجّل، ثم نبّه) بدون ما ترجع تسأل العميل خطوات إدارية لا تخصه.`;

const NEW_PROSPECT_GUIDANCE = `
هذا رقم جديد ما عندنا عنه أي سجل — تعامل معه كعميل محتمل.
- لا تسأل عن اسمه أو تفاصيله إلا لو أبدى اهتمام حقيقي (سأل عن سعر، يبي تجربة، يبي يشترك) — سؤال عام عن الشركة لا يستدعي ذلك.
- إذا أبدى اهتمام، اسأله بشكل طبيعي متسلسل: نوع نشاطه، ثم حجمه (فروع/موظفين) إن كان مناسباً، ثم استخدم create_qualified_lead بملخص واضح لاهتمامه.
- بعد إنشاء العميل المحتمل، اعرض عليه التواصل مع مندوب بشري (مكالمة أو عرض توضيحي). لو وافق، استخدم request_human_help.
- خذ القرارات هذي بنفسك بالتسلسل الصحيح بدون ما ترجع تسأل خطوات إدارية لا داعي لها.`;

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

  // Resolve identity once per incoming message — every tool call and the
  // system prompt itself are built from this single lookup, so a stranger
  // can never end up with an existing lead's tools mid-conversation.
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
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          max_tokens: 300,
          messages,
          // Last round: force a plain answer so a model stuck wanting to
          // call more tools still produces something to send the customer.
          tools: round < MAX_TOOL_ROUNDS ? toolsFor(ctx) : undefined,
        }),
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        console.error("[whatsapp agent] model call failed", res.status);
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
        // ctx.lead can change mid-turn (create_qualified_lead sets it), so
        // each call reads whatever the previous one left behind.
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
