import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/copilot/snapshot";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const BASE_SYSTEM = `أنت مساعد مبيعات ذكي مدمج في نظام Mawrid CRM.
أجب دائماً بالعربية بأسلوب مهني وودود.
كن محدداً وعملياً — استخدم الأرقام والأسماء الفعلية من البيانات أدناه، لا تعطِ إجابات عامة.
ابدأ بالإجابة مباشرة دون ترحيب أو مقدمات.
نفّذ ما طلبه المستخدم فقط: إذا سأل سؤالاً أجب عليه، وإذا طلب كتابة رسالة فاكتب الرسالة.`;

const CAPABILITIES = `=== قدراتك ===

1. الإجابة على أسئلة الأعمال بناءً على البيانات أعلاه
2. كتابة رسائل احترافية للعملاء (واتساب، إيميل، مكالمة)
3. تحليل الأداء واقتراح أولويات العمل
4. تحليل أي صفقة أو عميل بالاسم

عند الإجابة على سؤال تحليلي (مثل: وين، كم، من، وش، ملخص): ابدأ بالإجابة المباشرة، ثم الأرقام الداعمة من البيانات، ثم توصية عملية واحدة. لا تكتب رسالة إلا إذا طُلب منك ذلك صراحة.

ملاحظة: السؤال عن "الصفقات العالقة" أو "المتأخرة" أو "اللي ما تواصلنا معها" تُجاب من قائمة «صفقات عالقة (بلا نشاط 7+ أيام)» في قسم الصفقات — لا من بيانات العملاء المحتملين. لكن إذا بدأ الطلب بـ "اكتب" فالمطلوب رسالة فعلية لذلك العميل وليس سرد بياناته.

عند طلب كتابة رسالة (اكتب/رسالة/عرض): اكتبها جاهزة للإرسال بأسلوب عربي سعودي مهني، بين سطري ---، مع اسم العميل. ("أول صفقة عالقة" = أول اسم في قائمة الصفقات العالقة أعلاه.)

استخدم تنسيقاً بسيطاً: **عريض** للتأكيد، وقوائم بـ - أو أرقام.
إذا كان الطلب خارج نطاق البيانات، قل ذلك بوضوح واقترح بديلاً.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type SectionKey = "leads" | "dealsOverview" | "closest" | "stuck" | "lost" | "weekly" | "activities" | "tasks";

/**
 * Deterministic intent routing. llama-3.3 can't reliably self-classify over a
 * large Arabic prompt (it anchors to whichever data section is most prominent
 * and ignores steering instructions), so we detect the question type from
 * keywords and include ONLY the relevant data section(s) in the prompt — the
 * model can't answer from a section it never sees. Draft requests win over all.
 */
function routeRequest(lastUser: string): { sections: SectionKey[]; instruction: string } {
  const t = lastUser;
  if (/اكتب|رسالة|عرض\s*سعر|صيغة|صِغ|واتساب|إيميل|ايميل/.test(t)) {
    return {
      sections: ["stuck", "closest"],
      instruction:
        "المستخدم يطلب كتابة رسالة. اكتب نص الرسالة الفعلي الجاهز للإرسال بين سطري ---، بأسلوب عربي سعودي مهني، ولا تسرد بيانات أو قوائم. إذا ذكر «أول صفقة عالقة» فاكتب للعميل الأول في قائمة الصفقات العالقة أعلاه.",
    };
  }
  if (/عالق|متأخر|متعثر|ما\s*تواصل|بلا\s*متابعة|بلا\s*تواصل|في\s*خطر|معرّض|معرض\s*للخطر/.test(t)) {
    return {
      sections: ["stuck", "lost"],
      instruction: "اذكر أهم 3-5 صفقات عالقة بالاسم مع المرحلة وعدد الأيام والقيمة، ثم توصية عملية واحدة.",
    };
  }
  if (/أقرب|اقرب|أفضل\s*صفقة|للإغلاق|قريب.*إغلاق|جاهز.*إغلاق/.test(t)) {
    return {
      sections: ["closest"],
      instruction: "اذكر أعلى الصفقات احتمالية للإغلاق بالاسم مع النسبة والقيمة، ثم توصية عملية واحدة.",
    };
  }
  if (/مصدر|مصادر|قناة|قنوات/.test(t)) {
    return {
      sections: ["leads"],
      instruction: "حدّد المصدر الأعلى للعملاء ثم اذكر التوزيع الكامل، ثم توصية عملية واحدة.",
    };
  }
  if (/مخسور|خسرنا|خسارة|خسائر/.test(t)) {
    return { sections: ["lost", "dealsOverview"], instruction: "اذكر الصفقات المخسورة بالأسماء والأسباب والقيم." };
  }
  if (/ملخص|أداء|الأسبوع|هذا\s*الشهر|تقرير|إنجاز/.test(t)) {
    return {
      sections: ["weekly", "dealsOverview", "lost"],
      instruction: "اعرض ملخص الأداء مختصراً بنقاط: الجديد، المربوح/المخسور، وقيمة الـ Pipeline، ثم توصية واحدة.",
    };
  }
  // Unmatched → give a broad but bounded set and let the model choose.
  return { sections: ["stuck", "closest", "leads", "dealsOverview", "activities"], instruction: "" };
}

function isChatMessage(v: unknown): v is ChatMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
}

/** GET — lightweight summary for the proactive greeting (stuck/upcoming counts). */
export async function GET() {
  try {
    const snap = await buildSnapshot();
    return NextResponse.json({ stuckCount: snap.stuckCount, upcomingCount: snap.upcomingCount });
  } catch (err) {
    console.error("[copilot] summary failed", err);
    return NextResponse.json({ stuckCount: 0, upcomingCount: 0 });
  }
}

export async function POST(req: NextRequest) {
  let body: { messages?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages.filter(isChatMessage).slice(-12); // cap history sent to the model
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }
  const context = typeof body.context === "string" ? body.context.trim() : "";

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const { sections, instruction } = routeRequest(lastUser);

  let dataBlock: string;
  try {
    const snap = await buildSnapshot();
    const chosen = sections.map((k) => snap.sections[k]).join("\n\n");
    dataBlock = `${snap.overview}\n\n${chosen}`;
  } catch (err) {
    console.error("[copilot] snapshot failed", err);
    dataBlock = "(تعذّر تحميل بيانات الأعمال الآن)";
  }

  const system = `${BASE_SYSTEM}

=== بيانات الأعمال الحالية (محدّثة للتو) ===

${dataBlock}

${CAPABILITIES}${context ? `\n\nسياق: ${context}` : ""}${
    instruction ? `\n\n=== تعليمة هذا الطلب ===\n${instruction}` : ""
  }`;

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 700,
        stream: true,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
  } catch (err) {
    console.error("[copilot] Groq call failed", err);
    return NextResponse.json({ error: "Copilot model request failed" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    // Log the EXACT status + raw body Groq returned, so the real cause is always visible.
    console.error(`[copilot] Groq returned HTTP ${upstream.status}. Raw body: ${detail}`);

    // Pull Groq's own human-readable reason out of the error body when present.
    let groqReason = "";
    let retryIn = "";
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } };
      groqReason = parsed.error?.message ?? "";
      const m = /try again in ([^.]+)/i.exec(groqReason);
      if (m) retryIn = m[1].trim();
    } catch {
      /* body may not be JSON */
    }

    if (upstream.status === 429) {
      const message = retryIn
        ? `تم بلوغ حد Groq المجاني (100 ألف رمز/يوم لكامل الحساب — ليس لكل مفتاح). حاول مرة أخرى خلال ${retryIn}.`
        : "تم بلوغ حد Groq المجاني (100 ألف رمز/يوم لكامل الحساب — ليس لكل مفتاح). سيعود العمل بعد إعادة تعيين الحصة.";
      return NextResponse.json({ error: "rate_limit", message, groqReason }, { status: 429 });
    }
    if (upstream.status === 401) {
      return NextResponse.json(
        { error: "auth", message: "مفتاح Groq غير صالح أو غير مُحمّل. تحقّق من GROQ_API_KEY وأعد تشغيل الخادم.", groqReason },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "model_error", message: "تعذّر الحصول على رد من المساعد.", groqReason }, { status: 502 });
  }

  // Re-stream Groq's OpenAI-style SSE as plain text deltas.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep the last, possibly-partial line
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const text = json.choices?.[0]?.delta?.content;
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // ignore keep-alive / non-JSON lines
            }
          }
        }
      } catch (err) {
        console.error("[copilot] stream relay error", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
