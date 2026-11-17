import { db } from "@/db";
import { productSizeStock } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * مخزون المقاسات — المصدر الحقيقي لتوفر مقاس بعينه.
 * products.stock يبقى الإجمالي المعروض، ويُحدَّث مع صفوف المقاسات في نفس المعاملة.
 */

export type SizeStock = { size: string; stock: number };

export async function sizeStockMap(productIds: number[]): Promise<Map<number, SizeStock[]>> {
  const map = new Map<number, SizeStock[]>();
  if (!productIds.length) return map;
  const rows = await db
    .select()
    .from(productSizeStock)
    .where(inArray(productSizeStock.productId, productIds));
  for (const r of rows) {
    const list = map.get(r.productId) ?? [];
    list.push({ size: r.size, stock: r.stock });
    map.set(r.productId, list);
  }
  return map;
}

/** توزيع كمية على المقاسات بالترتيب — البذر و إنشاء منتج جديد */
export function distributeStock(total: number, sizes: string[]): SizeStock[] {
  if (!sizes.length) return [];
  const safe = Math.max(0, Math.round(total));
  const per = Math.floor(safe / sizes.length);
  const rem = safe % sizes.length;
  return sizes.map((size, i) => ({ size, stock: per + (i < rem ? 1 : 0) }));
}

/** استبدال صفوف مقاسات منتج (يُستخدم من لوحة التحكم) — يوحّد المقاسات المكررة */
export async function replaceSizeStock(productId: number, rows: SizeStock[]): Promise<void> {
  await db.delete(productSizeStock).where(eq(productSizeStock.productId, productId));
  const unique = new Map<string, number>();
  for (const r of rows) {
    const size = String(r.size ?? "").trim();
    if (!size) continue;
    unique.set(size, Math.max(0, Math.round(r.stock)));
  }
  if (!unique.size) return;
  await db.insert(productSizeStock).values(
    [...unique.entries()].map(([size, stock]) => ({ productId, size, stock }))
  );
}

/**
 * عند تعديل الإجمالي وحده: نضبط المقاس الأول ليكون الفرق،
 * فيبقى مجموع المقاسات مساوياً للإجمالي.
 */
export async function alignSizeStockToTotal(productId: number, total: number): Promise<void> {
  const rows = await db.select().from(productSizeStock).where(eq(productSizeStock.productId, productId));
  if (!rows.length) return;
  const safeTotal = Math.max(0, Math.round(total));
  const others = rows.slice(1).reduce((s, r) => s + r.stock, 0);

  if (safeTotal >= others) {
    // المقاس الأول يستوعب الفرق، فيبقى المجموع مساوياً للإجمالي
    await db
      .update(productSizeStock)
      .set({ stock: safeTotal - others })
      .where(
        and(eq(productSizeStock.productId, productId), eq(productSizeStock.size, rows[0].size))
      );
    return;
  }
  // الإجمالي الجديد أقل من رصيد بقية المقاسات: نصفّر ثم نضع الإجمالي في المقاس الأول
  await db.update(productSizeStock).set({ stock: 0 }).where(eq(productSizeStock.productId, productId));
  await db
    .update(productSizeStock)
    .set({ stock: safeTotal })
    .where(and(eq(productSizeStock.productId, productId), eq(productSizeStock.size, rows[0].size)));
}
