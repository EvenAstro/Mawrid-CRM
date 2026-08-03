"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
}

export interface SnapshotStats {
  totalLeads: number;
  activeDeals: number;
  pipelineValueSAR: number;
  stuckCount: number;
}

interface CopilotContextValue {
  messages: ChatMessage[];
  streaming: boolean;
  open: boolean;
  unread: boolean;
  stats: SnapshotStats | null;
  setOpen: (o: boolean) => void;
  send: (text: string) => void;
  clear: () => void;
  pageContext: string;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider");
  return ctx;
}

/** Maps the current route to a short Arabic context string fed silently to the model. */
function contextForPath(pathname: string): string {
  if (pathname === "/dashboard") return "أنا على الصفحة الرئيسية للوحة التحكم";
  if (/^\/dashboard\/deals\/[^/]+\/investigation/.test(pathname)) return "أنا أشاهد تقرير تحقيق صفقة مخسورة";
  if (/^\/dashboard\/deals\/[^/]+/.test(pathname)) return "أنا أشاهد تفاصيل صفقة محددة";
  if (pathname.startsWith("/dashboard/deals")) return "أنا على صفحة الصفقات";
  if (pathname.startsWith("/dashboard/leads")) return "أنا على صفحة العملاء المحتملين";
  if (pathname.startsWith("/dashboard/activities")) return "أنا على صفحة النشاطات";
  if (pathname.startsWith("/dashboard/tasks")) return "أنا على صفحة المهام";
  if (pathname.startsWith("/dashboard/lead-scoring")) return "أنا على صفحة تقييم العملاء";
  if (pathname.startsWith("/dashboard/contacts")) return "أنا على صفحة جهات الاتصال";
  return "";
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayKey() {
  return "copilot_greeted_" + new Date().toISOString().slice(0, 10);
}

export default function CopilotProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageContext = useMemo(() => contextForPath(pathname), [pathname]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [stats, setStats] = useState<SnapshotStats | null>(null);
  const summaryRef = useRef<{ stuckCount: number; upcomingCount: number } | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;

  // Proactive: fetch counts once; if there's something worth flagging and we
  // haven't greeted today, light the unread dot.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/copilot");
        if (!res.ok) return;
        const s = (await res.json()) as {
          stuckCount: number;
          upcomingCount: number;
          stats: SnapshotStats | null;
        };
        if (!active) return;
        summaryRef.current = { stuckCount: s.stuckCount, upcomingCount: s.upcomingCount };
        if (s.stats) setStats(s.stats);
        const greeted = localStorage.getItem(todayKey()) === "1";
        if (!greeted && (s.stuckCount > 0 || s.upcomingCount > 0)) setUnread(true);
      } catch {
        /* proactive is best-effort */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed, at: Date.now() };
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", at: Date.now() };
    const history = [...messagesRef.current, userMsg];
    setMessages([...history, assistantMsg]);
    setStreaming(true);

    (async () => {
      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            context: pageContextRef.current,
          }),
        });
        if (!res.ok || !res.body) {
          // Non-network failure (e.g. daily quota) — show a specific message, don't throw.
          let msg = "تعذّر الحصول على رد من المساعد الآن. حاول مرة أخرى.";
          if (res.status === 429) {
            msg = "تم بلوغ الحد اليومي المجاني للمساعد. سيعود العمل تلقائياً بعد إعادة تعيين الحصة.";
          }
          try {
            const j = await res.json();
            if (typeof j?.message === "string") msg = j.message;
          } catch {
            /* body may be empty */
          }
          setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: msg } : m)));
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)));
        }
        if (!acc) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: "عذراً، لم أتمكّن من الرد الآن. حاول مرة أخرى." } : m)),
          );
        }
      } catch (err) {
        console.error("[copilot] send failed", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: "تعذّر الاتصال بالمساعد. تأكّد من الاتصال وحاول مجدداً." } : m,
          ),
        );
      } finally {
        setStreaming(false);
      }
    })();
  }, [streaming]);

  const clear = useCallback(() => setMessages([]), []);

  const openPanel = useCallback((o: boolean) => {
    setOpen(o);
    if (!o) return;
    setUnread(false);
    // Proactive greeting on first open of the day.
    const greeted = localStorage.getItem(todayKey()) === "1";
    const s = summaryRef.current;
    if (!greeted && s && (s.stuckCount > 0 || s.upcomingCount > 0) && messagesRef.current.length === 0) {
      localStorage.setItem(todayKey(), "1");
      const parts: string[] = ["صباح الخير! 🌅"];
      if (s.stuckCount > 0) parts.push(`عندك **${s.stuckCount}** صفقات ما تواصلت معها من أكثر من 7 أيام.`);
      if (s.upcomingCount > 0) parts.push(`ولديك **${s.upcomingCount}** مهام قادمة.`);
      parts.push("تبي أبدأ بها؟");
      setMessages([{ id: uid(), role: "assistant", content: parts.join(" "), at: Date.now() }]);
    }
  }, []);

  const value = useMemo<CopilotContextValue>(
    () => ({ messages, streaming, open, unread, stats, setOpen: openPanel, send, clear, pageContext }),
    [messages, streaming, open, unread, stats, openPanel, send, clear, pageContext],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}
