import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const RANGES: Record<string, string> = {
  day: "qdr:d",
  week: "qdr:w",
  month: "qdr:m",
  year: "qdr:y",
};

type SerperOrganic = {
  position: number;
  title: string;
  link: string;
  displayedLink?: string;
  snippet?: string;
  date?: string;
};

/**
 * POST { q: string, range?: "day"|"week"|"month"|"year"|"all", gl?, hl?, num? }
 * خادم وسيط لـ Google عبر Serper — المفتاح يُقرأ من process.env ويبقى بالخادم فقط.
 */
export async function POST(req: NextRequest) {
  let body: { q?: string; range?: string; gl?: string; hl?: string; num?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "طلب غير صالح" }, { status: 400 });
  }

  const q = body.q?.trim();
  if (!q || q.length < 2) {
    return Response.json({ ok: false, error: "اكتب عبارة البحث" }, { status: 400 });
  }

  const apiKey = env.serperApiKey;
  if (!apiKey) {
    return Response.json(
      { ok: false, keyMissing: true, error: "أضف SERPER_API_KEY إلى ملف .env ثم أعد التشغيل" },
      { status: 503 }
    );
  }

  const tbs = body.range && RANGES[body.range] ? RANGES[body.range] : undefined;

  try {
    const upstream = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        q,
        gl: body.gl ?? "iq",
        hl: body.hl ?? "ar",
        num: Math.min(Math.max(Number(body.num) || 10, 1), 20),
        ...(tbs ? { tbs } : {}),
      }),
      cache: "no-store",
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return Response.json(
        { ok: false, error: data?.message ?? "خطأ من خدمة البحث" },
        { status: upstream.status === 403 ? 401 : 502 }
      );
    }

    return Response.json({
      ok: true,
      query: q,
      totalResults: data?.searchInformation?.totalResults ?? null,
      answerBox: data?.answerBox ?? null,
      knowledgeGraph: data?.knowledgeGraph
        ? {
            title: data.knowledgeGraph.title,
            type: data.knowledgeGraph.type,
            description: data.knowledgeGraph.description,
            imageUrl: data.knowledgeGraph.imageUrl ?? null,
          }
        : null,
      peopleAlsoAsk: (data?.peopleAlsoAsk ?? []).slice(0, 6).map((p: { question: string; snippet?: string }) => ({
        question: p.question,
        snippet: p.snippet ?? "",
      })),
      results: ((data?.organic ?? []) as SerperOrganic[]).map((r) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        displayedLink: r.displayedLink ?? "",
        snippet: r.snippet ?? "",
        date: r.date ?? null,
      })),
      relatedSearches: (data?.relatedSearches ?? []).slice(0, 8).map((r: { query: string }) => r.query),
    });
  } catch (err) {
    console.error("serper proxy error", err);
    return Response.json({ ok: false, error: "تعذر الاتصال بخدمة البحث" }, { status: 504 });
  }
}
