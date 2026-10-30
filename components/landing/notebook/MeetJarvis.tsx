'use client';

import { motion } from 'framer-motion';
import { DISPLAY, EASE } from '../motion';
import JarvisChat from './JarvisChat';
import { HAND, TERRA } from './paper';

// "Meet Jarvis": short intro on the left, the live chat card on the right.
export default function MeetJarvis() {
    return (
        <section id="jarvis" className="relative scroll-mt-6 overflow-x-clip">
            <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-[72px] sm:px-10 lg:grid-cols-[1fr_400px] lg:gap-20 lg:py-24">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">meet Jarvis,</p>
                    <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                        Your school&apos;s <span style={{ color: TERRA }}>AI assistant.</span>
                    </h2>
                    <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-[#575C7A] sm:text-xl">
                        Ask anything in plain words, or tell it what to schedule. Meetings, reminders,
                        timetables and tests, Jarvis gets it done in seconds.
                    </p>
                </motion.div>
                <motion.div
                    className="mx-auto w-full max-w-[400px]"
                    initial={{ opacity: 0, y: 30, rotate: 4 }}
                    whileInView={{ opacity: 1, y: 0, rotate: -1.5 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ type: 'spring', stiffness: 140, damping: 16 }}
                >
                    <JarvisChat />
                </motion.div>
            </div>
        </section>
    );
}
