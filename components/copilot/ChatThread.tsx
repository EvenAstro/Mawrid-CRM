"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCopilot, type ChatMessage } from "./CopilotProvider";
import RichText from "./RichText";

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Extracts the drafted message between the first pair of --- fences, else the whole text. */
function draftBody(content: string): string {
  const m = content.match(/---\s*\n([\s\S]*?)\n\s*---/);
  return (m ? m[1] : content).trim();
}

function MessageActions({ msg }: { msg: ChatMessage }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const c = msg.content;
  const isDraft = c.includes("---");
  const isStuck = /عالق|بلا تواصل|بلا متابعة|ما تواصل/.test(c);
  const isAnalysis = !isDraft && c.length > 180;

  if (!isDraft && !isStuck && !isAnalysis) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(draftBody(c));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {isDraft && (
        <button
          onClick={copy}
          className="rounded-full bg-teal-700 px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-teal-800"
        >
          {copied ? "تم النسخ ✓" : "نسخ الرسالة 📋"}
        </button>
      )}
      {isStuck && (
        <button
          onClick={() => router.push("/dashboard/deals")}
          className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[12px] font-semibold text-teal-700 transition hover:bg-teal-100"
        >
          عرض الصفقات
        </button>
      )}
      {isAnalysis && (
        <button
          disabled
          title="قريباً"
          className="cursor-not-allowed rounded-full border border-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-300"
        >
          تصدير كتقرير
        </button>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rounded-full"
          style={{ height: 8, width: 8, background: "#0D9488", animation: `copilotBounce 1.2s ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes copilotBounce { 0%,80%,100% { transform: translateY(0); opacity:.35 } 40% { transform: translateY(-5px); opacity:1 } }`}</style>
    </div>
  );
}

export default function ChatThread({ emptyHint }: { emptyHint?: React.ReactNode }) {
  const { messages, streaming } = useCopilot();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] text-2xl shadow-lg shadow-teal-900/20">
          ✨
        </div>
        <p className="mt-4 text-[15px] font-semibold text-gray-900" dir="auto">
          مرحباً! أنا مساعد مورد
        </p>
        <p className="mt-1 text-[13px] text-gray-400" dir="auto">
          {emptyHint ?? "اسألني أي شيء عن صفقاتك وعملائك"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m, idx) => {
        const isUser = m.role === "user";
        const isLast = idx === messages.length - 1;
        const showDots = streaming && isLast && m.role === "assistant" && m.content === "";
        return (
          <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
              <div
                className="px-4 py-3 text-[15px]"
                style={
                  isUser
                    ? {
                        background: "linear-gradient(135deg, #1A5C4F 0%, #2D8570 100%)",
                        borderRadius: "16px 16px 4px 16px",
                        color: "#fff",
                        fontFamily: "Cairo, sans-serif",
                        fontWeight: 500,
                      }
                    : {
                        background: "#fff",
                        border: "1px solid #E8EFED",
                        borderRadius: "16px 16px 16px 4px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                        color: "#1C2B26",
                        fontFamily: "Cairo, sans-serif",
                        lineHeight: 1.6,
                      }
                }
              >
                {isUser ? (
                  <p dir="auto" className="whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </p>
                ) : showDots ? (
                  <TypingDots />
                ) : (
                  <RichText content={m.content} />
                )}
              </div>
              {!isUser && !showDots && m.content && <MessageActions msg={m} />}
              <p className={`mt-1 text-[11px] text-gray-300 ${isUser ? "text-right" : "text-left"}`}>{timeLabel(m.at)}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
