'use client';

import { motion } from 'framer-motion';
import { TESTIMONIALS } from './landing-data';
import { SectionHead } from './motion';

const AVATAR_BG = ['#7C3AED', '#DA7756', '#0D9488', '#2563EB', '#DB2777', '#D97706'];
const initials = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2);

function Card({ t, i }: { t: (typeof TESTIMONIALS)[number]; i: number }) {
    return (
        <figure
            className="w-[340px] shrink-0 rounded-3xl border border-[#ECE6F8] bg-white p-6 shadow-[0_12px_32px_-20px_rgba(124,58,237,0.25)] transition-transform hover:-translate-y-1"
            style={{ rotate: i % 2 ? '0.6deg' : '-0.6deg' }}
        >
            <blockquote className="text-sm leading-relaxed text-[#3D3552]">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
                <span
                    className="grid h-10 w-10 place-items-center rounded-full text-xs font-bold text-white"
                    style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}
                >
                    {initials(t.name)}
                </span>
                <div>
                    <p className="text-sm font-bold text-[#1D1433]">{t.name}</p>
                    <p className="text-xs text-[#9A93AC]">{t.role}</p>
                </div>
            </figcaption>
        </figure>
    );
}

function Row({ items, reverse, duration }: { items: typeof TESTIMONIALS; reverse?: boolean; duration: number }) {
    return (
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <motion.div
                className="flex w-max gap-5 py-2"
                animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
                transition={{ duration, repeat: Infinity, ease: 'linear' }}
            >
                {[...items, ...items].map((t, i) => (
                    <Card key={i} t={t} i={i % items.length} />
                ))}
            </motion.div>
        </div>
    );
}

export default function Testimonials() {
    const top = TESTIMONIALS.slice(0, 3);
    const bottom = TESTIMONIALS.slice(3);

    return (
        <section className="relative overflow-hidden py-24 sm:py-32">
            <div className="mx-auto max-w-6xl px-6">
                <SectionHead
                    eyebrow="Loved by educators"
                    title="Calm software, happy staffrooms"
                    sub="What teachers and administrators say after switching to QubeEx."
                />
            </div>
            <div className="mt-14 space-y-5">
                <Row items={top} duration={36} />
                <Row items={bottom} reverse duration={42} />
            </div>
        </section>
    );
}
