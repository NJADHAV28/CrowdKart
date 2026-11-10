import { Link } from 'react-router-dom';
import { CATEGORIES } from '../lib/taxonomy.js';

/** All categories (bottom-tab "Categories" on phones). */
export default function Categories() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
      <h1 className="mb-4 text-xl font-bold">All categories</h1>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {CATEGORIES.map((c) => (
          <Link key={c.id} to={`/c/${c.id}`} className="group flex flex-col items-center gap-1.5 text-center">
            <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl p-2 transition group-hover:shadow-card" style={{ background: c.bg }}>
              <img src={`./${c.img}`} alt="" loading="lazy" className="h-full w-full rounded-xl object-cover" />
            </span>
            <span className="line-clamp-2 text-xs font-semibold leading-tight">{c.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
