'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Field, inputCls, PrimaryButton } from '@/app/admin/payroll/_components/ui';
import { BORROWER_LABEL, fromPaise, toPaise, type BorrowerType, type FinesMode, type LibrarySettings } from './types';

const TYPES: BorrowerType[] = ['STUDENT', 'TEACHER', 'STAFF'];

interface RuleForm { maxBooks: string; loanDays: string; maxRenewals: string; fine: string; graceDays: string; cap: string }
const blankRule: RuleForm = { maxBooks: '', loanDays: '', maxRenewals: '', fine: '', graceDays: '', cap: '' };

const FINE_MODES: { key: FinesMode; label: string; text: string }[] = [
    { key: 'OFF', label: 'No fines', text: 'Late, lost and damaged books are never charged.' },
    { key: 'LIBRARIAN', label: 'Librarian collects', text: 'Fines are recorded and the librarian marks them paid at the desk.' },
    { key: 'FEES', label: 'Added to student fees', text: 'Students see fines as library dues alongside fees. Teachers and staff still pay at the library desk.' },
];

export default function SettingsPanel({ onSaved }: { onSaved: (configured: boolean) => void }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [rules, setRules] = useState<Record<BorrowerType, RuleForm>>({ STUDENT: blankRule, TEACHER: blankRule, STAFF: blankRule });
    const [finesMode, setFinesMode] = useState<FinesMode>('OFF');
    const [dueSoonDays, setDueSoonDays] = useState('2');
    const [lost, setLost] = useState('');
    const [damaged, setDamaged] = useState('');

    const apply = useCallback((s: LibrarySettings) => {
        setConfigured(s.rulesConfigured);
        setFinesMode(s.finesMode);
        setDueSoonDays(String(s.dueSoonDays));
        setLost(s.rulesConfigured ? fromPaise(s.lostChargePaise) : '');
        setDamaged(s.rulesConfigured ? fromPaise(s.damagedChargePaise) : '');
        const next = {} as Record<BorrowerType, RuleForm>;
        for (const t of TYPES) {
            const r = s.rules[t];
            next[t] = r
                ? { maxBooks: String(r.maxBooks), loanDays: String(r.loanDays), maxRenewals: String(r.maxRenewals), fine: fromPaise(r.finePerDayPaise), graceDays: String(r.graceDays), cap: fromPaise(r.fineCapPaise) }
                : blankRule;
        }
        setRules(next);
    }, []);

    useEffect(() => {
        api.get('/admin/library/settings')
            .then((res) => apply(res.data.data as LibrarySettings))
            .catch((err) => toast.error(getErrorMessage(err, 'Could not load library settings')))
            .finally(() => setLoading(false));
    }, [apply]);

    const setRule = (type: BorrowerType, key: keyof RuleForm, value: string) =>
        setRules((prev) => ({ ...prev, [type]: { ...prev[type], [key]: value } }));

    const save = async () => {
        const body = {
            finesMode,
            dueSoonDays: Number(dueSoonDays || 0),
            lostChargePaise: toPaise(lost),
            damagedChargePaise: toPaise(damaged),
            rules: {} as Record<BorrowerType, unknown>,
        };
        for (const t of TYPES) {
            const r = rules[t];
            if ([r.maxBooks, r.loanDays, r.maxRenewals, r.graceDays].some((v) => v.trim() === '') || (finesMode !== 'OFF' && r.fine.trim() === '')) {
                toast.error(`Fill in every rule for ${BORROWER_LABEL[t].toLowerCase()}`);
                return;
            }
            body.rules[t] = {
                maxBooks: Number(r.maxBooks), loanDays: Number(r.loanDays), maxRenewals: Number(r.maxRenewals),
                finePerDayPaise: toPaise(r.fine), graceDays: Number(r.graceDays), fineCapPaise: r.cap.trim() === '' ? null : toPaise(r.cap),
            };
        }
        setSaving(true);
        try {
            const res = await api.put('/admin/library/settings', body);
            apply(res.data.data as LibrarySettings);
            onSaved(true);
            toast.success('Library settings saved');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not save settings'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>;

    return (
        <div className="max-w-4xl space-y-6 pb-10">
            {!configured && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                    <p>Set up your library rules before issuing books. Every institution has its own limits, so nothing is pre-filled. Changes apply to new issues and renewals; books already issued keep their due dates.</p>
                </div>
            )}

            <section className="space-y-3">
                <h2 className="text-sm font-bold">Borrowing rules</h2>
                <div className="grid gap-4 lg:grid-cols-3">
                    {TYPES.map((t) => (
                        <div key={t} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                            <p className="text-sm font-semibold">{BORROWER_LABEL[t]}</p>
                            <Field label="Books at a time"><input className={inputCls} inputMode="numeric" value={rules[t].maxBooks} onChange={(e) => setRule(t, 'maxBooks', e.target.value.replace(/\D/g, ''))} /></Field>
                            <Field label="Loan days"><input className={inputCls} inputMode="numeric" value={rules[t].loanDays} onChange={(e) => setRule(t, 'loanDays', e.target.value.replace(/\D/g, ''))} /></Field>
                            <Field label="Renewals allowed"><input className={inputCls} inputMode="numeric" value={rules[t].maxRenewals} onChange={(e) => setRule(t, 'maxRenewals', e.target.value.replace(/\D/g, ''))} /></Field>
                            <Field label="Fine per late day (₹)" hint={finesMode === 'OFF' ? 'Not used while fines are off' : undefined}><input className={inputCls} inputMode="decimal" value={rules[t].fine} onChange={(e) => setRule(t, 'fine', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                            <Field label="Grace days"><input className={inputCls} inputMode="numeric" value={rules[t].graceDays} onChange={(e) => setRule(t, 'graceDays', e.target.value.replace(/\D/g, ''))} /></Field>
                            <Field label="Maximum fine per book (₹)" hint="Leave empty for no cap"><input className={inputCls} inputMode="decimal" value={rules[t].cap} onChange={(e) => setRule(t, 'cap', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-bold">Fines</h2>
                <div className="grid gap-2 md:grid-cols-3">
                    {FINE_MODES.map((m) => (
                        <button key={m.key} type="button" onClick={() => setFinesMode(m.key)} aria-pressed={finesMode === m.key}
                            className={`text-left rounded-2xl border p-3 transition-all ${finesMode === m.key ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/50'}`}>
                            <p className="text-sm font-semibold">{m.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{m.text}</p>
                        </button>
                    ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
                    <Field label="Lost book charge (₹)" hint="Charged when a book is returned as lost"><input className={inputCls} inputMode="decimal" value={lost} onChange={(e) => setLost(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                    <Field label="Damaged book charge (₹)"><input className={inputCls} inputMode="decimal" value={damaged} onChange={(e) => setDamaged(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-bold">Reminders</h2>
                <div className="max-w-xs">
                    <Field label="Remind borrowers this many days before the due date" hint="Overdue reminders are sent daily until the book is returned">
                        <input className={inputCls} inputMode="numeric" value={dueSoonDays} onChange={(e) => setDueSoonDays(e.target.value.replace(/\D/g, ''))} />
                    </Field>
                </div>
            </section>

            <PrimaryButton onClick={save} disabled={saving} className="h-9 px-5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save settings
            </PrimaryButton>
        </div>
    );
}
