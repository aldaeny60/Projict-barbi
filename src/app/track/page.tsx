import { Suspense } from "react";
import { TrackClient } from "@/components/TrackClient";

export const metadata = {
  title: "تتبع طلبك",
  description: "تتبعي حالة طلبك من باربي برقم هاتفك — من التأكيد حتى التسليم.",
};

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="shimmer h-80 rounded-3xl" />
        </div>
      }
    >
      <TrackClient />
    </Suspense>
  );
}
