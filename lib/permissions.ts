import type { Role } from "@/lib/profiles";

/** Pages a "sales" role cannot open — redirected to /dashboard if they try. */
export const RESTRICTED_PATHS_FOR_SALES = [
  "/dashboard/users",
  "/dashboard/analytics",
  "/dashboard/revenue-intelligence",
  "/dashboard/insights",
];

export function isPathRestricted(role: Role | null, pathname: string): boolean {
  if (role !== "sales") return false;
  return RESTRICTED_PATHS_FOR_SALES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Sales reps only see their own leads/deals; managers and admins see everything. */
export function canViewAllData(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

export function canManageUsers(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

export function canCreateAdmin(role: Role | null): boolean {
  return role === "admin";
}
