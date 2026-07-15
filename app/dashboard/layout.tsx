"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ToastProvider } from "@/components/Toast";
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

const navItems = [
  { label: "Dashboard", href: "/dashboard", Icon: DashboardIcon },
  { label: "Contacts", href: "/dashboard/contacts", Icon: ContactsIcon },
  { label: "Leads", href: "/dashboard/leads", Icon: LeadsIcon },
  { label: "Deals", href: "/dashboard/deals", Icon: DealsIcon },
  { label: "Activities", href: "/dashboard/activities", Icon: ActivitiesIcon },
  { label: "Tasks", href: "/dashboard/tasks", Icon: TasksIcon },
  { label: "Tickets", href: "/dashboard/tickets", Icon: TicketsIcon },
  { label: "Analytics", href: "/dashboard/analytics", Icon: AnalyticsIcon },
  { label: "Lead Scoring", href: "/dashboard/lead-scoring", Icon: ScoringIcon },
];

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
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
    return <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-[#9ca3af]">Loading…</div>;
  }

  const displayName = fullName || email.split("@")[0];
  const userInitials = initials(fullName, email);
  const pageName = navItems.find((n) => isActive(pathname, n.href))?.label ?? "Dashboard";

  useEffect(() => {
    document.title = `${pageName} | Mawrid CRM`;
  }, [pageName]);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#1e1b4b]">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a5c4f]">
            <span className="text-base font-black text-white">م</span>
          </div>
          <div>
            <span className="block text-base font-bold text-white">Mawrid</span>
            <span className="text-xs font-medium text-[#7ee7cd]">CRM Platform</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/25">Workspace</p>
          {navItems.map(({ label, href, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  active ? "bg-[#1a5c4f] font-semibold text-white shadow-lg shadow-[#1a5c4f]/25" : "font-medium text-white/50 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/10 px-3 py-4">
          <div className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1a5c4f]">
              <span className="text-sm font-bold text-white">{userInitials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-white/40">{email}</p>
            </div>
            <button onClick={handleLogout} aria-label="Log out" className="p-1 text-white/25 transition-colors hover:text-red-400">
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div className="fixed left-64 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-[#e5e7eb] bg-white px-8 shadow-sm">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[#9ca3af]">Workspace</span>
          <span className="text-[#d1d5db]">/</span>
          <span className="font-semibold text-[#1e1b4b]">{pageName}</span>
        </div>
        <div className="flex items-center gap-3">
          <input placeholder="Search..." className="hidden h-9 w-48 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 text-sm text-[#1e1b4b] placeholder:text-[#9ca3af] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/10 sm:block" />
          <button aria-label="Notifications" className="relative text-[#9ca3af] transition-colors hover:text-[#1e1b4b]">
            <BellIcon className="h-[18px] w-[18px]" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#1a5c4f]">
            <span className="text-xs font-bold text-white">{userInitials}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="ml-64 min-h-screen bg-[#f8fafc] pt-16">
        <div className="mx-auto max-w-[1400px] p-8">{children}</div>
      </main>
    </div>
    </ToastProvider>
  );
}
