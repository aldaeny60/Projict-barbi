import { Suspense } from "react";
import { ShopClient } from "@/components/ShopClient";

export const metadata = { title: "تسوقي ملابس الأطفال" };

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-10 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer aspect-[3/4] rounded-3xl" />
          ))}
        </div>
      }
    >
      <ShopClient />
    </Suspense>
  );
}
