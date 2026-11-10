import { useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { Home } from 'lucide-react';
import { Circle, CircleMarker, Marker, Tooltip } from 'react-leaflet';
import { BaseMap, FitBounds, Recenter } from './Maps.jsx';

export { GROUPS, placeGroup } from './placeGroups.jsx';
import { GROUPS, placeGroup } from './placeGroups.jsx';

function bigIcon(group) {
  const { color, Icon } = GROUPS[group];
  const html = `<div style="width:40px;height:40px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)">${renderToStaticMarkup(<Icon size={19} strokeWidth={2.2} />)}</div>`;
  return L.divIcon({ html, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
}
const homeIcon = L.divIcon({ html: `<div class="ck-pin home">${renderToStaticMarkup(<Home size={15} strokeWidth={2.2} />)}</div>`, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
const canvas = L.canvas({ padding: 0.3 });

/** Hundreds of places: drawn as light canvas dots (fast on phones); the selected one gets a big pin. */
export default function PlacesMap({ center, radiusKm, places, selectedId, onSelect, className }) {
  const fit = useMemo(() => {
    const d = radiusKm / 111;
    return [[center[0] - d, center[1] - d], [center[0] + d, center[1] + d]];
  }, [center, radiusKm]);
  const selected = places.find((p) => p.id === selectedId);
  const selIcon = useMemo(() => (selected ? bigIcon(placeGroup(selected)) : null), [selected]);
  return (
    <BaseMap center={center} zoom={14} className={className}>
      <FitBounds points={fit} padding={10} />
      {selected && <Recenter at={selected.location} />}
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#2fa866', weight: 1, fillOpacity: 0.04, dashArray: '4 6' }} />
      {places.map((p) => p.id !== selectedId && (
        <CircleMarker key={p.id} center={p.location} radius={6} renderer={canvas}
          pathOptions={{ color: '#fff', weight: 1.5, fillColor: GROUPS[placeGroup(p)].color, fillOpacity: 0.95 }}
          eventHandlers={{ click: () => onSelect(p.id) }}>
          <Tooltip direction="top" offset={[0, -6]}>{p.name}</Tooltip>
        </CircleMarker>
      ))}
      <Marker position={center} icon={homeIcon} zIndexOffset={500}><Tooltip>You</Tooltip></Marker>
      {selected && <Marker position={selected.location} icon={selIcon} zIndexOffset={1000}><Tooltip permanent direction="top" offset={[0, -20]}>{selected.name}</Tooltip></Marker>}
    </BaseMap>
  );
}
