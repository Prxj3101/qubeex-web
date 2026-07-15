'use client';

import { animate, motion, useInView, type Variants } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const DISPLAY = { fontFamily: 'var(--font-display), ui-sans-serif, system-ui' } as const;

export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

/** Fades + slides children in when scrolled into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: EASE, delay }}
        >
            {children}
        </motion.div>
    );
}

/** Word-by-word clip reveal for big display headlines. */
export function SplitWords({
    text, className, delay = 0, once = true,
}: { text: string; className?: string; delay?: number; once?: boolean }) {
    const words = text.split(' ');
    return (
        <span className={className} aria-label={text}>
            {words.map((w, i) => (
                <span key={i} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
                    <motion.span
                        className="inline-block will-change-transform"
                        initial={{ y: '110%', rotate: 4 }}
                        whileInView={{ y: '0%', rotate: 0 }}
                        viewport={{ once, margin: '-60px' }}
                        transition={{ duration: 0.8, ease: EASE, delay: delay + i * 0.055 }}
                    >
                        {w}
                    </motion.span>
                    {i < words.length - 1 ? ' ' : ''}
                </span>
            ))}
        </span>
    );
}

/** Animated number counter — counts up when in view. */
export function Counter({ to, suffix = '', className }: { to: number; suffix?: string; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: '-40px' });
    const [val, setVal] = useState(0);

    useEffect(() => {
        if (!inView) return;
        const controls = animate(0, to, {
            duration: 1.8,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (v) => setVal(Math.round(v)),
        });
        return () => controls.stop();
    }, [inView, to]);

    return (
        <span ref={ref} className={className}>
            {val.toLocaleString('en-IN')}{suffix}
        </span>
    );
}

/** Section heading block — eyebrow + display title + optional sub. */
export function SectionHead({ eyebrow, title, sub, light }: { eyebrow: string; title: string; sub?: string; light?: boolean }) {
    return (
        <Reveal className="mx-auto max-w-3xl text-center">
            <span
                className={`inline-block rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] ${
                    light ? 'border-white/25 bg-white/10 text-white/90' : 'border-[#F0DFD4] bg-white/80 text-[#DA7756]'
                }`}
            >
                {eyebrow}
            </span>
            <h2
                style={DISPLAY}
                className={`mt-6 text-balance text-4xl font-bold tracking-tight sm:text-[3.4rem] sm:leading-[1.05] ${
                    light ? 'text-white' : 'text-[#190D2E]'
                }`}
            >
                {title}
            </h2>
            {sub && (
                <p className={`mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg ${light ? 'text-white/65' : 'text-[#6B6480]'}`}>
                    {sub}
                </p>
            )}
        </Reveal>
    );
}
