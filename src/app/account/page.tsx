import { Suspense } from "react";
import { AccountClient } from "@/components/AccountClient";

export const metadata = { title: "حسابي" };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-10"><div className="shimmer h-96 rounded-3xl" /></div>}>
      <AccountClient />
    </Suspense>
  );
}
