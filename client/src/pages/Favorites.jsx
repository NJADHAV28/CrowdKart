import { Link } from 'react-router-dom';
import { useCart } from '../state/cart.jsx';
import { Empty, PageHeader, ProductCard } from '../components/ui.jsx';

export default function Favorites() {
  const { favs } = useCart();
  const list = Object.values(favs);
  return (
    <div className="px-4 pt-4 md:px-6">
      <PageHeader title="Favourites" back="/" />
      {!list.length && <Empty title="No favourites yet" text="Tap the heart on any item to save it here." action={<Link to="/explore" className="btn-primary mt-4">Browse items</Link>} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {list.map(({ item, store }) => <ProductCard key={`${store.id}:${item.id}`} item={item} store={store} />)}
      </div>
    </div>
  );
}
