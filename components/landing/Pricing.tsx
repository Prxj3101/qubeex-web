'use client';

import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { PLANS } from './landing-data';
import { Reveal, SectionHead, EASE, DISPLAY } from './motion';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const pctOff = (original: number, current: number) => Math.round(((original - current) / original) * 100);

export default function Pricing({ onDemo }: { onDemo: () => void }) {
    return (
        <section id="pricing" className="relative mx-auto max-w-5xl scroll-mt-28 px-6 py-24 sm:py-32">
            <SectionHead
                eyebrow="Pricing"
                title="Simple pricing that scales with you"
                sub="One licence, a small per-user rate, and a 14-day free trial to make sure it fits. College & coaching pricing coming soon."
            />

            <Reveal className="mt-10 flex justify-center">
                <span className="inline-flex items-center rounded-full bg-[#190D2E] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(25,13,46,0.5)]">
                    State Edition
                </span>
            </Reveal>

            <div className="mt-14 grid gap-6 md:grid-cols-2">
                {PLANS.map((p, i) => (
                    <Reveal key={p.name} delay={i * 0.12}>
                        <motion.div
                            whileHover={{ y: -8 }}
                            transition={{ duration: 0.35, ease: EASE }}
                            className={`relative h-full overflow-hidden rounded-[2rem] p-8 ${
                                p.highlight
                                    ? 'bg-[#1C1B22] text-white shadow-[0_48px_96px_-32px_rgba(150,70,40,0.55)] ring-2 ring-[#DA7756]/60'
                                    : 'border border-[#ECE6F8] bg-white shadow-[0_2px_24px_-12px_rgba(29,20,51,0.12)]'
                            }`}
                        >
                            {p.highlight && (
                                <>
                                    <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#E8876A]/40 blur-3xl" />
                                    <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#DA7756]/30 blur-3xl" />
                                </>
                            )}

                            {/* Limited time corner ribbon */}
                            <div className="absolute -right-12 top-7 z-10 w-44 rotate-45 overflow-hidden">
                                <motion.div
                                    animate={{ backgroundPositionX: ['0%', '100%'] }}
                                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                                    style={{
                                        background: 'linear-gradient(110deg, #F43F5E 0%, #DA7756 35%, #F97316 50%, #DA7756 65%, #F43F5E 100%)',
                                        backgroundSize: '250% 100%',
                                    }}
                                    className="flex items-center justify-center gap-1 py-1.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
                                >
                                    <Zap size={11} className="fill-current" strokeWidth={0} />
                                    Limited Time
                                </motion.div>
                            </div>

                            <div className="relative">
                                <h3 style={DISPLAY} className={`text-2xl font-bold ${p.highlight ? 'text-white' : 'text-[#190D2E]'}`}>{p.name}</h3>
                                <p className={`mt-1 text-sm ${p.highlight ? 'text-white/70' : 'text-[#6B6480]'}`}>{p.tagline}</p>

                                <div className="mt-7 flex items-center gap-2.5">
                                    <span
                                        className={`relative text-2xl font-semibold ${p.highlight ? 'text-white/70' : 'text-[#6B6480]'}`}
                                    >
                                        {inr(p.originalLicence)}
                                        <span
                                            aria-hidden
                                            className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rotate-[-4deg] bg-[#F43F5E]"
                                        />
                                    </span>
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold ${
                                        p.highlight ? 'bg-[#22C55E]/20 text-[#4ADE80]' : 'bg-[#DCFCE7] text-[#16A34A]'
                                    }`}>
                                        {pctOff(p.originalLicence, p.licence)}% OFF
                                    </span>
                                </div>

                                <div className="mt-1.5 flex items-baseline gap-2">
                                    <span style={DISPLAY} className={`text-[2.8rem] font-bold leading-none tracking-tight ${p.highlight ? 'text-white' : 'text-[#190D2E]'}`}>
                                        {inr(p.licence)}
                                    </span>
                                    <span className={`text-sm ${p.highlight ? 'text-white/60' : 'text-[#9A93AC]'}`}>one-time licence</span>
                                </div>
                                <p className={`mt-2 text-sm font-medium ${p.highlight ? 'text-white/80' : 'text-[#3D3552]'}`}>
                                    + -/user/month
                                    <span className={`ml-1.5 text-xs font-normal ${p.highlight ? 'text-white/55' : 'text-[#9A93AC]'}`}>
                                        (- beyond 1,500 users)
                                    </span>
                                </p>

                                <div className={`my-7 h-px ${p.highlight ? 'bg-white/15' : 'bg-[#F0EBFA]'}`} />

                                <ul className="space-y-3.5">
                                    {p.points.map((pt) => (
                                        <li key={pt} className={`flex items-start gap-3 text-sm ${p.highlight ? 'text-white/85' : 'text-[#3D3552]'}`}>
                                            <span
                                                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                                                    p.highlight ? 'bg-white/15 text-[#F0B49C]' : 'bg-[#FBEFEA] text-[#DA7756]'
                                                }`}
                                            >
                                                <Check size={12} strokeWidth={3} />
                                            </span>
                                            {pt}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={onDemo}
                                    className={`mt-9 w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                        p.highlight
                                            ? 'bg-white text-[#1D1433] shadow-[0_12px_28px_-12px_rgba(255,255,255,0.5)]'
                                            : 'bg-[#DA7756] text-white shadow-[0_12px_28px_-12px_rgba(218,119,86,0.6)]'
                                    }`}
                                >
                                    Start free trial
                                </button>
                            </div>
                        </motion.div>
                    </Reveal>
                ))}
            </div>

            <Reveal delay={0.2} className="mt-8 text-center">
                <p className="text-base text-[#9A93AC]">
                    Every plan starts with a <span className="font-semibold text-[#DA7756]">14-day free trial</span> - full access, no payment details required.
                </p>
                <p className="mt-2 text-base text-[#9A93AC]">
                    <span className="font-semibold text-[#DB2777]">AI Smartboard</span> addon included free for the first year on all plans. Multiple branches? Flat 20% off every licence.
                </p>
            </Reveal>
        </section>
    );
}
