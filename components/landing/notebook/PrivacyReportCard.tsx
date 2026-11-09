'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { FileCheck2, KeyRound, MapPin, ScrollText, Server, Trash2, type LucideIcon } from 'lucide-react';
import { DISPLAY, EASE } from '../motion';
import { HAND, INK, TERRA } from './paper';

// DPDP (India's Digital Personal Data Protection Act, 2023): the journey of one
// child's record through QubeEx, in five steps, on a loop. A record card rides
// along the steps and visibly changes at each one (consent stamped, number
// scrambled by encryption, saved in India, change logged, deleted), with a
// caption saying what just happened. Only real features.

type Step = { icon: LucideIcon; title: string; line: string; caption: string; color: string };

const STEPS: Step[] = [
    { icon: FileCheck2, title: 'Consent first', line: 'Parent ticks a clear consent on the form', caption: 'Parent gave consent', color: '#16A34A' },
    { icon: KeyRound, title: 'Encrypted', line: 'Aadhaar, phone and address locked with AES-256', caption: 'Scrambled with AES-256', color: '#2563EB' },
    { icon: MapPin, title: 'Kept in India', line: 'Stored on servers in India', caption: 'Saved on servers in India', color: '#EA8A0C' },
    { icon: ScrollText, title: 'Every change logged', line: 'Who did what, and when', caption: 'Logged: who, what, when', color: '#7C3AED' },
    { icon: Trash2, title: 'Gone on request', line: 'Export or delete whenever the school asks', caption: 'Deleted on request', color: '#DC2626' },
];

const PLAIN = '0000 1111 2222';
const SECRET = 'x9#K!q2@Vd7$';
const STEP_MS = 1900;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789#$%@!&*';

/** Text that scrambles from one value into another, like it's being encrypted. */
function Scramble({ to, run }: { to: string; run: boolean }) {
    const [text, setText] = useState(to);
    useEffect(() => {
        if (!run) { setText(to); return; }
        let frame = 0;
        const id = setInterval(() => {
            frame++;
            const settled = Math.floor(frame / 2); // letters lock in left to right
            setText(to.split('').map((ch, i) => (i < settled || ch === ' ' ? ch : CHARS[Math.floor(Math.random() * CHARS.length)])).join(''));
            if (settled >= to.length) clearInterval(id);
        }, 45);
        return () => clearInterval(id);
    }, [to, run]);
    return <>{text}</>;
}

function RecordCard({ phase, still, desk, active }: { phase: number; still: boolean; desk: boolean; active: boolean }) {
    const encrypted = phase >= 1;
    const stored = phase >= 2;
    const logged = phase >= 3;
    const deleting = phase === 4;
    return (
        <motion.div
            className="relative w-[210px] rounded-2xl border-2 bg-white px-4 py-3 shadow-[4px_5px_0_rgba(38,41,74,0.85)]"
            style={{ borderColor: INK }}
            // delete: the card folds itself away into a folder (see DeleteFolder), which
            // then flies up and drops into the bin - like a desktop "move to trash"
            animate={deleting && !still ? { scale: [1, 0.3], opacity: [1, 0], rotate: [-3, 0] } : { scale: 1, opacity: 1, rotate: -3 }}
            transition={deleting ? { duration: 0.35, ease: 'easeIn' } : { duration: 0.3 }}
        >
            <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[17px] leading-none" style={{ background: '#FBEDE6', border: `1.5px solid ${TERRA}` }}>🧑‍🎓</span>
                <div className="leading-tight">
                    <p className="text-[12px] font-bold text-[#26294A]">Aarav Sharma</p>
                    <p className="text-[10px] text-[#8A8FA8]">Std 5 · Roll 12</p>
                </div>
                {/* consent stamp: thumped on when the card arrives */}
                <motion.span
                    className="ml-auto rounded-md border-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#16A34A]"
                    style={{ borderColor: '#16A34A' }}
                    initial={still ? false : { opacity: 0, scale: 2.6, rotate: -25 }}
                    animate={active || still ? { opacity: [0, 1, 1], scale: [2.6, 0.9, 1], rotate: [-25, -8, -8] } : { opacity: 0 }} // thump only once it's in the middle of the screen
                    transition={{ duration: 0.45, delay: 0.5, times: [0, 0.7, 1], ease: 'easeOut' }}
                >Consent ✓</motion.span>
            </div>
            <p className="mt-2.5 text-[9px] font-bold uppercase tracking-wider text-[#8A8FA8]">Aadhaar</p>
            <p className="font-mono text-[13px] font-bold" style={{ color: encrypted ? '#2563EB' : '#26294A' }}>
                {still ? (encrypted ? SECRET : PLAIN) : <Scramble to={encrypted ? SECRET : PLAIN} run={encrypted} />}
            </p>
            {/* filled in as the record moves along (space kept so the card doesn't jump) */}
            <div className="mt-2 h-[50px] space-y-1"> {/* fixed: the card never changes size */}
                <AnimatePresence>
                    {stored && (
                        <motion.div
                            key="server"
                            className="flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[10px] font-semibold"
                            style={{ background: '#FFF4E5', color: '#B4590A' }}
                            initial={still ? false : { opacity: 0, x: 24, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                        >
                            <Server size={11} />
                            Saved to server · India
                            <motion.span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#16A34A]" animate={still ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                        </motion.div>
                    )}
                    {logged && (
                        <motion.div
                            key="log"
                            className="flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[10px] font-semibold"
                            style={{ background: '#F1EBFD', color: '#6D28D9' }}
                            initial={still ? false : { opacity: 0, x: -24, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                        >
                            <ScrollText size={11} />
                            Logged · Admin, 10:42 am
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// how far down the card travels to reach the bin icon on the last step (desktop)
// where the bin's mouth is, from the card's centre (desktop) - the folder drops in there
const MOUTH_X = 6;
const MOUTH_Y = 128;
const DEL_S = 1.9; // the whole delete moment (one step)
const SHOW = 'inset(-30% -30% 0% -30%)'; // whole folder (a little extra room for its shadow)
const GONE = 'inset(-30% -30% 100% -30%)'; // cut away from the bottom up = gone into the bin

/**
 * "Move to trash": a folder appears where the card was, hops up, arcs over and
 * drops into the bin (the last step's icon) while its lid is open.
 */
function DeleteFolder({ desk }: { desk: boolean }) {
    const mx = desk ? MOUTH_X : 0, my = desk ? MOUTH_Y : 60;
    return (
        <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 -ml-[26px] -mt-[22px]"
            initial={{ scale: 0, x: 0, y: 0, rotate: 0, clipPath: SHOW }}
            animate={{
                scale: [0, 1.15, 1, 0.9, 0.55, 0.52],
                x: [0, 0, -14, mx * 0.4, mx, mx],
                y: [0, 0, -34, my * 0.45, my - 10, my + 14],
                rotate: [0, -6, -18, 10, 14, 8],
                // last part: it slides down through the bin's mouth - the bit that's past
                // the rim is cut away from the bottom up, so it looks like it goes INSIDE
                clipPath: [SHOW, SHOW, SHOW, SHOW, SHOW, GONE],
            }}
            transition={{ duration: DEL_S * 0.75, times: [0, 0.14, 0.34, 0.55, 0.78, 1], ease: 'easeInOut', delay: 0.12 }}
        >
            <svg viewBox="0 0 52 44" className="h-11 w-[52px] drop-shadow-[2px_3px_0_rgba(38,41,74,0.35)]">
                <path d="M3 8 Q3 4 7 4 H19 L24 9 H45 Q49 9 49 13 V38 Q49 41 45 41 H7 Q3 41 3 38 Z" fill="#1EA7F0" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                <rect x="9" y="12" width="30" height="20" rx="2" fill="#E6F6FF" stroke={INK} strokeWidth="1.4" transform="rotate(-6 24 22)" />
                <path d="M3 17 H49 V38 Q49 41 45 41 H7 Q3 41 3 38 Z" fill="#38B6F5" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            </svg>
        </motion.div>
    );
}

/** The last step's icon: a bin whose lid opens, swallows the card, and shuts. */
function BinIcon({ open }: { open: boolean }) {
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 overflow-visible" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <motion.g
                // hinged at the right end: swings up while the folder flies over, slams shut
                // with a little bounce once it's in
                style={{ originX: '21px', originY: '6px' }}
                animate={open ? { rotate: [0, 0, 75, 75, -12, 6, -2, 0] } : { rotate: 0 }}
                transition={open ? { duration: DEL_S, times: [0, 0.26, 0.36, 0.84, 0.89, 0.93, 0.97, 1] } : { duration: 0.2 }}
            >
                <path d="M3 6h18" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </motion.g>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M10 11v6M14 11v6" />
        </svg>
    );
}

export default function PrivacyReportCard() {
    const still = !!useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    // only once the steps are in the middle of the screen (the band 35%..65% of the height)
    const inView = useInView(box, { margin: '-35% 0px -35% 0px' });
    // 0..4 = at that step; loops while the section is on screen
    const [phase, setPhase] = useState(0);
    const [loop, setLoop] = useState(0); // a fresh card (and consent stamp) only once per loop
    useEffect(() => {
        if (still) return;
        // scrolled away: start fresh from step 1 next time it comes into the middle
        if (!inView) { setPhase(0); setLoop((l) => l + 1); return; }
        const id = setInterval(() => setPhase((p) => {
            const n = (p + 1) % STEPS.length;
            if (n === 0) setLoop((l) => l + 1);
            return n;
        }), STEP_MS);
        return () => clearInterval(id);
    }, [inView, still]);
    const pct = (phase / (STEPS.length - 1)) * 80; // track is 10%..90%
    const [desk, setDesk] = useState(true);
    useEffect(() => {
        const m = window.matchMedia('(min-width: 768px)');
        const on = () => setDesk(m.matches);
        on();
        m.addEventListener('change', on);
        return () => m.removeEventListener('change', on);
    }, []);

    return (
        <section id="privacy" className="relative scroll-mt-6">
            <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-10 lg:py-20">
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">a child&apos;s data, start to finish,</p>
                    <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                        Built for the <span style={{ color: TERRA }}>DPDP Act, 2023.</span>
                    </h2>
                    <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-[#575C7A] sm:text-xl">
                        Built for India&apos;s Digital Personal Data Protection Act, 2023. Because most of the data in a school belongs to children.
                    </p>
                </motion.div>

                <div ref={box} className="relative mt-12">
                    {/* the record + what just happened to it (desktop: rides above the steps) */}
                    <div className="relative z-20 mb-10 h-[205px] sm:mb-6">
                        <motion.div
                            className="absolute top-0 flex flex-col items-center"
                            style={{ x: '-50%' }}
                            animate={{ left: desk ? `${10 + pct}%` : '50%' }} // phones: stays in the middle
                            initial={false}
                            transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                        >
                            {/* caption bubble */}
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={phase}
                                    style={HAND}
                                    className="mb-2 whitespace-nowrap rounded-full px-3.5 py-0.5 text-[1.2rem] text-white"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0, backgroundColor: INK }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    {STEPS[phase].caption}
                                </motion.span>
                            </AnimatePresence>
                            <div className="relative">
                                <RecordCard key={loop} phase={phase} still={still} desk={desk} active={inView} />
                                {phase === 4 && !still && <DeleteFolder desk={desk} />}
                            </div>
                            {/* little pointer down to the step */}
                            <svg viewBox="0 0 20 14" className={`mt-1 h-3.5 w-5 ${phase === 4 ? 'invisible' : ''}`} aria-hidden><path d="M2 2 L10 12 L18 2" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </motion.div>
                    </div>

                    <ol className="relative grid grid-cols-5 gap-2 sm:gap-4">
                        {/* track: grey, then filled up to the current step */}
                        <span aria-hidden className="absolute left-[10%] right-[10%] top-7 h-[3px] rounded-full bg-[#E3DCCF]" />
                        <motion.span
                            aria-hidden
                            className="absolute left-[10%] top-7 h-[3px] rounded-full"
                            style={{ background: '#190D2E' }} // same colour as "Built for the" in the heading
                            animate={{ width: `${pct}%` }}
                            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                        />
                        {STEPS.map((s, i) => {
                            const done = i < phase, now = i === phase;
                            return (
                                <li key={s.title} className="relative flex flex-col items-center text-center">
                                    <motion.span
                                        className="relative grid h-14 w-14 place-items-center rounded-2xl border-2 shadow-[3px_4px_0_rgba(38,41,74,0.85)]"
                                        style={{ borderColor: INK, rotate: i % 2 ? 3 : -3 }}
                                        animate={{
                                            backgroundColor: '#FFFFFF',
                                            color: s.color,
                                            opacity: now || done ? 1 : 0.45,
                                            scale: now ? 1.12 : 1,
                                        }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {i === STEPS.length - 1 ? <BinIcon open={now && !still} /> : <s.icon size={24} />}
                                    </motion.span>
                                    <p style={DISPLAY} className={`mt-4 text-[13px] font-bold leading-tight transition-colors sm:text-[16px] ${now ? 'text-[#190D2E]' : 'text-[#190D2E]/70'}`}>{s.title}</p>
                                    <p className="mt-1 hidden text-[14px] leading-snug text-[#575C7A] sm:block">{s.line}</p>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </div>
        </section>
    );
}
