// Shopper-facing categories. Each groups several product tags from the catalogue and has a real
// product photo for its tile. Order = order on the home page.
export const CATEGORIES = [
  { id: 'fruits-veg', label: 'Fruits & Vegetables', tags: ['Fruits', 'Vegetables'], img: 'products/apples.jpg', bg: '#eaf6e3' },
  { id: 'dairy', label: 'Dairy, Bread & Eggs', tags: ['Dairy & eggs', 'Bread'], img: 'products/toned-milk.jpg', bg: '#eef4fb' },
  { id: 'snacks', label: 'Snacks & Munchies', tags: ['Snacks'], img: 'products/potato-chips.jpg', bg: '#fdf1e2' },
  { id: 'drinks', label: 'Tea, Coffee & Drinks', tags: ['Coffee & tea', 'Drinks'], img: 'products/cappuccino.jpg', bg: '#f5ece4' },
  { id: 'staples', label: 'Atta, Rice & Dal', tags: ['Staples'], img: 'products/basmati-rice.jpg', bg: '#f8f1e3' },
  { id: 'bakery', label: 'Bakery & Biscuits', tags: ['Cakes', 'Cookies'], img: 'products/chocolate-cake.jpg', bg: '#fbece9' },
  { id: 'sweet', label: 'Sweet Tooth', tags: ['Desserts', 'Ice cream'], img: 'products/gulab-jamun.jpg', bg: '#fcebf1' },
  { id: 'meals', label: 'Hot Meals', tags: ['Curries', 'Biryani', 'Thali', 'Breads', 'Rice', 'Starters'], img: 'products/chicken-biryani.jpg', bg: '#fdeee6' },
  { id: 'fastfood', label: 'Pizza, Burgers & More', tags: ['Pizza', 'Burgers', 'Sides', 'Pasta', 'Fast food', 'Noodles', 'Momos', 'Soups'], img: 'products/margherita-pizza.jpg', bg: '#fdecea' },
  { id: 'breakfast', label: 'Breakfast & South Indian', tags: ['Breakfast', 'South Indian'], img: 'products/masala-dosa.jpg', bg: '#fdf5e0' },
  { id: 'household', label: 'Cleaning & Household', tags: ['Household'], img: 'products/detergent-powder.jpg', bg: '#e8f3f6' },
  { id: 'pharma', label: 'Pharma & Wellness', tags: ['Medicines', 'Wellness', 'First aid', 'Devices', 'Personal care'], img: 'products/hand-sanitizer.jpg', bg: '#e9f1fb' },
  { id: 'stationery', label: 'Stationery & Office', tags: ['Notebooks', 'Writing', 'Paper', 'School', 'Office'], img: 'products/long-notebook.jpg', bg: '#eef0fa' },
  { id: 'electronics', label: 'Electronics', tags: ['Cables & chargers', 'Audio', 'Mobile', 'Computer', 'Home'], img: 'products/wired-earphones.jpg', bg: '#ecf0f3' },
  { id: 'fashion', label: 'Fashion', tags: ['Men', 'Winter wear', 'Ethnic', 'Accessories', 'Footwear'], img: 'products/sneakers.jpg', bg: '#f4ecf8' },
];

export const categoryOf = (tag) => CATEGORIES.find((c) => c.tags.includes(tag));
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

/** Search hints that rotate in the search box. */
export const SEARCH_HINTS = ['milk', 'bread', 'eggs', 'Lay’s', 'paneer', 'biryani', 'chocolate', 'atta', 'curd', 'Maggi', 'bananas', 'coffee'];

/** Brands for the "Popular brands" row (packaged products from Open Food Facts). */
export const BRAND_ROW = ['Lay’s', 'Amul', 'Maggi', 'Parle-G', 'Britannia', 'Cadbury', 'Haldiram', 'Kurkure', 'Tata Tea', 'Coca-Cola'];

/** One entry per product: the copy from the fastest shop that stocks it. */
export function bestOffers(products = []) {
  const best = new Map();
  for (const p of products) {
    const b = best.get(p.id);
    if (!b || (p.store.etaMin ?? 99) < (b.store.etaMin ?? 99) || ((p.store.etaMin ?? 99) === (b.store.etaMin ?? 99) && p.price < b.price)) best.set(p.id, p);
  }
  return [...best.values()];
}
