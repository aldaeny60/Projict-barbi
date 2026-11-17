export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
      <div className="shimmer h-9 w-64 rounded-2xl" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-10 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer aspect-[3/4.6] rounded-[1.75rem]" />
        ))}
      </div>
    </div>
  );
}
