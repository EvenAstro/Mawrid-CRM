/**
 * Mawrid's product knowledge, structured so the WhatsApp agent can give a
 * consultative answer instead of reciting a feature list.
 *
 * The agent is a small free model — it can't reliably invent which of 16
 * modules matter to a restaurant vs. a real-estate office, and it certainly
 * can't invent the pain points that make the pitch land. So that mapping
 * lives here as data and reaches the model through the recommend_solution
 * tool (lib/whatsapp/crmTools.ts), which means the sales reasoning is
 * reviewable and editable by a human rather than buried in a prompt.
 */

export interface IndustryPlaybook {
  /** Arabic label used when talking back to the customer. */
  label: string;
  /** Words a customer might actually type — matched loosely, not exactly. */
  aliases: string[];
  /** The modules that matter most for this industry, in pitch order. */
  modules: string[];
  /** Problems this industry usually has — the agent leads with these to
   *  show it understands the business before it sells anything. */
  painPoints: string[];
  /** One concrete outcome to anchor the value. */
  outcome: string;
  /** The next question worth asking someone in this industry. */
  discoveryQuestion: string;
}

const PLAYBOOKS: IndustryPlaybook[] = [
  {
    label: "مطاعم وكافيهات",
    aliases: ["مطعم", "مطاعم", "كافيه", "كوفي", "قهوة", "بوفيه", "مقهى", "كافيهات", "restaurant", "cafe", "coffee"],
    modules: ["إدارة المطاعم والكافيهات", "نقاط البيع وكاشير افتراضي", "إدارة المخزون", "المحاسبة الذكية", "الفواتير الرقمية"],
    painPoints: [
      "هدر المكونات وصعوبة معرفة تكلفة الطبق الحقيقية",
      "الكاشير منفصل عن المحاسبة فتطلع الأرقام مختلفة آخر الشهر",
      "صعوبة متابعة أكثر من فرع بنفس اللحظة",
    ],
    outcome: "تعرف تكلفة كل طبق وربحه الصافي لحظياً، والمخزون ينقص تلقائياً مع كل طلب",
    discoveryQuestion: "كم فرع عندك حالياً؟ وتستخدمون نظام كاشير معين الحين؟",
  },
  {
    label: "تجزئة ومحلات",
    aliases: ["محل", "محلات", "تجزئة", "بقالة", "سوبرماركت", "متجر", "بيع", "retail", "shop", "store"],
    modules: ["نقاط البيع وكاشير افتراضي", "إدارة المخزون", "المحاسبة الذكية", "الفواتير الرقمية", "تقارير وإحصاءات"],
    painPoints: [
      "الجرد اليدوي يوقف الشغل وياخذ أيام",
      "ما تعرف أي صنف يبيع وأيها راكد إلا متأخر",
      "فروقات بين المخزون الفعلي والدفتري",
    ],
    outcome: "جرد لحظي بدون إيقاف البيع، وتقرير يبيّن لك الأصناف الراكدة قبل ما تخسر فيها",
    discoveryQuestion: "كم صنف تقريباً عندك؟ وعندك أكثر من فرع أو مستودع؟",
  },
  {
    label: "متاجر إلكترونية",
    aliases: ["متجر الكتروني", "اونلاين", "أونلاين", "سلة", "زد", "شوبيفاي", "ecommerce", "online", "salla", "zid", "shopify"],
    modules: ["المتاجر الإلكترونية", "إدارة المخزون", "الدفع الإلكتروني", "المحاسبة الذكية", "الفواتير الرقمية"],
    painPoints: [
      "الطلبات تجي من المتجر وتنقلها يدوي للمحاسبة",
      "المخزون بالمتجر ما يطابق المستودع فتبيع صنف خلصان",
      "صعوبة معرفة ربحية كل منتج بعد الشحن والعمولات",
    ],
    outcome: "المتجر يتربط مباشرة بالمحاسبة والمخزون — كل طلب يصير قيد وفاتورة تلقائياً",
    discoveryQuestion: "متجرك على أي منصة؟ وكم طلب تقريباً باليوم؟",
  },
  {
    label: "عقارات وإدارة أملاك",
    aliases: ["عقار", "عقارات", "أملاك", "املاك", "ايجار", "إيجار", "شقق", "مكتب عقاري", "real estate", "property"],
    modules: ["إدارة الأملاك والعقار", "إدارة النقد", "المحاسبة الذكية", "الفواتير الرقمية", "تقارير وإحصاءات"],
    painPoints: [
      "متابعة تواريخ العقود والتجديدات يدوياً",
      "تحصيل الإيجارات المتأخرة بدون تنبيه تلقائي",
      "مصاريف الصيانة ما تنربط بالوحدة الصحيحة",
    ],
    outcome: "كل عقد بتنبيه تجديد تلقائي، والتحصيل والصيانة مربوطة بالوحدة نفسها",
    discoveryQuestion: "كم وحدة تدير تقريباً؟ وهي سكنية ولا تجارية؟",
  },
  {
    label: "مقاولات ومشاريع",
    aliases: ["مقاولات", "مقاول", "بناء", "إنشاءات", "انشاءات", "مشاريع", "contracting", "construction"],
    modules: ["المحاسبة الذكية", "المشتريات والموردين", "إدارة الأصول", "إدارة النقد", "الموارد البشرية"],
    painPoints: [
      "تكلفة كل مشروع ما تتضح إلا بعد ما يخلص",
      "مستخلصات ودفعات موردين متداخلة",
      "متابعة المعدات والأصول بين المواقع",
    ],
    outcome: "تكلفة كل مشروع لحظية — تعرف وين تجاوزت الميزانية قبل ما تخسر",
    discoveryQuestion: "كم مشروع شغّال عندك حالياً؟ وكم عدد الموظفين تقريباً؟",
  },
  {
    label: "تجارة جملة وتوزيع",
    aliases: ["جملة", "توزيع", "موردين", "مستودع", "استيراد", "wholesale", "distribution"],
    modules: ["إدارة المخزون", "المشتريات والموردين", "إدارة المبيعات والعملاء", "المحاسبة الذكية", "إدارة النقد"],
    painPoints: [
      "ذمم عملاء متأخرة بدون متابعة منظمة",
      "تسعير مختلف لكل عميل يصعب ضبطه",
      "حركة أصناف بين أكثر من مستودع",
    ],
    outcome: "أعمار ديون واضحة لكل عميل، وتحويلات مخزون بين المستودعات بضغطة",
    discoveryQuestion: "كم عميل تتعامل معه تقريباً؟ وعندك أكثر من مستودع؟",
  },
  {
    label: "خدمات واستشارات",
    aliases: ["خدمات", "استشارات", "مكتب", "محاماة", "تسويق", "برمجة", "وكالة", "services", "consulting", "agency"],
    modules: ["إدارة المبيعات والعملاء", "المحاسبة الذكية", "الفواتير الرقمية", "الموارد البشرية", "تقارير وإحصاءات"],
    painPoints: [
      "عروض أسعار وفواتير تتسوى يدوي بالإكسل",
      "متابعة تحصيل أتعاب العملاء",
      "ما فيه صورة واضحة عن ربحية كل عميل أو مشروع",
    ],
    outcome: "من عرض السعر للفاتورة للتحصيل بدورة وحدة، وربحية كل عميل واضحة",
    discoveryQuestion: "كم عميل نشط عندك؟ وكم عدد فريقك تقريباً؟",
  },
  {
    label: "عيادات ومراكز طبية",
    aliases: ["عيادة", "عيادات", "طبي", "مركز طبي", "أسنان", "اسنان", "مستوصف", "clinic", "medical"],
    modules: ["إدارة المبيعات والعملاء", "المحاسبة الذكية", "الفواتير الرقمية", "إدارة المخزون", "الموارد البشرية"],
    painPoints: [
      "فوترة المرضى والتأمين متفرقة",
      "مخزون المستلزمات الطبية بدون متابعة",
      "رواتب وعمولات الأطباء تتحسب يدوي",
    ],
    outcome: "فوترة متوافقة مع فاتورة، ومخزون مستلزمات بتنبيهات نفاد",
    discoveryQuestion: "كم عيادة أو كرسي عندك؟ وتتعاملون مع شركات تأمين؟",
  },
];

/** Sensible fallback when the customer's business doesn't match a playbook —
 *  still a real answer, not a shrug. */
const GENERIC_PLAYBOOK: IndustryPlaybook = {
  label: "منشآت عامة",
  aliases: [],
  modules: ["المحاسبة الذكية", "إدارة المبيعات والعملاء", "الفواتير الرقمية", "تقارير وإحصاءات", "داشبورد وقرارات ذكية"],
  painPoints: [
    "إدخالات محاسبية يدوية تاخذ وقت وتغلط",
    "التقارير المالية ما تجهز إلا آخر الشهر",
    "البيانات متفرقة بين أكثر من ملف ونظام",
  ],
  outcome: "قيود تلقائية وتقارير مالية لحظية بدل انتظار إقفال الشهر",
  discoveryQuestion: "ممكن تحدثني أكثر عن طبيعة شغلكم؟ وكم عدد الموظفين تقريباً؟",
};

/**
 * Loosely matches whatever the customer typed against the playbooks. Free
 * text in, best playbook out — never null, because "I don't know your
 * industry" is never a useful thing for the agent to say.
 */
export function playbookFor(businessType: string): IndustryPlaybook {
  const q = businessType.trim().toLowerCase();
  if (!q) return GENERIC_PLAYBOOK;
  for (const pb of PLAYBOOKS) {
    if (pb.aliases.some((a) => q.includes(a.toLowerCase()) || a.toLowerCase().includes(q))) return pb;
  }
  return GENERIC_PLAYBOOK;
}

/** Size bands change which modules matter — a 3-person shop doesn't need
 *  HR and permissions, a 60-person one does. */
export function sizeAdvice(size: string): { band: string; extraModules: string[]; note: string } {
  const n = parseInt(size.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return { band: "غير محدد", extraModules: [], note: "احتياجك يعتمد على حجم الفريق — يستاهل نعرفه." };
  }
  if (n <= 5) {
    return {
      band: "منشأة صغيرة",
      extraModules: [],
      note: "بحجمكم الأولوية للمحاسبة والفوترة الآلية — توفر وقت صاحب العمل نفسه بدون تعقيد زايد.",
    };
  }
  if (n <= 30) {
    return {
      band: "منشأة متوسطة",
      extraModules: ["إدارة الصلاحيات", "الموارد البشرية"],
      note: "بحجمكم تبدأ الحاجة لصلاحيات واضحة لكل موظف ومتابعة حضور ورواتب.",
    };
  }
  return {
    band: "منشأة كبيرة",
    extraModules: ["إدارة الصلاحيات", "الموارد البشرية", "داشبورد وقرارات ذكية", "إدارة الأصول"],
    note: "بحجمكم الداشبورد والتقارير اللحظية تفرق كثير — القرار ما ينتظر إقفال الشهر.",
  };
}
