"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchCurrentProfile, type Role } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";

interface RoleContextValue {
  role: Role | null;
  userId: string | null;
  loading: boolean;
}

const RoleContext = createContext<RoleContextValue>({ role: null, userId: null, loading: true });

export function useRole() {
  return useContext(RoleContext);
}

export default function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      const profile = await fetchCurrentProfile();
      if (cancelled) return;
      setRole(profile?.role ?? null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return <RoleContext.Provider value={{ role, userId, loading }}>{children}</RoleContext.Provider>;
}
