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
  { key: "team", label: "لوحة الفريق", description: "توزيع الصفقات على المندوبين وأين تسكت", group: "الإدارة", href: "/dashboard/team" },
  { key: "calls", label: "مكالماتك", description: "قائمة الاتصالات المقترحة اليوم مرتّبة بالأولوية", group: "مساحة العمل", href: "/dashboard/calls" },
  { key: "chat", label: "المحادثات", description: "محادثات داخلية بين أعضاء الفريق", group: "التفاعل", href: "/dashboard/chat" },
  { key: "activities", label: "النشاطات", description: "سجل كل النشاطات المسجّلة", group: "التفاعل", href: "/dashboard/activities" },
  { key: "tasks", label: "المهام", description: "قائمة المهام والتقويم", group: "التفاعل", href: "/dashboard/tasks" },
  { key: "insights", label: "الرؤى والإيرادات", description: "رؤى تحليلية وذكاء الإيرادات", group: "الذكاء", href: "/dashboard/insights" },
  { key: "users", label: "إدارة المستخدمين", description: "إدارة حسابات الفريق وصلاحياتهم", group: "الإدارة", href: "/dashboard/users" },
  { key: "whatsapp_conversations", label: "محادثات واتساب", description: "محادثات العملاء مع وكيل واتساب، مربوطة بملفاتهم", group: "التفاعل", href: "/dashboard/whatsapp" },
  { key: "calendar", label: "التقويم", description: "التقويم الأسبوعي — كل مواعيدك المجدولة", group: "التفاعل", href: "/dashboard/calendar" },
  { key: "working_hours", label: "ساعات العمل", description: "ساعات عمل يومية يستخدمها الوكيل لاقتراح مواعيد للعملاء", group: "التفاعل", href: "/dashboard/settings/working-hours" },
  { key: "assignment_rules", label: "قواعد توزيع العملاء", description: "قواعد ذكية لتوجيه كل عميل جديد للمندوب المناسب تلقائياً", group: "الإدارة", href: "/dashboard/settings/assignment-rules" },
  { key: "whatsapp_agent", label: "وكيل واتساب — تجريبي", description: "تحكم ومراقبة وكيل الرد التلقائي التجريبي على واتساب", group: "الإدارة", href: "/dashboard/whatsapp-test" },
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
const SALES_DEFAULT_DENY = new Set(["insights", "users", "team", "whatsapp_agent", "assignment_rules"]);

export function defaultFeatureAccess(role: Role | null, key: string): boolean {
  if (role === "admin" || role === "manager") return true;
  return !SALES_DEFAULT_DENY.has(key);
}
