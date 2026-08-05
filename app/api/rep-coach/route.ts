import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/rateLimit";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";
const MS_PER_DAY = 86_400_000;

// Saudi Arabia doesn't observe DST, so a fixed +3h offset from UTC is safe
// year-round. This route runs server-side (Vercel functions default to
// UTC), so without this every "today"/hour-of-day check below — the
// overdue-task boundary, the greeting hour, the "no outbound yet" nudge —
// would silently compute against UTC's midnight/clock instead of the rep's
// actual Riyadh wall clock, misfiring by 3 hours in both directions.
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The current instant, shifted so its UTC-getters read as Riyadh wall-clock time. */
function riyadhNow(): Date {
  return new Date(Date.now() + RIYADH_OFFSET_MS);
}

/** Real UTC instants for the start/end of "today" in Riyadh — safe to compare
 * directly against due_at/occurred_at columns, which are stored in UTC. */
function riyadhDayBounds(shiftedNow: Date): { start: Date; end: Date } {
  const y = shiftedNow.getUTCFullYear(), m = shiftedNow.getUTCMonth(), d = shiftedNow.getUTCDate();
  const startOfShiftedDayMs = Date.UTC(y, m, d, 0, 0, 0, 0);
  const start = new Date(startOfShiftedDayMs - RIYADH_OFFSET_MS);
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { start, end };
}

/** "HH:MM" for a UTC timestamp, as it reads on a Riyadh wall clock. */
function riyadhTimeStr(d: Date): string {
  const shifted = new Date(d.getTime() + RIYADH_OFFSET_MS);
  const h = shifted.getUTCHours().toString().padStart(2, "0");
  const m = shifted.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

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
  // The userId always comes from the verified token, never from the query
  // string — otherwise any caller could read another rep's tasks/deals by
  // passing a different id (this route uses supabaseAdmin, which bypasses RLS).
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = caller.id;

  const rl = checkRateLimit(`${userId}:rep-coach`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit", message: "طلبات كثيرة جداً — حاول بعد شوي." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const now = new Date();
    const shiftedNow = riyadhNow();
    const { start: todayStart, end: todayEnd } = riyadhDayBounds(shiftedNow);
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

    const threeDaysFromNow = new Date(now.getTime() + 3 * MS_PER_DAY).toISOString();

    const [
      overdueTasksRes,
      todayTasksRes,
      upcomingTasksRes,
      completedRes,
      allPendingTasksRes,
      staleDealsRes,
      recentActivitiesRes,
      newLeadsRes,
      bigDealsRes,
      pipelineRes,
      meetingsRes,
      quoteDealsRes,
      yesterdayCompletedRes,
    ] = await Promise.all([
      supabase.from("tasks").select("id, title, due_at")
        .eq("assignee_uid", userId).lt("due_at", ds).is("completed_at", null)
        .order("due_at", { ascending: true }).limit(10),
      supabase.from("tasks").select("id, title, due_at")
        .eq("assignee_uid", userId).gte("due_at", ds).lt("due_at", de).is("completed_at", null)
        .order("due_at", { ascending: true }).limit(10),
      // Upcoming tasks — tomorrow to 3 days from now
      supabase.from("tasks").select("id, title, due_at")
        .eq("assignee_uid", userId).gte("due_at", de).lte("due_at", threeDaysFromNow).is("completed_at", null)
        .order("due_at", { ascending: true }).limit(10),
      supabase.from("tasks").select("id, title, completed_at")
        .eq("assignee_uid", userId).gte("completed_at", ds).lt("completed_at", de).limit(20),
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
      supabase.from("deals").select("id, name, stage, expected_value, leads(full_name)")
        .is("deleted_at", null).is("closed_at", null)
        .order("created_at", { ascending: false }).limit(20),
      // Upcoming meetings — activities with "meeting" type in the next 3 days
      supabase.from("activities").select("id, body, occurred_at, activity_types!inner(label)")
        .eq("user_id", userId).gte("occurred_at", ds).lte("occurred_at", threeDaysFromNow)
        .ilike("activity_types.label", "%meeting%")
        .order("occurred_at", { ascending: true }).limit(10),
      // Deals in quote/proposal stage — need follow-up if not updated in 3+ days
      supabase.from("deals").select("id, name, expected_value, updated_at, leads(full_name), pipeline_stages!inner(label)")
        .is("deleted_at", null).is("closed_at", null).lt("updated_at", threeDaysAgo)
        .ilike("pipeline_stages.label", "%عرض%")
        .order("updated_at", { ascending: true }).limit(10),
      supabase.from("tasks").select("id").eq("assignee_uid", userId)
        .gte("completed_at", new Date(todayStart.getTime() - MS_PER_DAY).toISOString())
        .lt("completed_at", ds),
    ]);

    type Task = { id: string; title: string | null; due_at: string | null };
    type StaleDeal = { id: string; name: string | null; updated_at: string | null; expected_value: number | null; leads: { full_name: string | null } | null };
    type Lead = { id: string; full_name: string | null; company_name: string | null; created_at: string };
    type BigDeal = { id: string; name: string | null; expected_value: number | null; stage: string | null; updated_at: string | null; leads: { full_name: string | null } | null };
    type Meeting = { id: string; body: string | null; occurred_at: string | null; activity_types: { label: string } };
    type QuoteDeal = { id: string; name: string | null; expected_value: number | null; updated_at: string | null; leads: { full_name: string | null } | null; pipeline_stages: { label: string } };

    const overdueTasks = (overdueTasksRes.data as unknown as Task[]) ?? [];
    const todayTasks = (todayTasksRes.data as unknown as Task[]) ?? [];
    const upcomingTasks = (upcomingTasksRes.data as unknown as Task[]) ?? [];
    const completed = completedRes.data ?? [];
    const noDueTasks = (allPendingTasksRes.data as unknown as { id: string; title: string | null; created_at: string }[]) ?? [];
    const staleDeals = (staleDealsRes.data as unknown as StaleDeal[]) ?? [];
    const todayActivities = recentActivitiesRes.data ?? [];
    const newLeads = (newLeadsRes.data as unknown as Lead[]) ?? [];
    const bigDeals = (bigDealsRes.data as unknown as BigDeal[]) ?? [];
    const pipeline = (pipelineRes.data as unknown as BigDeal[]) ?? [];
    const meetings = (meetingsRes.data as unknown as Meeting[]) ?? [];
    const quoteDeals = (quoteDealsRes.data as unknown as QuoteDeal[]) ?? [];
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

    // 3. Upcoming meetings
    meetings.forEach((m) => {
      const mDate = new Date(m.occurred_at!);
      const isToday = mDate >= todayStart && mDate < todayEnd;
      const isTomorrow = mDate >= todayEnd && mDate < new Date(todayEnd.getTime() + MS_PER_DAY);
      const timeStr = riyadhTimeStr(mDate);
      const desc = m.body ? ` — ${m.body.slice(0, 50)}` : "";
      if (isToday) {
        const hoursLeft = (mDate.getTime() - now.getTime()) / 3600000;
        directives.push({
          id: `d${idx++}`, type: hoursLeft <= 2 ? "urgent" : "warning", icon: "🗓️",
          message: `${ya}عندك اجتماع الساعة ${timeStr}${desc} — جهّز له`,
          action: "افتح النشاطات", actionHref: "/dashboard/activities",
        });
      } else if (isTomorrow) {
        directives.push({
          id: `d${idx++}`, type: "remind", icon: "🗓️",
          message: `${ya}عندك اجتماع بكرة الساعة ${timeStr}${desc}`,
          action: "افتح النشاطات", actionHref: "/dashboard/activities",
        });
      }
    });

    // 3b. Quote/proposal deals needing follow-up
    quoteDeals.forEach((d) => {
      const days = Math.ceil((now.getTime() - new Date(d.updated_at!).getTime()) / MS_PER_DAY);
      const name = d.leads?.full_name || d.name || "عميل";
      const val = d.expected_value ? ` (${(d.expected_value / 100).toLocaleString("ar-SA")} ر.س)` : "";
      directives.push({
        id: `d${idx++}`, type: "warning", icon: "📄",
        message: `${ya}عرض سعر لـ "${name}"${val} ما تابعته من ${days} يوم — تواصل معه`,
        action: "افتح الصفقات", actionHref: "/dashboard/deals",
      });
    });

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
      const timeStr = riyadhTimeStr(dueTime);
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

    // 5b. Upcoming tasks (tomorrow+)
    upcomingTasks.forEach((t) => {
      const dueDate = new Date(t.due_at!);
      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / MS_PER_DAY);
      const dayLabel = daysDiff <= 1 ? "بكرة" : `بعد ${daysDiff} أيام`;
      const timeStr = riyadhTimeStr(dueDate);
      directives.push({
        id: `d${idx++}`, type: "remind", icon: "📅",
        message: `${ya}عندك مهمة "${t.title || "بدون عنوان"}" ${dayLabel} الساعة ${timeStr} — جهّز لها`,
        action: "روح للمهام", actionHref: "/dashboard/tasks",
      });
    });

    // 5c. Tasks with no due date
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
    if (outboundCount === 0 && shiftedNow.getUTCHours() >= 10) {
      directives.push({
        id: `d${idx++}`, type: "warning", icon: "📵",
        message: "ما سويت أي تواصل اليوم — ابدأ اتصل على عملائك الحين",
        action: "افتح النشاطات", actionHref: "/dashboard/activities",
      });
    } else if (outboundCount > 0 && outboundCount < 3 && shiftedNow.getUTCHours() >= 12) {
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
- اجتماعات قادمة: ${meetings.length}
- عروض أسعار تحتاج متابعة: ${quoteDeals.length}
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
      const hour = shiftedNow.getUTCHours();
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
      meetingsCount: meetings.length,
      quoteDealsCount: quoteDeals.length,
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
