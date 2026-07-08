'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FlagItem } from '@/lib/flags';
import { User, Calendar, MapPin, Users as UsersIcon, BarChart2, ShieldAlert, Phone, Droplet, Trophy, Star } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, LabelList,
    AreaChart, Area, ReferenceLine,
} from 'recharts';

export interface ProfileGuardian { name: string; number: string; relation: string }

export interface ProfileStudent {
    id: string;
    studentId: string;
    avatarUrl: string | null;
    user: { name: string | null; email: string };
    rollNo: string | null;
    phone: string | null;
    dob: string | null;
    gender: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    bloodGroup: string | null;
    religion: string | null;
    category: string | null;
    guardians: ProfileGuardian[] | null;
    status: string;
    hasLoggedIn: boolean;
}

export interface ProfileMarksheetSubject { id: string; name: string; code: string; color: string | null; total: { scored: number; max: number }; pct: number | null; grade: string }

export interface ProfileMarksheet {
    academicYear: string;
    subjects: ProfileMarksheetSubject[];
    grandTotal: { scored: number; max: number };
    grandPct: number | null;
    grade: string;
    classRank: number | null;
    classSize: number;
}

export interface ProfileAttendanceMonth { month: string; pct: number | null }

export interface ProfileAttendanceTrend {
    overall: { pct: number | null };
    monthly: ProfileAttendanceMonth[];
}

const SUBJECT_COLORS = ['#DA7756', '#EC4899', '#0891B2', '#7C3AED', '#059669', '#0EA5E9', '#6366F1', '#D97706', '#16A34A', '#E11D48'];

interface StudentProfileModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: ProfileStudent;
    divisionLabel: string;
    fetchMarksheet: () => Promise<ProfileMarksheet | null>;
    fetchRemarks: () => Promise<FlagItem[]>;
    fetchAttendanceTrend: () => Promise<ProfileAttendanceTrend>;
}

function getInitials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function Section({ icon: Icon, title, children, action }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="border border-border/50 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Icon size={13} className="text-muted-foreground" />
                    <p className="text-xs font-semibold">{title}</p>
                </div>
                {action}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-xs font-medium mt-0.5">{value?.trim() ? value : '—'}</p>
        </div>
    );
}

const AngledTick = (props: unknown) => {
    const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} dy={8} textAnchor="end" fill="var(--muted-foreground)" fontSize={10} transform="rotate(-35)">{payload?.value}</text>
        </g>
    );
};

export default function StudentProfileModal({ open, onOpenChange, student, divisionLabel, fetchMarksheet, fetchRemarks, fetchAttendanceTrend }: StudentProfileModalProps) {
    const [marksheet, setMarksheet] = useState<ProfileMarksheet | null | undefined>(undefined);
    const [remarks, setRemarks] = useState<FlagItem[] | null>(null);
    const [trend, setTrend] = useState<ProfileAttendanceTrend | null>(null);

    useEffect(() => {
        if (!open) return;
        setMarksheet(undefined);
        setRemarks(null);
        setTrend(null);
        fetchMarksheet().then(setMarksheet).catch(() => setMarksheet(null));
        fetchRemarks().then(setRemarks).catch(() => setRemarks([]));
        fetchAttendanceTrend().then(setTrend).catch(() => setTrend({ overall: { pct: null }, monthly: [] }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, student.id]);

    const name = student.user.name ?? '—';

    const chartData = useMemo(() => (marksheet?.subjects ?? []).map((s, i) => ({
        name: s.name,
        pct: s.pct ?? 0,
        color: s.color ?? SUBJECT_COLORS[i % SUBJECT_COLORS.length],
    })), [marksheet]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="p-0 gap-0 bg-card flex flex-col"
                style={{ width: '90vw', maxWidth: '720px', maxHeight: '88vh' }}
            >
                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden bg-primary">
                        {student.avatarUrl
                            ? <img src={student.avatarUrl} alt={name} className="w-full h-full object-cover" />
                            : getInitials(name)}
                    </div>
                    <div className="min-w-0">
                        <DialogTitle className="text-base font-semibold truncate">{name}</DialogTitle>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {student.studentId}{student.rollNo ? ` · Roll ${student.rollNo}` : ''} · {divisionLabel}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-3">

                    {/* Rank + Score */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/20 border border-border/40 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Trophy size={13} className="text-amber-500" />
                                <p className="text-[11px] font-semibold text-muted-foreground">Overall Rank</p>
                            </div>
                            <p className="text-2xl font-black">
                                {marksheet === undefined ? '…' : marksheet?.classRank != null ? `#${marksheet.classRank}` : '—'}
                            </p>
                        </div>
                        <div className="bg-muted/20 border border-border/40 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Star size={13} className="text-amber-500 fill-amber-500" />
                                <p className="text-[11px] font-semibold text-muted-foreground">Overall Score</p>
                            </div>
                            <p className="text-2xl font-black text-violet-600 dark:text-violet-400">
                                {marksheet === undefined ? '…' : marksheet?.grandPct != null ? `${marksheet.grandPct}%` : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Subject Performance chart */}
                    <Section icon={BarChart2} title="Subject Performance">
                        {marksheet === undefined ? (
                            <p className="text-xs text-muted-foreground">Loading...</p>
                        ) : chartData.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-6 text-center">No results published yet.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={chartData} margin={{ top: 16, bottom: 56, left: 0, right: 8 }}>
                                    <defs>
                                        {chartData.map((d, i) => (
                                            <linearGradient key={i} id={`profileSubjGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                                                <stop offset="100%" stopColor={d.color} stopOpacity={0.45} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                                    <XAxis dataKey="name" tick={AngledTick} interval={0} axisLine={false} tickLine={false} height={70} />
                                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[0, 100]} width={32} />
                                    <Tooltip
                                        cursor={false}
                                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: 'var(--card-foreground)', fontWeight: 600 }}
                                        itemStyle={{ color: 'var(--card-foreground)' }}
                                        formatter={(value: unknown) => [`${value}%`, 'Score']}
                                    />
                                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="pct" position="top" formatter={(v: unknown) => `${v}%`}
                                            style={{ fontSize: 10, fontWeight: 600, fill: 'var(--foreground)' }} />
                                        {chartData.map((d, i) => <Cell key={i} fill={`url(#profileSubjGrad-${i})`} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Section>

                    {/* Attendance trend chart */}
                    <Section icon={Calendar} title="Attendance Trend">
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50 flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Overall Attendance</span>
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                {trend === null ? '…' : trend.overall.pct !== null ? `${trend.overall.pct}%` : '—'}
                            </span>
                        </div>
                        {trend === null ? (
                            <p className="text-xs text-muted-foreground">Loading...</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={trend.monthly.map(m => ({ month: m.month, value: m.pct ?? 0 }))} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="profileAttendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                    {trend.monthly.map((d) => (
                                        <ReferenceLine key={d.month} x={d.month} stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                                    ))}
                                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                                        labelStyle={{ color: 'var(--card-foreground)' }}
                                        formatter={(val: unknown) => [`${val}%`, 'Attendance']}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} fill="url(#profileAttendGrad)" dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </Section>

                    <Section icon={User} title="Personal Info">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Date of Birth" value={student.dob} />
                            <Field label="Gender" value={student.gender} />
                            <Field label="Religion" value={student.religion} />
                            <Field label="Category" value={student.category} />
                        </div>
                    </Section>

                    <Section icon={Phone} title="Contact">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Phone" value={student.phone} />
                            <Field label="Email" value={student.user.email} />
                        </div>
                    </Section>

                    <Section icon={MapPin} title="Address">
                        <Field label="Address" value={[student.address, student.city, student.state, student.pincode, student.country].filter(Boolean).join(', ') || null} />
                    </Section>

                    <Section icon={Droplet} title="Medical">
                        <Field label="Blood Group" value={student.bloodGroup} />
                    </Section>

                    {student.guardians && student.guardians.length > 0 && (
                        <Section icon={UsersIcon} title="Guardians">
                            <div className="space-y-2">
                                {student.guardians.map((g, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <span className="font-medium">{g.name} <span className="text-muted-foreground font-normal">({g.relation})</span></span>
                                        <span className="text-muted-foreground">{g.number}</span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    <Section icon={ShieldAlert} title="Remarks — Flags & Warnings">
                        {remarks === null ? (
                            <p className="text-xs text-muted-foreground">Loading...</p>
                        ) : remarks.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No remarks — clean record.</p>
                        ) : (
                            <div className="space-y-2">
                                {remarks.map(flag => (
                                    <div key={flag.id} className={`p-2.5 rounded-lg border-l-[3px] ${flag.type === 'yellow' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-400' : 'bg-red-50 dark:bg-red-950/20 border-red-500'}`}>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold">{flag.title}</p>
                                            <span className="text-[9px] text-muted-foreground shrink-0 ml-2">{flag.date}</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{flag.category} · {flag.reportedBy}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>

                    <div className="flex items-center gap-2 px-1">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${student.hasLoggedIn ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <p className="text-xs text-muted-foreground">
                            {student.hasLoggedIn ? 'Active — student has logged in' : "Awaiting first login — student hasn't logged in yet"}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
