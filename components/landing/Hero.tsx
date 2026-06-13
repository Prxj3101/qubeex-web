'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { EASE, DISPLAY, SplitWords, Counter } from './motion';

const Qube3D = dynamic(() => import('./Qube3D'), { ssr: false });

const GRAIN =
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.3'/%3E%3C/svg%3E\")";

const STATS: { to: number; suffix: string; label: string }[] = [
    { to: 40, suffix: '+', label: 'institutions onboard' },
    { to: 25000, suffix: '+', label: 'students tracked daily' },
    { to: 98, suffix: '%', label: 'attendance accuracy' },
];

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
                    style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.30), transparent 65%)' }}
                    animate={{ x: [0, -60, 0], y: [0, 50, 0], scale: [1, 1.12, 1] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute -left-[15%] top-[15%] h-[70vh] w-[70vh] rounded-full blur-[110px]"
                    style={{ background: 'radial-gradient(circle, rgba(218,119,86,0.22), transparent 65%)' }}
                    animate={{ x: [0, 70, 0], y: [0, -40, 0] }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute bottom-[-20%] left-[30%] h-[60vh] w-[60vh] rounded-full blur-[100px]"
                    style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.16), transparent 65%)' }}
                    animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
                    transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="absolute inset-0 opacity-60 mix-blend-soft-light" style={{ backgroundImage: GRAIN }} />
                <div
                    className="absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_40%_40%,black,transparent)]"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, rgba(124,58,237,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(124,58,237,0.07) 1px, transparent 1px)',
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
                    className="mb-7"
                >
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#E0D5F7] bg-white/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7C3AED] backdrop-blur">
                        <Sparkles size={13} />
                        AI-Powered Student Assessment System
                    </span>
                </motion.div>

                <h1
                    style={DISPLAY}
                    className="max-w-4xl text-[3.2rem] font-bold leading-[0.98] tracking-[-0.03em] text-[#190D2E] sm:text-[5rem] lg:text-[6.2rem]"
                >
                    <SplitWords text="Paperwork out." delay={0.25} />
                    <br />
                    <span className="bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#DA7756] bg-clip-text text-transparent">
                        <SplitWords text="Intelligence in." delay={0.55} />
                    </span>
                </h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
                    className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-[#5C5470] sm:text-lg"
                >
                    QubeEx turns attendance, assessments and fees into live insight — one calm
                    platform for schools today. Colleges &amp; coaching, coming soon.
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
                        <span className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] to-[#DA7756] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        <span className="relative">Request a Demo</span>
                        <ArrowRight size={16} className="relative transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                    <a
                        href="#features"
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#D9CDF5] bg-white/60 px-8 py-4 text-sm font-bold text-[#190D2E] backdrop-blur transition-colors hover:border-[#7C3AED] hover:bg-white"
                    >
                        See it in action
                    </a>
                </motion.div>

                {/* stats */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 1.25 }}
                    className="mt-16 flex flex-wrap gap-x-12 gap-y-6 lg:mt-20"
                >
                    {STATS.map((s) => (
                        <div key={s.label}>
                            <p style={DISPLAY} className="text-3xl font-bold tracking-tight text-[#190D2E] sm:text-4xl">
                                <Counter to={s.to} suffix={s.suffix} />
                            </p>
                            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-[#9A93AC]">{s.label}</p>
                        </div>
                    ))}
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
                    className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-[#C9BCEB] p-1.5"
                >
                    <div className="h-2 w-1 rounded-full bg-[#7C3AED]" />
                </motion.div>
            </motion.div>
        </section>
    );
}
