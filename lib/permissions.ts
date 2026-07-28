import type { Role } from "@/lib/profiles";
import { defaultFeatureAccess, featureForPath } from "@/lib/features";
import type { PermissionOverrides } from "@/lib/userPermissions";

/** Whether a user can access a given feature: an admin always can (they're
 * the one exception with full override), otherwise a manager-set override
 * wins, falling back to the role's default when no override was ever set. */
export function resolveFeatureAccess(role: Role | null, overrides: PermissionOverrides | null, key: string): boolean {
  if (role === "admin") return true;
  if (overrides && key in overrides) return overrides[key];
  return defaultFeatureAccess(role, key);
}

/** Whether the current pathname is blocked for this user, given their
 * per-feature permission overrides. */
export function isPathRestricted(role: Role | null, overrides: PermissionOverrides | null, pathname: string): boolean {
  const feature = featureForPath(pathname);
  if (!feature) return false;
  return !resolveFeatureAccess(role, overrides, feature.key);
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
