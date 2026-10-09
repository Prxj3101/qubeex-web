// Geometry for Magic Chalk: turn a hand-drawn triangle / quadrilateral / pentagon /
// hexagon / circle into a clean shape, and solve its angles and sides.
// Everything here is plain maths on the stroke points - no AI, no network.

export type Pt = { x: number; y: number };
export type ShapeKind = 'triangle' | 'quad' | 'pentagon' | 'hexagon' | 'circle';
export type ShapeSub =
    | 'equilateral' | 'isosceles' | 'right' | 'scalene'
    | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'quadrilateral'
    | 'regular' | 'irregular' | 'circle';

export type Shape = {
    kind: ShapeKind;
    sub: ShapeSub;
    /** Vertices in a box that is 1 wide (x: 0..1, y: 0..aspect). Empty for a circle. */
    pts: Pt[];
    aspect: number;
    /** Angle (degrees) already certain from the clean-up (90 for a right angle, 60 for equilateral...), per vertex. */
    exact: (number | null)[];
    /** Vertex of the right angle, for a right-angled triangle. */
    rightAt?: number;
    /** Pairs of vertices with equal angles (isosceles base angles). */
    equalAngles?: [number, number];
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

function convexHull(points: Pt[]): Pt[] {
    const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length < 3) return p;
    const lower: Pt[] = [];
    for (const q of p) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
        lower.push(q);
    }
    const upper: Pt[] = [];
    for (const q of [...p].reverse()) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
        upper.push(q);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const polyArea = (poly: Pt[]) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + (p.x * q.y - q.x * p.y); }, 0)) / 2;

/** Drop the corner that matters least until only `target` corners remain or every remaining one clearly matters. */
function simplifyHull(hull: Pt[], maxRelLoss: number): Pt[] {
    const poly = [...hull];
    const total = polyArea(poly);
    while (poly.length > 3) {
        let best = -1, bestArea = Infinity;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
            const tri = Math.abs(cross(a, b, c)) / 2;
            if (tri < bestArea) { bestArea = tri; best = i; }
        }
        if (bestArea / total > maxRelLoss) break;
        poly.splice(best, 1);
    }
    return poly;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const distToPoly = (p: Pt, poly: Pt[]) => Math.min(...poly.map((a, i) => distToSegment(p, a, poly[(i + 1) % poly.length])));

function interiorAngles(poly: Pt[]): number[] {
    return poly.map((b, i) => {
        const a = poly[(i + poly.length - 1) % poly.length], c = poly[(i + 1) % poly.length];
        const v1 = sub(a, b), v2 = sub(c, b);
        return deg(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (len(v1) * len(v2) || 1)))));
    });
}
const sides = (poly: Pt[]) => poly.map((p, i) => dist(p, poly[(i + 1) % poly.length]));
const spread = (xs: number[]) => Math.max(...xs) / Math.max(1e-9, Math.min(...xs));

function regularPolygon(n: number, center: Pt, R: number, rot: number): Pt[] {
    return Array.from({ length: n }, (_, i) => ({ x: center.x + R * Math.cos(rot + (i * 2 * Math.PI) / n), y: center.y + R * Math.sin(rot + (i * 2 * Math.PI) / n) }));
}

function normalize(poly: Pt[]): { pts: Pt[]; aspect: number } {
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const w = Math.max(1e-6, Math.max(...xs) - minX), h = Math.max(1e-6, Math.max(...ys) - minY);
    // Keep the shape's own proportions: scale both axes by the same factor.
    const k = 1 / w;
    return { pts: poly.map(p => ({ x: (p.x - minX) * k, y: (p.y - minY) * k })), aspect: h * k };
}

/** Round an angle of direction to the nearest axis when it is already close (so right shapes sit straight). */
function snapRotation(theta: number, tolDeg = 8): number {
    const step = Math.PI / 2;
    const near = Math.round(theta / step) * step;
    return Math.abs(theta - near) < rad(tolDeg) ? near : theta;
}

function snapTriangle(v: Pt[]): { pts: Pt[]; sub: ShapeSub; exact: (number | null)[]; rightAt?: number; equalAngles?: [number, number] } {
    const s = sides(v);
    const ang = interiorAngles(v);
    const c = { x: mean(v.map(p => p.x)), y: mean(v.map(p => p.y)) };
    if (spread(s) < 1.1) {
        const R = mean(v.map(p => dist(p, c)));
        const rot = Math.atan2(v[0].y - c.y, v[0].x - c.x);
        return { pts: regularPolygon(3, c, R, snapRotation(rot - Math.PI / 2, 10) + Math.PI / 2), sub: 'equilateral', exact: [60, 60, 60] };
    }
    const ri = ang.reduce((best, a, i) => (Math.abs(a - 90) < Math.abs(ang[best] - 90) ? i : best), 0);
    if (Math.abs(ang[ri] - 90) < 10) {
        const P = v[ri], A = v[(ri + 1) % 3], B = v[(ri + 2) % 3];
        const la = dist(P, A), lb = dist(P, B);
        const theta = snapRotation(Math.atan2(A.y - P.y, A.x - P.x));
        const cr = cross(P, A, B) >= 0 ? 1 : -1;
        const a2 = { x: P.x + la * Math.cos(theta), y: P.y + la * Math.sin(theta) };
        const b2 = { x: P.x - cr * lb * Math.sin(theta), y: P.y + cr * lb * Math.cos(theta) };
        const pts = [...v];
        pts[ri] = P; pts[(ri + 1) % 3] = a2; pts[(ri + 2) % 3] = b2;
        const exact: (number | null)[] = [null, null, null];
        exact[ri] = 90;
        const isoRight = Math.max(la, lb) / Math.min(la, lb) < 1.1;
        if (isoRight) { exact[(ri + 1) % 3] = 45; exact[(ri + 2) % 3] = 45; }
        return { pts, sub: 'right', exact, rightAt: ri };
    }
    // Isosceles: the two near-equal sides meet at the apex; the third side is the base.
    const iso = [0, 1, 2].find(i => Math.max(s[i], s[(i + 1) % 3]) / Math.min(s[i], s[(i + 1) % 3]) < 1.12);
    if (iso !== undefined) {
        const apex = (iso + 1) % 3;
        const b0 = v[(apex + 1) % 3], b1 = v[(apex + 2) % 3];
        const mid = { x: (b0.x + b1.x) / 2, y: (b0.y + b1.y) / 2 };
        const bl = dist(b0, b1) || 1;
        const nx = -(b1.y - b0.y) / bl, ny = (b1.x - b0.x) / bl;
        const h = Math.abs((v[apex].x - mid.x) * nx + (v[apex].y - mid.y) * ny);
        const sign = ((v[apex].x - mid.x) * nx + (v[apex].y - mid.y) * ny) >= 0 ? 1 : -1;
        const pts = [...v];
        pts[apex] = { x: mid.x + sign * nx * h, y: mid.y + sign * ny * h };
        return { pts, sub: 'isosceles', exact: [null, null, null], equalAngles: [(apex + 1) % 3, (apex + 2) % 3] };
    }
    return { pts: v, sub: 'scalene', exact: [null, null, null] };
}

function snapQuad(v: Pt[]): { pts: Pt[]; sub: ShapeSub; exact: (number | null)[] } {
    const ang = interiorAngles(v);
    const s = sides(v);
    const c = { x: mean(v.map(p => p.x)), y: mean(v.map(p => p.y)) };
    if (ang.every(a => Math.abs(a - 90) < 14)) {
        // Rectangle / square, sat straight when it is almost straight already.
        const w = (s[0] + s[2]) / 2, h = (s[1] + s[3]) / 2;
        const theta = snapRotation(Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x));
        const square = Math.max(w, h) / Math.min(w, h) < 1.12;
        const W = square ? (w + h) / 2 : w, H = square ? (w + h) / 2 : h;
        const cr = cross(v[0], v[1], v[2]) >= 0 ? 1 : -1;
        const ux = Math.cos(theta), uy = Math.sin(theta);
        const vx = -cr * uy, vy = cr * ux;
        const corner = (a: number, b: number): Pt => ({ x: c.x + ux * a * W / 2 + vx * b * H / 2, y: c.y + uy * a * W / 2 + vy * b * H / 2 });
        return { pts: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], sub: square ? 'square' : 'rectangle', exact: [90, 90, 90, 90] };
    }
    if (spread(s) < 1.15) return { pts: v, sub: 'rhombus', exact: [null, null, null, null] };
    if (Math.max(s[0], s[2]) / Math.min(s[0], s[2]) < 1.15 && Math.max(s[1], s[3]) / Math.min(s[1], s[3]) < 1.15) {
        return { pts: v, sub: 'parallelogram', exact: [null, null, null, null] };
    }
    return { pts: v, sub: 'quadrilateral', exact: [null, null, null, null] };
}

/**
 * Look at the strokes the teacher drew (each stroke = list of points) and, if they form one clean
 * outline of a triangle, four-sided shape, pentagon, hexagon or circle, return it tidied up.
 * Returns null for anything else (handwriting, doodles, open shapes...).
 */
/** Mouse strokes are sparse when the hand moves fast: fill the gaps so every part of the line has points on it. */
function densify(stroke: Pt[], step = 4): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i < stroke.length; i++) {
        out.push(stroke[i]);
        const next = stroke[i + 1];
        if (!next) break;
        const d = dist(stroke[i], next);
        const n = Math.floor(d / step);
        for (let k = 1; k <= n; k++) out.push({ x: stroke[i].x + ((next.x - stroke[i].x) * k) / (n + 1), y: stroke[i].y + ((next.y - stroke[i].y) * k) / (n + 1) });
    }
    return out;
}

export function recognizeShape(strokes: Pt[][]): Shape | null {
    if (strokes.length > 6) return null; // a figure is a few strokes; words are many
    const pts = strokes.flatMap(st => densify(st));
    if (pts.length < 12 || pts.length > 6000) return null;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    const diag = Math.hypot(bw, bh);
    if (diag < 90 || Math.min(bw, bh) < 36) return null; // small marks are writing, not figures

    const hull = convexHull(pts);
    if (hull.length < 3) return null;
    const poly = simplifyHull(hull, 0.045);
    const circleTry = (strict: boolean): Shape | null => {
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
        const rs = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
        const rm = mean(rs);
        const sd = Math.sqrt(mean(rs.map(r => (r - rm) ** 2)));
        const devs = rs.map(r => Math.abs(r - rm) / rm).sort((x, y) => x - y);
        const p95 = devs[Math.floor(devs.length * 0.95)];
        const bins = new Set(pts.map(p => Math.floor(((Math.atan2(p.y - cy, p.x - cx) + Math.PI) / (2 * Math.PI)) * 30)));
        const ok = strict ? sd / rm < 0.07 && p95 < 0.14 : sd / rm < 0.11;
        if (ok && bw / bh > 0.7 && bw / bh < 1.43 && bins.size >= 24) {
            return { kind: 'circle', sub: 'circle', pts: [], aspect: bh / bw, exact: [] };
        }
        return null;
    };
    // Too many corners to be a polygon: a circle if the ink sits at one distance from the middle all the way round.
    if (poly.length > 6) return circleTry(false);
    if (poly.length < 3) return null;

    // The ink must run along the outline (not fill the inside like a word does) ...
    // Five or six corners must hug the ink closely, otherwise a circle / oval would pass as a hexagon.
    const tol = Math.min(diag * 0.075, Math.sqrt(polyArea(poly)) * (poly.length >= 5 ? 0.065 : 0.1));
    const onEdge = pts.filter(p => distToPoly(p, poly) <= tol).length / pts.length;
    if (onEdge < 0.88) return circleTry(true);
    // ... and every side must actually be drawn.
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        let hit = 0;
        const N = 12;
        for (let k = 1; k < N; k++) {
            const q = { x: a.x + ((b.x - a.x) * k) / N, y: a.y + ((b.y - a.y) * k) / N };
            if (pts.some(p => Math.hypot(p.x - q.x, p.y - q.y) <= tol)) hit++;
        }
        if (hit / (N - 1) < 0.6) return circleTry(true);
    }

    const n = poly.length;
    if (n === 3) {
        const t = snapTriangle(poly);
        const { pts: np, aspect } = normalize(t.pts);
        return { kind: 'triangle', sub: t.sub, pts: np, aspect, exact: t.exact, rightAt: t.rightAt, equalAngles: t.equalAngles };
    }
    if (n === 4) {
        const q = snapQuad(poly);
        const { pts: np, aspect } = normalize(q.pts);
        return { kind: 'quad', sub: q.sub, pts: np, aspect, exact: q.exact };
    }
    // Pentagon / hexagon: make it regular when it is nearly so.
    const c = { x: mean(poly.map(p => p.x)), y: mean(poly.map(p => p.y)) };
    const s = sides(poly);
    const kind: ShapeKind = n === 5 ? 'pentagon' : 'hexagon';
    if (spread(s) < 1.25) {
        const R = mean(poly.map(p => dist(p, c)));
        const rot = Math.atan2(poly[0].y - c.y, poly[0].x - c.x);
        const { pts: np, aspect } = normalize(regularPolygon(n, c, R, rot));
        const each = ((n - 2) * 180) / n;
        return { kind, sub: 'regular', pts: np, aspect, exact: Array(n).fill(each) };
    }
    // Uneven pentagon / hexagon (e.g. a "house" outline): keep the corners as drawn.
    const { pts: np, aspect } = normalize(poly);
    return { kind, sub: 'irregular', pts: np, aspect, exact: Array(n).fill(null) };
}

// ── Names ──────────────────────────────────────────────────────────────────────

type L = 'en' | 'hi' | 'mr';
const NAMES: Record<string, [string, string, string]> = {
    'triangle:equilateral': ['Equilateral triangle', 'समबाहु त्रिभुज', 'समभुज त्रिकोण'],
    'triangle:isosceles': ['Isosceles triangle', 'समद्विबाहु त्रिभुज', 'समद्विभुज त्रिकोण'],
    'triangle:right': ['Right-angled triangle', 'समकोण त्रिभुज', 'काटकोन त्रिकोण'],
    'triangle:scalene': ['Scalene triangle', 'विषमबाहु त्रिभुज', 'विषमभुज त्रिकोण'],
    'quad:square': ['Square', 'वर्ग', 'चौरस'],
    'quad:rectangle': ['Rectangle', 'आयत', 'आयत'],
    'quad:rhombus': ['Rhombus', 'समचतुर्भुज', 'समभुज चौकोन'],
    'quad:parallelogram': ['Parallelogram', 'समांतर चतुर्भुज', 'समांतरभुज चौकोन'],
    'quad:quadrilateral': ['Quadrilateral', 'चतुर्भुज', 'चौकोन'],
    'pentagon:regular': ['Regular pentagon', 'सम पंचभुज', 'सम पंचकोन'],
        'pentagon:irregular': ['Pentagon', 'पंचभुज', 'पंचकोन'],
    'hexagon:regular': ['Regular hexagon', 'सम षट्भुज', 'सम षटकोन'],
    'hexagon:irregular': ['Hexagon', 'षट्भुज', 'षटकोन'],
        'circle:circle': ['Circle', 'वृत्त', 'वर्तुळ'],
};
export function shapeName(sh: Pick<Shape, 'kind' | 'sub'>, lang: L = 'en'): string {
    const row = NAMES[`${sh.kind}:${sh.sub}`] ?? ['Shape', 'आकृति', 'आकृती'];
    return row[lang === 'hi' ? 1 : lang === 'mr' ? 2 : 0];
}

// ── Solving ────────────────────────────────────────────────────────────────────

export type AngleState = { value: number | null; how: 'given' | 'exact' | 'solved' | null; note?: string };

const clean = (v: number) => Math.round(v * 100) / 100;
export const fmt = (v: number) => String(clean(v));

/** Work out every angle that can be worked out from the ones known so far. */
export function solveAngles(shape: Shape, given: (number | undefined)[]): AngleState[] {
    const n = shape.pts.length;
    const st: AngleState[] = Array.from({ length: n }, (_, i) =>
        given[i] !== undefined ? { value: given[i]!, how: 'given' } :
            shape.exact[i] != null ? { value: shape.exact[i], how: 'exact' } : { value: null, how: null });
    const total = (n - 2) * 180;
    let changed = true;
    for (let guard = 0; changed && guard < 6; guard++) {
        changed = false;
        // Isosceles: the two base angles are equal.
        if (shape.equalAngles) {
            const [a, b] = shape.equalAngles;
            if (st[a].value !== null && st[b].value === null) { st[b] = { value: st[a].value, how: 'solved', note: 'base angles are equal' }; changed = true; }
            else if (st[b].value !== null && st[a].value === null) { st[a] = { value: st[b].value, how: 'solved', note: 'base angles are equal' }; changed = true; }
            const apex = [0, 1, 2].find(i => i !== a && i !== b)!;
            if (st[apex].value !== null && st[a].value === null && st[b].value === null) {
                const base = clean((180 - st[apex].value!) / 2);
                st[a] = { value: base, how: 'solved', note: `(180 − ${fmt(st[apex].value!)}) ÷ 2` };
                st[b] = { value: base, how: 'solved', note: `(180 − ${fmt(st[apex].value!)}) ÷ 2` };
                changed = true;
            }
        }
        // Angle sum: when only one is missing it is what is left over.
        const unknown = st.map((s, i) => (s.value === null ? i : -1)).filter(i => i >= 0);
        if (unknown.length === 1) {
            const known = st.filter(s => s.value !== null).map(s => s.value as number);
            const v = clean(total - known.reduce((a, b) => a + b, 0));
            st[unknown[0]] = { value: v, how: 'solved', note: `${total} − (${known.map(fmt).join(' + ')})` };
            changed = true;
        }
    }
    return st;
}

export type SideInfo = { index: number; label: string; value: number | null; how: 'given' | 'solved' | null; note?: string };

/** Right triangle: any two sides give the third (Pythagoras). Index i = edge from vertex i to i+1. */
export function solveRightTriangle(shape: Shape, given: (number | undefined)[]): SideInfo[] {
    const r = shape.rightAt ?? 0;
    // Edges touching the right-angle vertex are the legs; the other edge is the hypotenuse.
    const legA = r, legB = (r + 2) % 3, hyp = (r + 1) % 3;
    const names: Record<number, string> = { [legA]: 'a', [legB]: 'b', [hyp]: 'c' };
    const g = (i: number) => given[i];
    const out: SideInfo[] = [legA, legB, hyp].map(i => ({ index: i, label: names[i], value: g(i) ?? null, how: g(i) !== undefined ? 'given' : null }));
    const va = g(legA), vb = g(legB), vc = g(hyp);
    const set = (i: number, value: number, note: string) => { const o = out.find(x => x.index === i)!; o.value = clean(value); o.how = 'solved'; o.note = note; };
    if (va !== undefined && vb !== undefined && vc === undefined) set(hyp, Math.hypot(va, vb), `√(${fmt(va)}² + ${fmt(vb)}²)`);
    else if (va !== undefined && vc !== undefined && vb === undefined && vc > va) set(legB, Math.sqrt(vc * vc - va * va), `√(${fmt(vc)}² − ${fmt(va)}²)`);
    else if (vb !== undefined && vc !== undefined && va === undefined && vc > vb) set(legA, Math.sqrt(vc * vc - vb * vb), `√(${fmt(vc)}² − ${fmt(vb)}²)`);
    return out;
}

/** Rectangle / square: two sides (or one for a square) give perimeter and area. */
export function solveRect(shape: Shape, given: (number | undefined)[]): { w?: number; h?: number; perimeter?: number; area?: number } {
    const w = given[0] ?? (shape.sub === 'square' ? given[1] : undefined);
    const h = given[1] ?? (shape.sub === 'square' ? given[0] : undefined);
    if (w === undefined || h === undefined) return { w, h };
    return { w, h, perimeter: clean(2 * (w + h)), area: clean(w * h) };
}

/** Circle from its radius. 22/7 when the radius is a multiple of 7 (the usual textbook way), else 3.14. */
export function solveCircle(r: number | undefined): { r: number; pi: string; circumference: number; area: number } | null {
    if (r === undefined || !(r > 0)) return null;
    const useFrac = Number.isInteger(r) && r % 7 === 0;
    const pi = useFrac ? 22 / 7 : 3.14;
    return { r, pi: useFrac ? '22/7' : '3.14', circumference: clean(2 * pi * r), area: clean(pi * r * r) };
}

export { interiorAngles, sides };
