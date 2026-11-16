/* Static reference data for the Iraqi market */

export const SIZES_ALL = [
  "0-6 شهور",
  "6-12 شهر",
  "1-2 سنة",
  "2-3 سنوات",
  "4-5 سنوات",
  "6-7 سنوات",
  "8-9 سنوات",
  "10-12 سنة",
  "14-16 سنة",
] as const;

export const SIZES_BABY = ["0-6 شهور", "6-12 شهر", "1-2 سنة"] as const;
export const SIZES_KIDS = ["1-2 سنة", "2-3 سنوات", "4-5 سنوات", "6-7 سنوات", "8-9 سنوات", "10-12 سنة"] as const;
export const SIZES_TEEN = ["6-7 سنوات", "8-9 سنوات", "10-12 سنة", "14-16 سنة"] as const;

export const SECTIONS = {
  boys: { label: "أولاد", tint: "aqua" },
  girls: { label: "بنات", tint: "blush" },
  newborn: { label: "مواليد 0-24 شهر", tint: "minty" },
} as const;
export type SectionKey = keyof typeof SECTIONS;

export const ORDER_STATUS_META: Record<
  string,
  { label: string; tint: string; step: number }
> = {
  pending: { label: "قيد التأكيد", tint: "butter", step: 1 },
  processing: { label: "قيد التجهيز", tint: "aqua", step: 2 },
  shipped: { label: "تم الشحن", tint: "lilac", step: 3 },
  out_for_delivery: { label: "قيد التوصيل", tint: "lilac", step: 4 },
  delivered: { label: "تم التسليم", tint: "minty", step: 5 },
  return_requested: { label: "طلب إرجاع", tint: "blush", step: 5 },
  cancelled: { label: "ملغي", tint: "gray", step: 0 },
  returned: { label: "مرتجع", tint: "blush", step: 0 },
};

/** ألوان شارة حالة الطلب — مشتركة بين /account و/track */
export const ORDER_STATUS_TONE: Record<string, string> = {
  pending: "bg-butter-100 text-butter-700",
  processing: "bg-aqua-100 text-aqua-700",
  shipped: "bg-lilac-100 text-lilac-700",
  out_for_delivery: "bg-lilac-200 text-lilac-700",
  delivered: "bg-minty-100 text-minty-700",
  return_requested: "bg-butter-200 text-butter-700",
  cancelled: "bg-gray-100 text-gray-500",
  returned: "bg-blush-100 text-blush-700",
};

export const SIZE_CHART: { size: string; height: string; chest: string; waist: string; weight: string }[] = [
  { size: "0-6 شهور", height: "56 – 68", chest: "40 – 46", waist: "42 – 48", weight: "4 – 8" },
  { size: "6-12 شهر", height: "68 – 80", chest: "46 – 49", waist: "48 – 50", weight: "8 – 11" },
  { size: "1-2 سنة", height: "80 – 92", chest: "49 – 52", waist: "50 – 52", weight: "11 – 13" },
  { size: "2-3 سنوات", height: "92 – 98", chest: "52 – 54", waist: "52 – 53", weight: "13 – 15" },
  { size: "4-5 سنوات", height: "104 – 110", chest: "56 – 58", waist: "54 – 55", weight: "17 – 19" },
  { size: "6-7 سنوات", height: "116 – 122", chest: "60 – 62", waist: "56 – 57", weight: "20 – 23" },
  { size: "8-9 سنوات", height: "128 – 134", chest: "64 – 67", waist: "58 – 60", weight: "24 – 29" },
  { size: "10-12 سنة", height: "140 – 152", chest: "68 – 76", waist: "61 – 66", weight: "30 – 42" },
  { size: "14-16 سنة", height: "158 – 170", chest: "80 – 88", waist: "68 – 72", weight: "46 – 58" },
];

export const GOVERNORATES: { name: string; districts: string[] }[] = [
  { name: "بغداد", districts: ["الكرخ", "الرصافة", "المنصور", "زيونة", "الكاظمية", "الأعظمية", "الدورة", "الشعب", "الحرية", "مدينة الصدر"] },
  { name: "البصرة", districts: ["مركز البصرة", "العشار", "المعقل", "الزبير", "أبو الخصيب", "القرنة", "شط العرب"] },
  { name: "نينوى", districts: ["مركز الموصل", "الجانب الأيسر", "تلعفر", "الحمدانية", "سنجار", "شيخان"] },
  { name: "أربيل", districts: ["مركز أربيل", "عينكاوة", "شقلاوة", "كويسنجق", "سوران"] },
  { name: "السليمانية", districts: ["مركز السليمانية", "باكرا جو", "جمجمال", "چمچمال", "شاربازير", "رانية"] },
  { name: "دهوك", districts: ["مركز دهوك", "زاخو", "سيميل", "العمادية", "أكري"] },
  { name: "كركوك", districts: ["مركز كركوك", "الحويجة", "داقوق", "دبس"] },
  { name: "النجف الأشرف", districts: ["مركز النجف", "الكوفة", "المناذرة", "المشخاب"] },
  { name: "كربلاء المقدسة", districts: ["مركز كربلاء", "الحسينية", "عين التمر", "الهندية"] },
  { name: "بابل", districts: ["مركز الحلة", "المسيب", "المحاويل", "الهاشمية"] },
  { name: "ديالى", districts: ["بعقوبة", "المقدادية", "خانقين", "بلدروز"] },
  { name: "الأنبار", districts: ["الرمادي", "الفلوجة", "هيت", "حديثة", "القائم"] },
  { name: "صلاح الدين", districts: ["تكريت", "سامراء", "بيجي", "الشرقاط"] },
  { name: "واسط", districts: ["الكوت", "النعمانية", "الحي", "الصويرة"] },
  { name: "ميسان", districts: ["العمارة", "علي الغربي", "المجر الكبير", "قلعة صالح"] },
  { name: "المثنى", districts: ["السماوة", "الرميثة", "الخضر", "الوركاء"] },
  { name: "القادسية", districts: ["الديوانية", "الشامية", "عفك", "الحمزة"] },
  { name: "ذي قار", districts: ["الناصرية", "الشطرة", "سوق الشيوخ", "الرفاعي"] },
];

export const OCCASIONS = [
  { key: "رمضان", emojiIcon: "moon", tagline: "أجواء رمضانية مبهرة" },
  { key: "عيد الفطر", emojiIcon: "star", tagline: "تألقي بإطلالة العيد" },
  { key: "عيد الأضحى", emojiIcon: "heart", tagline: "فرحة العيد تكتمل معنا" },
  { key: "موسم المدارس", emojiIcon: "backpack", tagline: "استعدوا للعام الدراسي" },
  { key: "رأس السنة", emojiIcon: "gift", tagline: "بداية سنة مليئة بالألوان" },
  { key: "أعياد الميلاد", emojiIcon: "cake", tagline: "إطلالة نجم الحفلة" },
] as const;

export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "وردي", hex: "#F4A9C6" },
  { name: "سماوي", hex: "#7CC4EA" },
  { name: "نعناعي", hex: "#9ADFBF" },
  { name: "لافندر", hex: "#B9A8EA" },
  { name: "أصفر كريمي", hex: "#F7D46B" },
  { name: "أبيض", hex: "#FFFFFF" },
  { name: "كحلي", hex: "#2F3E6B" },
  { name: "رمادي", hex: "#9AA3B0" },
  { name: "بيج", hex: "#E2C9A6" },
  { name: "زيتي", hex: "#7C8C5C" },
  { name: "خردلي", hex: "#D9A527" },
  { name: "عنابي", hex: "#8C3B53" },
];
