'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Check, Save, Landmark, HeartPulse, Receipt, Plus, X, Percent, CalendarCheck } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { DayBasis, formatINR } from '@/lib/payroll';
import { PageHeader, PrimaryButton, Field, inputCls, TERRACOTTA, Toggle, Segmented, ThemedSelect } from '../_components/ui';

const BASIS_OPTIONS: { value: DayBasis; title: string; text: string }[] = [
    { value: 'CALENDAR', title: 'Actual days in month', text: 'One day = monthly salary ÷ 28 / 30 / 31, depending on the month.' },
    { value: 'FIXED_30', title: 'Fixed 30 days', text: 'One day = monthly salary ÷ 30, every month.' },
    { value: 'FIXED_26', title: 'Fixed 26 days', text: 'One day = monthly salary ÷ 26 (Sundays not counted).' },
];

// Worked example shown under the choice so the accountant sees what it means.
const EXAMPLE_SALARY = 3000000; // ₹30,000

export default function PayrollSettingsPage() {
    const [dayBasis, setDayBasis] = useState<DayBasis>('CALENDAR');
    // Kept as text so the field can be cleared and typed into freely;
    // validated (1 to 28) only on blur / save.
    const [payDay, setPayDay] = useState('1');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Provident Fund. Rates/amounts kept as text for free typing; money in rupees, rates in %.
    const [pfEnabled, setPfEnabled] = useState(false);
    const [pfCapWages, setPfCapWages] = useState(true);
    const [pf, setPf] = useState({ ceiling: '25000', employee: '12', employer: '12', eps: '8.33', edli: '0.5', admin: '0.5' });
    const setPfField = (k: keyof typeof pf) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setPf(v => ({ ...v, [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 9) }));

    // ESI (money in rupees, rates in %) and Professional Tax slabs (rupees).
    const [esiEnabled, setEsiEnabled] = useState(false);
    const [esi, setEsi] = useState({ limit: '21000', employee: '0.75', employer: '3.25' });
    const setEsiField = (k: keyof typeof esi) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setEsi(v => ({ ...v, [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 9) }));
    const [ptEnabled, setPtEnabled] = useState(false);
    const [tdsEnabled, setTdsEnabled] = useState(false);
    const [ptState, setPtState] = useState<'MAHARASHTRA' | 'CUSTOM'>('MAHARASHTRA');
    const [ptSlabs, setPtSlabs] = useState<{ from: string; amount: string; feb: string }[]>([{ from: '0', amount: '0', feb: '' }]);

    // Staff attendance -> LOP
    const [att, setAtt] = useState({ lopEnabled: false, officeStart: '08:00', grace: '10', halfDayHours: '4', weeklyOffDays: [0] as number[], offSaturdays: [] as number[], lateRuleEnabled: false, lateRuleCount: '3' });
    const toggleIn = (list: number[], n: number) => (list.includes(n) ? list.filter(x => x !== n) : [...list, n].sort());

    useEffect(() => {
        api.get('/admin/payroll/settings')
            .then(res => {
                const d = res.data.data;
                setDayBasis(d.dayBasis); setPayDay(String(d.payDay));
                setPfEnabled(!!d.pfEnabled);
                setEsiEnabled(!!d.esiEnabled);
                if (d.esi) setEsi({ limit: String(d.esi.wageLimit / 100), employee: String(d.esi.employeeRate / 100), employer: String(d.esi.employerRate / 100) });
                setPtEnabled(!!d.ptEnabled);
                setTdsEnabled(!!d.tdsEnabled);
                if (d.attendance) {
                    const a = d.attendance;
                    setAtt({ lopEnabled: !!a.lopEnabled, officeStart: a.officeStart, grace: String(a.graceMinutes), halfDayHours: String(a.halfDayMinutes / 60),
                        weeklyOffDays: a.weeklyOffDays ?? [0], offSaturdays: a.offSaturdays ?? [], lateRuleEnabled: !!a.lateRuleEnabled, lateRuleCount: String(a.lateRuleCount) });
                }
                setPtState(d.ptState === 'CUSTOM' ? 'CUSTOM' : 'MAHARASHTRA');
                if (d.ptState === 'CUSTOM' && d.pt?.slabs?.length) {
                    setPtSlabs(d.pt.slabs.map((sl: { from: number; amount: number; febAmount?: number | null }) => ({
                        from: String(sl.from / 100), amount: String(sl.amount / 100), feb: sl.febAmount ? String(sl.febAmount / 100) : '',
                    })));
                }
                if (d.pf) {
                    setPfCapWages(d.pf.capWages);
                    setPf({
                        ceiling: String(d.pf.ceiling / 100), employee: String(d.pf.employeeRate / 100), employer: String(d.pf.employerRate / 100),
                        eps: String(d.pf.epsRate / 100), edli: String(d.pf.edliRate / 100), admin: String(d.pf.adminRate / 100),
                    });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const payDayNum = Number(payDay);
    const payDayValid = Number.isInteger(payDayNum) && payDayNum >= 1 && payDayNum <= 28;

    const save = async () => {
        if (!payDayValid) { toast.error('Salary day must be between 1 and 28'); return; }
        setSaving(true);
        try {
            const pct = (v: string) => Math.round(Number(v || 0) * 100); // % -> basis points
            await api.put('/admin/payroll/settings', {
                dayBasis, payDay: payDayNum,
                pfEnabled, pfCapWages,
                pfCeiling: Math.round(Number(pf.ceiling || 0) * 100),
                pfEmployeeRate: pct(pf.employee), pfEmployerRate: pct(pf.employer), pfEpsRate: pct(pf.eps),
                pfEdliRate: pct(pf.edli), pfAdminRate: pct(pf.admin),
                esiEnabled,
                esiWageLimit: Math.round(Number(esi.limit || 0) * 100),
                esiEmployeeRate: pct(esi.employee), esiEmployerRate: pct(esi.employer),
                ptEnabled, ptState, tdsEnabled,
                attendanceLop: att.lopEnabled, officeStart: att.officeStart || '08:00',
                graceMinutes: Math.min(180, Math.max(0, Math.round(Number(att.grace || 0)))),
                halfDayMinutes: Math.min(720, Math.max(30, Math.round(Number(att.halfDayHours || 4) * 60))),
                weeklyOffDays: att.weeklyOffDays, offSaturdays: att.offSaturdays,
                lateRuleEnabled: att.lateRuleEnabled, lateRuleCount: Math.min(31, Math.max(1, Math.round(Number(att.lateRuleCount || 3)))),
                // Maharashtra uses the built-in slabs ([] = preset); Custom sends the table.
                ptSlabs: ptState === 'CUSTOM'
                    ? ptSlabs.filter(r => r.from !== '').map(r => ({
                        from: Math.round(Number(r.from || 0) * 100), amount: Math.round(Number(r.amount || 0) * 100),
                        febAmount: r.feb ? Math.round(Number(r.feb) * 100) : null,
                    }))
                    : [],
            });
            toast.success('Payroll settings saved');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save settings'));
        } finally {
            setSaving(false);
        }
    };

    const exampleDays = dayBasis === 'FIXED_26' ? 26 : 30;
    const perDay = Math.round(EXAMPLE_SALARY / exampleDays);

    if (loading) return <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" />;

    return (
        <div className="space-y-3">
            <PageHeader title="Payroll Settings" subtitle="How salary is worked out for your school">
                <PrimaryButton onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</PrimaryButton>
            </PageHeader>

            <div className="grid gap-4 lg:grid-cols-3">
            <section className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div>
                    <p className="text-sm font-semibold">One day&apos;s salary</p>
                    <p className="text-xs text-muted-foreground">Used when someone takes unpaid leave (LOP) or joins / leaves in the middle of a month.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {BASIS_OPTIONS.map(opt => {
                        const active = dayBasis === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setDayBasis(opt.value)}
                                className={`relative text-left rounded-xl border p-3.5 transition-all ${active ? 'border-foreground/40 bg-muted/40' : 'border-border hover:border-foreground/30'}`}
                            >
                                {active && <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full text-white flex items-center justify-center" style={{ background: TERRACOTTA }}><Check size={12} /></span>}
                                <p className="text-sm font-semibold pr-6">{opt.title}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">{opt.text}</p>
                            </button>
                        );
                    })}
                </div>
                <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                    Example: salary {formatINR(EXAMPLE_SALARY)}, 2 days unpaid leave in a 30-day month →
                    one day = <span className="font-semibold text-foreground">{formatINR(perDay)}</span>, cut =
                    <span className="font-semibold text-foreground"> {formatINR(perDay * 2)}</span>.
                </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-primary" />
                    <p className="text-sm font-semibold">Salary day</p>
                </div>
                <Field label="Salary is usually paid on" hint="Day of the month (1 to 28)">
                    <input type="text" inputMode="numeric" maxLength={2} placeholder="1 to 28"
                        className={`${inputCls} ${payDay !== '' && !payDayValid ? 'border-red-500 focus:ring-red-500/30' : ''}`}
                        value={payDay}
                        onChange={e => setPayDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onBlur={() => { if (payDay !== '' && !payDayValid) setPayDay(String(Math.min(28, Math.max(1, payDayNum)))); }} />
                </Field>
            </section>
            </div>

            {/* ── Provident Fund ── */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-primary" />
                    <p className="text-sm font-semibold">Provident Fund (PF)</p>
                </div>
                <Toggle checked={pfEnabled} onChange={setPfEnabled} label="Deduct PF at this school"
                    hint="12% of Basic + DA is deducted from salary, and the school adds its own 12% (pension EPS + EPF). You can switch PF off for individual staff on the Staff page." />

                {pfEnabled && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">PF is worked out on</p>
                            <Segmented<'cap' | 'full'>
                                value={pfCapWages ? 'cap' : 'full'}
                                options={[{ value: 'cap', label: 'Wages up to the ceiling (usual)' }, { value: 'full', label: 'Full wages' }]}
                                onChange={v => setPfCapWages(v === 'cap')}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <Field label="Wage ceiling (₹ / month)" hint="EPFO: ₹25,000 from 17 Sep 2026"><input className={inputCls} inputMode="decimal" value={pf.ceiling} onChange={setPfField('ceiling')} /></Field>
                            <Field label="Employee share (%)"><input className={inputCls} inputMode="decimal" value={pf.employee} onChange={setPfField('employee')} /></Field>
                            <Field label="School share (%)"><input className={inputCls} inputMode="decimal" value={pf.employer} onChange={setPfField('employer')} /></Field>
                            <Field label="of which pension EPS (%)" hint="Always on wages up to the ceiling"><input className={inputCls} inputMode="decimal" value={pf.eps} onChange={setPfField('eps')} /></Field>
                            <Field label="EDLI (%)"><input className={inputCls} inputMode="decimal" value={pf.edli} onChange={setPfField('edli')} /></Field>
                            <Field label="Admin charges (%)"><input className={inputCls} inputMode="decimal" value={pf.admin} onChange={setPfField('admin')} /></Field>
                        </div>
                        <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                            {(() => {
                                const wages = 3000000; // ₹30,000 Basic + DA
                                const ceil = Math.round(Number(pf.ceiling || 0) * 100);
                                const base = pfCapWages ? Math.min(wages, ceil) : wages;
                                const emp = Math.round(base * Number(pf.employee || 0) / 100);
                                const eps = Math.round(Math.min(wages, ceil) * Number(pf.eps || 0) / 100);
                                const er = Math.round(base * Number(pf.employer || 0) / 100);
                                return <>Example: Basic + DA {formatINR(wages)} → deducted from salary <span className="font-semibold text-foreground">{formatINR(emp)}</span>; school pays <span className="font-semibold text-foreground">{formatINR(er)}</span> ({formatINR(eps)} pension + {formatINR(Math.max(0, er - eps))} EPF) plus EDLI and admin charges.</>;
                            })()}
                        </div>
                        <p className="text-[11px] text-muted-foreground">Which salary parts count for PF: Basic always; tick &quot;Counts for PF&quot; on others like DA in Components. These rates are the current EPFO rules; update them here if the rules change.</p>
                    </div>
                )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
            {/* ── ESI ── */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <HeartPulse size={16} className="text-primary" />
                    <p className="text-sm font-semibold">ESI</p>
                </div>
                <Toggle checked={esiEnabled} onChange={setEsiEnabled} label="Deduct ESI at this school"
                    hint="For staff whose normal monthly gross is up to the limit: 0.75% is deducted and the school adds 3.25%. Staff earning ₹176 a day or less don't pay their share, only the school does." />
                {esiEnabled && (
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Gross limit (₹ / month)"><input className={inputCls} inputMode="decimal" value={esi.limit} onChange={setEsiField('limit')} /></Field>
                        <Field label="Employee share (%)"><input className={inputCls} inputMode="decimal" value={esi.employee} onChange={setEsiField('employee')} /></Field>
                        <Field label="School share (%)"><input className={inputCls} inputMode="decimal" value={esi.employer} onChange={setEsiField('employer')} /></Field>
                    </div>
                )}
            </section>

            {/* ── Professional Tax ── */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-primary" />
                    <p className="text-sm font-semibold">Professional Tax (PT)</p>
                </div>
                <Toggle checked={ptEnabled} onChange={setPtEnabled} label="Deduct Professional Tax by state slab"
                    hint="Worked out every month from the salary earned. Any old fixed &quot;Professional Tax&quot; component is skipped automatically so it isn't cut twice." />
                {ptEnabled && (
                    <div className="space-y-3">
                        <Field label="State">
                            <ThemedSelect<'MAHARASHTRA' | 'CUSTOM'> value={ptState} onChange={setPtState}
                                options={[{ value: 'MAHARASHTRA', label: 'Maharashtra' }, { value: 'CUSTOM', label: 'Other state (enter slabs)' }]} />
                        </Field>
                        {ptState === 'MAHARASHTRA' ? (
                            <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
                                <p>Up to ₹7,500: nil · ₹7,501 to ₹10,000: ₹175 · Above ₹10,000: ₹200 (₹300 in February) · ₹2,500 a year.</p>
                                <p>Women earning up to ₹25,000 a month are exempt: turn PT off for them on the Staff page.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 text-[11px] font-semibold text-muted-foreground">
                                    <span>Monthly salary from (₹)</span><span>PT (₹)</span><span>In February (₹, optional)</span><span />
                                </div>
                                {ptSlabs.map((r, i) => (
                                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2">
                                        {(['from', 'amount', 'feb'] as const).map(k => (
                                            <input key={k} className={inputCls} inputMode="decimal" value={r[k]}
                                                onChange={e => setPtSlabs(rows => rows.map((x, j) => j === i ? { ...x, [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 9) } : x))} />
                                        ))}
                                        <button type="button" onClick={() => setPtSlabs(rows => rows.filter((_, j) => j !== i))}
                                            className="h-9 flex items-center justify-center text-muted-foreground hover:text-red-500"><X size={14} /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setPtSlabs(rows => [...rows, { from: '', amount: '', feb: '' }])}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><Plus size={12} /> Add slab</button>
                                <p className="text-[11px] text-muted-foreground">Each row: salary from this amount upwards pays this PT (the highest matching row is used). Check your state&apos;s current slabs.</p>
                            </div>
                        )}
                    </div>
                )}
            </section>
            </div>

            {/* ── Income tax (TDS) ── */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <Percent size={16} className="text-primary" />
                    <p className="text-sm font-semibold">Income tax (TDS)</p>
                </div>
                <Toggle checked={tdsEnabled} onChange={setTdsEnabled} label="Deduct income tax (TDS) from salary"
                    hint="Every month the whole year's salary (April to March) is estimated, the tax on it worked out, and what's left after TDS already cut is spread over the remaining months. New regime by default; choose the old regime and add declarations per person on the Staff page." />
                {tdsEnabled && (
                    <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
                        <p>New regime (FY 2026-27): no tax up to ₹12.75L salary a year (₹75,000 standard deduction + rebate). Slabs 5% to 30% above ₹4L.</p>
                        <p>Old regime: ₹50,000 standard deduction, PT, 80C (employee PF counts, max ₹1.5L), 80D, HRA and other deductions from the declaration.</p>
                        <p>No PAN: TDS is at least 20%. Staff aged 60+ (old regime special slabs) are not handled yet.</p>
                    </div>
                )}
            </section>

            {/* ── Staff attendance -> LOP ── */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <CalendarCheck size={16} className="text-primary" />
                    <p className="text-sm font-semibold">Attendance</p>
                </div>
                <Toggle checked={att.lopEnabled} onChange={v => setAtt(a => ({ ...a, lopEnabled: v }))} label="Take LOP days from staff attendance"
                    hint="A new payroll fills each person's LOP from Payroll → Attendance: absent + unpaid leave + half days × 0.5. You can still change the number in LOP & bonus. Days not marked count as present." />
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Office starts at" hint="Check-in after this + grace = Late">
                        <input type="time" className={inputCls} value={att.officeStart} onChange={e => setAtt(a => ({ ...a, officeStart: e.target.value }))} />
                    </Field>
                    <Field label="Grace time (minutes)">
                        <input className={inputCls} inputMode="numeric" value={att.grace} onChange={e => setAtt(a => ({ ...a, grace: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
                    </Field>
                    <Field label="Half day if worked less than (hours)">
                        <input className={inputCls} inputMode="decimal" value={att.halfDayHours} onChange={e => setAtt(a => ({ ...a, halfDayHours: e.target.value.replace(/[^\d.]/g, '').slice(0, 4) }))} />
                    </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground">Weekly off</p>
                        <div className="flex flex-wrap gap-1.5">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                                const on = att.weeklyOffDays.includes(i);
                                return <button key={d} type="button" onClick={() => setAtt(a => ({ ...a, weeklyOffDays: toggleIn(a.weeklyOffDays, i) }))}
                                    className={`h-8 px-3 rounded-full text-xs font-semibold border ${on ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:text-foreground'}`}
                                    style={on ? { background: TERRACOTTA } : undefined}>{d}</button>;
                            })}
                        </div>
                    </div>
                    {!att.weeklyOffDays.includes(6) && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground">Saturdays off</p>
                            <div className="flex flex-wrap gap-1.5">
                                {[1, 2, 3, 4, 5].map(n => {
                                    const on = att.offSaturdays.includes(n);
                                    return <button key={n} type="button" onClick={() => setAtt(a => ({ ...a, offSaturdays: toggleIn(a.offSaturdays, n) }))}
                                        className={`h-8 px-3 rounded-full text-xs font-semibold border ${on ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:text-foreground'}`}
                                        style={on ? { background: TERRACOTTA } : undefined}>{['1st', '2nd', '3rd', '4th', '5th'][n - 1]}</button>;
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <p className="text-[11px] text-muted-foreground">School holidays come from Campus → Attendance holidays and are skipped automatically.</p>
                <Toggle checked={att.lateRuleEnabled} onChange={v => setAtt(a => ({ ...a, lateRuleEnabled: v }))} label="Cut half a day for repeated late coming"
                    hint={`Every ${att.lateRuleCount || 3} late marks in a month = half day LOP.`} />
                {att.lateRuleEnabled && (
                    <div className="max-w-[220px]">
                        <Field label="Late marks for half a day">
                            <input className={inputCls} inputMode="numeric" value={att.lateRuleCount} onChange={e => setAtt(a => ({ ...a, lateRuleCount: e.target.value.replace(/\D/g, '').slice(0, 2) }))} />
                        </Field>
                    </div>
                )}
            </section>
        </div>
    );
}
