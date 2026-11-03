'use client';

// Map for setting the school's location: click anywhere or drag the pin.
// Browser-only (Leaflet), loaded with next/dynamic.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL } from './types';
import { addRecenterButton, schoolIcon } from './mapIcons';

export default function SchoolPickerMap({ value, onChange, flyTo }: {
    value: { lat: number; lng: number } | null;
    onChange: (lat: number, lng: number) => void;
    /** bump to move the map to `value` (e.g. after an address search) */
    flyTo: number;
}) {
    const box = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const marker = useRef<L.Marker | null>(null);
    const cb = useRef(onChange);
    cb.current = onChange;
    const valueRef = useRef(value);
    valueRef.current = value;

    useEffect(() => {
        if (!box.current || map.current) return;
        const m = L.map(box.current).setView(value ? [value.lat, value.lng] : DEFAULT_CENTER, value ? 17 : 12);
        addRecenterButton(m, () => {
            const v = valueRef.current;
            return v ? { center: [v.lat, v.lng], zoom: 17 } : { center: DEFAULT_CENTER, zoom: 12 };
        });
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(m);
        m.on('click', e => cb.current(e.latlng.lat, e.latlng.lng));
        map.current = m;
        const t = setTimeout(() => m.invalidateSize(), 250);
        const ro = new ResizeObserver(() => m.invalidateSize());
        ro.observe(box.current);
        return () => { clearTimeout(t); ro.disconnect(); m.remove(); map.current = null; marker.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const m = map.current;
        if (!m) return;
        if (!value) { marker.current?.remove(); marker.current = null; return; }
        if (!marker.current) {
            marker.current = L.marker([value.lat, value.lng], { icon: schoolIcon(), draggable: true }).addTo(m);
            marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); cb.current(p.lat, p.lng); });
        } else marker.current.setLatLng([value.lat, value.lng]);
    }, [value]);

    useEffect(() => {
        if (flyTo && value && map.current) map.current.setView([value.lat, value.lng], 17);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flyTo]);

    return <div ref={box} className="h-full w-full rounded-xl overflow-hidden z-0" />;
}
