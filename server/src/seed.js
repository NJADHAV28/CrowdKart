// Only static reference data lives here. Stores and restaurants are loaded live (see places.js).
export const CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'grocery', label: 'Grocery' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'stationery', label: 'Stationery' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'fashion', label: 'Fashion' },
];
export function seed() {
  // Remove any old demo stores/zones from earlier versions.
  return null;
}
