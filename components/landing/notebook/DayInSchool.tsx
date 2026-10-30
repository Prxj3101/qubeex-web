'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import {
    CalendarCheck, ClipboardList, Moon, PenLine, Presentation, Smartphone, Sparkles, Sun, Wallet, type LucideIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { DISPLAY, EASE } from '../motion';
import { HAND, INK, TERRA } from './paper';

// "A day at school": a timeline from the first bell to bedtime. The line
// fills in as you scroll, with a sun that turns into a moon at the end.

type Slot = { time: string; icon: LucideIcon; title: string; line: string; color: string; soft: string };

const DAY: Slot[] = [
    { time: '8:00 am', icon: CalendarCheck, title: 'Attendance, in one tap', line: 'Teachers mark P, A, L in seconds. Long absences get flagged on their own.', color: '#0D9488', soft: '#E3F5F2' },
    { time: '9:30 am', icon: Presentation, title: 'Class time', line: 'Open the chapter on the AI blackboard and turn it into a mindmap, live.', color: '#16A34A', soft: '#E6F6EC' },
    { time: '11:00 am', icon: PenLine, title: 'Surprise test', line: 'AI writes a 20-mark paper from the chapter. Students take it online.', color: '#DB2777', soft: '#FCEAF3' },
    { time: '1:00 pm', icon: Wallet, title: 'Fee counter', line: 'Receipts in seconds, and reminders for what is still pending.', color: TERRA, soft: '#FBEDE6' },
    { time: '3:00 pm', icon: ClipboardList, title: 'Admissions desk', line: 'New enquiries from your online form land on one board.', color: '#2563EB', soft: '#E8F0FE' },
    { time: '5:00 pm', icon: Sparkles, title: 'Principal’s round-up', line: 'Ask Jarvis how the day went. Attendance, fees and tests in one answer.', color: '#E11D48', soft: '#FDE8EC' },
    { time: '8:00 pm', icon: Smartphone, title: 'At home', line: 'Parents see homework, results and fees in the app.', color: '#7C3AED', soft: '#F0EAFD' },
];

function Card({ s, i }: { s: Slot; i: number }) {
    return (
        <div
            className="relative rounded-2xl border-2 bg-white p-4 shadow-[4px_5px_0_rgba(38,41,74,0.85)] sm:p-5"
            style={{ borderColor: INK, rotate: `${i % 2 ? 1 : -1}deg` }}
        >
            <span aria-hidden className="absolute -top-2.5 left-1/2 h-4 w-14 -translate-x-1/2 rotate-[-3deg] opacity-80" style={{ background: s.soft }} />
            <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: s.soft, color: s.color }}>
                    <s.icon size={19} />
                </span>
                <h3 style={DISPLAY} className="text-lg font-bold leading-tight text-[#190D2E] sm:text-xl">{s.title}</h3>
            </div>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#575C7A]">{s.line}</p>
        </div>
    );
}

export default function DayInSchool() {
    const still = useReducedMotion();
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.6', 'end 0.6'] });
    const prog = useSpring(scrollYProgress, { stiffness: 120, damping: 25 });
    const fill = useTransform(prog, [0, 1], [0, 1]);
    const top = useTransform(prog, [0, 1], ['0%', '100%']);
    const sunO = useTransform(prog, [0.7, 0.85], [1, 0]);
    const moonO = useTransform(prog, [0.7, 0.85], [0, 1]);
    const spin = useTransform(prog, [0, 1], [0, 220]);

    return (
        <section className="relative overflow-x-clip">
            <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10 lg:py-28">
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">a day at school,</p>
                    <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                        From the first bell <span style={{ color: TERRA }}>to bedtime.</span>
                    </h2>
                    <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-[#575C7A] sm:text-xl">
                        This is what a normal day looks like with QubeEx. Less running around, more teaching.
                    </p>
                </motion.div>

                <div ref={ref} className="relative mt-16">
                    {/* the line: dashed pencil + a filled crayon line that follows the scroll */}
                    <div aria-hidden className="absolute bottom-0 left-[22px] top-0 w-0 border-l-2 border-dashed border-[#C9BFAE] md:left-1/2" />
                    <motion.div
                        aria-hidden
                        className="absolute left-[21px] top-0 h-full w-[4px] origin-top rounded-full md:left-[calc(50%-1px)]"
                        style={{ background: `linear-gradient(${TERRA}, #F6C453, #7C3AED)`, scaleY: still ? 1 : fill }}
                    />
                    {/* sun that becomes a moon */}
                    {!still && (
                        <motion.div aria-hidden className="absolute left-[23px] z-10 -translate-x-1/2 -translate-y-1/2 md:left-1/2" style={{ top }}>
                            <div className="relative grid h-11 w-11 place-items-center rounded-full border-2 bg-white shadow-md" style={{ borderColor: INK }}>
                                <motion.span className="absolute text-[#F2B84B]" style={{ opacity: sunO, rotate: spin }}><Sun size={22} /></motion.span>
                                <motion.span className="absolute text-[#5B5F9A]" style={{ opacity: moonO }}><Moon size={20} /></motion.span>
                            </div>
                        </motion.div>
                    )}

                    <ol className="space-y-10 md:space-y-4">
                        {DAY.map((s, i) => {
                            const right = i % 2 === 1;
                            return (
                                <li key={s.time} className="relative grid grid-cols-[44px_1fr] items-center gap-4 md:grid-cols-[1fr_64px_1fr] md:gap-8">
                                    {/* desktop: time on one side, card on the other */}
                                    <div className={`hidden md:block ${right ? 'md:order-1 text-right' : 'md:order-3'}`}>
                                        <motion.p
                                            style={HAND}
                                            className="text-4xl text-[#8A6A5A]"
                                            initial={still ? false : { opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true, margin: '-80px' }}
                                            transition={{ duration: 0.5 }}
                                        >
                                            {s.time}
                                        </motion.p>
                                    </div>
                                    <div className="relative z-[1] grid place-items-center md:order-2">
                                        <span className="h-4 w-4 rounded-full border-2 bg-white" style={{ borderColor: s.color }} />
                                    </div>
                                    <motion.div
                                        className={right ? 'md:order-3' : 'md:order-1'}
                                        initial={still ? false : { opacity: 0, x: right ? 40 : -40, rotate: right ? 3 : -3 }}
                                        whileInView={{ opacity: 1, x: 0, rotate: 0 }}
                                        viewport={{ once: true, margin: '-80px' }}
                                        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                                    >
                                        <p style={HAND} className="mb-1 text-2xl text-[#8A6A5A] md:hidden">{s.time}</p>
                                        <Card s={s} i={i} />
                                    </motion.div>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </div>
        </section>
    );
}
