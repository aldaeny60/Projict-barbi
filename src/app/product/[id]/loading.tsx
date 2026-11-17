export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
      <div className="shimmer h-5 w-56 rounded-full" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="shimmer aspect-square rounded-[2rem]" />
        <div className="space-y-3">
          <div className="shimmer h-8 w-3/4 rounded-2xl" />
          <div className="shimmer h-5 w-32 rounded-full" />
          <div className="shimmer h-10 w-40 rounded-2xl" />
          <div className="shimmer h-24 w-full rounded-2xl" />
          <div className="shimmer h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
