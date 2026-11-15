'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, ScanLine, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Pill, PrimaryButton, SecondaryButton, SmallButton, inputCls } from '@/app/admin/payroll/_components/ui';
import Scanner from './Scanner';
import { BORROWER_LABEL, dateLabel, rupees, type Fine, type Member, type OpenLoan } from './types';

const BOOK_CODE = /^LIB-/;
type Condition = 'OK' | 'DAMAGED' | 'LOST';
interface MemberView { member: Member; loans: OpenLoan[]; loadedAt: number }

export default function IssueReturn({ rulesConfigured }: { rulesConfigured: boolean }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const busyRef = useRef(false);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<MemberView | null>(null);
    const [camera, setCamera] = useState(false);
    const [note, setNote] = useState('');

    const focus = () => setTimeout(() => inputRef.current?.focus(), 0);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const loadMember = useCallback(async (code: string) => {
        const res = await api.get(`/admin/library/members/${encodeURIComponent(code)}`);
        setView({ ...(res.data.data as Omit<MemberView, 'loadedAt'>), loadedAt: Date.now() });
    }, []);

    const reportFines = (fines: Fine[]) =>
        fines.length ? ` Fine: ${fines.map((f) => `${f.kind.toLowerCase()} ${rupees(f.amountPaise)}`).join(', ')}.` : '';

    const returnBook = useCallback(async (code: string) => {
        const res = await api.post('/admin/library/return', { copyCode: code });
        const who = (res.data.data.borrower as { name?: string } | undefined)?.name;
        const msg = `Returned ${code}${who ? ` from ${who}` : ''}.${reportFines(res.data.data.fines as Fine[])}`;
        setNote(msg);
        toast.success(msg);
    }, []);

    const process = useCallback(async (raw: string) => {
        const code = raw.trim().toUpperCase();
        if (!code || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        try {
            if (!BOOK_CODE.test(code)) {
                await loadMember(code);
                setNote('');
            } else if (!view) {
                await returnBook(code);
            } else if (view.loans.some((l) => l.copy.accessionCode === code)) {
                await returnBook(code);
                await loadMember(view.member.code);
            } else {
                try {
                    const res = await api.post('/admin/library/issue', { memberCode: view.member.code, copyCode: code });
                    const msg = `Issued ${code} to ${view.member.name}. Due ${dateLabel(res.data.data.dueAt)}.`;
                    setNote(msg);
                    toast.success(msg);
                } catch (err) {
                    // Scanning a book that is out with someone else means it is being handed back.
                    const failure = err as { response?: { status?: number; data?: { message?: string } } };
                    if (failure.response?.status === 409 && /is issued/i.test(failure.response.data?.message ?? '')) await returnBook(code);
                    else throw err;
                }
                await loadMember(view.member.code);
            }
        } catch (err) {
            const msg = getErrorMessage(err, 'Something went wrong');
            setNote(msg);
            toast.error(msg);
        } finally {
            busyRef.current = false;
            setBusy(false);
            setText('');
            focus();
        }
    }, [view, loadMember, returnBook]);

    const act = async (path: 'return' | 'renew', loan: OpenLoan, condition: Condition = 'OK') => {
        if (!view || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        try {
            const res = await api.post(`/admin/library/${path}`, path === 'return' ? { copyCode: loan.copy.accessionCode, condition } : { copyCode: loan.copy.accessionCode });
            const msg = path === 'return'
                ? `Returned ${loan.copy.book.title}.${reportFines(res.data.data.fines as Fine[])}`
                : `Renewed ${loan.copy.book.title}. New due date ${dateLabel(res.data.data.dueAt)}.`;
            setNote(msg);
            toast.success(msg);
            await loadMember(view.member.code);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Something went wrong'));
        } finally {
            busyRef.current = false;
            setBusy(false);
            focus();
        }
    };

    const stage = view ? 'Scan or type a book code to issue it' : 'Scan a member card to start, or scan a book code to return it';

    return (
        <div className="max-w-3xl space-y-4">
            {!rulesConfigured && (
                <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Library rules are not set up yet. Issuing is disabled until they are saved in Settings. Returns still work.</p>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void process(text); }} className="flex gap-2">
                <div className="relative flex-1">
                    <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} autoFocus autoComplete="off" autoCapitalize="characters"
                        placeholder={stage} aria-label="Member or book code" className={`${inputCls} h-11 pl-9 text-base`} />
                </div>
                <PrimaryButton type="submit" disabled={busy || !text.trim()} className="h-11 px-5">{busy ? <Loader2 size={14} className="animate-spin" /> : 'Go'}</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setCamera((c) => !c)} className="h-11" aria-pressed={camera}><Camera size={15} />Scan</SecondaryButton>
            </form>

            {camera && <Scanner onCode={(c) => void process(c)} onClose={() => { setCamera(false); focus(); }} />}

            {note && <p className="text-sm rounded-xl border border-border bg-card px-3 py-2" role="status">{note}</p>}

            {view && (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><UserRound size={18} /></div>
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{view.member.name}</p>
                            <p className="text-xs text-muted-foreground">{view.member.code} · {BORROWER_LABEL[view.member.borrowerType]}</p>
                        </div>
                        {!view.member.isActive && <Pill tone="red">Deactivated</Pill>}
                        <Pill tone="primary">{view.loans.length} book{view.loans.length === 1 ? '' : 's'} out</Pill>
                        <SmallButton type="button" onClick={() => { setView(null); setNote(''); focus(); }}><X size={12} /> Clear</SmallButton>
                    </div>

                    {view.loans.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No books are out with this member.</p>
                    ) : (
                        <ul className="divide-y divide-border/60">
                            {view.loans.map((loan) => {
                                const overdue = new Date(loan.dueAt).getTime() < view.loadedAt;
                                return (
                                    <li key={loan.id} className="py-2.5 flex flex-wrap items-center gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{loan.copy.book.title}</p>
                                            <p className="text-xs text-muted-foreground">{loan.copy.accessionCode} · due {dateLabel(loan.dueAt)}{loan.renewals ? ` · renewed ${loan.renewals}×` : ''}</p>
                                        </div>
                                        {overdue && <Pill tone="red">Overdue</Pill>}
                                        <SmallButton type="button" disabled={busy} onClick={() => void act('renew', loan)}><RefreshCw size={12} /> Renew</SmallButton>
                                        <SmallButton type="button" disabled={busy} onClick={() => void act('return', loan)}>Return</SmallButton>
                                        <SmallButton type="button" disabled={busy} onClick={() => void act('return', loan, 'DAMAGED')}>Damaged</SmallButton>
                                        <SmallButton type="button" disabled={busy} onClick={() => void act('return', loan, 'LOST')}>Lost</SmallButton>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
