"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchCurrentProfile, type Role } from "@/lib/profiles";
import { fetchUserPermissions, type PermissionOverrides } from "@/lib/userPermissions";
import { resolveFeatureAccess } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

interface RoleContextValue {
  role: Role | null;
  userId: string | null;
  permissions: PermissionOverrides | null;
  loading: boolean;
  /** Convenience: resolveFeatureAccess bound to this user's role + overrides. */
  can: (featureKey: string) => boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  userId: null,
  permissions: null,
  loading: true,
  can: () => false,
});

export function useRole() {
  return useContext(RoleContext);
}

export default function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionOverrides | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(uid: string | null) {
      setUserId(uid);
      if (!uid) {
        if (!cancelled) {
          setRole(null);
          setPermissions(null);
          setLoading(false);
        }
        return;
      }
      try {
        const [profile, perms] = await Promise.all([fetchCurrentProfile(), fetchUserPermissions(uid)]);
        if (cancelled) return;
        setRole(profile?.role ?? null);
        setPermissions(perms);
      } catch (err) {
        console.warn("[RoleProvider] load failed", err);
        if (cancelled) return;
        setRole(null);
        setPermissions(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    supabase.auth
      .getUser()
      .then(({ data }) => load(data.user?.id ?? null))
      .catch((err) => {
        console.warn("[RoleProvider] getUser failed", err);
        load(null);
      });

    // Same session lives in localStorage across every tab — pick up the
    // switch immediately instead of showing a stale role/user for this tab.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const can = (featureKey: string) => resolveFeatureAccess(role, permissions, featureKey);

  return <RoleContext.Provider value={{ role, userId, permissions, loading, can }}>{children}</RoleContext.Provider>;
}
