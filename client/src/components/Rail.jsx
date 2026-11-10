import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** A titled, horizontally scrolling row with arrow buttons on desktop. */
export default function Rail({ title, subtitle, to, children }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold md:text-xl">{title}</h2>
          {subtitle && <p className="truncate text-xs text-sub">{subtitle}</p>}
        </div>
        {to && <Link to={to} className="shrink-0 text-sm font-semibold text-brand hover:underline">see all</Link>}
      </div>
      <div className="group/rail relative">
        <button onClick={() => scroll(-1)} aria-label="Scroll left" className="absolute -left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,.15)] transition hover:scale-105 md:group-hover/rail:flex"><ChevronLeft size={20} /></button>
        <div ref={ref} className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 md:mx-0 md:px-0 [&>*]:snap-start">
          {children}
        </div>
        <button onClick={() => scroll(1)} aria-label="Scroll right" className="absolute -right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,.15)] transition hover:scale-105 md:group-hover/rail:flex"><ChevronRight size={20} /></button>
      </div>
    </section>
  );
}
