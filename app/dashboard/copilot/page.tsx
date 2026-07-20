"use client";

import { useCopilot } from "@/components/copilot/CopilotProvider";
import ChatThread from "@/components/copilot/ChatThread";
import Composer from "@/components/copilot/Composer";

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

export default function CopilotPage() {
  const { send, streaming } = useCopilot();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 dir="auto" className="text-2xl font-extrabold text-[#1e1b4b]">مساعد مورد الذكي</h1>
        <p className="mt-1 text-[15px] text-gray-400">اسألني أي شيء عن أداء مبيعاتك — بياناتك، بلغتك.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        {/* Suggested questions sidebar */}
        <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 px-1 text-[13px] font-bold text-[#1e1b4b]">أسئلة مقترحة</p>
          <div className="flex flex-col gap-4">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-1.5 px-1 text-[12px] font-semibold text-gray-500">
                  {g.icon} {g.title}
                </p>
                <div className="flex flex-col gap-1">
                  {g.questions.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={streaming}
                      dir="auto"
                      className="rounded-lg px-2.5 py-2 text-right text-[13px] text-gray-600 transition hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
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
        <div className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex-1 overflow-y-auto p-5">
            <ChatThread emptyHint="اختر سؤالاً من القائمة أو اكتب سؤالك بالأسفل" />
          </div>
          <Composer />
        </div>
      </div>
    </div>
  );
}
