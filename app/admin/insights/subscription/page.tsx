'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Crown, CreditCard, Shield, CheckCircle2, XCircle,
    AlertTriangle, Download, ArrowUpRight, ChevronRight,
    Receipt, Sparkles, Zap, Users, Database, TicketIcon,
} from 'lucide-react';

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

const planFeatures = [
    { name: 'Student management', enabled: true },
    { name: 'Teacher management', enabled: true },
    { name: 'Attendance tracking', enabled: true },
    { name: 'Fee management', enabled: true },
    { name: 'AI assistant', enabled: true },
    { name: 'Custom reports', enabled: true },
    { name: 'Parent portal', enabled: false },
    { name: 'Advanced analytics', enabled: false },
    { name: 'Multi-branch', enabled: false },
    { name: 'API access', enabled: false },
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

function UsageBar({ icon: Icon, label, used, total, unit = '', accent = false }: {
    icon: React.ElementType; label: string; used: number; total: number; unit?: string; accent?: boolean;
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
                <span className={`font-semibold ${critical ? 'text-red-400' : warning ? 'text-[#DA7756]' : 'text-foreground'}`}>
                    {used}{unit} <span className="font-normal text-muted-foreground">/ {total}{unit}</span>
                </span>
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
                    <AlertTriangle className="w-3 h-3" /> Nearing limit
                </p>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubscriptionPage() {
    const [billingTab, setBillingTab] = useState<'invoices' | 'history'>('invoices');
    const currentPlan = 'PRO'; // TODO: from authStore

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
                    {currentPlan === 'PRO' ? (
                        <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-1.5">
                            <Crown className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-xs font-semibold text-violet-400">Pro Plan</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-[#DA7756]/10 border border-[#DA7756]/20 rounded-xl px-3 py-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#DA7756]" />
                            <span className="text-xs font-semibold text-[#DA7756]">Basic Plan</span>
                        </div>
                    )}
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="py-3 space-y-5">

                {/* ── Plan Summary Cards ── */}
                <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Current plan', value: 'Pro', sub: '₹4,999/month', icon: Crown, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                        { label: 'Next billing', value: 'Jun 1', sub: '2025', icon: Receipt, color: 'text-[#DA7756]', bg: 'bg-[#DA7756]/10' },
                        { label: 'Member since', value: 'Jan 2025', sub: '5 months', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Payment method', value: '•••• 4242', sub: 'Visa card', icon: CreditCard, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                    ].map((item) => (
                        <div key={item.label} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm shadow-black/5 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{item.label}</span>
                                <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                                    <item.icon className={`w-4 h-4 ${item.color}`} />
                                </div>
                            </div>
                            <div>
                                <p className="text-xl font-bold text-foreground tracking-tight">{item.value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* ── Plan Monitoring ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.08 }}>
                    <SectionHeader icon={Shield} title="Plan monitoring" subtitle="Current usage against your plan limits" />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                        {/* Usage bars */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 space-y-5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">Usage limits</p>
                                <span className="text-xs text-muted-foreground">Resets <span className="font-medium text-foreground">Jun 1, 2025</span></span>
                            </div>
                            <div className="space-y-4">
                                <UsageBar icon={Users} label="Students enrolled" used={524} total={600} />
                                <UsageBar icon={Users} label="Teachers / staff" used={38} total={50} />
                                <UsageBar icon={Database} label="Storage" used={3.8} total={5} unit=" GB" />
                                <UsageBar icon={Zap} label="AI tokens" used={14.5} total={50} unit=" M" />
                                <UsageBar icon={TicketIcon} label="Support tickets / month" used={9} total={10} />
                            </div>

                            {/* Warning nudge */}
                            <div className="flex items-center justify-between bg-[#DA7756]/8 border border-[#DA7756]/20 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-[#DA7756]" />
                                    <p className="text-xs text-[#DA7756] font-medium">Storage & tickets nearing limit</p>
                                </div>
                                <button className="text-xs font-semibold text-[#DA7756] flex items-center gap-1 hover:gap-2 transition-all">
                                    Upgrade <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Feature access */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Feature access</p>
                            <div className="space-y-2.5">
                                {planFeatures.map((f) => (
                                    <div key={f.name} className="flex items-center justify-between">
                                        <span className={`text-xs ${f.enabled ? 'text-foreground' : 'text-muted-foreground/50'}`}>{f.name}</span>
                                        {f.enabled
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            : <XCircle className="w-4 h-4 text-muted-foreground/30" />
                                        }
                                    </div>
                                ))}
                            </div>
                            <button className="mt-5 w-full text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-xl py-2.5 hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-2">
                                <ArrowUpRight className="w-3.5 h-3.5" /> Unlock all features
                            </button>
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
                                <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1">
                                    <Crown className="w-3 h-3 text-violet-400" />
                                    <span className="text-xs font-semibold text-violet-400">Pro</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">₹4,999<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
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
                                    Upgrade to Enterprise
                                </button>
                                <button className="w-full text-xs font-medium py-2 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                                    Cancel subscription
                                </button>
                            </div>
                        </div>

                        {/* Invoice + history */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            {/* Tab switcher */}
                            <div className="flex items-center gap-1 p-4 border-b border-border/50">
                                {(['invoices', 'history'] as const).map((tab) => (
                                    <button key={tab} onClick={() => setBillingTab(tab)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${billingTab === tab
                                            ? 'bg-violet-500/15 text-violet-400'
                                            : 'text-muted-foreground hover:text-foreground'}`}>
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