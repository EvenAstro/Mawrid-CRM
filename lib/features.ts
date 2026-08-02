import type { Role } from "@/lib/profiles";

export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  group: string;
  href: string;
}

/** Every navigable feature in the app — the single source of truth for
 * both the sidebar and the per-user permissions editor. Add a page here
 * and it automatically gets a toggle in "صلاحيات المستخدم". */
export const FEATURES: FeatureDef[] = [
  { key: "dashboard", label: "الرئيسية", description: "الصفحة الرئيسية ولوحة المؤشرات", group: "مساحة العمل", href: "/dashboard" },
  { key: "contacts", label: "جهات الاتصال", description: "قائمة جهات الاتصال والشركات", group: "مساحة العمل", href: "/dashboard/contacts" },
  { key: "leads", label: "العملاء المحتملون", description: "إدارة ومتابعة العملاء المحتملين", group: "مساحة العمل", href: "/dashboard/leads" },
  { key: "deals", label: "الصفقات", description: "مسار الصفقات ولوحة المبيعات", group: "مساحة العمل", href: "/dashboard/deals" },
  { key: "activities", label: "النشاطات", description: "سجل كل النشاطات المسجّلة", group: "التفاعل", href: "/dashboard/activities" },
  { key: "tasks", label: "المهام", description: "قائمة المهام والتقويم", group: "التفاعل", href: "/dashboard/tasks" },
  { key: "tickets", label: "التذاكر", description: "تذاكر الدعم والمتابعة", group: "التفاعل", href: "/dashboard/tickets" },
  { key: "insights", label: "الرؤى والإيرادات", description: "رؤى تحليلية وذكاء الإيرادات", group: "الذكاء", href: "/dashboard/insights" },
  { key: "lead_scoring", label: "تقييم العملاء", description: "نموذج الذكاء الاصطناعي لتقييم العملاء", group: "الذكاء", href: "/dashboard/lead-scoring" },
  { key: "playbook", label: "الدليل التكتيكي", description: "الدليل التكتيكي للمبيعات", group: "الذكاء", href: "/dashboard/playbook" },
  { key: "users", label: "إدارة المستخدمين", description: "إدارة حسابات الفريق وصلاحياتهم", group: "الإدارة", href: "/dashboard/users" },
];

const FEATURE_BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

export function featureForPath(pathname: string): FeatureDef | null {
  // Longest-prefix match so /dashboard/leads/123 still resolves to "leads".
  let best: FeatureDef | null = null;
  for (const f of FEATURES) {
    const matches = f.href === "/dashboard" ? pathname === "/dashboard" : (pathname === f.href || pathname.startsWith(f.href + "/"));
    if (matches && (!best || f.href.length > best.href.length)) best = f;
  }
  return best;
}

export function getFeature(key: string): FeatureDef | undefined {
  return FEATURE_BY_KEY.get(key);
}

/** Baseline access before any per-user override is applied. */
const SALES_DEFAULT_DENY = new Set(["insights", "users"]);

export function defaultFeatureAccess(role: Role | null, key: string): boolean {
  if (role === "admin" || role === "manager") return true;
  return !SALES_DEFAULT_DENY.has(key);
}
