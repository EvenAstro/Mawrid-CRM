"use client";

import CountUp from "@/components/ui/CountUp";
import Sparkline from "@/components/ui/Sparkline";

/**
 * A stylised, non-interactive preview of the Mawrid CRM deals board, shown
 * under the landing hero. It exists because a CRM landing page that never
 * shows the CRM asks visitors to imagine the product instead of seeing it.
 *
 * The numbers here are illustrative sample data, not live figures — this is
 * marketing chrome on a public page with no session, so it deliberately does
 * not read from Supabase.
 */

const COL_A = [
  { name: "مؤسسة الرؤية", amount: "٤٥٬٠٠٠", who: "ر" },
  { name: "شركة نماء", amount: "٢٨٬٠٠٠", who: "ع" },
];
const COL_C = [
  { name: "الشركة السعودية", amount: "٩٥٬٠٠٠", who: "ن" },
  { name: "دار الابتكار", amount: "٥٢٬٠٠٠", who: "هـ" },
];

function DealCard({
  name,
  amount,
  who,
  won = false,
  traveling = false,
}: {
  name: string;
  amount: string;
  who: string;
  won?: boolean;
  traveling?: boolean;
}) {
  return (
    <div
      className={`mb-1.5 rounded-[var(--radius-sm)] border px-2.5 py-2 ${
        won ? "border-[var(--brand-teal-400)]/45 bg-[var(--surface-accent-subtle)] shadow-[0_3px_12px_rgba(58,144,128,0.14)]" : "border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
      } ${traveling ? "land-travel" : ""}`}
    >
      <p dir="auto" className="mb-1 truncate t-caption font-bold text-[var(--surface-inverse)]">{name}</p>
      <div className="flex items-center justify-between">
        <span className="t-micro font-extrabold tabular-nums text-[var(--brand-teal-700)]">{amount}</span>
        <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[var(--brand-teal-400)] t-micro font-bold text-white">{who}</span>
      </div>
    </div>
  );
}

function Kpi({ label, value, format, spark, delay }: { label: string; value: number; format?: (n: number) => string; spark: number[]; delay: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2.5">
      <p className="mb-1 t-micro font-bold text-[var(--content-tertiary)]">{label}</p>
      <p className="t-figure-sm font-black leading-none tabular-nums text-[var(--surface-inverse)]">
        <CountUp value={value} format={format} duration={1200} />
      </p>
      <div className="mt-1.5 opacity-70">
        <Sparkline values={spark} color="var(--brand-teal-400)" width={120} height={20} delay={delay} />
      </div>
    </div>
  );
}

export default function ProductMock() {
  return (
    <div className="relative mx-auto mt-14 max-w-[1000px] px-2">
      <div
        dir="rtl"
        className="flex min-h-[352px] overflow-hidden rounded-t-2xl border border-b-0 border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[0_26px_70px_rgba(20,28,46,0.16)]"
      >
        {/* Sidebar rail */}
        <div className="flex w-[60px] flex-none flex-col items-center gap-2.5 bg-[var(--surface-inverse)] py-4">
          <div className="mb-2 h-[26px] w-[26px] rounded-[var(--radius-sm)] bg-[var(--brand-teal-400)]" />
          <div className="h-[26px] w-[26px] rounded-[var(--radius-sm)] bg-[var(--brand-teal-300)]/30" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[26px] w-[26px] rounded-[var(--radius-sm)] bg-white/[0.09]" />
          ))}
        </div>

        {/* Board */}
        <div className="min-w-0 flex-1 bg-[var(--surface-sunken)] px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <b className="t-body-sm font-extrabold text-[var(--surface-inverse)]">لوحة الصفقات</b>
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--brand-teal-400)]/20 bg-[var(--surface-accent-subtle)] px-2.5 py-1 t-micro font-bold text-[var(--brand-teal-700)]">
              <span className="land-blip h-1.5 w-1.5 rounded-full bg-[var(--brand-teal-400)]" />مباشر</span>
          </div>

          <div className="mb-3.5 grid grid-cols-3 gap-2.5">
            <Kpi label="صفقات مفتوحة" value={34} spark={[12, 16, 15, 22, 26, 30, 34]} delay={500} />
            <Kpi label="الإيراد المتوقع (ألف)" value={847} spark={[310, 420, 480, 560, 690, 760, 847]} delay={620} />
            <Kpi label="نسبة الإغلاق %" value={62} spark={[38, 42, 47, 45, 53, 58, 62]} delay={740} />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="min-h-[132px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5">
              <h5 className="mb-2 flex justify-between t-micro font-extrabold text-[var(--content-tertiary)]">تواصل أولي<span className="font-bold text-[var(--border-strong)]">٣</span></h5>
              {COL_A.map((d) => <DealCard key={d.name} {...d} />)}
            </div>
            <div className="min-h-[132px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5">
              <h5 className="mb-2 flex justify-between t-micro font-extrabold text-[var(--content-tertiary)]">قيد التفاوض<span className="font-bold text-[var(--border-strong)]">٢</span></h5>
              <DealCard name="مجموعة الأفق" amount="١٢٠٬٠٠٠" who="س" traveling />
              <DealCard name="تقنية الخليج" amount="٦٧٬٠٠٠" who="م" />
            </div>
            <div className="min-h-[132px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5">
              <h5 className="mb-2 flex justify-between t-micro font-extrabold text-[var(--content-tertiary)]">ربح<span className="font-bold text-[var(--border-strong)]">٤</span></h5>
              {COL_C.map((d) => <DealCard key={d.name} {...d} won />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
