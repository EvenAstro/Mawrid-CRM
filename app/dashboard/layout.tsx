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
import NotificationsDropdown from "@/components/NotificationsDropdown";
import SupervisorBot from "@/components/SupervisorBot";
import {
  DashboardIcon,
  ContactsIcon,
  LeadsIcon,
  DealsIcon,
  ActivitiesIcon,
  TasksIcon,
  TicketsIcon,
  ScoringIcon,
  PlaybookIcon,
  InsightsIcon,
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
  lead_scoring: ScoringIcon,
  playbook: PlaybookIcon,
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
  const { permissions, loading: roleLoading, can } = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Below md (768px) the sidebar becomes an off-canvas drawer instead of a
  // permanent column — the fixed-width layout below simply has no room on a
  // phone screen.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close the drawer whenever the route changes, so navigating doesn't leave
  // it open over the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
  const sidebarWidth = isMobile ? 272 : w;
  const contentOffset = isMobile ? 0 : w;
  // The collapse-to-icons feature only makes sense for the permanent desktop
  // column — the mobile drawer always shows full labels.
  const effectiveCollapsed = collapsed && !isMobile;

  return (
    <div className="min-h-screen bg-[#f0f5f3]">
      {/* Mobile drawer backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm transition-opacity md:hidden"
        />
      )}

      {/* Sidebar — navy bg, teal accents. Permanent column on md+, off-canvas
          drawer below that (translate-x-full hides it past the right edge,
          which is where it's docked, since the app is RTL). */}
      <div
        style={{ width: sidebarWidth }}
        className={`fixed inset-y-0 right-0 z-40 flex flex-col bg-[#141c2e] transition-all duration-300 ${
          isMobile ? (mobileOpen ? "translate-x-0" : "translate-x-full") : "translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-[72px] items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
              <rect width="36" height="36" rx="9" fill="#3a9080" />
              <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
            </svg>
            {(!collapsed || isMobile) && (
              <span className="block truncate text-[28px] font-bold tracking-wide text-white" style={{ fontFamily: "var(--font-cairo), system-ui, sans-serif" }}>مَــوْرد</span>
            )}
          </div>
          {isMobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="إغلاق القائمة"
              className="flex-none rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={toggleCollapse}
              aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
              className={`flex-none rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white ${collapsed ? "absolute -left-3 top-5 z-10 rounded-full border border-[#e8ece9] bg-white text-[#141c2e] shadow-lg" : ""}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.heading} className="mt-6 first:mt-0">
              {!effectiveCollapsed && (
                <p className="mb-2 px-3 text-[11px] font-bold tracking-wider text-[#3a9080]">
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
                      title={effectiveCollapsed ? label : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-all ${
                        active
                          ? "bg-[#3a9080]/20 font-bold text-[#5ec4b0]"
                          : "font-medium text-white/50 hover:bg-white/6 hover:text-white/85"
                      } ${effectiveCollapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className={`h-[20px] w-[20px] flex-shrink-0 ${active ? "text-[#5ec4b0]" : ""}`} />
                      {!effectiveCollapsed && label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/8 px-3 pb-4 pt-4">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${effectiveCollapsed ? "justify-center" : ""}`}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3a9080]">
              <span className="text-sm font-bold text-white">{userInitials}</span>
            </div>
            {!effectiveCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-white/90">{displayName}</p>
                  <p className="truncate text-[11px] text-white/35">{email}</p>
                </div>
                <button onClick={handleLogout} aria-label="تسجيل الخروج" className="flex-none rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/10 hover:text-red-400">
                  <LogoutIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div
        style={{ right: contentOffset }}
        className="fixed left-0 top-0 z-20 flex h-[56px] items-center justify-between gap-3 border-b border-[#e8ece9] bg-white px-4 transition-all duration-300 md:px-8"
      >
        <div className="flex min-w-0 items-center gap-3">
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
              className="flex-none rounded-lg p-1.5 text-[#475569] transition hover:bg-[#f0faf8]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="flex min-w-0 items-center gap-2 text-[14px]">
            <span className="hidden text-[#94a3b8] sm:inline">مساحة العمل</span>
            <span className="hidden text-[#d1d5db] sm:inline">/</span>
            <span className="truncate font-semibold text-[#1e1b4b]">{pageName}</span>
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <NotificationsDropdown />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141c2e]">
            <span className="text-xs font-bold text-white">{userInitials}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <main
        style={{ marginRight: contentOffset, paddingLeft: "var(--briefing-rail-width, 52px)" }}
        className="min-h-screen bg-[#f0f5f3] pt-[56px] transition-all duration-300"
      >
        <div key={pathname} className="page-content mx-auto max-w-[1600px] p-4 sm:p-6 md:p-8">
          {roleLoading ? null : currentFeature && !can(currentFeature.key) ? null : children}
        </div>
      </main>
      <CopilotWidget />
      <SupervisorBot />
      <DailyBriefing />
    </div>
  );
}
