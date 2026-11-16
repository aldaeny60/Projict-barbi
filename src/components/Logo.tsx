import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-blush-300 via-lilac-300 to-aqua-300 shadow-soft transition-transform duration-300 group-hover:rotate-12 group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-6 text-white drop-shadow" fill="currentColor">
          <path d="M12 2.6l2.4 4.9 5.4.8c.6.1.8.8.4 1.2l-3.9 3.8.9 5.4c.1.6-.5 1-1 .8L12 17.2 7.8 19.5c-.5.2-1.1-.2-1-.8l.9-5.4-3.9-3.8c-.4-.4-.2-1.1.4-1.2l5.4-.8z" />
        </svg>
        <span className="absolute -top-1 -left-1 size-3 rounded-full bg-butter-300 ring-2 ring-paper" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[22px] font-black tracking-tight">
            باربي
          </span>
          <span className="block text-[10px] font-bold text-ink-soft">
            BARBI KIDS • العراق
          </span>
        </span>
      )}
    </Link>
  );
}
