'use client';

import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowUp, Check, Sparkles } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { HAND, INK, TERRA } from './paper';

// "Jarvis" chat card: the question is typed into the box and sent, Jarvis
// thinks, types the answer, then shows a small visual for it. Loops through
// a few real things a principal asks.

const Chip = ({ children, tone = '#FBEDE6', ink = '#7A3B22' }: { children: ReactNode; tone?: string; ink?: string }) => (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: tone, color: ink }}>
        {children}
    </span>
);

const CHATS: { q: string; a: string; extra: ReactNode }[] = [
    {
        q: "hey jarvis, who's been absent 3 days straight?",
        a: '4 students across 3 classes 📋 here they are:',
        extra: (
            <div className="flex flex-wrap gap-1.5">
                <Chip>7B · 2</Chip><Chip>8A · 1</Chip><Chip>10C · 1</Chip>
            </div>
        ),
    },
    {
        q: 'can u make next week’s timetable? no PE after lunch pls',
        a: 'Done ✅ 48 periods placed, every teacher’s load balanced 🙌',
        extra: (
            <div className="flex flex-wrap gap-1.5">
                <Chip tone="#E6F6EC" ink="#166534"><Check size={11} /> 0 clashes</Chip>
                <Chip tone="#F0EAFD" ink="#5B21B6">PE before lunch</Chip>
            </div>
        ),
    },
    {
        q: 'schedule a PTM for 7B this friday, 4pm',
        a: 'Scheduled 📅 parents and the class teacher will get a reminder 🔔',
        extra: (
            <div className="flex flex-wrap gap-1.5">
                <Chip tone="#E8F0FE" ink="#1E40AF">Fri · 4:00 pm</Chip><Chip tone="#E6F6EC" ink="#166534"><Check size={11} /> reminders set</Chip>
            </div>
        ),
    },
    {
        q: 'need a 20 mark test for class 8 science, ch 5',
        a: 'Ready! 📝 made from the chapter itself, shuffled for every student 🔀',
        extra: (
            <div className="flex flex-wrap gap-1.5">
                <Chip tone="#FCEAF3" ink="#9D174D">10 MCQs</Chip><Chip tone="#FCEAF3" ink="#9D174D">5 short answers</Chip><Chip tone="#E3F4FC" ink="#075985">20 marks</Chip>
            </div>
        ),
    },
];

// the Lottie player (and its animation file) only load once the card is on screen
const LottiePlayer = lazy(() => import('lottie-react'));

type Phase = 'type' | 'think' | 'answer' | 'hold';

export default function JarvisChat({ className }: { className?: string }) {
    const still = useReducedMotion();
    // only type while the card is on screen
    const box = useRef<HTMLDivElement>(null);
    const seen = useInView(box, { margin: '100px' });
    const [anim, setAnim] = useState<object | null>(null);
    useEffect(() => {
        if (!seen || anim) return;
        import('@/public/lottie/ai-assistant.json').then((m) => setAnim(m.default as object)).catch(() => undefined);
    }, [seen, anim]);
    const [i, setI] = useState(0);
    const [phase, setPhase] = useState<Phase>(still ? 'hold' : 'type');
    const [n, setN] = useState(still ? 999 : 0);
    const chat = CHATS[i];
    // answers have emoji, so count by characters (not UTF-16 units) while typing
    const aChars = Array.from(chat.a);

    useEffect(() => {
        if (still || !seen) return;
        let id: ReturnType<typeof setTimeout>;
        if (phase === 'type') {
            if (n < chat.q.length) id = setTimeout(() => setN(n + 1), 34);
            else id = setTimeout(() => { setPhase('think'); setN(0); }, 450);
        } else if (phase === 'think') {
            id = setTimeout(() => setPhase('answer'), 1000);
        } else if (phase === 'answer') {
            if (n < Array.from(chat.a).length) id = setTimeout(() => setN(n + 2), 20);
            else id = setTimeout(() => setPhase('hold'), 150);
        } else {
            id = setTimeout(() => { setI((i + 1) % CHATS.length); setPhase('type'); setN(0); }, 3200);
        }
        return () => clearTimeout(id);
    }, [phase, n, i, chat, still, seen]);

    const sent = phase !== 'type';
    const answer = phase === 'answer' ? aChars.slice(0, n).join('') : chat.a;

    return (
        <div
            ref={box}
            className={`relative w-full max-w-[380px] rounded-[22px] border-2 bg-white p-3.5 shadow-[6px_7px_0_rgba(38,41,74,0.9)] ${className ?? ''}`}
            style={{ borderColor: INK }}
        >
            <span aria-hidden className="absolute -top-3 left-10 h-5 w-16 rotate-[-6deg] bg-[#F6C453]/75" />

            {/* header */}
            <div className="flex items-center gap-2.5 border-b border-dashed border-[#E3DCCF] pb-2.5">
                {/* same Jarvis logo as the admin panel: dark orb with the animated assistant */}
                <span
                    className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10"
                    style={{
                        background: 'radial-gradient(circle at 32% 28%, #3E3E3E 0%, #1E1E1E 45%, #060606 100%)',
                        boxShadow: '0 6px 12px -4px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.22), inset 0 -4px 6px rgba(0,0,0,0.65)',
                    }}
                >
                    <span className="relative h-7 w-7">
                        {anim ? (
                            <Suspense fallback={null}>
                                <span className="absolute" style={{ width: '280%', height: '280%', top: '-90%', left: '-90%', filter: 'brightness(1.3) saturate(1.4) drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>
                                    <LottiePlayer animationData={anim} loop={!still} autoplay={!still} />
                                </span>
                            </Suspense>
                        ) : (
                            <Sparkles size={15} className="absolute left-1.5 top-1.5 text-white/80" />
                        )}
                    </span>
                    {!still && (
                        <motion.span
                            className="absolute inset-0 rounded-full"
                            style={{ border: '1.5px solid rgba(226,138,107,0.65)', boxShadow: '0 0 6px rgba(226,138,107,0.2)' }}
                            animate={{ scale: [1, 1.5], opacity: [0.65, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                        />
                    )}
                </span>
                <div className="leading-tight">
                    <p className="text-sm font-bold text-[#26294A]">Jarvis</p>
                    <p className="text-[11px] text-[#8A8FA8]">your school&apos;s AI assistant</p>
                </div>
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[#E6F6EC] px-2 py-0.5 text-[10.5px] font-semibold text-[#16A34A]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16A34A]" /> online
                </span>
            </div>

            {/* messages */}
            {/* fixed height so the card never grows or shrinks between chats */}
            <div className="h-[208px] overflow-hidden py-3" aria-live="polite">
                <AnimatePresence mode="wait">
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-2.5">
                        {sent && (
                            <motion.div className="flex items-end justify-end gap-1.5" initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                                <p className="max-w-[82%] rounded-2xl rounded-br-md bg-[#26294A] px-3 py-2 text-[13px] leading-snug text-white">{chat.q}</p>
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F6C453] text-[10px] font-bold text-[#26294A]">P</span>
                            </motion.div>
                        )}
                        {phase === 'think' && (
                            <div className="flex items-center gap-1 pl-1">
                                {[0, 1, 2].map((k) => (
                                    <motion.span
                                        key={k}
                                        className="h-2 w-2 rounded-full bg-[#DA7756]"
                                        animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                                        transition={{ duration: 0.7, repeat: Infinity, delay: k * 0.12 }}
                                    />
                                ))}
                                <span className="ml-1.5 text-[11px] text-[#8A8FA8]">on it...</span>
                            </div>
                        )}
                        {(phase === 'answer' || phase === 'hold') && (
                            <motion.div className="max-w-[90%] rounded-2xl rounded-bl-md border border-[#F1D9CE] bg-[#FDF3EE] px-3 py-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                <p className="text-[13px] leading-snug text-[#3A2E2A]">{answer}</p>
                                {phase === 'hold' && (
                                    <motion.div className="mt-2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                                        {chat.extra}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* input box: the question gets typed here first */}
            <div className="flex items-center gap-2 rounded-xl border border-[#E3DCCF] bg-[#FAF8F3] py-1.5 pl-3 pr-1.5">
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-[#26294A]">
                    {phase === 'type' ? (
                        <>
                            {chat.q.slice(0, n)}
                            <span className="ml-px inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[#26294A]" />
                        </>
                    ) : (
                        <span className="text-[#A3A7BA]">Ask Jarvis anything...</span>
                    )}
                </p>
                <motion.span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
                    style={{ background: phase === 'type' && n > 0 ? TERRA : '#C9CCD8' }}
                    animate={phase === 'type' && n >= chat.q.length ? { scale: [1, 0.85, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <ArrowUp size={14} />
                </motion.span>
            </div>

            {/* which chat we are on */}
            <div className="mt-2.5 flex items-center justify-between">
                <p style={HAND} className="text-[17px] text-[#8A6A5A]">ask it anything about your school</p>
                <div className="flex gap-1">
                    {CHATS.map((_, k) => (
                        <span key={k} className="h-1.5 rounded-full transition-all duration-300" style={{ width: k === i ? 14 : 6, background: k === i ? TERRA : '#E3DCCF' }} />
                    ))}
                </div>
            </div>
        </div>
    );
}
