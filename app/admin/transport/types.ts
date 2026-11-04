// Shared types + helpers for the admin Transport page (live GPS bus tracking).

export interface Stop {
    id?: string;
    name: string;
    lat: number;
    lng: number;
    pickupTime: string;
    /** monthly bus fee in rupees for students picked up here; null = not set */
    monthlyFee: number | null;
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
    /** Timings (HH:MM). Pickup = bus leaves the first stop, drop = bus leaves school. */
    morningShift: boolean;
    morningPickup: string;
    morningDrop: string;
    afternoonShift: boolean;
    afternoonPickup: string;
    afternoonDrop: string;
}

export type Shift = 'MORNING' | 'AFTERNOON';

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
    /** where the bus is on its trip (server follows it stop by stop); null when offline / no route */
    trip?: BusTrip | null;
}

export interface BusTrip {
    phase: 'AT_SCHOOL' | 'ON_TRIP';
    trip: 'PICKUP' | 'DROP' | null;
    standingAt: string | null;
    nextStop: string | null;
    done: number;
    total: number;
    reachedSchool: boolean;
}

/** One line for the live list: "At Patankar", "Going to 4th Road", "Reached school"... */
export function tripLine(t: BusTrip): { text: string; tone: 'green' | 'blue' | 'gray' } {
    if (t.phase === 'AT_SCHOOL') return t.reachedSchool ? { text: '🏫 Reached school', tone: 'green' } : { text: 'Parked at school', tone: 'gray' };
    if (t.standingAt) return { text: `At ${t.standingAt}`, tone: 'blue' };
    if (t.nextStop) return { text: `Going to ${t.nextStop}`, tone: 'blue' };
    return { text: 'Heading to the first stop', tone: 'blue' };
}

export interface SchoolPoint {
    name: string;
    lat: number;
    lng: number;
}

export interface Overview {
    routes: TransportRoute[];
    buses: Bus[];
    /** School gate on the map; null until the admin sets it. */
    school: SchoolPoint | null;
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

// ── Planned stop times (same maths as the backend's transportSchedule.ts) ──
// The admin only types when the bus leaves school; each stop's time is worked
// out from the distances (school -> stop 1 -> stop 2 ...). Live GPS gives
// parents the real ETA. Drop trips visit the stops in reverse order.
const ROAD_FACTOR = 1.35;
const AVG_SPEED_KMH = 20;
const DWELL_MIN = 1;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const legMinutes = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => (distanceKm(a, b) * ROAD_FACTOR / AVG_SPEED_KMH) * 60;

/**
 * Pickup trip: minutes after the bus leaves school until it reaches each stop,
 * and the whole round trip back to school. Without a school, counts from stop 1.
 */
export function rideMinutes(stops: { lat: number; lng: number }[], school: { lat: number; lng: number } | null): { atStop: number[]; roundTrip: number | null } {
    const atStop: number[] = [];
    let t = 0;
    let prev = school;
    stops.forEach((s, i) => {
        if (prev) t += legMinutes(prev, s) + (i > 0 ? DWELL_MIN : 0);
        atStop.push(Math.round(t));
        prev = s;
    });
    const roundTrip = school && stops.length ? Math.round(t + legMinutes(stops[stops.length - 1], school) + DWELL_MIN) : null;
    return { atStop, roundTrip };
}

const toMinutes = (hhmm: string) => { const m = /^(\d{2}):(\d{2})$/.exec(hhmm); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const toHHMM = (mins: number) => { const t = ((Math.round(mins) % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

/** Planned time at each stop (same order as `stops`) for a trip leaving school at `start`. Drop trips run in reverse. */
/** Morning drop and afternoon pickup leave school together: one combined midday trip (children get off and on at each stop). */
export const isCombinedMidday = (bus: { morningShift: boolean; afternoonShift: boolean; morningDrop: string; afternoonPickup: string }) =>
    bus.morningShift && bus.afternoonShift && !!bus.morningDrop && bus.morningDrop === bus.afternoonPickup;

/** `combined`: a drop on the combined midday trip, so it follows the pickup order. */
export function plannedTimes(stops: { lat: number; lng: number }[], school: { lat: number; lng: number } | null, start: string, kind: 'PICKUP' | 'DROP', combined = false): (string | null)[] {
    const t0 = toMinutes(start);
    if (t0 == null) return stops.map(() => null);
    const order = stops.map((s, i) => ({ s, i }));
    if (kind === 'DROP' && !combined) order.reverse();
    const out: (string | null)[] = stops.map(() => null);
    let t = t0;
    let prev: { lat: number; lng: number } | null = school;
    order.forEach(({ s, i }, k) => {
        if (prev) t += legMinutes(prev, s) + (k > 0 ? DWELL_MIN : 0);
        out[i] = toHHMM(t);
        prev = s;
    });
    return out;
}

/** 12-hour label for an HH:MM time: "06:30" -> "6:30 am". */
export function clock(hhmm: string | null | undefined): string {
    const m = hhmm ? /^(\d{2}):(\d{2})$/.exec(hhmm) : null;
    if (!m) return '';
    const h = Number(m[1]);
    return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}
