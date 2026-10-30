'use client';

import {
    motion, useAnimationFrame, useMotionValue, useScroll,
    useSpring, useTransform, useVelocity, wrap,
} from 'framer-motion';
import { useRef } from 'react';
import { DISPLAY } from './motion';

const WORDS = [
    'AI Blackboard',
    'Fees',
    'AI Tests & Exams',
    'Student App',
    'AI Insights & Analytics',
    'Attendance',
    'Audit Logs',
    'Announcements & Feed',
    'Staffroom',
    'More...',
];

function Line({ baseVelocity, outline }: { baseVelocity: number; outline?: boolean }) {
    const baseX = useMotionValue(0);
    const { scrollY } = useScroll();
    const scrollVelocity = useVelocity(scrollY);
    const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
    const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 4], { clamp: false });
    const skew = useTransform(smoothVelocity, [-1000, 1000], [-6, 6]);
    const x = useTransform(baseX, (v) => `${wrap(-25, 0, v)}%`);
    const dir = useRef(1);

    useAnimationFrame((_, delta) => {
        let moveBy = dir.current * baseVelocity * (delta / 1000);
        const vf = velocityFactor.get();
        if (vf < 0) dir.current = -1;
        else if (vf > 0) dir.current = 1;
        moveBy += dir.current * moveBy * Math.abs(vf);
        baseX.set(baseX.get() + moveBy);
    });

    return (
        <div className="overflow-hidden whitespace-nowrap">
            <motion.div style={{ x, skewX: skew, ...DISPLAY }} className="flex w-max items-center">
                {Array.from({ length: 4 }).flatMap((_, rep) =>
                    WORDS.map((w, i) => (
                        <span key={`${rep}-${i}`} className="flex items-center">
                            <span
                                className={`px-5 text-[3.4rem] font-bold uppercase tracking-tight sm:text-[5rem] ${
                                    outline ? 'text-transparent' : 'text-[#190D2E]'
                                }`}
                                style={
                                    outline
                                        ? { WebkitTextStroke: '1.5px rgba(124,58,237,0.5)' }
                                        : undefined
                                }
                            >
                                {w}
                            </span>
                            <span className="h-3 w-3 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#DA7756]" />
                        </span>
                    )),
                )}
            </motion.div>
        </div>
    );
}

/** Big dual-line marquee that speeds up & skews with scroll velocity. */
export default function VelocityMarquee() {
    return (
        <section className="relative overflow-hidden border-y border-[#F0DFD4] bg-white/60 py-8 backdrop-blur-sm sm:py-10">
            <Line baseVelocity={-1.6} />
            <div className="h-3 sm:h-4" />
            <Line baseVelocity={1.3} outline />
        </section>
    );
}
