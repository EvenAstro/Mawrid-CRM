"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ToastProvider } from "@/components/Toast";
import CopilotProvider from "@/components/copilot/CopilotProvider";
import Supervisor from "@/components/supervisor/Supervisor";
import DailyBriefing from "@/components/DailyBriefing";
import { initials as initialsOf } from "@/lib/format";
import RoleProvider, { useRole } from "@/components/RoleProvider";
import { FEATURES } from "@/lib/features";
import { ActivitiesIcon, ContactsIcon, DashboardIcon, DealsIcon, InsightsIcon, LeadsIcon, LogoutIcon, PlaybookIcon, ScoringIcon, TasksIcon, UsersIcon } from "@/components/navIcons";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import CommandPalette from "@/components/CommandPalette";
import EmptyState from "@/components/ui/EmptyState";
import { ChatBubbleIcon } from "@/components/icons";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: DashboardIcon,
  contacts: ContactsIcon,
  leads: LeadsIcon,
  deals: DealsIcon,
  chat: ChatBubbleIcon,
  activities: ActivitiesIcon,
  tasks: TasksIcon,
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
    return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] text-[color:var(--content-tertiary)]">جارِ التحميل…</div>;
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

  // A blocked route now explains itself instead of silently redirecting.
  // The old behaviour replaced the URL with /dashboard, so a rep who followed
  // a shared link to Insights simply arrived somewhere else and concluded the
  // link was broken. Nothing about the page is rendered — this is a display
  // decision, not an access one; the data guard is still RLS.
  const blocked = !roleLoading && !!currentFeature && !can(currentFeature.key);

  // Sliding active-item pill: measures the active link's position within the
  // nav on every route change / collapse toggle and glides the pill there,
  // instead of the highlight just jumping between items.
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const activeEl = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
    if (!activeEl) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.opacity = "1";
    pill.style.height = `${activeEl.offsetHeight}px`;
    pill.style.transform = `translateY(${activeEl.offsetTop}px)`;
  });

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
    <div className="min-h-screen bg-[var(--surface-page)]">
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
        className={`fixed inset-y-0 right-0 z-40 flex flex-col bg-[var(--surface-inverse)] transition-transform duration-[var(--motion-slow)] ease-[var(--ease-standard)] ${
          isMobile ? (mobileOpen ? "translate-x-0" : "translate-x-full") : "translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-[var(--layout-topbar)] flex-none items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
              <rect width="36" height="36" rx="9" fill="var(--brand-teal-400)" />
              <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
            </svg>
            {(!collapsed || isMobile) && (
              <span className="block truncate t-title-1 font-bold tracking-wide text-white" style={{ fontFamily: "var(--font-display)" }}>مَــوْرد</span>
            )}
          </div>
          {isMobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="إغلاق القائمة"
              className="flex-none rounded-[var(--radius-sm)] p-1.5 text-[color:var(--content-inverse-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={toggleCollapse}
              aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
              className={`flex-none rounded-[var(--radius-sm)] p-1.5 text-[color:var(--content-inverse-tertiary)] transition-colors hover:bg-white/10 hover:text-white ${collapsed ? "absolute -left-3 top-5 z-10 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[color:var(--content-primary)] e-2" : ""}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 py-4">
          <div ref={pillRef} className="nav-pill" style={{ opacity: 0, top: 0, height: 0 }} />
          {navGroups.map((group) => (
            <div key={group.heading} className="mt-6 first:mt-0">
              {!effectiveCollapsed && (
                <p className="t-eyebrow mb-2 px-3 text-[color:var(--content-inverse-tertiary)]">
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
                      data-nav-active={active ? "true" : undefined}
                      className={`relative z-[1] flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[length:var(--text-body)] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] ${
                        active
                          ? "font-bold text-[color:var(--content-inverse-accent)]"
                          : "font-medium text-[color:var(--content-inverse-tertiary)] hover:bg-white/[0.06] hover:text-[color:var(--content-inverse-primary)]"
                      } ${effectiveCollapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!effectiveCollapsed && label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[var(--border-inverse)] px-3 pb-4 pt-4">
          <div className={`flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 ${effectiveCollapsed ? "justify-center" : ""}`}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal-400)]">
              <span className="text-sm font-bold text-white">{userInitials}</span>
            </div>
            {!effectiveCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[length:var(--text-body-sm)] font-semibold text-[color:var(--content-inverse-primary)]">{displayName}</p>
                  <p dir="ltr" className="t-micro truncate text-end text-[color:var(--content-inverse-tertiary)]">{email}</p>
                </div>
                <button onClick={handleLogout} aria-label="تسجيل الخروج" className="flex-none rounded-[var(--radius-sm)] p-1.5 text-[color:var(--content-inverse-tertiary)] transition-colors hover:bg-white/10 hover:text-[var(--status-danger-on-inverse)]">
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
        className="fixed left-0 top-0 z-20 flex h-[var(--layout-topbar)] items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 transition-[right] duration-[var(--motion-slow)] ease-[var(--ease-standard)] md:px-8"
      >
        <div className="flex min-w-0 items-center gap-3">
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
              className="flex-none rounded-[var(--radius-sm)] p-1.5 text-[color:var(--content-secondary)] transition-colors hover:bg-[var(--surface-accent-subtle)]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="flex min-w-0 items-center gap-2 t-body-sm">
            <span className="hidden text-[color:var(--content-tertiary)] sm:inline">مساحة العمل</span>
            <span className="hidden text-[color:var(--border-strong)] sm:inline">/</span>
            <span className="truncate font-semibold text-[color:var(--content-primary)]">{pageName}</span>
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new Event("mawrid:open-command-palette"))}
            aria-label="بحث شامل"
            className="hidden items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-1.5 text-[length:var(--text-body-sm)] text-[color:var(--content-tertiary)] transition-colors duration-[var(--motion-fast)] hover:border-[var(--border-accent)] hover:text-[color:var(--content-accent)] sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <span>بحث...</span>
            <kbd className="t-micro rounded-[var(--radius-xs)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1 font-semibold">⌘K</kbd>
          </button>
          <NotificationsDropdown />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-inverse)]">
            <span className="text-xs font-bold text-white">{userInitials}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <main
        style={{ marginRight: contentOffset, paddingLeft: "var(--briefing-rail-width, 52px)" }}
        className="min-h-screen bg-[var(--surface-page)] pt-[var(--layout-topbar)] transition-[margin,padding] duration-[var(--motion-slow)] ease-[var(--ease-standard)]"
      >
        <div key={pathname} className="page-content mx-auto max-w-[var(--layout-content-max)] p-[var(--space-gutter-sm)] md:p-[var(--space-gutter)]">
          {roleLoading ? null : blocked ? (
            <EmptyState
              variant="blocked"
              title={`ما عندك صلاحية لـ${currentFeature?.label ?? "هذه الصفحة"}`}
              subtitle="مديرك أو مسؤول النظام يقدر يفتح لك الصلاحية من صفحة إدارة المستخدمين."
              action={
                <Link
                  href="/dashboard"
                  className="t-body-sm rounded-[var(--radius-md)] bg-[var(--surface-accent)] px-5 py-2.5 font-semibold text-[color:var(--content-on-accent)] transition-colors hover:bg-[var(--surface-accent-hover)]"
                >
                  الرجوع للرئيسية
                </Link>
              }
            />
          ) : (
            children
          )}
        </div>
      </main>
      <Supervisor />
      <DailyBriefing />
      <CommandPalette />
    </div>
  );
}
