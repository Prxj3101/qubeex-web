'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useRef } from 'react';
import {
    Brain, CalendarCheck, Wallet, BarChart3, Presentation,
    Sparkles, ShieldCheck, FileSpreadsheet, Bell, type LucideIcon,
} from 'lucide-react';
import { AUDIENCES } from './landing-data';
import { Reveal, SectionHead, EASE, DISPLAY } from './motion';

interface StackFeature {
    icon: LucideIcon;
    no: string;
    title: string;
    desc: string;
    chips: { icon: LucideIcon; label: string }[];
    bg: string;        // card gradient
    accent: string;
    text: string;      // main text color
    sub: string;       // secondary text color
    chipBg: string;
}

const STACK: StackFeature[] = [
    {
        icon: Brain, no: '01',
        title: 'AI Tests, generated in minutes',
        desc: 'Pick a chapter or upload a PDF, choose the question count and difficulty, and QubeEx builds the test for you - ready to assign or use live on the AI Blackboard.',
        chips: [
            { icon: Brain, label: 'AI-generated questions' },
            { icon: Sparkles, label: 'Difficulty levels' },
            { icon: FileSpreadsheet, label: 'PDF-aware' },
        ],
        bg: 'linear-gradient(135deg, #2A1454 0%, #4C1D95 55%, #6D28D9 100%)',
        accent: '#C4B5FD', text: '#FFFFFF', sub: 'rgba(255,255,255,0.72)', chipBg: 'rgba(255,255,255,0.12)',
    },
    {
        icon: Presentation, no: '02',
        title: 'AI Blackboard that teaches with you',
        desc: 'AI Blackboard puts live teaching material on the class display with an AI assist panel beside it - explanations, questions and full tests generated on demand. Free addon for the first year, on every plan.',
        chips: [
            { icon: Presentation, label: 'Live teaching material' },
            { icon: Sparkles, label: 'AI assist panel' },
            { icon: Brain, label: 'Question & test gen' },
        ],
        bg: 'linear-gradient(135deg, #FFFFFF 0%, #FCE7F3 100%)',
        accent: '#DB2777', text: '#2D0B1E', sub: '#8A5A74', chipBg: 'rgba(219,39,119,0.08)',
    },
    {
        icon: CalendarCheck, no: '03',
        title: 'Attendance in two minutes flat',
        desc: 'Mark a whole class in seconds. Holidays, short-attendance alerts, month-wise trends and one-click exports - the register, retired for good.',
        chips: [
            { icon: CalendarCheck, label: 'Daily & overall' },
            { icon: Bell, label: 'Short-attendance alerts' },
            { icon: FileSpreadsheet, label: 'XLSX export' },
        ],
        bg: 'linear-gradient(135deg, #FFFFFF 0%, #F3EDFD 100%)',
        accent: '#7C3AED', text: '#190D2E', sub: '#6B6480', chipBg: 'rgba(124,58,237,0.08)',
    },
    {
        icon: Wallet, no: '04',
        title: 'Fees everyone can finally follow',
        desc: 'Payment schedules, breakdowns and rules - visible to admins, teachers and parents alike. No more spreadsheet archaeology at the end of the term.',
        chips: [
            { icon: Wallet, label: 'Schedules & breakdowns' },
            { icon: Bell, label: 'Due reminders' },
            { icon: ShieldCheck, label: 'Rule engine' },
        ],
        bg: 'linear-gradient(135deg, #FDF3EE 0%, #F9DFD3 100%)',
        accent: '#C2410C', text: '#2D1408', sub: '#8A6A5A', chipBg: 'rgba(194,65,12,0.08)',
    },
    {
        icon: BarChart3, no: '05',
        title: 'Analytics with an audit trail',
        desc: 'Enrollment growth, usage and performance - live for every level of the institution. And every action logged, so compliance reviews take minutes, not days.',
        chips: [
            { icon: BarChart3, label: 'Live dashboards' },
            { icon: ShieldCheck, label: 'Full audit logs' },
            { icon: FileSpreadsheet, label: 'Reports' },
        ],
        bg: 'linear-gradient(135deg, #190D2E 0%, #2B1B47 60%, #1E2A4A 100%)',
        accent: '#93C5FD', text: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', chipBg: 'rgba(255,255,255,0.1)',
    },
];

function Card({ f, i, progress, total }: { f: StackFeature; i: number; progress: MotionValue<number>; total: number }) {
    const start = i / total;
    const scale = useTransform(progress, [start, 1], [1, 1 - (total - i) * 0.045]);
    const isDark = f.text === '#FFFFFF';

    return (
        <div className="sticky" style={{ top: `calc(88px + ${i * 22}px)` }}>
            <motion.div
                style={{ scale, background: f.bg }}
                className="mx-auto min-h-[68vh] w-full max-w-6xl origin-top overflow-hidden rounded-[2.5rem] p-8 shadow-[0_40px_80px_-40px_rgba(25,13,46,0.45)] sm:p-14"
            >
                <div className="flex h-full flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
                    <div className="flex-1">
                        <div className="flex items-center gap-4">
                            <span
                                className="grid h-12 w-12 place-items-center rounded-2xl"
                                style={{ background: f.chipBg, color: f.accent }}
                            >
                                <f.icon size={22} />
                            </span>
                            <span style={{ ...DISPLAY, color: f.accent }} className="text-sm font-bold tracking-[0.3em]">
                                {f.no} / 0{total}
                            </span>
                        </div>
                        <h3
                            style={{ ...DISPLAY, color: f.text }}
                            className="mt-7 max-w-xl text-balance text-3xl font-bold leading-[1.05] tracking-tight sm:text-[2.9rem]"
                        >
                            {f.title}
                        </h3>
                        <p style={{ color: f.sub }} className="mt-5 max-w-lg text-base leading-relaxed sm:text-lg">
                            {f.desc}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-2.5">
                            {f.chips.map((c) => (
                                <span
                                    key={c.label}
                                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold backdrop-blur"
                                    style={{ background: f.chipBg, color: isDark ? f.text : f.accent }}
                                >
                                    <c.icon size={13} />
                                    {c.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* abstract visual */}
                    <div className="hidden w-[38%] shrink-0 lg:block">
                        <div
                            className="rounded-3xl border p-5 backdrop-blur"
                            style={{
                                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
                                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(124,58,237,0.12)',
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="h-2.5 w-24 rounded-full" style={{ background: f.chipBg }} />
                                <div className="h-6 w-6 rounded-lg" style={{ background: f.chipBg }} />
                            </div>
                            <div className="mt-4 flex items-end gap-2" style={{ height: 120 }}>
                                {[38, 62, 48, 76, 58, 88, 70, 95].map((h, k) => (
                                    <motion.div
                                        key={k}
                                        className="flex-1 rounded-t-lg"
                                        style={{ background: k === 7 ? f.accent : f.chipBg }}
                                        initial={{ height: 0 }}
                                        whileInView={{ height: `${h}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.9, ease: EASE, delay: k * 0.06 }}
                                    />
                                ))}
                            </div>
                            <div className="mt-4 space-y-2.5">
                                {[80, 55, 68].map((w, k) => (
                                    <div key={k} className="h-2 rounded-full" style={{ width: `${w}%`, background: f.chipBg }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default function Features() {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

    return (
        <section id="features" className="relative scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
            <SectionHead
                eyebrow="The Platform"
                title="Built to replace the registers, spreadsheets and group chats"
                sub="Four pillars. One calm system. Scroll through what your campus gets."
            />

            <div ref={ref} className="relative mt-16">
                {STACK.map((f, i) => (
                    <div key={f.no} className="pb-8" style={{ height: i === STACK.length - 1 ? 'auto' : undefined }}>
                        <Card f={f} i={i} progress={scrollYProgress} total={STACK.length} />
                    </div>
                ))}
            </div>

            {/* audiences */}
            <Reveal className="mx-auto mt-24 max-w-6xl">
                <div className="grid gap-4 sm:grid-cols-3">
                    {AUDIENCES.map((a) => {
                        // Schools get the violet "live" treatment; Colleges get
                        // the same touch but in the College theme's blue instead
                        // — both are real, styled institution types, not just a
                        // generic "coming soon" placeholder.
                        const isCollege = a.title === 'Colleges';
                        return (
                            <div
                                key={a.title}
                                className={`relative flex items-start gap-4 rounded-3xl border p-6 transition-transform hover:-translate-y-1 ${
                                    a.live
                                        ? 'border-[#D9C9F8] bg-gradient-to-br from-white to-[#F1E9FE] shadow-[0_16px_40px_-24px_rgba(124,58,237,0.4)]'
                                        : isCollege
                                            ? 'border-[#C6DCFB] bg-gradient-to-br from-white to-[#E9F1FE] shadow-[0_16px_40px_-24px_rgba(37,99,235,0.35)]'
                                            : 'border-[#ECE6F8] bg-white/60'
                                }`}
                            >
                                <span
                                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                                        a.live
                                            ? 'bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white'
                                            : isCollege
                                                ? 'bg-gradient-to-br from-[#2563EB] to-[#60A5FA] text-white'
                                                : 'bg-[#F1EBFD] text-[#7C3AED]'
                                    }`}
                                >
                                    <a.icon size={20} />
                                </span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 style={DISPLAY} className="font-bold text-[#190D2E]">{a.title}</h4>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                a.live
                                                    ? 'bg-[#D1FAE5] text-[#047857]'
                                                    : 'bg-[#FDF3E3] text-[#B45309]'
                                            }`}
                                        >
                                            {a.live ? 'Live' : 'In development'}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-[#6B6480]">{a.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Reveal>
        </section>
    );
}
