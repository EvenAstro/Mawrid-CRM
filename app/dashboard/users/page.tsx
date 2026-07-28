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

const inputCls = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-[14px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition";
const selectCls = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-[14px] text-slate-700 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition appearance-none";

export default function UsersPage() {
  const toast = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [nf, setNf] = useState({ firstName: "", lastName: "", email: "", password: "", role: "sales" as Role });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function createUser() {
    setCreateErr("");
    if (!nf.firstName.trim() || !nf.lastName.trim()) return setCreateErr("اكتب الاسم الأول والأخير");
    if (!nf.email.trim()) return setCreateErr("اكتب الإيميل");
    if (nf.password.length < 6) return setCreateErr("كلمة المرور 6 أحرف على الأقل");
    setCreating(true);
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes.session?.access_token;
    if (!token) {
      setCreating(false);
      setCreateErr("انتهت الجلسة، سجّل الدخول من جديد");
      return;
    }
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(nf),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateErr(json.error || "تعذّر إنشاء الحساب");
        setCreating(false);
        return;
      }
      toast(`تم إنشاء حساب ${nf.firstName} ${nf.lastName}`);
      setNf({ firstName: "", lastName: "", email: "", password: "", role: "sales" });
      setAddOpen(false);
      setCreating(false);
      load();
    } catch (err) {
      console.error("[Users] create failed", err);
      setCreateErr("تعذّر الاتصال بالخادم");
      setCreating(false);
    }
  }

  async function deleteUser(p: Profile) {
    setDeletingId(p.id);
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes.session?.access_token;
    if (!token) {
      setDeletingId(null);
      toast("انتهت الجلسة، سجّل الدخول من جديد", "error");
      return;
    }
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: p.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "تعذّر حذف الحساب", "error");
        setDeletingId(null);
        return;
      }
      toast(`تم حذف حساب ${profileName(p)}`);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      setConfirmDeleteId(null);
      setDeletingId(null);
    } catch (err) {
      console.error("[Users] delete failed", err);
      toast("تعذّر الاتصال بالخادم", "error");
      setDeletingId(null);
    }
  }

  const canEdit = me?.role === "admin" || me?.role === "manager";
  const canDelete = me?.role === "admin";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 dir="auto" className="text-[28px] font-bold text-slate-900">المستخدمون والصلاحيات</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            إدارة أدوار الفريق — أدمن، مدير، أو مندوب مبيعات
          </p>
        </div>
        {!loading && (me?.role === "admin" || me?.role === "manager") && (
          <button
            onClick={() => { setAddOpen(true); setCreateErr(""); }}
            className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 text-[14px] font-bold text-white shadow-md shadow-emerald-600/25 transition hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.98]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
            إضافة مستخدم
          </button>
        )}
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
              {canDelete && <th className="px-6 py-3.5"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-[14px] text-slate-500">جارِ التحميل…</td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-[14px] text-slate-500">لا يوجد مستخدمون</td>
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
                    {canDelete && (
                      <td className="px-6 py-4 text-right">
                        {isSelf ? null : confirmDeleteId === p.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[12px] font-medium text-slate-500">متأكد؟</span>
                            <button
                              onClick={() => deleteUser(p)}
                              disabled={deletingId === p.id}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === p.id ? "..." : "احذف"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-50"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            حذف الحساب
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add user modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-slate-900">إضافة مستخدم جديد</h3>
                <p className="mt-0.5 text-[13px] text-slate-400">أنشئ حساب مباشرة بكلمة مرور وصلاحية</p>
              </div>
              <button onClick={() => setAddOpen(false)} className="flex-none text-slate-400 transition hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الاسم الأول</label>
                  <input dir="auto" value={nf.firstName} onChange={(e) => setNf({ ...nf, firstName: e.target.value })} placeholder="خالد" className={inputCls} autoFocus />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الاسم الأخير</label>
                  <input dir="auto" value={nf.lastName} onChange={(e) => setNf({ ...nf, lastName: e.target.value })} placeholder="محمد" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الإيميل</label>
                <input type="email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} placeholder="name@company.com" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">كلمة المرور</label>
                <input type="text" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} placeholder="6 أحرف على الأقل" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الصلاحية</label>
                <select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value as Role })} className={selectCls}>
                  <option value="sales">مندوب مبيعات</option>
                  <option value="manager">مدير</option>
                  {me?.role === "admin" && <option value="admin">أدمن</option>}
                </select>
              </div>

              {createErr && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[13px] font-medium text-red-700">{createErr}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setAddOpen(false)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50">
                  إلغاء
                </button>
                <button
                  onClick={createUser}
                  disabled={creating}
                  className="h-11 flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-[14px] font-bold text-white shadow-md shadow-emerald-600/20 transition hover:shadow-lg disabled:opacity-50"
                >
                  {creating ? "جارِ الإنشاء…" : "إنشاء الحساب"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
