"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Globe, Search, Loader2, ExternalLink, Sparkles, HelpCircle, Link2, AlertTriangle,
  CalendarRange, Lightbulb,
} from "lucide-react";

type SearchResult = {
  position: number;
  title: string;
  link: string;
  displayedLink: string;
  snippet: string;
  date: string | null;
};

type SearchResponse = {
  ok: boolean;
  keyMissing?: boolean;
  error?: string;
  query?: string;
  totalResults?: string | null;
  answerBox?: { title?: string; answer?: string; snippet?: string; link?: string } | null;
  knowledgeGraph?: { title?: string; type?: string; description?: string } | null;
  peopleAlsoAsk?: { question: string; snippet: string }[];
  results?: SearchResult[];
  relatedSearches?: string[];
};

const PRESETS = [
  "ملابس أطفال العراق",
  "فساتين بنات بغداد أسعار",
  "أطقم مواليد هدية العراق",
  "متاجر ملابس أطفال أونلاين العراق",
  "ترندات ملابس أطفال 2026",
  "متوسط أسعار ملابس الأطفال بالدينار العراقي",
];

const RANGES: { key: string; label: string }[] = [
  { key: "year", label: "السنة الماضية" },
  { key: "month", label: "الشهر الماضي" },
  { key: "week", label: "الأسبوع الماضي" },
  { key: "day", label: "آخر 24 ساعة" },
  { key: "all", label: "كل الفترات" },
];

const POS_TONES = [
  "bg-blush-100 text-blush-600",
  "bg-aqua-100 text-aqua-700",
  "bg-minty-100 text-minty-700",
  "bg-lilac-100 text-lilac-700",
  "bg-butter-100 text-butter-700",
];

export function MarketSearchTab() {
  const [q, setQ] = useState("");
  const [range, setRange] = useState("year");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);

  const run = async (query?: string) => {
    const term = (query ?? q).trim();
    if (term.length < 2 || busy) return;
    setQ(term);
    setBusy(true);
    try {
      const r = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: term, range, gl: "iq", hl: "ar" }),
      });
      setData(await r.json());
    } catch {
      setData({ ok: false, error: "ماكو اتصال — جرب دة ثانية" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* header */}
      <div className="card-bubble relative overflow-hidden bg-gradient-to-l from-lilac-100 via-aqua-100 to-minty-100 p-6">
        <Globe className="absolute -left-6 -top-6 size-36 text-white/50" />
        <div className="relative">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Sparkles size={20} className="text-lilac-600" /> رصد السوق العراقي — بحث جوجل
          </h2>
          <p className="mt-1 max-w-lg text-xs font-bold leading-6 text-ink-soft">
            ابحث عمّا يتداوله السوق العراقي: أسعار المنافسين، الترندات، كلمات السيو — الهدف العراق (gl=iq) بالعربية، بتزامن فوري مع استراتيجيتك.
          </p>
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-lilac-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="مثال: أسعار فساتين البنات في بغداد…"
                className="field pr-11 py-3.5 text-sm shadow-soft"
              />
            </div>
            <button
              onClick={() => run()}
              disabled={busy || q.trim().length < 2}
              className="flex items-center gap-2 rounded-2xl bg-ink px-6 text-sm font-black text-white shadow-pop transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
              بحث
            </button>
          </div>
          {/* ranges */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <CalendarRange size={14} className="text-ink-soft" />
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all ${
                  range === r.key ? "bg-ink text-white shadow-soft" : "bg-white/80 text-ink-soft hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* presets */}
      {!data && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-ink-soft">
            <Lightbulb size={14} className="text-butter-500" /> اقتراحات جاهزة لمراقبة السوق
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => run(p)}
                className="rounded-full bg-white px-4 py-2 text-xs font-black text-ink shadow-soft ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:ring-lilac-300"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* results */}
      <AnimatePresence mode="wait">
        {busy && (
          <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="shimmer h-24 rounded-3xl" />)}
          </motion.div>
        )}

        {!busy && data && (
          <motion.div key="res" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
            {!data.ok ? (
              <div className="card-bubble flex items-center gap-3 bg-blush-50 p-5">
                <AlertTriangle className="shrink-0 text-blush-600" size={22} />
                <div>
                  <p className="text-sm font-black text-blush-700">تعذر البحث</p>
                  <p className="mt-0.5 text-xs font-bold text-ink-soft">{data.error}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-black text-ink-soft">
                  نتائج “{data.query}” — السوق العراقي • {data.totalResults ?? ""} نتيجة
                </p>

                {/* answer box / kg */}
                {(data.answerBox?.answer || data.answerBox?.snippet || data.knowledgeGraph) && (
                  <div className="card-bubble border-r-4 border-minty-400 p-5">
                    <p className="text-[10px] font-black text-minty-600">إجابة مميزة من جوجل</p>
                    <p className="mt-1 text-sm font-black">{data.answerBox?.title ?? data.knowledgeGraph?.title}</p>
                    <p className="mt-1 text-xs font-bold leading-6 text-ink-soft">
                      {data.answerBox?.answer ?? data.answerBox?.snippet ?? data.knowledgeGraph?.description}
                    </p>
                  </div>
                )}

                {/* organic */}
                <div className="space-y-2.5">
                  {(data.results ?? []).map((r, i) => (
                    <motion.a
                      key={r.link + i}
                      href={r.link}
                      target="_blank"
                      rel="noreferrer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="card-bubble group flex gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-pop"
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-2xl text-sm font-black ${POS_TONES[i % POS_TONES.length]}`}>
                        {r.position}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-black text-ink transition-colors group-hover:text-lilac-600">{r.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-minty-600" dir="ltr">
                          <Link2 size={10} /> {r.displayedLink || r.link}
                          {r.date && <span className="text-ink-faint" dir="rtl">• {r.date}</span>}
                        </p>
                        {r.snippet && <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-6 text-ink-soft">{r.snippet}</p>}
                      </div>
                      <ExternalLink size={14} className="mt-1 shrink-0 text-ink-faint transition-colors group-hover:text-lilac-600" />
                    </motion.a>
                  ))}
                </div>

                {/* people also ask */}
                {(data.peopleAlsoAsk?.length ?? 0) > 0 && (
                  <div className="card-bubble p-5">
                    <p className="mb-3 flex items-center gap-1.5 text-sm font-black"><HelpCircle size={15} className="text-butter-500" /> أسئلة يبحث عنها العراقيون — أفكار محتوى وSEO</p>
                    <div className="space-y-2">
                      {data.peopleAlsoAsk!.map((p) => (
                        <div key={p.question} className="rounded-2xl bg-paper p-3">
                          <p className="text-xs font-black">{p.question}</p>
                          {p.snippet && <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-ink-soft">{p.snippet}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* related */}
                {(data.relatedSearches?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-black text-ink-soft">كلمات مرتبطة — استخدمها بعناوين منتجاتك</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.relatedSearches!.map((s) => (
                        <button key={s} onClick={() => run(s)} className="rounded-full bg-lilac-100 px-3.5 py-1.5 text-[11px] font-black text-lilac-700 transition-transform hover:scale-105">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
