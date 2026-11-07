'use client';

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { DISPLAY, EASE } from '../motion';
import { MODULES } from '../landing-data';
import { HAND, INK, TERRA } from './paper';

// An open book with ribbon bookmarks: one spread per role. On desktop a real
// page turns over the spine (front = old right page, back = new left page),
// with light and shadow following the fold. Pages turn by themselves until
// someone picks a ribbon.

type Role = { key: string; ribbon: string; imgs: { src: string; w: number; h: number }[]; color: string; soft: string; title: string; desc: string; points: string[]; note: string };

// Words come from the original Modules section (landing-data MODULES), so
// both stay in sync: admins (incl. sub-admins), teachers, students.
const LOOK: Record<string, Pick<Role, 'key' | 'ribbon' | 'imgs' | 'color' | 'soft' | 'note'>> = {
    'For Admins': { key: 'admin', ribbon: 'Admin', imgs: [{ src: '/images/landing/role-admin.webp', w: 486, h: 560 }, { src: '/images/landing/role-admin-2.webp', w: 490, h: 560 }], color: TERRA, soft: '#FBEDE6', note: 'less paperwork, more school' },
    'For Teachers': { key: 'teacher', ribbon: 'Teacher', imgs: [{ src: '/images/landing/role-teacher-m2.webp', w: 432, h: 560 }, { src: '/images/landing/role-teacher-f.webp', w: 475, h: 560 }], color: '#7C3AED', soft: '#F0EAFD', note: 'more time to actually teach' },
    'For Students': { key: 'student', ribbon: 'Student', imgs: [{ src: '/images/landing/role-student.webp', w: 268, h: 560 }, { src: '/images/landing/role-student-2.webp', w: 290, h: 560 }], color: '#0D9488', soft: '#E3F5F2', note: 'no more "what was the homework?"' },
};
const ROLES: Role[] = MODULES.map((m) => ({ ...LOOK[m.tag], title: m.title, desc: m.desc, points: m.points }));

const LEFT_BG = 'linear-gradient(90deg, #FBF8F1 0%, #FFFEFB 80%, #F3EEE3 100%)';
const RIGHT_BG = 'linear-gradient(90deg, #F3EEE3 0%, #FFFEFB 20%, #FBF8F1 100%)';
const TURN = 0.95;

function Tick({ color, delay, draw }: { color: string; delay: number; draw: boolean }) {
    return (
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden>
            <motion.path
                d="M4 13 L9.5 18 L20 6"
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={draw ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ delay, duration: 0.35, ease: 'easeOut' }}
            />
        </svg>
    );
}

function LeftPage({ r, n }: { r: Role; n: number }) {
    return (
        <div className="relative h-full p-7 sm:p-10">
            {/* the same 3D characters as the dashboards' overview pages */}
            {/* one man, one woman (boy and girl for students), with a little space between */}
            <div className="mx-auto flex h-36 w-fit items-end gap-6 sm:h-40 sm:gap-8">
                {r.imgs.map((im) => (
                    <div key={im.src} className="relative h-full">
                        <span aria-hidden className="absolute bottom-0 left-1/2 h-5 w-[90%] -translate-x-1/2 rounded-[50%] blur-[3px]" style={{ background: r.soft }} />
                        <Image src={im.src} alt="" width={im.w} height={im.h} className="relative h-full w-auto drop-shadow-[0_8px_10px_rgba(40,30,10,0.18)]" />
                    </div>
                ))}
            </div>
            <p style={{ ...HAND, color: r.color }} className="mt-4 text-3xl">for {r.ribbon.toLowerCase()}s,</p>
            <h3 style={DISPLAY} className="mt-1 text-3xl font-bold leading-tight tracking-[-0.02em] text-[#190D2E] sm:text-4xl">{r.title}</h3>
            <p className="mt-4 text-lg leading-relaxed text-[#575C7A]">{r.desc}</p>
            <span className="absolute bottom-4 left-7 hidden text-xs text-[#B5AC9A] sm:left-10 md:block">{n}</span>
        </div>
    );
}

function RightPage({ r, n, draw }: { r: Role; n: number; draw: boolean }) {
    return (
        <div className="relative h-full p-7 sm:p-10">
            <p style={HAND} className="text-2xl text-[#8A6A5A]">what&apos;s on this page</p>
            <ul className="mt-5 space-y-3.5">
                {r.points.map((p, k) => (
                    <li key={p} className="flex items-start gap-3 border-b border-dashed border-[#E6DECF] pb-3 text-[16px] font-medium text-[#2E2A3A]">
                        <Tick color={r.color} delay={0.15 + k * 0.12} draw={draw} />
                        {p}
                    </li>
                ))}
            </ul>
            <p style={{ ...HAND, color: r.color }} className="mt-5 rotate-[-2deg] text-right text-2xl">{r.note}</p>
            <span className="absolute bottom-4 right-7 hidden text-xs text-[#B5AC9A] sm:right-10 md:block">{n}</span>
        </div>
    );
}

function useIsWide() {
    const [wide, setWide] = useState(false);
    useEffect(() => {
        const m = window.matchMedia('(min-width: 768px)');
        const on = () => setWide(m.matches);
        on();
        m.addEventListener('change', on);
        return () => m.removeEventListener('change', on);
    }, []);
    return wide;
}

export default function RolesBook() {
    const still = useReducedMotion();
    const wide = useIsWide();
    const [i, setI] = useState(0);
    const [auto, setAuto] = useState(true);
    const [turn, setTurn] = useState<{ from: number; to: number; dir: 1 | -1 } | null>(null);
    const [drawn, setDrawn] = useState(0); // bumps so ticks redraw after each turn
    const angle = useMotionValue(0);
    const busy = useRef(false);

    // light on the turning sheet and the shadow it throws on the page below
    const frontShade = useTransform(angle, [0, -90], [0, 0.28]);
    const backShade = useTransform(angle, [-90, -180], [0.28, 0]);
    const castRight = useTransform(angle, [0, -60, -120], [0, 0.22, 0]);
    const castLeft = useTransform(angle, [-60, -120, -180], [0, 0.22, 0]);
    const lift = useTransform(angle, [0, -90, -180], [0, -14, 0]);

    const go = (to: number) => {
        if (busy.current || to === i) return;
        const dir: 1 | -1 = to > i || (i === ROLES.length - 1 && to === 0) ? 1 : -1;
        if (still || !wide) { setI(to); setDrawn((d) => d + 1); return; }
        busy.current = true;
        setTurn({ from: i, to, dir });
        angle.set(dir === 1 ? 0 : -180);
        animate(angle, dir === 1 ? -180 : 0, {
            duration: TURN,
            ease: [0.45, 0.05, 0.25, 1],
            onComplete: () => {
                setI(to);
                setTurn(null);
                setDrawn((d) => d + 1);
                busy.current = false;
            },
        });
    };

    useEffect(() => {
        if (!auto || still) return;
        const id = setTimeout(() => go((i + 1) % ROLES.length), 7000);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i, auto, still, wide]);

    const cur = ROLES[i];
    // what lies under the turning sheet
    const leftUnder = turn ? ROLES[turn.dir === 1 ? turn.from : turn.to] : cur;
    const rightUnder = turn ? ROLES[turn.dir === 1 ? turn.to : turn.from] : cur;
    const sheetFront = turn ? ROLES[turn.dir === 1 ? turn.from : turn.to] : cur; // right-page face
    const sheetBack = turn ? ROLES[turn.dir === 1 ? turn.to : turn.from] : cur; // left-page face
    const pageNo = (r: Role) => ROLES.indexOf(r) * 2 + 1;

    return (
        <section id="modules" className="relative scroll-mt-6 overflow-x-clip">
            <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-10 lg:py-20">
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">one book, three readers,</p>
                    <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                        A page for <span style={{ color: TERRA }}>everyone.</span>
                    </h2>
                </motion.div>

                <div className="relative mx-auto mt-14 max-w-5xl">
                    {/* ribbon bookmarks */}
                    <div className="relative z-10 flex flex-wrap justify-center gap-2 sm:justify-end sm:pr-10">
                        {ROLES.map((r, k) => {
                            const on = k === (turn ? turn.to : i);
                            return (
                                <button
                                    key={r.key}
                                    onClick={() => { setAuto(false); go(k); }}
                                    className="relative rounded-t-lg border-2 border-b-0 px-4 pb-3 pt-2 text-sm font-bold transition-all duration-300"
                                    style={{ borderColor: INK, background: on ? r.color : '#FFFFFF', color: on ? '#FFFFFF' : INK, transform: `translateY(${on ? 0 : 8}px)` }}
                                >
                                    {r.ribbon}
                                </button>
                            );
                        })}
                    </div>

                    {/* the book */}
                    <div className="relative -mt-1 rounded-[22px] border-2 bg-[#E9E1D2] p-2.5 shadow-[8px_10px_0_rgba(38,41,74,0.9)] sm:p-3" style={{ borderColor: INK }}>
                        {wide ? (
                            <div className="relative grid min-h-[480px] grid-cols-2 rounded-[14px]" style={{ perspective: 2200 }}>
                                {/* invisible copies of every role's pages in the same cells: the book always
                                    takes the height of the tallest role, so it doesn't grow / shrink per tab */}
                                {ROLES.map((r) => (
                                    <div key={`size-l-${r.key}`} aria-hidden className="invisible col-start-1 row-start-1"><LeftPage r={r} n={0} /></div>
                                ))}
                                {ROLES.map((r) => (
                                    <div key={`size-r-${r.key}`} aria-hidden className="invisible col-start-2 row-start-1"><RightPage r={r} n={0} draw={false} /></div>
                                ))}
                                {/* left page (under) */}
                                <div className="relative col-start-1 row-start-1 overflow-hidden rounded-l-[14px]" style={{ background: LEFT_BG }}>
                                    <LeftPage r={leftUnder} n={pageNo(leftUnder)} />
                                    <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(270deg, rgba(60,40,15,0.9), transparent 60%)', opacity: castLeft }} />
                                </div>
                                {/* right page (under) */}
                                <div className="relative col-start-2 row-start-1 overflow-hidden rounded-r-[14px]" style={{ background: RIGHT_BG }}>
                                    <RightPage r={rightUnder} n={pageNo(rightUnder) + 1} draw={!turn} key={`r-${rightUnder.key}-${drawn}`} />
                                    <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(60,40,15,0.9), transparent 60%)', opacity: castRight }} />
                                </div>

                                {/* spine */}
                                <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-14 -translate-x-1/2" style={{ background: 'linear-gradient(90deg, transparent, rgba(80,60,30,0.14) 42%, rgba(80,60,30,0.26) 50%, rgba(80,60,30,0.14) 58%, transparent)' }} />

                                {/* the turning sheet */}
                                {turn && (
                                    <motion.div
                                        className="absolute inset-y-0 left-1/2 z-30 w-1/2"
                                        style={{ rotateY: angle, y: lift, transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
                                    >
                                        {/* front: the right page being lifted */}
                                        <div className="absolute inset-0 overflow-hidden rounded-r-[14px] shadow-[0_10px_30px_rgba(40,30,10,0.25)]" style={{ background: RIGHT_BG, backfaceVisibility: 'hidden' }}>
                                            <RightPage r={sheetFront} n={pageNo(sheetFront) + 1} draw={false} />
                                            <motion.div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(40,30,10,0.6), rgba(40,30,10,0.15))', opacity: frontShade }} />
                                        </div>
                                        {/* back: the next left page */}
                                        <div className="absolute inset-0 overflow-hidden rounded-l-[14px] shadow-[0_10px_30px_rgba(40,30,10,0.25)]" style={{ background: LEFT_BG, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                                            <LeftPage r={sheetBack} n={pageNo(sheetBack)} />
                                            <motion.div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(270deg, rgba(40,30,10,0.6), rgba(40,30,10,0.15))', opacity: backShade }} />
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        ) : (
                            /* phones: pages stacked, a simple slide between roles */
                            <div className="grid overflow-hidden rounded-[14px]" style={{ background: RIGHT_BG }}>
                                {/* same trick on phones: fixed to the tallest role */}
                                {ROLES.map((r) => (
                                    <div key={`size-m-${r.key}`} aria-hidden className="invisible col-start-1 row-start-1">
                                        <LeftPage r={r} n={0} />
                                        <div className="mx-7 border-t border-dashed" />
                                        <RightPage r={r} n={0} draw={false} />
                                    </div>
                                ))}
                                <AnimatePresence mode="wait">
                                    <motion.div className="col-start-1 row-start-1" key={cur.key} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35 }}>
                                        <LeftPage r={cur} n={pageNo(cur)} />
                                        <div className="mx-7 border-t border-dashed border-[#E6DECF]" />
                                        <RightPage r={cur} n={pageNo(cur) + 1} draw />
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
