import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import { BaseMap, FitBounds, ICONS } from './Maps.jsx';

const stopIcon = (n, kind, done) => L.divIcon({
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 13px Poppins,sans-serif;color:#fff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);background:${done ? '#a4a9a5' : kind === 'pickup' ? '#e4572e' : '#2fa866'}">${done ? '✓' : n}</div>`,
});

/** Delivery partner's map: the whole road route with numbered pickups (orange) and drops (green). */
export default function RiderMap({ job, pos, className = 'h-72 md:h-96' }) {
  const fit = useMemo(() => [...job.stops.map((s) => s.location), ...(pos ? [pos] : [])], [job.deliveryId, job.stops.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const doneIdx = job.stopsDone;
  return (
    <BaseMap center={job.stops[0].location} zoom={14} className={className}>
      <FitBounds points={fit} padding={36} />
      {job.route?.length > 1 && (
        <>
          <Polyline positions={job.route} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
          <Polyline positions={job.route} pathOptions={{ color: '#1a73e8', weight: 5, opacity: 0.95 }} />
        </>
      )}
      {job.stops.map((s, i) => (
        <Marker key={i} position={s.location} icon={stopIcon(i + 1, s.kind, i < doneIdx)} zIndexOffset={i === doneIdx ? 800 : 0}>
          <Tooltip direction="top" offset={[0, -14]}>{s.kind === 'pickup' ? `Pick up: ${s.store.name}` : `Drop: ${s.customer.name}`}</Tooltip>
        </Marker>
      ))}
      {pos && <Marker position={pos} icon={ICONS.rider} zIndexOffset={1000}><Tooltip>You</Tooltip></Marker>}
    </BaseMap>
  );
}
