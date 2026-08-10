"use client";

import { useState } from "react";
import InsightsTab from "./InsightsTab";
import RevenueTab from "./RevenueTab";
import LeaderboardTab from "./LeaderboardTab";

const TABS = [
  { key: "insights", label: "الرؤى التحليلية", icon: "📊" },
  { key: "revenue", label: "ذكاء الإيرادات", icon: "💰" },
  { key: "leaderboard", label: "أداء الفريق", icon: "🏆" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function UnifiedInsightsPage() {
  const [tab, setTab] = useState<TabKey>("insights");

  return (
    <div className="flex flex-col gap-6">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1.5 e-1 self-start">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5 text-[14px] font-semibold transition-all ${
              tab === t.key
                ? "bg-[#1a5c4f] text-white shadow-sm"
                : "text-[#475569] hover:bg-[#f0faf8] hover:text-[#1a5c4f]"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab */}
      {tab === "insights" ? <InsightsTab /> : tab === "revenue" ? <RevenueTab /> : <LeaderboardTab />}
    </div>
  );
}
