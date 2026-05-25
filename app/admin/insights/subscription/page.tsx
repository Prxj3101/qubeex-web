'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Crown, CreditCard, Shield, CheckCircle2, XCircle,
    AlertTriangle, Download, ArrowUpRight, ChevronRight,
    Receipt, Zap, Database, TicketIcon, Plus, Users,
    User,
    BookMarked,
    ClipboardList,
    FileText,
    BarChart2,
    Calendar as CalendarIcon,
    Bell,
    Flag,
    Wallet,
    ShieldCheck,
    Cpu,
    Sparkles,
} from 'lucide-react';

export const ALL_FEATURES: {
    key: string;
    label: string;
    desc: string;
    icon: React.ElementType;
    inBasic: boolean;
    inPro: boolean;
    addOnBasic: boolean;
    addOnPro: boolean;
}[] = [
        { key: "student_mgmt", label: "Student Management", desc: "Enroll & manage students", icon: Users, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "teacher_mgmt", label: "Teacher Management", desc: "Add & assign teachers", icon: User, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "course_mgmt", label: "Course Management", desc: "Manage subjects & courses", icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "attendance", label: "Attendance Tracking", desc: "Student attendance management", icon: ClipboardList, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "tests", label: "Question & Test Generation", desc: "Create & conduct assessments", icon: FileText, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "results", label: "Results & Marksheet", desc: "Generate result reports", icon: BarChart2, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "calendar", label: "Academic Calendar", desc: "Schedule academic events", icon: CalendarIcon, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "announcements", label: "Announcements & Feed", desc: "Post notices & updates", icon: Bell, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "submissions", label: "Submissions & Resource Sharing", desc: "Homework & material sharing", icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "flags", label: "Remarks: Flags & Warning", desc: "Student disciplinary tracking", icon: Flag, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "fees", label: "Fees Management", desc: "Track fee payments", icon: Wallet, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "timetable_manual", label: "Timetable Scheduling (Manual)", desc: "Manual timetable management", icon: CalendarIcon, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "student_app", label: "Student's App", desc: "Mobile app for students", icon: Users, inBasic: true, inPro: false, addOnBasic: false, addOnPro: false },
        { key: "student_app_pro", label: "Student App with Parent Portal", desc: "Mobile app + parent access", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "leaderboard", label: "Leaderboard System", desc: "Student ranking & gamification", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "whitelabeling", label: "Whitelabelling (logo+brandname)", desc: "Custom logo & brand name", icon: ShieldCheck, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "timetable_auto", label: "Timetable Scheduling (Auto)", desc: "AI-powered auto scheduling", icon: Cpu, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
        { key: "analytics", label: "Performance Insights & Analytics", desc: "Advanced insights & reports", icon: BarChart2, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
        { key: "smart_board", label: "Smart Board Screen with AI", desc: "Interactive AI smart board", icon: Sparkles, inBasic: true, inPro: true, addOnBasic: true, addOnPro: true },
    ];

// ─── Plan Config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
    PRO: {
        price: '₹4,999',
        userMin: 200,
        storageLimit: 1024,
        storageUnit: ' GB',
        aiTokenLimit: 10,
        aiTokenUnit: ' M',
        ticketLimit: 10,
        upgradeLabel: 'Upgrade to Enterprise',
        showCancel: true,
        badgeBg: 'bg-violet-500/10 border-violet-500/20',
        badgeText: 'text-violet-400',
        badgeIcon: Crown,
        badgeLabel: 'Pro Plan',
    },
    BASIC: {
        price: '₹2,499',
        userMin: 200,
        storageLimit: 500,
        storageUnit: ' GB',
        aiTokenLimit: 10,
        aiTokenUnit: ' M',
        ticketLimit: 5,
        upgradeLabel: 'Upgrade to Pro',
        showCancel: true,
        badgeBg: 'bg-[#DA7756]/10 border-[#DA7756]/20',
        badgeText: 'text-[#DA7756]',
        badgeIcon: Sparkles,
        badgeLabel: 'Basic Plan',
    },
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const invoices = [
    { month: 'May 2025', plan: 'Pro', amount: '₹4,999', status: 'paid' },
    { month: 'Apr 2025', plan: 'Pro', amount: '₹4,999', status: 'paid' },
    { month: 'Mar 2025', plan: 'Pro', amount: '₹4,999', status: 'paid' },
    { month: 'Feb 2025', plan: 'Basic', amount: '₹2,499', status: 'paid' },
    { month: 'Jan 2025', plan: 'Basic', amount: '₹2,499', status: 'paid' },
];

const planHistory = [
    { date: 'Feb 1, 2025', from: 'Basic', to: 'Pro', type: 'upgrade' },
    { date: 'Jan 1, 2025', from: 'Starter', to: 'Basic', type: 'upgrade' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

function SectionHeader({ icon: Icon, title, subtitle, accent = false }: {
    icon: React.ElementType; title: string; subtitle?: string; accent?: boolean;
}) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${accent ? 'bg-[#DA7756]/10' : 'bg-violet-500/10'}`}>
                <Icon className={`w-4.5 h-4.5 ${accent ? 'text-[#DA7756]' : 'text-violet-400'}`} />
            </div>
            <div>
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

function UsageBar({ icon: Icon, label, used, total, unit = '', showAddon = false, onAddon }: {
    icon: React.ElementType; label: string; used: number; total: number;
    unit?: string; showAddon?: boolean; onAddon?: () => void;
}) {
    const pct = Math.min((used / total) * 100, 100);
    const critical = pct >= 90;
    const warning = pct >= 70;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`font-semibold ${critical ? 'text-red-400' : warning ? 'text-[#DA7756]' : 'text-foreground'}`}>
                        {used}{unit} <span className="font-normal text-muted-foreground">/ {total}{unit}</span>
                    </span>
                    {showAddon && (
                        <button onClick={onAddon}
                            className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-lg text-white hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={13} /> Add-on
                        </button>
                    )}
                </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${pct}%`,
                    background: critical
                        ? '#EF4444'
                        : warning
                            ? 'linear-gradient(90deg, #DA7756, #C06040)'
                            : 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                }} />
            </div>
            {critical && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Storage nearing limit
                </p>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubscriptionPage() {
    const router = useRouter();
    const [billingTab, setBillingTab] = useState<'invoices' | 'history'>('invoices');
    const [planView, setPlanView] = useState<'BASIC' | 'PRO'>('PRO');
    const currentPlan = planView;
    const config = PLAN_CONFIG[currentPlan];
    const BadgeIcon = config.badgeIcon;

    const usedUsers = 524;
    const usedStorage = currentPlan === 'PRO' ? 380 : 470;
    const usedAiTokens = currentPlan === 'PRO' ? 6.5 : 9.5;

    const handleAddon = () => router.push('/admin/support/tickets');

    const aiTokenPct = (usedAiTokens / config.aiTokenLimit) * 100;

    return (
        <div className="min-h-screen bg-background">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex items-center justify-between px-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <CreditCard size={21} />
                            Subscription
                        </h1>
                        <p className="text-muted-foreground text-[13px]">Plan usage, features & billing</p>
                    </div>
                    <div className="flex gap-0.5 bg-muted/50 rounded-xl p-0.5 border border-border/50">
                        {(['PRO', 'BASIC'] as const).map((p) => (
                            <button key={p} onClick={() => setPlanView(p)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${planView === p ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                {p === 'PRO' ? 'Pro' : 'Basic'}
                            </button>
                        ))}
                    </div>
                    <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 ${config.badgeBg}`}>
                        <BadgeIcon className={`w-3.5 h-3.5 ${config.badgeText}`} />
                        <span className={`text-xs font-semibold ${config.badgeText}`}>{config.badgeLabel}</span>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="py-3 space-y-5">

                {/* ── Plan Summary Cards ── */}
                <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Current Plan', value: currentPlan === 'PRO' ? 'Pro' : 'Basic', sub: `${config.price}/month`, icon: Crown, iconBg: currentPlan === 'PRO' ? 'bg-violet-100 dark:bg-violet-950' : 'bg-[#DA7756]/10', iconColor: currentPlan === 'PRO' ? 'text-violet-600 dark:text-violet-400' : 'text-[#DA7756]' },
                        { label: 'Next Billing Due Date', value: 'Jun 1', sub: '2025', icon: Receipt, iconBg: 'bg-[#DA7756]/10', iconColor: 'text-[#DA7756]' },
                        { label: 'Member Since', value: 'Jan 2025', sub: '5 months', icon: Zap, iconBg: 'bg-emerald-100 dark:bg-emerald-950', iconColor: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Last Payment Method', value: '•••• 4242', sub: 'Visa card', icon: CreditCard, iconBg: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-600 dark:text-sky-400' },
                    ].map((item) => (
                        <div key={item.label} className="bg-white dark:bg-muted/50 rounded-xl p-4 relative shadow-sm border border-border/50">
                            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center`}>
                                <item.icon size={15} className={item.iconColor} />
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{item.label}</p>
                            <p className="text-xl font-semibold tracking-tight">{item.value}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{item.sub}</p>
                        </div>
                    ))}
                </motion.div>

                {/* ── Plan Monitoring ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.08 }}>
                    <SectionHeader icon={Shield} title="Plan monitoring" subtitle="Current usage against your plan limits" />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                        {/* Usage bars */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 space-y-5">
                            <p className="text-sm font-medium text-foreground">Usage limits</p>
                            <div className="space-y-4">

                                {/* Users — infinite */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">Users</span>
                                            <span className="text-[11px] font-medium text-violet-500 dark:text-violet-400">
                                                (min. {config.userMin} | 200–1499 Users: ₹{currentPlan === 'PRO' ? 25 : 20}/user | 1500+ Users: ₹{currentPlan === 'PRO' ? 22 : 17}/user)
                                            </span>
                                        </div>
                                        <span className="font-semibold text-foreground">
                                            {usedUsers} <span className="font-normal text-muted-foreground">/ ∞</span>
                                        </span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700"
                                            style={{ width: '40%', background: 'linear-gradient(90deg, #7C3AED, #9D5CF6)' }} />
                                    </div>
                                </div>

                                {/* Storage */}
                                <UsageBar icon={Database} label="Storage"
                                    used={usedStorage} total={config.storageLimit} unit={config.storageUnit}
                                    showAddon onAddon={handleAddon} />

                                {/* AI Tokens */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">AI tokens</span>
                                            <span className="text-[11px] font-medium text-violet-500 dark:text-violet-400">↻ Resets Jun 1</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-semibold ${aiTokenPct >= 90 ? 'text-red-400' : aiTokenPct >= 70 ? 'text-[#DA7756]' : 'text-foreground'}`}>
                                                {usedAiTokens}{config.aiTokenUnit} <span className="font-normal text-muted-foreground">/ {config.aiTokenLimit}{config.aiTokenUnit}</span>
                                            </span>
                                            <button onClick={handleAddon}
                                                className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-lg text-white hover:opacity-90 transition-all"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Plus size={13} /> Add-on
                                            </button>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${Math.min(aiTokenPct, 100)}%`,
                                                background: aiTokenPct >= 90
                                                    ? '#EF4444'
                                                    : aiTokenPct >= 70
                                                        ? 'linear-gradient(90deg, #DA7756, #C06040)'
                                                        : 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                                            }} />
                                    </div>
                                    {aiTokenPct >= 90 && (
                                        <p className="text-[11px] text-red-400 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> AI tokens nearing limit
                                        </p>
                                    )}
                                </div>

                            </div>
                        </div>

                        {/* Feature access */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Feature access</p>

                            {/* Default features */}
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Default Features</p>
                            <div className="space-y-2 mb-4">
                                {ALL_FEATURES
                                    .filter(f => currentPlan === 'PRO' ? f.inPro && !f.addOnPro : f.inBasic && !f.addOnBasic)
                                    .map((f) => (
                                        <div key={f.key} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <f.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                <span className="text-xs text-foreground">{f.label}</span>
                                            </div>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        </div>
                                    ))
                                }
                            </div>

                            {/* Addon features */}
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Add-On Features
                                <span className="text-[10px] font-normal text-amber-500 ml-2 normal-case">Year 1 free</span>
                            </p>
                            <div className="space-y-2">
                                {ALL_FEATURES
                                    .filter(f => currentPlan === 'PRO' ? f.addOnPro : f.addOnBasic)
                                    .map((f) => (
                                        <div key={f.key} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <f.icon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                <span className="text-xs text-foreground">{f.label}</span>
                                            </div>
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                                Add-On
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>

                            {currentPlan === 'BASIC' && (
                                <button className="mt-5 w-full text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-xl py-2.5 hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-2">
                                    <ArrowUpRight className="w-3.5 h-3.5" /> Unlock all features
                                </button>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* ── Billing ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.14 }}>
                    <SectionHeader icon={Receipt} title="Billing" subtitle="Plan details, invoices & payment history" accent />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                        {/* Plan card */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">Current plan</p>
                                <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1 ${config.badgeBg}`}>
                                    <BadgeIcon className={`w-3 h-3 ${config.badgeText}`} />
                                    <span className={`text-xs font-semibold ${config.badgeText}`}>{currentPlan === 'PRO' ? 'Pro' : 'Basic'}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">{config.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                                <p className="text-xs text-muted-foreground mt-1">Next billing on Jun 1, 2025</p>
                            </div>
                            <div className="pt-1 border-t border-border/50 space-y-1.5">
                                {[
                                    { label: 'Payment method', value: '•••• 4242' },
                                    { label: 'Billing cycle', value: 'Monthly' },
                                    { label: 'Member since', value: 'Jan 2025' },
                                ].map((row) => (
                                    <div key={row.label} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{row.label}</span>
                                        <span className="font-medium text-foreground">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-2 pt-1">
                                <button className="w-full text-xs font-semibold py-2.5 rounded-xl text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    {config.upgradeLabel}
                                </button>
                                {config.showCancel && (
                                    <button className="w-full text-xs font-medium py-2 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                                        Cancel subscription
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Invoice + history */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="flex items-center gap-1 p-4 border-b border-border/50">
                                {(['invoices', 'history'] as const).map((tab) => (
                                    <button key={tab} onClick={() => setBillingTab(tab)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${billingTab === tab ? 'bg-violet-500/15 text-violet-400' : 'text-muted-foreground hover:text-foreground'}`}>
                                        {tab === 'invoices' ? 'Invoice history' : 'Plan changes'}
                                    </button>
                                ))}
                            </div>

                            {billingTab === 'invoices' && (
                                <div className="divide-y divide-border/30">
                                    {invoices.map((inv, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
                                                    <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground">{inv.month}</p>
                                                    <p className="text-[11px] text-muted-foreground">{inv.plan} plan</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-semibold text-foreground">{inv.amount}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                                    {inv.status}
                                                </span>
                                                <button className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors">
                                                    <Download className="w-3 h-3 text-muted-foreground" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {billingTab === 'history' && (
                                <div className="divide-y divide-border/30">
                                    {planHistory.map((h, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${h.type === 'upgrade' ? 'bg-violet-500/10' : 'bg-[#DA7756]/10'}`}>
                                                    <ArrowUpRight className={`w-3.5 h-3.5 ${h.type === 'upgrade' ? 'text-violet-400' : 'text-[#DA7756]'}`} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground capitalize">{h.type}</p>
                                                    <p className="text-[11px] text-muted-foreground">{h.from} → {h.to}</p>
                                                </div>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground">{h.date}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.section>

                <div className="h-6" />
            </div>
        </div>
    );
}