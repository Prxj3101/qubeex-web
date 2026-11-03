'use client';

// Live map of all buses (Leaflet + OpenStreetMap, free). Loaded only in the
// browser (see LivePanel's dynamic import) because Leaflet needs `window`.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL, type LiveBus, type SchoolPoint, type TransportRoute } from './types';
import { addRecenterButton, SCHOOL_ZOOM, schoolIcon } from './mapIcons';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// Keyframes for the bus marker: spinning wheels, engine rumble and exhaust
// smoke. Injected once (this module only runs in the browser).
const BUS_CSS = `
.qx-bus .qx-wheel{transform-box:fill-box;transform-origin:center;animation:qx-spin .45s linear infinite}
.qx-bus .qx-body{animation:qx-rumble .2s ease-in-out infinite alternate}
.qx-bus .qx-puff{transform-box:fill-box;transform-origin:center;opacity:0;animation:qx-smoke 1.6s ease-out infinite}
.qx-bus .qx-puff:nth-of-type(2){animation-delay:.32s}
.qx-bus .qx-puff:nth-of-type(3){animation-delay:.64s}
.qx-bus .qx-puff:nth-of-type(4){animation-delay:.96s}
.qx-bus .qx-puff:nth-of-type(5){animation-delay:1.28s}
.qx-bus.qx-idle .qx-wheel{animation:none}
.qx-bus.qx-idle .qx-body{animation-duration:.3s}
.qx-bus.qx-idle .qx-puff{animation-duration:2.4s}
.qx-bus.qx-off .qx-wheel,.qx-bus.qx-off .qx-body,.qx-bus.qx-off .qx-puff{animation:none}
.qx-bus.qx-off .qx-puff{opacity:0}
.qx-bus.qx-off svg{filter:grayscale(1);opacity:.7}
.qx-bus.qx-sel svg{filter:drop-shadow(0 0 6px rgba(246,181,0,.9))}
@keyframes qx-spin{to{transform:rotate(360deg)}}
@keyframes qx-rumble{from{transform:translateY(0)}to{transform:translateY(-.3px)}}
@keyframes qx-smoke{0%{opacity:.9;transform:translate(0,0) scale(.6)}40%{opacity:.75}100%{opacity:0;transform:translate(-22px,-10px) scale(2.8)}}
@media (prefers-reduced-motion:reduce){.qx-bus *{animation:none!important}}
`;
if (typeof document !== 'undefined' && !document.getElementById('qx-bus-css')) {
    const style = document.createElement('style');
    style.id = 'qx-bus-css';
    style.textContent = BUS_CSS;
    document.head.appendChild(style);
}

// Side view of a yellow school bus, facing right (the front is on the right,
// exhaust on the left). Flipped to face left when heading west.
const wheel = (cx: number) => `<g class="qx-wheel"><circle cx="${cx}" cy="29" r="5.6" fill="#1d1d1f"/><circle cx="${cx}" cy="29" r="2.6" fill="#c9ccd1"/><path d="M${cx - 2.6} 29h5.2M${cx} 26.4v5.2" stroke="#55585e" stroke-width="1.1"/></g>`;
const BUS_SVG = `<svg width="62" height="38" viewBox="0 0 62 38" overflow="visible">
  <ellipse cx="31" cy="35" rx="26" ry="2.6" fill="rgba(0,0,0,.22)"/>
  <circle class="qx-puff" cx="3" cy="26.5" r="3" fill="#8f939a"/>
  <circle class="qx-puff" cx="3" cy="26.5" r="3" fill="#a3a7ad"/>
  <circle class="qx-puff" cx="3" cy="26.5" r="3" fill="#9a9ea5"/>
  <circle class="qx-puff" cx="3" cy="26.5" r="3" fill="#b3b6bc"/>
  <circle class="qx-puff" cx="3" cy="26.5" r="3" fill="#a8acb2"/>
  <g class="qx-body">
    <rect x="3" y="25.5" width="3" height="2" rx="1" fill="#444"/>
    <path d="M6 7.5Q6 4 9.5 4H47Q51 4 52.3 7.5L55 15Q59 16 59 20V28H6Z" fill="#F6B500" stroke="#2a2a2e" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M6 18.5H59" stroke="#2a2a2e" stroke-width="1.6"/>
    <path d="M6 22H59" stroke="#2a2a2e" stroke-width=".9"/>
    ${[9, 16, 23, 30, 37].map(x => `<rect x="${x}" y="7" width="5.6" height="7.5" rx="1.2" fill="#BFE3FF" stroke="#2a2a2e" stroke-width=".9"/>`).join('')}
    <rect x="44" y="7" width="5" height="17" rx="1" fill="#BFE3FF" stroke="#2a2a2e" stroke-width=".9"/>
    <path d="M44 15.5H49" stroke="#2a2a2e" stroke-width=".8"/>
    <path d="M50.5 7H51.6L54.2 14.6H50.5Z" fill="#BFE3FF" stroke="#2a2a2e" stroke-width=".9" stroke-linejoin="round"/>
    <rect x="56.6" y="23" width="2.6" height="2.4" rx=".8" fill="#FFF3B0" stroke="#2a2a2e" stroke-width=".6"/>
    <rect x="5.6" y="23" width="1.8" height="2.6" rx=".6" fill="#E5484D"/>
    <rect x="5" y="27" width="55" height="2.4" rx="1.2" fill="#2a2a2e"/>
  </g>
  ${wheel(16)}${wheel(47)}
</svg>`;

const ARROW = '#2563EB'; // direction arrow: blue, so it stands apart from the yellow bus

function busState(bus: LiveBus, selected: boolean) {
    const moving = bus.online && (bus.position?.speedKmh ?? 0) > 2;
    // compass course (0 north, 90 east...), in 10° steps so small GPS wobble doesn't rebuild the icon
    const course = Math.round(((bus.position?.course ?? 90) % 360) / 10) * 10 % 360;
    return { moving, course, selected, online: bus.online, name: bus.name };
}

// The drawing faces east (right). Turn it to the course; when heading
// anywhere west, mirror it first so the bus never drives upside down.
function busTransform(course: number) {
    return course < 180 ? `rotate(${course - 90}deg)` : `rotate(${course - 270}deg) scaleX(-1)`;
}

// Name label: always straight and readable, just clear of the bus. It sits
// below the bus, or above it when the bus (and its arrow) is heading south.
function labelTop(course: number, online: boolean) {
    const rad = (course * Math.PI) / 180;
    const halfHeight = 31 * Math.abs(Math.cos(rad)) + 14 * Math.abs(Math.sin(rad)); // how far the turned bus reaches up/down
    const southbound = online && course > 110 && course < 250;
    return southbound ? Math.round(19 - halfHeight - 6 - 17) : Math.round(19 + halfHeight + 5);
}

function busIcon(bus: LiveBus, selected: boolean) {
    const s = busState(bus, selected);
    const cls = ['qx-bus', !s.online ? 'qx-off' : s.moving ? '' : 'qx-idle', s.selected ? 'qx-sel' : ''].filter(Boolean).join(' ');
    return L.divIcon({
        className: '',
        iconSize: [62, 38],
        iconAnchor: [31, 19],
        tooltipAnchor: [0, -24],
        html: `<div class="${cls}" style="position:relative;width:62px;height:38px">
            ${s.online ? `<div style="position:absolute;left:31px;top:19px;width:0;height:0;transform:rotate(${s.course}deg)">
                <svg width="16" height="14" viewBox="0 0 16 14" style="position:absolute;left:-8px;top:-46px;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))"><path d="M8 1L15 13L8 9.6L1 13Z" fill="${ARROW}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
            </div>` : ''}
            <div style="transform:${busTransform(s.course)};transform-origin:31px 19px">${BUS_SVG}</div>
            <div style="position:absolute;top:${labelTop(s.course, s.online)}px;left:50%;transform:translateX(-50%);z-index:2;white-space:nowrap;font:600 11px/1.2 system-ui,sans-serif;color:#1f2937;background:#fff;padding:1px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.2)">${esc(bus.name)}</div>
        </div>`,
    });
}

export default function BusMap({ routes, school, live, selectedBusId, onSelectBus }: {
    routes: TransportRoute[];
    school: SchoolPoint | null;
    live: LiveBus[];
    selectedBusId?: string | null;
    onSelectBus?: (busId: string) => void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const routeLayer = useRef<L.LayerGroup | null>(null);
    const markers = useRef(new Map<string, L.Marker>());
    const iconKeys = useRef(new Map<string, string>());
    const fitted = useRef(false);
    const onSelect = useRef(onSelectBus);
    onSelect.current = onSelectBus;
    const schoolRef = useRef(school);
    schoolRef.current = school;

    // create the map once, opening on the school
    useEffect(() => {
        if (!box.current || map.current) return;
        const home = () => {
            const s = schoolRef.current;
            return s ? { center: [s.lat, s.lng] as L.LatLngExpression, zoom: SCHOOL_ZOOM } : { center: DEFAULT_CENTER, zoom: 12 };
        };
        const start = home();
        const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(start.center, start.zoom);
        if (school) fitted.current = true;
        addRecenterButton(m, home);
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(m);
        routeLayer.current = L.layerGroup().addTo(m);
        map.current = m;
        const ro = new ResizeObserver(() => m.invalidateSize());
        ro.observe(box.current);
        const markerMap = markers.current;
        return () => { ro.disconnect(); m.remove(); map.current = null; markerMap.clear(); };
    }, []);

    // routes: a coloured line through the stops + numbered stop dots
    useEffect(() => {
        const layer = routeLayer.current;
        if (!layer) return;
        layer.clearLayers();
        if (school) L.marker([school.lat, school.lng], { icon: schoolIcon(), zIndexOffset: 500 }).bindTooltip(`<b>${esc(school.name)}</b>`).addTo(layer);
        for (const r of routes) {
            // every route starts and ends at the school
            const pts = [...(school && r.stops.length ? [[school.lat, school.lng] as [number, number]] : []), ...r.stops.map(s => [s.lat, s.lng] as [number, number]), ...(school && r.stops.length ? [[school.lat, school.lng] as [number, number]] : [])];
            if (pts.length > 1) L.polyline(pts, { color: r.color, weight: 4, opacity: 0.55, dashArray: '8 8' }).addTo(layer);
            r.stops.forEach((s, i) => {
                L.circleMarker([s.lat, s.lng], { radius: 6, color: '#fff', weight: 2, fillColor: r.color, fillOpacity: 1 })
                    .bindTooltip(`<b>${i + 1}. ${esc(s.name)}</b>${s.monthlyFee != null ? `<br/>Fee ₹${s.monthlyFee.toLocaleString('en-IN')}/month` : ''}<br/><span style="color:#6b7280">${esc(r.name)}</span>`)
                    .addTo(layer);
            });
        }
    }, [routes, school]);

    // buses: move existing markers, add new ones, drop removed ones
    useEffect(() => {
        const m = map.current;
        if (!m) return;
        const seen = new Set<string>();
        for (const bus of live) {
            if (!bus.position) continue;
            seen.add(bus.busId);
            const ll: L.LatLngExpression = [bus.position.lat, bus.position.lng];
            const selected = bus.busId === selectedBusId;
            // only rebuild the icon when its look changes, so the animation doesn't restart every poll
            const key = JSON.stringify(busState(bus, selected));
            const existing = markers.current.get(bus.busId);
            if (existing) {
                existing.setLatLng(ll);
                if (iconKeys.current.get(bus.busId) !== key) {
                    existing.setIcon(busIcon(bus, selected));
                    iconKeys.current.set(bus.busId, key);
                }
                existing.setZIndexOffset(selected ? 1000 : 0);
            } else {
                const mk = L.marker(ll, { icon: busIcon(bus, selected) }).addTo(m);
                iconKeys.current.set(bus.busId, key);
                mk.on('click', () => onSelect.current?.(bus.busId));
                markers.current.set(bus.busId, mk);
            }
        }
        for (const [id, mk] of markers.current) {
            if (!seen.has(id)) { mk.remove(); markers.current.delete(id); iconKeys.current.delete(id); }
        }
        // no school set yet: first time we have something to show, zoom to fit it all
        if (!fitted.current) {
            const pts: L.LatLngExpression[] = [
                ...live.filter(b => b.position).map(b => [b.position!.lat, b.position!.lng] as [number, number]),
                ...routes.flatMap(r => r.stops.map(s => [s.lat, s.lng] as [number, number])),
                ...(school ? [[school.lat, school.lng] as [number, number]] : []),
            ];
            if (pts.length) {
                fitted.current = true;
                m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
            }
        }
    }, [live, routes, school, selectedBusId]);

    // follow the selected bus
    useEffect(() => {
        const bus = live.find(b => b.busId === selectedBusId);
        if (map.current && bus?.position) map.current.panTo([bus.position.lat, bus.position.lng], { animate: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBusId]);

    return <div ref={box} className="h-full w-full rounded-2xl overflow-hidden z-0" />;
}
