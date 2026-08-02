"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ToastProvider } from "@/components/Toast";
import CopilotProvider from "@/components/copilot/CopilotProvider";
import CopilotWidget from "@/components/copilot/CopilotWidget";
import DailyBriefing from "@/components/DailyBriefing";
import { initials as initialsOf } from "@/lib/format";
import RoleProvider, { useRole } from "@/components/RoleProvider";
import { FEATURES } from "@/lib/features";
import { UsersIcon } from "@/components/navIcons";
import {
  DashboardIcon,
  ContactsIcon,
  LeadsIcon,
  DealsIcon,
  ActivitiesIcon,
  TasksIcon,
  TicketsIcon,
  AnalyticsIcon,
  ScoringIcon,
  PlaybookIcon,
  InsightsIcon,
  RevenueIntelIcon,
  BellIcon,
  LogoutIcon,
} from "@/components/navIcons";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: DashboardIcon,
  contacts: ContactsIcon,
  leads: LeadsIcon,
  deals: DealsIcon,
  activities: ActivitiesIcon,
  tasks: TasksIcon,
  tickets: TicketsIcon,
  insights: InsightsIcon,
  analytics: AnalyticsIcon,
  lead_scoring: ScoringIcon,
  playbook: PlaybookIcon,
  revenue_intelligence: RevenueIntelIcon,
  users: UsersIcon,
};

const GROUP_ORDER = ["مساحة العمل", "التفاعل", "الذكاء", "الإدارة"];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function applyUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
      if (!user) {
        router.replace("/");
        return;
      }
      setEmail(user.email ?? "");
      setFullName((user.user_metadata?.full_name as string) ?? "");
      setLoading(false);
    }

    supabase.auth.getUser().then(({ data: { user } }) => applyUser(user));

    // Keep this tab in sync when the session changes — either from logging
    // in/out here, or from another tab overwriting the shared localStorage
    // session (Supabase auth state is per-browser, not per-tab).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-ivory text-muted">Loading…</div>;
  }

  return (
    <ToastProvider>
      <RoleProvider>
        <CopilotProvider>
          <DashboardShell email={email} fullName={fullName}>{children}</DashboardShell>
        </CopilotProvider>
      </RoleProvider>
    </ToastProvider>
  );
}

function DashboardShell({ children, email, fullName }: { children: React.ReactNode; email: string; fullName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, permissions, loading: roleLoading, can } = useRole();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("mawrid_sidebar_collapsed") === "1");
  }, []);
  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("mawrid_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  const currentFeature = FEATURES.find((f) => isActive(pathname, f.href));
  const pageName = currentFeature?.label ?? "الرئيسية";
  useEffect(() => {
    document.title = `${pageName} · مَوْرد CRM`;
  }, [pageName]);

  // Guard: redirect away from a page this user isn't allowed to see —
  // either by role default or an explicit per-user permission override.
  useEffect(() => {
    if (roleLoading || !currentFeature) return;
    if (!can(currentFeature.key)) router.replace("/dashboard");
  }, [roleLoading, currentFeature, can, router, permissions]);

  const navGroups = GROUP_ORDER.map((heading) => ({
    heading,
    items: FEATURES.filter((f) => f.group === heading && can(f.key)).map((f) => ({
      label: f.label,
      href: f.href,
      Icon: ICONS[f.key] ?? DashboardIcon,
    })),
  })).filter((g) => g.items.length > 0);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const displayName = fullName || email.split("@")[0];
  const userInitials = initialsOf(fullName || email);
  const w = collapsed ? 72 : 240;

  return (
    <div className="min-h-screen bg-[#f7f9f8]">
      {/* Sidebar — mawrid teal */}
      <div
        style={{ width: w }}
        className="fixed inset-y-0 right-0 z-30 flex flex-col bg-[#1a6b5c] transition-all duration-300"
      >
        {/* Logo */}
        <div className="flex h-[72px] items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <svg viewBox="0 0 40 40" className="h-10 w-10 flex-none" fill="none">
              <rect width="40" height="40" rx="10" fill="white" fillOpacity="0.15" />
              <path d="M20 6C12.27 6 6 12.27 6 20c0 7.73 6.27 14 14 14h8V26h-8a6 6 0 1 1 0-12h0c3.31 0 6 2.69 6 6v14h8V20c0-7.73-6.27-14-14-14z" fill="white" />
            </svg>
            {!collapsed && (
              <div className="min-w-0">
                <span className="block truncate text-[22px] font-extrabold leading-tight text-white">مَوْرد</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            className={`flex-none rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white ${collapsed ? "absolute -left-3 top-5 z-10 rounded-full border border-[#e8ece9] bg-white text-[#1a6b5c] shadow-lg" : ""}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.heading} className="mt-6 first:mt-0">
              {!collapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-white/30">
                  {group.heading}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ label, href, Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={label}
                      href={href}
                      title={collapsed ? label : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-all ${
                        active
                          ? "bg-white/15 font-semibold text-white"
                          : "font-medium text-white/60 hover:bg-white/8 hover:text-white/90"
                      } ${collapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                      {!collapsed && label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/10 px-3 pb-4 pt-4">
          <div className={`flex items-center gap-3 rounded-lg px-2 py-2 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/10">
              <span className="text-sm font-bold text-white">{userInitials}</span>
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{displayName}</p>
                  <p className="truncate text-[11px] text-white/40">{email}</p>
                </div>
                <button onClick={handleLogout} aria-label="تسجيل الخروج" className="flex-none rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-red-400">
                  <LogoutIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div
        style={{ right: w }}
        className="fixed left-0 top-0 z-20 flex h-[56px] items-center justify-between border-b border-[#e8ece9] bg-white px-8 transition-all duration-300"
      >
        <div className="flex items-center gap-2 text-[14px]">
          <span className="text-[#94a3b8]">مساحة العمل</span>
          <span className="text-[#d1d5db]">/</span>
          <span className="font-semibold text-[#1e1b4b]">{pageName}</span>
        </div>
        <div className="flex items-center gap-3">
          <button aria-label="الإشعارات" className="relative rounded-lg p-2 text-[#94a3b8] transition-colors hover:bg-[#f0faf8] hover:text-[#1a5c4f]">
            <BellIcon className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d2923]">
            <span className="text-xs font-bold text-white">{userInitials}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <main
        style={{ marginRight: w, paddingLeft: "var(--briefing-rail-width, 52px)" }}
        className="min-h-screen bg-[#f7f9f8] pt-[56px] transition-all duration-300"
      >
        <div key={pathname} className="page-content mx-auto max-w-[1280px] p-8">
          {roleLoading ? null : currentFeature && !can(currentFeature.key) ? null : children}
        </div>
      </main>
      <CopilotWidget />
      <DailyBriefing />
    </div>
  );
}
