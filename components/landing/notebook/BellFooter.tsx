'use client';

import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SHOW_PRICING } from '../landing-data';
import { DISPLAY, EASE } from '../motion';
import { HAND, INK, TERRA } from './paper';

// Closing call to action with a school bell that rings when you hover or
// tap it (and once when it scrolls into view), then the footer.

function Bell({ ring }: { ring: () => void }) {
    return (
        <svg viewBox="0 0 160 170" className="h-full w-full" aria-hidden onMouseEnter={ring} onClick={ring}>
            <path d="M80 6 V24" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            <circle cx="80" cy="10" r="7" fill="#E0A92E" stroke={INK} strokeWidth="3" />
            <path d="M80 24 C46 24 36 52 34 86 C32 112 22 122 12 132 H148 C138 122 128 112 126 86 C124 52 114 24 80 24 Z" fill="#F2B23C" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M52 44 C46 60 44 80 44 96" stroke="#FFF1C2" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
            <rect x="6" y="128" width="148" height="14" rx="7" fill="#E0A92E" stroke={INK} strokeWidth="4" />
            <circle cx="80" cy="154" r="11" fill="#B9583C" stroke={INK} strokeWidth="4" />
        </svg>
    );
}

export default function BellFooter({ onDemo }: { onDemo: () => void }) {
    const still = useReducedMotion();
    const bell = useAnimationControls();
    const ring = () => {
        if (still) return;
        bell.start({ rotate: [0, -16, 14, -10, 8, -4, 0], transition: { duration: 0.9, ease: 'easeInOut' } });
    };

    return (
        <>
            <section className="relative overflow-x-clip">
                <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-6 sm:px-10">
                    <motion.div
                        className="relative rounded-[28px] border-2 bg-white px-7 py-14 text-center shadow-[9px_10px_0_rgba(38,41,74,0.9)] sm:px-14 sm:py-16"
                        style={{ borderColor: INK }}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7, ease: EASE }}
                        onViewportEnter={() => setTimeout(ring, 500)}
                    >
                        <span aria-hidden className="absolute -top-3 left-1/2 h-5 w-24 -translate-x-1/2 rotate-[-3deg] bg-[#F6C453]/75" />
                        {/* the bell, with sound lines */}
                        <div className="relative mx-auto h-28 w-28 cursor-pointer sm:h-32 sm:w-32">
                            <motion.div className="h-full w-full" style={{ originY: '4%' }} animate={bell}>
                                <Bell ring={ring} />
                            </motion.div>
                            {[-1, 1].map((s) => (
                                <svg key={s} viewBox="0 0 40 60" className={`absolute top-6 h-12 w-8 ${s < 0 ? '-left-9' : '-right-9 scale-x-[-1]'}`} aria-hidden>
                                    <path d="M30 8 C18 18 18 42 30 52 M18 16 C10 24 10 36 18 44" fill="none" stroke={TERRA} strokeWidth="3.5" strokeLinecap="round" />
                                </svg>
                            ))}
                        </div>

                        <p style={HAND} className="mt-6 text-2xl text-[#8A6A5A] sm:text-3xl">that&apos;s the bell,</p>
                        <h2 style={DISPLAY} className="mt-1 text-balance text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                            Ready to let your school <span style={{ color: TERRA }}>run smarter?</span>
                        </h2>
                        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-[#575C7A]">
                            Book a walkthrough and watch QubeEx run on your own school&apos;s classes, fees and timetable.
                        </p>
                        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                            <button
                                onClick={onDemo}
                                className="group inline-flex -rotate-1 items-center gap-2.5 rounded-2xl px-8 py-[18px] text-base font-bold text-white shadow-[4px_5px_0_#26294A] transition-transform hover:-translate-y-0.5 hover:rotate-0 active:translate-y-0.5 active:shadow-[2px_2px_0_#26294A]"
                                style={{ background: TERRA, border: `2px solid ${INK}` }}
                            >
                                Book a free demo
                                <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
                            </button>
                            <Link
                                href="/login"
                                style={HAND}
                                className="text-[1.7rem] text-[#26294A] underline decoration-[#F6C453] decoration-2 underline-offset-4 hover:decoration-[#DA7756]"
                            >
                                or log in
                            </Link>
                        </div>

                    </motion.div>
                </div>
            </section>

            {/* who made it (same line as the sales deck): one handwritten line, a cap tossed in the air */}
            <MadeByStudents />

            {/* footer: the original white style, with the dashed line on top */}
            <footer className="border-t-2 border-dashed border-[#D9D1C2] bg-white/60 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
                    <div className="flex flex-col items-center sm:items-start">
                        <div className="flex items-center gap-1.5">
                            <Image src="/QubeEx_darkmode_DA7756.png" alt="QubeEx" width={28} height={33} className="h-8 w-7 object-contain" />
                            <span className="-mt-0.5 text-[20px] font-bold leading-tight text-[#374151]" style={{ fontFamily: 'var(--font-poppins)' }}>QubeEx</span>
                        </div>
                        <span className="-mt-1 pl-[34px] text-xs text-[#9A93AC] sm:self-start">An AI-Powered SAS Platform</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#6B6480]">
                        <a href="#features" className="transition-colors hover:text-[#1D1433]">Features</a>
                        <a href="#modules" className="transition-colors hover:text-[#1D1433]">Modules</a>
                        {SHOW_PRICING && <a href="#pricing" className="transition-colors hover:text-[#1D1433]">Pricing</a>}
                        <a href="#faq" className="transition-colors hover:text-[#1D1433]">FAQ</a>
                        <Link href="/login" className="transition-colors hover:text-[#1D1433]">Login</Link>
                        {/* TODO: point to real pages once legal docs are ready (Privacy Policy, ToS, DPA) */}
                        <a href="#" className="transition-colors hover:text-[#1D1433]">Privacy Policy</a>
                        <a href="#" className="transition-colors hover:text-[#1D1433]">Terms of Service</a>
                    </div>
                    <p className="text-xs text-[#9A93AC]">© {new Date().getFullYear()} QubeEx · A Mynus Technologies LLP product</p>
                </div>
            </footer>
        </>
    );
}

// "Made by former students. For the schools that made them." on one line:
// a graduation cap gets tossed up and lands, then the second half gets a crayon underline.
function MadeByStudents() {
    const still = useReducedMotion();
    return (
        <motion.div
            className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 pb-14 pt-2 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6 }}
        >
            {/* tossed cap */}
            <motion.svg
                viewBox="0 0 48 36" className="h-9 w-12 shrink-0" aria-hidden
                initial={still ? false : { y: 0, rotate: 0 }}
                whileInView={still ? undefined : { y: [0, -34, 0], rotate: [0, -200, -360] }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
            >
                <path d="M24 4 L46 13 L24 22 L2 13 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 17 V26 Q24 33 36 26 V17" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                <path d="M42 15 V27" stroke="#F6C453" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="42" cy="29" r="2.6" fill="#F6C453" />
            </motion.svg>
            <p style={HAND} className="text-[1.75rem] leading-tight text-[#26294A] sm:text-[2.1rem]">
                Made by former students.{' '}
                <span className="relative inline-block whitespace-nowrap" style={{ color: TERRA }}>
                    For the schools that made them.
                    <svg viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-3 w-full" aria-hidden>
                        <motion.path
                            d="M3 9 C80 3 170 13 297 6" fill="none" stroke="#F6C453" strokeWidth="5" strokeLinecap="round"
                            initial={still ? false : { pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: 'easeInOut', delay: 1.2 }}
                        />
                    </svg>
                </span>
            </p>
        </motion.div>
    );
}
