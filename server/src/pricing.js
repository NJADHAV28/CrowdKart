import { config } from './config.js';
import { haversineKm } from './geo.js';

export const ROAD_FACTOR = 1.3; // straight-line → road distance estimate
const D = () => config.delivery;

/** What this order would cost to deliver on its own (the honest baseline). */
export function soloDeliveryFee(merchant, drop) {
  const km = haversineKm(merchant.location, drop) * ROAD_FACTOR;
  return Math.round(D().baseFee + D().perKm * km);
}

export function riderTripCost(routeKm, pickups, drops = 1) {
  return Math.round(D().baseFee + D().perKm * routeKm + D().perExtraStop * Math.max(0, pickups - 1) + D().perExtraDrop * Math.max(0, drops - 1));
}

export function discountPct(merchant, ordersFromMerchant) {
  let pct = 0;
  for (const t of merchant.groupDiscount || []) if (ordersFromMerchant >= t.minOrders) pct = t.pct;
  return pct;
}

/**
 * Bill every member. Delivery cost is split equally; if that would make anyone pay more
 * than their solo fee, it switches to a proportional split so joining never costs more.
 */
export function computeBills({ orders, merchants, groupDeliveryCost }) {
  const perMerchantCount = {};
  for (const o of orders) perMerchantCount[o.merchantId] = (perMerchantCount[o.merchantId] || 0) + 1;
  const solo = orders.map((o) => soloDeliveryFee(merchants[o.merchantId], o.location));
  const soloTotal = solo.reduce((a, b) => a + b, 0);
  const n = orders.length;
  let allocation = 'equal';
  let shares = orders.map(() => groupDeliveryCost / n);
  if (shares.some((s, i) => s > solo[i])) {
    allocation = 'proportional';
    shares = solo.map((s) => (groupDeliveryCost * s) / soloTotal);
  }
  const bills = orders.map((o, i) => {
    const pct = n > 1 ? discountPct(merchants[o.merchantId], perMerchantCount[o.merchantId]) : 0;
    const promo = o.promo?.pct || 0;
    const discount = Math.round((o.subtotal * (pct + promo)) / 100);
    const deliveryShare = Math.round(shares[i]);
    const tip = o.tip || 0; // goes to the delivery partner
    const total = o.subtotal - discount + deliveryShare + tip;
    const soloTotalPay = o.subtotal + solo[i] + tip;
    return { orderId: o.id, subtotal: o.subtotal, discountPct: pct, promoPct: promo, promoCode: o.promo?.code || null, tip, discount, soloDeliveryFee: solo[i], deliveryShare, total, soloTotal: soloTotalPay, saving: soloTotalPay - total };
  });
  return {
    allocation,
    bills,
    totals: {
      baselineDelivery: soloTotal,
      groupDelivery: groupDeliveryCost,
      deliverySaved: soloTotal - groupDeliveryCost,
      discounts: bills.reduce((a, b) => a + b.discount, 0),
      grandTotal: bills.reduce((a, b) => a + b.total, 0),
    },
  };
}
