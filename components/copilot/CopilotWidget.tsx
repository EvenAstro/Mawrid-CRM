"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCopilot } from "./CopilotProvider";
import ChatThread from "./ChatThread";
import Composer from "./Composer";

function SparkleRobot({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4M9 4h6" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <path d="M2 13v2M22 13v2" />
    </svg>
  );
}

export default function CopilotWidget() {
  const pathname = usePathname();
  const { open, setOpen, unread } = useCopilot();

  // The full page is its own Copilot surface — no floating bubble there.
  if (pathname === "/dashboard/copilot") return null;

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="افتح مساعد مورد"
          className="fixed bottom-6 right-6 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] text-white shadow-[0_8px_24px_rgba(26,92,79,0.35)] transition-transform hover:scale-105"
        >
          <SparkleRobot />
          {unread && (
            <span className="absolute right-1 top-1 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500" />
            </span>
          )}
        </button>
      )}

      {/* Sliding panel */}
      <div
        className={`fixed right-0 top-0 z-[56] flex h-screen w-full max-w-[480px] flex-col border-l border-gray-100 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div
          className="flex h-16 flex-none items-center justify-between px-4"
          style={{ background: "linear-gradient(135deg, #0A2E28 0%, #1A5C4F 100%)" }}
        >
          <style>{`@keyframes copilotStatus { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.4; transform:scale(.85) } }`}</style>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <SparkleRobot className="h-5 w-5" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-[16px] font-bold leading-tight text-white" style={{ fontFamily: "Cairo, sans-serif" }}>
                <span className="h-2 w-2 rounded-full bg-green-400" style={{ animation: "copilotStatus 2.4s ease-in-out infinite" }} />
                مساعد مورد
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>متصل ويعرف كل شيء عن صفقاتك</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard/copilot"
              onClick={() => setOpen(false)}
              title="فتح في صفحة كاملة"
              aria-label="فتح في صفحة كاملة"
              className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d="M15 3h6v6M21 3l-9 9M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5" />
              </svg>
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" style={{ background: "#FAFCFB" }}>
          <ChatThread />
        </div>

        {/* Composer */}
        <div className="flex-none">
          <Composer />
        </div>
      </div>
    </>
  );
}
