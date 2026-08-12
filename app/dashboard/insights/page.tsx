"use client";

import { useState } from "react";
import InsightsTab from "./InsightsTab";
import RevenueTab from "./RevenueTab";
<<<<<<< HEAD

const TABS = [
  { key: "insights", label: "الرؤى التحليلية", icon: "📊" },
  { key: "revenue", label: "ذكاء الإيرادات", icon: "💰" },
=======
import LeaderboardTab from "./LeaderboardTab";
import { ChartBarIcon, MoneyIcon, TrophyIcon } from "@/components/icons";

const TABS = [
  { key: "insights", label: "الرؤى التحليلية", icon: <ChartBarIcon className="h-4 w-4" /> },
  { key: "revenue", label: "ذكاء الإيرادات", icon: <MoneyIcon className="h-4 w-4" /> },
  { key: "leaderboard", label: "أداء الفريق", icon: <TrophyIcon className="h-4 w-4" /> },
>>>>>>> main
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function UnifiedInsightsPage() {
  const [tab, setTab] = useState<TabKey>("insights");

  return (
    <div className="flex flex-col gap-6">
      {/* Tab switcher */}
<<<<<<< HEAD
      <div className="flex items-center gap-1 rounded-2xl border border-[#d6ece5] bg-white p-1.5 shadow-[0_2px_8px_rgba(26,92,79,0.04)] self-start">
=======
      <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1.5 e-1 self-start">
>>>>>>> main
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
<<<<<<< HEAD
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-all ${
              tab === t.key
                ? "bg-[#1a5c4f] text-white shadow-sm"
                : "text-[#475569] hover:bg-[#f0faf8] hover:text-[#1a5c4f]"
=======
            className={`flex items-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5 t-body-sm font-semibold transition-all ${
              tab === t.key
                ? "bg-[var(--brand-teal-700)] text-white shadow-sm"
                : "text-[var(--content-secondary)] hover:bg-[var(--surface-accent-subtle)] hover:text-[var(--brand-teal-700)]"
>>>>>>> main
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab */}
<<<<<<< HEAD
      {tab === "insights" ? <InsightsTab /> : <RevenueTab />}
=======
      {tab === "insights" ? <InsightsTab /> : tab === "revenue" ? <RevenueTab /> : <LeaderboardTab />}
>>>>>>> main
    </div>
  );
}
