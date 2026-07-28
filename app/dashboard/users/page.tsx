"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { fetchCurrentProfile, fetchProfiles, type Profile, type Role } from "@/lib/profiles";

const roleMeta: Record<Role, { label: string; cls: string }> = {
  admin: { label: "أدمن", cls: "bg-red-50 text-red-600 ring-1 ring-red-200" },
  manager: { label: "مدير", cls: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200" },
  sales: { label: "مندوب مبيعات", cls: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" },
};

function profileName(p: Profile): string {
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";
}

function initials(p: Profile): string {
  const n = profileName(p);
  const parts = n.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

export default function UsersPage() {
  const toast = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, mine] = await Promise.all([fetchProfiles(), fetchCurrentProfile()]);
    setProfiles(list);
    setMe(mine);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(p: Profile, role: Role) {
    if (me?.role !== "admin" && !(me?.role === "manager" && role !== "admin")) {
      toast("ما عندك صلاحية لهذا التغيير", "error");
      return;
    }
    setSavingId(p.id);
    const { error } = await supabase.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", p.id);
    setSavingId(null);
    if (error) {
      console.error("[Users] role change failed", error);
      toast("تعذّر تحديث الصلاحية", "error");
      return;
    }
    toast(`تم تحديث صلاحية ${profileName(p)} إلى ${roleMeta[role].label}`);
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, role } : x)));
  }

  const canEdit = me?.role === "admin" || me?.role === "manager";

  return (
    <>
      <div className="mb-6">
        <h1 dir="auto" className="text-[28px] font-bold text-slate-900">المستخدمون والصلاحيات</h1>
        <p className="mt-1 text-[14px] text-slate-500">
          إدارة أدوار الفريق — أدمن، مدير، أو مندوب مبيعات
        </p>
      </div>

      {!loading && !canEdit && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] font-medium text-amber-700">
          هذه الصفحة للعرض فقط — تحتاج صلاحية مدير أو أدمن لتعديل الأدوار.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3.5">المستخدم</th>
              <th className="px-6 py-3.5">الدور الحالي</th>
              <th className="px-6 py-3.5">تغيير الدور</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-16 text-center text-[14px] text-slate-500">جارِ التحميل…</td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-16 text-center text-[14px] text-slate-500">لا يوجد مستخدمون</td>
              </tr>
            ) : (
              profiles.map((p) => {
                const isSelf = p.id === me?.id;
                const isAdminTarget = p.role === "admin";
                const disabled = !canEdit || savingId === p.id || (me?.role === "manager" && (isAdminTarget || isSelf));
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-[13px] font-bold text-white shadow-sm">
                          {initials(p)}
                        </span>
                        <div className="min-w-0">
                          <p dir="auto" className="truncate text-[14px] font-semibold text-slate-900">
                            {profileName(p)} {isSelf && <span className="text-slate-400">(أنت)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[12px] font-semibold ${roleMeta[p.role].cls}`}>
                        {roleMeta[p.role].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={p.role}
                        disabled={disabled}
                        onChange={(e) => changeRole(p, e.target.value as Role)}
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-[13px] font-medium text-slate-700 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="sales">مندوب مبيعات</option>
                        <option value="manager">مدير</option>
                        <option value="admin">أدمن</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
