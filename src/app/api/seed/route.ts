import { db } from "@/db";
import {
  categories,
  products,
  reviews,
  coupons,
  deliveryFees,
  branches,
  shifts,
  orders,
  orderItems,
  customers,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import {
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_COUPONS,
  SEED_DELIVERY,
  SEED_BRANCHES,
  REVIEW_AUTHORS,
  REVIEW_COMMENTS,
} from "@/lib/seed-data";

export const dynamic = "force-dynamic";

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

const WEB_METHODS = ["cod", "cod", "cod", "cod", "cod", "zaincash", "zaincash", "fib", "qicard", "asiahawala", "fastpay"];
const WEIGHTED_STATUSES = [
  "delivered", "delivered", "delivered", "delivered", "delivered", "delivered",
  "pending", "processing", "processing", "shipped", "out_for_delivery", "cancelled", "returned",
];
const NAMES = ["أم محمد", "أم زينب", "أم علي", "أم فاطمة", "أبو حسين", "أم مريم", "أم آية", "زهراء خالد", "أم يوسف", "أم تبارك", "نور الهدى", "أم مرتضى"];
const STAFF = ["علي الجبوري", "حسن الكاظمي", "فاطمة الساعدي"];
const GOVS_WEIGHTED = [
  "بغداد", "بغداد", "بغداد", "بغداد", "بغداد", "بغداد",
  "البصرة", "البصرة", "نينوى", "أربيل", "النجف الأشرف", "كربلاء المقدسة", "بابل", "ديالى",
  "الأنبار", "كركوك", "صلاح الدين", "واسط", "ميسان", "المثنى", "القادسية", "دهوك", "السليمانية", "ذي قار",
];

export async function GET() {
  try {
    const existing = await db.select({ n: sql<number>`count(*)` }).from(products);
    const count = Number(existing[0]?.n ?? 0);
    if (count > 0) {
      return Response.json({ seeded: false, message: "البيانات موجودة مسبقاً", products: count });
    }

    // categories
    const insertedCats = await db
      .insert(categories)
      .values(SEED_CATEGORIES.map((c, i) => ({ ...c, sort: i })))
      .returning();
    const catBySlug = new Map(insertedCats.map((c) => [c.slug, c.id]));

    // products
    const insertedProducts = await db
      .insert(products)
      .values(
        SEED_PRODUCTS.map((p, i) => ({
          slug: p.slug,
          name: p.name,
          description: p.description,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          images: p.images,
          colors: p.colors,
          sizes: p.sizes,
          categoryId: catBySlug.get(p.categorySlug)!,
          barcode: `62${String(1000000000 + i * 37)}`,
          stock: p.stock,
          rating: String(p.rating),
          reviewsCount: p.reviewsCount,
          soldCount: p.soldCount,
          isNew: p.isNew ?? false,
        }))
      )
      .returning();

    // reviews – a few showcased per product
    const rng = mulberry32(20260207);
    const reviewRows = insertedProducts.flatMap((p) => {
      const n = 1 + Math.floor(rng() * 3);
      return Array.from({ length: n }, () => ({
        productId: p.id,
        author: pick(rng, REVIEW_AUTHORS),
        rating: rng() > 0.2 ? 5 : 4,
        comment: pick(rng, REVIEW_COMMENTS),
        createdAt: new Date(Date.now() - Math.floor(rng() * 60) * 86400000 - Math.floor(rng() * 86400000)),
      }));
    });
    if (reviewRows.length) await db.insert(reviews).values(reviewRows);

    // coupons
    await db.insert(coupons).values(
      SEED_COUPONS.map((c) => ({
        ...c,
        active: true,
        expiresAt: c.code === "EID25" ? new Date(Date.now() + 45 * 86400000) : null,
      }))
    );

    // delivery fees
    await db.insert(deliveryFees).values(SEED_DELIVERY);

    // branches
    await db.insert(branches).values(SEED_BRANCHES);

    // customers
    await db.insert(customers).values(
      NAMES.slice(0, 8).map((name, i) => ({ name, phone: `0770${String(1122334 + i * 11111)}` }))
    );

    // shifts: one closed (yesterday) + one open (today) for branch 1
    const [closedShift] = await db
      .insert(shifts)
      .values({
        branchId: 1,
        staffName: "حسن الكاظمي",
        role: "cashier",
        status: "closed",
        openingCash: 100000,
        closingCash: 1325000,
        openedAt: new Date(Date.now() - 86400000),
        closedAt: new Date(Date.now() - 86400000 + 9 * 3600000),
      })
      .returning();
    await db.insert(shifts).values({
      branchId: 1,
      staffName: "علي الجبوري",
      role: "cashier",
      status: "open",
      openingCash: 150000,
    });

    // seeded orders (~46 over the last 30 days)
    const feeByGov = new Map(SEED_DELIVERY.map((d) => [d.governorate, d.fee]));
    let seq = 10001;
    for (let i = 0; i < 46; i++) {
      const daysBack = rng() < 0.3 ? 0 : 1 + Math.floor(rng() * 29);
      const created = new Date(
        Date.now() - daysBack * 86400000 - Math.floor(rng() * 43200000)
      );
      const isPos = rng() < 0.3;
      const itemCount = 1 + Math.floor(rng() * 3);
      const chosen = new Map<number, { qty: number; idx: number }>();
      for (let k = 0; k < itemCount; k++) {
        const idx = Math.floor(rng() * insertedProducts.length);
        chosen.set(idx, { qty: 1 + Math.floor(rng() * 2), idx });
      }
      const items = [...chosen.values()].map(({ idx, qty }) => {
        const p = insertedProducts[idx];
        return {
          productId: p.id,
          name: p.name,
          image: p.images[0] ?? null,
          price: p.price,
          qty,
          size: (p.sizes as string[])[0] ?? null,
          color: (p.colors as { name: string }[])[0]?.name ?? null,
        };
      });
      const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
      const useCoupon = !isPos && rng() < 0.22 && subtotal >= 20000;
      const discount = useCoupon ? Math.round(subtotal * 0.1) : 0;
      const gov = isPos ? null : pick(rng, GOVS_WEIGHTED);
      const delivery = isPos ? 0 : feeByGov.get(gov!) ?? 5000;
      const total = subtotal - discount + delivery;

      let payments: { method: string; amount: number }[];
      let paymentMethod: string;
      if (isPos) {
        if (rng() < 0.25) {
          const cashPart = Math.ceil(total * (0.3 + rng() * 0.4) / 250) * 250;
          payments = [
            { method: "cash", amount: cashPart },
            { method: "zaincash", amount: total - cashPart },
          ];
          paymentMethod = "split";
        } else {
          payments = [{ method: "cash", amount: total }];
          paymentMethod = "cash";
        }
      } else {
        paymentMethod = pick(rng, WEB_METHODS);
        payments = [{ method: paymentMethod, amount: total }];
      }

      const status = isPos ? "delivered" : pick(rng, WEIGHTED_STATUSES);
      const [ord] = await db
        .insert(orders)
        .values({
          code: `${isPos ? "POS" : "SG"}-${seq++}`,
          source: isPos ? "pos" : "web",
          status,
          customerName: isPos ? "زبون كاشير" : pick(rng, NAMES),
          phone: `07${["70", "71", "75", "77", "78", "80", "81", "90"][Math.floor(rng() * 8)]}${String(1000000 + Math.floor(rng() * 8999999)).padStart(7, "0")}`.slice(0, 11),
          governorate: gov,
          district: null,
          address: isPos ? null : "قرب أقرب نقطة دالة",
          paymentMethod,
          payments,
          subtotal,
          discountTotal: discount,
          couponCode: useCoupon ? "WELCOME10" : null,
          deliveryFee: delivery,
          total,
          branchId: isPos ? 1 + Math.floor(rng() * 3) : null,
          shiftId: isPos ? closedShift.id : null,
          staffName: isPos ? pick(rng, STAFF) : null,
          createdAt: created,
        })
        .returning();
      await db.insert(orderItems).values(items.map((it) => ({ ...it, orderId: ord.id })));
    }

    return Response.json({ seeded: true, products: insertedProducts.length, orders: 46 });
  } catch (err) {
    console.error("seed error", err);
    return Response.json({ seeded: false, error: String(err) }, { status: 500 });
  }
}

export const POST = GET;
