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

export function canDeleteUsers(role: Role | null): boolean {
  return role === "admin";
}

/** Only the task's assignee can complete it or edit it — everyone else can
 * only view. The admin (site owner) is the one exception with full override. */
export function canActOnTask(role: Role | null, userId: string | null, assigneeUid: string | null): boolean {
  if (role === "admin") return true;
  return !!userId && !!assigneeUid && userId === assigneeUid;
}
