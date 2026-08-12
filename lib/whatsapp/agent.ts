import { fetchWhatsAppHistory } from "@/lib/models/whatsappAgent";
import { TOOLS, runTool } from "@/lib/whatsapp/tools";

/**
 * The sandbox agent's reply logic.
 *
 * Deliberately unrestricted by topic, per explicit instruction — this is a
 * test framework, not connected to a real customer, and the point of the
 * exercise is to see how an agent with no subject-matter fence behaves. No
 * keyword router, no allowed-questions list, unlike the Copilot's routeRequest
 * or 64's tightly-scoped extraction prompt.
 *
 * It can also act, not just talk: a small tool-calling loop lets it look up
 * and book against the sandbox appointment domain (lib/whatsapp/tools.ts),
 * so a conversation can chain "check availability" → "that doctor's full,
 * try this one" → "book it" without a human in the loop. See that file for
 * what it can actually touch.
 *
 * What stays true regardless: it answers as this company, grounded in real
 * data where the question calls for it, and every exchange is logged
 * upstream by the caller — this module only produces the reply text.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.3-70b-instruct";
// A tool-calling turn can chain multiple lookups before it has enough to
// answer (e.g. check one doctor, then another) — capped so a confused model
// can't loop forever burning the OpenRouter budget on one WhatsApp message.
const MAX_TOOL_ROUNDS = 4;

const SYSTEM = `أنت موظف خدمة عملاء تابع لشركة "مَوْرد" (Mawrid) — أول منصة محاسبية سعودية بالذكاء الاصطناعي.
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
اجعل ردودك قصيرة ومناسبة لمحادثة واتساب — لا فقرات طويلة.

بالإضافة لهذا، عندك أدوات تقدر تستخدمها لحجز مواعيد أطباء حقيقية بنظام تجريبي (عيادة تجريبية، مو جزء من مَوْرد نفسها):
- لو العميل سأل عن دكتور معين وهل هو مداوم، استخدم check_doctor_availability. لو ما كان مداوم أو ما عنده مواعيد فاضية، اقترح استخدام list_doctors وقول للعميل دكتور بديل متاح، بدون ما تسأله إذا يبي البديل أو لا — اقترحه مباشرة.
- لو العميل اختار موعد، تأكد من اسمه قبل ما تحجز (اسأله لو ما ذكره)، وبعدها استخدم book_slot.
- لو سأل عن مواعيده الحالية، استخدم list_my_bookings.
- بعد أي حجز ناجح، أكّد للعميل بجملة قصيرة فيها اسم الطبيب والوقت.
- خذ قرارات متسلسلة بنفسك (تحقق ثم اقترح بديل ثم احجز) بدون ما ترجع تسأل العميل خطوات لا داعي لها.`;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export async function generateWhatsAppReply(waFrom: string, incoming: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[whatsapp agent] OPENROUTER_API_KEY not set");
    return null;
  }

  const history = await fetchWhatsAppHistory(waFrom, 20);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
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
          tools: round < MAX_TOOL_ROUNDS ? TOOLS : undefined,
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
        const result = await runTool(call.function.name, call.function.arguments, waFrom);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
    return null;
  } catch (err) {
    console.error("[whatsapp agent] model call threw", err);
    return null;
  }
}
