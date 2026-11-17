import Link from "next/link";
import type { Metadata } from "next";
import { getProductDetail } from "@/lib/server-queries";
import { ProductView } from "@/components/ProductView";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getProductDetail(id);
  if (!data) return { title: "منتج غير موجود" };
  const canonical = `/product/${data.product.slug}`;
  return {
    title: data.product.name,
    description: data.product.description.slice(0, 160),
    alternates: { canonical },
    openGraph: {
      title: data.product.name,
      description: data.product.description.slice(0, 120),
      locale: "ar_IQ",
      url: canonical,
      images: data.product.images.slice(0, 1),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const data = await getProductDetail(id);
  if (!data) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4">
        <div className="card-bubble p-10 text-center">
          <p className="text-2xl font-black">المنتج غير موجود</p>
          <p className="mt-2 text-sm font-semibold text-ink-soft">يمكن تم بيعه بالكامل أو تغيّر رابطه — تصفحي آخر التشكيلات</p>
          <Link href="/shop" className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-black text-white">
            تسوقي الآن
          </Link>
        </div>
      </div>
    );
  }
  const { product, similar, reviews } = data;
  const productUrl = `${SITE.baseUrl.replace(/\/+$/, "")}/product/${product.slug}`;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description,
            image: product.images,
            sku: product.barcode ?? undefined,
            brand: { "@type": "Brand", name: "باربي" },
            offers: {
              "@type": "Offer",
              url: productUrl,
              priceCurrency: "IQD",
              price: product.price,
              availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            },
            aggregateRating:
              product.reviewsCount > 0
                ? {
                    "@type": "AggregateRating",
                    ratingValue: product.rating,
                    reviewCount: product.reviewsCount,
                  }
                : undefined,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "الرئيسية", item: SITE.baseUrl.replace(/\/+$/, "") },
              {
                "@type": "ListItem",
                position: 2,
                name: product.categoryName || "المتجر",
                item: `${SITE.baseUrl.replace(/\/+$/, "")}/shop?category=${product.categorySlug}`,
              },
              { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
            ],
          }),
        }}
      />
      <ProductView product={product} similar={similar} reviews={reviews} />
    </>
  );
}
