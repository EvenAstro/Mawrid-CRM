"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  buildRevenueIntelligence,
  type RevenueIntelligenceData,
  type RIDeal,
  type DealCategory,
} from "@/lib/revenueIntelligence/buildRevenueIntelligence";

const GLOBAL_CSS = `
@keyframes ri-up     { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:none } }
@keyframes ri-in     { from { opacity:0; transform:scale(.95) }       to { opacity:1; transform:none } }
@keyframes ri-shine  { from { transform:translateX(-100%) skewX(-18deg) } to { transform:translateX(300%) skewX(-18deg) } }
@keyframes ri-orb    { 0%,100%{ transform:translate(0,0) scale(1) }   50%{ transform:translate(20px,-16px) scale(1.1) } }
@keyframes ri-orb2   { 0%,100%{ transform:translate(0,0) scale(1) }   50%{ transform:translate(-14px,18px) scale(.92) } }
@keyframes ri-pulse  { 0%,100%{ opacity:1 } 50%{ opacity:.35 } }
@keyframes ri-scan   { from{ transform:translateY(-100%) } to{ transform:translateY(400%) } }
@keyframes ri-float  { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-6px) } }
@keyframes ri-glow   { 0%,100%{ box-shadow:0 0 20px rgba(16,185,129,.15) } 50%{ box-shadow:0 0 40px rgba(16,185,129,.3) } }
.ri-up   { animation: ri-up  .6s cubic-bezier(.16,1,.3,1) both }
.ri-in   { animation: ri-in  .45s cubic-bezier(.16,1,.3,1) both }
.ri-card { animation: ri-up  .55s cubic-bezier(.16,1,.3,1) both }
.ri-card:nth-child(1){ animation-delay:.06s }
.ri-card:nth-child(2){ animation-delay:.13s }
.ri-card:nth-child(3){ animation-delay:.20s }
.ri-card:nth-child(4){ animation-delay:.27s }
.ri-shine-wrap{ overflow:hidden; position:relative }
.ri-shine-wrap::after{
  content:''; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.15) 50%,transparent 70%);
  animation:ri-shine 2.8s ease-in-out .8s 1;
}
.ri-lift { transition:box-shadow .25s,transform .25s }
.ri-lift:hover { transform:translateY(-4px); box-shadow:0 20px 40px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.04) !important }
.ri-pulse { animation: ri-pulse 2.2s ease-in-out infinite }
.ri-page-bg { background: linear-gradient(180deg,#f8fafb 0%,#f1f4f6 40%,#eef1f3 100%); min-height:100vh }
`;

const sarK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} مليون` :
  n >= 1_000     ? `${(n / 1_000).toFixed(0)} ألف`       : `${n}`;
const sarFull = (n: number) => n.toLocaleString("ar-SA");

const P = {
  brand:   "#064e3b",
  brand2:  "#065f46",
  brand3:  "#059669",
  accent:  "#10b981",
  accent2: "#34d399",
  dark:    "#022c22",
  blue:    "#2563eb",
  blue2:   "#3b82f6",
  amber:   "#d97706",
  amber2:  "#f59e0b",
  red:     "#dc2626",
  red2:    "#ef4444",
  surface: "#ffffff",
  surfaceAlt: "#f8fafb",
  text:    "#111827",
  textSub: "#6b7280",
  textMute:"#9ca3af",
  border:  "#e5e7eb",
  borderLight: "#f3f4f6",
};

const CAT: Record<string, { label:string; sub:string; hex:string; bg:string; ring:string; gradient:string }> = {
  commit:    { label:"شبه مؤكدة",    sub:"احتمالية +80%",       hex:"#065f46", bg:"#ecfdf5", ring:"#6ee7b7", gradient:"linear-gradient(135deg,#065f46,#059669)" },
  best_case: { label:"محتملة",        sub:"احتمالية 30–80%",     hex:"#1e40af", bg:"#eff6ff", ring:"#93c5fd", gradient:"linear-gradient(135deg,#1e40af,#3b82f6)" },
  pipeline:  { label:"قيد المتابعة", sub:"احتمالية أقل من 30%", hex:"#92400e", bg:"#fffbeb", ring:"#fcd34d", gradient:"linear-gradient(135deg,#92400e,#d97706)" },
};
const RISK: Record<string, { label:string; dot:string; pill:string; pillBg:string }> = {
  high:   { label:"خطر عالٍ", dot:"#ef4444", pill:"text-red-700", pillBg:"linear-gradient(135deg,#fef2f2,#fee2e2)" },
  medium: { label:"متوسط",    dot:"#f59e0b", pill:"text-amber-700", pillBg:"linear-gradient(135deg,#fffbeb,#fef3c7)" },
  low:    { label:"مستقرة",   dot:"#10b981", pill:"text-emerald-700", pillBg:"linear-gradient(135deg,#ecfdf5,#d1fae5)" },
};

function calcHealth(d: RevenueIntelligenceData): { score: number; label: string; color: string; bg: string; gradient: string } {
  if (!d.deals.length) return { score: 0, label: "لا بيانات", color: "#9ca3af", bg: "#f9fafb", gradient:"linear-gradient(135deg,#9ca3af,#d1d5db)" };
  const winScore  = d.winRateThisMonth;
  const riskScore = Math.max(0, 100 - (d.atRiskCount / d.deals.length) * 200);
  const weightRatio = d.totalPipelineSAR > 0 ? (d.weightedPipelineSAR / d.totalPipelineSAR) * 100 : 50;
  const score = Math.round(winScore * 0.35 + riskScore * 0.4 + weightRatio * 0.25);
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped >= 75) return { score: clamped, label: "ممتاز",   color: "#059669", bg: "#ecfdf5", gradient:"linear-gradient(135deg,#059669,#34d399)" };
  if (clamped >= 50) return { score: clamped, label: "جيد",     color: "#2563eb", bg: "#eff6ff", gradient:"linear-gradient(135deg,#2563eb,#60a5fa)" };
  if (clamped >= 30) return { score: clamped, label: "متوسط",   color: "#d97706", bg: "#fffbeb", gradient:"linear-gradient(135deg,#d97706,#fbbf24)" };
  return               { score: clamped, label: "يحتاج عناية", color: "#dc2626", bg: "#fff1f2", gradient:"linear-gradient(135deg,#dc2626,#f87171)" };
}

function buildContext(d: RevenueIntelligenceData) {
  return [
    `التاريخ: ${new Date(d.asOf).toLocaleDateString("ar-SA")}`,
    `خط المبيعات: ${sarFull(d.totalPipelineSAR)} ريال | ${d.deals.length} صفقة`,
    `الإيراد المرجّح: ${sarFull(d.weightedPipelineSAR)} ريال`,
    `مُغلق هذا الشهر: ${sarFull(d.wonThisMonthSAR)} ريال (${d.wonThisMonthCount} صفقة)`,
    `خُسر هذا الشهر: ${d.lostThisMonthCount} صفقة`,
    `نسبة الفوز: ${d.winRateThisMonth}%`,
    `صفقات في خطر عالٍ: ${d.atRiskCount} | قيمة ${sarFull(d.atRiskSAR)} ريال`,
    `توقعات: متحفظ ${sarFull(d.forecast[0]?.valueSAR??0)} | واقعي ${sarFull(d.forecast[1]?.valueSAR??0)} | متفائل ${sarFull(d.forecast[2]?.valueSAR??0)} ريال`,
    "",
    "الصفقات في خطر:",
    ...d.deals.filter(x=>x.riskLevel==="high").map(x=>`- ${x.name}${x.leadName?` (${x.leadName})`:""}: ${sarFull(x.valueSAR)} ريال | ${x.probabilityPct}% | ${x.riskReasons.join("، ")}`),
    "",
    "أكبر 8 صفقات:",
    ...d.deals.slice(0,8).map(x=>`- ${x.name}: ${sarFull(x.valueSAR)} ريال | ${x.probabilityPct}% | ${CAT[x.category]?.label}`),
  ].join("\n");
}

async function callAI(messages: {role:"user"|"assistant";content:string}[], context: string): Promise<string> {
  const r = await fetch("/api/revenue-intelligence-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  });
  const j = await r.json();
  return j.reply ?? "تعذّر الاتصال.";
}

function AnimNum({ value, fmt }: { value:number; fmt:(n:number)=>string }) {
  const [v, setV] = useState(0);
  useEffect(()=>{
    let s: number|null=null; const dur=900;
    function f(ts:number){ if(!s)s=ts; const p=Math.min((ts-s)/dur,1); setV(Math.round((1-Math.pow(1-p,3))*value)); if(p<1)requestAnimationFrame(f); }
    requestAnimationFrame(f);
  },[value]);
  return <>{fmt(v)}</>;
}

function Ring({ pct, color, size=64, strokeWidth=8 }: { pct:number; color:string; size?:number; strokeWidth?:number }) {
  const r=(size-strokeWidth-2)/2, circ=2*Math.PI*r, dash=(pct/100)*circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}12`} strokeWidth={strokeWidth}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1) .3s"}}/>
    </svg>
  );
}

function Spark({ vals, color }: { vals:number[]; color:string }) {
  if(vals.length<2) return null;
  const max=Math.max(...vals,1), W=80, H=28, p=2;
  const xs=vals.map((_,i)=>p+(i/(vals.length-1))*(W-2*p));
  const ys=vals.map(v=>H-p-(v/max)*(H-2*p));
  const line=xs.map((x,i)=>`${i===0?"M":"L"}${x},${ys[i]}`).join(" ");
  const area=`${line} L${xs[xs.length-1]},${H-p} L${xs[0]},${H-p} Z`;
  const id=`sp${color.replace("#","")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[80px] h-[28px]" preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".35"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={area} fill={`url(#${id})`}/>
      <path d={line} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3" fill={color} stroke="white" strokeWidth="1.5"/>
    </svg>
  );
}

// ── Pipeline Health Card ──────────────────────────────────────────────────
function HealthCard({ data, ctx }: { data: RevenueIntelligenceData; ctx: string }) {
  const health = calcHealth(data);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const SIZE = 110, R = 42, STROKE = 11, circ = 2 * Math.PI * R;
  const dash = (health.score / 100) * circ;

  async function explain() {
    if (insight) { setOpen(true); return; }
    setOpen(true); setLoading(true);
    try {
      const reply = await callAI([{
        role: "user",
        content: `نبضة خط المبيعات لديك ${health.score}/100 (${health.label}). اشرح لي في 3 جمل قصيرة: لماذا هذا السكور؟ وما أهم شيء يجب فعله لرفعه؟ كن محدداً وعملياً.`
      }], ctx);
      setInsight(reply);
    } finally { setLoading(false); }
  }

  return (
    <div className="ri-up h-full" style={{animationDelay:".08s"}}>
      <div className="relative overflow-hidden rounded-[20px] border p-7 h-full flex flex-col ri-lift cursor-pointer group"
        onClick={explain}
        style={{
          background: `linear-gradient(145deg, ${P.surface} 0%, ${health.bg} 100%)`,
          borderColor: `${health.color}20`,
          boxShadow: `0 1px 3px rgba(0,0,0,.04), 0 8px 24px ${health.color}08`,
        }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[20px]">
          <div className="absolute left-0 right-0 h-20 opacity-[0.04]"
            style={{background:`linear-gradient(180deg,transparent,${health.color},transparent)`,animation:"ri-scan 3.5s linear infinite"}}/>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{background: health.gradient}}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M3 13l4-4 3 3 7-7"/></svg>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{color: P.textMute}}>نبضة الخط</span>
          </div>
          <span className="mr-auto text-[10px] font-bold px-2.5 py-1 rounded-full" style={{background: health.gradient, color:"white"}}>{health.label}</span>
        </div>

        <div className="flex items-center gap-6 flex-1">
          <div className="relative flex-none" style={{animation:"ri-float 4s ease-in-out infinite"}}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={`${health.color}10`} strokeWidth={STROKE}/>
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="url(#healthGrad)" strokeWidth={STROKE}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{transition:"stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1) .3s", filter:`drop-shadow(0 2px 8px ${health.color}40)`}}/>
              <defs>
                <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={health.color}/>
                  <stop offset="100%" stopColor={health.color} stopOpacity=".6"/>
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] font-black tabular-nums leading-none" style={{color:health.color}}>
                <AnimNum value={health.score} fmt={n=>`${n}`}/>
              </span>
              <span className="text-[10px] font-bold mt-0.5" style={{color: P.textMute}}>/ 100</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {[
              {label:"نسبة الفوز",  val:`${data.winRateThisMonth}%`,   color: P.brand3},
              {label:"صفقات آمنة",  val:`${Math.max(0,data.deals.length-data.atRiskCount)}`, color: P.blue},
              {label:"كثافة الخط",  val:`${data.totalPipelineSAR>0?Math.round((data.weightedPipelineSAR/data.totalPipelineSAR)*100):0}%`, color: P.amber},
            ].map(m=>(
              <div key={m.label} className="flex items-center justify-between rounded-xl py-2.5 px-3" style={{background:`${m.color}08`}}>
                <span className="text-[11px] font-medium" style={{color: P.textSub}}>{m.label}</span>
                <span className="text-[14px] font-black tabular-nums" style={{color: m.color}}>{m.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed group-hover:border-solid transition-all"
          style={{borderColor: `${health.color}30`, color: health.color}}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <circle cx="10" cy="10" r="8"/><path d="M10 7v3M10 13h.01"/>
          </svg>
          <span className="text-[11px] font-bold">فسّر لي بالذكاء الاصطناعي</span>
        </div>
      </div>

      {open && (
        <div className="ri-in mt-4 rounded-[20px] border overflow-hidden"
          style={{background:"linear-gradient(145deg,#022c22,#064e3b)",borderColor:`${health.color}20`, boxShadow:`0 20px 40px rgba(0,0,0,.2)`}}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{background: health.gradient}}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><circle cx="8" cy="6" r="2.5" fill="none" stroke="white" strokeWidth="1.3"/><circle cx="5" cy="9.5" r="1.5" fill="none" stroke="white" strokeWidth="1.3"/><circle cx="11" cy="9.5" r="1.5" fill="none" stroke="white" strokeWidth="1.3"/></svg>
              </div>
              <span className="text-[12px] font-bold text-white/90">تحليل نبضة الخط</span>
              <span className="text-[9px] font-bold text-emerald-400/60 bg-emerald-400/10 px-2 py-0.5 rounded-full">AI</span>
            </div>
            <button onClick={e=>{e.stopPropagation();setOpen(false);}} className="text-white/25 hover:text-white/60 transition text-sm">✕</button>
          </div>
          <div className="px-6 py-5 text-[13px] text-white/70 leading-[1.9] min-h-[60px]">
            {loading ? (
              <div className="flex items-center gap-2.5 text-white/35">
                {[0,1,2].map(i=><span key={i} className="h-2 w-2 rounded-full bg-emerald-400/50 animate-bounce" style={{animationDelay:`${i*.15}s`}}/>)}
                <span className="text-[11px]">يحلل البيانات…</span>
              </div>
            ) : insight}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deal Coach Modal ──────────────────────────────────────────────────────
interface CoachStep { num: number; title: string; body: string }

function parseSteps(text: string): CoachStep[] {
  const steps: CoachStep[] = [];
  const parts = text.split(/(?=الخطوة\s*\d)/);
  for (const p of parts) {
    const m = p.match(/الخطوة\s*(\d)[:\s]+([^\n]+)\n?([\s\S]*)/);
    if (m) steps.push({ num: parseInt(m[1]), title: m[2].trim(), body: m[3].trim() });
  }
  if (!steps.length && text.trim()) steps.push({ num: 1, title: "خطة العمل", body: text.trim() });
  return steps;
}

function CoachModal({ deal, ctx, onClose }: { deal: RIDeal; ctx: string; onClose: () => void }) {
  const [steps, setSteps]   = useState<CoachStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [done,  setDone]    = useState(false);
  const cat  = CAT[deal.category] ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];

  useEffect(() => {
    function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    const prompt = `أنت مدرب مبيعات خبير. لديك هذه الصفقة:
- الاسم: ${deal.name}${deal.leadName ? ` | العميل: ${deal.leadName}` : ""}
- القيمة: ${sarFull(deal.valueSAR)} ريال
- الاحتمالية: ${deal.probabilityPct}%
- المرحلة: ${deal.stage}
- في المرحلة منذ: ${deal.daysInStage} يوم
- آخر تواصل: ${deal.daysSinceActivity != null ? `منذ ${deal.daysSinceActivity} يوم` : "لا يوجد تواصل"}
- إشارات الخطر: ${deal.riskReasons.length ? deal.riskReasons.join("، ") : "لا توجد"}

اكتب لي خطة عمل عملية من 3 خطوات لإغلاق هذه الصفقة هذا الأسبوع.
استخدم هذا التنسيق بالضبط:
الخطوة 1: [عنوان قصير]
[شرح 2-3 جمل]

الخطوة 2: [عنوان قصير]
[شرح 2-3 جمل]

الخطوة 3: [عنوان قصير]
[شرح 2-3 جمل]`;

    callAI([{ role: "user", content: prompt }], ctx)
      .then(reply => { setSteps(parseSteps(reply)); setDone(true); })
      .catch(() => { setSteps([{ num: 1, title: "خطأ", body: "تعذّر الاتصال." }]); setDone(true); })
      .finally(() => setLoading(false));
  }, [deal, ctx]);

  const stepGradients = [
    "linear-gradient(135deg,#059669,#34d399)",
    "linear-gradient(135deg,#2563eb,#60a5fa)",
    "linear-gradient(135deg,#d97706,#fbbf24)",
  ];
  const stepColors = ["#059669", "#2563eb", "#d97706"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl"/>
      <div className="ri-in relative w-full max-w-lg overflow-hidden rounded-[24px] shadow-2xl" onClick={e=>e.stopPropagation()}
        style={{background:"linear-gradient(160deg,#011d16 0%,#022c22 40%,#064e3b 100%)",border:"1px solid rgba(255,255,255,.08)"}}>

        <div className="absolute top-[-40px] right-[-20px] h-56 w-56 pointer-events-none"
          style={{background:"radial-gradient(circle,rgba(16,185,129,.15),transparent 70%)"}}/>
        <div className="absolute bottom-[-30px] left-[-20px] h-40 w-40 pointer-events-none"
          style={{background:"radial-gradient(circle,rgba(52,211,153,.1),transparent 70%)"}}/>

        <div className="relative px-8 pt-7 pb-6 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center ri-shine-wrap"
                  style={{background:"linear-gradient(135deg,#059669,#34d399)", boxShadow:"0 4px 12px rgba(5,150,105,.3)"}}>
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 3l6 12H4z"/><path d="M10 8v3M10 13h.01"/>
                  </svg>
                </div>
                <span className="text-[10px] font-black text-white/35 uppercase tracking-[0.2em]">مدرب الصفقات</span>
                <span className="text-[9px] font-bold text-emerald-400/70 bg-emerald-400/10 px-2 py-0.5 rounded-full">AI</span>
              </div>
              <h2 className="text-[20px] font-black text-white leading-tight">{deal.name}</h2>
              {deal.leadName && <p className="text-[12px] text-white/35 mt-1">{deal.leadName}</p>}
            </div>
            <button onClick={onClose}
              className="h-9 w-9 rounded-2xl flex items-center justify-center flex-none text-white/25 hover:text-white/60 hover:bg-white/5 transition mt-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { label: sarFull(deal.valueSAR) + " ر.س", gradient:"linear-gradient(135deg,#059669,#34d399)" },
              { label: `${deal.probabilityPct}% احتمالية`, gradient: cat.gradient },
              { label: risk.label, gradient: deal.riskLevel==="high"?"linear-gradient(135deg,#dc2626,#f87171)":"linear-gradient(135deg,#d97706,#fbbf24)" },
            ].map(b => (
              <span key={b.label} className="text-[11px] font-bold px-3.5 py-1.5 rounded-full text-white"
                style={{ background: b.gradient, boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative px-8 py-7 space-y-4">
          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white/35 text-[12px]">
                <div className="relative h-5 w-5">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/20"/>
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin"/>
                </div>
                يحلل بيانات الصفقة ويضع خطة عمل…
              </div>
              {[0,1,2].map(i => (
                <div key={i} className="rounded-2xl p-5 border border-white/[0.04]" style={{background:"rgba(255,255,255,.02)"}}>
                  <div className="h-3 rounded-full w-1/3 mb-3" style={{background:"rgba(255,255,255,.06)"}}/>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full w-full" style={{background:"rgba(255,255,255,.04)"}}/>
                    <div className="h-2 rounded-full w-4/5" style={{background:"rgba(255,255,255,.03)"}}/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {done && steps.map((step, i) => (
            <div key={i} className="ri-up rounded-2xl p-5 border"
              style={{animationDelay:`${i * 0.12}s`, background:`${stepColors[i] ?? "#059669"}08`, borderColor:`${stepColors[i] ?? "#059669"}18`}}>
              <div className="flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center text-[13px] font-black text-white flex-none ri-shine-wrap"
                  style={{background: stepGradients[i] ?? stepGradients[0], boxShadow:`0 4px 12px ${stepColors[i] ?? "#059669"}30`}}>
                  {step.num}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[14px] font-bold mb-2" style={{color:stepColors[i] ?? "#059669"}}>{step.title}</p>
                  <p className="text-[12px] text-white/55 leading-[1.8]">{step.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {done && (
          <div className="px-8 pb-8 flex gap-3">
            <a href="/dashboard/deals"
              className="flex-1 ri-shine-wrap flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-[13px] font-bold transition-all hover:opacity-90"
              style={{background:"linear-gradient(135deg,#059669,#34d399)",boxShadow:"0 8px 24px rgba(5,150,105,.3)"}}>
              افتح الصفقة
              <svg viewBox="0 0 16 16" fill="white" className="h-3.5 w-3.5 rotate-180"><path d="M6 4l4 4-4 4V4z"/></svg>
            </a>
            <button onClick={onClose}
              className="px-6 py-3.5 rounded-2xl text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/[0.15] text-[13px] font-medium transition-all">
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ label,note,value,fmt,unit,accent,gradient,icon,spark,ring }:
  { label:string; note:string; value:number; fmt?:(n:number)=>string;
    unit?:string; accent:string; gradient:string;
    icon:React.ReactNode; spark?:number[]; ring?:{pct:number} }) {
  const fmtFn = fmt ?? sarK;
  return (
    <div className="ri-card ri-lift relative bg-white rounded-[20px] overflow-hidden border p-6 flex flex-col gap-5"
      style={{borderColor:`${accent}12`,boxShadow:`0 1px 3px rgba(0,0,0,.04), 0 8px 24px ${accent}06`}}>
      <div className="absolute top-0 inset-x-0 h-[3px]" style={{background: gradient}}/>
      <div className="absolute inset-0 pointer-events-none" style={{background:`radial-gradient(ellipse 60% 40% at 90% 0%,${accent}06,transparent)`}}/>
      <div className="relative flex items-start justify-between gap-3">
        <div className="h-11 w-11 rounded-[14px] flex items-center justify-center flex-none ri-shine-wrap"
          style={{background: gradient, boxShadow:`0 4px 12px ${accent}25`}}>
          <span className="text-white">{icon}</span>
        </div>
        {ring ? (
          <div className="relative flex-none">
            <Ring pct={ring.pct} color={accent} size={60}/>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black" style={{color:accent}}>
              <AnimNum value={ring.pct} fmt={n=>`${n}%`}/>
            </span>
          </div>
        ) : spark ? <Spark vals={spark} color={accent}/> : null}
      </div>
      <div className="relative">
        <div className="flex items-end gap-1.5 leading-none">
          <span className="text-[34px] font-black tracking-tight tabular-nums" style={{background: gradient, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>
            <AnimNum value={value} fmt={fmtFn}/>
          </span>
          {unit && <span className="text-[11px] font-medium mb-1.5" style={{color: P.textMute}}>{unit}</span>}
        </div>
        <p className="text-[13px] font-bold mt-2.5" style={{color: P.text}}>{label}</p>
        <p className="text-[11px] mt-1 leading-snug" style={{color: P.textMute}}>{note}</p>
      </div>
    </div>
  );
}

// ── Forecast Bars ─────────────────────────────────────────────────────────
function ForecastBars({ scenarios }: { scenarios:RevenueIntelligenceData["forecast"] }) {
  const max=Math.max(...scenarios.map(s=>s.valueSAR),1);
  const pal=[
    {gradient:"linear-gradient(90deg,#064e3b,#059669)", note:"الصفقات شبه المؤكدة فقط", badge:"#064e3b"},
    {gradient:"linear-gradient(90deg,#065f46,#10b981)", note:"كل الصفقات × احتمالياتها", badge:"#065f46"},
    {gradient:"linear-gradient(90deg,#059669,#34d399)", note:"كل الصفقات بكامل قيمتها", badge:"#059669"},
  ];
  return (
    <div className="space-y-6">
      {scenarios.map((s,i)=>{
        const p=pal[i], pct=(s.valueSAR/max)*100;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center text-[12px] font-black text-white ri-shine-wrap"
                  style={{background: p.gradient, boxShadow:`0 3px 10px ${p.badge}30`}}>{i+1}</div>
                <div>
                  <p className="text-[13px] font-bold" style={{color: P.text}}>{s.label}</p>
                  <p className="text-[10px]" style={{color: P.textMute}}>{p.note}</p>
                </div>
              </div>
              <p className="text-[15px] font-black tabular-nums" style={{background: p.gradient, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>
                {sarK(s.valueSAR)} ر.س
              </p>
            </div>
            <div className="relative h-3 w-full rounded-full overflow-hidden" style={{background:"#f1f5f9"}}>
              <div className="h-full rounded-full transition-all duration-1000" style={{width:`${pct}%`, background: p.gradient, boxShadow:`0 0 12px ${p.badge}20`}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Distribution ──────────────────────────────────────────────────────────
function DistPills({ categories }: { categories:RevenueIntelligenceData["categories"] }) {
  const total=categories.reduce((s,c)=>s+c.totalSAR,0);
  const cats = ["commit","best_case","pipeline"];
  const colors = [CAT.commit.hex, CAT.best_case.hex, CAT.pipeline.hex];
  const gradients = [CAT.commit.gradient, CAT.best_case.gradient, CAT.pipeline.gradient];
  const SIZE=100, R=38, STROKE=12, circ=2*Math.PI*R;
  let offset=0;
  const slices=categories.map((c,i)=>{
    const pct=total?c.totalSAR/total:0, dash=pct*circ;
    const sl={pct,dash,offset,color:colors[i]??"#ccc"};
    offset+=dash; return sl;
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-6">
        <div className="relative flex-none" style={{animation:"ri-float 5s ease-in-out infinite"}}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
            <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE}/>
            {slices.map((sl,i)=>(
              <circle key={i} cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
                stroke={sl.color} strokeWidth={STROKE-1}
                strokeDasharray={`${sl.dash} ${circ-sl.dash}`}
                strokeDashoffset={-sl.offset}
                style={{transition:"stroke-dasharray 1s ease .1s"}}/>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{color: P.textMute}}>الكل</p>
            <p className="text-[14px] font-black" style={{color: P.text}}>{sarK(total)}</p>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {categories.map((c,i)=>{
            const cfg=CAT[cats[i]]; if(!cfg) return null;
            const pct=total?Math.round((c.totalSAR/total)*100):0;
            return (
              <div key={c.category} className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-md flex-none" style={{background: gradients[i]}}/>
                <span className="text-[12px] font-semibold flex-1" style={{color: P.text}}>{cfg.label}</span>
                <span className="text-[11px]" style={{color: P.textMute}}>{c.count} صفقة</span>
                <span className="text-[13px] font-black w-10 text-left tabular-nums" style={{color:colors[i]}}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-[2px]">
        {categories.map((c,i)=>(
          <div key={c.category} className="transition-all duration-700 rounded-full"
            style={{width:`${total?(c.totalSAR/total)*100:0}%`, background: gradients[i]}}/>
        ))}
      </div>

      <div className="space-y-3">
        {categories.map((c,i)=>{
          const cfg=CAT[cats[i]]; if(!cfg) return null;
          const pct=total?Math.round((c.totalSAR/total)*100):0;
          return (
            <div key={c.category} className="rounded-[16px] p-4 border ri-lift transition-all"
              style={{background: cfg.bg, borderColor:`${cfg.ring}60`}}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-md" style={{background: gradients[i]}}/>
                  <span className="text-[12px] font-bold" style={{color:cfg.hex}}>{cfg.label}</span>
                  <span className="text-[9px]" style={{color: P.textMute}}>{cfg.sub}</span>
                </div>
                <span className="text-[14px] font-black tabular-nums" style={{background: gradients[i], WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>{sarK(c.totalSAR)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]" style={{color: P.textMute}}>
                <span>{c.count} صفقة · {pct}% من الخط</span>
                <span>مرجّح: {sarK(c.weightedSAR)} ر.س</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Weekly Chart ──────────────────────────────────────────────────────────
function WeeklyChart({ data }: { data:RevenueIntelligenceData["weeklyHistory"] }) {
  const [hov, setHov]=useState<number|null>(null);
  const max=Math.max(...data.map(w=>Math.max(w.wonSAR,w.lostSAR)),1);
  return (
    <div>
      <div className="flex items-center gap-6 mb-6">
        {[{gradient:"linear-gradient(135deg,#059669,#34d399)",label:"رابحة"},{gradient:"linear-gradient(135deg,#ef4444,#fca5a5)",label:"خاسرة"}].map(({gradient,label})=>(
          <div key={label} className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-md" style={{background: gradient}}/>
            <span className="text-[11px] font-medium" style={{color: P.textSub}}>صفقات {label}</span>
          </div>
        ))}
        <span className="mr-auto text-[10px]" style={{color: P.textMute}}>حوّم للتفاصيل</span>
      </div>
      <div className="flex items-end gap-[4px] h-36">
        {data.map((w,i)=>{
          const wonH=(w.wonSAR/max)*100, lostH=(w.lostSAR/max)*100, isH=hov===i;
          return (
            <div key={i} className="relative flex-1 flex flex-col items-center cursor-pointer"
              onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
              {isH&&(
                <div className="absolute z-20 rounded-2xl px-4 py-3 text-[11px] text-center whitespace-nowrap pointer-events-none"
                  style={{bottom:"calc(100% + 10px)",left:"50%",transform:"translateX(-50%)",background:"linear-gradient(145deg,#022c22,#064e3b)",color:"white",boxShadow:"0 12px 32px rgba(0,0,0,.25)",border:"1px solid rgba(255,255,255,.08)"}}>
                  <p className="text-white/40 text-[9px] font-bold tracking-wider uppercase mb-1.5">{w.weekLabel}</p>
                  {w.wonSAR>0&&<p className="text-emerald-300 font-bold">↑ {sarK(w.wonSAR)} ر.س</p>}
                  {w.lostSAR>0&&<p className="text-red-300 font-bold">↓ {sarK(w.lostSAR)} ر.س</p>}
                  {w.wonSAR===0&&w.lostSAR===0&&<p className="text-white/30">لا نشاط</p>}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent" style={{borderTopColor:"#064e3b"}}/>
                </div>
              )}
              <div className="w-full flex items-end gap-[2px] h-[140px]">
                <div className="flex-1 rounded-t-[4px] transition-all duration-200"
                  style={{height:`${wonH}%`,background:isH?"linear-gradient(180deg,#34d399,#059669)":"linear-gradient(180deg,#10b981,#065f46)",minHeight:w.wonSAR>0?4:0,boxShadow:isH?"0 -6px 16px rgba(16,185,129,.3)":"none"}}/>
                <div className="flex-1 rounded-t-[4px] transition-all duration-200"
                  style={{height:`${lostH}%`,background:isH?"linear-gradient(180deg,#fca5a5,#ef4444)":"linear-gradient(180deg,#fecaca,#f87171)",minHeight:w.lostSAR>0?4:0,boxShadow:isH?"0 -6px 16px rgba(239,68,68,.2)":"none"}}/>
              </div>
              {i%3===0&&<span className="text-[8px] mt-1.5 whitespace-nowrap" style={{color: P.textMute}}>{w.weekLabel}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AI Chat Panel ─────────────────────────────────────────────────────────
interface Msg { role:"user"|"assistant"; content:string }
function AiPanel({ ctx }: { ctx:string }) {
  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [val,setVal]=useState("");
  const [busy,setBusy]=useState(false);
  const end=useRef<HTMLDivElement>(null);
  const QUICK=["أي صفقة أركّز عليها اليوم؟","ليش هذي الصفقات في خطر؟","كيف أحسّن نسبة الفوز؟","توقعك لنهاية الشهر؟"];

  async function send(text:string){
    const q=text.trim(); if(!q||busy) return;
    setVal("");
    const next:Msg[]=[...msgs,{role:"user",content:q}];
    setMsgs(next); setBusy(true);
    try{ const reply=await callAI(next,ctx); setMsgs([...next,{role:"assistant",content:reply}]); }
    catch{ setMsgs([...next,{role:"assistant",content:"تعذّر الاتصال."}]); }
    finally{ setBusy(false); }
  }
  useEffect(()=>{ end.current?.scrollIntoView({behavior:"smooth"}); },[msgs,busy]);

  return (
    <div className="flex flex-col h-full" style={{background:"linear-gradient(160deg,#011d16 0%,#022c22 50%,#064e3b 100%)"}}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",backgroundSize:"120px"}}/>
      <div className="absolute top-[-20px] right-[-20px] h-52 w-52 pointer-events-none"
        style={{background:"radial-gradient(circle,rgba(16,185,129,.15),transparent 70%)",animation:"ri-orb 8s ease-in-out infinite"}}/>
      <div className="absolute bottom-[80px] left-[-30px] h-40 w-40 pointer-events-none"
        style={{background:"radial-gradient(circle,rgba(5,150,105,.12),transparent 70%)",animation:"ri-orb2 10s ease-in-out infinite"}}/>

      <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.06] flex items-center gap-4">
        <div className="relative flex-none">
          <div className="h-12 w-12 rounded-[16px] flex items-center justify-center ri-shine-wrap"
            style={{background:"linear-gradient(135deg,#059669,#34d399)",boxShadow:"0 6px 20px rgba(16,185,129,.35)"}}>
            <svg viewBox="0 0 28 28" className="h-6 w-6">
              <rect x="4" y="7" width="20" height="15" rx="3.5" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="10" cy="13.5" fill="#6ee7b7"><animate attributeName="r" values="1.8;2.3;1.8" dur="2.4s" repeatCount="indefinite"/></circle>
              <circle cx="18" cy="13.5" fill="#6ee7b7"><animate attributeName="r" values="1.8;2.3;1.8" dur="2.4s" begin=".5s" repeatCount="indefinite"/></circle>
              <path d="M10 18.5h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="12.5" y="4" width="3" height="3.5" rx="1" fill="rgba(255,255,255,.5)"/>
            </svg>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-[2.5px]" style={{borderColor:"#011d16"}}>
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40"/>
          </span>
        </div>
        <div>
          <p className="text-[14px] font-bold text-white">محلل الإيرادات</p>
          <p className="text-[10px] text-white/25 mt-0.5">اسأله عن أي شيء في خط المبيعات</p>
        </div>
        <div className="mr-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 border"
          style={{background:"rgba(16,185,129,.08)",borderColor:"rgba(16,185,129,.15)"}}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>
          <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-wider">مباشر</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 py-5 space-y-3.5 min-h-0">
        {msgs.length===0&&(
          <div className="pt-3 space-y-2.5">
            <p className="text-[9px] text-white/15 text-center uppercase tracking-[0.25em] font-bold mb-5">أسئلة مقترحة</p>
            {QUICK.map(q=>(
              <button key={q} onClick={()=>send(q)}
                className="w-full text-right text-[12px] text-white/45 hover:text-white/80 border border-white/[0.06] hover:border-white/[0.15] rounded-[14px] px-5 py-3.5 transition-all duration-200 leading-relaxed hover:bg-white/[0.03]"
                style={{background:"rgba(255,255,255,0.02)"}}>{q}</button>
            ))}
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} className={`flex gap-3 ${m.role==="user"?"flex-row-reverse":""}`}>
            {m.role==="assistant"&&(
              <div className="h-8 w-8 rounded-xl flex-none flex items-center justify-center mt-0.5"
                style={{background:"linear-gradient(135deg,#059669,#34d399)",boxShadow:"0 3px 8px rgba(16,185,129,.25)"}}>
                <svg viewBox="0 0 18 18" className="h-3.5 w-3.5"><rect x="2" y="4" width="14" height="10" rx="2.5" fill="none" stroke="white" strokeWidth="1.4"/><circle cx="6.5" cy="8.5" r="1.3" fill="#6ee7b7"/><circle cx="11.5" cy="8.5" r="1.3" fill="#6ee7b7"/><path d="M6 12h6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </div>
            )}
            <div className={`max-w-[85%] px-5 py-3.5 text-[12.5px] leading-[1.8] whitespace-pre-wrap rounded-[18px] ${m.role==="user"?"text-white rounded-tl-[6px]":"text-white/75 rounded-tr-[6px] border border-white/[0.06]"}`}
              style={m.role==="user"?{background:"linear-gradient(135deg,#059669,#10b981)",boxShadow:"0 6px 20px rgba(16,185,129,.25)"}:{background:"rgba(255,255,255,0.04)"}}>
              {m.content}
            </div>
          </div>
        ))}
        {busy&&(
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-xl flex-none flex items-center justify-center mt-0.5" style={{background:"linear-gradient(135deg,#059669,#34d399)"}}>
              <svg viewBox="0 0 18 18" className="h-3.5 w-3.5"><rect x="2" y="4" width="14" height="10" rx="2.5" fill="none" stroke="white" strokeWidth="1.4"/><circle cx="6.5" cy="8.5" r="1.3" fill="#6ee7b7"/><circle cx="11.5" cy="8.5" r="1.3" fill="#6ee7b7"/></svg>
            </div>
            <div className="rounded-[18px] rounded-tr-[6px] px-5 py-3.5 flex items-center gap-2 border border-white/[0.06]" style={{background:"rgba(255,255,255,.03)"}}>
              {[0,1,2].map(i=><span key={i} className="h-2 w-2 rounded-full bg-emerald-400/60 animate-bounce" style={{animationDelay:`${i*.18}s`}}/>)}
            </div>
          </div>
        )}
        <div ref={end}/>
      </div>

      <div className="relative px-5 pb-5 pt-3 border-t border-white/[0.06]">
        <div className="flex items-end gap-2.5 rounded-[16px] px-4 py-3 border transition-all duration-200 focus-within:border-emerald-400/30"
          style={{background:"rgba(255,255,255,0.04)",borderColor:"rgba(255,255,255,0.07)"}}>
          <textarea value={val} onChange={e=>setVal(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(val);}}}
            placeholder="اسأل عن خط مبيعاتك…" rows={1} style={{maxHeight:72}}
            className="flex-1 bg-transparent text-[13px] text-white/70 placeholder-white/15 resize-none focus:outline-none leading-relaxed"/>
          <button onClick={()=>send(val)} disabled={!val.trim()||busy}
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-none transition-all disabled:opacity-15 hover:scale-105 active:scale-95"
            style={{background:"linear-gradient(135deg,#059669,#34d399)",boxShadow:"0 4px 12px rgba(16,185,129,.3)"}}>
            <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 -rotate-90"><path d="M10 16V4M4 10l6-6 6 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deal Modal ────────────────────────────────────────────────────────────
function DealModal({ deal,ctx,onClose }: { deal:RIDeal; ctx:string; onClose:()=>void }) {
  const [showCoach, setShowCoach] = useState(false);
  const cat=CAT[deal.category]??CAT.pipeline, risk=RISK[deal.riskLevel];
  const w=Math.round(deal.valueSAR*deal.probabilityPct/100);
  useEffect(()=>{
    function h(e:KeyboardEvent){ if(e.key==="Escape"&&!showCoach) onClose(); }
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  },[onClose,showCoach]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl"/>
        <div className="ri-in relative bg-white rounded-[24px] shadow-2xl w-full max-w-[440px] overflow-hidden" onClick={e=>e.stopPropagation()}
          style={{boxShadow:"0 25px 60px rgba(0,0,0,.15)"}}>
          <div className="h-1" style={{background: cat.gradient}}/>
          <div className="px-8 pt-7 pb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-2.5" style={{color: P.textMute}}>تفاصيل الصفقة</p>
              <h2 className="text-xl font-black leading-tight" style={{color: P.text}}>{deal.name}</h2>
              {deal.leadName&&<p className="text-sm mt-1" style={{color: P.textMute}}>{deal.leadName}</p>}
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-2xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition flex-none mt-1" style={{color: P.textSub}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="px-8 pb-5 flex flex-wrap gap-2">
            <span className="text-[11px] font-bold px-3.5 py-1.5 rounded-full text-white" style={{background: cat.gradient}}>{cat.label}</span>
            <span className="text-[11px] font-bold px-3.5 py-1.5 rounded-full border" style={{background: risk.pillBg, borderColor:`${risk.dot}20`}}>
              <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{background: risk.dot}}/> {risk.label}
            </span>
            <span className="text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-gray-50 border" style={{color: P.textSub, borderColor: P.borderLight}}>{deal.stage}</span>
          </div>
          <div className="mx-8 mb-6 grid grid-cols-3 gap-3">
            {[
              {label:"القيمة",     val:sarFull(deal.valueSAR), unit:"ر.س", gradient:"linear-gradient(135deg,#f9fafb,#f3f4f6)", border:"#e5e7eb", color: P.text},
              {label:"الاحتمالية",val:`${deal.probabilityPct}%`, unit:"",  gradient:"linear-gradient(135deg,#eff6ff,#dbeafe)", border:"#bfdbfe", color:"#1e40af"},
              {label:"المرجّحة",  val:sarFull(w),              unit:"ر.س", gradient:"linear-gradient(135deg,#ecfdf5,#d1fae5)", border:"#a7f3d0", color:"#065f46"},
            ].map(({label,val,unit,gradient,border,color})=>(
              <div key={label} className="rounded-[16px] p-4 text-center border" style={{background: gradient, borderColor:border}}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{color: P.textMute}}>{label}</p>
                <p className="text-[15px] font-black tabular-nums" style={{color}}>{val}</p>
                {unit&&<p className="text-[9px] mt-0.5" style={{color: P.textMute}}>{unit}</p>}
              </div>
            ))}
          </div>
          <div className="mx-8 mb-6 rounded-[16px] overflow-hidden border" style={{borderColor: P.borderLight}}>
            {[
              {label:"في المرحلة منذ",val:`${deal.daysInStage} يوم`,warn:deal.daysInStage>30},
              {label:"آخر تواصل",val:deal.daysSinceActivity!=null?`منذ ${deal.daysSinceActivity} يوم`:"لا يوجد",warn:(deal.daysSinceActivity??0)>14},
            ].map(({label,val,warn},idx)=>(
              <div key={label} className={`flex items-center justify-between px-5 py-3.5 bg-white ${idx>0?`border-t`:""}` } style={{borderColor: P.borderLight}}>
                <span className="text-[12px]" style={{color: P.textSub}}>{label}</span>
                <span className={`text-[12px] font-bold ${warn?"text-red-600":""}`} style={warn?{}:{color: P.text}}>{val}</span>
              </div>
            ))}
          </div>
          {deal.riskReasons.length>0&&(
            <div className="mx-8 mb-6 rounded-[16px] border p-5" style={{background:"linear-gradient(135deg,#fef2f2,#fee2e2)", borderColor:"#fecaca"}}>
              <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em] mb-3">إشارات الخطر</p>
              <div className="space-y-2.5">
                {deal.riskReasons.map(r=>(
                  <div key={r} className="flex items-start gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-none mt-1.5"/><p className="text-[12px] text-red-700 leading-snug">{r}</p></div>
                ))}
              </div>
            </div>
          )}
          <div className="px-8 pb-8 flex gap-3">
            <button onClick={()=>setShowCoach(true)}
              className="flex-1 ri-shine-wrap flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white text-[13px] font-bold transition-all hover:opacity-90 hover:-translate-y-0.5"
              style={{background:"linear-gradient(135deg,#059669,#34d399)",boxShadow:"0 8px 24px rgba(16,185,129,.3)"}}>
              <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M10 3l6 12H4z"/><path d="M10 8v3M10 13h.01"/>
              </svg>
              خطة إغلاق AI
            </button>
            <a href="/dashboard/deals"
              className="px-6 flex items-center justify-center rounded-2xl border text-[13px] font-semibold hover:bg-gray-50 transition-all"
              style={{color: P.textSub, borderColor: P.border}}>
              فتح
            </a>
          </div>
        </div>
      </div>
      {showCoach && <CoachModal deal={deal} ctx={ctx} onClose={()=>setShowCoach(false)}/>}
    </>
  );
}

// ── Deal Row ──────────────────────────────────────────────────────────────
function Row({ deal,onClick }: { deal:RIDeal; onClick:()=>void }) {
  const cat=CAT[deal.category]??CAT.pipeline, risk=RISK[deal.riskLevel];
  return (
    <tr onClick={onClick} className="group border-b hover:bg-emerald-50/30 cursor-pointer transition-colors duration-150" style={{borderColor: P.borderLight}}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex-none">
            <span className="h-2.5 w-2.5 rounded-full block" style={{backgroundColor:risk.dot}}/>
            {risk.dot==="#ef4444"&&<span className="absolute inset-0 rounded-full animate-ping opacity-35" style={{backgroundColor:risk.dot}}/>}
          </div>
          <div>
            <p className="text-[13px] font-semibold group-hover:text-emerald-700 transition-colors" style={{color: P.text}}>{deal.name}</p>
            {deal.leadName&&<p className="text-[11px] mt-0.5" style={{color: P.textMute}}>{deal.leadName}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 hidden sm:table-cell">
        <div className="flex items-center gap-2">
          {deal.stageColor&&<span className="h-2 w-2 rounded-full" style={{backgroundColor:deal.stageColor}}/>}
          <span className="text-[11px]" style={{color: P.textSub}}>{deal.stage}</span>
        </div>
      </td>
      <td className="px-4 py-4 hidden md:table-cell">
        <span className="text-[10px] font-bold px-3 py-1 rounded-full text-white" style={{background: cat.gradient}}>{cat.label}</span>
      </td>
      <td className="px-4 py-4 hidden lg:table-cell">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-16 rounded-full overflow-hidden" style={{background:"#f1f5f9"}}>
            <div className="h-full rounded-full" style={{width:`${deal.probabilityPct}%`, background: cat.gradient}}/>
          </div>
          <span className="text-[11px] font-bold w-8 tabular-nums" style={{color: P.textSub}}>{deal.probabilityPct}%</span>
        </div>
      </td>
      <td className="px-4 py-4 hidden xl:table-cell">
        {deal.daysSinceActivity!=null
          ?<span className={`text-[11px] font-semibold ${deal.daysSinceActivity>14?"text-red-500":""}`} style={deal.daysSinceActivity>14?{}:{color: P.textMute}}>{deal.daysSinceActivity} يوم</span>
          :<span className="text-[11px]" style={{color: P.borderLight}}>—</span>}
      </td>
      <td className="px-6 py-4 text-left">
        <p className="text-[14px] font-black tabular-nums" style={{color: P.text}}>{sarFull(deal.valueSAR)}</p>
        <p className="text-[9px] mt-0.5 uppercase tracking-wider" style={{color: P.textMute}}>ريال</p>
      </td>
    </tr>
  );
}

// ── Section Heading ───────────────────────────────────────────────────────
function SectionHead({ icon,title,sub,gradient }: { icon:React.ReactNode; title:string; sub:string; gradient:string }) {
  return (
    <div className="flex items-center gap-3.5 mb-7">
      <div className="h-11 w-11 rounded-[14px] flex items-center justify-center flex-none ri-shine-wrap"
        style={{background: gradient, boxShadow:`0 4px 12px rgba(0,0,0,.1)`}}>
        <span className="text-white">{icon}</span>
      </div>
      <div>
        <h3 className="text-[15px] font-bold" style={{color: P.text}}>{title}</h3>
        <p className="text-[10px] mt-0.5" style={{color: P.textMute}}>{sub}</p>
      </div>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────
function Card({ children, className="", delay=".1s", ...props }: { children:React.ReactNode; className?:string; delay?:string; style?:React.CSSProperties }) {
  return (
    <div className={`ri-up bg-white rounded-[20px] border p-7 ${className}`}
      style={{animationDelay: delay, borderColor: P.borderLight, boxShadow:"0 1px 3px rgba(0,0,0,.03), 0 8px 24px rgba(0,0,0,.04)", ...props.style}}>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
type FK="all"|DealCategory|"high_risk";

export default function RevenueIntelligencePage() {
  const [data,setData]       = useState<RevenueIntelligenceData|null>(null);
  const [loading,setLoading] = useState(true);
  const [sel,setSel]         = useState<RIDeal|null>(null);
  const [coachDeal,setCoachDeal] = useState<RIDeal|null>(null);
  const [filter,setFilter]   = useState<FK>("all");
  const [search,setSearch]   = useState("");
  const [ctx,setCtx]         = useState("");

  useEffect(()=>{
    buildRevenueIntelligence().then(d=>{ setData(d); setCtx(buildContext(d)); }).finally(()=>setLoading(false));
  },[]);

  if(loading) return (
    <div dir="rtl" className="ri-page-bg min-h-[72vh] flex flex-col items-center justify-center gap-7">
      <style>{GLOBAL_CSS}</style>
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border-[3px]" style={{borderColor:`${P.brand3}15`}}/>
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin" style={{borderTopColor: P.brand3}}/>
        <div className="absolute inset-3 rounded-full border-[2px] border-transparent animate-spin" style={{borderTopColor: P.accent, animationDirection:"reverse",animationDuration:".65s"}}/>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 rounded-full" style={{background:`linear-gradient(135deg,${P.brand3},${P.accent})`,boxShadow:`0 0 20px ${P.brand3}60`}}/>
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-[14px] font-semibold" style={{color: P.text}}>جارٍ تحليل بيانات المبيعات</p>
        <p className="text-[11px]" style={{color: P.textMute}}>نحسب الاحتماليات ومؤشرات الخطر…</p>
      </div>
    </div>
  );
  if(!data) return <div dir="rtl" className="py-20 text-center text-sm" style={{color: P.textMute}}>تعذّر تحميل البيانات</div>;

  const atRisk=data.deals.filter(d=>d.riskLevel==="high");
  const wonSpark=data.weeklyHistory.slice(-8).map(w=>w.wonSAR);

  const filtered=data.deals.filter(d=>{
    if(filter==="high_risk"&&d.riskLevel!=="high") return false;
    if(filter!=="all"&&filter!=="high_risk"&&d.category!==filter) return false;
    if(search){ const q=search.toLowerCase(); return d.name.toLowerCase().includes(q)||(d.leadName??"").toLowerCase().includes(q); }
    return true;
  });

  const FILTERS:{key:FK;label:string;count?:number}[]=[
    {key:"all",      label:"الكل",        count:data.deals.length},
    {key:"high_risk",label:"خطر عالٍ",   count:data.atRiskCount},
    {key:"commit",   label:"شبه مؤكدة"},
    {key:"best_case",label:"محتملة"},
    {key:"pipeline", label:"قيد المتابعة"},
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div dir="rtl" className="ri-page-bg flex flex-col gap-7 pb-16 px-1">

        {/* ── HERO ────────────────────────────────────────────────── */}
        <div className="ri-up relative overflow-hidden rounded-[24px] text-white"
          style={{background:"linear-gradient(148deg,#011d16 0%,#022c22 25%,#064e3b 55%,#059669 100%)",minHeight:220}}>
          <div className="absolute top-[-30px] right-[-20px] h-80 w-80 pointer-events-none" style={{background:"radial-gradient(circle,rgba(16,185,129,.18),transparent 65%)",animation:"ri-orb 8s ease-in-out infinite"}}/>
          <div className="absolute bottom-[-50px] left-[20%] h-64 w-64 pointer-events-none" style={{background:"radial-gradient(circle,rgba(52,211,153,.12),transparent 60%)",animation:"ri-orb2 10s ease-in-out infinite"}}/>
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{backgroundImage:"linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",backgroundSize:"52px 52px"}}/>

          <div className="relative px-9 py-11">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-9">
              <div className="ri-up" style={{animationDelay:".05s"}}>
                <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 mb-6 border"
                  style={{background:"rgba(255,255,255,.06)",borderColor:"rgba(255,255,255,.1)",backdropFilter:"blur(8px)"}}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-50"/>
                    <span className="relative rounded-full h-2 w-2 bg-emerald-400"/>
                  </span>
                  <span className="text-[10px] font-semibold text-white/45 tracking-[0.2em] uppercase">لوحة مبيعات مباشرة</span>
                </div>
                <h1 className="text-[48px] lg:text-[56px] font-black leading-[.9] tracking-tight"
                  style={{background:"linear-gradient(135deg,#ffffff 20%,rgba(255,255,255,.55) 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  ذكاء الإيرادات
                </h1>
                <p className="text-white/22 text-[11px] mt-5 font-medium">
                  {new Date(data.asOf).toLocaleString("ar-SA",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                </p>
              </div>
              <div className="flex flex-wrap gap-3.5 ri-up" style={{animationDelay:".12s"}}>
                {[
                  {label:"خط المبيعات",    val:sarK(data.totalPipelineSAR),    sub:`${data.deals.length} صفقة نشطة`, hi:true},
                  {label:"الإيراد المرجّح",val:sarK(data.weightedPipelineSAR), sub:"بعد تطبيق الاحتماليات",         hi:false},
                  {label:"مُغلق الشهر",   val:sarK(data.wonThisMonthSAR),     sub:`${data.wonThisMonthCount} صفقة`, hi:false},
                ].map(({label,val,sub,hi})=>(
                  <div key={label} className="ri-lift rounded-[18px] px-6 py-5 min-w-[155px] backdrop-blur-md border ri-shine-wrap"
                    style={{background:hi?"rgba(255,255,255,.12)":"rgba(255,255,255,.06)",borderColor:hi?"rgba(255,255,255,.2)":"rgba(255,255,255,.08)",boxShadow:hi?"inset 0 1px 0 rgba(255,255,255,.12), 0 8px 24px rgba(0,0,0,.15)":"0 4px 12px rgba(0,0,0,.1)"}}>
                    <p className="text-[10px] text-white/35 mb-2.5 font-semibold">{label}</p>
                    <p className="text-[24px] font-black text-white leading-none tabular-nums">{val} <span className="text-[11px] font-medium text-white/35">ر.س</span></p>
                    <p className="text-[10px] text-white/20 mt-2.5">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Health + KPIs Bento Row ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <HealthCard data={data} ctx={ctx}/>
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-5">
            <KpiCard label="نسبة الفوز" note={`${data.wonThisMonthCount} ربح · ${data.lostThisMonthCount} خسارة`}
              value={data.winRateThisMonth} fmt={n=>`${n}%`}
              accent="#059669" gradient="linear-gradient(135deg,#059669,#34d399)"
              ring={{pct:data.winRateThisMonth}}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="8" r="6"/><path d="m9 11 3 3 3-3M12 22v-6"/></svg>}/>
            <KpiCard label="متوسط الصفقة" note="للصفقات النشطة"
              value={data.avgDealSAR} unit="ر.س"
              accent={P.blue} gradient="linear-gradient(135deg,#2563eb,#60a5fa)"
              spark={wonSpark}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}/>
            <KpiCard label="في خطر عالٍ" note="تحتاج تدخل فوري"
              value={data.atRiskCount} fmt={n=>`${n}`} unit="صفقة"
              accent={P.red} gradient="linear-gradient(135deg,#dc2626,#f87171)"
              spark={data.weeklyHistory.slice(-8).map((_,i)=>Math.max(0,data.atRiskCount-i%2))}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}/>
          </div>
        </div>

        {/* ── Main Grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card delay=".1s">
                <SectionHead gradient="linear-gradient(135deg,#064e3b,#10b981)"
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg>}
                  title="توقعات الإيرادات" sub="3 سيناريوهات لنهاية الشهر"/>
                <ForecastBars scenarios={data.forecast}/>
                <div className="mt-6 rounded-[14px] px-5 py-3.5 border flex items-center gap-2.5" style={{background:"linear-gradient(135deg,#ecfdf5,#d1fae5)", borderColor:"#a7f3d0"}}>
                  <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-none" style={{background:"linear-gradient(135deg,#059669,#34d399)"}}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="h-3 w-3"><path d="M3 8l3 3 7-7"/></svg>
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-800">يشمل <strong>{sarFull(data.wonThisMonthSAR)} ر.س</strong> مُغلق بالفعل هذا الشهر</p>
                </div>
              </Card>
              <Card delay=".16s">
                <SectionHead gradient="linear-gradient(135deg,#1e40af,#3b82f6)"
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>}
                  title="توزيع خط المبيعات" sub="حسب احتمالية الإغلاق"/>
                <DistPills categories={data.categories}/>
              </Card>
            </div>
            <Card delay=".22s">
              <div className="flex items-center justify-between mb-7">
                <SectionHead gradient="linear-gradient(135deg,#92400e,#d97706)"
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>}
                  title="الأداء الأسبوعي" sub="آخر 12 أسبوع"/>
                <div className="text-left mr-4">
                  <p className="text-[9px] uppercase tracking-wider mb-1" style={{color: P.textMute}}>مُغلق الشهر</p>
                  <p className="text-[16px] font-black tabular-nums" style={{background:"linear-gradient(135deg,#059669,#34d399)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>{sarK(data.wonThisMonthSAR)} ر.س</p>
                </div>
              </div>
              <WeeklyChart data={data.weeklyHistory}/>
            </Card>
          </div>
          <div className="xl:col-span-1">
            <div className="relative rounded-[20px] overflow-hidden sticky top-20"
              style={{height:650,boxShadow:"0 25px 60px rgba(0,0,0,.2), 0 0 0 1px rgba(0,0,0,.06)"}}>
              <AiPanel ctx={ctx}/>
            </div>
          </div>
        </div>

        {/* ── At Risk ────────────────────────────────────────────── */}
        {atRisk.length>0&&(
          <div className="ri-up" style={{animationDelay:".28s"}}>
            <div className="flex items-center gap-5 mb-6">
              <div className="h-px flex-1 rounded-full" style={{background:"linear-gradient(90deg,transparent,#fecaca)"}}/>
              <div className="flex items-center gap-3 rounded-full px-6 py-3 border"
                style={{background:"linear-gradient(135deg,#fff5f5,#fef2f2)", borderColor:"#fecaca", boxShadow:"0 4px 16px rgba(239,68,68,.08)"}}>
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-45"/>
                  <span className="relative rounded-full h-3 w-3 bg-red-500"/>
                </div>
                <span className="text-[13px] font-bold text-red-700">{atRisk.length} صفقة تحتاج تدخلاً فورياً</span>
                <span className="text-[12px] font-bold text-red-500 tabular-nums">{sarFull(data.atRiskSAR)} ر.س</span>
              </div>
              <div className="h-px flex-1 rounded-full" style={{background:"linear-gradient(90deg,#fecaca,transparent)"}}/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {atRisk.slice(0,6).map(deal=>{
                const w=Math.round(deal.valueSAR*deal.probabilityPct/100);
                return (
                  <div key={deal.id} className="ri-lift group bg-white rounded-[20px] border overflow-hidden"
                    style={{borderColor:"#fecaca", boxShadow:"0 1px 3px rgba(239,68,68,.05)"}}>
                    <button className="w-full text-right p-6 space-y-4" onClick={()=>setSel(deal)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold truncate group-hover:text-red-700 transition-colors" style={{color: P.text}}>{deal.name}</p>
                          {deal.leadName&&<p className="text-[11px] mt-1 truncate" style={{color: P.textMute}}>{deal.leadName}</p>}
                        </div>
                        <div className="relative flex-none mt-0.5">
                          <span className="h-3 w-3 rounded-full bg-red-500 block"/>
                          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30"/>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {deal.riskReasons.map(r=>(
                          <div key={r} className="flex items-start gap-2 flex-row-reverse">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-300 flex-none mt-1.5"/>
                            <span className="text-[11px] text-red-600 leading-snug">{r}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-2">
                          <span className="font-bold text-red-600">{deal.probabilityPct}%</span>
                          <span style={{color: P.textMute}}>الاحتمالية</span>
                        </div>
                        <div className="h-2 w-full rounded-full overflow-hidden" style={{background:"#fee2e2"}}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{width:`${Math.max(5,deal.probabilityPct)}%`,background:"linear-gradient(90deg,#fca5a5,#ef4444)"}}/>
                        </div>
                      </div>
                      <div className="flex items-end justify-between pt-4 border-t" style={{borderColor:"#fee2e2"}}>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider" style={{color: P.textMute}}>المرجّحة</p>
                          <p className="text-[14px] font-black tabular-nums" style={{color: P.brand2}}>{sarFull(w)}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-[9px] uppercase tracking-wider" style={{color: P.textMute}}>القيمة الكاملة</p>
                          <p className="text-[14px] font-bold tabular-nums" style={{color: P.text}}>{sarFull(deal.valueSAR)}</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={()=>setCoachDeal(deal)}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 text-[12px] font-bold border-t transition-all hover:opacity-90 ri-shine-wrap"
                      style={{background:"linear-gradient(135deg,#059669,#10b981)", borderColor:"#fecaca", color:"white"}}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <path d="M8 2l5 10H3z"/><path d="M8 6v2.5M8 10.5h.01"/>
                      </svg>
                      احصل على خطة إغلاق AI
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Deals Table ────────────────────────────────────────── */}
        <div className="ri-up bg-white rounded-[20px] border overflow-hidden" style={{animationDelay:".34s", borderColor: P.borderLight, boxShadow:"0 1px 3px rgba(0,0,0,.03), 0 8px 24px rgba(0,0,0,.04)"}}>
          <div className="px-7 py-6 border-b" style={{borderColor: P.borderLight}}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-[16px] font-bold" style={{color: P.text}}>جميع الصفقات النشطة</h2>
                <p className="text-[11px] mt-1" style={{color: P.textMute}}>انقر لعرض التفاصيل أو طلب خطة إغلاق من AI</p>
              </div>
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                  className="h-4 w-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{color: P.textMute}}>
                  <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
                </svg>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="بحث عن صفقة أو عميل…"
                  className="rounded-[14px] pr-11 pl-5 py-2.5 text-[12px] w-56 border bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 transition"
                  style={{borderColor: P.border, outlineColor: P.brand3}}/>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 mb-5">
              {FILTERS.map(({key,label,count})=>{
                const active=filter===key, isRisk=key==="high_risk";
                return (
                  <button key={key} onClick={()=>setFilter(key)}
                    className="px-4 py-2 rounded-full text-[11px] font-bold border transition-all"
                    style={{background:active?(isRisk?"linear-gradient(135deg,#dc2626,#f87171)":"linear-gradient(135deg,#059669,#10b981)"):"white",
                      color:active?"white":P.textSub, borderColor:active?"transparent":P.border,
                      boxShadow:active?(isRisk?"0 4px 14px rgba(239,68,68,.25)":"0 4px 14px rgba(16,185,129,.25)"):"none"}}>
                    {label}{count!==undefined&&<span className="mr-1.5 opacity-60">({count})</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-5">
              {Object.entries(RISK).map(([,r])=>(
                <div key={r.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:r.dot}}/>
                  <span className="text-[10px] font-medium" style={{color: P.textMute}}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{background:"#fafbfc", borderColor: P.borderLight}}>
                  {[{t:"الصفقة",c:"px-6 py-3.5 text-right"},{t:"المرحلة",c:"px-4 py-3.5 text-right hidden sm:table-cell"},{t:"التصنيف",c:"px-4 py-3.5 text-right hidden md:table-cell"},{t:"الاحتمالية",c:"px-4 py-3.5 text-right hidden lg:table-cell"},{t:"آخر تواصل",c:"px-4 py-3.5 text-right hidden xl:table-cell"},{t:"القيمة",c:"px-6 py-3.5 text-left"}].map(h=>(
                    <th key={h.t} className={`${h.c} text-[9px] font-black uppercase tracking-[0.2em]`} style={{color: P.textMute}}>{h.t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0
                  ?<tr><td colSpan={6} className="py-20 text-center text-sm" style={{color: P.textMute}}>لا توجد صفقات مطابقة</td></tr>
                  :filtered.map(d=><Row key={d.id} deal={d} onClick={()=>setSel(d)}/>)}
              </tbody>
            </table>
          </div>
          {filtered.length>0&&(
            <div className="px-7 py-5 border-t flex flex-wrap items-center justify-between gap-3" style={{background:"#fafbfc", borderColor: P.borderLight}}>
              <p className="text-[11px]" style={{color: P.textMute}}>
                <strong style={{color: P.text}}>{filtered.length}</strong> صفقة · إجمالي: <strong className="tabular-nums" style={{color: P.text}}>{sarFull(filtered.reduce((s,d)=>s+d.valueSAR,0))} ر.س</strong>
              </p>
              <p className="text-[11px]" style={{color: P.textMute}}>
                مرجّح: <strong className="font-bold tabular-nums" style={{background:"linear-gradient(135deg,#059669,#34d399)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>{sarFull(filtered.reduce((s,d)=>s+Math.round(d.valueSAR*d.probabilityPct/100),0))} ر.س</strong>
              </p>
            </div>
          )}
        </div>

        {sel    && <DealModal deal={sel}       ctx={ctx} onClose={()=>setSel(null)}/>}
        {coachDeal && <CoachModal deal={coachDeal} ctx={ctx} onClose={()=>setCoachDeal(null)}/>}
      </div>
    </>
  );
}
