"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BellIcon } from "@/components/navIcons";
import { fetchNotifOverdueTasks, fetchNotifTodayTasks } from "@/lib/models/tasks";
import { fetchNotifStuckDeals } from "@/lib/models/deals";
import { fetchNotifNewLeads } from "@/lib/models/leads";

interface Notification {
  id: string;
  type: "overdue_task" | "stuck_deal" | "new_lead" | "upcoming_task";
  title: string;
  subtitle: string;
  href: string;
  time: string;
  icon: string;
}

const STORAGE_KEY = "mawrid_notif_seen";
const MS_PER_DAY = 86_400_000;

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { ids: string[]; date: string };
    if (parsed.date !== new Date().toISOString().slice(0, 10)) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  const existing = getSeenIds();
  ids.forEach((id) => existing.add(id));
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ids: Array.from(existing), date: new Date().toISOString().slice(0, 10) }),
  );
}

export default function NotificationsDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    let userId: string | undefined;
    try {
      const { data: userRes } = await supabase.auth.getUser();
      userId = userRes.user?.id;
    } catch (err) {
      console.warn("[NotificationsDropdown] getUser failed", err);
    }
    if (!userId) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [overdueRes, upcomingRes, dealsRes, leadsRes] = await Promise.all([
      fetchNotifOverdueTasks(userId, todayStart.toISOString()),
      fetchNotifTodayTasks(userId, todayStart.toISOString(), todayEnd.toISOString()),
      fetchNotifStuckDeals(new Date(now.getTime() - 7 * MS_PER_DAY).toISOString()),
      fetchNotifNewLeads(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const notifs: Notification[] = [];

    (overdueRes.data ?? []).forEach((t) => {
      const days = Math.ceil((now.getTime() - new Date(t.due_at!).getTime()) / MS_PER_DAY);
      notifs.push({
        id: `overdue-${t.id}`,
        type: "overdue_task",
        title: t.title || "مهمة بدون عنوان",
        subtitle: `متأخرة ${days} ${days === 1 ? "يوم" : "أيام"}`,
        href: "/dashboard/tasks",
        time: t.due_at!,
        icon: "⚠️",
      });
    });

    (upcomingRes.data ?? []).forEach((t) => {
      const h = new Date(t.due_at!).getHours();
      const m = new Date(t.due_at!).getMinutes();
      const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      notifs.push({
        id: `upcoming-${t.id}`,
        type: "upcoming_task",
        title: t.title || "مهمة بدون عنوان",
        subtitle: `مستحقة اليوم الساعة ${timeStr}`,
        href: "/dashboard/tasks",
        time: t.due_at!,
        icon: "📋",
      });
    });

    (dealsRes.data ?? []).forEach((d) => {
      const days = Math.ceil((now.getTime() - new Date(d.updated_at).getTime()) / MS_PER_DAY);
      notifs.push({
        id: `stuck-${d.id}`,
        type: "stuck_deal",
        title: d.name || "صفقة",
        subtitle: `لم تُحدَّث منذ ${days} يوم`,
        href: "/dashboard/deals",
        time: d.updated_at,
        icon: "🔴",
      });
    });

    (leadsRes.data ?? []).forEach((l) => {
      notifs.push({
        id: `lead-${l.id}`,
        type: "new_lead",
        title: l.company_name || "عميل محتمل جديد",
        subtitle: "تم إضافته اليوم",
        href: "/dashboard/leads",
        time: l.created_at,
        icon: "🟢",
      });
    });

    setItems(notifs);
    setSeen(getSeenIds());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen() {
    setOpen((prev) => !prev);
  }

  function handleItemClick(n: Notification) {
    markSeen([n.id]);
    setSeen((prev) => new Set(prev).add(n.id));
    setOpen(false);
    router.push(n.href);
  }

  function handleMarkAllRead() {
    const ids = items.map((n) => n.id);
    markSeen(ids);
    setSeen(new Set(ids));
  }

  const unreadCount = items.filter((n) => !seen.has(n.id)).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        aria-label="الإشعارات"
        className="relative rounded-lg p-2 text-[#94a3b8] transition-colors hover:bg-[#f0faf8] hover:text-[#3a9080]"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "٩+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-[#e8ece9] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
            <h3 className="text-[14px] font-bold text-[#1e1b4b]">الإشعارات</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[12px] font-medium text-[#3a9080] hover:text-[#1a5c4f]"
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-[#94a3b8]">
                جاري التحميل...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-[#94a3b8]">
                <span className="text-2xl">🔔</span>
                <span className="text-[13px]">لا توجد إشعارات</span>
              </div>
            ) : (
              items.map((n) => {
                const isRead = seen.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-right transition-colors hover:bg-[#f8faf9] ${
                      !isRead ? "bg-[#f0faf8]" : ""
                    }`}
                  >
                    <span className="mt-0.5 text-base">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-snug ${!isRead ? "font-semibold text-[#1e1b4b]" : "text-[#475569]"}`}>
                        {n.title}
                      </p>
                      <p className="text-[12px] text-[#94a3b8] mt-0.5">{n.subtitle}</p>
                    </div>
                    {!isRead && (
                      <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#3a9080]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
