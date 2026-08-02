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
    const threeDaysAgo = new Date(now.getTime() - 3 * MS_PER_DAY).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * MS_PER_DAY).toISOString();

    // Fetch user profile for personalized greeting
    const profileRes = await supabase
      .from("profiles")
      .select("first_name, full_name")
      .eq("id", userId)
      .maybeSingle();
    const firstName = profileRes.data?.first_name || profileRes.data?.full_name?.split(" ")[0] || null;

    const [
      overdueTasksRes,
      todayTasksRes,
      completedRes,
      allPendingTasksRes,
      staleDealsRes,
      recentActivitiesRes,
      newLeadsRes,
      bigDealsRes,
      openTicketsRes,
      pipelineRes,
      yesterdayCompletedRes,
    ] = await Promise.all([
      supabase.from("tasks").select("id, title, due_at")
        .eq("assignee_uid", userId).lt("due_at", ds).is("completed_at", null)
        .order("due_at", { ascending: true }).limit(10),
      supabase.from("tasks").select("id, title, due_at")
        .eq("assignee_uid", userId).gte("due_at", ds).lt("due_at", de).is("completed_at", null)
        .order("due_at", { ascending: true }).limit(10),
      supabase.from("tasks").select("id, title, completed_at")
        .eq("assignee_uid", userId).gte("completed_at", ds).lt("completed_at", de).limit(20),
      // Tasks with no due date — still pending
      supabase.from("tasks").select("id, title, created_at")
        .eq("assignee_uid", userId).is("due_at", null).is("completed_at", null)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("deals").select("id, name, updated_at, expected_value, leads(full_name)")
        .is("deleted_at", null).is("closed_at", null).lt("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: true }).limit(10),
      supabase.from("activities").select("id, entity_type, entity_id, direction, occurred_at")
        .eq("user_id", userId).gte("occurred_at", ds).lt("occurred_at", de),
      supabase.from("leads").select("id, full_name, company_name, created_at")
        .is("deleted_at", null).gte("created_at", twoDaysAgo)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("deals").select("id, name, expected_value, stage, updated_at, leads(full_name)")
        .is("deleted_at", null).is("closed_at", null)
        .order("expected_value", { ascending: false }).limit(5),
      supabase.from("tickets").select("id, title, status, priority, created_at")
        .in("status", ["open", "in_progress"]).order("created_at", { ascending: true }).limit(10),
      supabase.from("deals").select("id, name, stage, expected_value, leads(full_name)")
        .is("deleted_at", null).is("closed_at", null)
        .order("created_at", { ascending: false }).limit(20),
      supabase.from("tasks").select("id").eq("assignee_uid", userId)
        .gte("completed_at", new Date(todayStart.getTime() - MS_PER_DAY).toISOString())
        .lt("completed_at", ds),
    ]);

    type Task = { id: string; title: string | null; due_at: string | null };
    type StaleDeal = { id: string; name: string | null; updated_at: string | null; expected_value: number | null; leads: { full_name: string | null } | null };
    type Lead = { id: string; full_name: string | null; company_name: string | null; created_at: string };
    type BigDeal = { id: string; name: string | null; expected_value: number | null; stage: string | null; updated_at: string | null; leads: { full_name: string | null } | null };
    type Ticket = { id: string; title: string | null; status: string; priority: string | null; created_at: string };

    const overdueTasks = (overdueTasksRes.data as unknown as Task[]) ?? [];
    const todayTasks = (todayTasksRes.data as unknown as Task[]) ?? [];
    const completed = completedRes.data ?? [];
    const noDueTasks = (allPendingTasksRes.data as unknown as { id: string; title: string | null; created_at: string }[]) ?? [];
    const staleDeals = (staleDealsRes.data as unknown as StaleDeal[]) ?? [];
    const todayActivities = recentActivitiesRes.data ?? [];
    const newLeads = (newLeadsRes.data as unknown as Lead[]) ?? [];
    const bigDeals = (bigDealsRes.data as unknown as BigDeal[]) ?? [];
    const openTickets = (openTicketsRes.data as unknown as Ticket[]) ?? [];
    const pipeline = (pipelineRes.data as unknown as BigDeal[]) ?? [];
    const yesterdayCompleted = yesterdayCompletedRes.data ?? [];

    const outboundCount = todayActivities.filter((a: { direction: string | null }) => a.direction === "outbound").length;
    const contactedEntityIds = new Set(
      todayActivities
        .filter((a: { direction: string | null }) => a.direction === "outbound")
        .map((a: { entity_id: string }) => a.entity_id),
    );
    const contactedIds = new Set(todayActivities.map((a: { entity_id: string }) => a.entity_id));

    const directives: Directive[] = [];
    let idx = 0;

    const ya = firstName ? `يا ${firstName}، ` : "";

    // 1. Overdue tasks — most urgent
    overdueTasks.forEach((t) => {
      const days = Math.ceil((now.getTime() - new Date(t.due_at!).getTime()) / MS_PER_DAY);
      directives.push({
        id: `d${idx++}`, type: "urgent", icon: "🔴",
        message: `${ya}مهمة "${t.title || "بدون عنوان"}" متأخرة ${days} ${days === 1 ? "يوم" : "أيام"} — خلّصها الحين`,
        action: "روح للمهام", actionHref: "/dashboard/tasks",
      });
    });

    // 2. Stale deals
    staleDeals.forEach((d) => {
      const days = Math.ceil((now.getTime() - new Date(d.updated_at!).getTime()) / MS_PER_DAY);
      const name = d.leads?.full_name || d.name || "عميل";
      const val = d.expected_value ? ` (${(d.expected_value / 100).toLocaleString("ar-SA")} ر.س)` : "";
      directives.push({
        id: `d${idx++}`, type: "warning", icon: "⚠️",
        message: `صفقة "${name}"${val} واقفة من ${days} يوم — اتصل عليه أو أرسل عرض`,
        action: "افتح الصفقات", actionHref: "/dashboard/deals",
      });
    });

    // 3. Open tickets
    const urgentTickets = openTickets.filter((t) => t.priority === "high" || t.priority === "urgent");
    urgentTickets.forEach((t) => {
      directives.push({
        id: `d${idx++}`, type: "urgent", icon: "🎫",
        message: `تذكرة "${t.title || "بدون عنوان"}" مفتوحة وأولويتها عالية — تابعها`,
        action: "افتح التذاكر", actionHref: "/dashboard/tickets",
      });
    });
    const normalTickets = openTickets.filter((t) => t.priority !== "high" && t.priority !== "urgent");
    if (normalTickets.length > 0) {
      directives.push({
        id: `d${idx++}`, type: "remind", icon: "🎫",
        message: `عندك ${normalTickets.length} ${normalTickets.length === 1 ? "تذكرة مفتوحة" : "تذاكر مفتوحة"} — لا تنساها`,
        action: "افتح التذاكر", actionHref: "/dashboard/tickets",
      });
    }

    // 4. Untouched new leads
    const untouchedLeads = newLeads.filter((l) => !contactedIds.has(l.id));
    untouchedLeads.forEach((l) => {
      const name = l.full_name || l.company_name || "عميل جديد";
      directives.push({
        id: `d${idx++}`, type: "remind", icon: "📞",
        message: `"${name}" عميل جديد ما تواصلت معه — اتصل عليه قبل ما يبرد`,
        action: "افتح العملاء", actionHref: "/dashboard/leads",
      });
    });

    // 5. Today's upcoming tasks
    todayTasks.forEach((t) => {
      const dueTime = new Date(t.due_at!);
      const h = dueTime.getHours();
      const m = dueTime.getMinutes();
      const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const isUpcoming = dueTime.getTime() - now.getTime() < 2 * 3600 * 1000 && dueTime > now;
      directives.push({
        id: `d${idx++}`, type: isUpcoming ? "warning" : "remind",
        icon: isUpcoming ? "⏰" : "📋",
        message: isUpcoming
          ? `مهمة "${t.title || "بدون عنوان"}" مستحقة الساعة ${timeStr} — جهّز لها`
          : `لا تنسى مهمة "${t.title || "بدون عنوان"}" اليوم الساعة ${timeStr}`,
        action: "روح للمهام", actionHref: "/dashboard/tasks",
      });
    });

    // 5b. Tasks with no due date
    noDueTasks.forEach((t) => {
      directives.push({
        id: `d${idx++}`, type: "remind", icon: "📌",
        message: `${ya}عندك مهمة "${t.title || "بدون عنوان"}" بدون موعد — حدد لها وقت أو خلّصها`,
        action: "روح للمهام", actionHref: "/dashboard/tasks",
      });
    });

    // 6. Big deals needing attention (3-7 days)
    bigDeals.forEach((d) => {
      if (staleDeals.some((sd) => sd.id === d.id)) return;
      const daysSince = Math.ceil((now.getTime() - new Date(d.updated_at!).getTime()) / MS_PER_DAY);
      if (daysSince >= 3 && daysSince < 7) {
        const name = d.leads?.full_name || d.name || "صفقة كبيرة";
        directives.push({
          id: `d${idx++}`, type: "remind", icon: "💰",
          message: `صفقة "${name}" كبيرة وما حركتها من ${daysSince} أيام — تابعها`,
          action: "افتح الصفقات", actionHref: "/dashboard/deals",
        });
      }
    });

    // 7. Activity warnings
    if (outboundCount === 0 && now.getHours() >= 10) {
      directives.push({
        id: `d${idx++}`, type: "warning", icon: "📵",
        message: "ما سويت أي تواصل اليوم — ابدأ اتصل على عملائك الحين",
        action: "افتح النشاطات", actionHref: "/dashboard/activities",
      });
    } else if (outboundCount > 0 && outboundCount < 3 && now.getHours() >= 12) {
      directives.push({
        id: `d${idx++}`, type: "remind", icon: "📱",
        message: `تواصلت مع ${outboundCount} بس — حاول توصل ٥ على الأقل اليوم`,
      });
    }

    // 9. Praise
    if (completed.length > 0) {
      directives.push({
        id: `d${idx++}`, type: "praise", icon: "✅",
        message: completed.length === 1
          ? "أنجزت مهمة وحدة اليوم — كمّل على كذا"
          : `أنجزت ${completed.length} مهام اليوم — شغل ممتاز، واصل`,
      });
    }
    if (outboundCount >= 5) {
      directives.push({
        id: `d${idx++}`, type: "praise", icon: "🔥",
        message: `تواصلت مع ${contactedEntityIds.size} عميل اليوم — أداء خرافي!`,
      });
    }
    if (completed.length > yesterdayCompleted.length && yesterdayCompleted.length > 0) {
      directives.push({
        id: `d${idx++}`, type: "praise", icon: "📈",
        message: `إنتاجيتك اليوم أعلى من أمس — استمر!`,
      });
    }

    directives.sort((a, b) => {
      const order = { urgent: 0, warning: 1, remind: 2, praise: 3 };
      return order[a.type] - order[b.type];
    });

    // Pipeline summary for AI context
    const stageCount: Record<string, number> = {};
    let totalPipelineValue = 0;
    pipeline.forEach((d) => {
      stageCount[d.stage || "غير محدد"] = (stageCount[d.stage || "غير محدد"] || 0) + 1;
      totalPipelineValue += d.expected_value || 0;
    });

    // AI Summary
    let aiSummary: string | null = null;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      try {
        const directivesList = directives.slice(0, 8).map((d) => `- [${d.type}] ${d.message}`).join("\n");
        const pipelineStr = Object.entries(stageCount).map(([s, c]) => `${s}: ${c}`).join("، ");
        const prompt = `أنت مشرف المبيعات في شركة "مورد". اسمك "المشرف الذكي". أنت روبوت ذكي تراقب أداء المندوب.
${firstName ? `اسم المندوب: ${firstName}. خاطبه باسمه (يا ${firstName}).` : ""}

## بيانات اليوم:
- مهام منجزة: ${completed.length}
- مهام باقية: ${todayTasks.length}
- مهام متأخرة: ${overdueTasks.length}
- تواصل اليوم: ${outboundCount} (${contactedEntityIds.size} عميل)
- صفقات واقفة (7+ أيام): ${staleDeals.length}
- تذاكر مفتوحة: ${openTickets.length}
- عملاء جدد بدون تواصل: ${untouchedLeads.length}
- مسار الصفقات: ${pipelineStr || "فاضي"}
- قيمة المسار: ${totalPipelineValue > 0 ? (totalPipelineValue / 100).toLocaleString("ar-SA") + " ر.س" : "—"}

## التوجيهات:
${directivesList || "لا توجيهات — كل شيء تمام"}

اكتب رسالة شخصية قصيرة (3-4 جمل) كأنك مشرف حقيقي يكلم مندوبه. تكلم بالعامية السعودية. كن:
- محدد (اذكر أرقام وأسماء إذا فيه)
- عملي (قل بالضبط وش يسوي أول شيء)
- حنون بس صارم
- ابدأ بتحية مناسبة: صباح الخير (قبل الظهر)، هلا والله (الظهر للعصر)، مساء الخير (بعد العصر). لا تستخدم "عصر الخير" أو تحيات غريبة.
- لا تذكر جهات الاتصال — ركز على المهام والصفقات والعملاء المحتملين والتذاكر فقط

أجب بـ JSON فقط: {"message": "..."}`;

        const res = await fetch(OPENROUTER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              { role: "system", content: "أنت مشرف مبيعات روبوت اسمك 'المشرف الذكي' من نظام مورد CRM. تتكلم بالعامية السعودية. أجب بـ JSON فقط." },
              { role: "user", content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 300,
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
      const hour = now.getHours();
      const greeting = hour < 10 ? "صباح الخير" : hour < 16 ? "هلا والله" : "مساء الخير";
      const nameGreet = firstName ? ` يا ${firstName}` : "";
      const urgentCount = directives.filter((d) => d.type === "urgent").length;
      if (urgentCount > 0) {
        aiSummary = `${greeting}${nameGreet}! أنا مشرفك من مورد 🤖\n\nعندك ${urgentCount} شيء عاجل لازم تخلصه الحين. لا تأجل — خلّنا ننجز ونخلّص.`;
      } else if (directives.length > 0) {
        aiSummary = `${greeting}${nameGreet}! أنا مشرفك من مورد 🤖\n\nيومك ماشي بس فيه أشياء تحتاج انتباهك. شف التوجيهات تحت وخلّصها وحدة وحدة.`;
      } else {
        aiSummary = `${greeting}${nameGreet}! أنا مشرفك من مورد 🤖\n\nما عندك شيء عالق — شغلك تمام اليوم! دوّر فرص جديدة وخلّنا نكبّر الأرقام.`;
      }
    }

    const stats = {
      completedToday: completed.length,
      pendingToday: todayTasks.length,
      overdueCount: overdueTasks.length,
      outboundToday: outboundCount,
      staleCount: staleDeals.length,
      openTickets: openTickets.length,
      pipelineCount: pipeline.length,
      pipelineValue: totalPipelineValue,
      newLeads: newLeads.length,
      noDueTasks: noDueTasks.length,
    };

    return NextResponse.json({ directives, aiSummary, stats, firstName });
  } catch (e) {
    console.error("[rep-coach] error", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
