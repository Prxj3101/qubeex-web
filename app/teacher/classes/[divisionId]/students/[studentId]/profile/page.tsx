'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IndianRupee, Award, User, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import StudentProfileView, { ProfileViewMarksheet, ProfileViewAttendance } from '@/components/shared/StudentProfileView';
import PTMNotesCard from '@/components/shared/PTMNotesCard';
import { FlagItem } from '@/lib/flags';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TERM1_MONTHS = ['June', 'July', 'August', 'September', 'October'];
const TERM2_MONTHS = ['November', 'December', 'January', 'February', 'March', 'April', 'May'];

// Parses flexible free-text dates like "10 Aug 26", "Aug 10 2026", "10 August"
// (year defaults to current year if omitted) into a comparable Date.
function parseFlexDate(input: string | null | undefined): Date | null {
    if (!input) return null;
    const str = input.trim();
    if (!str) return null;
    const monthIdx = MONTHS.findIndex(m => new RegExp(`\\b${m.slice(0, 3)}`, 'i').test(str));
    if (monthIdx === -1) return null;
    const nums = str.match(/\d+/g);
    if (!nums || nums.length === 0) return null;
    const day = parseInt(nums[0], 10);
    if (Number.isNaN(day) || day < 1 || day > 31) return null;
    let year = new Date().getFullYear();
    if (nums.length > 1) {
        const y = parseInt(nums[1], 10);
        if (!Number.isNaN(y)) year = y < 100 ? 2000 + y : y;
    }
    const d = new Date(year, monthIdx, day);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isLateFeeApplicable(dueDate: string | null | undefined, paidDate: string | null | undefined): boolean {
    const due = parseFlexDate(dueDate);
    if (!due) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (today.getTime() <= due.getTime()) return false;
    if (!paidDate || !paidDate.trim()) return true;
    const paid = parseFlexDate(paidDate);
    if (!paid) return true;
    paid.setHours(0, 0, 0, 0);
    return paid.getTime() > due.getTime();
}

type FeeStructureType = 'REGULAR' | 'ADDON' | 'PENALTY' | 'ONE_TIME' | 'BUS' | 'LATE_FEE';
interface FeeSubItem { id: string; label: string; amount: number; }
interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
interface FeeStructure { id: string; name: string; type: FeeStructureType; color: string; items: FeeItem[]; }
interface FeeMonth { id: string; month: string; dueDate: string; assignedStructureIds: string[]; remark: string; }
interface FeePayment { studentId: string; feeMonthId: string; status: 'PAID' | 'PENDING'; paidDate: string | null; remark: string | null; extraFields: Record<string, string> | null; extraStructureIds: string[] | null; }
type StudentDetailField = {
    id: string;
    kind: 'default' | 'custom';
    defaultKey?: 'name' | 'rollNo' | 'studentId' | 'class' | 'division' | 'bus';
    label: string;
    value?: string;
};

function structureTotal(s: FeeStructure) {
    return s.items.reduce((n, item) => {
        const sub = item.subItems.reduce((m, si) => m + si.amount, 0);
        return n + (sub > 0 ? sub : item.amount);
    }, 0);
}

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

interface RawStudent {
    id: string;
    studentId: string;
    avatarUrl: string | null;
    user: { name: string | null; email: string };
    rollNo: string | null;
    dob: string | null;
    admissionYear: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    extraDetailFields: Record<string, string> | null;
}

export default function TeacherStudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const divisionId = params.divisionId as string;
    const studentId = params.studentId as string;

    const [student, setStudent] = useState<RawStudent | null>(null);
    const [standardName, setStandardName] = useState('');
    const [divisionName, setDivisionName] = useState('');
    const [institutionName, setInstitutionName] = useState('');
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [marksheetData, setMarksheetData] = useState<ProfileViewMarksheet | null>(null);
    const [attendanceApiData, setAttendanceApiData] = useState<ProfileViewAttendance | null>(null);
    const [flags, setFlags] = useState<FlagItem[]>([]);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [feeMonths, setFeeMonths] = useState<FeeMonth[]>([]);
    const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
    const [studentFields, setStudentFields] = useState<StudentDetailField[]>([]);

    useEffect(() => {
        Promise.all([
            api.get(`/teacher/classes/${divisionId}/students`),
            api.get(`/teacher/classes/${divisionId}`),
        ])
            .then(([studentsRes, divisionRes]) => {
                const found = (studentsRes.data.data as RawStudent[]).find(s => s.id === studentId);
                if (!found) { setNotFound(true); return; }
                setStudent(found);
                const div = divisionRes.data.data;
                setStandardName(div.standard.name);
                setDivisionName(div.name);
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));

        api.get('/teacher/overview')
            .then(res => setInstitutionName(res.data.data?.teacher?.institutionName ?? ''))
            .catch(() => {});
    }, [divisionId, studentId]);

    useEffect(() => {
        api.get(`/teacher/classes/${divisionId}/students/${studentId}/marksheet`)
            .then(res => setMarksheetData(res.data.data))
            .catch(() => setMarksheetData(null));
        api.get(`/teacher/classes/${divisionId}/students/${studentId}/attendance-trend`)
            .then(res => setAttendanceApiData(res.data.data))
            .catch(() => setAttendanceApiData(null));
        api.get(`/teacher/classes/${divisionId}/students/${studentId}/remarks`)
            .then(res => setFlags(res.data.data))
            .catch(() => setFlags([]));
        api.get(`/teacher/campus/divisions/${divisionId}/fee-structure`)
            .then(res => {
                const structure = res.data?.data;
                setFeeStructures(structure?.feeStructures ?? []);
                setFeeMonths(structure?.feeMonths ?? []);
                setStudentFields(structure?.studentFields ?? []);
            })
            .catch(() => { setFeeStructures([]); setFeeMonths([]); setStudentFields([]); });
        api.get(`/teacher/campus/divisions/${divisionId}/fee-payments`)
            .then(res => setFeePayments(res.data?.data ?? []))
            .catch(() => setFeePayments([]));
    }, [divisionId, studentId]);

    const getPayment = (feeMonthId: string): FeePayment =>
        feePayments.find(p => p.studentId === studentId && p.feeMonthId === feeMonthId)
            ?? { studentId, feeMonthId, status: 'PENDING', paidDate: null, remark: null, extraFields: null, extraStructureIds: null };

    const monthTotal = (m: FeeMonth) =>
        feeStructures.filter(s => m.assignedStructureIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);

    const getAutoLateFee = (m: FeeMonth): FeeStructure | null => {
        const payment = getPayment(m.id);
        if (!isLateFeeApplicable(m.dueDate, payment.paidDate)) return null;
        const lateFee = feeStructures.find(s => s.type === 'LATE_FEE');
        if (!lateFee) return null;
        if (m.assignedStructureIds.includes(lateFee.id)) return null;
        if ((payment.extraStructureIds ?? []).includes(lateFee.id)) return null;
        return lateFee;
    };

    const getAutoBusFee = (m: FeeMonth): { structure: FeeStructure; amount: number } | null => {
        const busField = studentFields.find(f => f.kind === 'default' && f.defaultKey === 'bus');
        if (!busField) return null;
        const detailFields = student?.extraDetailFields;
        if (detailFields?.[`${busField.id}-enabled`] !== 'true') return null;
        const rawMonths = detailFields?.[`${busField.id}-months`];
        let monthIds: string[] = [];
        if (rawMonths) {
            try {
                const parsed = JSON.parse(rawMonths);
                if (Array.isArray(parsed)) monthIds = parsed.filter((x): x is string => typeof x === 'string');
            } catch { /* ignore malformed value */ }
        }
        if (!monthIds.includes(m.id)) return null;
        const busStructure = feeStructures.find(s => s.type === 'BUS');
        if (!busStructure) return null;
        if (m.assignedStructureIds.includes(busStructure.id)) return null;
        const amount = Number(detailFields?.[`${busField.id}-fee`]) || 0;
        return { structure: busStructure, amount };
    };

    const studentMonthTotal = (m: FeeMonth) => {
        const extraIds = (getPayment(m.id).extraStructureIds ?? []).filter(id => !m.assignedStructureIds.includes(id));
        const extra = feeStructures.filter(s => extraIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);
        const autoLateFee = getAutoLateFee(m);
        const autoBusFee = getAutoBusFee(m);
        return monthTotal(m) + extra + (autoLateFee ? structureTotal(autoLateFee) : 0) + (autoBusFee ? autoBusFee.amount : 0);
    };

    const feeMonthsProfile = feeMonths.map(m => {
        const payment = getPayment(m.id);
        return {
            month: m.month,
            dueDate: m.dueDate,
            amount: studentMonthTotal(m),
            status: payment.status,
            paidDate: payment.paidDate ?? undefined,
        };
    });
    const termData = [
        { label: 'Term 1', range: 'June – October', months: feeMonthsProfile.filter(m => TERM1_MONTHS.includes(m.month)) },
        { label: 'Term 2', range: 'November – May', months: feeMonthsProfile.filter(m => TERM2_MONTHS.includes(m.month)) },
    ];

    if (loading) {
        return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>;
    }
    if (notFound || !student) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-sm text-muted-foreground">Student not found.</p>
                <button onClick={() => router.back()} className="text-xs font-semibold text-primary hover:underline">Go back</button>
            </div>
        );
    }

    const feesElement = (
        <SectionCard title="Fees" icon={IndianRupee} iconColor="#10B981"
            action={
                <button onClick={() => router.push(`/teacher/classes/${divisionId}/students/${studentId}/fees`)} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                    <span className="leading-none">View Details</span>
                    <ChevronRight size={12} />
                </button>
            }>
            <div className="space-y-2.5 mb-4">
                {termData.map((term) => {
                    const paid = term.months.filter(m => m.status === 'PAID').length;
                    const total = term.months.length;
                    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                    const cleared = total > 0 && paid === total;
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
                                {feeMonthsProfile.length === 0 ? (
                                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[11px] text-muted-foreground">No fee months configured yet</td></tr>
                                ) : feeMonthsProfile.map((m, i) => (
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
    );

    const projectsElement = (
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
            <div className="mt-3 p-3 rounded-xl bg-[var(--muted)] dark:bg-[var(--muted)] border border-[var(--border)] flex items-center gap-2">
                <User size={13} className="text-[var(--primary)] shrink-0" />
                <p className="text-[11px] text-[var(--primary)]">Share your projects & certificates to build your academic profile</p>
            </div>
        </SectionCard>
    );

    return (
        <StudentProfileView
            institutionName={institutionName}
            studentName={student.user.name ?? '—'}
            studentIdCode={student.studentId}
            standard={standardName}
            division={divisionName}
            rollNo={student.rollNo}
            admissionYear={student.admissionYear}
            dob={student.dob}
            email={student.user.email}
            photo={student.avatarUrl}
            status={student.status}
            marksheetData={marksheetData}
            attendanceApiData={attendanceApiData}
            flags={flags}
            onBack={() => router.back()}
            onViewDetail={() => router.push(`/teacher/classes/${divisionId}/students/${studentId}/detail`)}
            onViewReportCard={() => router.push(`/teacher/classes/${divisionId}/students/${studentId}/reportcard`)}
            onViewAttendanceDetails={() => router.push(`/teacher/classes/${divisionId}/students/${studentId}/attendance`)}
            onViewAllFlags={() => router.push(`/teacher/classes/${divisionId}/students/${studentId}/reports?name=${encodeURIComponent(student.user.name ?? 'Student')}&class=${encodeURIComponent(divisionName)}&from=profile`)}
            feesSlot={feesElement}
            projectsSlot={projectsElement}
            ptmNotesSlot={<PTMNotesCard divisionId={divisionId} studentId={studentId} />}
        />
    );
}
