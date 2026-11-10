// Product catalogue for real stores. Map providers give store names, types and locations but
// not live menus, so each store starts with the full range for its type. Merchants edit it in
// Merchant Connect. Every product has a real photo (see tools/fetch-product-images.mjs).
//
// Row format: [name, price ₹, unit, tag, wikipedia title for the photo, short description]

export const CATALOG_VERSION = 3;

const T = {
  pizza: [
    ['Margherita Pizza', 249, 'Medium', 'Pizza', 'Pizza_Margherita', 'Classic tomato sauce, mozzarella and fresh basil on a hand-tossed base.'],
    ['Farmhouse Pizza', 329, 'Medium', 'Pizza', 'Pizza', 'Capsicum, onion, tomato and mushroom with extra cheese.'],
    ['Paneer Tikka Pizza', 349, 'Medium', 'Pizza', 'Paneer_tikka', 'Tandoori paneer, onion and capsicum with spicy makhani sauce.'],
    ['Pepperoni Pizza', 389, 'Medium', 'Pizza', 'Pepperoni', 'Loaded with pepperoni slices and mozzarella.'],
    ['Garlic Bread', 129, '4 pcs', 'Sides', 'Garlic_bread', 'Toasted bread with garlic butter and herbs.'],
    ['Pasta Arrabbiata', 219, '1 bowl', 'Pasta', 'Arrabbiata_sauce', 'Penne in a spicy tomato and garlic sauce.'],
    ['Chocolate Lava Cake', 109, '1 pc', 'Desserts', 'Molten_chocolate_cake', 'Warm chocolate cake with a gooey centre.'],
    ['Coca-Cola', 60, '500 ml', 'Drinks', 'Coca-Cola', 'Chilled soft drink.'],
  ],
  burger: [
    ['Classic Veg Burger', 129, '1 pc', 'Burgers', 'Veggie_burger', 'Crispy veg patty, lettuce, tomato and mayo.'],
    ['Crispy Chicken Burger', 169, '1 pc', 'Burgers', 'Chicken_sandwich', 'Fried chicken fillet with spicy sauce.'],
    ['Cheese Burger', 159, '1 pc', 'Burgers', 'Cheeseburger', 'Grilled patty with a slice of melted cheese.'],
    ['French Fries', 99, 'Medium', 'Sides', 'French_fries', 'Golden, salted potato fries.'],
    ['Chicken Nuggets', 149, '6 pcs', 'Sides', 'Chicken_nugget', 'Bite-sized crispy chicken with dip.'],
    ['Onion Rings', 109, '8 pcs', 'Sides', 'Onion_ring', 'Battered and fried onion rings.'],
    ['Chocolate Milkshake', 139, '350 ml', 'Drinks', 'Milkshake', 'Thick chocolate shake.'],
    ['Hot Dog', 119, '1 pc', 'Burgers', 'Hot_dog', 'Sausage in a soft bun with mustard.'],
  ],
  chinese: [
    ['Veg Hakka Noodles', 160, '1 plate', 'Noodles', 'Hakka_noodles', 'Wok-tossed noodles with vegetables.'],
    ['Chicken Fried Rice', 190, '1 plate', 'Rice', 'Fried_rice', 'Fried rice with egg, chicken and spring onion.'],
    ['Veg Manchurian', 170, '1 plate', 'Starters', 'Manchurian_(dish)', 'Vegetable balls in spicy Manchurian gravy.'],
    ['Chilli Paneer', 210, '1 plate', 'Starters', 'commons:chilli paneer dish', 'Paneer tossed with capsicum and chilli sauce.'],
    ['Spring Rolls', 140, '4 pcs', 'Starters', 'Spring_roll', 'Crispy rolls stuffed with vegetables.'],
    ['Veg Momos', 120, '8 pcs', 'Momos', 'Momo_(food)', 'Steamed dumplings with spicy chutney.'],
    ['Hot and Sour Soup', 120, '1 bowl', 'Soups', 'Hot_and_sour_soup', 'Tangy, peppery vegetable soup.'],
  ],
  cafe: [
    ['Cappuccino', 140, 'Regular', 'Coffee & tea', 'Cappuccino', 'Espresso with steamed milk foam.'],
    ['Cold Coffee', 150, '350 ml', 'Coffee & tea', 'Iced_coffee', 'Chilled coffee blended with milk and ice.'],
    ['Cafe Latte', 150, 'Regular', 'Coffee & tea', 'Latte', 'Espresso with plenty of steamed milk.'],
    ['Masala Chai', 40, '1 cup', 'Coffee & tea', 'Masala_chai', 'Indian spiced milk tea.'],
    ['Green Tea', 80, '1 cup', 'Coffee & tea', 'Green_tea', 'Light and refreshing green tea.'],
    ['Veg Club Sandwich', 130, '1 pc', 'Snacks', 'Club_sandwich', 'Triple-decker sandwich with veggies and cheese.'],
    ['Chocolate Brownie', 110, '1 pc', 'Desserts', 'Chocolate_brownie', 'Fudgy chocolate brownie.'],
    ['Blueberry Muffin', 120, '1 pc', 'Desserts', 'Muffin', 'Soft muffin with blueberries.'],
    ['Croissant', 90, '1 pc', 'Snacks', 'Croissant', 'Buttery, flaky French pastry.'],
  ],
  bakery: [
    ['White Bread', 45, '400 g', 'Bread', 'White_bread', 'Soft sandwich bread.'],
    ['Brown Bread', 50, '400 g', 'Bread', 'Brown_bread', 'Whole wheat sandwich bread.'],
    ['Veg Puff', 30, '1 pc', 'Snacks', 'Jamaican_patty', 'Flaky pastry with spiced vegetable filling.'],
    ['Black Forest Pastry', 80, '1 pc', 'Cakes', 'Black_Forest_gateau', 'Chocolate sponge with cream and cherries.'],
    ['Chocolate Cake', 450, '500 g', 'Cakes', 'Chocolate_cake', 'Rich chocolate cake for celebrations.'],
    ['Butter Cookies', 120, '250 g', 'Cookies', 'Butter_cookie', 'Crisp, buttery cookies.'],
    ['Donut', 60, '1 pc', 'Desserts', 'Doughnut', 'Glazed ring doughnut.'],
    ['Rusk', 55, '300 g', 'Snacks', 'Rusk', 'Twice-baked crisp toast, great with chai.'],
  ],
  snacks: [
    ['Vada Pav', 25, '1 pc', 'Fast food', 'Vada_pav', 'Spiced potato fritter in a soft pav with chutney.'],
    ['Samosa', 30, '2 pcs', 'Fast food', 'Samosa', 'Crispy pastry with spiced potato filling.'],
    ['Pav Bhaji', 110, '1 plate', 'Fast food', 'Pav_bhaji', 'Buttery mashed vegetable curry with pav.'],
    ['Misal Pav', 90, '1 plate', 'Fast food', 'Misal_pav', 'Spicy sprouts curry topped with farsan.'],
    ['Masala Dosa', 90, '1 pc', 'South Indian', 'Masala_dosa', 'Crisp dosa with potato masala, sambar and chutney.'],
    ['Idli Sambar', 60, '2 pcs', 'South Indian', 'Idli', 'Steamed rice cakes with sambar.'],
    ['Medu Vada', 60, '2 pcs', 'South Indian', 'Medu_vada', 'Crispy lentil doughnuts with chutney.'],
    ['Poha', 45, '1 plate', 'Breakfast', 'Flattened_rice', 'Flattened rice with onion, peanuts and lemon.'],
    ['Kanda Bhaji', 60, '1 plate', 'Fast food', 'Pakora', 'Crispy onion fritters.'],
    ['Cutting Chai', 15, '1 cup', 'Coffee & tea', 'Masala_chai', 'Half cup of strong tea.'],
  ],
  indian: [
    ['Paneer Butter Masala', 240, '1 bowl', 'Curries', 'Paneer_makhani', 'Paneer in a rich tomato and butter gravy.'],
    ['Dal Tadka', 170, '1 bowl', 'Curries', 'Dal', 'Yellow lentils tempered with garlic and cumin.'],
    ['Veg Biryani', 200, '1 plate', 'Biryani', 'Biryani', 'Fragrant basmati rice cooked with vegetables and spices.'],
    ['Chicken Biryani', 260, '1 plate', 'Biryani', 'Hyderabadi_biryani', 'Dum-cooked rice with spiced chicken.'],
    ['Butter Chicken', 290, '1 bowl', 'Curries', 'Butter_chicken', 'Tandoori chicken in creamy tomato gravy.'],
    ['Chicken Tandoori', 300, 'Half', 'Starters', 'Tandoori_chicken', 'Chicken marinated in yoghurt and spices, roasted in a tandoor.'],
    ['Butter Naan', 45, '1 pc', 'Breads', 'Naan', 'Soft leavened bread with butter.'],
    ['Tandoori Roti', 25, '1 pc', 'Breads', 'Roti', 'Whole wheat bread from the tandoor.'],
    ['Jeera Rice', 130, '1 plate', 'Rice', 'Jeera_rice', 'Basmati rice with cumin.'],
    ['Veg Thali', 180, '1 thali', 'Thali', 'Thali', 'Two sabzis, dal, rice, roti, salad and sweet.'],
    ['Gulab Jamun', 70, '2 pcs', 'Desserts', 'Gulab_jamun', 'Soft milk dumplings in sugar syrup.'],
    ['Sweet Lassi', 70, '300 ml', 'Drinks', 'Lassi', 'Chilled sweet yoghurt drink.'],
  ],
  icecream: [
    ['Vanilla Ice Cream', 60, '1 scoop', 'Ice cream', 'Vanilla_ice_cream', 'Classic vanilla.'],
    ['Chocolate Ice Cream', 70, '1 scoop', 'Ice cream', 'Chocolate_ice_cream', 'Rich chocolate.'],
    ['Strawberry Ice Cream', 70, '1 scoop', 'Ice cream', 'Strawberry_ice_cream', 'Made with real strawberries.'],
    ['Chocolate Sundae', 140, '1 cup', 'Desserts', 'Sundae', 'Ice cream with chocolate sauce and nuts.'],
    ['Mango Kulfi', 70, '1 stick', 'Ice cream', 'Kulfi', 'Traditional frozen dessert with mango.'],
    ['Falooda', 150, '1 glass', 'Desserts', 'Falooda', 'Rose milk, vermicelli, basil seeds and ice cream.'],
  ],
  grocery: [
    ['Bananas', 60, '1 dozen', 'Fruits', 'Banana', 'Fresh, naturally ripened bananas.'],
    ['Apples', 180, '1 kg', 'Fruits', 'Apple', 'Crisp and juicy Shimla apples.'],
    ['Oranges', 120, '1 kg', 'Fruits', 'Orange_(fruit)', 'Sweet Nagpur oranges.'],
    ['Watermelon', 60, '1 pc (~2 kg)', 'Fruits', 'Watermelon', 'Sweet, refreshing watermelon.'],
    ['Pomegranate', 160, '1 kg', 'Fruits', 'Pomegranate', 'Ruby red arils, full of flavour.'],
    ['Grapes', 100, '500 g', 'Fruits', 'Grape', 'Seedless green grapes from Sangli.'],
    ['Mangoes', 350, '1 kg', 'Fruits', 'Mango', 'Seasonal Alphonso mangoes.'],
    ['Papaya', 50, '1 pc', 'Fruits', 'commons:papaya fruit cut half', 'Ripe papaya.'],
    ['Onion', 40, '1 kg', 'Vegetables', 'Onion', 'Fresh red onions.'],
    ['Tomato', 36, '1 kg', 'Vegetables', 'Tomato', 'Farm-fresh tomatoes.'],
    ['Potato', 35, '1 kg', 'Vegetables', 'Potato', 'Everyday potatoes.'],
    ['Green Beans', 60, '500 g', 'Vegetables', 'Green_bean', 'Tender French beans.'],
    ['Carrot', 50, '500 g', 'Vegetables', 'Carrot', 'Sweet orange carrots.'],
    ['Cauliflower', 40, '1 pc', 'Vegetables', 'Cauliflower', 'Fresh white cauliflower.'],
    ['Capsicum', 40, '250 g', 'Vegetables', 'Bell_pepper', 'Green capsicum.'],
    ['Spinach', 30, '1 bunch', 'Vegetables', 'Spinach', 'Fresh palak leaves.'],
    ['Broccoli', 80, '1 pc', 'Vegetables', 'Broccoli', 'Fresh green broccoli.'],
    ['Lemon', 20, '4 pcs', 'Vegetables', 'Lemon', 'Juicy lemons.'],
    ['Coriander', 15, '1 bunch', 'Vegetables', 'commons:fresh coriander leaves bunch', 'Fresh coriander leaves.'],
    ['Toned Milk', 66, '1 L', 'Dairy & eggs', 'Milk', 'Fresh toned milk.'],
    ['Curd', 45, '400 g', 'Dairy & eggs', 'Dahi_(curd)', 'Thick set curd.'],
    ['Paneer', 95, '200 g', 'Dairy & eggs', 'Paneer', 'Soft fresh paneer.'],
    ['Butter', 58, '100 g', 'Dairy & eggs', 'Butter', 'Salted table butter.'],
    ['Cheese Slices', 140, '10 slices', 'Dairy & eggs', 'Processed_cheese', 'Processed cheese slices.'],
    ['Eggs', 96, '12 pcs', 'Dairy & eggs', 'Egg_as_food', 'Farm fresh white eggs.'],
    ['Basmati Rice', 150, '1 kg', 'Staples', 'Basmati', 'Long-grain aged basmati rice.'],
    ['Whole Wheat Atta', 260, '5 kg', 'Staples', 'Atta_flour', 'Stone-ground whole wheat flour.'],
    ['Toor Dal', 170, '1 kg', 'Staples', 'commons:toor dal split pigeon peas', 'Unpolished split pigeon peas.'],
    ['Sugar', 48, '1 kg', 'Staples', 'Sugar', 'Refined white sugar.'],
    ['Sunflower Oil', 155, '1 L', 'Staples', 'Sunflower_oil', 'Refined sunflower cooking oil.'],
    ['Salt', 28, '1 kg', 'Staples', 'Sea_salt', 'Iodised table salt.'],
    ['Tea Powder', 140, '250 g', 'Coffee & tea', 'Tea', 'Strong CTC tea.'],
    ['Instant Coffee', 190, '50 g', 'Coffee & tea', 'Instant_coffee', 'Rich instant coffee.'],
    ['Potato Chips', 20, '52 g', 'Snacks', 'Potato_chip', 'Classic salted chips.'],
    ['Biscuits', 30, '200 g', 'Snacks', 'Biscuit', 'Crunchy tea-time biscuits.'],
    ['Instant Noodles', 14, '70 g', 'Snacks', 'Instant_noodle', 'Two-minute masala noodles.'],
    ['Peanuts', 70, '500 g', 'Snacks', 'commons:peanuts in bowl', 'Raw peanuts.'],
    ['Orange Juice', 120, '1 L', 'Drinks', 'Orange_juice', '100% orange juice.'],
    ['Mineral Water', 20, '1 L', 'Drinks', 'Bottled_water', 'Packaged drinking water.'],
    ['Detergent Powder', 120, '1 kg', 'Household', 'commons:washing powder detergent', 'Washing powder for clothes.'],
    ['Dishwash Bar', 35, '3 pcs', 'Household', 'Dishwashing_liquid', 'Removes grease easily.'],
    ['Bath Soap', 45, '1 pc', 'Household', 'Soap', 'Gentle everyday bathing soap.'],
    ['Toothpaste', 95, '150 g', 'Household', 'Toothpaste', 'Fluoride toothpaste.'],
  ],
  pharmacy: [
    ['Paracetamol 650', 32, '15 tablets', 'Medicines', 'commons:paracetamol tablets', 'For fever and mild pain. Use as directed.'],
    ['ORS Sachets', 88, '4 sachets', 'Medicines', 'Oral_rehydration_therapy', 'Oral rehydration salts.'],
    ['Cough Syrup', 110, '100 ml', 'Medicines', 'Cough_medicine', 'Relief from cough. Use as directed.'],
    ['Vitamin C Tablets', 120, '15 tablets', 'Wellness', 'commons:effervescent tablets vitamin', 'Daily immunity support.'],
    ['Hand Sanitizer', 95, '200 ml', 'Personal care', 'Hand_sanitizer', 'Kills 99.9% of germs.'],
    ['Adhesive Bandages', 50, '20 strips', 'First aid', 'Adhesive_bandage', 'Waterproof bandages.'],
    ['Antiseptic Liquid', 110, '125 ml', 'First aid', 'Antiseptic', 'For cuts and wounds.'],
    ['Digital Thermometer', 220, '1 pc', 'Devices', 'Thermometer', 'Fast and accurate readings.'],
    ['Face Masks', 99, '10 pcs', 'Personal care', 'Surgical_mask', '3-ply disposable masks.'],
    ['Cotton Wool', 60, '100 g', 'First aid', 'Cotton_wool', 'Absorbent cotton.'],
  ],
  stationery: [
    ['Long Notebook', 60, '200 pages', 'Notebooks', 'Notebook', 'Single-line ruled notebook.'],
    ['Gel Pens', 50, '5 pcs', 'Writing', 'Gel_pen', 'Smooth blue gel pens.'],
    ['Pencils', 40, '10 pcs', 'Writing', 'Pencil', 'HB pencils.'],
    ['A4 Paper', 280, '500 sheets', 'Paper', 'commons:A4 copy paper sheets', '75 GSM printer paper.'],
    ['Geometry Box', 120, '1 set', 'School', 'Compass_(drawing_tool)', 'Compass, divider, scale and protractor.'],
    ['Highlighters', 90, '4 pcs', 'Writing', 'Marker_pen', 'Assorted fluorescent colours.'],
    ['Stapler', 110, '1 pc', 'Office', 'Stapler', 'With 1000 pins.'],
    ['Envelopes', 60, '25 pcs', 'Office', 'Envelope', 'Plain white paper envelopes.'],
    ['Scissors', 70, '1 pc', 'Office', 'Scissors', 'Stainless steel scissors.'],
    ['Glue Stick', 35, '15 g', 'School', 'Glue_stick', 'Non-toxic glue stick.'],
  ],
  electronics: [
    ['USB-C Cable', 299, '1 m', 'Cables & chargers', 'USB-C', 'Fast-charging USB-C cable.'],
    ['20W Fast Charger', 799, '1 pc', 'Cables & chargers', 'commons:USB wall charger adapter', 'USB-C power adapter.'],
    ['Wired Earphones', 499, '1 pc', 'Audio', 'Headphones', 'In-ear earphones with mic.'],
    ['Bluetooth Speaker', 1499, '1 pc', 'Audio', 'Bluetooth_speaker', 'Portable wireless speaker.'],
    ['Power Bank', 1299, '10000 mAh', 'Mobile', 'commons:power bank portable charger', 'Dual-output power bank.'],
    ['Wireless Mouse', 449, '1 pc', 'Computer', 'Computer_mouse', '2.4 GHz wireless mouse.'],
    ['Keyboard', 699, '1 pc', 'Computer', 'Computer_keyboard', 'Full-size USB keyboard.'],
    ['Extension Board', 549, '4 sockets', 'Home', 'Power_strip', 'With surge protection.'],
    ['AA Batteries', 120, '4 pcs', 'Home', 'AA_battery', 'Long-lasting alkaline batteries.'],
    ['LED Bulb', 99, '9 W', 'Home', 'LED_lamp', 'Bright, energy-saving bulb.'],
  ],
  fashion: [
    ['Cotton T-Shirt', 399, '1 pc', 'Men', 'T-shirt', 'Soft round-neck cotton T-shirt.'],
    ['Slim Fit Jeans', 1299, '1 pc', 'Men', 'Jeans', 'Stretchable denim jeans.'],
    ['Hoodie', 999, '1 pc', 'Winter wear', 'Hoodie', 'Fleece-lined pullover hoodie.'],
    ['Cotton Kurta', 899, '1 pc', 'Ethnic', 'Kurta', 'Breathable everyday kurta.'],
    ['Saree', 1499, '1 pc', 'Ethnic', 'Sari', 'Printed cotton saree.'],
    ['Ankle Socks', 199, '3 pairs', 'Accessories', 'Sock', 'Cotton ankle socks.'],
    ['Baseball Cap', 299, '1 pc', 'Accessories', 'Baseball_cap', 'Adjustable cotton cap.'],
    ['Sneakers', 1799, '1 pair', 'Footwear', 'Sneakers', 'Lightweight everyday sneakers.'],
    ['Flip Flops', 249, '1 pair', 'Footwear', 'Flip-flops', 'Comfortable rubber slippers.'],
  ],
};

export const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Every distinct product with its photo source (used by the image downloader). */
export function allProducts() {
  const seen = new Map();
  for (const rows of Object.values(T)) for (const [name, , , , wiki] of rows) if (!seen.has(slug(name))) seen.set(slug(name), { slug: slug(name), name, wiki });
  return [...seen.values()];
}

/** Which template a store gets, from its map tags. */
export function menuKind(category, cuisine = '', name = '') {
  const c = `${cuisine} ${name}`.toLowerCase();
  if (category !== 'food') return category;
  if (/pizza/.test(c)) return 'pizza';
  if (/burger|fried_chicken|kfc|hamburger/.test(c)) return 'burger';
  if (/chinese|asian|noodle|momo/.test(c)) return 'chinese';
  if (/ice_cream|ice cream|kulfi|dessert/.test(c)) return 'icecream';
  if (/bakery|cake|bake|confection/.test(c)) return 'bakery';
  if (/coffee|cafe|café|tea/.test(c)) return 'cafe';
  if (/vada|snack|street|fast|chaat|misal|dosa|south_indian|idli|sandwich/.test(c)) return 'snacks';
  return 'indian';
}

export const prepFor = (kind) => ({ pizza: 18, burger: 12, chinese: 16, cafe: 8, bakery: 5, snacks: 10, indian: 20, icecream: 5, grocery: 8, pharmacy: 5, stationery: 6, electronics: 8, fashion: 10 }[kind] || 10);

/** The store's full range, with small per-store price differences so shops aren't identical. */
export function buildMenu(storeId, kind) {
  const rows = T[kind] || T.grocery;
  let h = 0;
  for (const ch of storeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return rows.map(([name, price, unit, tag, , desc], i) => {
    const drift = 1 + ((((h >> (i % 24)) & 15) - 7) / 100); // ±7%
    return { id: slug(name), name, price: Math.max(10, Math.round((price * drift) / 5) * 5), unit, tag, desc, img: `products/${slug(name)}.jpg` };
  });
}
