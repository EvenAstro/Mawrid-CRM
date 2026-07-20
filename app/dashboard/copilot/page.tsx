"use client";

import { useCopilot } from "@/components/copilot/CopilotProvider";
import ChatThread from "@/components/copilot/ChatThread";
import Composer from "@/components/copilot/Composer";
import { compactSAR } from "@/lib/format";

const GROUPS: { icon: string; title: string; questions: string[] }[] = [
  {
    icon: "📊",
    title: "التحليل",
    questions: ["وش أنجح مصدر للعملاء؟", "كم صفقة خسرنا هذا الشهر؟", "وش متوسط وقت إغلاق الصفقة؟"],
  },
  {
    icon: "🎯",
    title: "الصفقات",
    questions: ["وين الصفقات اللي ما تواصلنا معها؟", "من أقرب عميل للإغلاق؟", "وش الصفقات في خطر؟"],
  },
  {
    icon: "✍️",
    title: "المراسلة",
    questions: ["اكتب رسالة متابعة لعميل لم يرد", "اكتب عرض سعر احترافي", "اكتب رسالة بعد الديمو"],
  },
  {
    icon: "📋",
    title: "التقارير",
    questions: ["ملخص أداء هذا الأسبوع", "تقرير الصفقات المخسورة", "أفضل وأسوأ عملاء هذا الشهر"],
  },
];

function SparkleRobot({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4M9 4h6" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <path d="M2 13v2M22 13v2" />
    </svg>
  );
}

const PARTICLES = [
  { size: 14, left: "12%", top: "30%", dur: "6s", delay: "0s" },
  { size: 9, left: "28%", top: "60%", dur: "8s", delay: "1s" },
  { size: 16, left: "72%", top: "25%", dur: "5s", delay: "0.5s" },
  { size: 10, left: "88%", top: "55%", dur: "7s", delay: "1.5s" },
];

export default function CopilotPage() {
  const { send, streaming, stats } = useCopilot();

  return (
    <div className="flex flex-col gap-5">
      <style>{`@keyframes copilotFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }`}</style>

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ height: 160, background: "linear-gradient(135deg, #0A2E28 0%, #1A5C4F 60%, #2D8570 100%)" }}
      >
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full bg-white"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              top: p.top,
              opacity: 0.15,
              animation: `copilotFloat ${p.dur} ease-in-out ${p.delay} infinite`,
            }}
          />
        ))}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="flex items-center gap-3 text-white">
            <SparkleRobot className="h-10 w-10" />
            <h1 style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 32 }}>مساعد مورد الذكي</h1>
          </div>
          <p className="mt-1.5 text-[16px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            اسأل عن أي صفقة، عميل، أو تحليل — وسأجيبك فوراً
          </p>
        </div>
      </div>

      {/* Snapshot bar */}
      {stats && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl px-5 py-3 text-[13px]" style={{ background: "#0A0D0C", color: "#C6D2CB" }}>
          <SnapStat label="عميل" value={String(stats.totalLeads)} />
          <span style={{ color: "#4B5E54" }}>·</span>
          <SnapStat label="صفقة نشطة" value={String(stats.activeDeals)} />
          <span style={{ color: "#4B5E54" }}>·</span>
          <SnapStat label="Pipeline" value={`SAR ${compactSAR(stats.pipelineValueSAR)}`} />
          <span style={{ color: "#4B5E54" }}>·</span>
          <SnapStat label="صفقة تحتاج متابعة" value={String(stats.stuckCount)} highlight />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        {/* Suggested questions sidebar (dark) */}
        <aside className="h-fit rounded-2xl p-4" style={{ background: "#0A2E28" }}>
          <p className="mb-3 px-1 text-[13px] font-bold text-white">أسئلة مقترحة</p>
          <div className="flex flex-col gap-4">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5EEAD4" }}>
                  {g.icon} {g.title}
                </p>
                <div className="flex flex-col gap-0.5">
                  {g.questions.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={streaming}
                      dir="auto"
                      className="rounded-lg px-2.5 py-2 text-right text-[13px] text-white/70 transition-all duration-150 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Conversation */}
        <div className="flex h-[calc(100vh-20rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex-1 overflow-y-auto p-5" style={{ background: "#FAFCFB" }}>
            <ChatThread emptyHint="اختر سؤالاً من القائمة أو اكتب سؤالك بالأسفل" />
          </div>
          <Composer />
        </div>
      </div>
    </div>
  );
}

function SnapStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-bold" style={{ color: highlight ? "#F59E0B" : "#F0F4F2" }}>{value}</span>
      <span style={{ color: "#4B5E54" }}>{label}</span>
    </span>
  );
}
