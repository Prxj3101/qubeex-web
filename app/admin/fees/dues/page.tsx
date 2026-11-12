'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';
import { Search, Download, HandCoins, PartyPopper, AlertTriangle, Users, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useYearParams } from '@/context/AcademicYearContext';
import { classDivOf, type StudentIdCardData } from '@/components/shared/StudentIdCard';
import { PageHeader, SecondaryButton, EmptyState, ThemedSelect, TERRACOTTA } from '../../payroll/_components/ui';
import { type LastReminder, type OpenMonth, type Phone, inr, timeAgo } from '../_lib';
import { ReminderComposer, RemindAll, type ReminderTarget } from '../_components/Reminders';

type Owing = StudentIdCardData & {
    balance: number; overdue: number; overdueMonths: string[]; oldestDue: { month: string; dueDate: string } | null;
    openMonths: OpenMonth[]; phones: Phone[]; upiId: string | null; lateFee: number; schoolName: string; lastReminder: LastReminder | null;
};

const targetOf = (s: Owing): ReminderTarget => ({
    studentId: s.id, child: s.name ?? '', classLabel: classDivOf(s).classDiv, school: s.schoolName, avatarUrl: s.avatarUrl,
    months: s.openMonths ?? [], upiId: s.upiId, lateFee: s.lateFee, phones: s.phones ?? [], lastReminder: s.lastReminder,
});
interface ClassDue { divisionId: string; standard: string; division: string; overdue: number; balance: number; students: number }
interface Dues { students: Owing[]; classes: ClassDue[]; months: string[]; totals: { students: number; balance: number; overdue: number } }

const ALL = '__all';

export default function DuesPage() {
    const router = useRouter();
    const yearParams = useYearParams();
    const yearKey = yearParams.academicYearId ?? '';
    const [divisionId, setDivisionId] = useState('');
    const [month, setMonth] = useState('');
    const [q, setQ] = useState('');
    const [onlyOverdue, setOnlyOverdue] = useState(true);
    const [data, setData] = useState<{ key: string; d: Dues } | null>(null);
    // Class chips always come from the whole-school list, so they don't vanish when one class is picked.
    const [classes, setClasses] = useState<ClassDue[]>([]);
    const [composeFor, setComposeFor] = useState<Owing | null>(null);
    const [remindAll, setRemindAll] = useState(false);
    // Reminders sent from this page, so the "Reminded" chip shows without a reload.
    const [reminded, setReminded] = useState<Record<string, LastReminder>>({});
    const lastOf = (s: Owing) => reminded[s.id] ?? s.lastReminder;

    const key = `${yearKey}|${divisionId}|${month}`;
    useEffect(() => {
        let live = true;
        api.get('/admin/fees/dues', { params: { ...(yearKey ? { academicYearId: yearKey } : {}), ...(divisionId ? { divisionId } : {}), ...(month ? { month } : {}) } })
            .then(r => {
                if (!live) return;
                setData({ key, d: r.data.data });
                if (!divisionId) setClasses(r.data.data.classes);
            })
            .catch(err => { if (live) toast.error(getErrorMessage(err, 'Could not load dues')); });
        return () => { live = false; };
    }, [key, yearKey, divisionId, month]);
    const loading = data?.key !== key;
    const d = data?.d;

    const list = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (d?.students ?? [])
            .filter(s => !onlyOverdue || s.overdue > 0)
            .filter(s => !needle || (s.name ?? '').toLowerCase().includes(needle) || s.studentId.toLowerCase().includes(needle));
    }, [d, q, onlyOverdue]);
    const maxClass = Math.max(1, ...classes.map(c => c.overdue));

    const exportCsv = () => {
        const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Student', 'Student ID', 'Roll No', 'Class', 'Overdue months', 'Overdue', 'Left this year'].map(esc).join(','),
            ...list.map(s => [s.name, s.studentId, s.rollNo, classDivOf(s).classDiv, s.overdueMonths.join(' + '), s.overdue, s.balance].map(esc).join(',')),
        ];
        const url = URL.createObjectURL(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' }));
        const a = document.createElement('a'); a.href = url; a.download = 'fee-dues.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-3">
            <PageHeader title="Dues" subtitle="Who still has to pay, class by class">
                <button type="button" onClick={() => setRemindAll(true)} disabled={!list.length}
                    className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    style={{ background: '#25D366' }}>
                    <FaWhatsapp size={14} /> Remind all ({list.length})
                </button>
                <SecondaryButton onClick={exportCsv} disabled={!list.length}><Download size={14} /> Export</SecondaryButton>
            </PageHeader>

            {/* Numbers */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <BigStat icon={AlertTriangle} label="Overdue" value={inr(d?.totals.overdue ?? 0)} sub="past the due date" tone="#DC2626" loading={loading} />
                <BigStat icon={Users} label="Students owing" value={String(d?.totals.students ?? 0)} sub={divisionId ? 'in this class' : 'in the school'} tone="#D97706" loading={loading} />
                <BigStat icon={Wallet} label="Left this year" value={inr(d?.totals.balance ?? 0)} sub="including months not due yet" tone="#2563EB" loading={loading} />
            </div>

            {/* Class chips with a little overdue bar each */}
            {classes.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
                    <ClassChip active={!divisionId} label="All classes" value={inr(classes.reduce((n, c) => n + c.overdue, 0))} pct={1} onClick={() => setDivisionId('')} />
                    {classes.map(c => (
                        <ClassChip key={c.divisionId} active={divisionId === c.divisionId}
                            label={classDivOf({ standard: { id: '', name: c.standard }, division: { id: '', name: c.division } }).classDiv}
                            value={c.overdue > 0 ? inr(c.overdue) : 'Clear'} pct={c.overdue / maxClass} clear={c.overdue <= 0}
                            onClick={() => setDivisionId(c.divisionId)} />
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-full sm:w-64">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or ID"
                        className="w-full h-9 pl-8 pr-7 rounded-xl text-xs bg-card border border-border focus:outline-none focus:border-foreground/30" />
                    {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={13} /></button>}
                </div>
                <div className="w-40">
                    <ThemedSelect value={month || ALL} onChange={v => setMonth(v === ALL ? '' : v)}
                        options={[{ value: ALL, label: 'All months' }, ...(d?.months ?? []).map(m => ({ value: m, label: m }))]} />
                </div>
                <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                    {[{ v: true, l: 'Overdue' }, { v: false, l: 'Everyone owing' }].map(o => (
                        <button key={o.l} type="button" onClick={() => setOnlyOverdue(o.v)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${onlyOverdue === o.v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{o.l}</button>
                    ))}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />)}</div>
            ) : !list.length ? (
                <EmptyState icon={PartyPopper} title={onlyOverdue ? 'Nothing overdue' : 'No dues'} text={onlyOverdue ? 'Every student here has paid what is due so far.' : 'Every student here has paid for the whole year.'} />
            ) : (
                <div className="grid gap-2 md:grid-cols-2">
                    {list.map((s, i) => {
                        const late = s.overdue > 0;
                        return (
                            <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.015 }}
                                className="relative overflow-hidden rounded-2xl border border-border/60 bg-card flex items-center gap-3 pl-4 pr-3 py-2.5" data-admin-surface="">
                                <span className="absolute left-0 inset-y-0 w-1" style={{ background: late ? '#DC2626' : '#D97706' }} />
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    {s.avatarUrl
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" />
                                        : (s.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{s.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {classDivOf(s).classDiv} · Roll {s.rollNo || '—'} · <span className="font-mono">{s.studentId}</span>
                                    </p>
                                    {(s.overdueMonths.length > 0 || lastOf(s)) && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {s.overdueMonths.slice(0, 5).map(m => <span key={m} className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600">{m}</span>)}
                                            {s.overdueMonths.length > 5 && <span className="text-[9.5px] text-muted-foreground">+{s.overdueMonths.length - 5}</span>}
                                            {lastOf(s) && (
                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#25D366]/15 text-[#128C7E]">
                                                    <FaWhatsapp size={10} /> Reminded {timeAgo(lastOf(s)!.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`text-sm font-bold tabular-nums ${late ? 'text-red-600' : ''}`}>{inr(late ? s.overdue : s.balance)}</p>
                                    <p className="text-[10px] text-muted-foreground">{late ? `${inr(s.balance)} left in year` : 'not due yet'}</p>
                                </div>
                                <button type="button" title="Remind on WhatsApp" onClick={() => setComposeFor(s)}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-border hover:bg-[#25D366]/10 transition-colors">
                                    <FaWhatsapp size={16} className="text-[#25D366]" />
                                </button>
                                <button type="button" onClick={() => router.push(`/admin/fees/collect?student=${s.id}`)}
                                    className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-[11px] font-semibold text-white shrink-0 hover:opacity-90" style={{ background: TERRACOTTA }}>
                                    <HandCoins size={13} /> Collect
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <AnimatePresence>
                {composeFor && (
                    <ReminderComposer target={{ ...targetOf(composeFor), lastReminder: lastOf(composeFor) }} onClose={() => setComposeFor(null)}
                        onSent={last => setReminded(r => ({ ...r, [composeFor.id]: last }))} />
                )}
                {remindAll && (
                    <RemindAll targets={list.map(s => ({ ...targetOf(s), lastReminder: lastOf(s) }))} onClose={() => setRemindAll(false)}
                        onSent={(id, last) => setReminded(r => ({ ...r, [id]: last }))} />
                )}
            </AnimatePresence>
        </div>
    );
}

function BigStat({ icon: Icon, label, value, sub, tone, loading }: { icon: React.ElementType; label: string; value: string; sub: string; tone: string; loading: boolean }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-3 flex items-center gap-3" data-admin-surface="">
            <div className="absolute -right-6 -top-8 w-24 h-24 rounded-full opacity-[0.08] pointer-events-none" style={{ background: tone }} />
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tone}15`, color: tone }}><Icon size={18} /></span>
            <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={`text-xl font-bold tabular-nums leading-tight ${loading ? 'opacity-40' : ''}`} style={{ fontFamily: 'var(--font-poppins)' }}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
        </div>
    );
}

function ClassChip({ active, label, value, pct, clear, onClick }: { active: boolean; label: string; value: string; pct: number; clear?: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={`shrink-0 w-[112px] text-left rounded-xl border px-3 py-2 transition-all ${active ? 'border-primary bg-primary/10' : 'border-border/60 bg-card hover:bg-muted/40'}`}>
            <p className={`text-xs font-bold ${active ? 'text-primary' : ''}`}>{label}</p>
            <p className={`text-[11px] font-semibold tabular-nums ${clear ? 'text-emerald-600' : 'text-red-600'}`}>{value}</p>
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(clear ? 0 : 6, pct * 100)}%`, background: clear ? '#10B981' : '#DC2626' }} />
            </div>
        </button>
    );
}
