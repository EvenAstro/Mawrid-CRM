import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";
const MS_PER_DAY = 86_400_000;

interface Directive {
  id: string;
  type: "urgent" | "warning" | "remind" | "praise";
  icon: string;
  message: string;
  action?: string;
  actionHref?: string;
  entity?: string;
  detail?: string;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const ds = todayStart.toISOString();
    const de = todayEnd.toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY).toISOString();

    const [
      overdueTasksRes,
      todayTasksRes,
      completedRes,
      staleDealsRes,
      recentActivitiesRes,
      unansweredLeadsRes,
      bigDealsRes,
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, due_at")
        .eq("assignee_uid", userId)
        .lt("due_at", ds)
        .is("completed_at", null)
        .order("due_at", { ascending: true })
        .limit(10),
      supabase
        .from("tasks")
        .select("id, title, due_at")
        .eq("assignee_uid", userId)
        .gte("due_at", ds)
        .lt("due_at", de)
        .is("completed_at", null)
        .order("due_at", { ascending: true })
        .limit(10),
      supabase
        .from("tasks")
        .select("id, title, completed_at")
        .eq("assignee_uid", userId)
        .gte("completed_at", ds)
        .lt("completed_at", de)
        .limit(20),
      supabase
        .from("deals")
        .select("id, name, updated_at, expected_value, leads(full_name)")
        .is("deleted_at", null)
        .is("closed_at", null)
        .lt("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: true })
        .limit(10),
      supabase
        .from("activities")
        .select("id, entity_type, entity_id, direction, occurred_at")
        .eq("user_id", userId)
        .gte("occurred_at", ds)
        .lt("occurred_at", de),
      supabase
        .from("leads")
        .select("id, full_name, company_name, created_at")
        .is("deleted_at", null)
        .gte("created_at", new Date(now.getTime() - 2 * MS_PER_DAY).toISOString())
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("deals")
        .select("id, name, expected_value, stage, updated_at, leads(full_name)")
        .is("deleted_at", null)
        .is("closed_at", null)
        .order("expected_value", { ascending: false })
        .limit(5),
    ]);

    type Task = { id: string; title: string | null; due_at: string | null };
    type StaleDeal = { id: string; name: string | null; updated_at: string | null; expected_value: number | null; leads: { full_name: string | null } | null };
    type Lead = { id: string; full_name: string | null; company_name: string | null; created_at: string };
    type BigDeal = { id: string; name: string | null; expected_value: number | null; stage: string | null; updated_at: string | null; leads: { full_name: string | null } | null };

    const overdueTasks = (overdueTasksRes.data as unknown as Task[]) ?? [];
    const todayTasks = (todayTasksRes.data as unknown as Task[]) ?? [];
    const completed = (completedRes.data ?? []);
    const staleDeals = (staleDealsRes.data as unknown as StaleDeal[]) ?? [];
    const todayActivities = (recentActivitiesRes.data ?? []);
    const newLeads = (unansweredLeadsRes.data as unknown as Lead[]) ?? [];
    const bigDeals = (bigDealsRes.data as unknown as BigDeal[]) ?? [];

    const outboundCount = todayActivities.filter((a: { direction: string | null }) => a.direction === "outbound").length;
    const contactedEntityIds = new Set(
      todayActivities
        .filter((a: { direction: string | null }) => a.direction === "outbound")
        .map((a: { entity_id: string }) => a.entity_id),
    );

    const directives: Directive[] = [];
    let idx = 0;

    overdueTasks.forEach((t) => {
      const days = Math.ceil((now.getTime() - new Date(t.due_at!).getTime()) / MS_PER_DAY);
      directives.push({
        id: `d${idx++}`,
        type: "urgent",
        icon: "🔴",
        message: `عندك مهمة "${t.title || "بدون عنوان"}" متأخرة ${days} ${days === 1 ? "يوم" : "أيام"} — أنهِها الحين`,
        action: "روح للمهام",
        actionHref: "/dashboard/tasks",
        entity: t.title || undefined,
      });
    });

    staleDeals.forEach((d) => {
      const days = Math.ceil((now.getTime() - new Date(d.updated_at!).getTime()) / MS_PER_DAY);
      const name = d.leads?.full_name || d.name || "عميل";
      const val = d.expected_value ? ` (${(d.expected_value / 100).toLocaleString("ar-SA")} ر.س)` : "";
      directives.push({
        id: `d${idx++}`,
        type: "warning",
        icon: "⚠️",
        message: `صفقة "${name}"${val} واقفة من ${days} يوم — اتصل عليه أو أرسل له عرض`,
        action: "افتح الصفقات",
        actionHref: "/dashboard/deals",
        entity: name,
        detail: `${days} يوم بدون تحديث`,
      });
    });

    const contactedIds = new Set(
      todayActivities.map((a: { entity_id: string }) => a.entity_id),
    );
    const untouchedLeads = newLeads.filter((l) => !contactedIds.has(l.id));
    untouchedLeads.forEach((l) => {
      const name = l.full_name || l.company_name || "عميل جديد";
      directives.push({
        id: `d${idx++}`,
        type: "remind",
        icon: "📞",
        message: `"${name}" عميل جديد ما تواصلت معه — اتصل عليه قبل ما يبرد`,
        action: "افتح العملاء",
        actionHref: "/dashboard/leads",
        entity: name,
      });
    });

    todayTasks.forEach((t) => {
      const dueTime = new Date(t.due_at!);
      const h = dueTime.getHours();
      const m = dueTime.getMinutes();
      const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const isUpcoming = dueTime.getTime() - now.getTime() < 2 * 3600 * 1000 && dueTime > now;
      directives.push({
        id: `d${idx++}`,
        type: isUpcoming ? "warning" : "remind",
        icon: isUpcoming ? "⏰" : "📋",
        message: isUpcoming
          ? `مهمة "${t.title || "بدون عنوان"}" مستحقة الساعة ${timeStr} — جهّز لها`
          : `لا تنسى مهمة "${t.title || "بدون عنوان"}" اليوم الساعة ${timeStr}`,
        action: "روح للمهام",
        actionHref: "/dashboard/tasks",
      });
    });

    bigDeals.forEach((d) => {
      if (staleDeals.some((sd) => sd.id === d.id)) return;
      const daysSince = Math.ceil((now.getTime() - new Date(d.updated_at!).getTime()) / MS_PER_DAY);
      if (daysSince >= 3 && daysSince < 7) {
        const name = d.leads?.full_name || d.name || "صفقة كبيرة";
        directives.push({
          id: `d${idx++}`,
          type: "remind",
          icon: "💰",
          message: `صفقة "${name}" كبيرة وما حركتها من ${daysSince} أيام — تابعها`,
          action: "افتح الصفقات",
          actionHref: "/dashboard/deals",
        });
      }
    });

    if (outboundCount === 0 && now.getHours() >= 10) {
      directives.push({
        id: `d${idx++}`,
        type: "warning",
        icon: "📵",
        message: "ما سويت أي تواصل اليوم — ابدأ اتصل على عملائك",
        action: "افتح النشاطات",
        actionHref: "/dashboard/activities",
      });
    } else if (outboundCount > 0 && outboundCount < 3 && now.getHours() >= 12) {
      directives.push({
        id: `d${idx++}`,
        type: "remind",
        icon: "📱",
        message: `تواصلت مع ${outboundCount} بس — حاول توصل ٥ على الأقل اليوم`,
      });
    }

    if (completed.length > 0) {
      directives.push({
        id: `d${idx++}`,
        type: "praise",
        icon: "✅",
        message: completed.length === 1
          ? `أنجزت مهمة وحدة اليوم — كمّل`
          : `أنجزت ${completed.length} مهام اليوم — شغل حلو، كمّل`,
      });
    }

    if (outboundCount >= 5) {
      directives.push({
        id: `d${idx++}`,
        type: "praise",
        icon: "🔥",
        message: `تواصلت مع ${contactedEntityIds.size} عميل اليوم — أداء ممتاز!`,
      });
    }

    directives.sort((a, b) => {
      const order = { urgent: 0, warning: 1, remind: 2, praise: 3 };
      return order[a.type] - order[b.type];
    });

    let aiSummary: string | null = null;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey && directives.length > 0) {
      try {
        const context = directives.slice(0, 8).map((d) => `- ${d.message}`).join("\n");
        const res = await fetch(OPENROUTER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              { role: "system", content: "أنت مشرف مبيعات صارم بس حنون. كلامك مباشر وقصير. تتكلم بالعامية السعودية. أجب بـ JSON فقط." },
              { role: "user", content: `هذي أهم الأشياء اللي لازم المندوب يسويها اليوم:\n${context}\n\nاكتب رسالة تحفيزية قصيرة (جملتين-ثلاث) كأنك مشرفه وتلاحقه وراه. كن محدد وعملي.\n\nأجب بـ JSON:\n{"message": "..."}` },
            ],
            temperature: 0.8,
            max_tokens: 200,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const raw = json?.choices?.[0]?.message?.content;
          if (raw) {
            const parsed = JSON.parse(stripFences(raw));
            aiSummary = parsed.message;
          }
        }
      } catch (e) {
        console.error("[rep-coach] AI summary failed", e);
      }
    }

    if (!aiSummary) {
      const urgentCount = directives.filter((d) => d.type === "urgent").length;
      const warningCount = directives.filter((d) => d.type === "warning").length;
      if (urgentCount > 0) {
        aiSummary = `عندك ${urgentCount} شيء عاجل لازم تخلصه الحين. لا تأجل — ابدأ بالأهم وخلّص.`;
      } else if (warningCount > 0) {
        aiSummary = `فيه أشياء تحتاج انتباهك اليوم. ركّز عليها وخلّصها قبل نهاية الدوام.`;
      } else if (directives.length === 0) {
        aiSummary = `ما عندك شيء عالق — شغلك تمام. دوّر فرص جديدة وتواصل مع عملائك.`;
      } else {
        aiSummary = `يومك ماشي — بس لا تنسى الأشياء اللي تحت. خلّصها وبعدها ارتاح.`;
      }
    }

    const stats = {
      completedToday: completed.length,
      pendingToday: todayTasks.length,
      overdueCount: overdueTasks.length,
      outboundToday: outboundCount,
      staleCount: staleDeals.length,
    };

    return NextResponse.json({ directives, aiSummary, stats });
  } catch (e) {
    console.error("[rep-coach] error", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
