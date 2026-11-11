import { Backpack, BookOpen, CreditCard, Headphones, LayoutGrid, Package, PenLine, PlugZap, Plus, Sparkles, Users } from 'lucide-react';

// Mock content copied from the Figma file (hSPCnVwtsuMN4rrYEWRcSm). Replace with API data later.
export const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const WS_USER = { name: 'Alex Morgan', org: 'Campus Collective · Free', email: 'alex@campus.edu' };

export const NAV = [
  { to: '/ws', label: 'Dashboard', Icon: LayoutGrid, match: (p) => p === '/ws' },
  { to: '/ws/groups', label: 'Group Buys', Icon: Users, match: (p) => p.startsWith('/ws/groups') || p.startsWith('/ws/deals') },
  { to: '/ws/create', label: 'Create Group Buy', Icon: Plus, match: (p) => p.startsWith('/ws/create') },
  { to: '/ws/orders', label: 'Orders', Icon: Package, match: (p) => p.startsWith('/ws/orders') },
  { to: '/ws/payments', label: 'Payments', Icon: CreditCard, match: (p) => p.startsWith('/ws/payments') },
  { to: '/ws/assistant', label: 'AI Assistant', Icon: Sparkles, match: (p) => p.startsWith('/ws/assistant') },
];

export const STATS = [
  { label: 'Total Savings', value: '$1,284.00', note: '↑ 18.6% this month', up: true },
  { label: 'Active Group Buys', value: '03', note: '2 closing this week' },
  { label: 'Items Ordered', value: '48', note: 'Across 8 group orders' },
  { label: 'CO₂ Reduced', value: '12.4 kg', note: 'Fewer shared deliveries' },
];

export const SAVINGS = [
  { m: 'Jun', v: 214 }, { m: 'Jul', v: 314 }, { m: 'Aug', v: 271 },
  { m: 'Sep', v: 414 }, { m: 'Oct', v: 500 }, { m: 'Nov', v: 586 },
];

export const PRODUCTS = [
  { id: 'hp', name: 'Wireless Headphones', price: 60, pct: 30, cat: 'Electronics', Icon: Headphones },
  { id: 'ch', name: '65W USB-C Charger', price: 24, pct: 25, cat: 'Electronics', Icon: PlugZap },
  { id: 'nb', name: 'Classic Notebook', price: 12, pct: 33, cat: 'Stationery', Icon: BookOpen },
  { id: 'sk', name: 'Study Essentials Kit', price: 16, pct: 25, cat: 'Stationery', Icon: PenLine },
  { id: 'ev', name: 'Everyday Essentials', price: 20, pct: 25, cat: 'Daily essentials', Icon: Backpack },
];

export const DEALS = [
  { id: 'ss', brand: 'SoundSource', price: 42, discount: '30%', shipping: 40, delivery: 'Nov 18', rating: '4.9', best: true },
  { id: 'bw', brand: 'BulkWise', price: 45, discount: '25%', shipping: 0, delivery: 'Nov 20', rating: '4.7' },
  { id: 'td', brand: 'TechDirect', price: 44, discount: '26.7%', shipping: 40, delivery: 'Nov 19', rating: '4.8' },
];

export const NOTIFICATIONS = [
  { title: 'Your group is almost ready', body: '18 of 20 members have joined Campus Audio Club.' },
  { title: 'Your group order has shipped' },
];

export const TRACKING = {
  ref: 'SoundSource · SS-104829576',
  events: [['Nov 18 · 09:42', 'Shipped from fulfillment center'], ['Nov 15 · 14:10', 'Group order prepared']],
  eta: 'Expected delivery: Nov 18 before 6 PM',
};

export const DEFAULT_GROUP = {
  name: 'Campus Audio Club',
  description: 'Wireless headphones for study sessions, shared savings for everyone.',
  category: 'Electronics', target: 20, budget: 60, deadline: '2026-11-14',
  selected: ['hp'], qty: 20,
  invites: [
    { name: 'Alex Morgan', note: 'Organizer' },
    { name: 'Jamie Lee', note: 'Invite pending' },
    { name: 'Taylor Chen', note: 'Invite pending' },
  ],
};
