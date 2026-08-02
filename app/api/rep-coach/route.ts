import { NextRequest, NextResponse } from "next/server";
import { calcRepScore, type RepScoreData } from "@/lib/repScore";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";

function buildCoachPrompt(data: RepScoreData): string {
  return `أنت مدرب مبيعات محترف في نظام Mawrid CRM. مهمتك تحليل أداء الموظف اليوم وتقديم 3 نصائح عملية محددة.

## بيانات اليوم:
- النتيجة الإجمالية: ${data.score}/100
- المهام المنجزة: ${data.tasksCompleted} من ${data.tasksTotal}
- مهام متأخرة: ${data.overdueTasks}
- عملاء تم التواصل معهم: ${data.contacts}
- صفقات تم تحريكها: ${data.dealsAdvanced}
- متوسط وقت الرد: ${data.avgResponseHours !== null ? `${data.avgResponseHours} ساعة` : "غير متوفر"}
- صفقات راكدة (7+ أيام): ${data.staleLeads}

## المهام المنجزة اليوم:
${data.topCompletedTasks.length ? data.topCompletedTasks.map((t) => `- ${t.title}`).join("\n") : "لا يوجد"}

## المهام المتأخرة:
${data.missedTasks.length ? data.missedTasks.map((t) => `- ${t.title}`).join("\n") : "لا يوجد"}

## صفقات راكدة:
${data.staleLeadNames.length ? data.staleLeadNames.map((s) => `- ${s.name} (${s.daysSince} يوم بدون تحديث)`).join("\n") : "لا يوجد"}

---
أجب بالعربية بصيغة JSON فقط بدون أي نص إضافي:
{
  "summary": "ملخص قصير جداً عن أداء اليوم (جملة واحدة)",
  "mood": "excellent" | "good" | "needs_work" | "critical",
  "tips": [
    { "icon": "emoji مناسب", "title": "عنوان قصير", "body": "شرح مختصر عملي" }
  ],
  "priority_action": "أهم خطوة يسويها الحين"
}`;
}

interface CoachResponse {
  summary: string;
  mood: "excellent" | "good" | "needs_work" | "critical";
  tips: { icon: string; title: string; body: string }[];
  priority_action: string;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const data = await calcRepScore(userId);

    const apiKey = process.env.OPENROUTER_API_KEY;
    let coaching: CoachResponse | null = null;

    if (apiKey) {
      try {
        const res = await fetch(OPENROUTER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              { role: "system", content: "أنت مدرب مبيعات خبير. أجب بـ JSON فقط." },
              { role: "user", content: buildCoachPrompt(data) },
            ],
            temperature: 0.7,
            max_tokens: 600,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const raw = json?.choices?.[0]?.message?.content;
          if (raw) coaching = JSON.parse(stripFences(raw));
        }
      } catch (e) {
        console.error("[rep-coach] AI call failed", e);
      }
    }

    if (!coaching) {
      coaching = fallbackCoaching(data);
    }

    return NextResponse.json({ score: data, coaching });
  } catch (e) {
    console.error("[rep-coach] error", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

function fallbackCoaching(data: RepScoreData): CoachResponse {
  const tips: CoachResponse["tips"] = [];

  if (data.overdueTasks > 0) {
    tips.push({ icon: "⏰", title: "أنهِ المهام المتأخرة", body: `عندك ${data.overdueTasks} مهام متأخرة — أنهِها قبل أي شيء ثاني` });
  }
  if (data.staleLeads > 0) {
    tips.push({ icon: "📞", title: "حرّك الصفقات الراكدة", body: `${data.staleLeads} صفقات ما اتحدثت من أسبوع. تواصل مع ${data.staleLeadNames[0]?.name || "العميل"} أول` });
  }
  if (data.contacts < 3) {
    tips.push({ icon: "🎯", title: "زِد التواصل", body: "حاول تتواصل مع 5 عملاء على الأقل اليوم" });
  }
  if (tips.length === 0) {
    tips.push({ icon: "🚀", title: "أداء ممتاز", body: "كمّل على هالمستوى وركز على الصفقات الكبيرة" });
  }

  const mood = data.score >= 80 ? "excellent" : data.score >= 60 ? "good" : data.score >= 40 ? "needs_work" : "critical";
  return {
    summary: data.score >= 70 ? "أداء جيد اليوم — استمر!" : "فيه مجال للتحسين — ركز على المهام المتأخرة",
    mood,
    tips,
    priority_action: data.overdueTasks > 0 ? "أنهِ المهام المتأخرة الحين" : data.staleLeads > 0 ? "تواصل مع أول صفقة راكدة" : "سجّل نشاطات جديدة",
  };
}
