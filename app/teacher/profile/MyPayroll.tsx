'use client';

// My Payroll (Profile -> My Payroll): the teacher's own published payslips and,
// when the school tracks staff attendance, their own month of attendance (read
// only) so the LOP on a payslip can be understood day by day.
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Wallet, CalendarCheck, Info, CheckCircle2, Fingerprint, Hand } from 'lucide-react';
import { FaFilePdf } from 'react-icons/fa';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatINR } from '@/lib/payroll';

type Status = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'PAID_LEAVE' | 'UNPAID_LEAVE';
type DayType = 'WORKING' | 'WEEKLY_OFF' | 'HOLIDAY';
interface Payslip {
    id: string; grossPay: number; netPay: number; status: 'PENDING' | 'PAID';
    lopDays: number; paidDays: number; basisDays: number;
    payrollRun: { month: string; publishedAt: string };
}
interface Summary { workingDays: number; present: number; late: number; halfDay: number; absent: number; paidLeave: number; unpaidLeave: number; unmarked: number }
interface AttDay { date: string; type: DayType; holidayName: string | null; record: { status: Status; checkIn: string | null; checkOut: string | null; source: string } | null }
type Attendance =
    | { tracked: false }
    | {
        tracked: true; month: string; joinedAt: string | null; exitDate: string | null; days: AttDay[];
        summary: Summary | null; lopDays: number; payslip: { lopDays: number; lopSource: string | null } | null;
        rules: { lopEnabled: boolean; officeStart: string; graceMinutes: number; halfDayMinutes: number; lateRuleEnabled: boolean; lateRuleCount: number };
    };

const STATUS: Record<Status, { code: string; label: string; color: string }> = {
    PRESENT: { code: 'P', label: 'Present', color: '#16a34a' },
    LATE: { code: 'L', label: 'Late', color: '#d97706' },
    HALF_DAY: { code: 'H', label: 'Half day', color: '#ea580c' },
    ABSENT: { code: 'A', label: 'Absent', color: '#dc2626' },
    PAID_LEAVE: { code: 'PL', label: 'Paid leave', color: '#0284c7' },
    UNPAID_LEAVE: { code: 'UL', label: 'Unpaid leave', color: '#be123c' },
};
const SHEET = { paper: '#F5F8EE', head: '#ECF3D0', line: '#BACE85', ink: '#2A3A10' };
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const shiftMonth = (month: string, n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthName = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const worked = (a?: string | null, b?: string | null) => {
    if (!a || !b) return null;
    const d = mins(b) - mins(a);
    return d > 0 ? `${Math.floor(d / 60)}h ${pad(d % 60)}m` : null;
};
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const d10 = (v?: string | null) => (v ? v.slice(0, 10) : null);

function Card({ title, right, children, className = '' }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col ${className}`}>
            <div className="flex items-center justify-between gap-2 px-5 py-3 min-h-[56px] border-b border-border/50 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 leading-none">{title}</p>
                {right}
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
}

export default function MyPayroll() {
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [slipsLoading, setSlipsLoading] = useState(true);
    const [noStaff, setNoStaff] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [month, setMonth] = useState<string | null>(null);
    const [att, setAtt] = useState<Attendance | null>(null);
    const [attLoading, setAttLoading] = useState(true);
    const [picked, setPicked] = useState<string | null>(null);

    useEffect(() => {
        api.get('/teacher/payroll/payslips')
            .then(res => {
                const list: Payslip[] = res.data.data ?? [];
                setPayslips(list);
                setMonth(list[0]?.payrollRun.month ?? thisMonth());
            })
            .catch(err => {
                if (err?.response?.status === 404) setNoStaff(true);
                setMonth(thisMonth());
            })
            .finally(() => setSlipsLoading(false));
    }, []);

    useEffect(() => {
        if (!month || noStaff) return;
        let live = true;
        api.get('/teacher/payroll/attendance', { params: { month } })
            .then(res => { if (live) setAtt(res.data.data); })
            .catch(() => { if (live) setAtt({ tracked: false }); })
            .finally(() => { if (live) setAttLoading(false); });
        return () => { live = false; };
    }, [month, noStaff]);

    const goMonth = (m: string) => {
        if (m === month) return;
        setMonth(m);
        setAttLoading(true);
        setPicked(null);
    };

    const openPdf = async (id: string) => {
        setDownloadingId(id);
        try {
            const res = await api.get(`/teacher/payroll/payslips/${id}/pdf`, { responseType: 'blob' });
            window.open(URL.createObjectURL(res.data as Blob), '_blank');
        } catch {
            toast.error('Could not open the payslip');
        } finally {
            setDownloadingId(null);
        }
    };

    if (noStaff) {
        return (
            <div className="bg-card border border-border/50 rounded-2xl py-14 text-center">
                <Wallet size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Payroll is not set up for you yet</p>
                <p className="text-xs text-muted-foreground mt-1">Once the school adds you to payroll, your payslips will show up here.</p>
            </div>
        );
    }

    const showAttendance = !att || att.tracked; // hide the whole card when the school doesn't track staff attendance

    return (
        <div className={`grid grid-cols-1 gap-4 ${showAttendance ? 'lg:grid-cols-[minmax(300px,380px)_1fr]' : ''}`}>
            {/* Payslips */}
            <Card title={<><Wallet size={13} /> Payslips</>} className="lg:self-start">
                {slipsLoading ? (
                    <div className="p-4 space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}</div>
                ) : payslips.length === 0 ? (
                    <div className="py-12 px-6 text-center">
                        <p className="text-sm font-medium text-muted-foreground">No payslips yet</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Your payslip shows up here as soon as the school publishes payroll.</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1 max-h-[560px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {payslips.map(p => {
                            const active = p.payrollRun.month === month && showAttendance;
                            return (
                                <div key={p.id} role="button" tabIndex={0}
                                    onClick={() => goMonth(p.payrollRun.month)}
                                    onKeyDown={e => { if (e.key === 'Enter') goMonth(p.payrollRun.month); }}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${active ? 'border-border bg-muted/60' : 'border-transparent hover:bg-muted/30'}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold leading-tight">{monthName(p.payrollRun.month)}</p>
                                        <p className="text-[11px] text-muted-foreground leading-tight mt-1">
                                            {formatINR(p.netPay)} take-home
                                            {p.lopDays > 0 && <span className="text-red-500"> · LOP {p.lopDays}</span>}
                                        </p>
                                    </div>
                                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full leading-none ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                        {p.status === 'PAID' ? 'Paid' : 'Pending'}
                                    </span>
                                    <button onClick={e => { e.stopPropagation(); openPdf(p.id); }} disabled={downloadingId === p.id} title="Open payslip PDF"
                                        className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/50 disabled:opacity-50 shrink-0">
                                        {downloadingId === p.id ? <Loader2 size={13} className="animate-spin text-muted-foreground" /> : <FaFilePdf size={15} className="text-red-600 dark:text-red-400" />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* My attendance */}
            {showAttendance && month && (
                <Card
                    title={<><CalendarCheck size={13} /> My attendance</>}
                    right={
                        <div className="flex items-center gap-1">
                            <button onClick={() => goMonth(shiftMonth(month, -1))} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center" title="Previous month"><ChevronLeft size={15} /></button>
                            <span className="text-xs font-semibold w-[118px] text-center leading-none">{monthName(month)}</span>
                            <button onClick={() => goMonth(shiftMonth(month, 1))} disabled={month >= thisMonth()} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center disabled:opacity-30" title="Next month"><ChevronRight size={15} /></button>
                        </div>
                    }>
                    {attLoading || !att || !att.tracked ? (
                        <div className="h-[420px] flex items-center justify-center"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
                    ) : (
                        <AttendanceBody att={att} picked={picked} onPick={setPicked} />
                    )}
                </Card>
            )}
        </div>
    );
}

function AttendanceBody({ att, picked, onPick }: { att: Extract<Attendance, { tracked: true }>; picked: string | null; onPick: (d: string | null) => void }) {
    const { summary, rules } = att;
    const joined = d10(att.joinedAt), exit = d10(att.exitDate);
    const today = todayISO();
    const lead = useMemo(() => (new Date(`${att.days[0].date}T00:00:00`).getDay() + 6) % 7, [att.days]); // Monday first
    const pickedDay = att.days.find(d => d.date === picked) ?? null;
    const final = !!att.payslip;
    const payslipDiffers = att.payslip && Math.abs(att.payslip.lopDays - att.lopDays) > 0.001;

    const pills: { label: string; value: number; color: string }[] = summary ? [
        { label: 'Present', value: summary.present, color: STATUS.PRESENT.color },
        { label: 'Late', value: summary.late, color: STATUS.LATE.color },
        { label: 'Half day', value: summary.halfDay, color: STATUS.HALF_DAY.color },
        { label: 'Absent', value: summary.absent, color: STATUS.ABSENT.color },
        { label: 'Paid leave', value: summary.paidLeave, color: STATUS.PAID_LEAVE.color },
        { label: 'Unpaid leave', value: summary.unpaidLeave, color: STATUS.UNPAID_LEAVE.color },
        { label: 'Not marked', value: summary.unmarked, color: '#64748b' },
    ].filter(p => p.value > 0 || ['Present', 'Absent'].includes(p.label)) : [];

    const ruleBits = [
        `Office starts ${rules.officeStart}`,
        `${rules.graceMinutes} min grace`,
        `under ${Math.round(rules.halfDayMinutes / 60 * 10) / 10}h = half day`,
        ...(rules.lateRuleEnabled ? [`every ${rules.lateRuleCount} lates = ½ day LOP`] : []),
    ];

    return (
        <div className="p-4 space-y-3">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-2">
                {pills.map(p => (
                    <span key={p.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border/60 bg-muted/30 leading-none">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                        {p.label} <span style={{ color: p.color }}>{p.value}</span>
                    </span>
                ))}
                <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg leading-none ${att.lopDays ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                    LOP {days(att.lopDays)}
                </span>
            </div>

            {/* Status of these numbers */}
            {final ? (
                payslipDiffers ? (
                    <div className="flex items-start gap-2 text-[11.5px] px-3 py-2 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/50">
                        <Info size={13} className="shrink-0 mt-px" />
                        <span>Your payslip used <b>LOP {days(att.payslip!.lopDays)}</b>, set by the accounts team. Please talk to them if this looks wrong.</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-[11.5px] px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900/50">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span className="leading-none">Matches your {monthName(att.month)} payslip.</span>
                    </div>
                )
            ) : (
                <div className="flex items-start gap-2 text-[11.5px] px-3 py-2 rounded-lg bg-muted/40 text-muted-foreground border border-border/50">
                    <Info size={13} className="shrink-0 mt-px" />
                    <span>This can still change until this month&apos;s payroll is published.</span>
                </div>
            )}

            {/* Register calendar */}
            <div className="rounded-xl overflow-hidden" style={{ background: SHEET.paper, border: `1px solid ${SHEET.line}` }}>
                <div className="grid grid-cols-7" style={{ background: SHEET.head, borderBottom: `1px solid ${SHEET.line}` }}>
                    {WEEK.map(w => (
                        <div key={w} className={`py-1.5 text-center text-[10.5px] font-bold uppercase tracking-wider ${w === 'Sun' ? 'text-red-500' : ''}`} style={w === 'Sun' ? undefined : { color: SHEET.ink }}>{w}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} style={{ borderRight: `1px solid ${SHEET.line}80`, borderBottom: `1px solid ${SHEET.line}80` }} />)}
                    {att.days.map(d => {
                        const outside = (joined && d.date < joined) || (exit && d.date > exit);
                        const off = d.type !== 'WORKING';
                        const future = d.date > today;
                        const r = d.record;
                        const isPicked = picked === d.date;
                        const bg = outside ? `repeating-linear-gradient(135deg,#E9EDDC 0 4px,${SHEET.paper} 4px 8px)`
                            : off ? '#FFF5F5' : d.date === today ? '#EEF4FF' : undefined;
                        return (
                            <button key={d.date} type="button" onClick={() => onPick(isPicked ? null : d.date)}
                                title={d.holidayName ?? (r ? STATUS[r.status].label : undefined)}
                                className={`relative h-[58px] flex flex-col items-center justify-center transition-colors hover:bg-[#E0E8C8] ${outside ? 'opacity-60' : ''}`}
                                style={{
                                    background: isPicked ? '#E0E8C8' : bg,
                                    borderRight: `1px solid ${SHEET.line}80`, borderBottom: `1px solid ${SHEET.line}80`,
                                    boxShadow: isPicked ? `inset 0 0 0 2px ${SHEET.line}` : undefined,
                                }}>
                                <span className={`absolute top-1 left-1.5 text-[10px] font-semibold leading-none ${off ? 'text-red-400' : ''}`} style={off ? undefined : { color: `${SHEET.ink}99` }}>
                                    {Number(d.date.slice(8))}
                                </span>
                                {r ? (
                                    <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: STATUS[r.status].code.length > 1 ? 16 : 20, fontWeight: 700, lineHeight: 1, color: STATUS[r.status].color }}>
                                        {STATUS[r.status].code}
                                    </span>
                                ) : d.type === 'HOLIDAY' ? (
                                    <span className="text-[9.5px] font-semibold text-red-400 leading-none px-1 truncate max-w-full">Holiday</span>
                                ) : d.type === 'WEEKLY_OFF' ? (
                                    <span className="text-[9.5px] font-semibold text-red-300 leading-none">Off</span>
                                ) : (
                                    <span className="leading-none" style={{ color: SHEET.line }}>{future || outside ? '' : '—'}</span>
                                )}
                                {r?.checkIn && (
                                    <span className="absolute bottom-1 text-[8.5px] leading-none tabular-nums" style={{ color: `${SHEET.ink}80` }}>{r.checkIn}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Picked day */}
            {pickedDay && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs px-3 py-2.5 rounded-lg border border-border/60 bg-muted/20">
                    <span className="font-semibold">{longDate(pickedDay.date)}</span>
                    {(joined && pickedDay.date < joined) ? <span className="text-muted-foreground">Before you joined ({shortDay(joined)}), not counted</span>
                        : (exit && pickedDay.date > exit) ? <span className="text-muted-foreground">After your last day, not counted</span>
                        : pickedDay.record ? (
                            <>
                                <span className="font-semibold" style={{ color: STATUS[pickedDay.record.status].color }}>{STATUS[pickedDay.record.status].label}</span>
                                <span className="text-muted-foreground">In <b className="text-foreground tabular-nums">{pickedDay.record.checkIn ?? '—'}</b></span>
                                <span className="text-muted-foreground">Out <b className="text-foreground tabular-nums">{pickedDay.record.checkOut ?? '—'}</b></span>
                                {worked(pickedDay.record.checkIn, pickedDay.record.checkOut) && <span className="text-muted-foreground">{worked(pickedDay.record.checkIn, pickedDay.record.checkOut)} worked</span>}
                                <span className="inline-flex items-center gap-1 text-muted-foreground ml-auto">
                                    {pickedDay.record.source === 'MANUAL' ? <><Hand size={12} /> Marked by the office</> : <><Fingerprint size={12} /> From the attendance machine</>}
                                </span>
                            </>
                        ) : pickedDay.type === 'HOLIDAY' ? <span className="text-muted-foreground">{pickedDay.holidayName ?? 'Holiday'}</span>
                        : pickedDay.type === 'WEEKLY_OFF' ? <span className="text-muted-foreground">Weekly off</span>
                        : pickedDay.date > today ? <span className="text-muted-foreground">Not yet</span>
                        : <span className="text-muted-foreground">Not marked, counted as present</span>}
                </div>
            )}

            {/* Legend + rules */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                {(Object.keys(STATUS) as Status[]).map(s => (
                    <span key={s} className="inline-flex items-center gap-1 leading-none">
                        <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 14, fontWeight: 700, color: STATUS[s].color, lineHeight: 1 }}>{STATUS[s].code}</span> {STATUS[s].label}
                    </span>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
                {ruleBits.join(' · ')}. LOP = absent + unpaid leave + half days × ½. Days not marked count as present. Tap a day to see its in / out time.
            </p>
        </div>
    );
}
