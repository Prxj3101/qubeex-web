'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Loader2, Printer, ChevronRight, Plus, Minus, ReceiptText, Sparkles, CalendarDays, StickyNote, UserRoundSearch, Lock, History } from 'lucide-react';
import { toast } from 'sonner';
import { FaWhatsapp } from 'react-icons/fa';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useIsHistoricalYear, useYearParams } from '@/context/AcademicYearContext';
import { StudentIdCard, classDivOf, type StudentIdCardData } from '@/components/shared/StudentIdCard';
import { PageHeader, TERRACOTTA } from '../../payroll/_components/ui';
import { FeeCard } from '../_components/FeeCard';
import { PaperReceipt } from '../_components/PaperReceipt';
import { ReminderComposer, type ReminderTarget } from '../_components/Reminders';
import { type Account, type LastReminder, type Mode, type Receipt, type SearchStudent, MODES, allocate, inr, modeOf, prettyDay, timeAgo, todayIST } from '../_lib';

type DayBookReceipt = Receipt & { student: StudentIdCardData | null };
interface DayBook { day: string; receipts: DayBookReceipt[]; totals: { amount: number; count: number; byMode?: Record<Mode, number> } }
interface Recent { id: string; name: string; avatarUrl: string | null; classDiv: string }

// Students opened at the counter lately, so a parent coming back is one click away (this browser only).
const RECENT_KEY = 'qx-fees-recent';
const readRecent = (): Recent[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.slice(0, 6) : []; } catch { return []; } };
const pushRecent = (r: Recent) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([r, ...readRecent().filter(x => x.id !== r.id)].slice(0, 6))); } catch { /* storage off */ } };

export default function CollectPage() {
    return <Suspense fallback={null}><Collect /></Suspense>;
}

function Collect() {
    const router = useRouter();
    const params = useSearchParams();
    const studentId = params.get('student');
    const yearParams = useYearParams();
    const yearKey = yearParams.academicYearId ?? '';
    const historical = useIsHistoricalYear();

    // ── Search ──
    const [q, setQ] = useState('');
    const [results, setResults] = useState<{ q: string; list: SearchStudent[] } | null>(null);
    useEffect(() => {
        const term = q.trim();
        if (!term) return;
        const t = setTimeout(() => {
            api.get('/admin/fees/students/search', { params: { q: term, ...(yearKey ? { academicYearId: yearKey } : {}) } })
                .then(r => setResults({ q: term, list: r.data?.data ?? [] }))
                .catch(() => setResults({ q: term, list: [] }));
        }, 250);
        return () => clearTimeout(t);
    }, [q, yearKey]);
    const searching = !!q.trim() && results?.q !== q.trim();
    const searchRef = useRef<HTMLInputElement>(null);
    // "/" jumps to the search box, like most counters' software.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (e.key === '/' && !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))) { e.preventDefault(); searchRef.current?.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    const [recent, setRecent] = useState<Recent[]>([]);
    useEffect(() => { const t = setTimeout(() => setRecent(readRecent()), 0); return () => clearTimeout(t); }, [studentId]);


    // ── Today's counter (header chip + recent receipts) ──
    const [today, setToday] = useState<DayBook | null>(null);
    const [reload, setReload] = useState(0);
    useEffect(() => {
        api.get('/admin/fees/day-book', { params: { date: todayIST() } }).then(r => setToday(r.data?.data ?? null)).catch(() => {});
    }, [reload]);

    // ── Collect form ──
    const [amountText, setAmountText] = useState<string | null>(null);
    const [discountOn, setDiscountOn] = useState(false);
    const [discountText, setDiscountText] = useState('');
    const [mode, setMode] = useState<Mode>('CASH');
    const [reference, setReference] = useState('');
    const [day, setDay] = useState(todayIST());
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState<Receipt | null>(null);
    const [wa, setWa] = useState<null | { thanks?: Receipt }>(null);
    const [reminded, setReminded] = useState<{ id: string; last: LastReminder } | null>(null);

    // ── Selected student ──
    const [account, setAccount] = useState<Account | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (!studentId) return;
        let live = true;
        api.get(`/admin/fees/students/${studentId}`, { params: yearKey ? { academicYearId: yearKey } : {} })
            .then(r => {
                if (!live) return;
                const a: Account = r.data.data;
                setAccount(a);
                // Pick what is overdue; if nothing is, the next month due.
                const open = a.bills.filter(b => b.balance > 0);
                const overdue = open.filter(b => b.due);
                setSelected(new Set((overdue.length ? overdue : open.slice(0, 1)).map(b => b.feeMonthId)));
                setAmountText(null); setDiscountText('');
            })
            .catch(err => { if (live) toast.error(getErrorMessage(err, 'Could not open this student')); });
        return () => { live = false; };
    }, [studentId, yearKey, reload]);
    const loadingAccount = !!studentId && account?.student.id !== studentId;

    const openStudent = (id: string, card?: StudentIdCardData) => {
        if (card) pushRecent({ id, name: card.name ?? '', avatarUrl: card.avatarUrl, classDiv: classDivOf(card).classDiv });
        router.push(`/admin/fees/collect?student=${id}`);
    };
    const closeStudent = () => { router.push('/admin/fees/collect'); setAccount(null); };

    const chosen = useMemo(() => (account?.bills ?? []).filter(b => selected.has(b.feeMonthId) && b.balance > 0), [account, selected]);
    const due = Math.round(chosen.reduce((n, b) => n + b.balance, 0) * 100) / 100;
    const discount = discountOn ? Math.max(0, Number(discountText) || 0) : 0;
    const amount = amountText == null ? Math.max(0, Math.round((due - discount) * 100) / 100) : Math.max(0, Number(amountText) || 0);
    const plan = allocate(chosen, amount, discount);
    const leftDue = Math.max(0, Math.round((due - amount - discount) * 100) / 100);
    const canCollect = !!account?.canCollect && !historical;

    const toggle = (id: string) => {
        setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
        setAmountText(null);
    };

    const submit = async () => {
        if (!account || !plan.lines.length) return;
        if (plan.extra > 0) { toast.error(`That is ${inr(plan.extra)} more than what is due`); return; }
        setSaving(true);
        try {
            const r = await api.post('/admin/fees/receipts', {
                studentId: account.student.id, lines: plan.lines, mode,
                reference: mode === 'CASH' ? null : reference.trim() || null, note: note.trim() || null, day,
            }, { params: yearKey ? { academicYearId: yearKey } : {} });
            setDone(r.data.data);
            setReference(''); setNote(''); setDiscountOn(false); setDiscountText(''); setAmountText(null);
            setReload(n => n + 1);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not save the payment'));
        } finally {
            setSaving(false);
        }
    };

    const printReceipt = (id: string) => window.open(`/print/fee-receipt/${id}`, '_blank', 'noopener');
    const schoolName = account?.card?.schoolName || account?.student.institutionName || '';
    const lastReminder = (reminded && reminded.id === account?.student.id ? reminded.last : null) ?? account?.lastReminder ?? null;
    const waTarget: ReminderTarget | null = account ? {
        studentId: account.student.id, child: account.student.name ?? '', classLabel: classDivOf(account.student).classDiv, school: schoolName,
        avatarUrl: account.student.avatarUrl, upiId: account.payment?.upiId ?? null, lateFee: account.lateFee ?? 0, phones: account.phones ?? [],
        months: account.bills.filter(b => b.balance > 0).map(b => ({ month: b.month, dueDate: b.dueDate, balance: b.balance, due: b.due })),
        lastReminder,
    } : null;

    const todayChip = (
        <button type="button" onClick={() => router.push('/admin/fees/today')}
            className="inline-flex items-center gap-2 h-8 pl-2 pr-3 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted/50 transition-colors">
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: TERRACOTTA }}><ReceiptText size={11} /></span>
            Today {inr(today?.totals.amount ?? 0)}
            <span className="text-muted-foreground font-medium">· {today?.totals.count ?? 0} receipts</span>
        </button>
    );

    // ── Search screen ──
    if (!studentId) {
        const term = q.trim();
        const list = term && results?.q === term ? results.list : [];
        const now = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
        // Two parts on wide screens: the counter on the left, search results
        // (ID cards) on the right, scrolling on their own.
        return (
            <div className="flex flex-col gap-3 lg:h-full">
                <PageHeader title="Fee Counter" subtitle="Search a student, take the fee and print the receipt">{todayChip}</PageHeader>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:flex-1 lg:min-h-0">
                <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {/* Hero: search on the left, the counter machine on the right */}
                <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card" data-admin-surface="">
                    <div className="absolute -top-24 left-1/3 w-72 h-72 rounded-full opacity-[0.10] pointer-events-none blur-2xl" style={{ background: TERRACOTTA }} />
                    <div className="absolute -bottom-28 -left-16 w-72 h-72 rounded-full opacity-[0.08] pointer-events-none blur-2xl bg-primary" />
                    <div className="relative grid xl:grid-cols-[minmax(0,1fr)_300px] gap-6 px-5 py-3.5 sm:px-8 sm:py-[18px]">
                        <div className="flex flex-col justify-center min-w-0">
                            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-60 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" /></span>
                                Counter open · <span suppressHydrationWarning>{now}</span>
                            </p>
                            <h2 className="text-2xl sm:text-[30px] font-bold leading-tight mt-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                                Who is paying <span className="bg-clip-text text-transparent" style={{ backgroundImage: TERRACOTTA }}>today?</span>
                            </h2>
                            <div className="relative mt-3.5 group">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <input ref={searchRef} autoFocus value={q} onChange={e => setQ(e.target.value)}
                                    placeholder="Name, student ID or parent phone"
                                    className="w-full h-14 pl-12 pr-14 rounded-2xl text-[15px] bg-background border border-border focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 shadow-sm transition-all" />
                                {q ? (
                                    <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
                                        <X size={15} />
                                    </button>
                                ) : (
                                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 h-7 min-w-7 px-2 rounded-lg border border-border bg-muted/60 text-xs font-semibold text-muted-foreground flex items-center justify-center">/</kbd>
                                )}
                            </div>
                            {recent.length > 0 ? (
                                <div className="mt-4 flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><History size={12} /> Recent</span>
                                    {recent.map(r => (
                                        <button key={r.id} type="button" onClick={() => openStudent(r.id)}
                                            className="inline-flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all">
                                            <span className="w-6 h-6 rounded-full overflow-hidden bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" /> : r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                            </span>
                                            <span className="text-xs font-semibold">{r.name.split(' ')[0]}</span>
                                            <span className="text-[10px] text-muted-foreground">{r.classDiv}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] text-muted-foreground mt-3">Works across every class. Press <kbd className="px-1 rounded border border-border text-[10px]">/</kbd> anywhere to search.</p>
                            )}
                        </div>
                        <CounterMachine today={today} />
                    </div>
                </div>

                <RecentCounter today={today} school={today?.receipts[0]?.student?.institutionName} onOpen={openStudent} />
                </div>

                {/* Right: search results */}
                <div className="rounded-2xl border border-border/60 bg-card flex flex-col overflow-hidden lg:min-h-0 min-h-[320px]" data-admin-surface="">
                    <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center gap-2">
                        <UserRoundSearch size={15} className="text-muted-foreground" />
                        <p className="text-sm font-bold flex-1">{term ? 'Results' : 'Student'}</p>
                        {term && !searching && <span className="text-[11px] font-semibold text-muted-foreground">{list.length} found</span>}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                        {!term ? (
                            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-6">
                                <div className="relative w-36 h-24 mb-4">
                                    {/* Stacked ID cards */}
                                    <div className="absolute inset-x-3 top-0 h-20 rounded-xl bg-primary/10 rotate-[-6deg]" />
                                    <div className="absolute inset-x-1 top-1 h-20 rounded-xl bg-primary/20 rotate-[4deg]" />
                                    <div className="absolute inset-0 top-2 h-20 rounded-xl bg-card border border-border shadow-md overflow-hidden">
                                        <div className="h-5" style={{ background: 'var(--primary)' }} />
                                        <div className="flex gap-2 p-2">
                                            <div className="w-8 h-8 rounded-lg bg-primary/20" />
                                            <div className="flex-1 space-y-1.5 pt-1"><div className="h-1.5 rounded bg-muted-foreground/30 w-3/4" /><div className="h-1.5 rounded bg-muted-foreground/20 w-1/2" /></div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm font-semibold">Search a student</p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">Their ID card shows up here with what they owe. Click it to open the fee card.</p>
                            </div>
                        ) : searching ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Searching...</div>
                        ) : list.length === 0 ? (
                            <div className="py-10 px-4 text-center">
                                <UserRoundSearch size={22} className="mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm font-semibold">No student found</p>
                                <p className="text-xs text-muted-foreground mt-1">Try the first name, the student ID, or the last digits of a parent&apos;s phone number.</p>
                            </div>
                        ) : (
                            list.map((st, i) => (
                                <motion.div key={st.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                                    <StudentIdCard student={st} onClick={() => openStudent(st.id, st)} footer={<DueStrip s={st} />} />
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
                </div>
            </div>
        );
    }

    // ── Student screen ──
    const s = account?.student;
    // On wide screens the page fits the window and only the fee card in the middle scrolls.
    return (
        <div className="flex flex-col gap-3 xl:h-full">
            <PageHeader title="Fee Counter" subtitle={s ? `${s.name} · Class ${classDivOf(s).classDiv}` : 'Opening fee card...'} onBack={closeStudent}>{todayChip}</PageHeader>

            {loadingAccount || !account ? (
                <div className="grid gap-3 lg:grid-cols-[350px_1fr_330px]">
                    {[0, 1, 2].map(i => <div key={i} className="h-80 rounded-2xl bg-muted/40 animate-pulse" />)}
                </div>
            ) : (
                <div className="grid gap-3 lg:grid-cols-[350px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)_330px] items-start xl:flex-1 xl:min-h-0 xl:items-stretch">
                    {/* Left: ID card, money ring, receipts */}
                    <div className="flex flex-col gap-3 xl:min-h-0">
                        <StudentIdCard student={account.student} />
                        <MoneyRing totals={account.totals} />
                        <ReceiptList receipts={account.receipts} onPrint={printReceipt} />
                    </div>

                    {/* Middle: the fee card */}
                    <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:rounded-2xl" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                        <FeeCard account={account} selected={selected} onToggle={toggle} canSelect={canCollect} />
                    </div>

                    {/* Right: collect */}
                    <div className="lg:col-span-2 xl:col-span-1 xl:min-h-0 xl:overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" data-admin-surface="">
                            <div className="relative px-4 pt-4 pb-3 text-white overflow-hidden" style={{ background: TERRACOTTA }}>
                                <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" />
                                {account.totals.balance > 0 && (
                                    <button type="button" onClick={() => setWa({})} title="Remind on WhatsApp"
                                        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white text-[11px] font-bold text-[#128C7E] shadow-sm hover:scale-105 transition-transform">
                                        <FaWhatsapp size={13} className="text-[#25D366]" /> Remind
                                    </button>
                                )}
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">Due now</p>
                                <p className="text-3xl font-bold leading-tight tabular-nums" style={{ fontFamily: 'var(--font-poppins)' }}>{inr(due)}</p>
                                <div className="flex flex-wrap gap-1 mt-1.5 min-h-[20px]">
                                    {chosen.length === 0
                                        ? <span className="text-[11px] text-white/80">Tick months on the fee card</span>
                                        : chosen.map(b => (
                                            <span key={b.feeMonthId} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20">{b.month} {inr(b.balance)}</span>
                                        ))}
                                </div>
                                {lastReminder && (
                                    <p className="relative text-[10px] text-white/85 mt-1.5 inline-flex items-center gap-1"><FaWhatsapp size={10} /> Reminded {timeAgo(lastReminder.createdAt)}</p>
                                )}
                            </div>

                            {!canCollect ? (
                                <div className="px-4 py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                    <Lock size={18} />
                                    {historical ? 'This is a past academic year. Fees are collected in the current year.' : 'Fees can be collected only in the current academic year.'}
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Amount received</p>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₹</span>
                                            <input inputMode="decimal" value={amountText ?? String(amount)} onChange={e => setAmountText(e.target.value.replace(/[^\d.]/g, ''))}
                                                disabled={!chosen.length}
                                                className="w-full h-12 pl-8 pr-3 rounded-xl border border-border bg-background text-xl font-bold tabular-nums focus:outline-none focus:border-foreground/30 disabled:opacity-50" />
                                        </div>
                                        {chosen.length > 0 && (plan.extra > 0
                                            ? <p className="text-[11px] text-red-600 mt-1">That is {inr(plan.extra)} more than what is due.</p>
                                            : leftDue > 0
                                                ? <p className="text-[11px] text-amber-600 mt-1">Part payment: {inr(leftDue)} will stay due.</p>
                                                : <p className="text-[11px] text-emerald-600 mt-1">Clears {chosen.length === 1 ? chosen[0].month : `${chosen.length} months`} fully.</p>)}
                                    </div>

                                    {discountOn ? (
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-[11px] font-semibold text-muted-foreground">Discount / waiver</p>
                                                <button type="button" onClick={() => { setDiscountOn(false); setDiscountText(''); setAmountText(null); }} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"><Minus size={11} /> Remove</button>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                                                <input inputMode="decimal" value={discountText} onChange={e => { setDiscountText(e.target.value.replace(/[^\d.]/g, '')); setAmountText(null); }}
                                                    placeholder="0" className="w-full h-9 pl-7 pr-3 rounded-lg border border-border bg-background text-sm font-semibold focus:outline-none focus:border-foreground/30" />
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" disabled={!chosen.length} onClick={() => setDiscountOn(true)}
                                            className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 disabled:opacity-40"><Plus size={12} /> Add discount</button>
                                    )}

                                    <div>
                                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Paid by</p>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {MODES.map(m => {
                                                const on = mode === m.key;
                                                const Icon = m.icon;
                                                return (
                                                    <button key={m.key} type="button" onClick={() => setMode(m.key)}
                                                        className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-semibold transition-all ${on ? 'shadow-sm' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                                                        style={on ? { borderColor: m.color, color: m.color, background: `${m.color}12` } : undefined}>
                                                        <Icon size={16} />
                                                        {m.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <AnimatePresence initial={false}>
                                            {modeOf(mode).refLabel && (
                                                <motion.input key="ref" initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 36, marginTop: 6 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                    value={reference} onChange={e => setReference(e.target.value)} placeholder={modeOf(mode).refLabel}
                                                    className="w-full px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:border-foreground/30" />
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="relative">
                                            <CalendarDays size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                            <input type="date" value={day} max={todayIST()} onChange={e => setDay(e.target.value || todayIST())}
                                                className="w-full h-9 pl-8 pr-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:border-foreground/30" />
                                        </label>
                                        <label className="relative">
                                            <StickyNote size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note"
                                                className="w-full h-9 pl-8 pr-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:border-foreground/30" />
                                        </label>
                                    </div>

                                    <button type="button" onClick={submit} disabled={saving || !plan.lines.length || plan.extra > 0}
                                        className="w-full h-11 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                                        style={{ background: TERRACOTTA }}>
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                                        Collect {inr(amount)}{discount > 0 ? ` + ${inr(discount)} off` : ''}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt printing popup */}
            <AnimatePresence>
                {done && (
                    <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDone(null)}>
                        <motion.div className="w-full max-w-[340px]" onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}>
                            <div className="relative z-10 h-4 -mx-2 rounded-md shadow-md" style={{ background: 'linear-gradient(180deg, #4A4E5E 0%, #262833 100%)' }} />
                            <div className="-mt-2 mx-1 overflow-hidden">
                                <motion.div initial={{ y: '-100%' }} animate={{ y: 0 }} transition={{ duration: 1.4, ease: [0.2, 0.7, 0.3, 1] }}>
                                    <PaperReceipt receipt={done} studentName={s?.name} classLabel={s ? classDivOf(s).classDiv : null} school={schoolName} />
                                </motion.div>
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <button type="button" onClick={() => printReceipt(done.id)}
                                    className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl text-sm font-bold text-white" style={{ background: TERRACOTTA }}>
                                    <Printer size={15} /> Print
                                </button>
                                <button type="button" onClick={() => setWa({ thanks: done })}
                                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-bold text-white" style={{ background: '#25D366' }}>
                                    <FaWhatsapp size={16} /> Send
                                </button>
                                <button type="button" onClick={() => { setDone(null); closeStudent(); }}
                                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100">
                                    Next student <ChevronRight size={15} />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {wa && waTarget && (
                    <ReminderComposer target={waTarget} onClose={() => setWa(null)}
                        thanks={wa.thanks ? { receipt: wa.thanks, balance: account?.totals.balance ?? 0 } : undefined}
                        onSent={last => { if (!wa.thanks) setReminded({ id: waTarget.studentId, last }); }} />
                )}
            </AnimatePresence>
        </div>
    );
}

/** Bottom strip on a search result card: what this student still owes. */
function DueStrip({ s }: { s: SearchStudent }) {
    const clear = s.balance <= 0;
    return (
        <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold"
            style={{ background: clear ? '#ECFDF5' : s.overdue > 0 ? '#FEF2F2' : '#FFFBEB', color: clear ? '#047857' : s.overdue > 0 ? '#B91C1C' : '#B45309' }}>
            <span>{clear ? 'All fees paid' : s.overdue > 0 ? `${inr(s.overdue)} overdue` : 'Nothing overdue'}</span>
            {!clear && <span className="opacity-80">{inr(s.balance)} left this year</span>}
        </div>
    );
}

/** Paid vs still due for the year, as a ring. */
function MoneyRing({ totals }: { totals: Account['totals'] }) {
    const pct = totals.total > 0 ? Math.min(1, totals.paid / totals.total) : 0;
    const r = 34, c = 2 * Math.PI * r;
    return (
        <div className="rounded-2xl border border-border/60 bg-card p-3 flex items-center gap-3" data-admin-surface="">
            <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0 -rotate-90">
                <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-muted/70" />
                <motion.circle cx="42" cy="42" r={r} fill="none" stroke="#10B981" strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 0.9, ease: 'easeOut' }} />
                <text x="42" y="47" textAnchor="middle" className="rotate-90 origin-center fill-foreground text-[15px] font-bold">{Math.round(pct * 100)}%</text>
            </svg>
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <Stat label="Year total" value={inr(totals.total)} />
                <Stat label="Paid" value={inr(totals.paid)} color="#059669" />
                <Stat label="Left" value={inr(totals.balance)} />
                <Stat label="Overdue" value={inr(totals.overdue)} color={totals.overdue > 0 ? '#DC2626' : undefined} />
            </div>
        </div>
    );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
            <p className="text-[13px] font-bold leading-tight truncate tabular-nums" style={{ color }}>{value}</p>
        </div>
    );
}

function ReceiptList({ receipts, onPrint }: { receipts: Receipt[]; onPrint: (id: string) => void }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden flex flex-col xl:flex-1 xl:min-h-0" data-admin-surface="">
            <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-border/40 shrink-0">
                <ReceiptText size={14} className="text-muted-foreground" />
                <p className="text-sm font-bold flex-1">Receipts</p>
                <span className="text-[11px] text-muted-foreground">{receipts.filter(r => !r.cancelled).length}</span>
            </div>
            {receipts.length === 0 ? (
                <p className="px-3.5 py-5 text-xs text-muted-foreground text-center">No payments yet this year</p>
            ) : (
                <div className="max-h-[260px] xl:max-h-none xl:flex-1 xl:min-h-0 overflow-y-auto divide-y divide-border/40" style={{ scrollbarWidth: 'thin' }}>
                    {receipts.map(r => {
                        const m = modeOf(r.mode);
                        const Icon = m.icon;
                        return (
                            <div key={r.id} className={`flex items-center gap-2.5 px-3.5 py-2 ${r.cancelled ? 'opacity-50' : ''}`}>
                                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.color}15`, color: m.color }}><Icon size={13} /></span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold tabular-nums ${r.cancelled ? 'line-through' : ''}`}>{inr(r.amount)}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{prettyDay(r.day)} · {r.lines.map(l => l.month.slice(0, 3)).join(', ')}{r.cancelled ? ' · Cancelled' : ''}</p>
                                </div>
                                <button type="button" onClick={() => onPrint(r.id)} title={`Print #${r.receiptNo}`}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><Printer size={13} /></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** Before a search: today's latest receipts as paper slips. */
function RecentCounter({ today, school, onOpen }: { today: DayBook | null; school?: string; onOpen: (id: string, card?: StudentIdCardData) => void }) {
    const recent = (today?.receipts ?? []).filter(r => !r.cancelled).slice(0, 6);
    if (!recent.length && today) return null;
    if (!recent.length) {
        return (
            <div className="flex flex-col items-center text-center py-8 text-muted-foreground">
                <Sparkles size={20} className="mb-2" />
                <p className="text-sm font-semibold text-foreground">The counter is open</p>
                <p className="text-xs mt-1 max-w-sm">Today&apos;s receipts will show up here as you collect fees.</p>
            </div>
        );
    }
    const tilts = [-1.4, 0.9, -0.5, 1.2, -0.8, 0.6];
    return (
        <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground mb-3 px-1"><ReceiptText size={15} className="text-[#DA7756]" /> Today at the counter</p>
            <div className="grid gap-5 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {recent.map((r, i) => (
                    <button key={r.id} type="button" onClick={() => r.student && onOpen(r.student.id, r.student)} className="text-left transition-transform hover:-translate-y-1">
                        <PaperReceipt receipt={r} studentName={r.student?.name} classLabel={r.student ? classDivOf(r.student).classDiv : null} school={school} tilt={tilts[i % tilts.length]} />
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Amount that rolls into place digit by digit, like a counting machine. */
function Odometer({ value }: { value: string }) {
    const chars = value.split('');
    const digits = chars.filter(c => /\d/.test(c)).length;
    let n = 0;
    return (
        <span className="inline-flex items-start" aria-label={value}>
            {chars.map((ch, i) => {
                if (!/\d/.test(ch)) return <span key={i} className="inline-block" style={{ height: '1.15em', lineHeight: '1.15em' }}>{ch}</span>;
                const order = n++;
                return <RollingDigit key={i} d={Number(ch)} delay={(digits - order) * 0.07} />;
            })}
        </span>
    );
}

function RollingDigit({ d, delay }: { d: number; delay: number }) {
    const turns = 2; // full spins before it lands
    const H = 1.15;
    return (
        <span className="relative inline-block overflow-hidden" style={{ height: `${H}em`, width: '1ch' }} aria-hidden>
            <motion.span className="absolute left-0 top-0 flex flex-col" initial={{ y: 0 }} animate={{ y: `-${(turns * 10 + d) * H}em` }}
                transition={{ duration: 1.1, delay, ease: [0.15, 0.75, 0.25, 1] }}>
                {Array.from({ length: (turns + 1) * 10 }, (_, k) => (
                    <span key={k} className="block text-center" style={{ height: `${H}em`, lineHeight: `${H}em` }}>{k % 10}</span>
                ))}
            </motion.span>
        </span>
    );
}

/** A little cash-counter machine with today's total on its screen and the last receipt coming out. */
function CounterMachine({ today }: { today: DayBook | null }) {
    const last = (today?.receipts ?? []).find(r => !r.cancelled) ?? null;
    const byMode = today?.totals.byMode;
    const total = today?.totals.amount ?? 0;
    return (
        <div className="relative hidden xl:flex flex-col items-center justify-end pt-10">
            {/* Paper slip coming out of the top */}
            <motion.div key={last?.id ?? 'none'} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute top-0 w-[62%] z-0 px-3 pt-2 pb-5 font-mono text-[10px] leading-[1.5] text-[#2A2A33] rounded-t-sm shadow-md"
                style={{ background: 'linear-gradient(180deg, #FFFDF6, #F6F0E2)' }}>
                {last ? (
                    <>
                        <p className="font-bold tracking-wider">#{last.receiptNo}</p>
                        <p className="flex justify-between gap-2"><span className="truncate uppercase">{last.student?.name ?? 'Student'}</span><span className="font-bold shrink-0">{inr(last.amount)}</span></p>
                    </>
                ) : (
                    <>
                        <p className="font-bold tracking-wider">READY</p>
                        <p className="opacity-60">WAITING FOR THE FIRST RECEIPT</p>
                    </>
                )}
            </motion.div>
            {/* Machine body */}
            <div className="relative z-10 w-full rounded-[20px] p-2.5 shadow-xl" style={{ background: 'linear-gradient(160deg, #3A3D4A 0%, #22242D 60%, #1A1B22 100%)' }}>
                <div className="h-1.5 mx-10 mb-2 rounded-full bg-black/60" />
                {/* Screen */}
                <div className="rounded-xl px-3.5 py-2.5 font-mono" style={{ background: 'linear-gradient(180deg, #0E1A14, #0A120E)', boxShadow: 'inset 0 0 0 1px rgba(110,231,183,0.15), inset 0 6px 18px rgba(0,0,0,0.6)' }}>
                    <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-emerald-300/60">
                        <span>TODAY</span><span>{today?.totals.count ?? 0} RCPT</span>
                    </div>
                    <p className="text-[25px] leading-tight font-bold text-emerald-300 tabular-nums" style={{ textShadow: '0 0 12px rgba(110,231,183,0.45)' }}>{today ? <Odometer key={total} value={inr(total)} /> : '₹-'}</p>
                    <div className="flex gap-1 mt-1.5 h-1.5">
                        {MODES.map(m => {
                            const v = byMode?.[m.key] ?? 0;
                            return v > 0 ? <span key={m.key} title={`${m.label} ${inr(v)}`} className="rounded-full" style={{ flex: v, background: m.color }} /> : null;
                        })}
                        {!total && <span className="flex-1 rounded-full bg-emerald-300/10" />}
                    </div>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5 text-[9px] text-emerald-200/60">
                        {MODES.filter(m => (byMode?.[m.key] ?? 0) > 0).map(m => <span key={m.key}>{m.label.toUpperCase()} {inr(byMode![m.key])}</span>)}
                        {!total && <span>NO PAYMENTS YET</span>}
                    </div>
                </div>
                {/* Keypad */}
                <div className="grid grid-cols-4 gap-1 mt-2">
                    {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '00', '.', '='].map((k, i) => (
                        <span key={i} className={`h-5 rounded-md text-[10px] font-semibold flex items-center justify-center select-none ${k === '=' ? 'text-white' : 'text-white/60'}`}
                            style={{ background: k === '=' ? TERRACOTTA : 'linear-gradient(180deg, #4A4D5A, #34363F)', boxShadow: '0 2px 0 rgba(0,0,0,0.35)' }}>{k}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}
