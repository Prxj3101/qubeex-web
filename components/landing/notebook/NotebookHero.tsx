'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import { DISPLAY, EASE } from '../motion';
import School3D from './School3D';
import { HAND, INK, TERRA } from './paper';

// Small doodles floating on the page margins.
function Doodle({ d, className, delay = 0 }: { d: string; className: string; delay?: number }) {
    const still = useReducedMotion();
    return (
        <motion.svg
            viewBox="0 0 40 40"
            className={className}
            aria-hidden
            initial={still ? false : { opacity: 0, scale: 0.6 }}
            animate={still ? undefined : { opacity: 0.55, scale: 1, rotate: [0, 6, 0] }}
            transition={{ delay, duration: 0.6, rotate: { duration: 7, repeat: Infinity, ease: 'easeInOut' } }}
        >
            <path d={d} fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
    );
}

const STAR = 'M20 4 L24 15 L36 15 L26 22 L30 34 L20 27 L10 34 L14 22 L4 15 L16 15 Z';
const PENCIL = 'M8 32 L10 24 L28 6 L34 12 L16 30 Z M10 24 L16 30 M25 9 L31 15';
const BOOK = 'M6 10 Q14 6 20 10 Q26 6 34 10 V32 Q26 28 20 32 Q14 28 6 32 Z M20 10 V32';
const RULER = 'M4 26 L26 4 L36 14 L14 36 Z M10 20 L13 23 M15 15 L18 18 M20 10 L23 13';

// Watercolour sky behind the island and a crayon sun, so white clouds and
// paper planes stand out on the white page.
function SkyWash() {
    const still = useReducedMotion();
    return (
        <svg viewBox="0 0 600 500" className="pointer-events-none absolute -inset-[4%] h-[108%] w-[108%]" style={{ mixBlendMode: 'multiply' }} aria-hidden>
            <defs>
                <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="8" />
                    <feDisplacementMap in="SourceGraphic" scale="46" />
                    <feGaussianBlur stdDeviation="1.4" />
                </filter>
                <radialGradient id="skyg" cx="50%" cy="42%" r="55%">
                    <stop offset="0" stopColor="#BFDDF5" stopOpacity="0.75" />
                    <stop offset="0.65" stopColor="#D5E9F8" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#E9F3FB" stopOpacity="0" />
                </radialGradient>
            </defs>
            <motion.g
                filter="url(#wash)"
                initial={still ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.4, ease: EASE }}
                style={{ originX: '50%', originY: '45%' }}
            >
                <ellipse cx="300" cy="225" rx="275" ry="205" fill="url(#skyg)" />
            </motion.g>
            {/* crayon sun: rises in on load, then breathes - glow pulses, rays spin and twinkle */}
            <g transform="translate(520 70)">
                <motion.g
                    initial={still ? false : { y: 70, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
                >
                    {/* soft halo that swells and fades */}
                    <motion.circle
                        r="46" fill="#FFE7A3"
                        animate={still ? undefined : { scale: [1, 1.18, 1], opacity: [0.35, 0.12, 0.35] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.g
                        filter="url(#wash)"
                        animate={still ? undefined : { scale: [1, 1.06, 1] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <circle r="34" fill="#FFD86B" opacity="0.85" />
                    </motion.g>
                    <motion.g
                        animate={still ? undefined : { rotate: 360 }}
                        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                    >
                        {Array.from({ length: 10 }).map((_, i) => {
                            const a = (i / 10) * Math.PI * 2;
                            const c = Math.cos(a), sn = Math.sin(a);
                            return (
                                <motion.path
                                    key={i}
                                    d={`M${(c * 44).toFixed(2)} ${(sn * 44).toFixed(2)} L${(c * 58).toFixed(2)} ${(sn * 58).toFixed(2)}`}
                                    stroke="#F2B84B" strokeWidth="4" strokeLinecap="round"
                                    // rays take turns stretching out a little, like a twinkle
                                    animate={still ? undefined : { pathLength: [0.55, 1, 0.55], opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: (i % 2) * 0.9 }}
                                />
                            );
                        })}
                    </motion.g>
                </motion.g>
            </g>
        </svg>
    );
}

export default function NotebookHero({ onDemo }: { onDemo: () => void }) {
    const still = useReducedMotion();
    return (
        <section id="top" className="relative overflow-hidden">

            <Doodle d={STAR} className="absolute left-[3%] top-[30%] hidden h-7 w-7 lg:block" delay={2.4} />
            <Doodle d={PENCIL} className="absolute bottom-[12%] left-[38%] hidden h-9 w-9 lg:block" delay={2.6} />
            <Doodle d={BOOK} className="absolute right-[3%] top-[14%] hidden h-9 w-9 lg:block" delay={2.8} />
            <Doodle d={RULER} className="absolute bottom-[6%] right-[4%] hidden h-8 w-8 lg:block" delay={3} />

            <div className="relative z-10 mx-auto grid w-full max-w-[1440px] lg:min-h-screen items-center gap-6 px-6 pb-12 pt-32 sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
                <div>
                    <motion.div
                        className="mb-8"
                        initial={still ? false : { opacity: 0, y: 10, rotate: -2 }}
                        animate={{ opacity: 1, y: 0, rotate: -1.5 }}
                        transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
                    >
                        <span className="relative inline-flex items-center gap-2 rounded-lg border-2 bg-white px-3.5 py-1.5 text-[14px] font-bold sm:text-[15px] text-[#26294A] shadow-[3px_3px_0_rgba(38,41,74,0.9)]" style={{ borderColor: INK }}>
                            <span aria-hidden className="absolute -top-2.5 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[4deg] bg-[#F6C453]/70" />
                            <Sparkles size={14} style={{ color: TERRA }} />
                            India&apos;s 1st AI-powered ERP + LMS school platform
                        </span>
                    </motion.div>

                    <h1 style={DISPLAY} className="whitespace-nowrap text-[2.5rem] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[3.9rem] lg:text-[clamp(2.8rem,5.2vw,5.2rem)]" >
                        <motion.span
                            className="block"
                            style={{ color: '#190D2E' }}
                            initial={still ? false : { opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
                        >
                            Paperwork out.
                        </motion.span>
                        <motion.span
                            className="relative inline-block"
                            style={{ color: TERRA }}
                            initial={still ? false : { opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}
                        >
                            Intelligence in.
                            {/* crayon underline */}
                            <svg viewBox="0 0 300 24" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-4 w-full" aria-hidden>
                                <motion.path
                                    d="M4 14 C70 4 150 22 296 8"
                                    fill="none"
                                    stroke="#F6C453"
                                    strokeWidth={7}
                                    strokeLinecap="round"
                                    initial={still ? false : { pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.8, duration: 0.6, ease: 'easeInOut' }}
                                />
                            </svg>
                        </motion.span>
                    </h1>

                    <motion.p
                        className="mt-10 max-w-2xl text-pretty text-base leading-relaxed text-[#575C7A] sm:text-lg lg:text-[1.2rem]"
                        initial={still ? false : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
                    >
                        AI isn&apos;t a corner of QubeEx you visit. It&apos;s the intelligent layer running
                        quietly beneath your entire school, all day.
                    </motion.p>

                    <motion.div
                        className="mt-12 flex flex-wrap items-center gap-5"
                        initial={still ? false : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
                    >
                        <button
                            onClick={onDemo}
                            className="group relative inline-flex -rotate-1 items-center gap-2.5 rounded-2xl px-7 py-4 text-[15px] font-bold text-white shadow-[4px_5px_0_#26294A] transition-transform hover:-translate-y-0.5 hover:rotate-0 active:translate-y-0.5 active:shadow-[2px_2px_0_#26294A]"
                            style={{ background: TERRA, border: `2px solid ${INK}` }}
                        >
                            Book a free demo
                            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                        </button>
                        <a
                            href="#route"
                            style={HAND}
                            className="inline-flex items-center gap-1.5 text-[1.5rem] text-[#26294A] underline decoration-[#F6C453] decoration-2 underline-offset-4 hover:decoration-[#DA7756]"
                        >
                            see what&apos;s inside <ArrowDown size={18} />
                        </a>
                    </motion.div>


                </div>

                <div className="relative lg:-mr-8 xl:-mr-16">
                    <SkyWash />
                    {/* soft shadow under the floating island */}
                    <div aria-hidden className="absolute bottom-[3%] left-1/2 h-10 w-[45%] -translate-x-1/2 rounded-[50%] bg-[#6B5A40]/15 blur-2xl" />
                    <School3D className="relative mx-auto w-full max-w-[900px]" />
                    <motion.span
                        style={HAND}
                        className="pointer-events-none absolute left-[2%] top-[6%] hidden rotate-[-8deg] text-xl text-[#8A6A5A] sm:block"
                        initial={still ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.6, duration: 0.6 }}
                    >
                        psst... tap the school
                        <svg viewBox="0 0 60 40" className="ml-1 inline h-6 w-9" aria-hidden>
                            <path d="M4 6 C24 4 40 14 50 32 M50 32 L40 28 M50 32 L52 21" fill="none" stroke="#8A6A5A" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </motion.span>
                </div>
            </div>
        </section>
    );
}
