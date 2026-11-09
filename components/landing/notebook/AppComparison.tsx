'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Bus, CreditCard, Languages, Megaphone, Mic, NotebookPen, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { DISPLAY, EASE } from '../motion';
import { HAND, INK, TERRA } from './paper';

// "Old school app vs QubeEx": the same everyday jobs, side by side. Left is a
// faded photocopy of how typical school apps do it (each line gets crossed out
// in red pen), right is how the QubeEx app does it (each gets a green tick).
// Only real QubeEx app features on the right.

type Row = { icon: LucideIcon; job: string; old: string; ours: string; color: string };

const ROWS: Row[] = [
    { icon: Sparkles, job: 'Look & feel', old: 'Old, dull design. Cluttered screens and tiny text', ours: 'Modern, colourful design that is a joy to use, with dark mode too', color: '#7C3AED' },
    { icon: Bus, job: 'Where is the bus?', old: 'Call the driver and ask', ours: 'Live bus on a map, and a ping when it is 2 min away', color: '#F59E0B' },
    { icon: Megaphone, job: 'School notices', old: 'PDF circulars and WhatsApp forwards', ours: 'One clean feed, with alerts on your phone', color: '#0EA5E9' },
    { icon: Languages, job: 'Language', old: 'English only', ours: 'Parent mode in English, Hinglish, Hindi and Marathi', color: '#16A34A' },
    { icon: CreditCard, job: 'Fees', old: 'Queue at the counter, keep the paper receipt', ours: 'Dues and receipts right in the app', color: TERRA },
    { icon: NotebookPen, job: 'Homework & tests', old: 'Photos of the board on a group chat', ours: 'Homework and online tests in the app, checked automatically', color: '#C026D3' },
    { icon: Users, job: 'Parent & child', old: 'Separate logins, separate apps', ours: 'One app. Flip a switch to Parent mode', color: '#2563EB' },
    { icon: Mic, job: 'Taking attendance', old: 'A paper register, every period', ours: 'One tap per student, or just read the names out loud', color: '#0D9488' },
];

export default function AppComparison() {
    const still = useReducedMotion();
    return (
        <section id="compare" className="relative scroll-mt-6">
            <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-10 lg:py-20">
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">spot the difference,</p>
                    <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                        Old school apps vs <span style={{ color: TERRA }}>QubeEx.</span>
                    </h2>
                    <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-[#575C7A] sm:text-xl">
                        The same everyday jobs. One way feels like 2010. The other is the QubeEx app for parents, students and teachers.
                    </p>
                </motion.div>

                {/* column titles (desktop) */}
                <div className="mt-12 hidden grid-cols-[1fr_1.25fr] gap-6 px-1 md:grid">
                    <p style={DISPLAY} className="text-center text-[15px] font-bold text-[#9A9AA5]">A typical school app</p>
                    <p style={{ ...DISPLAY, color: TERRA }} className="text-center text-[15px] font-bold">QubeEx App</p>
                </div>

                <ul className="mt-4 space-y-4 md:mt-3">
                    {ROWS.map((r, i) => (
                        <motion.li
                            key={r.job}
                            className="grid gap-3 md:grid-cols-[1fr_1.25fr] md:gap-6"
                            initial={{ opacity: 0, y: 18 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-60px' }}
                            transition={{ duration: 0.5, ease: EASE }}
                        >
                            {/* old: faded photocopy, crossed out in red pen */}
                            <div
                                className="relative flex items-center gap-3 rounded-xl border border-dashed border-[#CFCBC2] px-4 py-3"
                                style={{ background: '#EFEDE8', rotate: i % 2 ? '0.6deg' : '-0.6deg' }}
                            >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E2DFD8] text-[#8C8A86]"><r.icon size={17} /></span>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#A3A09A]">{r.job}</p>
                                    <p className="relative inline-block text-[15px] text-[#77746E]">
                                        {r.old}
                                        {/* red pen strike */}
                                        <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="pointer-events-none absolute left-0 top-1/2 h-2.5 w-full -translate-y-1/2" aria-hidden>
                                            <motion.path
                                                d="M1 6 C30 3 60 8 99 4" fill="none" stroke="#E5484D" strokeWidth="2.6" strokeLinecap="round"
                                                initial={still ? false : { pathLength: 0 }}
                                                whileInView={{ pathLength: 1 }}
                                                viewport={{ once: true, margin: '-60px' }}
                                                transition={{ duration: 0.45, delay: 0.35, ease: 'easeOut' }}
                                            />
                                        </svg>
                                    </p>
                                </div>
                                <span className="ml-auto shrink-0 text-xl font-black text-[#E5484D]">✗</span>
                            </div>

                            {/* ours: the QubeEx way, green tick */}
                            <div
                                className="relative flex items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 shadow-[3px_4px_0_rgba(38,41,74,0.85)]"
                                style={{ borderColor: INK }}
                            >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white" style={{ color: r.color, border: `1.5px solid ${r.color}33` }}><r.icon size={18} /></span>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: r.color }}>{r.job}</p>
                                    <p className="text-[15px] font-semibold leading-snug text-[#190D2E]">{r.ours}</p>
                                </div>
                                <svg viewBox="0 0 24 24" className="ml-auto h-6 w-6 shrink-0" aria-hidden>
                                    <motion.path
                                        d="M4 13 L9.5 18 L20 6" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                        initial={still ? false : { pathLength: 0 }}
                                        whileInView={{ pathLength: 1 }}
                                        viewport={{ once: true, margin: '-60px' }}
                                        transition={{ duration: 0.35, delay: 0.6, ease: 'easeOut' }}
                                    />
                                </svg>
                            </div>
                        </motion.li>
                    ))}
                </ul>

                <p style={HAND} className="mt-10 text-center text-2xl text-[#8A6A5A]">one app for the whole family, and it actually feels good to use.</p>
            </div>
        </section>
    );
}
