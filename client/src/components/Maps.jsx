import { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { Bike, Home, Store } from 'lucide-react';
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';

const svg = (Icon, size) => renderToStaticMarkup(<Icon size={size} strokeWidth={2.2} />);
const pin = (cls, Icon, size = 30, iconSize = 15) => L.divIcon({ html: `<div class="${cls}">${svg(Icon, iconSize)}</div>`, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
export const ICONS = {
  store: pin('ck-pin', Store),
  home: pin('ck-pin home', Home),
  rider: pin('ck-rider', Bike, 36, 17),
};

export function BaseMap({ center, zoom = 15, className = 'h-64', children }) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className={`w-full overflow-hidden rounded-xl ${className}`}>
      <TileLayer className="tiles" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {children}
    </MapContainer>
  );
}

export function FitBounds({ points, padding = 48 }) {
  const map = useMap();
  const key = points.map((p) => p.map((x) => x.toFixed(4)).join(',')).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [padding, padding], maxZoom: 16 });
    else if (points.length === 1) map.setView(points[0], 16);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function Recenter({ at, zoom }) {
  const map = useMap();
  useEffect(() => { if (at) map.setView(at, zoom ?? map.getZoom()); }, [at?.[0], at?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Neighbourhood activity: ~650 m cells only, never individual people. */
export function ActivityMap({ home, cells }) {
  return (
    <BaseMap center={home} zoom={14} className="h-52">
      {cells.map((c) => (
        <Circle key={c.key} center={c.center} radius={330} pathOptions={{ color: '#13804e', weight: 1, fillColor: '#13804e', fillOpacity: c.activity === '7+' ? 0.35 : c.activity === '4-6' ? 0.25 : 0.15 }}>
          <Tooltip>{c.activity} people ordering</Tooltip>
        </Circle>
      ))}
      <Marker position={home} icon={ICONS.home}><Tooltip>Your address</Tooltip></Marker>
    </BaseMap>
  );
}

/** Live delivery: rider, your store and your door. Other neighbours' stops are never drawn. */
export function TrackMap({ rider, store, home, showStore, route }) {
  const riderKey = rider?.pos ? `${Math.round(rider.pos[0] * 300)},${Math.round(rider.pos[1] * 300)}` : '';
  const fit = useMemo(() => [home, ...(showStore && store ? [store] : []), ...(rider?.pos ? [rider.pos] : [])], [home, store, showStore, riderKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <BaseMap center={home} zoom={15} className="h-72 md:h-96">
      <FitBounds points={fit} />
      {rider?.pos && route?.length > 1 && (
        <>
          <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.95 }} />
          <Polyline positions={route} pathOptions={{ color: '#2fa866', weight: 5, opacity: 1 }} />
        </>
      )}
      {rider?.pos && !(route?.length > 1) && <Polyline positions={[rider.pos, showStore && store ? store : home]} pathOptions={{ color: '#1d1d1f', weight: 3, dashArray: '6 8', opacity: 0.5 }} />}
      {showStore && store && <Marker position={store} icon={ICONS.store}><Tooltip>Your store</Tooltip></Marker>}
      <Marker position={home} icon={ICONS.home}><Tooltip>Your address</Tooltip></Marker>
      {rider?.pos && <Marker position={rider.pos} icon={ICONS.rider} zIndexOffset={1000}><Tooltip direction="top" offset={[0, -16]}>{rider.name}</Tooltip></Marker>}
    </BaseMap>
  );
}

export function useNow(ms = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return t;
}
