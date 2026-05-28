'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
    Crown, CreditCard, Shield, CheckCircle2, XCircle, X,
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
    MessageSquare,
    Landmark,
    QrCode
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
        { key: "staffroom", label: "Staffroom & Direct Messaging", desc: "Staff feed and 1-on-1 chats", icon: MessageSquare, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "timetable", label: "Timetable Publishing", desc: "Schedule & share timetables", icon: Zap, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "student_app", label: "Student's App", desc: "Mobile app for students", icon: Users, inBasic: true, inPro: false, addOnBasic: false, addOnPro: false },
        { key: "student_app_pro", label: "Student App with Parent Portal", desc: "Mobile app + parent access", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "leaderboard", label: "Leaderboard System", desc: "Student ranking & gamification", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
        { key: "whitelabeling", label: "Whitelabelling (logo+brandname)", desc: "Custom logo & brand name", icon: ShieldCheck, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
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
    { month: 'May 2025', plan: 'Pro', amount: '₹4,999', status: 'pending', dueDate: '4 Jun 2025' },
    { month: 'Apr 2025', plan: 'Pro', amount: '₹4,999', status: 'paid', dueDate: '4 May 2025' },
    { month: 'Mar 2025', plan: 'Pro', amount: '₹4,999', status: 'paid', dueDate: '4 Apr 2025' },
    { month: 'Feb 2025', plan: 'Basic', amount: '₹2,499', status: 'paid', dueDate: '4 Mar 2025' },
    { month: 'Jan 2025', plan: 'Basic', amount: '₹2,499', status: 'paid', dueDate: '4 Feb 2025' },
];

const planHistory = [
    { date: 'Feb 1, 2025', from: 'Basic', to: 'Pro', type: 'upgrade' },
    { date: 'Jan 1, 2025', from: 'Starter', to: 'Basic', type: 'upgrade' },
];

const activeUsers = 524; // API se aayega
const billedUsers = Math.max(200, activeUsers);
const PRICING_TIERS: Record<'PRO' | 'BASIC', { min: number; max: number; rate: number }[]> = {
    PRO: [
        { min: 200, max: 1499, rate: 25 },
        { min: 1500, max: Infinity, rate: 22 },
    ],
    BASIC: [
        { min: 200, max: 1499, rate: 20 },
        { min: 1500, max: Infinity, rate: 17 },
    ],
};


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

function UsageBar({ icon: Icon, label, used, total, unit = '', showAddon = false, onAddon, isPro = false }: {
    icon: React.ElementType; label: string; used: number; total: number;
    unit?: string; showAddon?: boolean; onAddon?: () => void; isPro?: boolean;
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
                        : isPro
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
    const usedStorage = currentPlan === 'PRO' ? 380 : 120;
    const usedAiTokens = currentPlan === 'PRO' ? 6.5 : 9.5;

    const handleAddon = () => router.push('/admin/support/tickets');

    const aiTokenPct = (usedAiTokens / config.aiTokenLimit) * 100;

    const [featureTab, setFeatureTab] = useState<'default' | 'addon'>('default');

    const tiers = PRICING_TIERS[planView];
    const currentRate = tiers.find((t: { min: number; max: number; rate: number }) => activeUsers >= t.min && activeUsers <= t.max)?.rate ?? tiers[0].rate;
    const monthlyBill = billedUsers * currentRate;

    const [billModal, setBillModal] = useState<typeof invoices[0] | null>(null);

    return (
        <div className="min-h-screen bg-background">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex items-end justify-between px-0">
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
                    <div className="flex items-center gap-2">
                        {currentPlan === 'BASIC' && (
                            <button
                                onClick={() => router.push('/admin/support/tickets')}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                Upgrade to Pro <ArrowUpRight size={12} />
                            </button>
                        )}
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${currentPlan === 'PRO' ? 'bg-[#DA7756]/15 text-[#DA7756]' : 'bg-violet-500/15 text-violet-500'}`}>
                            {currentPlan}
                        </div>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="py-3 space-y-5">

                {/* ── Plan Summary Cards ── */}
                <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Est. Bill (May 2025)', value: '₹10,490', sub: 'Updates live', icon: Wallet, iconBg: 'bg-emerald-100 dark:bg-emerald-950', iconColor: 'text-emerald-600 dark:text-emerald-400' },
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

                    {/* ── Active Plan Banner ── */}
                    <div className="bg-card border border-border/50 rounded-2xl p-5 mb-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Plan Active</span>
                                </div>
                                <h2 className="text-2xl font-black" style={{ color: currentPlan === 'PRO' ? '#DA7756' : '#7C3AED' }}>
                                    {currentPlan}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    School · Monthly Billing · ₹{currentRate}/user
                                </p>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <CalendarIcon size={11} /> Activated:
                                        <span className="font-medium text-foreground ml-1">14 Nov 2024</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                            {/* Pie chart */}
                            <div className="relative w-[90px] h-[90px] shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Admin', value: 1 },
                                                { name: 'Teachers', value: 38 },
                                                { name: 'Students', value: 485 },
                                            ]}
                                            cx="50%" cy="50%"
                                            innerRadius={28} outerRadius={42}
                                            dataKey="value" strokeWidth={2}
                                            stroke="hsl(var(--card))"
                                            paddingAngle={3} minAngle={8}
                                        >
                                            <Cell fill="#7C3AED" />
                                            <Cell fill="#F59E0B" />
                                            <Cell fill="#10B981" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-sm font-black leading-none">524</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Total</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {[
                                    { label: 'Admin', value: 1, color: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
                                    { label: 'Teachers', value: 38, color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
                                    { label: 'Students', value: 485, color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
                                ].map(({ label, value, color, dot }) => (
                                    <div key={label} className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                                        <div>
                                            <p className={`text-sm font-black leading-none ${color}`}>{value}</p>
                                            <p className="text-[10px] text-muted-foreground">{label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

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
                                            style={{ width: '40%', background: currentPlan === 'PRO' ? 'linear-gradient(90deg, #DA7756, #C06040)' : 'linear-gradient(90deg, #7C3AED, #9D5CF6)' }} />
                                    </div>
                                </div>

                                {/* Storage */}
                                <UsageBar icon={Database} label="Storage"
                                    used={usedStorage} total={config.storageLimit} unit={config.storageUnit}
                                    showAddon onAddon={handleAddon} isPro={currentPlan === 'PRO'} />

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
                                                    : currentPlan === 'PRO'
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
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-medium text-foreground">Feature access</p>
                                <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                                    {(['default', 'addon'] as const).map((tab) => (
                                        <button key={tab} onClick={() => setFeatureTab(tab)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${featureTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab === 'default' ? 'Default' : 'Add-On'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {featureTab === 'default' && (
                                <div className="overflow-y-auto max-h-[190px] min-h-[190px] space-y-2">                                    {ALL_FEATURES.filter(f => currentPlan === 'PRO' ? f.inPro && !f.addOnPro : f.inBasic && !f.addOnBasic).map((f) => (
                                    <div key={f.key} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <f.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs text-foreground">{f.label}</span>
                                        </div>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    </div>
                                ))}
                                </div>
                            )}

                            {featureTab === 'addon' && (
                                <div className="overflow-y-auto max-h-[190px] min-h-[190px] space-y-2">                                    {ALL_FEATURES.filter(f => currentPlan === 'PRO' ? f.addOnPro : f.addOnBasic).map((f) => (
                                    <div key={f.key} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <f.icon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span className="text-xs text-foreground">{f.label}</span>
                                        </div>
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                            Year 1 free
                                        </span>
                                    </div>
                                ))}
                                </div>
                            )}

                            <button className="mt-5 w-full text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-xl py-2.5 hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-2">
                                <ArrowUpRight className="w-3.5 h-3.5" /> Unlock features
                            </button>
                        </div>
                    </div>
                </motion.section>

                {/* ── Billing ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.14 }}>
                    <SectionHeader icon={Receipt} title="Billing" subtitle="Plan details, invoices & payment history" accent />
                    <div className="space-y-3">

                        {/* Billing Summary */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 space-y-4">
                            <p className="text-sm font-medium text-foreground">Billing Summary</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-muted/50 rounded-xl p-3 border border-border/50">
                                    <p className="text-xs text-muted-foreground mb-1">Active Users</p>
                                    <p className="text-lg font-bold">{activeUsers}</p>
                                    <p className="text-[11px] text-muted-foreground">billed this month</p>
                                </div>
                                <div className="bg-white dark:bg-muted/50 rounded-xl p-3 border border-border/50">
                                    <p className="text-xs text-muted-foreground mb-1">Current Rate</p>
                                    <p className="text-lg font-bold">₹{currentRate}</p>
                                    <p className="text-[11px] text-muted-foreground">per user / month</p>
                                </div>
                                <div className="bg-white dark:bg-muted/50 rounded-xl p-3 border border-border/50" style={{ borderColor: '#DA775640' }}>
                                    <p className="text-xs text-muted-foreground mb-1">Est. Monthly Bill</p>
                                    <p className="text-lg font-bold" style={{ color: '#DA7756' }}>₹{monthlyBill.toLocaleString('en-IN')}</p>
                                    <p className="text-[11px] text-muted-foreground">Next billing Jun 1</p>
                                </div>
                            </div>

                            {/* Pricing Tiers */}
                            <div className="rounded-xl border border-border/50 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pricing Tiers</p>
                                </div>
                                <div className="divide-y divide-border/30">
                                    {tiers.map((tier: { min: number; max: number; rate: number }, i: number) => {
                                        const isActive = activeUsers >= tier.min && activeUsers <= tier.max;
                                        return (
                                            <div key={i} className={`flex items-center justify-between px-3 py-2 ${isActive ? 'bg-[#DA7756]/5' : ''}`}>
                                                <div className="flex items-center gap-2">
                                                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756]" />}
                                                    <span className={`text-xs ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                                        {tier.max === Infinity ? `${tier.min}+ users` : `${tier.min}–${tier.max} users`}
                                                    </span>
                                                    {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#DA7756]/15 text-[#DA7756] font-semibold">Current</span>}
                                                </div>
                                                <span className={`text-xs font-bold ${isActive ? 'text-[#DA7756]' : 'text-muted-foreground'}`}>
                                                    ₹{tier.rate}/user
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                💡 Minimum 200 users billed. Current active: {activeUsers} users — billed as {billedUsers} users. ₹{monthlyBill.toLocaleString('en-IN')} est. next bill.
                            </p>
                        </div>

                        {/* ── Bills & Payments ── */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 space-y-4">
                            <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                <FileText size={15} /> Bills & Payments
                            </p>
                            <div className="space-y-4">
                                {/* Current Month */}
                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Current Month
                                        <span className="text-[10px] font-normal normal-case ml-2 text-violet-600 dark:text-violet-400">
                                            May 2025 · Generates 31 May
                                        </span>
                                    </p>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                                        <span>📅 01 May – 31 May 2025</span>
                                        <span className="font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                            Generates on 31 May
                                        </span>
                                    </div>
                                    <div className="rounded-xl border border-border/50 overflow-hidden">
                                        <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bill Breakdown</p>
                                        </div>
                                        <div className="divide-y divide-border/30">
                                            <div className="flex items-center justify-between px-3 py-2.5">
                                                <div>
                                                    <p className="text-xs font-medium">Monthly User Bill</p>
                                                    <p className="text-[11px] text-muted-foreground">{billedUsers} users × ₹{currentRate}/user</p>
                                                </div>
                                                <span className="text-xs font-bold">₹{monthlyBill.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 border-t border-border/50">
                                            <p className="text-xs font-bold">Total</p>
                                            <p className="text-sm font-black" style={{ color: '#DA7756' }}>₹{monthlyBill.toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-border/50" />

                                {/* Generated Bill */}
                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Generated Bill
                                    </p>
                                    {invoices.length > 0 ? (
                                        <div className="divide-y divide-border/40">
                                            <div className="flex items-center justify-between py-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-semibold">{invoices[0].month}</p>
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">New</span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">Due {invoices[0].dueDate}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold">{invoices[0].amount}</p>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${invoices[0].status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                                        {invoices[0].status}
                                                    </span>
                                                    <button onClick={() => setBillModal(invoices[0])}
                                                        className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                                        View
                                                    </button>
                                                    <button className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors">
                                                        <Download className="w-3 h-3 text-muted-foreground" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8 text-center gap-2 bg-muted/20 rounded-xl border border-border/40">
                                            <Receipt className="w-8 h-8 text-muted-foreground/30" />
                                            <p className="text-xs font-medium text-muted-foreground">No bill generated yet</p>
                                            <p className="text-[11px] text-muted-foreground/60">
                                                Bill will appear here once generated at end of month
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>



                        {/* Plan card */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
                            <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">                                {/* Tab bar */}
                                <div className="flex items-center gap-1 p-4 border-b border-border/50">
                                    {(['invoices', 'history'] as const).map((tab) => (
                                        <button key={tab} onClick={() => setBillingTab(tab)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${billingTab === tab ? 'bg-violet-500/15 text-violet-400' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab === 'invoices' ? 'Invoice history' : 'Payments'}
                                        </button>
                                    ))}
                                </div>

                                {/* Invoice history tab */}
                                {billingTab === 'invoices' && (
                                    <div className="divide-y divide-border/40 h-[340px] overflow-y-auto">
                                        {invoices.map((inv, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-5 py-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-semibold">{inv.month}</p>
                                                        {idx === 0 && (
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">New</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">Due {inv.dueDate}</p>                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold">{inv.amount}</p>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                                        {inv.status}
                                                    </span>
                                                    <button onClick={() => setBillModal(inv)}
                                                        className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                                        View
                                                    </button>
                                                    <button className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors">
                                                        <Download className="w-3 h-3 text-muted-foreground" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Payment tab */}
                                {billingTab === 'history' && (
                                    <div className="h-[340px] overflow-y-auto p-5 space-y-4">
                                        {/* Bank Transfer */}
                                        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2.5">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
                                                    <Landmark className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                                                </div>
                                                <p className="text-xs font-semibold">Bank Transfer</p>
                                            </div>
                                            {[
                                                { label: 'Account Name', value: 'Qubeex Technologies Pvt Ltd' },
                                                { label: 'Account No.', value: '1234 5678 9012' },
                                                { label: 'IFSC Code', value: 'HDFC0001234' },
                                                { label: 'Bank', value: 'HDFC Bank' },
                                            ].map((row) => (
                                                <div key={row.label} className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">{row.label}</span>
                                                    <span className="font-semibold text-foreground font-mono">{row.value}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* QR Code */}
                                        <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                                    <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <p className="text-xs font-semibold">UPI / QR Code</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-24 h-24 bg-muted rounded-xl flex items-center justify-center border border-border/50 shrink-0">
                                                    <QrCode size={48} className="text-muted-foreground/30" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-xs text-muted-foreground">Scan to pay via UPI</p>
                                                    <p className="text-xs font-semibold font-mono text-foreground">qubeex@hdfcbank</p>
                                                    <p className="text-[11px] text-muted-foreground">After payment, share screenshot with support</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Gateway */}
                                        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 border-dashed">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center">
                                                    <CreditCard className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                                </div>
                                                <p className="text-xs font-semibold">Online Payment Gateway</p>
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Coming Soon</span>
                                            </div>
                                            <div className="flex flex-col items-center justify-center py-4 gap-2">
                                                <CreditCard size={28} className="text-muted-foreground/20" />
                                                <p className="text-xs text-muted-foreground">Online payment gateway coming soon</p>
                                                <p className="text-[11px] text-muted-foreground/60">Pay via card, netbanking, or UPI directly</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>


                        </div>
                    </div>

                </motion.section>

                {billModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full mx-4 shadow-2xl"
                        >
                            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                                <div>
                                    <h3 className="text-base font-bold">Invoice — {billModal.month}</h3>
                                    <p className="text-[11px] text-muted-foreground">Due {billModal.dueDate}</p>
                                </div>
                                <button onClick={() => setBillModal(null)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-bold">Your Institution</p>
                                        <p className="text-[11px] text-muted-foreground">{currentPlan} Plan</p>
                                        <p className="text-[11px] text-muted-foreground">admin@institution.com</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-muted-foreground">Plan</p>
                                        <p className="text-sm font-bold" style={{ color: currentPlan === 'PRO' ? '#DA7756' : '#7C3AED' }}>
                                            {currentPlan}
                                        </p>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${billModal.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                            {billModal.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-px bg-border/50" />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium">Monthly User Bill</p>
                                        <p className="text-[11px] text-muted-foreground">{billedUsers} users × ₹{currentRate}/user</p>
                                    </div>
                                    <p className="text-xs font-bold">{billModal.amount}</p>
                                </div>
                                <div className="h-px bg-border/50" />
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold">Total Amount</p>
                                    <p className="text-lg font-black" style={{ color: '#DA7756' }}>{billModal.amount}</p>
                                </div>
                                <p className="text-[11px] text-muted-foreground">Due {billModal.dueDate}</p>
                            </div>
                            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                                <button onClick={() => setBillModal(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Close
                                </button>
                                <button onClick={() => window.print()}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    Download PDF
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                <div className="h-6" />
            </div>
        </div>
    );
}