'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Lottie from 'lottie-react';
import confettiAnimation from '@/public/Confetti.json';

export type BirthdayRole = 'institution' | 'admin' | 'teacher' | 'student';

interface BirthdayBannerProps {
    name: string;
    role: BirthdayRole;
    dob: string;
}

export function isTodayBirthday(dob: string): boolean {
    if (!dob) return false;
    try {
        const today = new Date();
        const d = new Date(dob);
        return today.getMonth() === d.getMonth() && today.getDate() === d.getDate();
    } catch { return false; }
}

function getYearsSince(dob: string): number {
    if (!dob) return 0;
    const today = new Date();
    const d = new Date(dob);
    if (isNaN(d.getTime())) return 0;
    let y = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) y--;
    return y;
}


const ROLE_CONFIG: Record<BirthdayRole, {
    gradient: string;
    shimmer: string;
    emoji: string;
    tag: string;
    confettiColors: string[];
    greeting: (name: string, years: number) => string;
    subtitle: (name: string, years: number) => string;
    lines: [string, string];
}> = {
    institution: {
        gradient: 'linear-gradient(125deg, rgba(251,191,36,0.72) 0%, rgba(245,158,11,0.82) 40%, rgba(217,119,6,0.88) 75%, rgba(180,83,9,0.92) 100%)',
        shimmer: 'rgba(255,255,255,0.12)',
        emoji: '🏫',
        tag: 'Anniversary',
        confettiColors: ['#FFF', '#FDE68A', '#FCD34D', '#FFFBEB', '#F59E0B'],
        greeting: (name, y) => `${y} Years of ${name}! 🥳`,
        subtitle: (_, y) => `Celebrating ${y} remarkable years of excellence`,
        lines: [
            'Every student who walked through your doors carries a piece of your legacy.',
            'Here\'s to many more years of shaping futures, inspiring minds & lasting impact!',
        ],
    },
    admin: {
        gradient: 'linear-gradient(125deg, rgba(129,140,248,0.72) 0%, rgba(99,102,241,0.82) 40%, rgba(79,70,229,0.88) 75%, rgba(55,48,163,0.92) 100%)',
        shimmer: 'rgba(255,255,255,0.10)',
        emoji: '🎂',
        tag: 'Happy Birthday',
        confettiColors: ['#FFF', '#C7D2FE', '#A5B4FC', '#E0E7FF', '#818CF8'],
        greeting: (name) => `Happy Birthday 🥳, ${name}!`,
        subtitle: () => 'Wishing you a wonderful day from the entire QubeEx team',
        lines: [
            'Your dedication and vision keep this institution running brilliantly.',
            'May this year bring new milestones, joy, and well-deserved celebrations!',
        ],
    },
    teacher: {
        gradient: 'linear-gradient(125deg, rgba(251,146,60,0.72) 0%, rgba(249,115,22,0.82) 40%, rgba(234,88,12,0.88) 75%, rgba(194,65,12,0.92) 100%)',
        shimmer: 'rgba(255,255,255,0.10)',
        emoji: '🎂',
        tag: 'Happy Birthday',
        confettiColors: ['#FFF', '#FED7AA', '#FDBA74', '#FFF7ED', '#FB923C'],
        greeting: (name) => `Happy Birthday 🥳, ${name}!`,
        subtitle: () => 'A very special day for a very special educator',
        lines: [
            'Your passion for teaching touches more lives than you\'ll ever know.',
            'The greatest gift you give is knowledge — today, we celebrate you!',
        ],
    },
    student: {
        gradient: 'linear-gradient(125deg, rgba(251,113,133,0.72) 0%, rgba(244,63,94,0.82) 40%, rgba(225,29,72,0.88) 75%, rgba(190,18,60,0.92) 100%)',
        shimmer: 'rgba(255,255,255,0.10)',
        emoji: '🎂',
        tag: 'Happy Birthday',
        confettiColors: ['#FFF', '#FECDD3', '#FDA4AF', '#FFF1F2', '#FB7185'],
        greeting: (name) => `Happy Birthday 🥳, ${name}!`,
        subtitle: () => 'Today is all about you — make it count!',
        lines: [
            'Take a break from the books and enjoy every moment of your special day!',
            'Another year older, another year wiser, another year closer to your dreams.',
        ],
    },
};

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_PIECES = Array.from({ length: 22 }, (_, i) => ({
    left: `${(i * 4.7 + 1) % 98}%`,
    delay: (i * 0.18) % 2.2,
    dur: 2.8 + (i * 0.21) % 1.8,
    size: 3 + (i % 3),
    shape: i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'square' : 'rect',
}));

function Confetti({ colors }: { colors: string[] }) {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            {CONFETTI_PIECES.map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute"
                    style={{
                        left: p.left,
                        top: '-8px',
                        width: p.shape === 'rect' ? p.size * 2 : p.size,
                        height: p.size,
                        borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'square' ? '1px' : '1px',
                        background: colors[i % colors.length],
                        opacity: 0,
                    }}
                    animate={{
                        y: [0, 120],
                        opacity: [0, 0.9, 0.9, 0],
                        rotate: [0, (i % 2 === 0 ? 1 : -1) * (120 + i * 15)],
                        x: [(i % 2 === 0 ? 8 : -8), (i % 2 === 0 ? -8 : 8)],
                    }}
                    transition={{
                        duration: p.dur,
                        delay: p.delay,
                        repeat: Infinity,
                        repeatDelay: 1.5,
                        ease: 'easeIn',
                    }}
                />
            ))}
        </div>
    );
}

// ── Candle flame overlay ──────────────────────────────────────────────────────
function CandleFlame({ delay = 0 }: { delay?: number }) {
    return (
        <div style={{ position: 'relative', width: 8, height: 12 }}>
            {/* Glow */}
            <motion.div style={{
                position: 'absolute', inset: 0,
                borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%',
                background: 'rgba(255, 200, 50, 0.5)',
                filter: 'blur(2.5px)',
            }}
                animate={{ scaleX: [1, 0.7, 1.2, 0.85, 1], scaleY: [1, 1.2, 0.85, 1.1, 1] }}
                transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut', delay }}
            />
            {/* Flame */}
            <motion.div style={{
                position: 'absolute', inset: 0,
                borderRadius: '50% 50% 22% 22% / 55% 55% 45% 45%',
                background: 'linear-gradient(180deg, #fffde7 0%, #FFD600 28%, #FF8F00 65%, #E53935 100%)',
            }}
                animate={{
                    scaleX: [1, 0.68, 1.18, 0.82, 1],
                    scaleY: [1, 1.15, 0.88, 1.1, 1],
                    rotate: [-5, 6, -7, 4, -5],
                }}
                transition={{ duration: 0.48, repeat: Infinity, ease: 'easeInOut', delay }}
            />
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function BirthdayBanner({ name, role, dob }: BirthdayBannerProps) {
    const [visible, setVisible] = useState(true);

    const isBday = isTodayBirthday(dob);
    if (!isBday || !visible) return null;

    const cfg = ROLE_CONFIG[role];
    const years = getYearsSince(dob);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="w-full rounded-2xl overflow-hidden relative"
                style={{ background: cfg.gradient }}
            >
                <Confetti colors={cfg.confettiColors} />


                {/* Radial glow blobs */}
                <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full pointer-events-none"
                    style={{ background: 'rgba(255,255,255,0.12)', filter: 'blur(24px)' }} />
                <div className="absolute -bottom-8 right-8 w-32 h-32 rounded-full pointer-events-none"
                    style={{ background: 'rgba(0,0,0,0.12)', filter: 'blur(20px)' }} />

                {/* Lottie confetti — top left corner */}
                <div className="absolute top-2 -left-4 pointer-events-none" style={{ width: 140, height: 140, zIndex: 5 }}>
                    <Lottie animationData={confettiAnimation} loop={true} />
                </div>

                {/* Lottie confetti — top right (mirrored); decorative flourish, only fits on very wide desktop banners */}
                <div className="hidden lg:block absolute top-2 pointer-events-none" style={{ right: role === 'institution' ? 780 : 820, width: 140, height: 140, zIndex: 5, transform: 'scaleX(-1)' }}>
                    <Lottie animationData={confettiAnimation} loop={true} />
                </div>

                {/* ~QubeEx signature */}
                <div className="hidden sm:block absolute bottom-3 right-4 z-20 pointer-events-none">
                    <p className="text-[14px] font-bold" style={{ color: 'rgba(255,255,255,0.72)', fontFamily: 'var(--font-poppins)' }}>
                        ~ Team QubeEx
                    </p>
                </div>

                {/* Dismiss */}
                <button
                    onClick={() => setVisible(false)}
                    className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all hover:scale-105"
                    style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
                >
                    <span className="hidden sm:inline text-[11px] font-semibold">Thankyou!</span>
                    <X size={11} />
                </button>

                {/* Content */}
                <div
                    className={`relative z-10 flex items-center justify-center gap-2 py-4 pl-4 sm:pl-6 pr-14 sm:pr-24 ${role === 'institution' ? 'lg:pl-10' : 'lg:pl-0'} lg:pr-[840px]`}
                >

                    {/* Emoji */}
                    <div className="shrink-0 flex items-center justify-center">
                        <motion.div
                            initial={{ scale: 0, rotate: -30 }}
                            animate={{ scale: [0, 1.5, 0.85, 1.25, 1], rotate: [-30, 15, -10, 6, 0] }}
                            transition={{ duration: 1, delay: 0.1, ease: 'easeOut' }}
                            style={{ position: 'relative', cursor: 'default', userSelect: 'none', fontSize: 60, lineHeight: 1 }}
                        >
                            {cfg.emoji}
                            {/* 3 candle flames — positioned on each candle of 🎂 */}
                            {cfg.emoji === '🎂' && (
                                <>
                                    <div style={{ position: 'absolute', top: 1, left: 23 }}>
                                        <CandleFlame delay={0} />
                                    </div>
                                    <div style={{ position: 'absolute', top: 0, left: 37 }}>
                                        <CandleFlame delay={0.13} />
                                    </div>
                                    <div style={{ position: 'absolute', top: 1, left: 51 }}>
                                        <CandleFlame delay={0.07} />
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>


                    {/* Text */}
                    <div className="min-w-0">
                        <motion.p
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.35 }}
                            className="text-[18px] font-extrabold text-white leading-tight drop-shadow-sm"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                        >
                            {cfg.greeting(name, years)}
                        </motion.p>

                        <motion.p
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-[12px] mt-0.5 mb-2.5 font-medium"
                            style={{ color: 'rgba(255,255,255,0.78)' }}
                        >
                            {cfg.subtitle(name, years)}
                        </motion.p>

                        <div className="flex flex-col gap-1">
                            {cfg.lines.map((line, i) => (
                                <motion.p
                                    key={i}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.38 + i * 0.1, duration: 0.3 }}
                                    className="text-[11px] flex items-start gap-1.5"
                                    style={{ color: 'rgba(255,255,255,0.68)' }}
                                >
                                    <span className="shrink-0 mt-[2px] text-[8px] text-white/90">✦</span>
                                    {line}
                                </motion.p>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
