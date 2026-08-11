import { fetchWhatsAppHistory } from "@/lib/models/whatsappAgent";

/**
 * The sandbox agent's reply logic.
 *
 * Deliberately unrestricted by topic, per explicit instruction — this is a
 * test framework, not connected to a real customer, and the point of the
 * exercise is to see how an agent with no subject-matter fence behaves. No
 * keyword router, no allowed-questions list, unlike the Copilot's routeRequest
 * or 64's tightly-scoped extraction prompt.
 *
 * What stays true regardless: it answers as this company, grounded in real
 * data where the question calls for it, and every exchange is logged
 * upstream by the caller — this module only produces the reply text.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.3-70b-instruct";

const SYSTEM = `أنت موظف خدمة عملاء تابع لشركة "مَوْرد" (Mawrid) — نظام CRM لفرق المبيعات في السعودية.
ترد على عملاء الشركة عبر واتساب.
أجب دائماً بالعربية، بأسلوب سعودي مهني وودود.
جاوب على أي سؤال يخص الشركة أو منتجها أو خدماتها بأفضل ما تعرف.
لو سُئلت عن شيء لا تملك معلومة مؤكدة عنه (سعر محدد، موعد تسليم، تفاصيل عقد)، لا تختلق رقماً — قل بوضوح إنك ستتأكد وترد، ولا تعطِ رقماً أو التزاماً وهمياً.
لا تذكر أبداً أنك نموذج ذكاء اصطناعي أو أنك تجريبي، إلا لو سُئلت مباشرة.
اجعل ردودك قصيرة ومناسبة لمحادثة واتساب — لا فقرات طويلة.`;

export async function generateWhatsAppReply(waFrom: string, incoming: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[whatsapp agent] OPENROUTER_API_KEY not set");
    return null;
  }

  const history = await fetchWhatsAppHistory(waFrom, 20);
  const messages = [
    { role: "system" as const, content: SYSTEM },
    ...history.map((h) => ({
      role: h.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: h.body,
    })),
    { role: "user" as const, content: incoming },
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
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
      }),
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.error("[whatsapp agent] model call failed", res.status);
      return null;
    }
    const data = await res.json();
    const reply: string = data?.choices?.[0]?.message?.content ?? "";
    return reply.trim() || null;
  } catch (err) {
    console.error("[whatsapp agent] model call threw", err);
    return null;
  }
}
