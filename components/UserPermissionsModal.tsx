"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { FEATURES, defaultFeatureAccess } from "@/lib/features";
import { fetchUserPermissions, saveUserPermissions, type PermissionOverrides } from "@/lib/userPermissions";
import type { Role } from "@/lib/profiles";
import { LockIcon } from "@/components/icons";

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
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface-inverse)_50%,transparent)] backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-inverse)] px-6 py-5">
          <div>
            <h3 className="t-body-lg font-bold text-white">صلاحيات {userName}</h3>
            <p className="mt-0.5 t-body-sm text-[var(--content-disabled)]">تحديد أي أجزاء الموقع مسموح لهذا المستخدم يوصلها</p>
          </div>
          <button onClick={onClose} className="flex-none text-[var(--content-disabled)] transition hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {isAdminTarget ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--status-danger-bg)] text-2xl"><LockIcon className="h-4 w-4" /></span>
            <p className="t-body font-semibold text-[var(--content-secondary)]">هذا المستخدم أدمن</p>
            <p className="max-w-sm t-body-sm text-[var(--content-tertiary)]">حسابات الأدمن عندها وصول كامل لكل شيء دائماً، ما يمديك تقيّدها من هنا.</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-sunken)_60%,transparent)] px-6 py-3">
              <span className="t-body-sm font-medium text-[var(--content-tertiary)]">
                {loading ? "جارِ التحميل…" : `${allowedCount} من ${FEATURES.length} مميزة مسموحة`}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setAll(true)} className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5 t-caption font-semibold text-[var(--content-secondary)] transition hover:bg-[var(--surface-sunken)]">السماح بالكل</button>
                <button onClick={() => setAll(false)} className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5 t-caption font-semibold text-[var(--content-secondary)] transition hover:bg-[var(--surface-sunken)]">منع الكل</button>
                <button onClick={resetToDefault} className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5 t-caption font-semibold text-[var(--content-secondary)] transition hover:bg-[var(--surface-sunken)]">الافتراضي</button>
              </div>
            </div>

            {/* Feature list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="py-10 text-center t-body-sm text-[var(--content-tertiary)]">جارِ التحميل…</div>
              ) : (
                <div className="space-y-6">
                  {grouped.map((group) => (
                    <div key={group.heading}>
                      <p className="mb-2.5 t-caption font-bold uppercase tracking-wider text-[var(--content-tertiary)]">{group.heading}</p>
                      <div className="space-y-2">
                        {group.items.map((f) => {
                          const allowed = !!values[f.key];
                          return (
                            <div
                              key={f.key}
                              className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3 transition ${allowed ? "border-[var(--brand-teal-200)] bg-[var(--surface-accent-subtle)]/60" : "border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-sunken)_40%,transparent)]"}`}
                            >
                              <div className="min-w-0">
                                <p className="t-body-sm font-semibold text-[var(--content-primary)]">{f.label}</p>
                                <p className="mt-0.5 t-caption text-[var(--content-tertiary)]">{f.description}</p>
                              </div>
                              <button
                                onClick={() => toggle(f.key)}
                                role="switch"
                                aria-checked={allowed}
                                className={`relative flex h-7 w-12 flex-none items-center rounded-full transition-colors ${allowed ? "bg-[var(--brand-teal-700)]" : "bg-[var(--border-default)]"}`}
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
            <div className="flex gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
              <button onClick={onClose} className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] t-body-sm font-semibold text-[var(--content-secondary)] transition hover:bg-[var(--surface-sunken)]">إلغاء</button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="h-11 flex-1 rounded-[var(--radius-md)] bg-[var(--brand-teal-700)] t-body-sm font-bold text-white shadow-sm shadow-[var(--brand-teal-700)]/20 transition hover:bg-[var(--brand-teal-800)] disabled:opacity-50"
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
