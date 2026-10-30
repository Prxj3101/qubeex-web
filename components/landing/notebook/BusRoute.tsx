'use client';

import {
    motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, type MotionValue,
} from 'framer-motion';
import {
    Banknote, Brain, CalendarCheck, ClipboardList, LayoutGrid, PenLine, Plus, Presentation,
    Smartphone, Sparkles, type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DISPLAY } from '../motion';
import { HAND, INK, TERRA, paper } from './paper';

type Stop = { icon: LucideIcon; title: string; desc: string; color: string; soft: string; ai?: boolean; more?: boolean };

const STOPS: Stop[] = [
    // AI first
    { icon: Sparkles, title: 'Jarvis AI', desc: 'Ask anything, or tell it what to schedule.', color: '#E11D48', soft: '#FDE8EC', ai: true },
    { icon: LayoutGrid, title: 'AI Timetable', desc: 'Type your rules. Get a clash-free timetable.', color: '#7C3AED', soft: '#F0EAFD', ai: true },
    { icon: Presentation, title: 'AI Blackboard', desc: 'Textbook page to mindmap and diagrams, live in class.', color: '#16A34A', soft: '#E6F6EC', ai: true },
    { icon: PenLine, title: 'AI Tests & homework', desc: 'AI writes the questions. Cheat-proof online tests.', color: '#DB2777', soft: '#FCEAF3', ai: true },
    { icon: Brain, title: 'AI Insights', desc: 'Flags 3-day absences, falling marks and fee risk early.', color: '#0EA5E9', soft: '#E3F4FC', ai: true },
    // the everyday school work
    { icon: CalendarCheck, title: 'Attendance & fees', desc: 'P, A, L in one tap. Fee cards, receipts and reminders.', color: '#0D9488', soft: '#E3F5F2' },
    { icon: ClipboardList, title: 'Admissions', desc: 'Online forms, one board, even your own paper form.', color: '#2563EB', soft: '#E8F0FE' },
    { icon: Smartphone, title: 'Parent & student app', desc: 'Homework, results, fees and an AI snapshot.', color: TERRA, soft: '#FBEDE6' },
    { icon: Banknote, title: 'Payroll & inventory', desc: 'Fingerprint to payslip. Stock and issue ledger.', color: '#CA8A04', soft: '#FBF3D9' },
    { icon: Plus, title: '...and a lot more', desc: 'Report cards, campus feed, analytics, audit logs, roles.', color: INK, soft: '#ECEDF3', more: true },
];

// Kids waiting at each stop (some stops are empty, like real life).
const KIDS = [2, 0, 1, 2, 0, 1, 2, 0, 1, 1];
const LOOKS = [
    { shirt: '#5B8DEF', skin: '#F1C7A1', hair: '#3A2A22' },
    { shirt: '#E8637A', skin: '#D9A274', hair: '#1F1A17' },
    { shirt: '#47B39C', skin: '#B57A52', hair: '#2B211C' },
    { shirt: '#F2A93B', skin: '#E7B892', hair: '#4A3426' },
];

// Desktop: two lanes, left to right, a U-turn, then right to left.
const DESK = {
    w: 1200, h: 640,
    d: 'M40 165 C180 125 300 205 440 165 S700 125 840 165 S1050 195 1112 240 C1180 292 1178 404 1098 446 C1000 494 880 436 760 474 S500 514 360 474 S160 436 70 484',
    targets: [150, 360, 570, 780, 990, 990, 780, 570, 360, 150],
};
// Mobile: one gentle lane going down the left side.
const MOB = {
    w: 400, h: 1560,
    d: 'M58 20 C96 110 24 200 58 300 S96 480 58 580 S24 760 58 860 S96 1040 58 1140 S24 1320 58 1420 L58 1540',
};

function useIsDesktop() {
    const [desk, setDesk] = useState(true);
    useEffect(() => {
        const m = window.matchMedia('(min-width: 1024px)');
        const on = () => setDesk(m.matches);
        on();
        m.addEventListener('change', on);
        return () => m.removeEventListener('change', on);
    }, []);
    return desk;
}

/* ---------------- road ---------------- */

function Road({ d, w, h, desk, roadRef }: { d: string; w: number; h: number; desk: boolean; roadRef: React.Ref<SVGPathElement> }) {
    const k = desk ? 1 : 0.84;
    const round = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
    return (
        <>
            <defs>
                {/* asphalt grain: tiny light and dark specks inside the road only */}
                <filter id="asphalt" filterUnits="userSpaceOnUse" x={-60} y={-60} width={w + 120} height={h + 120}>
                    <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="7" result="n" />
                    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -0.98" result="light" />
                    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1.5 0 0 -0.95" result="dark" />
                    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="3" result="p" />
                    <feColorMatrix in="p" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0.9 0 -0.42" result="patch" />
                    <feComposite in="light" in2="SourceAlpha" operator="in" result="l2" />
                    <feComposite in="dark" in2="SourceAlpha" operator="in" result="d2" />
                    <feComposite in="patch" in2="SourceAlpha" operator="in" result="p2" />
                    <feMerge>
                        <feMergeNode in="SourceGraphic" />
                        <feMergeNode in="p2" />
                        <feMergeNode in="d2" />
                        <feMergeNode in="l2" />
                    </feMerge>
                </filter>
            </defs>
            {/* grass verge */}
            <path d={d} {...round} stroke="#BEDDA0" strokeWidth={84 * k} opacity={0.75} />
            <path d={d} {...round} stroke="#A9D18A" strokeWidth={70 * k} opacity={0.5} strokeDasharray="2 9" />
            {/* kerb: Indian style yellow and black stripes */}
            <path d={d} {...round} stroke={INK} strokeWidth={57 * k} />
            <path d={d} {...round} stroke="#EBC65E" strokeWidth={54 * k} />
            <path d={d} fill="none" stroke="#33364A" strokeWidth={54 * k} strokeDasharray="9 9" />
            {/* asphalt with white edge lines */}
            <g filter="url(#asphalt)">
                <path d={d} {...round} stroke="#4E525C" strokeWidth={46 * k} />
                <path d={d} {...round} stroke="#F4F1EA" strokeWidth={40 * k} />
                <path d={d} {...round} stroke="#4E525C" strokeWidth={37 * k} />
            </g>
            {/* centre line */}
            <path ref={roadRef} d={d} fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeDasharray="16 14" strokeLinecap="round" />
        </>
    );
}

/* ---------------- scenery (desktop, between the lanes) ---------------- */

function Tree({ x, y, s = 1, c = '#9ED48A' }: { x: number; y: number; s?: number; c?: string }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse cx="0" cy="0" rx="20" ry="4" fill="#6B5A40" opacity="0.12" />
            <path d="M-3 0 L-2 -24 M3 0 L2 -24" stroke={INK} strokeWidth="1.6" />
            <rect x="-3" y="-24" width="6" height="24" fill="#A9774F" />
            <path d="M0 -26 C-26 -24 -28 -50 -12 -54 C-12 -72 14 -74 16 -56 C32 -52 28 -24 0 -26 Z" fill={c} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M-8 -44 q4 -4 8 0 M6 -36 q3 -3 6 0" fill="none" stroke={INK} strokeWidth="1.1" opacity="0.5" strokeLinecap="round" />
        </g>
    );
}

function House({ x, y, wall = '#FCE6D7', roof = TERRA }: { x: number; y: number; wall?: string; roof?: string }) {
    return (
        <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
            <ellipse cx="0" cy="1" rx="30" ry="4" fill="#6B5A40" opacity="0.12" />
            <rect x="-24" y="-34" width="48" height="34" fill={wall} stroke={INK} strokeWidth="1.8" />
            <path d="M-30 -32 L0 -54 L30 -32 Z" fill={roof} stroke={INK} strokeWidth="1.8" />
            <rect x="-6" y="-18" width="12" height="18" fill="#F6C453" stroke={INK} strokeWidth="1.5" />
            <rect x="-19" y="-26" width="10" height="9" fill="#DCEBFF" stroke={INK} strokeWidth="1.4" />
            <rect x="9" y="-26" width="10" height="9" fill="#DCEBFF" stroke={INK} strokeWidth="1.4" />
        </g>
    );
}

function Lamp({ x, y }: { x: number; y: number }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <path d="M0 0 V-40 Q0 -46 7 -46" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            <path d="M4 -47 h9 l-2 4 h-5 Z" fill="#FFF3C4" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
    );
}

function Scenery() {
    return (
        <g>
            <Tree x={250} y={330} />
            <Tree x={470} y={392} s={0.85} c="#B5DE8E" />
            <Tree x={690} y={318} s={1.1} c="#8FCB7E" />
            <Tree x={905} y={382} s={0.9} />
            <Tree x={1070} y={300} s={0.8} c="#B5DE8E" />
            <House x={360} y={345} />
            <House x={790} y={352} wall="#E8F0FE" roof="#7C9CE0" />
            {/* small playground with a swing */}
            <g transform="translate(575 352)" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none">
                <path d="M-22 0 L-14 -36 L-6 0 M6 0 L14 -36 L22 0 M-14 -36 H14" stroke="#E8637A" strokeWidth="2.4" />
                <path d="M-4 -36 V-14 M4 -36 V-14" strokeWidth="1.1" />
                <rect x="-6" y="-14" width="12" height="3" fill={INK} />
            </g>
            {/* pond inside the U-turn */}
            <ellipse cx="1052" cy="362" rx="36" ry="13" fill="#BFE0F5" stroke={INK} strokeWidth="1.8" />
            <path d="M1036 360 q6 -3 12 0 M1056 366 q5 -3 10 0" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
            {/* flowers */}
            {[[300, 380], [520, 300], [640, 395], [850, 300], [140, 360], [1000, 330]].map(([fx, fy], i) => (
                <g key={i} transform={`translate(${fx} ${fy})`}>
                    <path d="M0 0 V-7" stroke="#5E9E4E" strokeWidth="1.3" />
                    <circle cy="-9" r="3" fill={['#F6C453', '#E8637A', '#FFFFFF'][i % 3]} stroke={INK} strokeWidth="1" />
                </g>
            ))}
            <Lamp x={258} y={242} />
            <Lamp x={680} y={238} />
            <Lamp x={470} y={438} />
            <Lamp x={892} y={436} />
        </g>
    );
}

/* ---------------- kids ---------------- */

function Kid({ look, wave, delay }: { look: (typeof LOOKS)[number]; wave: boolean; delay: number }) {
    return (
        <g>
            <ellipse cx="0" cy="0.5" rx="7" ry="2" fill="#6B5A40" opacity="0.15" />
            <path d="M-2.5 -10 L-3.5 0 M2.5 -10 L3.5 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            {/* school bag */}
            <rect x="-9" y="-20" width="5" height="9" rx="1.5" fill={TERRA} stroke={INK} strokeWidth="1.1" />
            <rect x="-5.5" y="-21" width="11" height="12" rx="4" fill={look.shirt} stroke={INK} strokeWidth="1.4" />
            <path d="M5 -18 L9 -12" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <g>
                <path d="M4 -18 L10 -26" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
                {wave && (
                    <animateTransform attributeName="transform" type="rotate" values="-18 4 -18; 22 4 -18; -18 4 -18" dur="0.9s" begin={`${delay}s`} repeatCount="indefinite" />
                )}
            </g>
            <circle cy="-27" r="6" fill={look.skin} stroke={INK} strokeWidth="1.4" />
            <path d="M-6 -28 Q-5 -34.5 0 -34 Q5.5 -34.5 6 -28 Q2 -31 -6 -28 Z" fill={look.hair} />
            <circle cx="-2" cy="-27" r="0.8" fill={INK} />
            <circle cx="2" cy="-27" r="0.8" fill={INK} />
            <path d="M-1.6 -24.4 Q0 -23.2 1.6 -24.4" fill="none" stroke={INK} strokeWidth="0.8" strokeLinecap="round" />
        </g>
    );
}

/* ---------------- bus ---------------- */

function Bus({ wheel, flip, riders, still }: { wheel: MotionValue<number>; flip: MotionValue<number>; riders: number; still: boolean }) {
    const windows = [10, 26, 42, 58, 74];
    const perWin = windows.map((_, i) => (riders > i ? 1 : 0) + (riders > i + 5 ? 1 : 0));
    return (
        <g transform="translate(-60 -49)">
            {/* exhaust puffs */}
            {!still && [0, 0.4, 0.8].map((b) => (
                <circle key={b} cx="0" cy="48" r="2" fill="#CFCAC0">
                    <animate attributeName="cx" values="0;-18" dur="1.2s" begin={`${b}s`} repeatCount="indefinite" />
                    <animate attributeName="cy" values="48;40" dur="1.2s" begin={`${b}s`} repeatCount="indefinite" />
                    <animate attributeName="r" values="2;6" dur="1.2s" begin={`${b}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0" dur="1.2s" begin={`${b}s`} repeatCount="indefinite" />
                </circle>
            ))}

            <g>
                {!still && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -0.9; 0 0" dur="0.34s" repeatCount="indefinite" />}
                {/* body + hood */}
                <path d="M2 50 V12 Q2 5 9 5 H96 Q102 5 102 11 V24 H112 Q118 24 119 31 L120 46 Q120 50 116 50 Z" fill="#F6C12F" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                {/* roof lights */}
                <rect x="8" y="2.5" width="6" height="3" rx="1" fill="#F2994A" stroke={INK} strokeWidth="1" />
                <rect x="88" y="2.5" width="6" height="3" rx="1" fill="#F2994A" stroke={INK} strokeWidth="1" />
                {/* black side rails */}
                <path d="M2 34 H119.4 M2 39 H119.8" stroke={INK} strokeWidth="1.4" />
                {/* passenger windows with kids */}
                {windows.map((x, i) => (
                    <g key={x}>
                        <rect x={x} y="10" width="13" height="15" rx="2.5" fill="#CFE6FB" stroke={INK} strokeWidth="1.5" />
                        {(perWin[i] === 1 ? [x + 6.5] : perWin[i] === 2 ? [x + 3.8, x + 9.2] : []).map((cx, j) => {
                            const look = LOOKS[(i + j * 2) % LOOKS.length];
                            const r = perWin[i] === 2 ? 2.8 : 3.4;
                            return (
                                <g key={j}>
                                    {!still && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -1; 0 0" dur={`${0.5 + ((i + j) % 3) * 0.12}s`} repeatCount="indefinite" />}
                                    <rect x={cx - r} y={20.5} width={r * 2} height="4.5" rx="1.5" fill={look.shirt} />
                                    <circle cx={cx} cy="18" r={r} fill={look.skin} stroke={INK} strokeWidth="0.8" />
                                    <path d={`M${cx - r} ${18 - 0.5} Q${cx} ${18 - r * 2} ${cx + r} ${18 - 0.5} Z`} fill={look.hair} />
                                </g>
                            );
                        })}
                        <path d={`M${x + 1.5} 13 l3 -2`} stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
                    </g>
                ))}
                {/* driver window + driver */}
                <rect x="90" y="10" width="10" height="15" rx="2" fill="#CFE6FB" stroke={INK} strokeWidth="1.5" />
                <circle cx="95.5" cy="19" r="3.2" fill="#D9A274" stroke={INK} strokeWidth="0.8" />
                <path d="M92 17 Q95.5 13.5 99 17 Z" fill="#26294A" />
                {/* folding stop sign */}
                <g transform="translate(86 30)">
                    <path d="M-3 0 L-1.3 -3 H1.3 L3 0 L1.3 3 H-1.3 Z" fill="#E5484D" stroke={INK} strokeWidth="0.8" />
                </g>
                {/* windscreen + mirror + lights */}
                <path d="M103 24 L110 24 L113 30 H103 Z" fill="#CFE6FB" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M114 25 V19 H117" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
                <rect x="116" y="17" width="3" height="5" rx="1" fill={INK} />
                <circle cx="117" cy="36.5" r="2.2" fill="#FFF7D6" stroke={INK} strokeWidth="1" />
                <rect x="2.5" y="26" width="3" height="5" rx="1" fill="#E5484D" />
                {/* bumpers */}
                <rect x="112" y="45" width="10" height="5" rx="2" fill={INK} />
                <rect x="-1" y="45" width="8" height="5" rx="2" fill={INK} />
                {/* name, kept readable when the bus turns around */}
                <motion.g style={{ scaleX: flip }}>
                    <text x="60" y="47.5" textAnchor="middle" fontSize="7" fontWeight="800" fill={INK} style={{ letterSpacing: 1.2 }}>
                        QUBEEX
                    </text>
                </motion.g>
                <motion.g style={{ scaleX: flip }}>
                    <text x="50" y="32" textAnchor="middle" fontSize="4.6" fontWeight="800" fill={INK} style={{ letterSpacing: 0.8 }}>
                        SCHOOL BUS
                    </text>
                </motion.g>
            </g>

            {/* wheel arches + wheels */}
            {[24, 96].map((cx) => (
                <g key={cx}>
                    <path d={`M${cx - 12} 50 A12 12 0 0 1 ${cx + 12} 50`} fill="#33364A" stroke={INK} strokeWidth="1.6" />
                    <motion.g style={{ rotate: wheel }}>
                        <circle cx={cx} cy="52" r="9" fill={INK} />
                        <circle cx={cx} cy="52" r="4.2" fill="#D9D4CB" />
                        <path d={`M${cx - 6} 52 H${cx + 6} M${cx} 46 V58`} stroke="#D9D4CB" strokeWidth="1.4" />
                    </motion.g>
                </g>
            ))}
        </g>
    );
}

/* ---------------- stop board ---------------- */

function Board({ s, on, i }: { s: Stop; on: boolean; i: number }) {
    return (
        <motion.div
            animate={{ opacity: on ? 1 : 0.4, scale: on ? 1 : 0.94, filter: on ? 'grayscale(0)' : 'grayscale(0.8)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className={`relative w-[164px] rounded-xl border-2 px-3 py-2.5 shadow-[3px_4px_0_rgba(38,41,74,0.85)] xl:w-[184px] ${s.more ? 'border-dashed bg-[#FFFDF6]' : 'bg-white'}`}
            style={{ borderColor: INK, rotate: i % 2 ? 2 : -2 }}
        >
            {/* washi tape */}
            <span aria-hidden className="absolute -top-2.5 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-4deg] opacity-80" style={{ background: s.soft }} />
            <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: s.soft, color: s.color }}>
                    <s.icon size={15} />
                </span>
                <span style={DISPLAY} className="text-[13px] font-bold leading-tight text-[#26294A]">{s.title}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-[#5A5F7D]">{s.desc}</p>
        </motion.div>
    );
}

/* ---------------- section ---------------- */

export default function BusRoute() {
    const desk = useIsDesktop();
    const still = !!useReducedMotion();
    const cfg = desk ? DESK : MOB;
    const section = useRef<HTMLElement>(null);
    // The sticky stage carries its own copy of the paper, so the paper stays put
    // while the bus drives. It is shifted by the section's offset so its pattern
    // lines up exactly with the page paper above it (no visible joint).
    const [paperShift, setPaperShift] = useState(0);
    useEffect(() => {
        const el = section.current;
        const parent = el?.parentElement;
        if (!el || !parent) return;
        const measure = () => setPaperShift(el.getBoundingClientRect().top - parent.getBoundingClientRect().top);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(parent);
        return () => ro.disconnect();
    }, []);
    const road = useRef<SVGPathElement>(null);
    const moving = useRef<SVGSVGElement>(null);
    // Kids waving, exhaust puffs and bus bounce are SVG animations: pause them
    // whenever the section is off screen so they cost nothing there.
    useEffect(() => {
        const el = section.current, svgEl = moving.current;
        if (!el || !svgEl) return;
        const io = new IntersectionObserver(([en]) => {
            if (en.isIntersecting) svgEl.unpauseAnimations(); else svgEl.pauseAnimations();
        });
        io.observe(el);
        return () => io.disconnect();
    }, [desk]);
    const [stopLens, setStopLens] = useState<number[]>([]);
    const [stopPts, setStopPts] = useState<{ x: number; y: number }[]>([]);
    const [total, setTotal] = useState(1);
    const [passed, setPassed] = useState(0);

    const bx = useMotionValue(cfg === DESK ? 40 : 58);
    const by = useMotionValue(cfg === DESK ? 165 : 20);
    const rot = useMotionValue(0);
    const flip = useMotionValue(1);
    const wheel = useMotionValue(0);

    // Work out where each stop sits on the road.
    useEffect(() => {
        const p = road.current;
        if (!p) return;
        const len = p.getTotalLength();
        setTotal(len);
        const lens: number[] = [];
        if (desk) {
            DESK.targets.forEach((tx, i) => {
                const [from, to] = i < 5 ? [0, len * 0.48] : [len * 0.52, len];
                let best = from, dist = Infinity;
                for (let l = from; l <= to; l += 2) {
                    const pt = p.getPointAtLength(l);
                    const dd = Math.abs(pt.x - tx);
                    if (dd < dist) { dist = dd; best = l; }
                }
                lens.push(best);
            });
        } else {
            STOPS.forEach((_, i) => lens.push((len * (i + 0.7)) / (STOPS.length + 0.4)));
        }
        setStopLens(lens);
        setStopPts(lens.map((l) => { const pt = p.getPointAtLength(l); return { x: pt.x, y: pt.y }; }));
    }, [desk]);

    const { scrollYProgress } = useScroll({
        target: section,
        offset: desk ? ['start start', 'end end'] : ['start 0.75', 'end 0.6'],
    });
    const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.4 });

    const place = (prog: number) => {
        const p = road.current;
        if (!p || total <= 1) return;
        const l = Math.max(0, Math.min(total, prog * total));
        const a = p.getPointAtLength(l);
        const b = p.getPointAtLength(Math.min(total, l + 3));
        const dx = b.x - a.x, dy = b.y - a.y;
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        bx.set(a.x); by.set(a.y);
        // on the phone the road just wiggles downwards, so never turn the bus around there
        if (desk && dx < 0) { flip.set(-1); rot.set(180 - ang); } else { flip.set(1); rot.set(ang); }
        wheel.set(l * 2.4);
        const n = stopLens.filter((s) => l >= s - 24).length;
        setPassed((prev) => (prev === n ? prev : n));
    };

    useMotionValueEvent(smooth, 'change', (v) => { if (!still) place(v); });
    useEffect(() => { place(still ? 1 : smooth.get()); }); // initial + after layout

    const lit = still ? STOPS.length : passed;
    const riders = KIDS.slice(0, lit).reduce((a, b) => a + b, 0);

    return (
        <section
            id="route"
            ref={section}
            className="relative"
            style={{ height: desk ? '300vh' : undefined }}
        >
            <div
                className={desk ? 'sticky top-0 flex h-screen flex-col justify-center overflow-hidden pt-10' : 'py-14'}
                style={desk ? { ...paper, backgroundPosition: `0 ${-paperShift}px` } : undefined}
            >
                <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">the QubeEx route</p>
                    <h2 style={DISPLAY} className="mt-1 text-3xl font-bold tracking-[-0.02em] text-[#26294A] sm:text-5xl">
                        Hop onto the <span style={{ color: TERRA }}>AI journey.</span>
                    </h2>
                    <p className="mt-2 text-sm text-[#5A5F7D] sm:text-base">
                        {desk ? 'Scroll to drive.' : 'Keep scrolling.'} AI stops first, then everything else a school needs.
                    </p>
                </div>

                <div
                    className="relative mx-auto mt-6 w-full max-w-[1200px] px-2"
                    style={desk ? { width: 'min(100%, calc((100vh - 265px) * 1.875))' } : undefined}
                >
                    <div className="relative" style={{ aspectRatio: `${cfg.w} / ${cfg.h}` }}>
                        {/* still layer: painted once */}
                        <svg viewBox={`0 0 ${cfg.w} ${cfg.h}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                            {desk && <Scenery />}
                            <Road d={cfg.d} w={cfg.w} h={cfg.h} desk={desk} roadRef={road} />
                        </svg>

                        {/* moving layer: stops, kids and the bus */}
                        <svg ref={moving} viewBox={`0 0 ${cfg.w} ${cfg.h}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                            {stopPts.map((pt, i) => {
                                const on = i < lit;
                                // desktop: kids stand on the inside of each lane; mobile: left of the road
                                const lane1 = desk && i < 5;
                                const feet = desk ? { x: pt.x, y: lane1 ? pt.y + 58 : pt.y - 32 } : { x: Math.max(14 + KIDS[i] * 13, pt.x - 28), y: pt.y + 16 };
                                const board = desk ? { x: 0, y: lane1 ? -22 : 22 } : { x: 22, y: 0 };
                                return (
                                    <g key={i}>
                                        {/* bus stop sign */}
                                        {desk ? (
                                            <g transform={`translate(${feet.x + 24} ${feet.y})`}>
                                                <path d="M0 0 V-38" stroke={INK} strokeWidth="2" strokeLinecap="round" />
                                                <circle cy="-42" r="8" fill={on ? STOPS[i].color : '#FFFFFF'} stroke={INK} strokeWidth="2" />
                                                <rect x="-3.5" y="-45" width="7" height="5" rx="1" fill={on ? '#FFFFFF' : INK} opacity={0.9} />
                                            </g>
                                        ) : (
                                            <circle cx={pt.x} cy={pt.y} r={7} fill={on ? STOPS[i].color : '#FFFFFF'} stroke={INK} strokeWidth={2} />
                                        )}
                                        {/* waiting kids, they hop on when the bus passes */}
                                        {Array.from({ length: KIDS[i] }).map((_, j) => (
                                            <g key={j} transform={`translate(${feet.x - 8 - j * (desk ? 15 : 13)} ${feet.y}) scale(${desk ? 1 : 0.85})`}>
                                                <motion.g
                                                    initial={false}
                                                    animate={{ opacity: on ? 0 : 1, x: on ? board.x : 0, y: on ? board.y : 0, scale: on ? 0.6 : 1 }}
                                                    transition={{ duration: 0.45, ease: 'easeIn', delay: j * 0.08 }}
                                                >
                                                    <Kid look={LOOKS[(i + j) % LOOKS.length]} wave={!still && !on} delay={(i * 0.37 + j * 0.2) % 1} />
                                                </motion.g>
                                            </g>
                                        ))}
                                    </g>
                                );
                            })}
                            <motion.g style={{ x: bx, y: by, rotate: rot, scaleX: flip, originX: '0px', originY: '0px', transformBox: 'view-box' }}>
                                <Bus wheel={wheel} flip={flip} riders={riders} still={still} />
                            </motion.g>
                        </svg>

                        {/* stop boards */}
                        {stopPts.map((pt, i) => {
                            const top = (pt.y / cfg.h) * 100;
                            const left = (pt.x / cfg.w) * 100;
                            const above = desk && i < 5;
                            const style = desk
                                ? { left: `${left}%`, top: `${top}%`, transform: above ? 'translate(-50%, calc(-100% - 40px))' : 'translate(-50%, 40px)' }
                                : { left: '28%', top: `${top}%`, transform: 'translateY(-50%)' };
                            return (
                                <div key={i} className="absolute" style={style}>
                                    <Board s={STOPS[i]} on={i < lit} i={i} />
                                </div>
                            );
                        })}

                        {desk && (
                            <>
                                <span style={{ ...HAND, left: '1%', top: '36%' }} className="absolute rotate-[-6deg] text-lg leading-tight text-[#8A6A5A]">
                                    start here,<br />the AI lane first
                                </span>

                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
