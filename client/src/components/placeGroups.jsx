// Shop / place types shared by Home, Places near you and the map (no map code here, so it stays light).
import { BedDouble, Coffee, Croissant, Pill, Shirt, ShoppingBasket, Smartphone, UtensilsCrossed, PencilLine } from 'lucide-react';

export const GROUPS = {
  restaurants: { label: 'Restaurants', one: 'Restaurant', color: '#e4572e', soft: '#fdece7', Icon: UtensilsCrossed, gq: 'restaurants' },
  bakeries: { label: 'Bakeries', one: 'Bakery', color: '#c27c2c', soft: '#fbf1e3', Icon: Croissant, gq: 'bakeries' },
  cafes: { label: 'Cafés', one: 'Café', color: '#8d5b3e', soft: '#f3ede7', Icon: Coffee, gq: 'cafes' },
  grocery: { label: 'Grocery', one: 'Grocery', color: '#2fa866', soft: '#e7f5ed', Icon: ShoppingBasket, gq: 'grocery stores' },
  pharmacy: { label: 'Pharmacy', one: 'Pharmacy', color: '#1d6fd1', soft: '#e9f1fb', Icon: Pill, gq: 'pharmacy' },
  electronics: { label: 'Electronics', one: 'Electronics', color: '#3d5466', soft: '#ecf0f3', Icon: Smartphone, gq: 'electronics shops' },
  fashion: { label: 'Clothing', one: 'Clothing', color: '#7c3aa0', soft: '#f4ecf8', Icon: Shirt, gq: 'clothing stores' },
  stationery: { label: 'Stationery', one: 'Stationery', color: '#4b4fb0', soft: '#eef0fa', Icon: PencilLine, gq: 'stationery shops' },
  hotels: { label: 'Hotels', one: 'Hotel', color: '#6c5ce7', soft: '#efedfd', Icon: BedDouble, gq: 'hotels' },
};

export function placeGroup(p) {
  if (p.category === 'hotel') return 'hotels';
  if (p.kind === 'bakery') return 'bakeries';
  if (p.kind === 'cafe') return 'cafes';
  if (p.category === 'food') return 'restaurants';
  return GROUPS[p.category] ? p.category : 'grocery';
}

export function GroupIcon({ group, size = 48, radius = 14 }) {
  const g = GROUPS[group] || GROUPS.grocery;
  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: size, height: size, borderRadius: radius, background: g.soft, color: g.color }}>
      <g.Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </div>
  );
}
