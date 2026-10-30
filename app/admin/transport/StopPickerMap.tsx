'use client';

// Map inside the route editor: click to drop a stop, drag a numbered pin to
// move it. Browser-only (Leaflet), loaded with next/dynamic.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL, type Stop } from './types';

const pin = (n: number, color: string, active: boolean) => L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)${active ? `,0 0 0 4px ${color}55` : ''};display:flex;align-items:center;justify-content:center;font:700 12px system-ui,sans-serif;color:#fff;cursor:grab">${n}</div>`,
});

export default function StopPickerMap({ stops, color, active, onAdd, onMove, onPick }: {
    stops: Stop[];
    color: string;
    active: number | null;
    onAdd: (lat: number, lng: number) => void;
    onMove: (index: number, lat: number, lng: number) => void;
    onPick: (index: number) => void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const layer = useRef<L.LayerGroup | null>(null);
    const cb = useRef({ onAdd, onMove, onPick });
    cb.current = { onAdd, onMove, onPick };
    const fitted = useRef(false);

    useEffect(() => {
        if (!box.current || map.current) return;
        const m = L.map(box.current).setView(DEFAULT_CENTER, 13);
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(m);
        layer.current = L.layerGroup().addTo(m);
        m.on('click', e => cb.current.onAdd(e.latlng.lat, e.latlng.lng));
        map.current = m;
        // the dialog animates open; recalc size once it has its final size
        const t = setTimeout(() => m.invalidateSize(), 250);
        return () => { clearTimeout(t); m.remove(); map.current = null; };
    }, []);

    useEffect(() => {
        const m = map.current, lg = layer.current;
        if (!m || !lg) return;
        lg.clearLayers();
        if (stops.length > 1) L.polyline(stops.map(s => [s.lat, s.lng] as [number, number]), { color, weight: 4, opacity: 0.7, dashArray: '8 8' }).addTo(lg);
        stops.forEach((s, i) => {
            const mk = L.marker([s.lat, s.lng], { icon: pin(i + 1, color, i === active), draggable: true, zIndexOffset: i === active ? 1000 : 0 }).addTo(lg);
            if (s.name) mk.bindTooltip(s.name, { direction: 'top', offset: [0, -14] });
            mk.on('click', () => cb.current.onPick(i));
            mk.on('dragend', () => { const p = mk.getLatLng(); cb.current.onMove(i, p.lat, p.lng); });
        });
        if (!fitted.current && stops.length) {
            fitted.current = true;
            m.fitBounds(L.latLngBounds(stops.map(s => [s.lat, s.lng] as [number, number])), { padding: [40, 40], maxZoom: 16 });
        }
    }, [stops, color, active]);

    // jump to a stop picked from the list
    useEffect(() => {
        const s = active !== null ? stops[active] : null;
        if (map.current && s) map.current.panTo([s.lat, s.lng]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    return <div ref={box} className="h-full w-full rounded-xl overflow-hidden z-0" />;
}
