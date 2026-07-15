'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Check, ArrowDown } from 'lucide-react';
import { MODULES } from './landing-data';
import { EASE, DISPLAY } from './motion';

function Slide({ index }: { index: number }) {
    const m = MODULES[index];

    return (
        <div className="flex h-full w-screen shrink-0 items-center px-6 sm:px-16">
            <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
                <div className="relative">
                    {/* ghost number */}
                    <span
                        style={{ ...DISPLAY, WebkitTextStroke: `1.5px ${m.accent}33`, color: 'transparent' }}
                        className="pointer-events-none absolute -top-24 left-0 select-none text-[10rem] font-bold leading-none sm:-top-32 sm:text-[14rem]"
                    >
                        0{index + 1}
                    </span>
                    <span
                        className="relative inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white"
                        style={{ background: m.accent }}
                    >
                        {m.tag}
                    </span>
                    <h3 style={DISPLAY} className="relative mt-6 text-balance text-3xl font-bold leading-[1.04] tracking-tight text-[#190D2E] sm:text-[3.2rem]">
                        {m.title}
                    </h3>
                    <p className="relative mt-4 max-w-md text-base leading-relaxed text-[#6B6480] sm:text-lg">{m.desc}</p>
                    <ul className="relative mt-7 space-y-3">
                        {m.points.map((p) => (
                            <li key={p} className="flex items-start gap-3 text-sm text-[#3D3552] sm:text-[15px]">
                                <span
                                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
                                    style={{ background: `${m.accent}1A`, color: m.accent }}
                                >
                                    <Check size={12} strokeWidth={3} />
                                </span>
                                {p}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* visual */}
                <div className="relative hidden lg:block">
                    <div
                        className="absolute -inset-6 rounded-[3rem] opacity-60 blur-2xl"
                        style={{ background: `linear-gradient(135deg, ${m.accent}30, transparent 70%)` }}
                    />
                    <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_48px_96px_-48px_rgba(25,13,46,0.4)] backdrop-blur">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1.5">
                                {[0, 1, 2].map((k) => (
                                    <span key={k} className="h-3 w-3 rounded-full" style={{ background: k === 0 ? m.accent : '#EBE4F8' }} />
                                ))}
                            </div>
                            <div className="h-2.5 w-20 rounded-full bg-[#EBE4F8]" />
                        </div>
                        <div className="mt-5 grid grid-cols-3 gap-3">
                            {[0, 1, 2].map((k) => (
                                <div key={k} className="rounded-2xl border border-[#F0EBFA] bg-white p-3.5">
                                    <div className="h-2 w-10 rounded-full bg-[#EBE4F8]" />
                                    <div className="mt-2.5 h-5 w-12 rounded-md" style={{ background: `${m.accent}26` }} />
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 rounded-2xl border border-[#F0EBFA] bg-white p-4">
                            <div className="flex items-end gap-2" style={{ height: 110 }}>
                                {[44, 70, 56, 84, 64, 92, 76, 60, 88, 72, 50, 80].map((h, k) => (
                                    <motion.div
                                        key={k}
                                        className="flex-1 rounded-t-md"
                                        style={{ background: k === 5 ? m.accent : `${m.accent}2E` }}
                                        initial={{ height: 0 }}
                                        whileInView={{ height: `${h}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.8, ease: EASE, delay: 0.15 + k * 0.04 }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="mt-3 flex gap-3">
                            <div className="h-10 flex-1 rounded-xl border border-[#F0EBFA] bg-white" />
                            <div className="h-10 w-28 rounded-xl" style={{ background: m.accent }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Modules() {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
    const n = MODULES.length;
    const x = useTransform(scrollYProgress, [0.08, 0.92], ['0vw', `-${(n - 1) * 100}vw`]);
    const barW = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

    return (
        <section id="modules" ref={ref} className="relative scroll-mt-0" style={{ height: `${n * 130}vh` }}>
            <div className="sticky top-0 flex h-screen flex-col overflow-hidden bg-gradient-to-b from-transparent via-white/60 to-transparent">
                {/* header */}
                <div className="flex items-end justify-between px-6 pt-24 sm:px-16">
                    <div>
                        <span className="inline-block rounded-full border border-[#F0DFD4] bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#DA7756]">
                            Modules
                        </span>
                        <h2 style={DISPLAY} className="mt-4 text-3xl font-bold tracking-tight text-[#190D2E] sm:text-[2.6rem]">
                            One platform. Every role.
                        </h2>
                    </div>
                    <div className="mb-1 hidden items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#9A93AC] sm:flex">
                        Keep scrolling
                        <ArrowDown size={14} />
                    </div>
                </div>

                {/* track */}
                <motion.div style={{ x }} className="flex min-h-0 flex-1 will-change-transform">
                    {MODULES.map((_, i) => (
                        <Slide key={i} index={i} />
                    ))}
                </motion.div>

                {/* progress */}
                <div className="px-6 pb-10 sm:px-16">
                    <div className="h-1 overflow-hidden rounded-full bg-[#EBE4F8]">
                        <motion.div style={{ width: barW }} className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#DA7756]" />
                    </div>
                </div>
            </div>
        </section>
    );
}
