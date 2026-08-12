import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
<<<<<<< HEAD
=======
import { checkRateLimit } from "@/lib/rateLimit";
>>>>>>> main

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";

const SYSTEM = `أنت محلل مبيعات متخصص مدمج في لوحة ذكاء الإيرادات لنظام Mawrid CRM.
مهمتك: تحليل بيانات خط المبيعات والإجابة على أسئلة المدير والموظفين بدقة وعمق.

قواعد الإجابة:
- أجب دائماً بالعربية بأسلوب مهني وموجز
- استخدم الأرقام الفعلية من البيانات المقدمة
- ابدأ بالإجابة مباشرة بدون مقدمات أو ترحيب
- استخدم **عريض** للأرقام المهمة والأسماء
- اقترح خطوة عملية واحدة في نهاية كل إجابة
- إذا سألوا عن توقعات أو استراتيجية، كن محدداً ومستنداً للبيانات`;

export async function POST(req: NextRequest) {
<<<<<<< HEAD
  if (!(await requireUser(req))) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
=======
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = checkRateLimit(`${caller.id}:revenue-intelligence-ai`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit", message: "طلبات كثيرة جداً — حاول بعد شوي." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
>>>>>>> main

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY missing" }, { status: 500 });

  const { messages, context } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    context: string;
  };

  const systemWithContext = `${SYSTEM}

=== بيانات خط المبيعات الحالي ===
${context}
=== نهاية البيانات ===

أجب على أسئلة المستخدم بناءً على هذه البيانات حصراً.`;

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mawrid-crm.vercel.app",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemWithContext },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content ?? "لم أتمكن من الإجابة.";
  return NextResponse.json({ reply });
}
