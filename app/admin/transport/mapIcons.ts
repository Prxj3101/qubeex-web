// Leaflet marker icons shared by the transport maps (browser-only modules).
import L from 'leaflet';

/** School pin (same 3D artwork as the School location card): the place every route ends. The pin's tip sits on the spot. */
export const schoolIcon = () => L.icon({
    iconUrl: '/images/transport/school-location-3d-v1.webp',
    iconSize: [56, 56],
    iconAnchor: [28, 55],
    tooltipAnchor: [0, -44],
    className: 'drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]',
});

/** Zoom used when a map opens on (or recentres to) the school. */
export const SCHOOL_ZOOM = 16;

/**
 * "Recenter" button under the zoom +/- buttons. `target` is read on click,
 * so it always goes to the latest school position.
 */
export function addRecenterButton(m: L.Map, target: () => { center: L.LatLngExpression; zoom: number }) {
    const Ctl = L.Control.extend({
        onAdd() {
            const bar = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const a = L.DomUtil.create('a', '', bar);
            a.href = '#';
            a.title = 'Recenter on school';
            a.setAttribute('role', 'button');
            a.setAttribute('aria-label', 'Recenter on school');
            a.style.display = 'flex';
            a.style.alignItems = 'center';
            a.style.justifyContent = 'center';
            a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
            L.DomEvent.disableClickPropagation(bar);
            L.DomEvent.on(a, 'click', e => {
                L.DomEvent.preventDefault(e);
                const t = target();
                m.flyTo(t.center, t.zoom, { duration: 0.6 });
            });
            return bar;
        },
    });
    new Ctl({ position: 'topleft' }).addTo(m);
}
