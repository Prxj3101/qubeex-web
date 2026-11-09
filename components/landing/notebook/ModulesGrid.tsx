'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
    BarChart3, Banknote, Bot, Bus, CalendarCheck, ClipboardList, FileText, LayoutGrid, MessagesSquare, Package, PenLine,
    Presentation, Sparkles, UserCog, Users, Video, Wallet, type LucideIcon,
} from 'lucide-react';
import { DISPLAY, EASE } from '../motion';
import { HAND, INK, TERRA } from './paper';
import { GoldSheen } from './BusRoute';

// The feature list, ERP style: 16 areas (4 x 4), each with its main pieces
// as bullets. Names only, no how-it-works details.

// secret: exclusive feature - golden card that keeps what's inside a surprise (see it in a demo)
// gold: a highlighted (golden) card that still shows everything
type Area = { icon: LucideIcon; name: string; points: string[]; color: string; soft: string; secret?: boolean; gold?: boolean };

const AREAS: Area[] = [
    { icon: ClipboardList, name: 'Admissions', color: '#0EA5E9', soft: '#E3F4FC',
        points: ['Complete journey, enquiry to enrolment', 'Online admission portal', 'Application board', 'Custom admission forms'] },
    { icon: Users, name: 'Student management', color: '#2563EB', soft: '#E8F0FE',
        points: ['Student profiles & records', 'Classes & divisions', 'Courses & subjects', 'Student notes & flags'] },
    { icon: CalendarCheck, name: 'Attendance', color: '#0D9488', soft: '#E3F5F2',
        points: ['One-tap daily attendance', 'Authentic attendance sheet', 'Export to Excel', 'Long-absence alerts'] },
    { icon: Wallet, name: 'Fees management', color: TERRA, soft: '#FBEDE6',
        points: ['Online payment gateway', 'Fee structures', 'Instant receipts', 'Dues & reminders', 'AI fee forecast'] },
    { icon: FileText, name: 'Exams & report cards', color: '#DB2777', soft: '#FCEAF3',
        points: ['Marks entry', 'Marksheets', 'Report cards', 'Progress tracking'] },
    { icon: PenLine, name: 'AI tests & assignments', color: '#C026D3', soft: '#FAE8FB',
        points: ['Online tests', 'Anti-cheating with tab-switch detection', 'AI question papers', 'Assignments & course material'] },
    { icon: LayoutGrid, name: 'AI timetable scheduling', color: '#7C3AED', soft: '#F0EAFD',
        points: ['Whole-school timetable in one click', 'Rules in plain words', 'Clash-free, every time', 'Absent-teacher cover'] },
    { icon: Presentation, name: 'AI Blackboard', color: '#B8860B', soft: '#FFF4CC', points: [], secret: true },
    { icon: Video, name: 'Online classes', color: '#2563EB', soft: '#E8F0FE',
        points: ['Live online classes', 'Google Meet integration', 'Class links shared with students'] },
    { icon: Bot, name: 'Jarvis AI', color: '#8A6416', soft: 'rgba(255,255,255,0.7)', gold: true,
        points: ['Ask anything in plain words', 'Schedules whatever you tell it', 'Smart reminders & alerts'] },
    { icon: BarChart3, name: 'AI analytics & insights', color: '#4F46E5', soft: '#ECEBFD',
        points: ['School health score', 'Attendance, fee & result trends', 'Live dashboards', 'Exportable reports'] },
    { icon: UserCog, name: 'Staff management', color: '#475569', soft: '#EEF1F5',
        points: ['Teachers & staff', 'Sub-admins & permissions', 'Staff room', 'Full audit logs'] },
    { icon: Banknote, name: 'Payroll', color: '#CA8A04', soft: '#FBF3D9',
        points: ['One-click payroll runs', 'Biometric staff attendance', 'PF, TDS & payslips', 'Payslip updates on email & phone'] },
    { icon: Package, name: 'Inventory', color: '#B45309', soft: '#FCF0E1',
        points: ['Manage & track stock and items', 'Manage purchases', 'Track teacher requests', 'Issue ledger'] },
    { icon: MessagesSquare, name: 'Communication & apps', color: '#0891B2', soft: '#E2F5F9',
        points: ['Updates on email, WhatsApp & SMS', 'Staff rooms & class chatrooms', 'Teacher–parent chat', 'Student, parent & teacher apps'] },
    { icon: Bus, name: 'Transport', color: '#F59E0B', soft: '#FEF3C7',
        points: ['Live GPS bus tracking', 'Routes & stops', 'Parent alerts in the app'] },
];

// Golden "exclusive" card: same size as the others, but what's inside stays a surprise.
function SecretCard({ a }: { a: Area }) {
    return (
        <div
            className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-5 shadow-[4px_5px_0_rgba(38,41,74,0.85)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[5px_8px_0_rgba(38,41,74,0.85)]"
            style={{ borderColor: '#8A6416', background: 'linear-gradient(140deg, #FFF6D6 0%, #FFE08A 40%, #F5C04A 75%, #E3A92E 100%)' }}
        >
            <GoldSheen />
            {/* ribbon */}
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#4A3405] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[#FFE08A]">
                <Sparkles size={11} />Exclusive
            </span>
            <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-white/70 text-[#8A6416] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105">
                <a.icon size={23} />
            </span>
            <h3 style={DISPLAY} className="relative mt-4 text-lg font-bold leading-tight text-[#3A2904]">{a.name}</h3>
            {/* what's inside: hidden on purpose */}
            <div className="relative mt-3.5 flex-1 border-t border-dashed border-[#B98A2A]/50 pt-3.5">
                <div className="space-y-2.5" aria-hidden>
                    {[88, 70, 80].map((w, k) => (
                        <div key={k} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A6416]/60" />
                            <span className="h-2.5 rounded-full bg-[#8A6416]/20 blur-[1.5px]" style={{ width: `${w}%` }} />
                        </div>
                    ))}
                </div>
                <div className="absolute inset-0 grid place-items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8A6416]/40 bg-white/85 px-3 py-1.5 text-[12.5px] font-bold text-[#4A3405] shadow-sm">
                        <Sparkles size={13} />See it in a live demo
                    </span>
                </div>
            </div>
            <p style={HAND} className="relative mt-3 text-[19px] leading-tight text-[#5C430B]">only on QubeEx, worth the wait.</p>
        </div>
    );
}

// ── icons that come alive: each one does its own little thing when its card
//    comes on screen (and again on hover) ───────────────────────────────────
type Anim = Record<string, number[] | string[]>;
const ALIVE: Record<string, Anim> = {
    'Admissions': { y: [0, -6, 0], rotate: [0, -8, 0] },
    'Student management': { scale: [1, 1.18, 1] },
    'Attendance': { rotate: [0, -12, 10, -6, 0] },
    'Fees management': { y: [0, -5, 0, -3, 0], rotate: [0, 6, -6, 3, 0] },
    'Exams & report cards': { rotateY: [0, 180, 360] },
    'AI tests & assignments': { x: [0, 4, -4, 4, 0], rotate: [0, -10, 10, -10, 0] },
    'AI timetable scheduling': { rotate: [0, 90, 90, 0] },
    'Online classes': { scale: [1, 1.15, 1, 1.15, 1] },
    'Jarvis AI': { rotate: [0, -14, 14, -8, 0], y: [0, -3, 0, -2, 0] },
    'AI analytics & insights': { scaleY: [1, 0.4, 1.15, 1] },
    'Staff management': { rotate: [0, 180, 360] },
    'Payroll': { x: [0, 10, -3, 0] },
    'Inventory': { y: [0, -10, 0, -4, 0] },
    'Communication & apps': { scale: [1, 0.85, 1.2, 1] },
    'Transport': { x: [0, 12, 12, -2, 0] },
};

function AliveIcon({ a, hover }: { a: Area; hover: boolean }) {
    const still = useReducedMotion();
    const ref = useRef<HTMLSpanElement>(null);
    const seen = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' });
    const anim = ALIVE[a.name] ?? { scale: [1, 1.15, 1] };
    // rest values (first frame of each keyframe list) to settle back to
    const rest = Object.fromEntries(Object.entries(anim).map(([k, v]) => [k, v[0]]));
    const wasHovered = useRef(false); // after a hover, settle at rest instead of replaying
    if (hover) wasHovered.current = true;
    return (
        <span ref={ref} className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: a.soft, color: a.color }}>
            <motion.span
                // hovering: keeps playing on a loop; otherwise plays once when the card comes on screen
                key={hover ? 'loop' : 'once'}
                className="grid place-items-center"
                style={{ originY: a.name === 'AI analytics & insights' ? 1 : 0.5 }}
                animate={still ? undefined : hover ? anim : seen && !wasHovered.current ? anim : rest}
                transition={hover
                    ? { duration: 0.9, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.25 }
                    : { duration: 0.9, ease: 'easeInOut', delay: 0.25 }}
            >
                <a.icon size={23} />
            </motion.span>
        </span>
    );
}

// ── hover peeks: a tiny animated mock of the feature, shown over the bullet
//    points while the mouse is on the card (desktop) ─────────────────────────
const peekRow = 'flex items-center justify-between rounded-md bg-[#F7F5EF] px-2 py-1 text-[12px]';

function PeekAttendance({ c }: { c: string }) {
    return (
        <div className="space-y-1.5">
            {['Aarav', 'Diya', 'Kabir'].map((n, i) => (
                <div key={n} className={peekRow}>
                    <span className="font-medium text-[#2E2A3A]">{n}</span>
                    <span className="flex gap-1">
                        {['P', 'A', 'L'].map((k) => (
                            <motion.span
                                key={k}
                                className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold"
                                initial={{ background: '#FFFFFF', color: '#9AA0B8' }}
                                animate={k === 'P' ? { background: c, color: '#FFFFFF', scale: [1, 1.25, 1] } : {}}
                                transition={{ delay: 0.25 + i * 0.35, duration: 0.3 }}
                                style={{ border: '1px solid #E3DCCF' }}
                            >{k}</motion.span>
                        ))}
                    </span>
                </div>
            ))}
        </div>
    );
}

function PeekFees({ c }: { c: string }) {
    return (
        <div className="relative rounded-lg border border-dashed border-[#D9D1C2] bg-[#FFFDF8] px-3 py-2.5 text-[12px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8FA8]">Fee receipt</p>
            <div className="mt-1.5 flex justify-between"><span className="text-[#575C7A]">Term 2 fee</span><span className="font-bold text-[#190D2E]">₹12,500</span></div>
            <div className="mt-0.5 flex justify-between"><span className="text-[#575C7A]">Bus fee</span><span className="font-bold text-[#190D2E]">₹1,800</span></div>
            <motion.span
                className="absolute bottom-2 right-3 rounded-md border-2 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider"
                style={{ borderColor: c, color: c }}
                initial={{ opacity: 0, scale: 2.4, rotate: -25 }}
                animate={{ opacity: 1, scale: 1, rotate: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 13, delay: 0.4 }}
            >Paid ✓</motion.span>
        </div>
    );
}

function PeekTimetable() {
    const cells = ['#DBEAFE', '#FCE7F3', '#DCFCE7', '#FEF3C7', '#EDE9FE', '#DBEAFE', '#FEF3C7', '#DCFCE7', '#FCE7F3', '#EDE9FE', '#DCFCE7', '#DBEAFE'];
    return (
        <div className="grid grid-cols-4 gap-1">
            {cells.map((bg, i) => (
                <motion.span
                    key={i}
                    className="h-6 rounded"
                    initial={{ background: '#F1EFEA', scale: 0.7 }}
                    animate={{ background: bg, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.07, duration: 0.25 }}
                />
            ))}
            <p className="col-span-4 mt-1 text-center text-[11px] font-semibold text-[#16A34A]">0 clashes ✓</p>
        </div>
    );
}

function PeekTransport({ c }: { c: string }) {
    return (
        <div className="relative px-1 pt-5">
            <div className="relative h-1 rounded-full bg-[#E3DCCF]">
                {[0, 50, 100].map((l) => <span key={l} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white" style={{ left: `${l}%`, borderColor: c }} />)}
                <motion.span
                    className="absolute -top-5 -translate-x-1/2 text-lg leading-none"
                    style={{ scaleX: -1 }}
                    initial={{ left: '0%' }}
                    animate={{ left: ['0%', '50%', '50%', '100%'] }}
                    transition={{ duration: 2.2, times: [0, 0.4, 0.55, 1], ease: 'easeInOut' }}
                >🚌</motion.span>
            </div>
            <div className="mt-2 flex justify-between text-[10.5px] text-[#575C7A]"><span>School</span><span>Stop 2</span><span>Home</span></div>
            <motion.p className="mt-1.5 text-center text-[11px] font-semibold" style={{ color: c }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>Bus is at your stop</motion.p>
        </div>
    );
}

function PeekExams({ c }: { c: string }) {
    return (
        <div className="space-y-1">
            {[['Maths', '96'], ['Science', '91'], ['English', '88']].map(([sub, m], i) => (
                <div key={sub} className={peekRow}>
                    <span className="text-[#2E2A3A]">{sub}</span>
                    <motion.span className="font-bold text-[#190D2E]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.2 }}>{m}</motion.span>
                </div>
            ))}
            <motion.p
                style={{ ...HAND, color: c }}
                className="text-right text-2xl font-bold leading-none"
                initial={{ opacity: 0, scale: 1.8, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 13, delay: 0.9 }}
            >A+</motion.p>
        </div>
    );
}

function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
    const [n, setN] = useState(0);
    useEffect(() => {
        const t0 = performance.now();
        let raf = 0;
        const step = (t: number) => {
            const k = Math.min(1, (t - t0) / ms);
            setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
            if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [to, ms]);
    return <>{n.toLocaleString('en-IN')}</>;
}

function PeekPayroll({ c }: { c: string }) {
    return (
        <div className="rounded-lg border border-[#E3DCCF] bg-[#FFFDF8] px-3 py-2.5 text-[12px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8FA8]">Payslip · March</p>
            <div className="mt-1 flex justify-between text-[#575C7A]"><span>PF</span><span>- ₹1,800</span></div>
            <div className="flex justify-between text-[#575C7A]"><span>TDS</span><span>- ₹950</span></div>
            <div className="mt-1.5 flex items-baseline justify-between border-t border-dashed border-[#E3DCCF] pt-1.5">
                <span className="font-semibold text-[#190D2E]">Net pay</span>
                <span className="text-[15px] font-bold" style={{ color: c }}>₹<CountUp to={38450} /></span>
            </div>
        </div>
    );
}

const PEEKS: Record<string, (c: string) => ReactNode> = {
    'Attendance': (c) => <PeekAttendance c={c} />,
    'Fees management': (c) => <PeekFees c={c} />,
    'AI timetable scheduling': () => <PeekTimetable />,
    'Transport': (c) => <PeekTransport c={c} />,
    'Exams & report cards': (c) => <PeekExams c={c} />,
    'Payroll': (c) => <PeekPayroll c={c} />,
};

function FeatureCard({ a }: { a: Area }) {
    const [peek, setPeek] = useState(false);
    const [hover, setHover] = useState(false);
    if (a.secret) return <SecretCard a={a} />;
    // not every card has a peek (Partial: so TypeScript knows it can be missing)
    const preview = (PEEKS as Partial<typeof PEEKS>)[a.name];
    return (
        <div
            className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-5 shadow-[4px_5px_0_rgba(38,41,74,0.85)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[5px_8px_0_rgba(38,41,74,0.85)] ${a.gold ? '' : 'bg-white'}`}
            style={a.gold
                ? { borderColor: '#8A6416', background: 'linear-gradient(140deg, #FFF6D6 0%, #FFE08A 40%, #F5C04A 75%, #E3A92E 100%)' }
                : { borderColor: INK }}
            onMouseEnter={() => { setHover(true); if (preview) setPeek(true); }}
            onMouseLeave={() => { setHover(false); setPeek(false); }}
        >
            {a.gold && <GoldSheen />}
            <AliveIcon a={a} hover={hover} />
            <h3 style={DISPLAY} className="mt-4 text-lg font-bold leading-tight text-[#190D2E]">{a.name}</h3>
            <div className={`relative mt-3.5 border-t border-dashed pt-3.5 ${a.gold ? 'border-[#B98A2A]/50' : 'border-[#E3DCCF]'} ${preview ? 'min-h-[124px]' : ''}`}>
                {/* the bullet points keep their space, so the card doesn't change size */}
                <ul className={`space-y-1.5 transition-opacity duration-200 ${peek ? 'opacity-0' : 'opacity-100'}`}>
                    {a.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-[14px] leading-snug text-[#2E2A3A]">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
                            {p}
                        </li>
                    ))}
                </ul>
                <AnimatePresence>
                    {peek && preview && (
                        <motion.div
                            className="absolute inset-x-0 bottom-0 top-3.5"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                        >
                            {preview(a.color)}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function Heading() {
    return (
        <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: EASE }}
        >
            <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">everything in the bag,</p>
            <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                All the features your <span style={{ color: TERRA }}>school needs.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-[#575C7A] sm:text-xl">
                One login for the office, the staff room, the classroom and home.
            </p>
        </motion.div>
    );
}

// "Everything in the bag": a school bag sits above the grid. When the grid
// scrolls into view the bag unzips and the cards pop out of it one by one,
// flying (with a little spin) to their places. Then the bag zips shut.
const POP_GAP = 0.08; // seconds between cards
const spin = (i: number) => ((i * 53) % 31) - 15; // stable "random" spin per card
const BAG_H = 132;

function SchoolBag({ open }: { open: boolean }) {
    return (
        <motion.svg
            viewBox="0 0 140 132" className="h-[132px] w-[140px] overflow-visible" aria-hidden
            animate={open ? { rotate: [0, -3, 3, -2, 0], y: [0, -4, 0] } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            {/* straps */}
            <path d="M38 40 C30 16 110 16 102 40" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
            <path d="M38 40 C30 16 110 16 102 40" fill="none" stroke="#B4532A" strokeWidth="4" strokeLinecap="round" />
            {/* body */}
            <rect x="22" y="38" width="96" height="88" rx="22" fill={TERRA} stroke={INK} strokeWidth="2.6" />
            {/* front pocket */}
            <rect x="38" y="78" width="64" height="38" rx="12" fill="#E8906F" stroke={INK} strokeWidth="2.2" />
            <path d="M52 92 H88" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            {/* flap: lifts open when the cards come out, shuts after */}
            <motion.g
                style={{ originX: '70px', originY: '40px' }}
                animate={{ scaleY: open ? -1 : 1 }} // flips up over its top edge (the hinge)
                transition={{ type: 'spring', stiffness: 140, damping: 14 }}
            >
                <path d="M22 60 Q22 38 44 38 H96 Q118 38 118 60 V64 Q70 78 22 64 Z" fill="#C9653F" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
                <rect x="64" y="58" width="12" height="12" rx="3" fill="#F6C453" stroke={INK} strokeWidth="2" />
            </motion.g>
        </motion.svg>
    );
}

export default function ModulesGrid() {
    const still = useReducedMotion();
    const list = useRef<HTMLUListElement>(null);
    const items = useRef<(HTMLLIElement | null)[]>([]);
    const go = useInView(list, { once: true, margin: '0px 0px -30% 0px' });
    // each card's offset from the bag's mouth; null until measured
    const [offsets, setOffsets] = useState<{ x: number; y: number }[] | null>(null);
    const [wide, setWide] = useState(false);
    const [bagOpen, setBagOpen] = useState(false);

    useLayoutEffect(() => {
        const measure = () => {
            const ul = list.current;
            if (!ul) return;
            setWide(window.innerWidth >= 640);
            const mouthX = ul.offsetWidth / 2;
            const mouthY = -BAG_H * 0.55; // the bag sits just above the grid
            setOffsets(items.current.map((li) => li
                ? { x: mouthX - (li.offsetLeft + li.offsetWidth / 2), y: mouthY - (li.offsetTop + li.offsetHeight / 2) }
                : { x: 0, y: 0 }));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const pop = !still && wide && !!offsets; // phones / reduced motion: cards just rise in

    // open the bag while the cards come out, then zip it shut
    useEffect(() => {
        if (!go || !pop) return;
        setBagOpen(true);
        const t = setTimeout(() => setBagOpen(false), (0.2 + AREAS.length * POP_GAP + 0.6) * 1000);
        return () => clearTimeout(t);
    }, [go, pop]);

    return (
        <section id="features" className="relative scroll-mt-6">
            <div className="mx-auto w-full max-w-7xl px-6 py-14 sm:px-10 lg:py-20">
                <Heading />
                {/* the bag (wider screens) */}
                {wide && !still && (
                    <div className="relative z-20 mt-8 flex justify-center">
                        <SchoolBag open={bagOpen} />
                    </div>
                )}
                <ul ref={list} className={`relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 ${wide && !still ? 'mt-6' : 'mt-14'}`}>
                    {AREAS.map((a, i) => {
                        const o = offsets?.[i] ?? { x: 0, y: 0 };
                        return (
                            <motion.li
                                key={a.name}
                                ref={(el) => { items.current[i] = el; }}
                                className="relative"
                                initial={false}
                                animate={pop
                                    ? (go
                                        ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
                                        : { x: o.x, y: o.y, rotate: spin(i), scale: 0.12, opacity: 0 })
                                    : (go || still ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 })}
                                transition={pop
                                    ? (go
                                        ? {
                                            x: { type: 'spring', stiffness: 90, damping: 15, delay: 0.25 + i * POP_GAP },
                                            y: { type: 'spring', stiffness: 90, damping: 15, delay: 0.25 + i * POP_GAP },
                                            rotate: { type: 'spring', stiffness: 90, damping: 12, delay: 0.25 + i * POP_GAP },
                                            scale: { type: 'spring', stiffness: 160, damping: 14, delay: 0.25 + i * POP_GAP },
                                            opacity: { duration: 0.15, delay: 0.25 + i * POP_GAP },
                                        }
                                        : { duration: 0 }) // tucked in the bag, before anyone sees it
                                    : { duration: 0.5, ease: EASE, delay: (i % 4) * 0.06 }}
                            >
                                <FeatureCard a={a} />
                            </motion.li>
                        );
                    })}
                </ul>
                <p style={HAND} className="mt-10 text-center text-2xl text-[#8A6A5A]">
                    ...and more on the way.
                </p>
            </div>
        </section>
    );
}
