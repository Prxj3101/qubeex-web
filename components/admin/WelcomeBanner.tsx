'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    X, CheckCircle2, Circle, Building2, Users, GraduationCap,
    Bell, ChevronRight, Zap, ArrowRight, ChevronDown, ChevronUp,
    User, BookMarked, ClipboardList, FileText, BarChart2, Flag,
    Wallet, Trophy, ShieldCheck, Cpu, Sparkles, Upload, FlaskConical,
} from 'lucide-react';
import type { InstitutionType } from '@/types';

interface WelcomeBannerProps {
    adminName: string;
    institutionName: string;
    institutionType: InstitutionType;
    plan: 'BASIC' | 'PRO' | 'TRIAL';
}

// ── All features ──────────────────────────────────────────────────────────────
const ALL_FEATURES: {
    key: string; label: string; icon: React.ElementType;
    inBasic: boolean; inPro: boolean; addOnBasic: boolean; addOnPro: boolean;
}[] = [
        { key: 'student_mgmt', label: 'Student Management', icon: Users, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'teacher_mgmt', label: 'Teacher Management', icon: User, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'course_mgmt', label: 'Course Management', icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'attendance', label: 'Attendance Tracking', icon: ClipboardList, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'tests', label: 'Tests & Questions', icon: FileText, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'results', label: 'Results & Marksheet', icon: BarChart2, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'calendar', label: 'Academic Calendar', icon: Bell, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'announcements', label: 'Announcements & Feed', icon: Bell, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'submissions', label: 'Submissions & Resources', icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'flags', label: 'Flags & Warnings', icon: Flag, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'fees', label: 'Fees Management', icon: Wallet, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'timetable_manual', label: 'Timetable (Manual)', icon: ClipboardList, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'student_app', label: "Student's App", icon: Upload, inBasic: true, inPro: false, addOnBasic: false, addOnPro: false },
        { key: 'student_app_pro', label: 'Student App + Parent', icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'leaderboard', label: 'Leaderboard System', icon: Trophy, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'whitelabeling', label: 'Whitelabelling', icon: ShieldCheck, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: 'timetable_auto', label: 'Timetable (Auto AI)', icon: Cpu, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
        { key: 'analytics', label: 'Performance Analytics', icon: BarChart2, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
        { key: 'smart_board', label: 'Smart Board with AI', icon: Sparkles, inBasic: true, inPro: true, addOnBasic: true, addOnPro: true },
    ];

const PLAN_GRADIENT = {
    PRO: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)',
    BASIC: 'linear-gradient(135deg, #9F67FF 0%, #7C3AED 40%, #5B21B6 100%)',
    TRIAL: 'linear-gradient(135deg, #FBB040 0%, #d97706 40%, #B45309 100%)',
} as const;

// ── Plan config ───────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
    PRO: {
        color: '#DA7756',
        colorBg: 'rgba(218,119,86,0.06)',
        colorBgStrong: 'rgba(218,119,86,0.14)',
        colorBorder: 'rgba(218,119,86,0.22)',
        label: 'Pro Plan',
        tagline: 'Full platform access',
        defaultFeatures: ALL_FEATURES.filter(f => f.inPro && !f.addOnPro),
        addonFeatures: ALL_FEATURES.filter(f => f.inPro && f.addOnPro),
        storage: { value: '1 TB', sub: '1,024 GB for media, docs & backups' },
        tokens: { value: '10M', sub: 'Powers Smart Board, Auto Timetable & AI' },
    },
    BASIC: {
        color: '#7C3AED',
        colorBg: 'rgba(124,58,237,0.05)',
        colorBgStrong: 'rgba(124,58,237,0.12)',
        colorBorder: 'rgba(124,58,237,0.18)',
        label: 'Basic Plan',
        tagline: 'Core features included',
        defaultFeatures: ALL_FEATURES.filter(f => f.inBasic && !f.addOnBasic),
        addonFeatures: ALL_FEATURES.filter(f => f.inBasic && f.addOnBasic),
        storage: { value: '500 GB', sub: '500 GB for media, docs & backups' },
        tokens: { value: '10M', sub: 'Powers Smart Board, Auto Timetable & AI' },
    },
    TRIAL: {
        color: '#d97706',
        colorBg: 'rgba(217,119,6,0.05)',
        colorBgStrong: 'rgba(217,119,6,0.12)',
        colorBorder: 'rgba(217,119,6,0.18)',
        label: 'Trial',
        tagline: 'Limited access — explore QubeEx',
        defaultFeatures: ALL_FEATURES.filter(f => f.inBasic && !f.addOnBasic).slice(0, 6),
        addonFeatures: [],
        storage: { value: '10 GB', sub: 'Limited trial storage' },
        tokens: { value: '100K', sub: 'Limited AI token access' },
    },
} as const;

// ── Setup steps ───────────────────────────────────────────────────────────────
const SETUP_STEPS_MAP: Record<InstitutionType, {
    id: string; icon: React.ElementType; title: string; desc: string; href: string;
}[]> = {
    SCHOOL: [
        { id: 'structure', icon: Building2, title: 'Set up structure', desc: 'Classes, subjects & sections', href: '/admin/campus' },
        { id: 'teachers', icon: User, title: 'Add teachers', desc: 'Invite & assign teachers', href: '/admin/staff/teachers' },
        { id: 'students', icon: GraduationCap, title: 'Enroll students', desc: 'Add students to classes', href: '/admin/staff/students' },
        { id: 'announcement', icon: Bell, title: 'First announcement', desc: 'Welcome your institution', href: '/admin/support/notifications' },
    ],
    COLLEGE: [
        { id: 'structure', icon: Building2, title: 'Set up departments', desc: 'Departments, courses & batches', href: '/admin/campus' },
        { id: 'teachers', icon: User, title: 'Add faculty', desc: 'Invite & assign faculty', href: '/admin/staff/teachers' },
        { id: 'students', icon: GraduationCap, title: 'Enroll students', desc: 'Add students to batches', href: '/admin/staff/students' },
        { id: 'announcement', icon: Bell, title: 'First announcement', desc: 'Welcome your college', href: '/admin/support/notifications' },
    ],
    COACHING: [
        { id: 'structure', icon: Building2, title: 'Set up batches', desc: 'Batches & subjects', href: '/admin/campus' },
        { id: 'teachers', icon: User, title: 'Add educators', desc: 'Invite & assign educators', href: '/admin/staff/teachers' },
        { id: 'students', icon: GraduationCap, title: 'Enroll students', desc: 'Add students to batches', href: '/admin/staff/students' },
        { id: 'announcement', icon: FlaskConical, title: 'First test', desc: 'Launch your first assessment', href: '/admin/support/notifications' },
    ],
};

const STEPS_KEY = 'qubeex_setup_steps_v2';
const DISMISS_KEY = 'qubeex_welcome_dismissed_v2';

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, color }: { pct: number; color: string }) {
    const r = 18; const circ = 2 * Math.PI * r;
    return (
        <svg width="46" height="46" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
            <circle cx="23" cy="23" r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={4} />
            <circle cx="23" cy="23" r={r} fill="none" stroke={color} strokeWidth={4}
                strokeDasharray={circ}
                strokeDashoffset={circ - (pct / 100) * circ}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
        </svg>
    );
}

// ── Feature Pill ──────────────────────────────────────────────────────────────
function FeaturePill({ icon: Icon, label, isAddon, color, colorBgStrong }: {
    icon: React.ElementType; label: string; isAddon?: boolean; color: string; colorBgStrong: string;
}) {
    return (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border/40 bg-background/60 dark:bg-white/[0.03]">
            <div className="w-[15px] h-[15px] rounded flex items-center justify-center shrink-0"
                style={{ background: colorBgStrong }}>
                <Icon size={9} style={{ color }} />
            </div>
            <span className="text-[11px] font-medium text-foreground leading-none truncate flex-1 min-w-0">
                {label}
            </span>
            {isAddon && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: colorBgStrong, color }}>
                    Add-on
                </span>
            )}
        </div>
    );
}

function StorageTokenRow({ plan, color, colorBg, colorBgStrong }: {
    plan: 'BASIC' | 'PRO' | 'TRIAL';
    color: string;
    colorBg: string;
    colorBgStrong: string;
}) {
    const cfg = PLAN_CONFIG[plan];

    // Arc path helper
    const arcPath = (pct: number) => {
        const r = 26;
        const cx = 34; const cy = 34;
        const circ = 2 * Math.PI * r;
        const offset = circ - (pct / 100) * circ;
        return { circ, offset };
    };

    const storagePct = plan === 'PRO' ? 100 : plan === 'BASIC' ? 75 : 15;
    const { circ, offset } = arcPath(storagePct);

    // Token dots — 30 total
    const totalDots = 30;
    const activeDots = plan === 'TRIAL' ? 3 : 25;

    return (
        <div className="grid grid-cols-2 gap-2.5 mt-3">

            {/* Storage */}
            <div className="rounded-xl border border-border/40 bg-background/50 dark:bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: colorBgStrong }}>
                        🗄️
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-foreground leading-none">Storage</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Included in plan</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Arc */}
                    <svg width="56" height="56" viewBox="0 0 68 68" className="shrink-0">
                        <circle cx="34" cy="34" r="26" fill="none"
                            stroke={colorBgStrong} strokeWidth="6" />
                        <circle cx="34" cy="34" r="26" fill="none"
                            stroke={color} strokeWidth="6"
                            strokeDasharray={circ}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            transform="rotate(-90 34 34)"
                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                        <text x="34" y="31" textAnchor="middle" fontSize="15" fontWeight="700"
                            fill="currentColor" className="fill-foreground">
                            {plan === 'PRO' ? '1' : plan === 'BASIC' ? '500' : '10'}
                        </text>
                        <text x="34" y="42" textAnchor="middle" fontSize="10"
                            fill="currentColor" className="fill-muted-foreground">
                            {plan === 'PRO' ? 'TB' : 'GB'}
                        </text>
                    </svg>

                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground leading-tight">{cfg.storage.sub}</p>
                    </div>
                </div>
            </div>

            {/* AI Tokens */}
            <div className="rounded-xl border border-border/40 bg-background/50 dark:bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: colorBgStrong }}>
                        ✨
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-foreground leading-none">AI Tokens</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Monthly allocation</p>
                    </div>
                </div>

                {/* Dot grid */}
                <div className="flex flex-wrap gap-[3px] mb-2">
                    {Array.from({ length: totalDots }).map((_, i) => (
                        <div
                            key={i}
                            className="w-[7px] h-[7px] rounded-[2px]"
                            style={{
                                background: i < activeDots ? color : colorBgStrong,
                                border: `1px solid ${i < activeDots ? color : 'transparent'}`,
                                opacity: i < activeDots ? 1 : 0.4,
                            }}
                        />
                    ))}
                </div>

                <div>
                    <p className="text-base font-bold text-foreground leading-none">
                        {cfg.tokens.value}
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">/ mo</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{cfg.tokens.sub}</p>
                </div>
            </div>

        </div>
    );
}

<style>{`
    @keyframes pop {
        0%   { transform: scale(1) rotate(0deg); }
        25%  { transform: scale(1.4) rotate(-10deg); }
        50%  { transform: scale(1.2) rotate(8deg); }
        75%  { transform: scale(1.35) rotate(-5deg); }
        100% { transform: scale(1) rotate(0deg); }
    }
    @keyframes sparkle {
        0%, 100% { opacity: 0; transform: scale(0) translate(0, 0); }
        50%       { opacity: 1; transform: scale(1) translate(var(--tx), var(--ty)); }
    }
    .emoji-pop {
        display: inline-block;
        animation: pop 0.6s ease-out 0.3s both;
        cursor: default;
        position: relative;
    }
    .emoji-pop:hover {
        animation: pop 0.5s ease-out both;
    }
    .sparkle-wrap {
        position: relative;
        display: inline-block;
    }
    .sparkle-wrap::before,
    .sparkle-wrap::after {
        content: '✦';
        position: absolute;
        font-size: 8px;
        color: #DA7756;
        animation: sparkle 1.2s ease-in-out 0.5s both;
        pointer-events: none;
    }
    .sparkle-wrap::before {
        top: -6px; left: -4px;
        --tx: -6px; --ty: -8px;
    }
    .sparkle-wrap::after {
        top: -4px; right: -6px;
        --tx: 6px; --ty: -6px;
        animation-delay: 0.7s;
    }
`}</style>


// ── Main Component ────────────────────────────────────────────────────────────
export function WelcomeBanner({ adminName, institutionName, institutionType, plan }: WelcomeBannerProps) {
    const router = useRouter();
    const [visible, setVisible] = useState(() => {
        if (typeof window === 'undefined') return true;
        return !localStorage.getItem(DISMISS_KEY);
    });
    const [expanded, setExpanded] = useState(false);
    const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const saved = localStorage.getItem(STEPS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [showAll, setShowAll] = useState(false);

    const cfg = PLAN_CONFIG[plan];
    const steps = SETUP_STEPS_MAP[institutionType];
    const pct = steps.length > 0 ? Math.round((completedSteps.length / steps.length) * 100) : 0;

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, 'true');
        setVisible(false);
    };

    const toggleStep = (id: string) => {
        const updated = completedSteps.includes(id)
            ? completedSteps.filter(s => s !== id)
            : [...completedSteps, id];
        setCompletedSteps(updated);
        localStorage.setItem(STEPS_KEY, JSON.stringify(updated));
    };

    const visibleDefault = showAll ? cfg.defaultFeatures : cfg.defaultFeatures.slice(0, 8);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full rounded-2xl overflow-hidden relative"
                    style={{
                        border: `1px solid ${cfg.colorBorder}`,
                        background: cfg.colorBg,
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    {/* Gradient blobs */}
                    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                        <div className="absolute w-64 h-64 rounded-full -top-16 -right-10"
                            style={{ background: `radial-gradient(circle, ${cfg.colorBgStrong} 0%, transparent 70%)` }} />
                        <div className="absolute w-44 h-44 rounded-full -bottom-10 left-2"
                            style={{ background: `radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)` }} />
                        <div className="absolute w-32 h-32 rounded-full top-4 left-[38%]"
                            style={{ background: `radial-gradient(circle, ${cfg.colorBg} 0%, transparent 70%)` }} />
                    </div>

                    {/* Accent line */}
                    <div className="h-[2px] w-full relative z-10"
                        style={{ background: `linear-gradient(90deg, transparent, ${cfg.color} 25%, ${cfg.color}66 75%, transparent)` }} />

                    {/* ── Header ── */}
                    <div className="relative z-10 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
                        {/* Ring */}
                        <div className="relative w-[46px] h-[46px] shrink-0">
                            <ProgressRing pct={pct} color={cfg.color} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                                    {completedSteps.length}/{steps.length}
                                </span>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold tracking-widest text-muted-foreground/60 mb-0.5">
                                    Welcome to QubeEx{' '}
                                    <motion.span
                                        initial={{ scale: 0, rotate: -15 }}
                                        animate={{ scale: [0, 1.4, 0.9, 1.2, 1], rotate: [-15, 10, -8, 5, 0] }}
                                        transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
                                        style={{ display: 'inline-block', transformOrigin: 'center', fontSize: '18px' }}
                                        whileHover={{ scale: [1, 1.4, 0.9, 1.2, 1], rotate: [0, 10, -8, 5, 0], transition: { duration: 0.5 } }}
                                    >
                                        🎉
                                    </motion.span>
                                </p>
                                <p className="text-lg font-bold text-foreground leading-tight truncate" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    {institutionName}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                                        style={{ background: PLAN_GRADIENT[plan] }}
                                    >
                                        <Zap size={9} />
                                        {cfg.label}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">{cfg.tagline}</span>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-all text-muted-foreground hover:text-foreground"
                            >
                                {expanded ? <><ChevronUp size={11} /> Hide</> : <><ChevronDown size={11} /> Setup</>}
                            </button>
                            <button onClick={dismiss}
                                className="w-7 h-7 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                                <X size={12} />
                            </button>
                        </div>
                    </div>

                    {/* ── Expanded body ── */}
                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="overflow-hidden relative z-10"
                            >
                                <div className="h-px bg-border/30 mx-4" />
                                <div className="px-4 pb-4 pt-3">
                                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                                        {/* ── LEFT: Setup Steps — 2 cols ── */}
                                        <div className="lg:col-span-2">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                                                Getting started
                                            </p>
                                            <div className="space-y-1">
                                                {steps.map((step, i) => {
                                                    const done = completedSteps.includes(step.id);
                                                    const Icon = step.icon;
                                                    return (
                                                        <motion.div
                                                            key={step.id}
                                                            initial={{ opacity: 0, x: -6 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            onClick={() => toggleStep(step.id)}
                                                            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all duration-150 ${done
                                                                ? 'border-emerald-200/40 dark:border-emerald-800/25 bg-emerald-50/40 dark:bg-emerald-950/15 opacity-55'
                                                                : 'border-border/40 bg-background/50 dark:bg-white/[0.03] hover:bg-background/80 dark:hover:bg-white/[0.06] hover:border-border/70'
                                                                }`}
                                                        >
                                                            {done
                                                                ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                                                                : <Circle size={13} className="shrink-0 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                                                            }
                                                            <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
                                                                style={{ background: done ? 'rgba(16,185,129,0.12)' : cfg.colorBgStrong }}>
                                                                <Icon size={11} style={{ color: done ? '#10b981' : cfg.color }} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-[11px] font-semibold leading-tight ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                                    {step.title}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                                                            </div>
                                                            {!done && (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); router.push(step.href); }}
                                                                    className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                                                                >
                                                                    <ArrowRight size={10} />
                                                                </button>
                                                            )}
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* ── RIGHT: Plan — 3 cols ── */}
                                        <div className="lg:col-span-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                                    {cfg.label} includes
                                                </p>
                                                {plan !== 'PRO' && (
                                                    <button
                                                        onClick={() => router.push('/admin/insights/subscription')}
                                                        className="flex items-center gap-0.5 text-[10px] font-semibold hover:opacity-75 transition-opacity"
                                                        style={{ color: cfg.color }}
                                                    >
                                                        Upgrade to Pro <ChevronRight size={9} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="rounded-xl overflow-hidden"
                                                style={{ border: `1px solid ${cfg.colorBorder}`, background: cfg.colorBg }}>

                                                {/* Plan header */}
                                                <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2"
                                                    style={{ borderBottom: `1px solid ${cfg.colorBorder}` }}>
                                                    <div>
                                                        <p className="text-[12px] font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {cfg.defaultFeatures.length} features
                                                            {cfg.addonFeatures.length > 0 && ` + ${cfg.addonFeatures.length} add-on${cfg.addonFeatures.length > 1 ? 's' : ''}`}
                                                        </p>
                                                    </div>
                                                    <span className="text-[9px] font-bold px-2 py-1 rounded-full"
                                                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                        ✦ Year 1 — All free
                                                    </span>
                                                </div>

                                                <div className="px-3 py-2.5">
                                                    {/* Features — 3 col grid */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                                                        {visibleDefault.map(f => (
                                                            <FeaturePill key={f.key} icon={f.icon} label={f.label}
                                                                color={cfg.color} colorBgStrong={cfg.colorBgStrong} />
                                                        ))}
                                                    </div>

                                                    {/* Show more */}
                                                    {cfg.defaultFeatures.length > 9 && (
                                                        <button
                                                            onClick={() => setShowAll(v => !v)}
                                                            className="flex items-center gap-1 text-[10px] font-medium mb-2 transition-colors"
                                                            style={{ color: cfg.color }}
                                                        >
                                                            {showAll
                                                                ? <><ChevronUp size={10} /> Show less</>
                                                                : <><ChevronDown size={10} /> +{cfg.defaultFeatures.length - 9} more</>}
                                                        </button>
                                                    )}

                                                    {/* Add-ons */}
                                                    {cfg.addonFeatures.length > 0 && (
                                                        <>
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                                                                Add-ons (free Year 1)
                                                            </p>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                                                                {cfg.addonFeatures.map(f => (
                                                                    <FeaturePill key={f.key} icon={f.icon} label={f.label}
                                                                        isAddon color={cfg.color} colorBgStrong={cfg.colorBgStrong} />
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Storage + Tokens */}
                                                    <StorageTokenRow
                                                        plan={plan}
                                                        color={cfg.color}
                                                        colorBg={cfg.colorBg}
                                                        colorBgStrong={cfg.colorBgStrong}
                                                    />

                                                    {/* Upgrade CTA */}
                                                    {plan !== 'PRO' && (
                                                        <button
                                                            onClick={() => router.push('/admin/insights/subscription')}
                                                            className="w-full flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg mt-2 transition-opacity hover:opacity-80"
                                                            style={{ background: cfg.colorBgStrong, color: cfg.color }}
                                                        >
                                                            Upgrade to Pro <ChevronRight size={10} />
                                                        </button>
                                                    )}

                                                    {/* Dismiss */}
                                                    <button onClick={dismiss}
                                                        className="w-full py-1.5 rounded-lg border border-border/30 bg-background/30 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-background/60 transition-all mt-2">
                                                        Got it, dismiss
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
