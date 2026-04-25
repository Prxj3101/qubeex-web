'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    X, CheckCircle2, Circle, Building2, Users,
    GraduationCap, Bell, Sparkles, ChevronRight,
    Zap, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';

interface WelcomeBannerProps {
    adminName: string;
    institutionName: string;
    institutionType: 'SCHOOL' | 'COLLEGE' | 'COACHING';
    plan: 'BASIC' | 'PRO' | 'TRIAL';
}

const SETUP_STEPS = [
    {
        id: 'structure',
        icon: Building2,
        title: 'Set up structure',
        desc: 'Classes, subjects & sections',
        href: '/admin/structure',
        bg: 'bg-violet-100 dark:bg-violet-950/50',
        iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
        id: 'teachers',
        icon: Users,
        title: 'Add teachers',
        desc: 'Invite & assign teachers',
        href: '/admin/people/teachers',
        bg: 'bg-amber-100 dark:bg-amber-950/50',
        iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
        id: 'students',
        icon: GraduationCap,
        title: 'Enroll students',
        desc: 'Add students to classes',
        href: '/admin/people/students',
        bg: 'bg-emerald-100 dark:bg-emerald-950/50',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
        id: 'announcement',
        icon: Bell,
        title: 'First announcement',
        desc: 'Welcome your institution',
        href: '/admin/support/notifications',
        bg: 'bg-orange-100 dark:bg-orange-950/50',
        iconColor: 'text-orange-600 dark:text-orange-400',
    },
];

const PLAN_COLOR: Record<string, string> = {
    PRO: '#DA7756',
    BASIC: '#7C3AED',
    TRIAL: '#f59e0b',
};

const STORAGE_KEY = 'qubeex_welcome_dismissed';
const STEPS_KEY = 'qubeex_setup_steps';

export function WelcomeBanner({ adminName, institutionName, institutionType, plan }: WelcomeBannerProps) {
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);

    useEffect(() => {
        // const dismissed = localStorage.getItem(STORAGE_KEY);
        // if (!dismissed) setVisible(true);
        setVisible(true); // ← har baar dikhega
        const saved = localStorage.getItem(STEPS_KEY);
        if (saved) setCompletedSteps(JSON.parse(saved));
    }, []);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setVisible(false);
    };

    const toggleStep = (id: string) => {
        const updated = completedSteps.includes(id)
            ? completedSteps.filter(s => s !== id)
            : [...completedSteps, id];
        setCompletedSteps(updated);
        localStorage.setItem(STEPS_KEY, JSON.stringify(updated));
    };

    const progress = Math.round((completedSteps.length / SETUP_STEPS.length) * 100);
    const planColor = PLAN_COLOR[plan] ?? '#7C3AED';

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden w-full"
                    style={{ marginTop: '-12px', marginLeft: '-8px', marginRight: '-8px', width: 'calc(100% + 16px)' }}
                >
                    <div className="border-b border-border/60"
                        style={{ background: `linear-gradient(135deg, ${planColor}10 0%, ${planColor}05 100%)` }}>

                        {/* Top color line */}
                        <div className="h-[2px]"
                            style={{ background: `linear-gradient(90deg, transparent 0%, ${planColor} 30%, ${planColor}99 70%, transparent 100%)` }} />

                        {/* Collapsed strip — always visible */}
                        <div className="flex items-center gap-3 px-4 py-2.5">
                            {/* Icon */}
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: `${planColor}20` }}>
                                <Sparkles size={13} style={{ color: planColor }} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                <p className="text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Welcome to QubeEx, {adminName}! 🎉
                                </p>
                                <span className="text-xs text-muted-foreground hidden sm:block truncate">
                                    {institutionName} · {plan} Plan
                                </span>
                            </div>

                            {/* Progress pill */}
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="hidden sm:flex items-center gap-1.5">
                                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{ background: planColor }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {completedSteps.length}/{SETUP_STEPS.length}
                                    </span>
                                </div>

                                {/* Expand toggle */}
                                <button
                                    onClick={() => setExpanded(v => !v)}
                                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-border/60 hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
                                >
                                    {expanded ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Setup</>}
                                </button>

                                {/* Dismiss */}
                                <button
                                    onClick={dismiss}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        </div>

                        {/* Expanded content */}
                        <AnimatePresence>
                            {expanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4 pt-1">
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                                            {/* Steps */}
                                            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {SETUP_STEPS.map((step, i) => {
                                                    const done = completedSteps.includes(step.id);
                                                    return (
                                                        <motion.div
                                                            key={step.id}
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.06 }}
                                                            onClick={() => toggleStep(step.id)}
                                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer group ${done
                                                                ? 'border-border/30 bg-muted/20 opacity-50'
                                                                : 'border-border/50 bg-background/60 hover:border-primary/30 hover:bg-primary/5'
                                                                }`}
                                                        >
                                                            {done
                                                                ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                                : <Circle size={16} className="text-muted-foreground/40 group-hover:text-primary/50 transition-colors shrink-0" />
                                                            }
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${step.bg}`}>
                                                                <step.icon size={13} className={step.iconColor} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-xs font-semibold leading-tight ${done ? 'line-through text-muted-foreground' : ''}`}>
                                                                    {step.title}
                                                                </p>
                                                                <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                                                            </div>
                                                            {!done && (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); router.push(step.href); }}
                                                                    className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                                                >
                                                                    <ArrowRight size={11} />
                                                                </button>
                                                            )}
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>

                                            {/* Plan + tip */}
                                            <div className="flex flex-col gap-2">
                                                {/* Plan */}
                                                <div className="rounded-xl border border-border/50 overflow-hidden">
                                                    <div className="px-3 py-2 flex items-center justify-between"
                                                        style={{ background: `${planColor}12`, borderBottom: `1px solid ${planColor}25` }}>
                                                        <div className="flex items-center gap-1.5">
                                                            <Zap size={12} style={{ color: planColor }} />
                                                            <span className="text-xs font-bold" style={{ color: planColor }}>{plan} Plan</span>
                                                        </div>
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                                            style={{ background: `${planColor}20`, color: planColor }}>
                                                            Active
                                                        </span>
                                                    </div>
                                                    <div className="px-3 py-2">
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                            {plan === 'PRO'
                                                                ? 'Full access to all features including AI tools, whitelabeling & unlimited users.'
                                                                : plan === 'TRIAL'
                                                                    ? 'Trial mode — limited access. Contact your QubeEx rep to upgrade.'
                                                                    : 'Standard access with core features. Upgrade to Pro for advanced tools.'
                                                            }
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Tip */}
                                                <div className="rounded-xl bg-muted/40 border border-border/40 px-3 py-2.5 flex-1">
                                                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">💡 Start here</p>
                                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                        Set up your structure first — everything else depends on it.
                                                    </p>
                                                    <button
                                                        onClick={() => router.push('/admin/structure')}
                                                        className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 transition-opacity"
                                                        style={{ color: planColor }}
                                                    >
                                                        Go to Structure <ChevronRight size={11} />
                                                    </button>
                                                </div>

                                                {/* Dismiss full */}
                                                <button
                                                    onClick={dismiss}
                                                    className="w-full py-1.5 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                                >
                                                    Got it, dismiss
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}