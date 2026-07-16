'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useStudentStore } from '@/store/studentStore';
import {
    IndianRupee, Award, ChevronRight, Bell, Settings, LogOut, User,
} from 'lucide-react';
import { FlagItem } from '@/lib/flags';
import StudentProfileView, { ProfileViewMarksheet, ProfileViewAttendance } from '@/components/shared/StudentProfileView';

const FEE_MONTHS_PROFILE = [
    { month: 'June', dueDate: '10 Jun 2025', amount: 6700, status: 'PAID' as const, paidDate: '8 Jun 2025' },
    { month: 'July', dueDate: '10 Jul 2025', amount: 6700, status: 'PAID' as const, paidDate: '9 Jul 2025' },
    { month: 'August', dueDate: '10 Aug 2025', amount: 6700, status: 'PAID' as const, paidDate: '7 Aug 2025' },
    { month: 'September', dueDate: '10 Sep 2025', amount: 6700, status: 'PAID' as const, paidDate: '9 Sep 2025' },
    { month: 'October', dueDate: '10 Oct 2025', amount: 6700, status: 'PAID' as const, paidDate: '8 Oct 2025' },
    { month: 'November', dueDate: '10 Nov 2025', amount: 6700, status: 'PAID' as const, paidDate: '10 Nov 2025' },
    { month: 'December', dueDate: '10 Dec 2025', amount: 6700, status: 'PAID' as const, paidDate: '9 Dec 2025' },
    { month: 'January', dueDate: '10 Jan 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'February', dueDate: '10 Feb 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'March', dueDate: '10 Mar 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'April', dueDate: '10 Apr 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'May', dueDate: '10 May 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
];
const TERM1_MONTHS = ['June', 'July', 'August', 'September', 'October'];
const TERM2_MONTHS = ['November', 'December', 'January', 'February', 'March', 'April', 'May'];
const term1 = FEE_MONTHS_PROFILE.filter(m => TERM1_MONTHS.includes(m.month));
const term2 = FEE_MONTHS_PROFILE.filter(m => TERM2_MONTHS.includes(m.month));
const termData = [
    { label: 'Term 1', range: 'June – October', months: term1 },
    { label: 'Term 2', range: 'November – May', months: term2 },
];

const ACHIEVEMENTS = [
    { icon: '🏆', title: 'Top 5 Overall', desc: 'Ranked 4th in batch', date: 'Mar 2025' },
    { icon: '🎯', title: 'Perfect Score', desc: '100% in DBMS Quiz 1', date: 'Jan 2025' },
    { icon: '📜', title: 'Hackathon Winner', desc: 'Smart India Hackathon 2024', date: 'Dec 2024' },
];

function SectionCard({ title, icon: Icon, iconColor, children, action }: {
    title: string; icon: React.ElementType; iconColor: string;
    children: React.ReactNode; action?: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden h-full">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 bg-muted/20 flex-wrap gap-2 lg:px-5">
                <div className="flex items-center gap-2 flex-wrap">
                    <Icon size={15} style={{ color: iconColor }} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                </div>
                {action}
            </div>
            <div className="p-4 lg:p-5">{children}</div>
        </div>
    );
}

export default function StudentProfile() {
    const router = useRouter();
    const student = useStudentStore();

    useEffect(() => {
        student.fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [marksheetData, setMarksheetData] = useState<ProfileViewMarksheet | null>(null);
    useEffect(() => {
        api.get('/student/marksheet').then(r => setMarksheetData(r.data.data)).catch(() => {});
    }, []);

    const [attendanceApiData, setAttendanceApiData] = useState<ProfileViewAttendance | null>(null);
    useEffect(() => {
        api.get('/student/attendance').then(r => setAttendanceApiData(r.data.data)).catch(() => {});
    }, []);

    const [flags, setFlags] = useState<FlagItem[]>([]);
    useEffect(() => {
        api.get('/student/remarks')
            .then(res => setFlags(res.data.data))
            .catch(() => setFlags([]));
    }, []);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="shrink-0 px-1 pb-3">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <User size={21} /> Profile
                </h1>
                <p className="text-[13px] text-muted-foreground">Your personal &amp; academic details</p>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pb-8 px-1">
                <StudentProfileView
                    standalone={false}
                    institutionName={student.institutionName}
                    studentName={student.name}
                    studentIdCode={student.studentId}
                    standard={student.standard}
                    division={student.division}
                    rollNo={student.rollNo}
                    admissionYear={student.admissionYear}
                    dob={student.dob}
                    email={student.email}
                    photo={student.photo}
                    marksheetData={marksheetData}
                    attendanceApiData={attendanceApiData}
                    flags={flags}
                    onViewDetail={() => router.push('/student/detail')}
                    onViewReportCard={() => router.push('/student/reportcard')}
                    onViewAttendanceDetails={() => router.push('/student/attendance')}
                    onViewAllFlags={() => router.push('/student/flags')}
                />

                {/* ── Fees ── */}
                <SectionCard title="Fees" icon={IndianRupee} iconColor="#10B981"
                    action={
                        <button onClick={() => router.push('/student/fees')} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                            <span className="leading-none">Pay Fees</span>
                            <ChevronRight size={12} />
                        </button>
                    }>

                    <div className="space-y-2.5 mb-4">
                        {termData.map((term) => {
                            const paid = term.months.filter(m => m.status === 'PAID').length;
                            const total = term.months.length;
                            const pct = Math.round((paid / total) * 100);
                            const cleared = paid === total;
                            return (
                                <div key={term.label} className="p-3 bg-muted/40 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-semibold">{term.label}</span>
                                            <span className="text-[10px] text-muted-foreground ml-1.5">{term.range}</span>
                                        </div>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cleared ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : paid === 0 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                            {cleared ? '✅ Paid' : `${paid}/${total} paid`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%`, backgroundColor: cleared ? '#10B981' : '#F59E0B' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="rounded-xl border border-border/40 overflow-x-auto">
                        <div className="min-w-[420px] lg:min-w-0">
                            <table className="text-xs w-full" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '18%' }} />
                                    <col style={{ width: '16%' }} />
                                    <col style={{ width: '22%' }} />
                                    <col style={{ width: '22%' }} />
                                    <col style={{ width: '22%' }} />
                                </colgroup>
                                <thead>
                                    <tr className="bg-card border-b border-border/30">
                                        {['Month', 'Amount', 'Due Date', 'Paid Date', 'Status'].map((col, i) => (
                                            <th key={i} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                            </table>
                            <div className="overflow-y-auto max-h-[344px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent', willChange: 'transform', transform: 'translateZ(0)' }}>
                                <table className="text-xs w-full" style={{ tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '16%' }} />
                                        <col style={{ width: '22%' }} />
                                        <col style={{ width: '22%' }} />
                                        <col style={{ width: '22%' }} />
                                    </colgroup>
                                    <tbody className="divide-y divide-border/20">
                                        {FEE_MONTHS_PROFILE.map((m, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2 font-semibold text-[11px]">{m.month}</td>
                                                <td className="px-3 py-2 text-[11px]">₹{m.amount.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.dueDate}</td>
                                                <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.paidDate ?? '—'}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                                        {m.status === 'PAID' ? '✓ Paid' : '⏳ Pending'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Achievements ─ */}
                <SectionCard title="Projects & Achievements" icon={Award} iconColor="#F59E0B"
                    action={
                        <span className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted text-muted-foreground cursor-default select-none">
                            Coming Soon
                        </span>
                    }>
                    <div className="space-y-2.5">
                        {ACHIEVEMENTS.map((a, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
                                <span className="text-2xl">{a.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold">{a.title}</p>
                                    <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">{a.date}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-900/50 flex items-center gap-2">
                        <User size={13} className="text-violet-500 shrink-0" />
                        <p className="text-[11px] text-violet-600 dark:text-violet-400">Share your projects & certificates to build your academic profile</p>
                    </div>
                </SectionCard>

                {/* ── Settings ── */}
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Settings</p>
                    {[
                        { icon: Bell, label: 'Notifications', color: '#2563EB' },
                        { icon: Settings, label: 'App Settings', color: '#7C3AED' },
                    ].map(({ icon: Icon, label, color }) => (
                        <button key={label}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: color + '20' }}>
                                <Icon size={16} style={{ color }} />
                            </div>
                            <span className="flex-1 text-sm font-medium text-left">{label}</span>
                            <ChevronRight size={15} className="text-muted-foreground" />
                        </button>
                    ))}

                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-950">
                            <LogOut size={16} className="text-red-500" />
                        </div>
                        <span className="flex-1 text-sm font-medium text-red-500 text-left">Logout</span>
                        <ChevronRight size={15} className="text-red-400" />
                    </button>
                </div>

                {/* Watermark */}
                <div className="text-center py-2 space-y-0.5">
                    <p className="text-sm font-semibold text-muted-foreground/60">QubeEx v1.0</p>
                    <p className="text-xs text-muted-foreground/50">© 2026 All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
