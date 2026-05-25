'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { AdminOverview } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import {
    Users, GraduationCap, BookOpen, AlertCircle, RefreshCw, BarChart2,
    Sparkles, Clock, Layers, Wallet, ChevronRight, ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// ── Palette ───────────────────────────────────────────────────────────────────
const VIOLET = '#7C3AED';
const AMBER = '#D97706';
const EMERALD = '#059669';
const SKY = '#0284C7';

// ── Mock fee data ─────────────────────────────────────────────────────────────
const MOCK_FEE_DATA = [
    {
        id: 's1', name: 'Class 10', divisions: [
            { id: 'd1', name: '10-A', paid: 28, pending: 4, total: 32 },
            { id: 'd2', name: '10-B', paid: 22, pending: 6, total: 28 },
            { id: 'd3', name: '10-C', paid: 20, pending: 5, total: 25 },
        ],
    },
    {
        id: 's2', name: 'Class 9', divisions: [
            { id: 'd4', name: '9-A', paid: 26, pending: 4, total: 30 },
            { id: 'd5', name: '9-B', paid: 20, pending: 7, total: 27 },
            { id: 'd6', name: '9-C', paid: 24, pending: 6, total: 30 },
        ],
    },
    {
        id: 's3', name: 'Class 8', divisions: [
            { id: 'd7', name: '8-A', paid: 27, pending: 3, total: 30 },
            { id: 'd8', name: '8-B', paid: 22, pending: 8, total: 30 },
            { id: 'd9', name: '8-C', paid: 25, pending: 5, total: 30 },
        ],
    },
    {
        id: 's4', name: 'Class 7', divisions: [
            { id: 'd10', name: '7-A', paid: 24, pending: 6, total: 30 },
            { id: 'd11', name: '7-B', paid: 20, pending: 8, total: 28 },
            { id: 'd12', name: '7-C', paid: 26, pending: 4, total: 30 },
        ],
    },
    {
        id: 's5', name: 'Class 6', divisions: [
            { id: 'd13', name: '6-A', paid: 23, pending: 5, total: 28 },
            { id: 'd14', name: '6-B', paid: 19, pending: 7, total: 26 },
            { id: 'd15', name: '6-C', paid: 25, pending: 3, total: 28 },
        ],
    },
    {
        id: 's6', name: 'Class 5', divisions: [
            { id: 'd16', name: '5-A', paid: 22, pending: 6, total: 28 },
            { id: 'd17', name: '5-B', paid: 18, pending: 8, total: 26 },
            { id: 'd18', name: '5-C', paid: 24, pending: 4, total: 28 },
        ],
    },
    {
        id: 's7', name: 'Class 4', divisions: [
            { id: 'd19', name: '4-A', paid: 25, pending: 3, total: 28 },
            { id: 'd20', name: '4-B', paid: 20, pending: 6, total: 26 },
            { id: 'd21', name: '4-C', paid: 26, pending: 2, total: 28 },
        ],
    },
    {
        id: 's8', name: 'Class 3', divisions: [
            { id: 'd22', name: '3-A', paid: 21, pending: 7, total: 28 },
            { id: 'd23', name: '3-B', paid: 24, pending: 4, total: 28 },
            { id: 'd24', name: '3-C', paid: 18, pending: 8, total: 26 },
        ],
    },
    {
        id: 's9', name: 'Class 2', divisions: [
            { id: 'd25', name: '2-A', paid: 23, pending: 5, total: 28 },
            { id: 'd26', name: '2-B', paid: 20, pending: 6, total: 26 },
            { id: 'd27', name: '2-C', paid: 25, pending: 3, total: 28 },
        ],
    },
    {
        id: 's10', name: 'Class 1', divisions: [
            { id: 'd28', name: '1-A', paid: 22, pending: 6, total: 28 },
            { id: 'd29', name: '1-B', paid: 19, pending: 7, total: 26 },
            { id: 'd30', name: '1-C', paid: 24, pending: 4, total: 28 },
        ],
    },
];

// ── Mock attendance data ──────────────────────────────────────────────────────
const MOCK_ATTENDANCE_DATA = [
    {
        id: 's1', name: 'Class 10', divisions: [
            { id: 'd1', name: '10-A', present: 29, absent: 3, total: 32 },
            { id: 'd2', name: '10-B', present: 24, absent: 4, total: 28 },
            { id: 'd3', name: '10-C', present: 22, absent: 3, total: 25 },
        ],
    },
    {
        id: 's2', name: 'Class 9', divisions: [
            { id: 'd4', name: '9-A', present: 27, absent: 3, total: 30 },
            { id: 'd5', name: '9-B', present: 22, absent: 5, total: 27 },
            { id: 'd6', name: '9-C', present: 26, absent: 4, total: 30 },
        ],
    },
    {
        id: 's3', name: 'Class 8', divisions: [
            { id: 'd7', name: '8-A', present: 28, absent: 2, total: 30 },
            { id: 'd8', name: '8-B', present: 23, absent: 7, total: 30 },
            { id: 'd9', name: '8-C', present: 26, absent: 4, total: 30 },
        ],
    },
    {
        id: 's4', name: 'Class 7', divisions: [
            { id: 'd10', name: '7-A', present: 25, absent: 5, total: 30 },
            { id: 'd11', name: '7-B', present: 21, absent: 7, total: 28 },
            { id: 'd12', name: '7-C', present: 27, absent: 3, total: 30 },
        ],
    },
    {
        id: 's5', name: 'Class 6', divisions: [
            { id: 'd13', name: '6-A', present: 24, absent: 4, total: 28 },
            { id: 'd14', name: '6-B', present: 20, absent: 6, total: 26 },
            { id: 'd15', name: '6-C', present: 26, absent: 2, total: 28 },
        ],
    },
    {
        id: 's6', name: 'Class 5', divisions: [
            { id: 'd16', name: '5-A', present: 23, absent: 5, total: 28 },
            { id: 'd17', name: '5-B', present: 19, absent: 7, total: 26 },
            { id: 'd18', name: '5-C', present: 25, absent: 3, total: 28 },
        ],
    },
    {
        id: 's7', name: 'Class 4', divisions: [
            { id: 'd19', name: '4-A', present: 26, absent: 2, total: 28 },
            { id: 'd20', name: '4-B', present: 21, absent: 5, total: 26 },
            { id: 'd21', name: '4-C', present: 27, absent: 1, total: 28 },
        ],
    },
    {
        id: 's8', name: 'Class 3', divisions: [
            { id: 'd22', name: '3-A', present: 22, absent: 6, total: 28 },
            { id: 'd23', name: '3-B', present: 25, absent: 3, total: 28 },
            { id: 'd24', name: '3-C', present: 19, absent: 7, total: 26 },
        ],
    },
    {
        id: 's9', name: 'Class 2', divisions: [
            { id: 'd25', name: '2-A', present: 24, absent: 4, total: 28 },
            { id: 'd26', name: '2-B', present: 21, absent: 5, total: 26 },
            { id: 'd27', name: '2-C', present: 26, absent: 2, total: 28 },
        ],
    },
    {
        id: 's10', name: 'Class 1', divisions: [
            { id: 'd28', name: '1-A', present: 23, absent: 5, total: 28 },
            { id: 'd29', name: '1-B', present: 20, absent: 6, total: 26 },
            { id: 'd30', name: '1-C', present: 25, absent: 3, total: 28 },
        ],
    },
];

// ── Mock AI data ──────────────────────────────────────────────────────────────
const MOCK_AI_TEACHERS = [
    { name: 'Ritu Sharma', used: 2.1, limit: 5 },
    { name: 'Ankit Verma', used: 3.8, limit: 5 },
    { name: 'Priya Nair', used: 1.2, limit: 5 },
    { name: 'Meena Patel', used: 4.6, limit: 5 },
    { name: 'Suresh Iyer', used: 0.8, limit: 5 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; iconBg: string; iconColor: string;
}) {
    return (
        <div className="bg-white dark:bg-muted/50 rounded-xl p-4 relative shadow-sm border border-border/50">
            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                <Icon size={15} className={iconColor} />
            </div>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className="text-3xl font-semibold tracking-tight">
                {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
    );
}

// ── Attendance Accordion ──────────────────────────────────────────────────────
function getAttendanceColor(pct: number) {
    if (pct >= 75) return {
        bar: 'linear-gradient(90deg, #10B981, #34D399)',
        text: 'text-emerald-500',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        dot: '#10B981',
        card: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/30',
    };
    if (pct >= 65) return {
        bar: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
        text: 'text-amber-500',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
        dot: '#F59E0B',
        card: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30',
    };
    return {
        bar: 'linear-gradient(90deg, #EF4444, #F87171)',
        text: 'text-red-500',
        badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
        dot: '#EF4444',
        card: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30',
    };
}

function AttendanceAccordion() {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>('s1');

    const activeClass = MOCK_ATTENDANCE_DATA.find(s => s.id === expandedId) ?? MOCK_ATTENDANCE_DATA[0];

    const chartData = activeClass.divisions.map(d => ({
        name: d.name,
        attendance: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
    }));

    const totalPresent = MOCK_ATTENDANCE_DATA.reduce((s, c) => s + c.divisions.reduce((a, d) => a + d.present, 0), 0);
    const totalStudents = MOCK_ATTENDANCE_DATA.reduce((s, c) => s + c.divisions.reduce((a, d) => a + d.total, 0), 0);
    const overallPct = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
    const overallColor = getAttendanceColor(overallPct);

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
                <Users size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold">Attendance Analysis</p>
                <div className="ml-auto flex items-center gap-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${overallColor.badge}`}>
                        {overallPct}% overall
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 min-h-[360px]">

                {/* Left — Accordion */}
                <div className="lg:col-span-2 divide-y divide-border/30 overflow-y-auto max-h-[400px] border-b lg:border-b-0 lg:border-r border-border/40">
                    {MOCK_ATTENDANCE_DATA.map((std) => {
                        const isOpen = expandedId === std.id;
                        const stdPresent = std.divisions.reduce((s, d) => s + d.present, 0);
                        const stdTotal = std.divisions.reduce((s, d) => s + d.total, 0);
                        const stdPct = stdTotal > 0 ? Math.round((stdPresent / stdTotal) * 100) : 0;
                        const stdColor = getAttendanceColor(stdPct);

                        return (
                            <div key={std.id}>
                                <button
                                    onClick={() => setExpandedId(isOpen ? null : std.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isOpen ? 'bg-muted/30' : 'hover:bg-muted/20'}`}>
                                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={14} className="text-muted-foreground" />
                                    </div>
                                    <span className="text-sm font-semibold flex-1">{std.name}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${stdPct}%`, background: stdColor.bar }} />
                                        </div>
                                        <span className={`text-[11px] font-bold w-8 text-right ${stdColor.text}`}>
                                            {stdPct}%
                                        </span>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                            {std.divisions.map((div) => {
                                                const divPct = div.total > 0 ? Math.round((div.present / div.total) * 100) : 0;
                                                const divColor = getAttendanceColor(divPct);
                                                return (
                                                    <div key={div.id}
                                                        className="flex items-center gap-3 px-8 py-2 bg-muted/20 border-t border-border/20 hover:bg-muted/40 transition-colors">
                                                        <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">{div.name}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-500"
                                                                    style={{ width: `${divPct}%`, background: divColor.bar }} />
                                                            </div>
                                                        </div>
                                                        <span className={`text-[11px] font-bold shrink-0 w-8 text-right ${divColor.text}`}>
                                                            {divPct}%
                                                        </span>
                                                        <button
                                                            onClick={() => router.push(`/admin/campus/classes/${std.id}/${div.id}`)}
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-all"
                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                            <ArrowUpRight size={12} className="text-white" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>

                {/* Right — Line graph */}
                <div className="lg:col-span-3 p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-foreground">{activeClass.name}</p>
                            <p className="text-[11px] text-muted-foreground">Division-wise attendance</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0 border-t-2 border-dashed border-amber-400" />
                                <span className="text-[11px] text-muted-foreground">65%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0 border-t-2 border-dashed border-emerald-500" />
                                <span className="text-[11px] text-muted-foreground">75%</span>
                            </div>
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 500 }}
                                axisLine={false} tickLine={false} dy={8}
                                padding={{ left: 30, right: 30 }}
                            />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                axisLine={false} tickLine={false} domain={[50, 100]} unit="%" tickCount={6} />
                            <Tooltip
                                formatter={(v) => [`${v}%`, 'Attendance']}
                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                                cursor={{ stroke: 'var(--border)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                            />
                            <ReferenceLine y={75} stroke="#10B981" strokeDasharray="5 4" strokeWidth={1.5} />
                            <ReferenceLine y={65} stroke="#F59E0B" strokeDasharray="5 4" strokeWidth={1.5} />
                            <Line
                                type="monotone" dataKey="attendance" name="Attendance"
                                stroke="#7C3AED" strokeWidth={2.5}
                                dot={(props: any) => {
                                    const { cx, cy } = props;
                                    return (
                                        <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={6}
                                            fill="#7C3AED" stroke="var(--card)" strokeWidth={2.5} />
                                    );
                                }}
                                activeDot={{ r: 8, stroke: 'var(--card)', strokeWidth: 2.5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Division summary cards */}
                    <div className="grid grid-cols-3 gap-2">
                        {chartData.map((d) => {
                            const color = getAttendanceColor(d.attendance);
                            return (
                                <div key={d.name} className={`rounded-xl px-3 py-2 flex items-center justify-between border ${color.card}`}>
                                    <span className="text-xs font-semibold text-foreground">{d.name}</span>
                                    <span className={`text-xs font-bold ${color.text}`}>{d.attendance}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Fee Accordion ─────────────────────────────────────────────────────────────
function FeeAccordion() {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>('s1');

    const totalPaid = MOCK_FEE_DATA.reduce((s, c) => s + c.divisions.reduce((a, d) => a + d.paid, 0), 0);
    const totalPending = MOCK_FEE_DATA.reduce((s, c) => s + c.divisions.reduce((a, d) => a + d.pending, 0), 0);
    const totalFees = totalPaid + totalPending;
    const collectedPct = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;

    const donutData = [
        { name: 'Paid', value: totalPaid, color: '#10B981' },
        { name: 'Pending', value: totalPending, color: '#F59E0B' },
    ];

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
                <Wallet size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold">Fee Analysis</p>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {collectedPct}% paid
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        {100 - collectedPct}% pending
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5">
                {/* Donut */}
                <div className="lg:col-span-2 p-5 flex flex-col items-center justify-center gap-4 border-b lg:border-b-0 lg:border-r border-border/40">
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                            </Pie>
                            <Tooltip
                                formatter={(v) => `${v as number} students`}
                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full space-y-2">
                        {donutData.map((d) => (
                            <div key={d.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                    <span className="text-muted-foreground">{d.name}</span>
                                </div>
                                <span className="font-semibold text-foreground">{d.value} students</span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                            <span className="text-muted-foreground font-medium">Total</span>
                            <span className="font-bold text-foreground">{totalFees} students</span>
                        </div>
                    </div>
                </div>

                {/* Accordion */}
                <div className="lg:col-span-3 divide-y divide-border/30 max-h-[280px] overflow-y-auto">
                    {MOCK_FEE_DATA.map((std) => {
                        const isOpen = expandedId === std.id;
                        const stdPaid = std.divisions.reduce((s, d) => s + d.paid, 0);
                        const stdPending = std.divisions.reduce((s, d) => s + d.pending, 0);
                        const stdPct = (stdPaid + stdPending) > 0 ? Math.round((stdPaid / (stdPaid + stdPending)) * 100) : 0;

                        return (
                            <div key={std.id}>
                                <button onClick={() => setExpandedId(isOpen ? null : std.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={14} className="text-muted-foreground" />
                                    </div>
                                    <span className="text-sm font-semibold flex-1">{std.name}</span>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-[11px] text-emerald-500 font-medium">{stdPaid} paid</span>
                                        <span className="text-muted-foreground/40 text-[10px]">·</span>
                                        <span className="text-[11px] text-amber-500 font-medium">{stdPending} pending</span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stdPct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                            {stdPct}%
                                        </span>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                            {std.divisions.map((div) => {
                                                const divPct = div.total > 0 ? Math.round((div.paid / div.total) * 100) : 0;
                                                return (
                                                    <div key={div.id} className="flex items-center gap-3 px-8 py-2.5 bg-muted/20 border-t border-border/20 hover:bg-muted/40 transition-colors">
                                                        <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">{div.name}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-500"
                                                                    style={{
                                                                        width: `${divPct}%`,
                                                                        background: divPct >= 80
                                                                            ? 'linear-gradient(90deg, #10B981, #34D399)'
                                                                            : 'linear-gradient(90deg, #F59E0B, #FBBF24)',
                                                                    }} />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-[11px] text-emerald-500 font-medium">{div.paid} paid</span>
                                                            <span className="text-muted-foreground/40 text-[10px]">·</span>
                                                            <span className="text-[11px] text-amber-500 font-medium">{div.pending} pending</span>
                                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${divPct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                                                {divPct}%
                                                            </span>
                                                        </div>
                                                        <button onClick={() => router.push(`/admin/campus/classes/${std.id}/${div.id}?tab=fees`)}
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-all"
                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                            <ArrowUpRight size={12} className="text-white" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [teachers, setTeachers] = useState<{ status: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { instType } = useMockInstType();
    const fetchedRef = useRef(false);

    const fetchAll = async () => {
        setLoading(true);
        setError(false);
        try {
            const [ovRes, teachRes] = await Promise.allSettled([
                api.get('/admin/overview'),
                api.get('/admin/teachers'),
            ]);
            if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data.data);
            else setError(true);
            if (teachRes.status === 'fulfilled') setTeachers(teachRes.value.data.data ?? []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchAll();
    }, []);

    if (loading) {
        return (
            <div className="space-y-4 py-4">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        );
    }

    if (error || !overview) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <AlertCircle size={28} className="text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Could not load analytics</p>
                <Button variant="outline" size="sm" onClick={() => { fetchedRef.current = false; fetchAll(); }}
                    className="gap-1.5 mt-1">
                    <RefreshCw size={13} /> Retry
                </Button>
            </div>
        );
    }

    const { stats, plan } = overview;
    const activeTeachers = teachers.filter(t => t.status === 'ACTIVE').length;
    const inactiveTeachers = teachers.filter(t => t.status === 'INACTIVE').length;
    const instLabel = instType === 'SCHOOL' ? 'School' : instType === 'COLLEGE' ? 'College' : 'Coaching';

    const institutionTokensUsed = plan.usage.aiTokens.used;
    const institutionTokensLimit = plan.usage.aiTokens.limit;
    const tokenPct = institutionTokensLimit > 0
        ? Math.min(100, Math.round((institutionTokensUsed / institutionTokensLimit) * 100))
        : 0;

    return (
        <div className="space-y-3 pb-4">

            {/* ── Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex items-center justify-between px-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <BarChart2 size={21} />
                            Analytics
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {overview.institution.name}
                        </p>
                    </div>
                    <Button variant="outline" size="icon"
                        onClick={() => { fetchedRef.current = false; fetchAll(); }} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard icon={Users} label="Total Users" value={stats.totalUsers}
                    iconBg="bg-violet-100 dark:bg-violet-950" iconColor="text-violet-600 dark:text-violet-400"
                    sub={`${plan.usage.users.limit.toLocaleString('en-IN')} limit`} />
                <StatCard icon={GraduationCap} label="Students" value={stats.totalStudents}
                    iconBg="bg-emerald-100 dark:bg-emerald-950" iconColor="text-emerald-600 dark:text-emerald-400"
                    sub="Enrolled students" />
                <StatCard icon={BookOpen} label="Teachers" value={stats.totalTeachers}
                    iconBg="bg-amber-100 dark:bg-amber-950" iconColor="text-amber-600 dark:text-amber-400"
                    sub={`${activeTeachers} active · ${inactiveTeachers} inactive`} />
                <StatCard icon={Layers} label="Classes" value={stats.totalClasses}
                    iconBg="bg-sky-100 dark:bg-sky-950" iconColor="text-sky-600 dark:text-sky-400"
                    sub="Configured in campus" />
                <StatCard icon={Wallet} label="Plan" value={plan.name.toUpperCase()}
                    iconBg="bg-rose-100 dark:bg-rose-950" iconColor="text-rose-600 dark:text-rose-400"
                    sub={`${plan.usage.users.used} users used`} />
            </div>

            {/* ── Plan Usage + AI Usage side by side ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* Plan Usage */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Current plan</p>
                            <p className="text-lg font-semibold">{plan.name}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                            {plan.name.toUpperCase()}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { label: 'Users', used: plan.usage.users.used, limit: plan.usage.users.limit },
                            { label: 'Storage (MB)', used: plan.usage.storage.used, limit: plan.usage.storage.limit },
                            { label: 'Tests', used: plan.usage.tests.used, limit: plan.usage.tests.limit },
                        ].map((b) => {
                            const pct = Math.min(100, Math.round((b.used / b.limit) * 100));
                            const overLimit = b.used >= b.limit;
                            return (
                                <div key={b.label}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs text-muted-foreground">{b.label}</span>
                                        <span className="text-xs font-medium">
                                            {b.used.toLocaleString('en-IN')} <span className="text-muted-foreground">/ {b.limit.toLocaleString('en-IN')}</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${overLimit ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                            style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* AI Usage */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Institution token pool</p>
                            <p className="text-lg font-semibold">
                                {institutionTokensUsed}
                                <span className="text-sm font-normal text-muted-foreground"> / {institutionTokensLimit} tokens</span>
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                            <Sparkles size={15} className="text-violet-600 dark:text-violet-400" />
                        </div>
                    </div>

                    {/* Pool bar */}
                    <div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${tokenPct}%`,
                                    background: 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                                }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{tokenPct}% used</p>
                    </div>

                    {/* Per teacher */}
                    <div className="space-y-2.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Per teacher</p>
                        {MOCK_AI_TEACHERS.map((t) => {
                            const pct = (t.used / t.limit) * 100;
                            const isCritical = pct >= 90;
                            return (
                                <div key={t.name} className="flex items-center gap-2.5">
                                    <div className="w-6 h-6 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                                        <span className="text-[9px] font-bold text-violet-400">
                                            {t.name.split(' ').map(n => n[0]).join('')}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[11px] font-medium text-foreground truncate">{t.name}</span>
                                            <span className={`text-[10px] font-semibold shrink-0 ml-2 ${isCritical ? 'text-[#DA7756]' : 'text-muted-foreground'}`}>
                                                {t.used}M/{t.limit}M
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${pct}%`,
                                                    background: isCritical
                                                        ? 'linear-gradient(90deg, #DA7756, #C06040)'
                                                        : 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                                                }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Fee Analysis ── */}
            <FeeAccordion />

            {/* ── Attendance Analysis ── */}
            <AttendanceAccordion />

            {/* ── Open tickets ── */}
            {overview.tickets.length > 0 && (
                <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">Open Support Tickets</p>
                        <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            {overview.tickets.length} active
                        </span>
                    </div>
                    <div className="space-y-2">
                        {overview.tickets.map(ticket => (
                            <div key={ticket.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ticket.status === 'OPEN' ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-amber-100 dark:bg-amber-950/40'}`}>
                                    {ticket.status === 'OPEN'
                                        ? <AlertCircle size={13} className="text-blue-600" />
                                        : <Clock size={13} className="text-amber-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{ticket.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{ticket.category} · {ticket.priority}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ticket.status === 'OPEN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                    {ticket.status}
                                </span>
                                <p className="text-[10px] text-muted-foreground shrink-0">{ticket.createdAt}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}