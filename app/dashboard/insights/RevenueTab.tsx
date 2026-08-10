"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildRevenueIntelligence,
  type RevenueIntelligenceData,
  type RIDeal,
  type DealCategory,
} from "@/lib/revenueIntelligence/buildRevenueIntelligence";
import { supabase } from "@/lib/supabase";
import { ChartUpIcon, CheckIcon, ScaleIcon, XIcon } from "@/components/icons";

/* ═══ Global CSS ══════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@keyframes ri-up    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
@keyframes ri-in    { from{opacity:0;transform:scale(.97)}       to{opacity:1;transform:none} }
@keyframes ri-shine { from{transform:translateX(-100%) skewX(-18deg)} to{transform:translateX(300%) skewX(-18deg)} }
@keyframes ri-orb   { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,-14px) scale(1.1)} }
@keyframes ri-orb2  { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-12px,16px) scale(.92)} }
@keyframes ri-scan  { from{transform:translateY(-100%)} to{transform:translateY(400%)} }
@keyframes ri-spin  { to{transform:rotate(360deg)} }
@keyframes ri-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
.ri-up  { animation:ri-up .55s cubic-bezier(.22,1,.36,1) both }
.ri-in  { animation:ri-in .4s  cubic-bezier(.22,1,.36,1) both }
.ri-card{ animation:ri-up .5s  cubic-bezier(.22,1,.36,1) both }
.ri-card:nth-child(1){animation-delay:.04s}
.ri-card:nth-child(2){animation-delay:.09s}
.ri-card:nth-child(3){animation-delay:.14s}
.ri-card:nth-child(4){animation-delay:.19s}
.ri-shine-wrap{overflow:hidden;position:relative}
.ri-lift{transition:box-shadow .2s ease,transform .2s ease,border-color .2s ease}
.ri-lift:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(26,92,79,.1)!important}
.ri-grid-bg{background-image:linear-gradient(rgba(26,92,79,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(26,92,79,.03) 1px,transparent 1px);background-size:32px 32px}
.ri-dot-bg{background:none}
`;

/* ═══ Formatters ══════════════════════════════════════════════════════════ */
const sarK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} مليون` :
  n >= 1_000     ? `${(n / 1_000).toFixed(0)} ألف` : `${n}`;
const sarFull = (n: number) => n.toLocaleString("ar-SA");

/* ═══ Design Tokens ═══════════════════════════════════════════════════════ */
const C = {
  // Emerald primary
  e1:"var(--status-success-fg)", e2:"var(--status-success-fg)", e3:"var(--status-success-fg)", e4:"var(--status-success-fg)", e5:"var(--brand-green-500)", e6:"var(--brand-green-500)", e7:"var(--status-success-on-inverse)",
  // Indigo secondary
  i1:"var(--status-info-fg)", i2:"var(--status-info-fg)", i3:"var(--status-info-fg)", i4:"var(--brand-indigo-500)", i5:"var(--brand-indigo-500)", i6:"var(--status-info-border)",
  // Amber warm
  a1:"var(--status-warning-fg)", a2:"var(--status-warning-fg)", a3:"var(--status-warning-fg)", a4:"var(--status-warning-fg)", a5:"var(--brand-amber-500)", a6:"var(--brand-amber-500)",
  // Rose danger
  r1:"var(--status-danger-fg)", r2:"var(--status-danger-fg)", r3:"var(--status-danger-fg)", r4:"var(--status-danger-fg)", r5:"var(--brand-red-500)", r6:"var(--brand-red-500)",
  // Neutral
  tx:"var(--content-primary)", tx2:"var(--content-secondary)", tx3:"var(--content-tertiary)", tx4:"var(--border-strong)",
  bg:"var(--surface-raised)", bg2:"var(--surface-sunken)", bg3:"var(--surface-accent-subtle)",
  border:"var(--border-subtle)", borderL:"var(--border-subtle)", borderD:"var(--brand-teal-200)",
};

const CAT: Record<string,{label:string;sub:string;hex:string;bg:string;ring:string;grad:string}> = {
  commit:   {label:"شبه مؤكدة",   sub:"احتمالية +80%",      hex:C.e3, bg:"var(--status-success-bg)", ring:"var(--status-success-on-inverse)", grad:"linear-gradient(135deg,var(--status-success-fg),var(--brand-green-500))"},
  best_case:{label:"محتملة",       sub:"احتمالية 30–80%",    hex:C.i3, bg:"var(--status-info-bg)", ring:"var(--status-info-border)", grad:"linear-gradient(135deg,var(--status-info-fg),var(--brand-indigo-500))"},
  pipeline: {label:"قيد المتابعة",sub:"احتمالية أقل من 30%",hex:C.a2, bg:"var(--status-warning-bg)", ring:"var(--status-warning-on-inverse)", grad:"linear-gradient(135deg,var(--status-warning-fg),var(--brand-amber-500))"},
};
const RISK: Record<string,{label:string;dot:string;bg:string}> = {
  high:  {label:"خطر عالٍ", dot:C.r5, bg:"var(--status-danger-bg)"},
  medium:{label:"متوسط",    dot:C.a5, bg:"var(--status-warning-bg)"},
  low:   {label:"مستقرة",   dot:C.e5, bg:"var(--status-success-bg)"},
};

/* ═══ Health score ════════════════════════════════════════════════════════ */
function calcHealth(d: RevenueIntelligenceData) {
  if(!d.deals.length) return {score:0,label:"لا بيانات",color:C.tx3,grad:"linear-gradient(135deg,var(--content-tertiary),var(--border-strong))"};
  const w = d.winRateThisMonth;
  const r = Math.max(0, 100 - (d.atRiskCount / d.deals.length) * 200);
  const q = d.totalPipelineSAR > 0 ? (d.weightedPipelineSAR / d.totalPipelineSAR) * 100 : 50;
  const s = Math.min(100, Math.max(0, Math.round(w*.35 + r*.4 + q*.25)));
  if(s>=75) return {score:s,label:"ممتاز",  color:C.e4, grad:"linear-gradient(135deg,var(--status-success-fg),var(--brand-green-500))"};
  if(s>=50) return {score:s,label:"جيد",    color:C.i4, grad:"linear-gradient(135deg,var(--status-info-fg),var(--brand-indigo-500))"};
  if(s>=30) return {score:s,label:"متوسط",  color:C.a4, grad:"linear-gradient(135deg,var(--status-warning-fg),var(--brand-amber-500))"};
  return          {score:s,label:"يحتاج عناية",color:C.r4, grad:"linear-gradient(135deg,var(--status-danger-fg),var(--brand-red-500))"};
}

/* ═══ AI helpers ══════════════════════════════════════════════════════════ */
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
    "","الصفقات في خطر:",
    ...d.deals.filter(x=>x.riskLevel==="high").map(x=>`- ${x.name}${x.leadName?` (${x.leadName})`:""}: ${sarFull(x.valueSAR)} ريال | ${x.probabilityPct}% | ${x.riskReasons.join("،")}`),
    "","أكبر 8 صفقات:",
    ...d.deals.slice(0,8).map(x=>`- ${x.name}: ${sarFull(x.valueSAR)} ريال | ${x.probabilityPct}% | ${CAT[x.category]?.label}`),
  ].join("\n");
}

async function callAI(messages:{role:"user"|"assistant";content:string}[], context:string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/revenue-intelligence-ai",{
    method:"POST",
    headers:{"Content-Type":"application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})},
    body:JSON.stringify({messages,context}),
  });
  const j = await r.json();
  return j.reply ?? "تعذّر الاتصال.";
}

/* ═══ Animated Number ═════════════════════════════════════════════════════ */
function AnimNum({value,fmt}:{value:number;fmt:(n:number)=>string}) {
  const [v,setV]=useState(0);
  useEffect(()=>{
    let s:number|null=null; const dur=800;
    function f(ts:number){if(!s)s=ts;const p=Math.min((ts-s)/dur,1);setV(Math.round((1-Math.pow(1-p,3))*value));if(p<1)requestAnimationFrame(f);}
    requestAnimationFrame(f);
  },[value]);
  return <>{fmt(v)}</>;
}

/* ═══ Ring ════════════════════════════════════════════════════════════════ */
function Ring({pct,color,size=52,sw=6}:{pct:number;color:string;size?:number;sw?:number}) {
  const r=(size-sw-2)/2, circ=2*Math.PI*r, dash=(pct/100)*circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}15`} strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 1s cubic-bezier(.4,0,.2,1) .2s"}}/>
    </svg>
  );
}

/* ═══ Sparkline ═══════════════════════════════════════════════════════════ */
function Spark({vals,color}:{vals:number[];color:string}) {
  if(vals.length<2) return null;
  const max=Math.max(...vals,1), W=88, H=32, p=3;
  const xs=vals.map((_,i)=>p+(i/(vals.length-1))*(W-2*p));
  const ys=vals.map(v=>H-p-(v/max)*(H-2*p));
  const line=xs.map((x,i)=>`${i===0?"M":"L"}${x},${ys[i]}`).join(" ");
  const area=`${line} L${xs[xs.length-1]},${H-p} L${xs[0]},${H-p} Z`;
  const id=`sp${color.replace("#","")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[88px] h-8" preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".28"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={area} fill={`url(#${id})`}/>
      <path d={line} stroke={color} strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="2.5" fill={color} stroke="white" strokeWidth="1.5"/>
    </svg>
  );
}

/* ═══ Health Card ═════════════════════════════════════════════════════════ */
function HealthCard({data,ctx}:{data:RevenueIntelligenceData;ctx:string}) {
  const h = calcHealth(data);
  const [insight,setInsight]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false);

  const SIZE=96, R=38, SW=9, circ=2*Math.PI*R, dash=(h.score/100)*circ;

  async function explain(){
    if(insight){setOpen(true);return;} setOpen(true);setLoading(true);
    try{
      const reply=await callAI([{role:"user",content:`نبضة خط المبيعات لديك ${h.score}/100 (${h.label}). اشرح لي في 3 جمل قصيرة: لماذا هذا السكور؟ وما أهم شيء يجب فعله لرفعه؟ كن محدداً وعملياً.`}],ctx);
      setInsight(reply);
    }finally{setLoading(false);}
  }

  return (
    <div className="ri-card h-full flex flex-col" style={{animationDelay:".04s"}}>
      <div className="relative rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] ri-lift cursor-pointer group flex-1 flex flex-col e-1"
        onClick={explain}>
        <div className="relative p-5 flex flex-col flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-[var(--radius-sm)] flex items-center justify-center" style={{backgroundColor:`${h.color}17`,color:h.color}}>
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h3l2-5 2 10 2-5h3"/></svg>
              </div>
              <div>
                <p className="t-micro font-black uppercase tracking-[.16em]" style={{color:C.tx3}}>نبضة الخط</p>
                <p className="t-micro font-bold" style={{color:h.color}}>{h.label}</p>
              </div>
            </div>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke={C.tx3} strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
          </div>

          {/* Gauge + Value */}
          <div className="flex-1 flex flex-col items-center justify-center py-3">
            <div className="relative">
              <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
                <defs>
                  <linearGradient id={`hg${h.score}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={h.color}/>
                    <stop offset="100%" stopColor={h.color} stopOpacity=".55"/>
                  </linearGradient>
                </defs>
                <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={`${h.color}12`} strokeWidth={SW}/>
                <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={`url(#hg${h.score})`} strokeWidth={SW}
                  strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                  style={{transition:"stroke-dasharray 1.3s cubic-bezier(.4,0,.2,1) .2s",filter:`drop-shadow(0 2px 6px ${h.color}40)`}}/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="t-figure-md font-black tabular-nums leading-none" style={{color:h.color}}>
                  <AnimNum value={h.score} fmt={n=>`${n}`}/>
                </span>
                <span className="t-micro font-bold mt-0.5" style={{color:C.tx3}}>/ 100</span>
              </div>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-1.5 pt-3 mt-2 border-t" style={{borderColor:C.borderL}}>
            {[
              {v:`${data.winRateThisMonth}%`, l:"فوز", c:C.e4},
              {v:`${Math.max(0,data.deals.length-data.atRiskCount)}`, l:"آمنة", c:C.i4},
              {v:`${data.totalPipelineSAR>0?Math.round((data.weightedPipelineSAR/data.totalPipelineSAR)*100):0}%`, l:"كثافة", c:C.a4},
            ].map(m=>(
              <div key={m.l} className="text-center py-1.5 rounded-[var(--radius-sm)]" style={{background:`${m.c}0a`}}>
                <p className="t-body-sm font-black tabular-nums leading-none" style={{color:m.c}}>{m.v}</p>
                <p className="t-micro mt-1" style={{color:C.tx3}}>{m.l}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-sm)] border border-dashed group-hover:border-solid transition-all t-micro font-bold"
            style={{borderColor:`${h.color}30`,color:h.color}}>
            <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 5v2.5M7 9.5h.01"/></svg>فسّر لي بالذكاء الاصطناعي</div>
        </div>
      </div>

      {/* AI panel */}
      {open&&(
        <div className="ri-in mt-2.5 rounded-[var(--radius-lg)] border overflow-hidden" style={{background:"linear-gradient(145deg,var(--surface-inverse-deep),var(--surface-inverse))",borderColor:`${h.color}20`,boxShadow:"0 12px 28px rgba(0,0,0,.18)"}}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-[var(--radius-xs)] flex items-center justify-center" style={{background:h.grad}}>
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5"><circle cx="6" cy="4.5" r="1.8" fill="none" stroke="white" strokeWidth="1"/><circle cx="3.5" cy="7.5" r="1.2" fill="none" stroke="white" strokeWidth="1"/><circle cx="8.5" cy="7.5" r="1.2" fill="none" stroke="white" strokeWidth="1"/></svg>
              </div>
              <span className="t-micro font-bold text-white/85">تحليل النبضة</span>
              <span className="t-micro font-black text-[color-mix(in_srgb,var(--brand-green-500)_70%,transparent)] bg-[color-mix(in_srgb,var(--brand-green-500)_10%,transparent)] px-1.5 py-0.5 rounded">AI</span>
            </div>
            <button onClick={e=>{e.stopPropagation();setOpen(false);}} className="text-white/25 hover:text-white/60 transition text-xs"><XIcon className="h-4 w-4" /></button>
          </div>
          <div className="px-4 py-3.5 t-caption text-white/70 leading-[1.8] min-h-[52px]">
            {loading?(
              <div className="flex items-center gap-2 text-white/30">
                {[0,1,2].map(i=><span key={i} className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--brand-green-500)_50%,transparent)] "/>)}
                <span className="t-micro">يحلل…</span>
              </div>
            ):insight}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Coach Modal ═════════════════════════════════════════════════════════ */
interface CoachStep {num:number;title:string;body:string}
function parseSteps(text:string):CoachStep[]{
  const steps:CoachStep[]=[];
  for(const p of text.split(/(?=الخطوة\s*\d)/)){
    const m=p.match(/الخطوة\s*(\d)[:\s]+([^\n]+)\n?([\s\S]*)/);
    if(m) steps.push({num:parseInt(m[1]),title:m[2].trim(),body:m[3].trim()});
  }
  if(!steps.length&&text.trim()) steps.push({num:1,title:"خطة العمل",body:text.trim()});
  return steps;
}

function CoachModal({deal,ctx,onClose}:{deal:RIDeal;ctx:string;onClose:()=>void}) {
  const [steps,setSteps]=useState<CoachStep[]>([]);
  const [loading,setLoading]=useState(true);
  const [done,setDone]=useState(false);
  const cat=CAT[deal.category]??CAT.pipeline, risk=RISK[deal.riskLevel];

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose]);

  useEffect(()=>{
    const prompt=`أنت مدرب مبيعات خبير. لديك هذه الصفقة:
- الاسم: ${deal.name}${deal.leadName?` | العميل: ${deal.leadName}`:""}
- القيمة: ${sarFull(deal.valueSAR)} ريال
- الاحتمالية: ${deal.probabilityPct}%
- المرحلة: ${deal.stage}
- في المرحلة منذ: ${deal.daysInStage} يوم
- آخر تواصل: ${deal.daysSinceActivity!=null?`منذ ${deal.daysSinceActivity} يوم`:"لا يوجد تواصل"}
- إشارات الخطر: ${deal.riskReasons.length?deal.riskReasons.join("،"):"لا توجد"}

اكتب لي خطة عمل عملية من 3 خطوات لإغلاق هذه الصفقة هذا الأسبوع.
استخدم هذا التنسيق بالضبط:
الخطوة 1: [عنوان قصير]
[شرح 2-3 جمل]

الخطوة 2: [عنوان قصير]
[شرح 2-3 جمل]

الخطوة 3: [عنوان قصير]
[شرح 2-3 جمل]`;
    callAI([{role:"user",content:prompt}],ctx)
      .then(r=>{setSteps(parseSteps(r));setDone(true);})
      .catch(()=>{setSteps([{num:1,title:"خطأ",body:"تعذّر الاتصال."}]);setDone(true);})
      .finally(()=>setLoading(false));
  },[deal,ctx]);

  const stepC=[C.e4,C.i4,C.a4];
  const stepG=[
    "linear-gradient(135deg,var(--status-success-fg),var(--brand-green-500))",
    "linear-gradient(135deg,var(--status-info-fg),var(--brand-indigo-500))",
    "linear-gradient(135deg,var(--status-warning-fg),var(--brand-amber-500))",
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface-inverse-deep)_60%,transparent)] backdrop-blur-2xl"/>
      <div className="ri-in relative w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)]" onClick={e=>e.stopPropagation()}
        style={{background:"var(--surface-inverse)",border:"1px solid rgba(255,255,255,.08)",boxShadow:"0 32px 80px rgba(0,0,0,.4)"}}>
        <div className="absolute top-[-40px] right-[-20px] h-48 w-48 pointer-events-none" style={{background:"radial-gradient(circle,rgba(16,185,129,.18),transparent 70%)"}}/>
        <div className="absolute bottom-[-30px] left-[-20px] h-40 w-40 pointer-events-none" style={{background:"radial-gradient(circle,rgba(52,211,153,.1),transparent 70%)"}}/>

        {/* header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-7 w-7 rounded-[var(--radius-sm)] flex items-center justify-center ri-shine-wrap" style={{background:"linear-gradient(135deg,var(--status-success-fg),var(--brand-green-500))",boxShadow:"0 4px 12px rgba(16,185,129,.3)"}}>
                  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2l5 9H2z"/><path d="M7 6v2M7 10h.01"/></svg>
                </div>
                <span className="t-micro font-black text-white/30 uppercase tracking-[.18em]">مدرب الصفقات</span>
                <span className="t-micro font-black text-[color-mix(in_srgb,var(--brand-green-500)_70%,transparent)] bg-[color-mix(in_srgb,var(--brand-green-500)_10%,transparent)] px-1.5 py-0.5 rounded">AI</span>
              </div>
              <h2 className="t-title-3 font-black text-white leading-snug">{deal.name}</h2>
              {deal.leadName&&<p className="t-micro text-white/30 mt-0.5">{deal.leadName}</p>}
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-[var(--radius-sm)] flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition flex-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {[
              {t:sarFull(deal.valueSAR)+"ر.س",bg:"rgba(52,211,153,.15)",c:"var(--brand-green-500)"},
              {t:`${deal.probabilityPct}% احتمالية`,bg:`${cat.hex}22`,c:cat.ring},
              {t:risk.label,bg:`${risk.dot}18`,c:risk.dot},
            ].map(b=>(
              <span key={b.t} className="t-micro font-bold px-2.5 py-1 rounded-[var(--radius-xs)]" style={{background:b.bg,color:b.c}}>{b.t}</span>
            ))}
          </div>
        </div>

        {/* steps */}
        <div className="relative px-6 py-5 space-y-3">
          {loading&&(
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/30 t-micro">
                <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-emerald-400" style={{animation:"ri-spin .7s linear infinite"}}/>يحلل الصفقة ويضع خطة عمل…
              </div>
              {[0,1,2].map(i=>(
                <div key={i} className="rounded-[var(--radius-md)] p-4 border border-white/[0.04]" style={{background:"rgba(255,255,255,.02)"}}>
                  <div className="h-2.5 rounded w-1/3 mb-2" style={{background:"rgba(255,255,255,.06)"}}/>
                  <div className="h-2 rounded w-full mb-1.5" style={{background:"rgba(255,255,255,.04)"}}/>
                  <div className="h-2 rounded w-4/5" style={{background:"rgba(255,255,255,.03)"}}/>
                </div>
              ))}
            </div>
          )}
          {done&&steps.map((step,i)=>(
            <div key={i} className="ri-up rounded-[var(--radius-md)] p-4 border" style={{animationDelay:`${i*.1}s`,background:`${stepC[i]??C.e4}0d`,borderColor:`${stepC[i]??C.e4}20`}}>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-[var(--radius-sm)] flex items-center justify-center t-caption font-black text-white flex-none ri-shine-wrap"
                  style={{background:stepG[i]??stepG[0],boxShadow:`0 3px 10px ${stepC[i]??C.e4}40`}}>{step.num}</div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="t-caption font-bold mb-1.5" style={{color:stepC[i]??C.e4}}>{step.title}</p>
                  <p className="t-micro text-white/55 leading-[1.75]">{step.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {done&&(
          <div className="px-6 pb-6 flex gap-2">
            <a href="/dashboard/deals" className="flex-1 ri-shine-wrap flex items-center justify-center gap-2 py-3 rounded-[var(--radius-md)] text-white t-caption font-bold hover:opacity-90 transition"
              style={{background:"linear-gradient(135deg,var(--status-success-fg),var(--brand-green-500))",boxShadow:"0 6px 18px rgba(16,185,129,.3)"}}>افتح الصفقة<svg viewBox="0 0 12 12" fill="white" className="h-3 w-3 rotate-180"><path d="M4.5 3l3 3-3 3V3z"/></svg>
            </a>
            <button onClick={onClose} className="px-5 py-3 rounded-[var(--radius-md)] text-white/40 hover:text-white/70 border border-white/[0.08] t-caption font-medium transition">إغلاق</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ KPI Card ════════════════════════════════════════════════════════════ */
function KpiCard({label,note,value,fmt,unit,accent,icon,spark,ring,trend}:
  {label:string;note:string;value:number;fmt?:(n:number)=>string;unit?:string;accent:string;icon:React.ReactNode;spark?:number[];ring?:{pct:number};trend?:{val:number;up:boolean}}) {
  return (
    <div className="ri-card ri-lift relative rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] e-1 h-full flex flex-col">
      <div className="relative p-5 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-[var(--radius-md)] flex items-center justify-center" style={{backgroundColor:`${accent}17`,color:accent}}>
              {icon}
            </div>
            <div>
              <p className="t-micro font-black uppercase tracking-[.16em]" style={{color:C.tx3}}>{label}</p>
              <p className="t-micro mt-0.5" style={{color:C.tx3}}>{note}</p>
            </div>
          </div>
          {trend && (
            <div className="flex items-center gap-0.5 t-micro font-bold px-1.5 py-0.5 rounded-[var(--radius-xs)]" style={{background:trend.up?"var(--status-success-bg)":"var(--status-danger-bg)",color:trend.up?C.e4:C.r5}}>
              <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 ${trend.up?"":"rotate-180"}`} fill="currentColor"><path d="M6 2l4 6H2z"/></svg>
              {trend.val}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="flex-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1 leading-none">
              <span className="t-figure-lg font-black tabular-nums tracking-tight" style={{color:accent}}>
                <AnimNum value={value} fmt={fmt??sarK}/>
              </span>
              {unit&&<span className="t-micro font-semibold" style={{color:C.tx3}}>{unit}</span>}
            </div>
          </div>
          <div className="flex-none">
            {ring?(
              <div className="relative">
                <Ring pct={ring.pct} color={accent} size={54} sw={6}/>
                <span className="absolute inset-0 flex items-center justify-center t-micro font-black" style={{color:accent}}>
                  <AnimNum value={ring.pct} fmt={n=>`${n}%`}/>
                </span>
              </div>
            ):spark?<Spark vals={spark} color={accent}/>:null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Forecast Bars ═══════════════════════════════════════════════════════ */
function ForecastBars({scenarios}:{scenarios:RevenueIntelligenceData["forecast"]}) {
  const max=Math.max(...scenarios.map(s=>s.valueSAR),1);
  const pal=[
    {c:C.e3, grad:"linear-gradient(90deg,var(--status-success-fg),var(--brand-green-500))", note:"الصفقات شبه المؤكدة فقط",lbl:"متحفظ"},
    {c:C.e4, grad:"linear-gradient(90deg,var(--status-success-fg),var(--brand-green-500))", note:"كل الصفقات × احتمالياتها", lbl:"واقعي"},
    {c:C.e5, grad:"linear-gradient(90deg,var(--brand-green-500),var(--status-success-on-inverse))", note:"كل الصفقات بكامل قيمتها",  lbl:"متفائل"},
  ];
  return (
    <div className="space-y-4">
      {scenarios.map((s,i)=>{
        const p=pal[i], pct=(s.valueSAR/max)*100;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-[var(--radius-sm)] flex items-center justify-center t-micro font-black text-white ri-shine-wrap" style={{background:p.grad,boxShadow:`0 2px 8px ${p.c}30`}}>{i+1}</div>
                <div>
                  <p className="t-caption font-bold" style={{color:C.tx}}>{s.label}</p>
                  <p className="t-micro" style={{color:C.tx3}}>{p.note}</p>
                </div>
              </div>
              <p className="t-body-sm font-black tabular-nums" style={{color:p.c}}>
                {sarK(s.valueSAR)} <span className="t-micro font-medium" style={{color:C.tx3}}>ر.س</span>
              </p>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--surface-sunken)]">
              <div className="h-full rounded-full transition-all duration-1000" style={{width:`${pct}%`,background:p.grad,boxShadow:`0 0 10px ${p.c}30`}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Distribution ════════════════════════════════════════════════════════ */
function DistPills({categories}:{categories:RevenueIntelligenceData["categories"]}) {
  const total=categories.reduce((s,c)=>s+c.totalSAR,0);
  const cats = ["commit","best_case","pipeline"];
  const colors=[CAT.commit.hex,CAT.best_case.hex,CAT.pipeline.hex];
  const grads=[CAT.commit.grad,CAT.best_case.grad,CAT.pipeline.grad];
  const SIZE=92, R=35, SW=10, circ=2*Math.PI*R;
  const { slices } = categories.reduce<{ offset: number; slices: { pct: number; dash: number; offset: number; color: string }[] }>(
    (state, c, i) => {
      const pct = total ? c.totalSAR / total : 0, dash = pct * circ;
      const sl = { pct, dash, offset: state.offset, color: colors[i] ?? "var(--border-strong)" };
      return { offset: state.offset + dash, slices: [...state.slices, sl] };
    },
    { offset: 0, slices: [] },
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5">
        <div className="relative flex-none">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
            <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={C.borderL} strokeWidth={SW}/>
            {slices.map((sl,i)=>(
              <circle key={i} cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={sl.color} strokeWidth={SW-1}
                strokeDasharray={`${sl.dash} ${circ-sl.dash}`} strokeDashoffset={-sl.offset}
                style={{transition:"stroke-dasharray 1s ease .1s"}}/>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="t-micro font-bold uppercase tracking-wider" style={{color:C.tx3}}>الكل</p>
            <p className="t-body-sm font-black" style={{color:C.tx}}>{sarK(total)}</p>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {categories.map((c,i)=>{
            const cfg=CAT[cats[i]]; if(!cfg) return null;
            const pct=total?Math.round((c.totalSAR/total)*100):0;
            return (
              <div key={c.category} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-[var(--radius-xs)] flex-none" style={{background:grads[i]}}/>
                <span className="t-micro font-semibold flex-1" style={{color:C.tx}}>{cfg.label}</span>
                <span className="t-micro" style={{color:C.tx3}}>{c.count}</span>
                <span className="t-caption font-black w-9 text-left tabular-nums" style={{color:colors[i]}}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Progress bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden gap-[2px]">
        {categories.map((c,i)=>(
          <div key={c.category} className="transition-all duration-700" style={{width:`${total?(c.totalSAR/total)*100:0}%`,background:grads[i]}}/>
        ))}
      </div>
      {/* Category cards */}
      <div className="space-y-2">
        {categories.map((c,i)=>{
          const cfg=CAT[cats[i]]; if(!cfg) return null;
          const pct=total?Math.round((c.totalSAR/total)*100):0;
          return (
            <div key={c.category} className="rounded-[var(--radius-md)] p-3 border ri-lift" style={{background:cfg.bg,borderColor:`${cfg.ring}55`}}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[var(--radius-xs)]" style={{background:grads[i]}}/>
                  <span className="t-micro font-bold" style={{color:cfg.hex}}>{cfg.label}</span>
                  <span className="t-micro" style={{color:C.tx3}}>{cfg.sub}</span>
                </div>
                <span className="t-body-sm font-black tabular-nums" style={{color:cfg.hex}}>{sarK(c.totalSAR)}</span>
              </div>
              <div className="flex items-center justify-between t-micro" style={{color:C.tx3}}>
                <span>{c.count} صفقة · {pct}%</span>
                <span>مرجّح: <strong style={{color:cfg.hex}}>{sarK(c.weightedSAR)} ر.س</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ Weekly Chart ════════════════════════════════════════════════════════ */
function WeeklyChart({data}:{data:RevenueIntelligenceData["weeklyHistory"]}) {
  const [hov,setHov]=useState<number|null>(null);
  const max=Math.max(...data.map(w=>Math.max(w.wonSAR,w.lostSAR)),1);
  return (
    <div>
      <div className="flex items-center gap-5 mb-4">
        {[
          {grad:"linear-gradient(180deg,var(--brand-green-500),var(--status-success-fg))",l:"رابحة"},
          {grad:"linear-gradient(180deg,var(--status-danger-on-inverse),var(--brand-red-500))",l:"خاسرة"},
        ].map(({grad,l})=>(
          <div key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[var(--radius-xs)]" style={{background:grad}}/>
            <span className="t-micro font-medium" style={{color:C.tx2}}>صفقات {l}</span>
          </div>
        ))}
        <span className="mr-auto t-micro" style={{color:C.tx3}}>حوّم للتفاصيل</span>
      </div>
      <div className="flex items-end gap-[3px] h-32 pt-2">
        {data.map((w,i)=>{
          const wonH=(w.wonSAR/max)*100, lostH=(w.lostSAR/max)*100, isH=hov===i;
          return (
            <div key={i} className="relative flex-1 flex flex-col items-center cursor-pointer"
              onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
              {isH&&(
                <div className="absolute z-20 rounded-[var(--radius-sm)] px-3 py-2 t-micro text-center whitespace-nowrap pointer-events-none"
                  style={{bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:C.e1,color:"white",boxShadow:"0 8px 20px rgba(0,0,0,.25)",border:"1px solid rgba(255,255,255,.06)"}}>
                  <p className="text-white/40 t-micro font-bold tracking-wider uppercase mb-1">{w.weekLabel}</p>
                  {w.wonSAR>0&&<p className="text-[var(--status-success-on-inverse)] font-bold">↑ {sarK(w.wonSAR)}</p>}
                  {w.lostSAR>0&&<p className="text-[var(--status-danger-on-inverse)] font-bold">↓ {sarK(w.lostSAR)}</p>}
                  {w.wonSAR===0&&w.lostSAR===0&&<p className="text-white/30">—</p>}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent" style={{borderTopColor:C.e1}}/>
                </div>
              )}
              <div className="w-full flex items-end gap-[1.5px] h-[120px]">
                <div className="flex-1 rounded-t-[3px] transition-all duration-200"
                  style={{height:`${wonH}%`,background:isH?"linear-gradient(180deg,var(--brand-green-500),var(--status-success-fg))":"linear-gradient(180deg,var(--brand-green-500),var(--status-success-fg))",minHeight:w.wonSAR>0?3:0,boxShadow:isH?"0 -4px 12px rgba(16,185,129,.4)":"none"}}/>
                <div className="flex-1 rounded-t-[3px] transition-all duration-200"
                  style={{height:`${lostH}%`,background:isH?"linear-gradient(180deg,var(--status-danger-on-inverse),var(--brand-red-500))":"linear-gradient(180deg,var(--status-danger-border),var(--brand-red-500))",minHeight:w.lostSAR>0?3:0,boxShadow:isH?"0 -4px 12px rgba(239,68,68,.3)":"none"}}/>
              </div>
              {i%3===0&&<span className="t-micro mt-1.5 whitespace-nowrap" style={{color:C.tx3}}>{w.weekLabel}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ AI Chat Panel ═══════════════════════════════════════════════════════ */
interface Msg{role:"user"|"assistant";content:string}

/* ═══ Deal Modal ══════════════════════════════════════════════════════════ */
function DealModal({deal,ctx,onClose}:{deal:RIDeal;ctx:string;onClose:()=>void}) {
  const [showCoach,setShowCoach]=useState(false);
  const cat=CAT[deal.category]??CAT.pipeline, risk=RISK[deal.riskLevel];
  const w=Math.round(deal.valueSAR*deal.probabilityPct/100);
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!showCoach)onClose();};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose,showCoach]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface-inverse-deep)_55%,transparent)] backdrop-blur-2xl"/>
        <div className="ri-in relative bg-[var(--surface-raised)] rounded-[var(--radius-lg)] w-full max-w-[420px] overflow-hidden" onClick={e=>e.stopPropagation()}
          style={{boxShadow:"0 24px 60px rgba(0,0,0,.18)"}}>
          <div className="h-1" style={{background:cat.grad}}/>
          <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3">
            <div>
              <p className="t-micro font-black uppercase tracking-[.2em] mb-2" style={{color:C.tx3}}>تفاصيل الصفقة</p>
              <h2 className="text-lg font-black leading-tight" style={{color:C.tx}}>{deal.name}</h2>
              {deal.leadName&&<p className="t-caption mt-0.5" style={{color:C.tx3}}>{deal.leadName}</p>}
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] flex items-center justify-center transition flex-none mt-0.5" style={{color:C.tx2}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="px-6 pb-4 flex flex-wrap gap-1.5">
            <span className="t-micro font-bold px-2.5 py-1 rounded-[var(--radius-sm)] text-white" style={{background:cat.grad}}>{cat.label}</span>
            <span className="t-micro font-bold px-2.5 py-1 rounded-[var(--radius-sm)] border flex items-center gap-1" style={{color:risk.dot,borderColor:`${risk.dot}25`,background:risk.bg}}>
              <span className="h-1.5 w-1.5 rounded-full" style={{background:risk.dot}}/>{risk.label}
            </span>
            <span className="t-micro font-bold px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] border" style={{color:C.tx2,borderColor:C.borderL}}>{deal.stage}</span>
          </div>
          <div className="mx-6 mb-4 grid grid-cols-3 gap-2">
            {[
              {label:"القيمة",val:sarFull(deal.valueSAR),unit:"ر.س",grad:"linear-gradient(135deg,var(--surface-sunken),var(--surface-sunken))",bc:C.border,c:C.tx},
              {label:"الاحتمالية",val:`${deal.probabilityPct}%`,unit:"",grad:"linear-gradient(135deg,var(--status-info-bg),var(--status-info-bg))",bc:"var(--status-info-border)",c:C.i3},
              {label:"المرجّحة",val:sarFull(w),unit:"ر.س",grad:"linear-gradient(135deg,var(--status-success-bg),var(--status-success-bg))",bc:"var(--status-success-border)",c:C.e3},
            ].map(x=>(
              <div key={x.label} className="rounded-[var(--radius-md)] p-3 text-center border" style={{background:x.grad,borderColor:x.bc}}>
                <p className="t-micro font-bold uppercase tracking-wider mb-1.5" style={{color:C.tx3}}>{x.label}</p>
                <p className="t-body-sm font-black tabular-nums" style={{color:x.c}}>{x.val}</p>
                {x.unit&&<p className="t-micro mt-0.5" style={{color:C.tx3}}>{x.unit}</p>}
              </div>
            ))}
          </div>
          <div className="mx-6 mb-4 rounded-[var(--radius-md)] overflow-hidden border" style={{borderColor:C.borderL}}>
            {[
              {label:"في المرحلة منذ",val:`${deal.daysInStage} يوم`,warn:deal.daysInStage>30},
              {label:"آخر تواصل",val:deal.daysSinceActivity!=null?`منذ ${deal.daysSinceActivity} يوم`:"لا يوجد",warn:(deal.daysSinceActivity??0)>14},
            ].map(({label,val,warn},idx)=>(
              <div key={label} className={`flex items-center justify-between px-4 py-3 bg-[var(--surface-raised)] ${idx>0?"border-t":""}`} style={{borderColor:C.borderL}}>
                <span className="t-micro" style={{color:C.tx2}}>{label}</span>
                <span className="t-micro font-bold" style={{color:warn?C.r4:C.tx}}>{val}</span>
              </div>
            ))}
          </div>
          {deal.riskReasons.length>0&&(
            <div className="mx-6 mb-4 rounded-[var(--radius-md)] border p-4" style={{background:"linear-gradient(135deg,var(--status-danger-bg),var(--status-danger-border))",borderColor:"var(--status-danger-border)"}}>
              <p className="t-micro font-black text-[var(--status-danger-fg)] uppercase tracking-[.2em] mb-2">إشارات الخطر</p>
              <div className="space-y-1.5">
                {deal.riskReasons.map(r=>(
                  <div key={r} className="flex items-start gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-red-500)] flex-none mt-1.5"/><p className="t-micro text-[var(--status-danger-fg)] leading-snug">{r}</p></div>
                ))}
              </div>
            </div>
          )}
          <div className="px-6 pb-6 flex gap-2">
            <button onClick={()=>setShowCoach(true)}
              className="flex-1 ri-shine-wrap flex items-center justify-center gap-2 py-3 rounded-[var(--radius-md)] text-white t-caption font-bold transition hover:opacity-90"
              style={{background:"linear-gradient(135deg,var(--status-success-fg),var(--brand-green-500))",boxShadow:"0 6px 18px rgba(16,185,129,.25)"}}>
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M7 2l5 9H2z"/><path d="M7 6v2M7 10h.01"/></svg>خطة إغلاق AI
            </button>
            <a href="/dashboard/deals" className="px-4 flex items-center justify-center rounded-[var(--radius-md)] border t-caption font-semibold hover:bg-[var(--surface-sunken)] transition" style={{color:C.tx2,borderColor:C.border}}>فتح</a>
          </div>
        </div>
      </div>
      {showCoach&&<CoachModal deal={deal} ctx={ctx} onClose={()=>setShowCoach(false)}/>}
    </>
  );
}

/* ═══ Deal Row ════════════════════════════════════════════════════════════ */
function Row({deal,onClick}:{deal:RIDeal;onClick:()=>void}) {
  const cat=CAT[deal.category]??CAT.pipeline, risk=RISK[deal.riskLevel];
  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      tabIndex={0}
      role="button"
      aria-label={`فتح الصفقة ${deal.name}`}
      className="group cursor-pointer border-b border-[var(--border-subtle)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]"
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex-none">
            <span className="h-2 w-2 rounded-full block" style={{background:risk.dot}}/>
            
          </div>
          <div>
            <p className="t-caption font-semibold group-hover:text-[var(--status-success-fg)] transition-colors" style={{color:C.tx}}>{deal.name}</p>
            {deal.leadName&&<p className="t-micro mt-0.5" style={{color:C.tx3}}>{deal.leadName}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          {deal.stageColor&&<span className="h-1.5 w-1.5 rounded-full" style={{background:deal.stageColor}}/>}
          <span className="t-micro" style={{color:C.tx2}}>{deal.stage}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="t-micro font-bold px-2 py-0.5 rounded-[var(--radius-xs)] text-white" style={{background:cat.grad}}>{cat.label}</span>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-14 rounded-full bg-[var(--surface-sunken)] overflow-hidden">
            <div className="h-full rounded-full" style={{width:`${deal.probabilityPct}%`,background:cat.grad}}/>
          </div>
          <span className="t-micro font-bold w-7 tabular-nums" style={{color:C.tx2}}>{deal.probabilityPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden xl:table-cell">
        {deal.daysSinceActivity!=null
          ?<span className="t-micro font-semibold" style={{color:deal.daysSinceActivity>14?C.r5:C.tx3}}>{deal.daysSinceActivity} يوم</span>
          :<span className="t-micro" style={{color:C.borderL}}>—</span>}
      </td>
      <td className="px-5 py-3.5 text-left">
        <p className="t-caption font-black tabular-nums" style={{color:C.tx}}>{sarFull(deal.valueSAR)}</p>
        <p className="t-micro mt-0.5 uppercase tracking-wider" style={{color:C.tx3}}>ريال</p>
      </td>
    </tr>
  );
}

/* ═══ Section Heading ═════════════════════════════════════════════════════ */
function SectionHead({icon,title,sub,accent}:{icon:React.ReactNode;title:string;sub:string;grad?:string;accent:string}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-[var(--radius-md)] flex items-center justify-center flex-none" style={{backgroundColor:`${accent}17`,color:accent}}>
        {icon}
      </div>
      <div>
        <h3 className="t-body-sm font-bold" style={{color:C.tx}}>{title}</h3>
        <p className="t-micro mt-0.5" style={{color:C.tx3}}>{sub}</p>
      </div>
    </div>
  );
}

/* ═══ Page ════════════════════════════════════════════════════════════════ */
type FK="all"|DealCategory|"high_risk";

export default function RevenueTab() {
  const [data,setData]=useState<RevenueIntelligenceData|null>(null);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState<RIDeal|null>(null);
  const [coachDeal,setCoachDeal]=useState<RIDeal|null>(null);
  const [filter,setFilter]=useState<FK>("all");
  const [search,setSearch]=useState("");
  const [ctx,setCtx]=useState("");

  useEffect(()=>{
    buildRevenueIntelligence().then(d=>{setData(d);setCtx(buildContext(d));}).finally(()=>setLoading(false));
  },[]);

  if(loading) return (
    <div dir="rtl" className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
      <style>{GLOBAL_CSS}</style>
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-[3px]" style={{borderColor:`${C.e4}12`}}/>
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent" style={{borderTopColor:C.e4,animation:"ri-spin 1s linear infinite"}}/>
        <div className="absolute inset-2.5 rounded-full border-[2px] border-transparent" style={{borderTopColor:C.e5,animation:"ri-spin .7s linear infinite reverse"}}/>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full" style={{background:`linear-gradient(135deg,${C.e4},${C.e6})`,boxShadow:`0 0 14px ${C.e4}50`}}/>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="t-body-sm font-semibold" style={{color:C.tx}}>جارٍ تحليل بيانات المبيعات</p>
        <p className="t-micro" style={{color:C.tx3}}>نحسب الاحتماليات ومؤشرات الخطر…</p>
      </div>
    </div>
  );
  if(!data) return <div dir="rtl" className="py-16 text-center text-sm" style={{color:C.tx3}}>تعذّر تحميل البيانات</div>;

  const atRisk=data.deals.filter(d=>d.riskLevel==="high");
  const wonSpark=data.weeklyHistory.slice(-8).map(w=>w.wonSAR);

  const filtered=data.deals.filter(d=>{
    if(filter==="high_risk"&&d.riskLevel!=="high") return false;
    if(filter!=="all"&&filter!=="high_risk"&&d.category!==filter) return false;
    if(search){const q=search.toLowerCase();return d.name.toLowerCase().includes(q)||(d.leadName??"").toLowerCase().includes(q);}
    return true;
  });

  const FILTERS:{key:FK;label:string;count?:number}[]=[
    {key:"all",label:"الكل",count:data.deals.length},
    {key:"high_risk",label:"خطر عالٍ",count:data.atRiskCount},
    {key:"commit",label:"شبه مؤكدة"},
    {key:"best_case",label:"محتملة"},
    {key:"pipeline",label:"قيد المتابعة"},
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div dir="rtl" className="flex flex-col gap-5 pb-12">

        {/* ─── HERO ─────────────────────────────────────────── */}
        <div className="ri-up relative overflow-hidden rounded-[var(--radius-lg)] text-white"
          style={{background:"var(--surface-inverse)"}}>
          <div className="absolute top-[-50px] right-[-30px] h-72 w-72 pointer-events-none"
            style={{background:"radial-gradient(circle,rgba(52,211,153,.2),transparent 65%)",animation:"ri-orb 8s ease-in-out infinite"}}/>
          <div className="absolute bottom-[-50px] left-[15%] h-56 w-56 pointer-events-none"
            style={{background:"radial-gradient(circle,rgba(16,185,129,.15),transparent 60%)",animation:"ri-orb2 10s ease-in-out infinite"}}/>
          <div className="absolute inset-0 pointer-events-none opacity-[0.05] ri-grid-bg"/>

          <div className="relative px-8 py-9 lg:py-11">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="ri-up" style={{animationDelay:".04s"}}>
                <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5 border"
                  style={{background:"rgba(255,255,255,.06)",borderColor:"rgba(255,255,255,.12)",backdropFilter:"blur(6px)"}}>
                  <span className="relative flex h-2 w-2">
                    <span className="relative rounded-full h-2 w-2 bg-[var(--brand-green-500)]"/>
                  </span>
                  <span className="t-micro font-bold text-white/50 tracking-[.2em] uppercase">لوحة مبيعات مباشرة</span>
                </div>
                <h1 className="t-display-2 lg:t-display-1 font-black leading-[.9] tracking-tight text-white">ذكاء الإيرادات</h1>
                <p className="text-white/30 t-micro mt-4 font-medium flex items-center gap-2">
                  <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3l2 1"/></svg>
                  {new Date(data.asOf).toLocaleString("ar-SA",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 ri-up" style={{animationDelay:".1s"}}>
                {[
                  {label:"خط المبيعات",val:sarK(data.totalPipelineSAR),sub:`${data.deals.length} صفقة نشطة`,hi:true,icon:<ChartUpIcon className="h-4 w-4" />},
                  {label:"الإيراد المرجّح",val:sarK(data.weightedPipelineSAR),sub:"بعد الاحتماليات",hi:false,icon:<ScaleIcon className="h-4 w-4" />},
                  {label:"مُغلق الشهر",val:sarK(data.wonThisMonthSAR),sub:`${data.wonThisMonthCount} صفقة`,hi:false,icon:<CheckIcon className="h-4 w-4" />},
                ].map(({label,val,sub,hi})=>(
                  <div key={label} className="ri-lift rounded-[var(--radius-lg)] px-5 py-4 min-w-[150px] backdrop-blur-md border ri-shine-wrap"
                    style={{background:hi?"rgba(255,255,255,.11)":"rgba(255,255,255,.05)",borderColor:hi?"rgba(255,255,255,.2)":"rgba(255,255,255,.08)",boxShadow:hi?"inset 0 1px 0 rgba(255,255,255,.12), 0 6px 16px rgba(0,0,0,.15)":"0 4px 12px rgba(0,0,0,.1)"}}>
                    <p className="t-micro text-white/35 mb-2 font-bold tracking-wider uppercase">{label}</p>
                    <p className="t-figure-sm font-black text-white leading-none tabular-nums">{val} <span className="t-micro font-medium text-white/35">ر.س</span></p>
                    <p className="t-micro text-white/25 mt-2">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── KPI BENTO ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2">
            <KpiCard label="في خطر عالٍ" note="تحتاج تدخل فوري" value={data.atRiskCount} fmt={n=>`${n}`} unit="صفقة"
              accent={C.r4} spark={data.weeklyHistory.slice(-8).map((_,i)=>Math.max(0,data.atRiskCount-i%2))}
              icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M8.6 3.2 1.5 15a2 2 0 0 0 1.4 2.5h14.2a2 2 0 0 0 1.4-2.5L11.4 3.2a2 2 0 0 0-2.8 0z"/><line x1="10" y1="7" x2="10" y2="11"/><line x1="10" y1="14" x2="10.01" y2="14"/></svg>}/>
          </div>
          <div className="sm:col-span-2 xl:col-span-1 row-span-2">
            <HealthCard data={data} ctx={ctx}/>
          </div>
          <div>
            <KpiCard label="نسبة الفوز" note={`${data.wonThisMonthCount} ربح · ${data.lostThisMonthCount} خسارة`}
              value={data.winRateThisMonth} fmt={n=>`${n}%`} accent={C.e4}
              ring={{pct:data.winRateThisMonth}}
              icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="10" cy="7" r="5"/><path d="m8 10 2 2 2-2M10 18v-5"/></svg>}/>
          </div>
          <div>
            <KpiCard label="متوسط الصفقة" note="للصفقات النشطة" value={data.avgDealSAR} unit="ر.س"
              accent={C.i4} spark={wonSpark}
              icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><line x1="10" y1="1" x2="10" y2="19"/><path d="M14 4H8a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H5"/></svg>}/>
          </div>
        </div>

        {/* ─── AT RISK ──────────────────────────────────────── */}
        {atRisk.length>0&&(
          <div className="ri-up" style={{animationDelay:".2s"}}>
            <div className="flex items-center gap-4 mb-5">
              <div className="h-px flex-1 rounded-full" style={{background:"linear-gradient(90deg,transparent,var(--status-danger-border))"}}/>
              <div className="flex items-center gap-2.5 rounded-full px-5 py-2 border" style={{background:"linear-gradient(135deg,var(--status-danger-bg),var(--status-danger-bg))",borderColor:"var(--status-danger-border)",boxShadow:"0 4px 12px rgba(239,68,68,.08)"}}>
                <div className="relative flex h-2.5 w-2.5">
                  <span className="relative rounded-full h-2.5 w-2.5 bg-[var(--brand-red-500)]"/>
                </div>
                <span className="t-micro font-bold text-[var(--status-danger-fg)]">{atRisk.length} صفقة تحتاج تدخلاً فورياً</span>
                <span className="t-micro font-black text-[var(--brand-red-500)] tabular-nums">{sarFull(data.atRiskSAR)} ر.س</span>
              </div>
              <div className="h-px flex-1 rounded-full" style={{background:"linear-gradient(90deg,var(--status-danger-border),transparent)"}}/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {atRisk.slice(0,6).map(deal=>{
                const w=Math.round(deal.valueSAR*deal.probabilityPct/100);
                return (
                  <div key={deal.id} className="ri-lift group bg-[var(--surface-raised)] rounded-[var(--radius-lg)] border overflow-hidden" style={{borderColor:"var(--status-danger-border)",boxShadow:"0 1px 3px rgba(239,68,68,.06)"}}>
                    <div className="h-1 bg-gradient-to-l from-[var(--brand-red-500)] to-[var(--brand-red-500)]"/>
                    <button className="w-full text-right p-5 space-y-3" onClick={()=>setSel(deal)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="t-caption font-bold truncate group-hover:text-[var(--status-danger-fg)] transition-colors" style={{color:C.tx}}>{deal.name}</p>
                          {deal.leadName&&<p className="t-micro mt-0.5 truncate" style={{color:C.tx3}}>{deal.leadName}</p>}
                        </div>
                        <div className="relative flex-none">
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-red-500)] block"/>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {deal.riskReasons.map(r=>(
                          <div key={r} className="flex items-start gap-1.5 flex-row-reverse">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-danger-border)] flex-none mt-1.5"/>
                            <span className="t-micro text-[var(--status-danger-fg)] leading-snug">{r}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center justify-between t-micro mb-1.5">
                          <span className="font-black text-[var(--status-danger-fg)] tabular-nums">{deal.probabilityPct}%</span>
                          <span style={{color:C.tx3}}>الاحتمالية</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{background:"var(--status-danger-border)"}}>
                          <div className="h-full rounded-full transition-all duration-700" style={{width:`${Math.max(5,deal.probabilityPct)}%`,background:"linear-gradient(90deg,var(--status-danger-on-inverse),var(--brand-red-500))"}}/>
                        </div>
                      </div>
                      <div className="flex items-end justify-between pt-3 border-t" style={{borderColor:"var(--status-danger-border)"}}>
                        <div>
                          <p className="t-micro uppercase tracking-wider font-bold" style={{color:C.tx3}}>المرجّحة</p>
                          <p className="t-caption font-black tabular-nums" style={{color:C.e3}}>{sarFull(w)}</p>
                        </div>
                        <div className="text-left">
                          <p className="t-micro uppercase tracking-wider font-bold" style={{color:C.tx3}}>القيمة الكاملة</p>
                          <p className="t-caption font-bold tabular-nums" style={{color:C.tx}}>{sarFull(deal.valueSAR)}</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={()=>setCoachDeal(deal)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 t-micro font-bold border-t transition hover:opacity-90 text-white"
                      style={{backgroundColor:"var(--brand-teal-700)",borderColor:"var(--status-danger-border)"}}>
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M6 1.5l4.5 8H1.5z"/><path d="M6 5v2M6 9h.01"/></svg>خطة إغلاق AI
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── MAIN GRID ────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Forecast */}
              <div className="ri-up bg-[var(--surface-raised)] rounded-[var(--radius-lg)] border p-[var(--space-card-pad)]" style={{animationDelay:".08s",borderColor:C.borderL,boxShadow:"0 1px 3px rgba(0,0,0,.03),0 6px 18px rgba(0,0,0,.03)"}}>
                <SectionHead grad="linear-gradient(135deg,var(--status-success-fg),var(--brand-green-500))" accent={C.e4}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2 2v16h16"/><path d="m6 13 3-3 3 3 4-4"/></svg>}
                  title="توقعات الإيرادات" sub="3 سيناريوهات لنهاية الشهر"/>
                <ForecastBars scenarios={data.forecast}/>
                <div className="mt-4 rounded-[var(--radius-sm)] px-3 py-2 border flex items-center gap-2.5" style={{background:"linear-gradient(135deg,var(--status-success-bg),var(--status-success-bg))",borderColor:"var(--status-success-border)"}}>
                  <div className="h-5 w-5 rounded-[var(--radius-xs)] flex items-center justify-center flex-none" style={{background:C.e4,boxShadow:"0 2px 6px rgba(5,150,105,.3)"}}>
                    <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="h-2.5 w-2.5"><path d="M2 6l3 3 5-5"/></svg>
                  </div>
                  <p className="t-micro font-semibold text-[var(--status-success-fg)]">يشمل<strong>{sarFull(data.wonThisMonthSAR)} ر.س</strong>مُغلق بالفعل</p>
                </div>
              </div>
              {/* Distribution */}
              <div className="ri-up bg-[var(--surface-raised)] rounded-[var(--radius-lg)] border p-[var(--space-card-pad)]" style={{animationDelay:".14s",borderColor:C.borderL,boxShadow:"0 1px 3px rgba(0,0,0,.03),0 6px 18px rgba(0,0,0,.03)"}}>
                <SectionHead grad="linear-gradient(135deg,var(--status-info-fg),var(--brand-indigo-500))" accent={C.i4}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17.7 13.4A8 8 0 1 1 6.6 2.3"/><path d="M18 10A8 8 0 0 0 10 2v8z"/></svg>}
                  title="توزيع خط المبيعات" sub="حسب احتمالية الإغلاق"/>
                <DistPills categories={data.categories}/>
              </div>
            </div>
            {/* Weekly */}
            <div className="ri-up bg-[var(--surface-raised)] rounded-[var(--radius-lg)] border p-[var(--space-card-pad)]" style={{animationDelay:".2s",borderColor:C.borderL,boxShadow:"0 1px 3px rgba(0,0,0,.03),0 6px 18px rgba(0,0,0,.03)"}}>
              <div className="flex items-center justify-between mb-5">
                <SectionHead grad="linear-gradient(135deg,var(--status-warning-fg),var(--brand-amber-500))" accent={C.a4}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M15 17V8M10 17V3M5 17v-5"/></svg>}
                  title="الأداء الأسبوعي" sub="آخر 12 أسبوع"/>
                <div className="text-left mr-3">
                  <p className="t-micro uppercase tracking-widest font-bold" style={{color:C.tx3}}>مُغلق الشهر</p>
                  <p className="t-body font-black tabular-nums mt-1" style={{color:C.e4}}>{sarK(data.wonThisMonthSAR)} <span className="t-micro font-medium" style={{color:C.tx3}}>ر.س</span></p>
                </div>
              </div>
              <WeeklyChart data={data.weeklyHistory}/>
            </div>
          </div>
          {/* AI Panel */}
          <div className="xl:col-span-1">
            <div className="relative rounded-[var(--radius-lg)] overflow-hidden sticky top-20" style={{height:560,boxShadow:"0 16px 40px rgba(4,45,32,.18),0 0 0 1px rgba(0,0,0,.05)"}}>
            </div>
          </div>
        </div>

        {/* ─── DEALS TABLE ──────────────────────────────────── */}
        <div className="ri-up bg-[var(--surface-raised)] rounded-[var(--radius-lg)] border overflow-hidden" style={{animationDelay:".3s",borderColor:C.borderL,boxShadow:"0 1px 3px rgba(0,0,0,.03),0 6px 18px rgba(0,0,0,.03)"}}>
          <div className="px-6 py-5 border-b" style={{borderColor:C.borderL}}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[var(--radius-md)] flex items-center justify-center flex-none" style={{backgroundColor:"#1a5c4f17",color:"var(--brand-teal-700)"}}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h14M3 10h14M3 14h14"/></svg>
                </div>
                <div>
                  <h2 className="t-body-sm font-bold" style={{color:C.tx}}>جميع الصفقات النشطة</h2>
                  <p className="t-micro mt-0.5" style={{color:C.tx3}}>انقر لعرض التفاصيل أو طلب خطة إغلاق من AI</p>
                </div>
              </div>
              <div className="relative">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                  className="h-3.5 w-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:C.tx3}}>
                  <circle cx="9" cy="9" r="6"/><path d="m16 16-2.6-2.6"/>
                </svg>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="بحث عن صفقة أو عميل…"
                  className="rounded-[var(--radius-md)] pr-9 pl-4 py-2 t-micro w-52 border bg-[var(--surface-sunken)] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/15 focus:border-[var(--brand-teal-700)]/40 transition"
                  style={{borderColor:C.border}}/>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {FILTERS.map(({key,label,count})=>{
                const active=filter===key, isRisk=key==="high_risk";
                return (
                  <button key={key} onClick={()=>setFilter(key)}
                    className="px-3.5 py-1.5 rounded-[var(--radius-sm)] t-micro font-bold border transition-all"
                    style={{backgroundColor:active?(isRisk?"var(--status-danger-fg)":"var(--brand-teal-700)"):"white",color:active?"white":C.tx2,borderColor:active?"transparent":C.border}}>
                    {label}{count!==undefined&&<span className="mr-1 opacity-65">({count})</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4">
              {Object.entries(RISK).map(([,r])=>(
                <div key={r.label} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{background:r.dot}}/>
                  <span className="t-micro font-medium" style={{color:C.tx3}}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{background:C.bg2,borderColor:C.borderL}}>
                  {[{t:"الصفقة",c:"px-5 py-3 text-right"},{t:"المرحلة",c:"px-4 py-3 text-right hidden sm:table-cell"},{t:"التصنيف",c:"px-4 py-3 text-right hidden md:table-cell"},{t:"الاحتمالية",c:"px-4 py-3 text-right hidden lg:table-cell"},{t:"آخر تواصل",c:"px-4 py-3 text-right hidden xl:table-cell"},{t:"القيمة",c:"px-5 py-3 text-left"}].map(h=>(
                    <th key={h.t} className={`${h.c} t-micro font-black uppercase tracking-[.18em]`} style={{color:C.tx3}}>{h.t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0
                  ?<tr><td colSpan={6} className="py-16 text-center text-sm" style={{color:C.tx3}}>لا توجد صفقات مطابقة</td></tr>
                  :filtered.map(d=><Row key={d.id} deal={d} onClick={()=>setSel(d)}/>)}
              </tbody>
            </table>
          </div>
          {filtered.length>0&&(
            <div className="px-6 py-3.5 border-t flex flex-wrap items-center justify-between gap-2" style={{background:C.bg2,borderColor:C.borderL}}>
              <p className="t-micro" style={{color:C.tx3}}>
                <strong style={{color:C.tx}}>{filtered.length}</strong>صفقة · إجمالي: <strong className="tabular-nums" style={{color:C.tx}}>{sarFull(filtered.reduce((s,d)=>s+d.valueSAR,0))} ر.س</strong>
              </p>
              <p className="t-micro" style={{color:C.tx3}}>مرجّح: <strong className="font-black tabular-nums" style={{color:C.e4}}>{sarFull(filtered.reduce((s,d)=>s+Math.round(d.valueSAR*d.probabilityPct/100),0))} ر.س</strong>
              </p>
            </div>
          )}
        </div>

        {sel&&<DealModal deal={sel} ctx={ctx} onClose={()=>setSel(null)}/>}
        {coachDeal&&<CoachModal deal={coachDeal} ctx={ctx} onClose={()=>setCoachDeal(null)}/>}
      </div>
    </>
  );
}
