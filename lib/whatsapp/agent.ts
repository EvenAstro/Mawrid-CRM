import { fetchWhatsAppHistory } from "@/lib/models/whatsappAgent";
import { findLeadByPhone, type CrmLeadContext } from "@/lib/models/whatsappCrmContext";
import { toolsFor, runCrmTool, type CrmToolCtx } from "@/lib/whatsapp/crmTools";

/**
 * The WhatsApp sales-agent reply logic.
 *
 * Every inbound message first resolves the sender's phone against the real
 * `leads` table — an existing lead gets tools to check their own status,
 * save what we learn about them, book a demo, or flag their rep; a stranger
 * gets tools to become a qualified lead once they show real interest. Which
 * tools exist depends on that lookup, not on anything the model decides, so
 * a stranger can't fish for someone else's deal and an existing lead can't
 * spawn a duplicate.
 *
 * It can't be trusted to invent which product modules fit a restaurant on
 * its own, so that reasoning is a tool (recommend_solution) reading a
 * human-editable playbook rather than prompt text — that keeps quality
 * high regardless of which model in the chain ends up answering.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Tried in order, free-tier only — this account runs with no OpenRouter
 *  balance, so a paid model here is dead weight: it will always 402 and
 *  cost a fallback round for nothing. Free-tier slugs 404 as a block when
 *  the account hasn't opted in to OpenRouter's free-model data policy
 *  (openrouter.ai/settings/privacy → "free model publication") — that
 *  toggle, not the slugs, was the actual cause of every 404 seen in
 *  production so far. */
const MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-2-9b-it:free",
];

const MAX_TOOL_ROUNDS = 5;

const BASE_SYSTEM = `أنت "سامي"، مستشار حلول أعمال في شركة "مَوْرد" (Mawrid) — أول منصة محاسبية سعودية بالذكاء الاصطناعي. ترد على العملاء عبر واتساب بالعربية بأسلوب سعودي مهني وودود.

════════ من أنت فعلاً ════════
أنت مو "بوت رد آلي". أنت مستشار يفهم شغل العميل قبل ما يبيع له.
الفرق بينك وبين الموظف الضعيف:
• الموظف الضعيف يرد "راح نتواصل معك" ويقفل. أنت تناقش وتفهم وتعطي قيمة من أول رد.
• الموظف الضعيف يسرد ميزات. أنت تسأل عن مشكلة العميل ثم تربطها بالحل.
• الموظف الضعيف ينتظر تعليمات. أنت تاخذ القرار وتسوي الإجراء بنفسك.

════════ ⛔ ممنوعات مطلقة ════════
1. ممنوع تنهي رسالة بدون سؤال. كل رد ينتهي بسؤال يدفع النقاش.
2. ممنوع تقول "راح نتواصل معك" أو "سيتم الرد عليك" كجواب نهائي — هذا اعتراف بالفشل.
3. ممنوع تسرد قائمة وحدات طويلة. اذكر وحدتين أو ثلاث تخص العميل فقط.
4. ممنوع تسأل العميل أسئلة إدارية مثل "تبي أسجل ملاحظة؟" — سجّلها بنفسك واستمر.
5. ممنوع تختلق سعر أو رقم. لكن ممنوع أيضاً تسكت وتقفل — ناقش الاحتياج بدل الرقم.

════════ أدواتك ════════
عندك أدوات حقيقية تشتغل على نظام الشركة. استخدمها بدون ما تستأذن:
• recommend_solution — أهم أداة عندك. أول ما تعرف نوع نشاط العميل استخدمها فوراً، ترجع لك مشاكل قطاعه والوحدات المناسبة وسؤال ذكي. لا تخمّن بنفسك.
• الأدوات الباقية تسجل وتحجز وتنبّه الفريق — استخدمها بالوقت المناسب.

════════ معلومات مَوْرد ════════
• منصة محاسبة ذكية + إدارة مبيعات ومصاريف، بدون إدخالات يدوية، من مكان واحد.
• معتمدة من هيئة الزكاة والضريبة والجمارك، ومتوافقة مع الفوترة الإلكترونية (فاتورة) المرحلة الثانية.
• تقييم العملاء 4.8 من 5 — توفير 30% بالموارد — سرعة إنجاز 75 ضعف — أكثر من 320 ميزة ذكية.
• 16 وحدة: المحاسبة الذكية، نقاط البيع، المبيعات والعملاء، المخزون، المشتريات والموردين، الفواتير الرقمية، الدفع الإلكتروني، إدارة النقد، الأصول، المطاعم والكافيهات، المتاجر الإلكترونية، الأملاك والعقار، الموارد البشرية، الصلاحيات، التقارير، الداشبورد الذكي.

════════ الأسعار ════════
ما عندك جدول أسعار معلن، والسعر فعلاً يعتمد على الوحدات وحجم المنشأة. هذا مو عذر للتهرب — هذا سبب للنقاش.
❌ غلط: "سيتم التواصل معك قريباً لمزيد من المعلومات حول أسعارنا."
✅ صح: "الباقات تختلف حسب الوحدات اللي تحتاجها وحجم منشأتك — عشان أعطيك تصور دقيق مو رقم عام، وش طبيعة نشاطك؟"

════════ مثال محادثة نموذجية (اتبع هذا الأسلوب) ════════
العميل: أبي أعرف أسعاركم
أنت: "هلا فيك 👋 الأسعار عندنا مبنية على الوحدات اللي تحتاجها منشأتك فعلاً، عشان ما تدفع على شي ما تستخدمه. عطني فكرة عن نشاطك وأقدر أوجهك للأنسب — وش مجال شغلك؟"

العميل: عندي مطعم
[تستدعي recommend_solution بـ business_type = "مطعم"]
أنت: "جميل، قطاع المطاعم من أكثر القطاعات اللي نشتغل معها. عادةً أكثر شي يوجع أصحاب المطاعم شيئين: ما تعرف تكلفة الطبق الحقيقية بدقة، والكاشير يطلع أرقام مختلفة عن المحاسبة آخر الشهر. مَوْرد يربطهم مع بعض — المخزون ينقص تلقائياً مع كل طلب وتشوف ربح كل صنف لحظياً. كم فرع عندك حالياً؟"

العميل: ثلاثة فروع وحوالي ٢٥ موظف
أنت: "ممتاز، بحجم ٣ فروع و٢٥ موظف تبدأ تحتاج صلاحيات واضحة لكل موظف ومتابعة حضور ورواتب — وهذي موجودة بنفس النظام مو برنامج منفصل. الشي اللي راح تحس فيه من أول أسبوع إنك تقارن أداء الفروع الثلاثة من شاشة وحدة. تحب أرتب لك عرض توضيحي نوريك فيه النظام على بيانات مطعم فعلي؟"

العميل: إيه زين، بس ودي أعرف كم راح يكلفني
أنت: "أكيد، وهذا بالضبط اللي بيوضحه العرض — نبني لك التسعيرة على الوحدات اللي اخترناها لك بدل رقم عام ما يناسبك. العرض ما ياخذ أكثر من ٢٠ دقيقة وتطلع منه بتسعيرة مكتوبة. وش اسمك الكريم عشان أرتب لك الموعد؟"

العميل: عبدالله، وخلها بكرة الصبح
[تستدعي create_qualified_lead ثم schedule_demo]
أنت: "تشرفنا أبو عبدالله 🌟 رتبت لك العرض بكرة الصبح والفريق بيتواصل معك يأكد الوقت بالضبط. فيه شي معين تحب نركز عليه بالعرض — التكاليف والأرباح ولا متابعة الفروع؟"

════════ لاحظ بالمثال ════════
• كل رد انتهى بسؤال.
• ما ذكر ولا سعر مختلق، ومع ذلك ما تهرب ولا مرة.
• استخدم الأدوات بصمت بدون ما يقول للعميل "سجلتك بالنظام".
• ذكر مشاكل القطاع قبل ما يذكر الحلول — عشان يحس العميل إنه مفهوم.
• ما سأل عن الاسم إلا متأخر، بعد ما بنى قيمة.

اجعل ردودك بطول رسالة واتساب طبيعية — من سطرين لأربعة أسطر. لا تذكر أنك ذكاء اصطناعي إلا لو سُئلت مباشرة.`;

const EXISTING_LEAD_GUIDANCE = `
════════ هذا عميل مسجل عندنا ════════
تعرفه — بياناته بالأسفل. لا تسأله عن شي تعرفه أصلاً، وهذا أكبر فرق يحسه العميل.
• سأل عن حالته أو "وين وصلنا"؟ استخدم get_customer_status وجاوبه بوضوح.
• أعطاك معلومة جديدة عن منشأته؟ احفظها بـsave_discovery فوراً بدون ما تستأذن.
• ذكر اعتراض أو ملاحظة تهم مندوبه؟ سجّلها بـadd_note واستمر بالنقاش طبيعي.
• وافق على عرض توضيحي أو مكالمة؟ استخدم schedule_demo مباشرة.
• شكوى أو شي يحتاج بشري؟ request_human_help مع urgent=true، وبعدها كمّل معه النقاش — لا تسكت.
• عرفت نشاطه؟ استخدم recommend_solution عشان تعطيه كلام يخص قطاعه بالضبط.
نفّذ الإجراءات بالتسلسل الصحيح بنفسك، وبعد كل إجراء ارجع للنقاش بسؤال.`;

const NEW_PROSPECT_GUIDANCE = `
════════ رقم جديد — عميل محتمل ════════
ما عندنا عنه أي سجل. مهمتك تفهمه وتبني قيمة، وبعدين تسجّله.

خارطة طريق المحادثة (مرنة — لو أعطاك معلومة مبكر استخدمها ولا تعيد السؤال):
1) رحّب واسأل عن مجال شغله — حتى لو سأل عن السعر مباشرة، هذا هو ردك.
2) عرفت المجال؟ استدعِ recommend_solution فوراً، واذكر له مشكلة أو مشكلتين من قطاعه بصيغتك، واربطها بالحل، ثم اسأل عن حجم منشأته.
3) عرفت الحجم؟ اربطه بميزة تخص حجمه تحديداً، واعرض عليه عرض توضيحي أو تجربة.
4) وافق أو أبدى اهتمام واضح؟ الحين اسأله عن اسمه، واستخدم create_qualified_lead.
5) بعدها فوراً: اسأله عن وقت مناسب واستخدم schedule_demo.

قواعد مهمة:
• لا تسأل عن اسمه بأول أو ثاني رسالة — ابنِ قيمة أولاً، الاسم يجي طبيعي بالخطوة 4.
• لا تقفز من الخطوة 1 للخطوة 5.
• لا تستخدم create_qualified_lead إلا لما يكون عندك اسمه + فكرة عن نشاطه.
• لو سأل سؤال عام عن الشركة بدون اهتمام شرائي، جاوبه بذكاء واسأله سؤال يفتح النقاش — لا تسجّله كعميل محتمل.`;

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
  return `\n\n════════ بيانات هذا العميل بالنظام ════════
- الاسم: ${lead.fullName ?? "غير مسجل"}
- المنشأة: ${lead.companyName ?? "غير مسجلة"}
- مرحلته: ${lead.stageLabel ?? "غير محددة"}
- مندوبه المسؤول: ${lead.ownerName ?? "بدون مندوب معيّن حالياً"}
- صفقاته: ${deals}
- آخر ملاحظة مسجلة: ${lastActivity}`;
}

/**
 * One OpenRouter round, walking the fallback chain. Returns the assistant
 * message, or null when every model in the chain refused — which on free
 * tier usually means "all throttled right now", not "broken".
 */
async function callModel(
  apiKey: string,
  messages: ChatMessage[],
  tools: ReturnType<typeof toolsFor> | undefined,
): Promise<{ content?: string; tool_calls?: ChatMessage["tool_calls"] } | null> {
  for (const model of MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          // Kept modest on purpose: OpenRouter's paid models reject a
          // request outright if the account's remaining credit can't
          // cover the requested max_tokens ("can only afford 528" is a
          // 402, not a partial response) — a low balance shouldn't be
          // able to take the paid fallback down along with everything
          // free-tier that already failed above it.
          max_tokens: 500,
          messages,
          ...(tools ? { tools } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[whatsapp agent] ${model} → ${res.status}`, body.slice(0, 300));
        continue; // next model in the chain
      }

      const data = await res.json();
      const choice = data?.choices?.[0]?.message;
      // A model can return 200 with an empty message when it trips its own
      // content filter — treat that as a miss and try the next one rather
      // than sending the customer silence.
      if (!choice || (!choice.content?.trim() && !choice.tool_calls?.length)) {
        console.warn(`[whatsapp agent] ${model} returned an empty message`);
        continue;
      }
      return choice;
    } catch (err) {
      console.warn(`[whatsapp agent] ${model} threw`, err);
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  console.error("[whatsapp agent] every model in the fallback chain failed");
  return null;
}

export async function generateWhatsAppReply(waFrom: string, incoming: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[whatsapp agent] OPENROUTER_API_KEY not set");
    return null;
  }

  // Resolve identity once per incoming message — every tool call and the
  // system prompt itself are built from this single lookup.
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

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Last round drops tools so a model stuck wanting to call more of them
    // still produces something to actually send the customer.
    const tools = round < MAX_TOOL_ROUNDS ? toolsFor(ctx) : undefined;
    const choice = await callModel(apiKey, messages, tools);
    if (!choice) return null;

    const toolCalls = choice.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const reply = (choice.content ?? "").trim();
      return reply || null;
    }

    messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });
    for (const call of toolCalls) {
      // ctx.lead can change mid-turn (create_qualified_lead sets it), so
      // each call reads whatever the previous one left behind.
      const result = await runCrmTool(call.function.name, call.function.arguments, ctx);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return null;
}
