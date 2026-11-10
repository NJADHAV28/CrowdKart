import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Nearby stores + products, fetched once and shared by every page.
const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

export function DataProvider({ user, children }) {
  const [stores, setStores] = useState(null);
  const [products, setProducts] = useState(null);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!user || user.role !== 'customer') return;
    setError('');
    Promise.all([api.get('/merchants'), api.get('/products')])
      .then(([s, p]) => { setStores(s); setProducts(p.products); setTags(p.tags); })
      .catch((e) => { setError(e.message); setStores((x) => x || []); setProducts((x) => x || []); });
  }, [user?.id, user?.location?.[0], user?.location?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const value = useMemo(() => ({
    stores, products, tags, error, reload: load,
    storeById: (id) => stores?.find((s) => s.id === id),
    loading: stores === null,
  }), [stores, products, tags, error, load]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
