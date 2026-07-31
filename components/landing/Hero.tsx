'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { ArrowRight, Brain, CalendarCheck, MonitorSmartphone, Sparkles, Wallet } from 'lucide-react';
import { EASE, DISPLAY, SplitWords } from './motion';

const Qube3D = dynamic(() => import('./Qube3D'), { ssr: false });

const GRAIN =
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.3'/%3E%3C/svg%3E\")";

// NOTE: previously showed fabricated counts (institutions/students/accuracy).
// Removed until real numbers exist post-pilot (Launch Plan doc, Section 6).
const HIGHLIGHTS = [
    { icon: Brain, label: 'AI-driven insights', accent: '#7C3AED', soft: '#F1EBFD' },
    { icon: CalendarCheck, label: 'Attendance in minutes', accent: '#0D9488', soft: '#E6F7F5' },
    { icon: Wallet, label: 'Transparent fee tracking', accent: '#DA7756', soft: '#FBEFEA' },
    { icon: MonitorSmartphone, label: 'Web + mobile, one account', accent: '#2563EB', soft: '#EAF1FE' },
];

function HighlightDots() {
    const [open, setOpen] = useState<number | null>(null);
    return (
        <div className="flex flex-wrap items-center gap-3">
            {HIGHLIGHTS.map((h, i) => {
                const on = open === i;
                return (
                    <button
                        key={h.label}
                        type="button"
                        onMouseEnter={() => setOpen(i)}
                        onMouseLeave={() => setOpen((p) => (p === i ? null : p))}
                        onClick={() => setOpen(on ? null : i)}
                        className="flex h-11 items-center overflow-hidden rounded-full border bg-white/75 px-[10px] backdrop-blur transition-colors duration-300"
                        style={{ borderColor: on ? h.accent : '#EBDDD3' }}
                        aria-label={h.label}
                    >
                        <span
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                            style={{ background: h.soft, color: h.accent }}
                        >
                            <h.icon size={15} />
                        </span>
                        <motion.span
                            initial={false}
                            animate={{ maxWidth: on ? 220 : 0, opacity: on ? 1 : 0 }}
                            transition={{ duration: 0.45, ease: EASE }}
                            className="overflow-hidden whitespace-nowrap text-xs font-semibold text-[#3D3552]"
                        >
                            <span className="pl-2 pr-1.5">{h.label}</span>
                        </motion.span>
                    </button>
                );
            })}
        </div>
    );
}

export default function Hero({ onDemo }: { onDemo: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
    const copyY = useTransform(scrollYProgress, [0, 1], [0, 90]);
    const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

    return (
        <section id="top" ref={ref} className="relative min-h-screen overflow-hidden">
            {/* aurora background */}
            <div aria-hidden className="absolute inset-0">
                <motion.div
                    className="absolute -top-[30%] left-[55%] h-[90vh] w-[90vh] rounded-full blur-[120px]"
                    style={{ background: 'radial-gradient(circle, rgba(218,119,86,0.30), transparent 65%)' }}
                    animate={{ x: [0, -60, 0], y: [0, 50, 0], scale: [1, 1.12, 1] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute -left-[15%] top-[15%] h-[70vh] w-[70vh] rounded-full blur-[110px]"
                    style={{ background: 'radial-gradient(circle, rgba(194,65,12,0.18), transparent 65%)' }}
                    animate={{ x: [0, 70, 0], y: [0, -40, 0] }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute bottom-[-20%] left-[30%] h-[60vh] w-[60vh] rounded-full blur-[100px]"
                    style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.14), transparent 65%)' }}
                    animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
                    transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="absolute inset-0 opacity-60 mix-blend-soft-light" style={{ backgroundImage: GRAIN }} />
                <div
                    className="absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_40%_40%,black,transparent)]"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, rgba(218,119,86,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(218,119,86,0.09) 1px, transparent 1px)',
                        backgroundSize: '64px 64px',
                    }}
                />
            </div>

            {/* 3D Qube — right on desktop, ghosted behind copy on mobile */}
            <motion.div style={{ opacity: fade }} className="absolute inset-0">
                <Qube3D className="absolute right-[-8%] top-[8%] hidden h-[92%] w-[60%] lg:block" />
                <Qube3D className="absolute left-1/2 top-1/2 h-[80vw] w-[80vw] -translate-x-1/2 -translate-y-1/2 opacity-[0.22] lg:hidden" />
            </motion.div>

            {/* copy */}
            <motion.div
                style={{ y: copyY, opacity: fade }}
                className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 pt-28 sm:px-10 lg:pt-20"
            >
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
                    className="mb-3"
                >
                    <span
                        className="inline-flex items-center gap-2 rounded-full bg-[#F3EAE2] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#DA7756]"
                        style={{
                            boxShadow:
                                'inset 0 2px 5px rgba(122,62,32,0.22), inset 0 -1px 2px rgba(255,255,255,0.95), 0 1px 0 rgba(255,255,255,0.85)',
                        }}
                    >
                        <Sparkles size={13} />
                        An AI-Powered SAS Platform
                    </span>
                </motion.div>

                <h1
                    style={DISPLAY}
                    className="max-w-4xl text-[3.2rem] font-bold leading-[0.98] tracking-[-0.03em] text-[#190D2E] sm:text-[5rem] lg:text-[6.2rem]"
                >
                    <SplitWords text="Paperwork out." delay={0.25} />
                    <br />
                    <motion.span
                        className="inline-block bg-gradient-to-r from-[#C2410C] via-[#DA7756] to-[#514FEC] bg-clip-text text-transparent"
                        initial={{ opacity: 0, y: 40, rotate: 3 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ duration: 1.1, ease: EASE, delay: 0.65 }}
                    >
                        Intelligence in.
                    </motion.span>
                </h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
                    className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-[#5C5470] sm:text-lg"
                >
                    From a &quot;Regular Institute&quot; to an &quot;AI Institute&quot; - QubeEx makes
                    the shift, running your campus smarter, every single day.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 1.05 }}
                    className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
                >
                    <button
                        onClick={onDemo}
                        className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-2xl bg-[#190D2E] px-8 py-4 text-sm font-bold text-white transition-transform hover:scale-[1.04] active:scale-[0.97]"
                    >
                        <span className="absolute inset-0 bg-gradient-to-r from-[#DA7756] via-[#7C3AED] to-[#2563EB] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        <span className="relative">Request a Demo</span>
                        <ArrowRight size={16} className="relative transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                    <a
                        href="#features"
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#E3E0E8] bg-white/60 px-8 py-4 text-sm font-bold text-[#190D2E] backdrop-blur transition-colors hover:border-[#71717A] hover:bg-white"
                    >
                        See it in action
                    </a>
                </motion.div>

                {/* highlights */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 1.25 }}
                    className="mt-16 lg:mt-20"
                >
                    <HighlightDots />
                </motion.div>
            </motion.div>

            {/* scroll hint */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                style={{ opacity: fade }}
                className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
            >
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-[#EBCDBE] p-1.5"
                >
                    <div className="h-2 w-1 rounded-full bg-[#DA7756]" />
                </motion.div>
            </motion.div>
        </section>
    );
}
