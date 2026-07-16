"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ToastProvider } from "@/components/Toast";
import { initials as initialsOf } from "@/lib/format";
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
  BellIcon,
  LogoutIcon,
} from "@/components/navIcons";

const navGroups = [
  {
    heading: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", Icon: DashboardIcon },
      { label: "Contacts", href: "/dashboard/contacts", Icon: ContactsIcon },
      { label: "Leads", href: "/dashboard/leads", Icon: LeadsIcon },
      { label: "Deals", href: "/dashboard/deals", Icon: DealsIcon },
    ],
  },
  {
    heading: "Engagement",
    items: [
      { label: "Activities", href: "/dashboard/activities", Icon: ActivitiesIcon },
      { label: "Tasks", href: "/dashboard/tasks", Icon: TasksIcon },
      { label: "Tickets", href: "/dashboard/tickets", Icon: TicketsIcon },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", Icon: AnalyticsIcon },
      { label: "Lead Scoring", href: "/dashboard/lead-scoring", Icon: ScoringIcon },
    ],
  },
];
const allItems = navGroups.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapse state
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

  const pageName = allItems.find((n) => isActive(pathname, n.href))?.label ?? "Dashboard";
  useEffect(() => {
    document.title = `${pageName} · Mawrid CRM`;
  }, [pageName]);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setEmail(user.email ?? "");
      setFullName((user.user_metadata?.full_name as string) ?? "");
      setLoading(false);
    }
    checkUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-ivory text-muted">Loading…</div>;
  }

  const displayName = fullName || email.split("@")[0];
  const userInitials = initialsOf(fullName || email);
  const w = collapsed ? 72 : 260;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-ivory">
        {/* Sidebar */}
        <div
          style={{ width: w }}
          className="fixed inset-y-0 left-0 z-30 flex flex-col bg-ink transition-all duration-300"
        >
          {/* Logo + collapse */}
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary">
                <span className="text-lg font-black text-white">م</span>
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <span className="block truncate text-base font-bold text-white">Mawrid</span>
                  <span className="text-[11px] font-medium text-[#7ee7cd]">CRM Platform</span>
                </div>
              )}
            </div>
            <button
              onClick={toggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex-none rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white ${collapsed ? "absolute -right-3 top-4 border border-border-light bg-white text-ink shadow-md hover:bg-mint hover:text-primary" : ""}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            {navGroups.map((group) => (
              <div key={group.heading}>
                {!collapsed && (
                  <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
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
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                          active
                            ? "bg-primary font-semibold text-white shadow-lg shadow-primary/25"
                            : "font-medium text-white/50 hover:bg-white/[0.08] hover:text-white"
                        } ${collapsed ? "justify-center" : ""}`}
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
          <div className="border-t border-white/10 px-3 py-4">
            <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${collapsed ? "justify-center" : ""}`}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                <span className="text-sm font-bold text-white">{userInitials}</span>
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                    <p className="truncate text-xs text-white/40">{email}</p>
                  </div>
                  <button onClick={handleLogout} aria-label="Log out" className="flex-none p-1 text-white/25 transition-colors hover:text-red-400">
                    <LogoutIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {!collapsed && <p className="mt-3 px-2 text-[11px] font-medium text-white/25">v1.0</p>}
          </div>
        </div>

        {/* Top bar */}
        <div
          style={{ left: w }}
          className="fixed right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-border-light bg-white/90 px-8 shadow-sm backdrop-blur-sm transition-all duration-300"
        >
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted">Workspace</span>
            <span className="text-[#d1d5db]">/</span>
            <span className="font-semibold text-ink">{pageName}</span>
          </div>
          <div className="flex items-center gap-3">
            <button aria-label="Notifications" className="relative text-muted transition-colors hover:text-ink">
              <BellIcon className="h-[18px] w-[18px]" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary">
              <span className="text-xs font-bold text-white">{userInitials}</span>
            </div>
          </div>
        </div>

        {/* Main */}
        <main style={{ marginLeft: w }} className="min-h-screen bg-ivory pt-16 transition-all duration-300">
          <div className="mx-auto max-w-[1280px] p-8">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
