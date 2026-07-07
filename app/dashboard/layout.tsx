"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
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
  SearchIcon,
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-[#f0faf8] text-gray-500">
        Loading…
      </div>
    );
  }

  const displayName = fullName || email.split("@")[0];
  const userInitials = initials(fullName, email);
  const activeItem = navItems.find((n) => isActive(pathname, n.href));
  const pageTitle = activeItem?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#f0faf8]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-20 flex h-screen w-[260px] flex-col bg-[#1e1b4b]">
        {/* Logo */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-white">مَوْرِد</span>
            <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
          </div>
          <span className="mt-0.5 block text-xs uppercase tracking-[0.2em] text-[#4ade80]/70">
            Mawrid
          </span>
        </div>
        <div className="mx-6 border-t border-white/10" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.15em] text-white/30">
            Workspace
          </p>
          <div className="flex flex-col gap-1">
            {navItems.map(({ label, href, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-[#1a5c4f] text-white shadow-lg shadow-[#1a5c4f]/30"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center">
                    <Icon />
                  </span>
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-sm font-bold text-white">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {displayName}
            </p>
            <p className="truncate text-xs text-white/40">{email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-auto text-xs font-medium text-red-400/70 transition hover:text-red-400"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Topbar */}
      <header className="fixed left-[260px] right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-gray-100 bg-white/80 px-8 backdrop-blur">
        <h1 className="text-lg font-bold text-[#1e1b4b]">{pageTitle}</h1>
        <div className="flex items-center gap-4">
          <div className="hidden h-9 w-52 items-center gap-2 rounded-xl bg-gray-50 px-3 text-gray-400 sm:flex">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search…"
              className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
              style={{ boxShadow: "none" }}
            />
          </div>
          <button
            className="relative text-gray-500 hover:text-[#1a5c4f]"
            aria-label="Notifications"
          >
            <BellIcon />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a5c4f] text-xs font-bold text-white">
            {userInitials}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="ml-[260px] min-h-screen bg-[#f0faf8] p-8 pt-24">
        {children}
      </main>
    </div>
  );
}
