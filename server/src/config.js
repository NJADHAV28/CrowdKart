import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  dataDir: process.env.CROWDKART_DATA_DIR || path.resolve(here, '../data'),
  clientDist: process.env.CROWDKART_CLIENT_DIST || path.resolve(here, '../../client/dist'),

  // AI: OpenAI-compatible router (router.bynara.id). Key comes from .env only.
  ai: {
    baseUrl: (process.env.AI_BASE_URL || 'https://router.bynara.id/v1').replace(/\/$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gemini-2.5-flash',
  },

  // Live store / restaurant data + geocoding.
  // With GOOGLE_MAPS_API_KEY: Google Places (New) + Google Geocoding.
  // Without: OpenStreetMap (Overpass + Nominatim), no key required.
  places: {
    googleKey: process.env.GOOGLE_MAPS_API_KEY || '',
    tomtomKey: process.env.TOMTOM_API_KEY || '',
    olaKey: process.env.OLA_MAPS_API_KEY || '',
    overpassUrls: (process.env.OVERPASS_URLS || 'https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter').split(','),
    nominatimUrl: (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, ''),
    osrmUrl: (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, ''),
    radiusKm: Number(process.env.STORE_RADIUS_KM || 5),
    cacheMin: Number(process.env.PLACES_CACHE_MIN || 60),
    fixture: process.env.CROWDKART_PLACES_FIXTURE || '', // JSON file of places (tests / offline)
    userAgent: process.env.HTTP_USER_AGENT || 'CrowdKart/1.0 (group-ordering app)',
  },

  // Razorpay: UPI, cards, netbanking, wallets (India). Test keys start with rzp_test_.
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    env: process.env.PAYPAL_ENV || 'sandbox',
    currency: process.env.PAYPAL_CURRENCY || 'USD',
    inrPerUnit: Number(process.env.PAYPAL_INR_PER_UNIT || 84),
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  },

  cartMaxItems: Number(process.env.CART_MAX_ITEMS || 25),
  cartMaxShops: Number(process.env.CART_MAX_SHOPS || 6),

  // Promo codes, e.g. PROMO_CODES=WELCOME10:10,CROWD15:15  (percent off item total)
  promoCodes: Object.fromEntries((process.env.PROMO_CODES || '').split(',').map((x) => x.trim().split(':')).filter(([c, p]) => c && Number(p) > 0 && Number(p) <= 50).map(([c, p]) => [c.toUpperCase(), Number(p)])),

  // Admin panel sign-in. Set these in server/.env (never commit real passwords).
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },

  matching: {
    threshold: Number(process.env.MATCH_THRESHOLD || 60),
    groupWindowMin: Number(process.env.GROUP_WINDOW_MIN || 10),
    dropRadiusKm: Number(process.env.DROP_RADIUS_KM || 0.6), // neighbours must live within this of the group
    maxMembers: 8,
    minK: 2, // privacy: never show activity for fewer than K people
    signalTtlMin: 30,
  },

  delivery: {
    baseFee: 25,
    perKm: 8,
    perExtraStop: 6,
    perExtraDrop: 4,
    maxPickupsPerRider: 4,
    maxOrdersPerRider: 8,
    maxPickupSpreadKm: 4,
    simSpeedKmh: Number(process.env.RIDER_SIM_SPEED_KMH || 60),
  },
};

export const aiEnabled = () => Boolean(config.ai.apiKey);
export const paypalEnabled = () => Boolean(config.paypal.clientId && config.paypal.clientSecret);
export const razorpayEnabled = () => Boolean(config.razorpay.keyId && config.razorpay.keySecret);
export const googleEnabled = () => Boolean(config.places.googleKey);
export const placeProviders = () => [config.places.googleKey && 'google', config.places.olaKey && 'ola', config.places.tomtomKey && 'tomtom', 'openstreetmap'].filter(Boolean);
