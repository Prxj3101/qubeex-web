'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import QRCode from 'qrcode';
import NextImage from 'next/image';
import { useBranding } from '@/context/BrandingContext';
import type { AdminOverview } from '@/types';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
    Crown, CreditCard, Shield, CheckCircle2, XCircle, X,
    AlertTriangle, Download, ArrowUpRight, ChevronRight,
    Receipt, Zap, TicketIcon, Plus, Users,
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
    QrCode,
    Database,
} from 'lucide-react';

function formatStorage(mb: number): string {
    if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(mb % (1024 * 1024) === 0 ? 0 : 1)} TB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
}

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
        { key: "tests", label: "AI Question & Test Generation", desc: "Create & conduct assessments", icon: FileText, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
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
        { key: "analytics", label: "AI Performance Insights & Analytics", desc: "Advanced insights & reports", icon: BarChart2, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
        { key: "smart_board", label: "AI Smart Board", desc: "Interactive AI smart board", icon: Sparkles, inBasic: true, inPro: true, addOnBasic: true, addOnPro: true },
    ];

// ─── Plan Config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
    PRO: {
        price: '₹4,999',
        userMin: 200,
        storageLimit: 1024,
        storageUnit: ' GB',
        aiTokenLimit: 15,
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

// ─── Bill type (matches GET /api/admin/bills response) ───────────────────────
type Bill = {
    id: string;
    type: string;
    billingMonth: string | null;
    totalAmount: number;
    status: 'PENDING' | 'PAID';
    dueDate: string | null;
    paidAt: string | null;
    generatedAt: string;
    razorpayLinkUrl: string | null;
    paymentMethod: string | null;
};

type PlanHistoryEntry = { id: string; details: string | null; date: string };

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    card: 'Card',
    upi: 'UPI',
    netbanking: 'Netbanking',
    wallet: 'Wallet',
    emi: 'EMI',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    manual: 'Manual',
};

const formatBillAmount = (amount: number) =>
    `₹${amount.toLocaleString('en-IN')}`;

const formatBillDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    });
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubscriptionPage() {
    const router = useRouter();
    const [billingTab, setBillingTab] = useState<'invoices' | 'history'>('invoices');
    const [featureTab, setFeatureTab] = useState<'default' | 'addon'>('default');

    // ── Overview (plan, usage, dates, user breakdown) ──────────────────────────
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const overviewFetchedRef = useRef(false);

    useEffect(() => {
        if (overviewFetchedRef.current) return;
        overviewFetchedRef.current = true;
        api.get('/admin/overview')
            .then(res => setOverview(res.data.data))
            .catch(() => {})
            .finally(() => setOverviewLoading(false));
    }, []);

    // Background poll — surfaces superadmin-side plan/feature changes without a manual reload.
    useEffect(() => {
        const poll = setInterval(() => {
            api.get('/admin/overview').then(res => setOverview(res.data.data)).catch(() => {});
        }, 30_000);
        return () => clearInterval(poll);
    }, []);

    const isTrial = overview?.plan.isTrial ?? false;
    const currentPlan: 'BASIC' | 'PRO' = overview?.plan.name === 'PRO' ? 'PRO' : 'BASIC';
    // Trials include the full PRO feature set for free, regardless of the plan they'll convert to.
    const featurePlan: 'BASIC' | 'PRO' = isTrial ? 'PRO' : currentPlan;
    const branding = useBranding();
    const config = PLAN_CONFIG[currentPlan];
    const BadgeIcon = config.badgeIcon;

    // Fallback to activationDate as trial start + a 14-day default window until the backend sends
    // explicit trialStartDate/trialEndDate/trialDaysTotal fields.
    const trialDaysTotal = overview?.plan.trialDaysTotal ?? 14;
    const trialStartDate = overview?.plan.trialStartDate
        ? new Date(overview.plan.trialStartDate)
        : overview?.plan.activationDate
            ? new Date(overview.plan.activationDate)
            : overview?.institution.createdAt
                ? new Date(overview.institution.createdAt)
                : null;
    const trialEndDate = overview?.plan.trialEndDate
        ? new Date(overview.plan.trialEndDate)
        : trialStartDate
            ? new Date(trialStartDate.getTime() + trialDaysTotal * 24 * 60 * 60 * 1000)
            : null;
    const trialDaysRemaining = trialEndDate
        ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    const usedUsers = overview?.plan.usage.users.used ?? 0;
    const userLimit = overview?.plan.usage.users.limit ?? 0;
    const userPct = userLimit ? Math.min(100, (usedUsers / userLimit) * 100) : 0;

    const aiTokensUsedRaw = overview?.plan.usage.aiTokens.used ?? 0;
    const aiTokensLimitRaw = overview?.plan.usage.aiTokens.limit ?? (isTrial ? 2_000_000 : config.aiTokenLimit * 1_000_000);
    const usedAiTokens = Number((aiTokensUsedRaw / 1_000_000).toFixed(1));
    const aiTokenLimitDisplay = Number((aiTokensLimitRaw / 1_000_000).toFixed(1));

    const handleAddon = () => router.push('/admin/support/tickets');

    const aiTokenPct = aiTokensLimitRaw ? (aiTokensUsedRaw / aiTokensLimitRaw) * 100 : 0;

    const usedStorage = overview?.plan.usage.storage.used ?? 0;
    const storageLimit = overview?.plan.usage.storage.limit ?? (config.storageLimit * 1024);
    const storagePct = storageLimit ? Math.min(100, (usedStorage / storageLimit) * 100) : 0;

    const billedUsers = overview?.plan.billedUsers ?? 200;
    const planOption = overview?.plan.planOption ?? 'NORMAL';
    // Real marginal-bracket structure (mirrors backend PLAN_BASE_RATES) — first
    // 1500 users at the base rate, users beyond that at the lower marginal rate.
    const committedMultiplier = planOption === 'COMMITTED' ? 0.85 : 1;
    // min: 1 here (not 200) so isActive correctly highlights schools with
    // fewer than 200 actual users too — the "200" floor is a display-only
    // label (see tier.min === 1 check below), not the real active-tier bound.
    const tiers: { min: number; max: number; rate: number }[] = currentPlan === 'PRO'
        ? [
            { min: 1, max: 1499, rate: Math.round(39 * committedMultiplier) },
            { min: 1500, max: Infinity, rate: Math.round(33 * committedMultiplier) },
        ]
        : [
            { min: 1, max: 1499, rate: Math.round(29 * committedMultiplier) },
            { min: 1500, max: Infinity, rate: Math.round(24 * committedMultiplier) },
        ];
    // Backend computes the real marginal-bracket rate (first 1500 users at base
    // rate, the rest at the lower marginal rate) plus the Committed discount if
    // applicable — trust it as the single source of truth instead of
    // recomputing a flat rate here that can't reflect either of those.
    const currentRate = isTrial ? 0 : (overview?.plan.perUserRate ?? 0);
    const monthlyBill = isTrial ? 0 : (overview?.plan.estMonthlyBill ?? 0);
    // Mirrors the superadmin institution detail page's isActivationMonth —
    // used only to decide whether to show the "(prorated for this partial
    // month)" note; the actual proration math already happened server-side
    // in estMonthlyBill.
    const isActivationMonth = (() => {
        if (!overview?.plan.activationDate) return false;
        const activation = new Date(overview.plan.activationDate);
        const today = new Date();
        return activation.getFullYear() === today.getFullYear() && activation.getMonth() === today.getMonth();
    })();

    // Current billing cycle window (calendar month, IST) — bills generate on the last day.
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const cycleStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
    const cycleEnd = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 0);
    const currentMonthLabel = nowIST.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const cycleDateFmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
    const cycleGeneratesFmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', timeZone: 'Asia/Kolkata' });

    const userBreakdown = [
        { label: 'Admin', value: overview?.stats.totalAdmins ?? 0, color: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', fill: '#7C3AED' },
        { label: 'Teachers', value: overview?.stats.totalTeachers ?? 0, color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', fill: '#F59E0B' },
        { label: 'Students', value: overview?.stats.totalStudents ?? 0, color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', fill: '#10B981' },
    ];

    // ── Bills state ──────────────────────────────────────────────────────────
    const [bills, setBills] = useState<Bill[]>([]);
    const [billsLoading, setBillsLoading] = useState(true);
    const [payNowLoading, setPayNowLoading] = useState(false);
    const [nextAnticipatedDueDate, setNextAnticipatedDueDate] = useState<string | null>(null);
    const billsFetchedRef = useRef(false);

    // ── Platform payment settings (bank transfer / UPI, set by SuperAdmin) ──
    const [paymentSettings, setPaymentSettings] = useState<{
        bankAccountName: string | null; bankAccountNumber: string | null;
        bankIfsc: string | null; bankName: string | null; upiId: string | null;
    } | null>(null);
    useEffect(() => {
        api.get('/admin/payment-settings').then(res => setPaymentSettings(res.data.data)).catch(() => {});
    }, []);
    const hasBankDetails = !!(paymentSettings?.bankAccountName || paymentSettings?.bankAccountNumber || paymentSettings?.bankIfsc || paymentSettings?.bankName);

    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!paymentSettings?.upiId) { setQrDataUrl(null); return; }
        const payee = encodeURIComponent(paymentSettings.bankAccountName || 'Qubeex');
        const upiLink = `upi://pay?pa=${encodeURIComponent(paymentSettings.upiId)}&pn=${payee}&cu=INR`;
        QRCode.toDataURL(upiLink, { width: 200, margin: 1 })
            .then(setQrDataUrl)
            .catch(() => setQrDataUrl(null));
    }, [paymentSettings]);

    useEffect(() => {
        if (billsFetchedRef.current) return;
        billsFetchedRef.current = true;
        api.get('/admin/bills', { params: { limit: 10 } })
            .then(res => {
                setBills(res.data.data?.bills ?? []);
                setNextAnticipatedDueDate(res.data.data?.nextAnticipatedDueDate ?? null);
            })
            .catch(() => {})
            .finally(() => setBillsLoading(false));
    }, []);

    // Background poll — surfaces new bills (generated/paid status changes) without a manual reload.
    useEffect(() => {
        const poll = setInterval(() => {
            api.get('/admin/bills', { params: { limit: 10 } })
                .then(res => {
                    setBills(res.data.data?.bills ?? []);
                    setNextAnticipatedDueDate(res.data.data?.nextAnticipatedDueDate ?? null);
                })
                .catch(() => {});
        }, 30_000);
        return () => clearInterval(poll);
    }, []);

    const latestBill = bills[0] ?? null;
    const latestPending = bills.find(b => b.status === 'PENDING') ?? null;
    const latestPaid = bills.find(b => b.status === 'PAID' && b.paymentMethod) ?? null;

    const handlePayNow = async () => {
        if (!latestPending || payNowLoading) return;
        setPayNowLoading(true);
        try {
            const res = await api.get(`/admin/bills/${latestPending.id}/payment-link`);
            window.location.href = res.data.data.url;
        } catch {
            setPayNowLoading(false);
        }
    };

    const [billModal, setBillModal] = useState<Bill | null>(null);

    // ── Plan history ────────────────────────────────────────────────────────
    const [planHistory, setPlanHistory] = useState<PlanHistoryEntry[]>([]);
    const [planHistoryLoading, setPlanHistoryLoading] = useState(true);
    const planHistoryFetchedRef = useRef(false);

    useEffect(() => {
        if (planHistoryFetchedRef.current) return;
        planHistoryFetchedRef.current = true;
        api.get('/admin/plan-history')
            .then(res => setPlanHistory(res.data.data ?? []))
            .catch(() => {})
            .finally(() => setPlanHistoryLoading(false));
    }, []);

    if (overviewLoading) {
        return (
            <div className="min-h-screen bg-background animate-pulse space-y-4 py-3">
                <div className="h-8 w-48 bg-muted rounded-xl" />
                <div className="h-40 w-full bg-muted rounded-2xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-48 bg-muted rounded-2xl" />
                    <div className="h-48 bg-muted rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between px-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <CreditCard size={21} />
                            Subscription
                        </h1>
                        <p className="text-muted-foreground text-[13px]">Plan usage, features & billing</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isTrial && currentPlan === 'BASIC' && (
                            <button
                                onClick={() => router.push('/admin/support/tickets')}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                Upgrade to Pro <ArrowUpRight size={12} />
                            </button>
                        )}
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${isTrial ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : currentPlan === 'PRO' ? 'bg-[#DA7756]/15 text-[#DA7756]' : 'bg-violet-500/15 text-violet-500'}`}>
                            {isTrial ? 'TRIAL' : currentPlan}
                        </div>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="py-3 space-y-5">

                {/* ── Plan Summary Cards ── */}
                <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Est. Bill (this month)', value: isTrial ? '—' : `₹${monthlyBill.toLocaleString('en-IN')}`, sub: isTrial ? 'Trial — no billing yet' : 'Updates live', icon: Wallet, iconBg: 'bg-emerald-100 dark:bg-emerald-950', iconColor: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Next Billing Due Date', value: latestPending?.dueDate ? formatBillDate(latestPending.dueDate) : nextAnticipatedDueDate ? formatBillDate(nextAnticipatedDueDate) : '—', sub: latestPending ? 'Payment pending' : nextAnticipatedDueDate ? 'Anticipated — next bill not yet generated' : 'No pending bill', icon: Receipt, iconBg: 'bg-[#DA7756]/10', iconColor: 'text-[#DA7756]' },
                        { label: 'Member Since', value: overview?.institution.createdAt ? formatBillDate(overview.institution.createdAt) : '—', sub: '', icon: Zap, iconBg: 'bg-emerald-100 dark:bg-emerald-950', iconColor: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Last Payment Method', value: latestPaid?.paymentMethod ? (PAYMENT_METHOD_LABELS[latestPaid.paymentMethod] ?? latestPaid.paymentMethod) : '—', sub: latestPaid ? formatBillDate(latestPaid.paidAt) : 'No payments yet', icon: CreditCard, iconBg: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-600 dark:text-sky-400' },
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
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Plan Active</span>
                                </div>
                                <h2 className="text-2xl font-black" style={{ color: isTrial ? '#F59E0B' : currentPlan === 'PRO' ? '#DA7756' : '#7C3AED' }}>
                                    {isTrial ? 'TRIAL' : currentPlan}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {isTrial ? `School · Free trial · ${trialDaysTotal} days total` : `School · ${planOption === 'COMMITTED' ? 'Committed' : 'Normal'} Billing · ₹${currentRate}/user`}
                                    {!isTrial && planOption === 'COMMITTED' && (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium"> (15% off)</span>
                                    )}
                                </p>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {isTrial ? (
                                        <>
                                            {trialStartDate && (
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <CalendarIcon size={11} /> Started:{' '}
                                                    <span className="font-medium text-foreground ml-1">
                                                        {trialStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </span>
                                            )}
                                            {trialEndDate && (
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <Flag size={11} className="text-amber-500" /> Ends:{' '}
                                                    <span className="font-medium text-amber-600 dark:text-amber-400 ml-1">
                                                        {trialEndDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <CalendarIcon size={11} /> Activated:
                                                <span className="font-medium text-foreground ml-1">
                                                    {overview?.plan.activationDate ? formatBillDate(overview.plan.activationDate) : 'Not yet activated'}
                                                </span>
                                            </span>
                                            {planOption === 'COMMITTED' && overview?.plan.commitmentEndDate && (
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <CalendarIcon size={11} /> Committed until:
                                                    <span className="font-medium text-foreground ml-1">
                                                        {formatBillDate(overview.plan.commitmentEndDate)}
                                                    </span>
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => router.push('/admin/support/tickets')}
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs font-semibold hover:opacity-80 transition-all">
                                    <XCircle size={13} /> Request Deactivation
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                            {/* Pie chart */}
                            <div className="relative w-[90px] h-[90px] shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={userBreakdown.map(u => ({ name: u.label, value: u.value }))}
                                            cx="50%" cy="50%"
                                            innerRadius={28} outerRadius={42}
                                            dataKey="value" strokeWidth={2}
                                            stroke="hsl(var(--card))"
                                            paddingAngle={3} minAngle={8}
                                        >
                                            {userBreakdown.map((u) => (
                                                <Cell key={u.label} fill={u.fill} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-sm font-black leading-none">{overview?.stats.totalUsers ?? 0}</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Total</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {userBreakdown.map(({ label, value, color, dot }) => (
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

                                {/* Users */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">Users</span>
                                            {!isTrial && (
                                                <span className="text-[11px] font-medium text-violet-500 dark:text-violet-400">
                                                    (min. {config.userMin} | ₹{currentRate}/user per month)
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-foreground">
                                                {usedUsers} <span className="font-normal text-muted-foreground">/ ∞</span>
                                            </span>
                                            <button
                                                onClick={() => router.push('/admin/insights/users?from=subscription')}
                                                className="w-5 h-5 rounded-md flex items-center justify-center hover:opacity-80 transition-all shrink-0"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <ArrowUpRight size={11} className="text-white" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${userPct}%`, background: currentPlan === 'PRO' ? 'linear-gradient(90deg, #DA7756, #C06040)' : 'linear-gradient(90deg, #7C3AED, #9D5CF6)' }} />
                                    </div>
                                </div>

                                {/* Storage */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Database className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">Storage</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-semibold ${storagePct >= 90 ? 'text-red-400' : storagePct >= 70 ? 'text-[#DA7756]' : 'text-foreground'}`}>
                                                {formatStorage(usedStorage)} <span className="font-normal text-muted-foreground">/ {formatStorage(storageLimit)}</span>
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
                                                width: `${storagePct}%`,
                                                background: storagePct >= 90
                                                    ? '#EF4444'
                                                    : currentPlan === 'PRO'
                                                        ? 'linear-gradient(90deg, #DA7756, #C06040)'
                                                        : 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                                            }} />
                                    </div>
                                    {storagePct >= 90 && (
                                        <p className="text-[11px] text-red-400 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Storage nearing limit
                                        </p>
                                    )}
                                </div>

                                {/* AI Tokens */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">AI tokens</span>
                                            {overview?.plan.usage.aiTokens.resetsAt && (
                                                <span className="text-[11px] font-medium text-violet-500 dark:text-violet-400">
                                                    ↻ Resets {new Date(overview.plan.usage.aiTokens.resetsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-semibold ${aiTokenPct >= 90 ? 'text-red-400' : aiTokenPct >= 70 ? 'text-[#DA7756]' : 'text-foreground'}`}>
                                                {usedAiTokens}{config.aiTokenUnit} <span className="font-normal text-muted-foreground">/ {aiTokenLimitDisplay}{config.aiTokenUnit}</span>
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
                                <div className="overflow-y-auto max-h-[190px] min-h-[190px] space-y-2">
                                    {ALL_FEATURES.filter(f => (featurePlan === 'PRO' ? f.inPro && !f.addOnPro : f.inBasic && !f.addOnBasic) && !(isTrial && f.key === 'whitelabeling')).map((f, i) => (
                                    <div key={f.key} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold text-muted-foreground/50 w-4 shrink-0">{i + 1}.</span>
                                            <f.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs text-foreground">{f.label}</span>
                                        </div>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    </div>
                                ))}
                                </div>
                            )}

                            {featureTab === 'addon' && (
                                <div className="overflow-y-auto max-h-[190px] min-h-[190px] space-y-2">
                                    {ALL_FEATURES.filter(f => (featurePlan === 'PRO' ? f.addOnPro : f.addOnBasic) && !(isTrial && f.key === 'whitelabeling')).map((f, i) => (
                                    <div key={f.key} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold text-muted-foreground/50 w-4 shrink-0">{i + 1}.</span>
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

                            <button
                                onClick={handleAddon}
                                className="mt-5 w-full text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-xl py-2.5 hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-2">
                                <ArrowUpRight className="w-3.5 h-3.5" /> Unlock features
                            </button>
                        </div>
                    </div>

                    {/* White-Labeling status */}
                    <div className="mt-3 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground">White-Labeling</p>
                            </div>
                            {branding.enabled && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" /> Active
                                </span>
                            )}
                        </div>

                        {branding.enabled ? (
                            <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                                <NextImage
                                    src={branding.logoUrl}
                                    alt={branding.brandName}
                                    width={36} height={36}
                                    unoptimized
                                    className="rounded-lg object-contain shrink-0"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{branding.brandName}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Your custom branding is live across the web and mobile app.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                                <p className="text-[11px] text-muted-foreground">
                                    {currentPlan === 'PRO'
                                        ? 'Replace QubeEx branding with your own name and logo. Contact us to get it set up.'
                                        : 'Available on the Pro plan — replace QubeEx branding with your own name and logo.'}
                                </p>
                                <button
                                    onClick={handleAddon}
                                    className="shrink-0 text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-lg px-3 py-1.5 hover:bg-violet-500/10 transition-colors whitespace-nowrap">
                                    Request
                                </button>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* ── Billing ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.14 }}>
                    <SectionHeader icon={Receipt} title="Billing" subtitle="Plan details, invoices & payment history" accent />
                    <div className="space-y-3">

                        {/* Billing Summary */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 space-y-4">
                            <p className="text-sm font-medium text-foreground">Billing Summary</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-muted/50 rounded-xl p-3 border border-border/50">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs text-muted-foreground">Active Users</p>
                                        <button
                                            onClick={() => router.push('/admin/insights/users?from=subscription')}
                                            className="w-6 h-6 rounded-md flex items-center justify-center hover:opacity-80 transition-all shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                            <ArrowUpRight size={13} className="text-white" />
                                        </button>
                                    </div>
                                    <p className="text-lg font-bold">{usedUsers}</p>
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
                                    <p className="text-[11px] text-muted-foreground">
                                        {/* This card shows a running ESTIMATE for the current cycle, not an
                                            already-generated invoice — always say "Generates" (when the bill
                                            will actually be created), never "Due" (a payment-due date belongs
                                            on an actual invoice, shown elsewhere on this page). */}
                                        {(() => {
                                            const genDate = nextAnticipatedDueDate ?? latestPending?.dueDate ?? null;
                                            return genDate ? `Generates ${formatBillDate(genDate)}` : 'No pending bill';
                                        })()}
                                    </p>
                                </div>
                            </div>

                            {!isTrial && (
                                <>
                                    {/* Pricing Tiers */}
                                    <div className="rounded-xl border border-border/50 overflow-hidden">
                                        <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pricing Tiers</p>
                                        </div>
                                        <div className="divide-y divide-border/30">
                                            {tiers.map((tier: { min: number; max: number; rate: number }, i: number) => {
                                                const isActive = usedUsers >= tier.min && usedUsers <= tier.max;
                                                return (
                                                    <div key={i} className={`flex items-center justify-between px-3 py-2 ${isActive ? 'bg-[#DA7756]/5' : ''}`}>
                                                        <div className="flex items-center gap-2">
                                                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756]" />}
                                                            <span className={`text-xs ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                                                {/* Display-only: real minimum billed is 200 (Math.max(200, userCount)
                                                                    floor), so base-rate tier reads "200–1500 users". isActive above
                                                                    stays on the real tier.min/max so highlight boundaries don't shift. */}
                                                                {tier.max === Infinity ? `${tier.min}+ users` : tier.min === 1 ? `200–1500 users` : `${tier.min}–${tier.max} users`}
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
                                    <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200/50 dark:border-violet-900/50">
                                        <p className="text-[11px] text-violet-600 dark:text-violet-400">
                                            💡 Minimum 200 users billed per month. Current active:{' '}
                                            {usedUsers} users — billed as {billedUsers} users.{' '}
                                            ₹{monthlyBill.toLocaleString('en-IN')} est. next bill
                                            {isActivationMonth ? ' (prorated for this partial month)' : ''}.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ── Plan History ── */}
                        {(planHistoryLoading || planHistory.length > 0) && (
                            <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 space-y-3">
                                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                    <Crown size={15} /> Plan History
                                </p>
                                {planHistoryLoading ? (
                                    <div className="space-y-2">
                                        <div className="h-8 w-full rounded-lg bg-muted/40 animate-pulse" />
                                        <div className="h-8 w-full rounded-lg bg-muted/40 animate-pulse" />
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/40">
                                        {planHistory.map((entry) => (
                                            <div key={entry.id} className="flex items-center justify-between py-2.5">
                                                <p className="text-xs text-foreground">{entry.details ?? 'Plan upgraded'}</p>
                                                <p className="text-[11px] text-muted-foreground shrink-0 ml-3">{formatBillDate(entry.date)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

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
                                            {currentMonthLabel} · Generates {cycleGeneratesFmt(cycleEnd)}
                                        </span>
                                    </p>
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground mb-2">
                                        <span>📅 {cycleDateFmt(cycleStart)} – {cycleDateFmt(cycleEnd)}, {cycleEnd.getFullYear()}</span>
                                        <span className="font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 w-fit">
                                            Generates on {cycleGeneratesFmt(cycleEnd)}
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
                                    {billsLoading ? (
                                        <div className="h-12 rounded-xl bg-muted/40 animate-pulse" />
                                    ) : latestBill ? (
                                        <div className="divide-y divide-border/40">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-semibold">{latestBill.billingMonth ?? latestBill.type}</p>
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">New</span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">Due {formatBillDate(latestBill.dueDate)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold">{formatBillAmount(latestBill.totalAmount)}</p>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${latestBill.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                                        {latestBill.status.toLowerCase()}
                                                    </span>
                                                    <button onClick={() => setBillModal(latestBill)}
                                                        className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                                        View
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
                            {/* Plan card */}
                            <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-foreground">Latest Bill — {latestBill?.billingMonth ?? latestBill?.type ?? '—'}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Bill Status:</span>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${latestBill?.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                            {latestBill?.status?.toLowerCase() ?? 'pending'}
                                        </span>
                                    </div>
                                </div>
                                {/* Recent bill info */}
                                <div className="space-y-2">
                                    {billsLoading ? (
                                        <div className="h-9 w-28 rounded-lg bg-muted/40 animate-pulse" />
                                    ) : (
                                        <p className="text-3xl font-bold text-foreground">{latestBill ? formatBillAmount(latestBill.totalAmount) : '—'}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">Due {formatBillDate(latestBill?.dueDate ?? null)}</p>
                                </div>

                                <div className="pt-1 border-t border-border/50 space-y-1.5">
                                    {[
                                        { label: 'Billing cycle', value: 'Monthly' },
                                        { label: 'Member since', value: overview?.institution.createdAt ? formatBillDate(overview.institution.createdAt) : '—' },
                                    ].map((row) => (
                                        <div key={row.label} className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">{row.label}</span>
                                            <span className="font-medium text-foreground">{row.value}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 pt-1">
                                    {latestPending ? (
                                        <>
                                            <button
                                                onClick={handlePayNow}
                                                disabled={payNowLoading}
                                                className="w-full text-xs font-semibold py-2.5 rounded-xl text-white hover:opacity-90 transition-all disabled:opacity-60"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                {payNowLoading ? 'Redirecting…' : 'Pay Now'}
                                            </button>
                                            <button
                                                onClick={() => router.push('/admin/support/tickets')}
                                                className="w-full text-xs font-medium py-2 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                                                Already Paid? Notify Us
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                disabled
                                                className="w-full text-xs font-semibold py-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 cursor-default">
                                                ✅ Already Paid
                                            </button>
                                            <button
                                                onClick={() => router.push('/admin/support/tickets')}
                                                className="w-full text-xs font-medium py-2 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                                                Contact Support
                                            </button>
                                        </>
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
                                        {billsLoading ? (
                                            [0, 1, 2].map(i => (
                                                <div key={i} className="flex items-center justify-between px-5 py-3">
                                                    <div className="space-y-1.5">
                                                        <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                                                        <div className="h-2.5 w-28 rounded bg-muted/30 animate-pulse" />
                                                    </div>
                                                    <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
                                                </div>
                                            ))
                                        ) : bills.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                                                <Receipt className="w-8 h-8 text-muted-foreground/30" />
                                                <p className="text-xs font-medium text-muted-foreground">No bills yet</p>
                                            </div>
                                        ) : bills.map((inv, idx) => (
                                            <div key={inv.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-semibold">{inv.billingMonth ?? inv.type}</p>
                                                        {idx === 0 && (
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">New</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">Due {formatBillDate(inv.dueDate)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold">{formatBillAmount(inv.totalAmount)}</p>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                                        {inv.status.toLowerCase()}
                                                    </span>
                                                    <button onClick={() => setBillModal(inv)}
                                                        className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                                        View
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
                                        {hasBankDetails && (
                                            <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2.5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
                                                        <Landmark className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                                                    </div>
                                                    <p className="text-xs font-semibold">Bank Transfer</p>
                                                </div>
                                                {[
                                                    { label: 'Account Name', value: paymentSettings?.bankAccountName },
                                                    { label: 'Account No.', value: paymentSettings?.bankAccountNumber },
                                                    { label: 'IFSC Code', value: paymentSettings?.bankIfsc },
                                                    { label: 'Bank', value: paymentSettings?.bankName },
                                                ].filter(row => row.value).map((row) => (
                                                    <div key={row.label} className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">{row.label}</span>
                                                        <span className="font-semibold text-foreground font-mono">{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* QR Code */}
                                        {paymentSettings?.upiId && (
                                            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                                        <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                    </div>
                                                    <p className="text-xs font-semibold">UPI / QR Code</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-24 h-24 bg-white rounded-xl flex items-center justify-center border border-border/50 shrink-0 overflow-hidden">
                                                        {qrDataUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={qrDataUrl} alt="UPI payment QR code" className="w-full h-full object-contain" />
                                                        ) : (
                                                            <QrCode size={48} className="text-muted-foreground/30" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs text-muted-foreground">Scan to pay via UPI</p>
                                                        <p className="text-xs font-semibold font-mono text-foreground">{paymentSettings.upiId}</p>
                                                        <p className="text-[11px] text-muted-foreground">After payment, share screenshot with support</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {!hasBankDetails && !paymentSettings?.upiId && (
                                            <div className="flex flex-col items-center justify-center py-8 text-center gap-2 bg-muted/20 rounded-xl border border-border/40">
                                                <Landmark className="w-8 h-8 text-muted-foreground/30" />
                                                <p className="text-xs font-medium text-muted-foreground">Manual payment details not set up yet</p>
                                                <p className="text-[11px] text-muted-foreground/60">Use online payment below, or contact support</p>
                                            </div>
                                        )}

                                        {/* Payment Gateway */}
                                        <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center">
                                                    <CreditCard className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                                </div>
                                                <p className="text-xs font-semibold">Online Payment</p>
                                            </div>
                                            {latestPending ? (
                                                <div className="flex flex-col gap-2">
                                                    <p className="text-[11px] text-muted-foreground">Pay via card, UPI, or netbanking securely via Razorpay.</p>
                                                    <button
                                                        onClick={handlePayNow}
                                                        disabled={payNowLoading}
                                                        className="w-full text-xs font-semibold py-2.5 rounded-xl text-white hover:opacity-90 transition-all disabled:opacity-60"
                                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                        {payNowLoading ? 'Redirecting to Razorpay…' : `Pay ${formatBillAmount(latestPending.totalAmount)} via Razorpay`}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-4 gap-2">
                                                    <CheckCircle2 size={28} className="text-emerald-500/60" />
                                                    <p className="text-xs text-muted-foreground">No pending bills</p>
                                                    <p className="text-[11px] text-muted-foreground/60">All bills are paid</p>
                                                </div>
                                            )}
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
                                    <h3 className="text-base font-bold">Invoice — {formatBillDate(billModal.billingMonth)}</h3>
                                    <p className="text-[11px] text-muted-foreground">Due {formatBillDate(billModal.dueDate)}</p>
                                </div>
                                <button onClick={() => setBillModal(null)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-bold">{overview?.institution.name ?? 'Your Institution'}</p>
                                        <p className="text-[11px] text-muted-foreground">{currentPlan} Plan</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-muted-foreground">Plan</p>
                                        <p className="text-sm font-bold" style={{ color: currentPlan === 'PRO' ? '#DA7756' : '#7C3AED' }}>
                                            {currentPlan}
                                        </p>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${billModal.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                            {billModal.status.toLowerCase()}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-px bg-border/50" />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium">Monthly User Bill</p>
                                        <p className="text-[11px] text-muted-foreground">{billedUsers} users × ₹{currentRate}/user</p>
                                    </div>
                                    <p className="text-xs font-bold">{formatBillAmount(billModal.totalAmount)}</p>
                                </div>
                                <div className="h-px bg-border/50" />
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold">Total Amount</p>
                                    <p className="text-lg font-black" style={{ color: '#DA7756' }}>{formatBillAmount(billModal.totalAmount)}</p>
                                </div>
                                <p className="text-[11px] text-muted-foreground">Due {formatBillDate(billModal.dueDate)}</p>
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