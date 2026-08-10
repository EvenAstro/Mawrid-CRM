"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { FEATURES, defaultFeatureAccess } from "@/lib/features";
import { fetchUserPermissions, saveUserPermissions, type PermissionOverrides } from "@/lib/userPermissions";
import type { Role } from "@/lib/profiles";

const GROUP_ORDER = ["مساحة العمل", "التفاعل", "الذكاء", "الإدارة"];

export default function UserPermissionsModal({
  open,
  userId,
  userName,
  userRole,
  onClose,
}: {
  open: boolean;
  userId: string | null;
  userName: string;
  userRole: Role;
  onClose: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    fetchUserPermissions(userId).then((overrides: PermissionOverrides) => {
      const initial: Record<string, boolean> = {};
      FEATURES.forEach((f) => {
        initial[f.key] = f.key in overrides ? overrides[f.key] : defaultFeatureAccess(userRole, f.key);
      });
      setValues(initial);
      setLoading(false);
    });
  }, [open, userId, userRole]);

  const grouped = useMemo(
    () => GROUP_ORDER.map((heading) => ({ heading, items: FEATURES.filter((f) => f.group === heading) })),
    [],
  );

  const allowedCount = Object.values(values).filter(Boolean).length;

  function toggle(key: string) {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setAll(allowed: boolean) {
    const next: Record<string, boolean> = {};
    FEATURES.forEach((f) => { next[f.key] = allowed; });
    setValues(next);
  }

  function resetToDefault() {
    const next: Record<string, boolean> = {};
    FEATURES.forEach((f) => { next[f.key] = defaultFeatureAccess(userRole, f.key); });
    setValues(next);
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const entries = FEATURES.map((f) => ({ key: f.key, allowed: !!values[f.key] }));
    const err = await saveUserPermissions(userId, entries);
    setSaving(false);
    if (err) {
      toast("تعذّر حفظ الصلاحيات", "error");
      return;
    }
    toast(`تم حفظ صلاحيات ${userName}`);
    onClose();
  }

  if (!open) return null;
  const isAdminTarget = userRole === "admin";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-[var(--surface-raised)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-[#141c2e] px-6 py-5">
          <div>
            <h3 className="t-body-lg font-bold text-white">صلاحيات {userName}</h3>
            <p className="mt-0.5 t-body-sm text-slate-300">تحديد أي أجزاء الموقع مسموح لهذا المستخدم يوصلها</p>
          </div>
          <button onClick={onClose} className="flex-none text-slate-300 transition hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {isAdminTarget ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-red-50 text-2xl">🔓</span>
            <p className="t-body font-semibold text-slate-700">هذا المستخدم أدمن</p>
            <p className="max-w-sm t-body-sm text-slate-400">حسابات الأدمن عندها وصول كامل لكل شيء دائماً، ما يمديك تقيّدها من هنا.</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-3">
              <span className="t-body-sm font-medium text-slate-500">
                {loading ? "جارِ التحميل…" : `${allowedCount} من ${FEATURES.length} مميزة مسموحة`}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setAll(true)} className="rounded-[var(--radius-sm)] border border-slate-200 bg-[var(--surface-raised)] px-3 py-1.5 t-caption font-semibold text-slate-600 transition hover:bg-slate-50">
                  السماح بالكل
                </button>
                <button onClick={() => setAll(false)} className="rounded-[var(--radius-sm)] border border-slate-200 bg-[var(--surface-raised)] px-3 py-1.5 t-caption font-semibold text-slate-600 transition hover:bg-slate-50">
                  منع الكل
                </button>
                <button onClick={resetToDefault} className="rounded-[var(--radius-sm)] border border-slate-200 bg-[var(--surface-raised)] px-3 py-1.5 t-caption font-semibold text-slate-600 transition hover:bg-slate-50">
                  الافتراضي
                </button>
              </div>
            </div>

            {/* Feature list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="py-10 text-center text-[14px] text-slate-400">جارِ التحميل…</div>
              ) : (
                <div className="space-y-6">
                  {grouped.map((group) => (
                    <div key={group.heading}>
                      <p className="mb-2.5 t-caption font-bold uppercase tracking-wider text-slate-400">{group.heading}</p>
                      <div className="space-y-2">
                        {group.items.map((f) => {
                          const allowed = !!values[f.key];
                          return (
                            <div
                              key={f.key}
                              className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3 transition ${allowed ? "border-[#b8ddd2] bg-[#f0faf8]/60" : "border-slate-200 bg-slate-50/40"}`}
                            >
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-slate-800">{f.label}</p>
                                <p className="mt-0.5 t-caption text-slate-400">{f.description}</p>
                              </div>
                              <button
                                onClick={() => toggle(f.key)}
                                role="switch"
                                aria-checked={allowed}
                                className={`relative flex h-7 w-12 flex-none items-center rounded-full transition-colors ${allowed ? "bg-[#1a5c4f]" : "bg-slate-300"}`}
                              >
                                <span className={`absolute left-[2px] h-5 w-5 rounded-full bg-[var(--surface-raised)] shadow-sm transition-transform ${allowed ? "translate-x-[22px]" : "translate-x-0"}`} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={onClose} className="h-11 flex-1 rounded-[var(--radius-md)] border border-slate-200 bg-[var(--surface-raised)] text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50">
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="h-11 flex-1 rounded-[var(--radius-md)] bg-[#1a5c4f] text-[14px] font-bold text-white shadow-sm shadow-[#1a5c4f]/20 transition hover:bg-[#15503f] disabled:opacity-50"
              >
                {saving ? "جارِ الحفظ…" : "حفظ الصلاحيات"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
