'use client';

// Live map of all buses (Leaflet + OpenStreetMap, free). Loaded only in the
// browser (see LivePanel's dynamic import) because Leaflet needs `window`.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL, type LiveBus, type TransportRoute } from './types';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function busIcon(bus: LiveBus, selected: boolean) {
    const color = bus.online ? (bus.route?.color ?? '#DA7756') : '#9CA3AF';
    const course = bus.position?.course ?? 0;
    return L.divIcon({
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div style="position:relative;width:34px;height:34px">
            <div style="position:absolute;inset:0;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)${selected ? `,0 0 0 5px ${color}55` : ''};display:flex;align-items:center;justify-content:center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
            </div>
            ${bus.online ? `<div style="position:absolute;left:50%;top:-9px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid ${color};transform-origin:50% 26px;transform:translateX(-50%) rotate(${course}deg)"></div>` : ''}
            <div style="position:absolute;top:36px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 11px/1.2 system-ui,sans-serif;color:#1f2937;background:#fff;padding:1px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.2)">${esc(bus.name)}</div>
        </div>`,
    });
}

export default function BusMap({ routes, live, selectedBusId, onSelectBus }: {
    routes: TransportRoute[];
    live: LiveBus[];
    selectedBusId?: string | null;
    onSelectBus?: (busId: string) => void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const routeLayer = useRef<L.LayerGroup | null>(null);
    const markers = useRef(new Map<string, L.Marker>());
    const fitted = useRef(false);
    const onSelect = useRef(onSelectBus);
    onSelect.current = onSelectBus;

    // create the map once
    useEffect(() => {
        if (!box.current || map.current) return;
        const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 12);
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
        for (const r of routes) {
            const pts = r.stops.map(s => [s.lat, s.lng] as [number, number]);
            if (pts.length > 1) L.polyline(pts, { color: r.color, weight: 4, opacity: 0.55, dashArray: '8 8' }).addTo(layer);
            r.stops.forEach((s, i) => {
                L.circleMarker([s.lat, s.lng], { radius: 6, color: '#fff', weight: 2, fillColor: r.color, fillOpacity: 1 })
                    .bindTooltip(`<b>${i + 1}. ${esc(s.name)}</b>${s.pickupTime ? `<br/>Pickup ${esc(s.pickupTime)}` : ''}<br/><span style="color:#6b7280">${esc(r.name)}</span>`)
                    .addTo(layer);
            });
        }
    }, [routes]);

    // buses: move existing markers, add new ones, drop removed ones
    useEffect(() => {
        const m = map.current;
        if (!m) return;
        const seen = new Set<string>();
        for (const bus of live) {
            if (!bus.position) continue;
            seen.add(bus.busId);
            const ll: L.LatLngExpression = [bus.position.lat, bus.position.lng];
            const icon = busIcon(bus, bus.busId === selectedBusId);
            const existing = markers.current.get(bus.busId);
            if (existing) {
                existing.setLatLng(ll);
                existing.setIcon(icon);
                existing.setZIndexOffset(bus.busId === selectedBusId ? 1000 : 0);
            } else {
                const mk = L.marker(ll, { icon }).addTo(m);
                mk.on('click', () => onSelect.current?.(bus.busId));
                markers.current.set(bus.busId, mk);
            }
        }
        for (const [id, mk] of markers.current) {
            if (!seen.has(id)) { mk.remove(); markers.current.delete(id); }
        }
        // first time we have something to show: zoom to fit it all
        if (!fitted.current) {
            const pts: L.LatLngExpression[] = [
                ...live.filter(b => b.position).map(b => [b.position!.lat, b.position!.lng] as [number, number]),
                ...routes.flatMap(r => r.stops.map(s => [s.lat, s.lng] as [number, number])),
            ];
            if (pts.length) {
                fitted.current = true;
                m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
            }
        }
    }, [live, routes, selectedBusId]);

    // follow the selected bus
    useEffect(() => {
        const bus = live.find(b => b.busId === selectedBusId);
        if (map.current && bus?.position) map.current.panTo([bus.position.lat, bus.position.lng], { animate: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBusId]);

    return <div ref={box} className="h-full w-full rounded-2xl overflow-hidden z-0" />;
}
