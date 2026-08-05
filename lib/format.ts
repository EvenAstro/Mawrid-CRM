/** Shared formatting helpers so dates/money render identically across the app. */

const nf = new Intl.NumberFormat("en-US");

/** "٢ يوليو · ١:٠٠ م" — the canonical timestamp format for the whole app. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

/** "٢ يوليو ٢٠٢٦" — date only. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

/** "١:٠٠ م" — time only. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" });
}

/** "+966 50 123 4567" — group a raw phone number into readable chunks
 * instead of one unbroken digit string. Saudi mobile numbers (+966 5XXXXXXXX)
 * get the natural 2-3-4 grouping; anything else falls back to 3-digit groups
 * after the country code / leading digits. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const plus = phone.trim().startsWith("+") ? "+" : "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return phone;

  if (digits.startsWith("966") && digits.length === 12) {
    const rest = digits.slice(3);
    return `+966 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
  }

  // Local Saudi format (05XXXXXXXX, 10 digits) — same 2-3-4 grouping as the
  // +966 form above, just without the country code.
  if (digits.startsWith("05") && digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3));
  return plus + groups.join(" ");
}

/** Day-group header: "اليوم", "أمس", else "٢ يوليو". */
export function dayHeader(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "اليوم";
  if (diff === 1) return "أمس";
  return d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

/** Sortable day key (YYYY-MM-DD) for grouping. */
export function dayKey(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().slice(0, 10);
}

export const money = (n: number) => nf.format(Math.round(n));

/** Compact SAR: 1.2M / 45K / 320. */
export function compactSAR(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(Math.round(n));
}

/** Trigger a client-side CSV download from rows of objects. */
export function downloadCSV(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  // Prefix a UTF-8 BOM so Excel (which otherwise guesses Windows-1252) renders
  // Arabic text correctly instead of mojibake.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
}

/** Today's date as YYYY-MM-DD for <input type="date">. */
export function todayInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Build a display name from a Profile record. */
export function profileName(p: { full_name?: string | null; first_name?: string | null; last_name?: string | null } | undefined | null): string {
  if (!p) return "";
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || "";
}
