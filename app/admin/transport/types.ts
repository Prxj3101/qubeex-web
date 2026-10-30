// Shared types + helpers for the admin Transport page (live GPS bus tracking).

export interface Stop {
    id?: string;
    name: string;
    lat: number;
    lng: number;
    pickupTime: string;
}

export interface TransportRoute {
    id: string;
    name: string;
    color: string;
    stops: Stop[];
    _count?: { buses: number };
}

export interface Bus {
    id: string;
    name: string;
    plateNumber: string;
    trackerId: string | null;
    driverName: string;
    driverPhone: string;
    capacity: number | null;
    routeId: string | null;
    route: { id: string; name: string; color: string } | null;
    _count: { students: number };
}

export interface GpsFix {
    lat: number;
    lng: number;
    speedKmh: number;
    course: number;
    fixTime: string;
    receivedAt: string;
}

export interface LiveBus {
    busId: string;
    name: string;
    plateNumber: string;
    routeId: string | null;
    route: { name: string; color: string } | null;
    hasTracker: boolean;
    position: GpsFix | null;
    online: boolean;
}

export interface Overview {
    routes: TransportRoute[];
    buses: Bus[];
}

/** Map opens here when there is nothing to show yet (Mumbai). */
export const DEFAULT_CENTER: [number, number] = [19.076, 72.8777];

export const ROUTE_COLORS = ['#DA7756', '#2563EB', '#16A34A', '#9333EA', '#DB2777', '#0891B2', '#CA8A04', '#475569'];

/** "just now", "45 s ago", "3 min ago", "2 h ago" */
export function ago(iso: string | null | undefined, now = Date.now()): string {
    if (!iso) return 'never';
    const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return `${s} s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** OpenStreetMap tiles: free, credit shown on the map as their policy asks. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
