'use client';

import { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Sparkles, TrendingUp, TrendingDown, Star } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import {
    SalaryComponent, ComponentType, CalcType, describeValue,
    paiseToInput, rupeesToPaise, bpToInput, percentToBp,
} from '@/lib/payroll';
import { PageHeader, PrimaryButton, SecondaryButton, EmptyState, Field, inputCls, Pill, Segmented, Toggle, SmallButton } from '../_components/ui';

interface Draft {
    id?: string;
    name: string;
    type: ComponentType;
    calcType: CalcType;
    isBasic: boolean;
    lopApplicable: boolean;
    pfApplicable: boolean;
    valueText: string; // rupees or percent, as typed
}

const emptyDraft = (type: ComponentType): Draft => ({
    name: '', type, calcType: 'FIXED', isBasic: false, lopApplicable: type === 'EARNING', pfApplicable: false, valueText: '',
});

export default function SalaryComponentsPage() {
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [toDelete, setToDelete] = useState<SalaryComponent | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchComponents = useCallback(() => {
        api.get('/admin/payroll/components')
            .then(res => setComponents(res.data.data ?? []))
            .catch(() => setComponents([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { fetchComponents(); }, [fetchComponents]);

    const earnings = components.filter(c => c.type === 'EARNING');
    const deductions = components.filter(c => c.type === 'DEDUCTION');
    const hasBasic = components.some(c => c.isBasic);

    const addDefaults = async () => {
        setSeeding(true);
        try {
            const res = await api.post('/admin/payroll/components/defaults');
            setComponents(res.data.data ?? []);
            toast.success(res.data.added ? `Added ${res.data.added} common components` : 'You already have all the common components');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to add components'));
        } finally {
            setSeeding(false);
        }
    };

    const openEdit = (c: SalaryComponent) => setDraft({
        id: c.id, name: c.name, type: c.type, calcType: c.calcType, isBasic: c.isBasic, lopApplicable: c.lopApplicable, pfApplicable: !!c.pfApplicable,
        valueText: c.calcType === 'PERCENT_OF_BASIC' ? bpToInput(c.defaultValue) : paiseToInput(c.defaultValue),
    });

    const save = async () => {
        if (!draft) return;
        if (!draft.name.trim()) { toast.error('Give the component a name'); return; }
        setSaving(true);
        const payload = {
            name: draft.name.trim(),
            type: draft.type,
            calcType: draft.isBasic ? 'FIXED' : draft.calcType,
            isBasic: draft.type === 'EARNING' && draft.isBasic,
            lopApplicable: draft.lopApplicable,
            pfApplicable: draft.type === 'EARNING' && !draft.isBasic && draft.pfApplicable,
            defaultValue: draft.calcType === 'PERCENT_OF_BASIC' && !draft.isBasic ? percentToBp(draft.valueText) : rupeesToPaise(draft.valueText),
        };
        try {
            if (draft.id) await api.patch(`/admin/payroll/components/${draft.id}`, payload);
            else await api.post('/admin/payroll/components', payload);
            toast.success(draft.id ? 'Component updated' : 'Component added');
            setDraft(null);
            fetchComponents();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save component'));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/payroll/components/${toDelete.id}`);
            toast.success('Component deleted');
            setToDelete(null);
            fetchComponents();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete component'));
        } finally {
            setDeleting(false);
        }
    };

    const renderList = (list: SalaryComponent[], type: ComponentType) => (
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${type === 'EARNING' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                        {type === 'EARNING' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </span>
                    <p className="text-sm font-semibold">{type === 'EARNING' ? 'Earnings' : 'Deductions'}</p>
                    <span className="text-[11px] text-muted-foreground">{list.length}</span>
                </div>
                <SmallButton onClick={() => setDraft(emptyDraft(type))}><Plus size={12} /> Add</SmallButton>
            </div>
            {list.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No {type === 'EARNING' ? 'earnings' : 'deductions'} yet.</p>
            ) : (
                <div className="divide-y divide-border/40">
                    {list.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-medium">{c.name}</p>
                                    {c.isBasic && <Pill tone="primary"><Star size={9} /> Basic</Pill>}
                                    {c.lopApplicable ? <Pill>Cut for LOP</Pill> : <Pill tone="muted">Not cut for LOP</Pill>}
                                    {c.type === 'EARNING' && (c.isBasic || c.pfApplicable) && <Pill>Counts for PF</Pill>}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {c.calcType === 'PERCENT_OF_BASIC' ? 'Percentage of Basic' : 'Fixed amount'}
                                    {c.defaultValue > 0 && <> · Default {describeValue(c, c.defaultValue)}</>}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEdit(c)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><Pencil size={13} /></button>
                                <button onClick={() => setToDelete(c)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );

    return (
        <div className="space-y-3">
            <PageHeader title="Salary Components" subtitle="The salary heads your school uses: Basic, HRA, allowances, deductions">
                {components.length > 0 && (
                    <SecondaryButton onClick={addDefaults} disabled={seeding}><Sparkles size={14} /> Add common ones</SecondaryButton>
                )}
                <PrimaryButton onClick={() => setDraft(emptyDraft('EARNING'))}><Plus size={14} /> New Component</PrimaryButton>
            </PageHeader>

            {loading ? (
                <div className="grid gap-4 lg:grid-cols-2">{[1, 2].map(i => <div key={i} className="h-48 rounded-2xl bg-muted/40 animate-pulse" />)}</div>
            ) : components.length === 0 ? (
                <EmptyState icon={Layers} title="Set up your salary heads" text="Start with the common ones (Basic, HRA, DA, Transport, Special Allowance, Professional Tax) and change them to match your school.">
                    <PrimaryButton onClick={addDefaults} disabled={seeding}><Sparkles size={14} /> {seeding ? 'Adding…' : 'Add common components'}</PrimaryButton>
                    <SecondaryButton onClick={() => setDraft(emptyDraft('EARNING'))}><Plus size={14} /> Create my own</SecondaryButton>
                </EmptyState>
            ) : (
                <>
                    {!hasBasic && (
                        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                            No component is marked as <b>Basic</b>. Percentage components (like HRA = 40% of Basic) need one.
                        </div>
                    )}
                    <div className="grid gap-4 lg:grid-cols-2 items-start">
                        {renderList(earnings, 'EARNING')}
                        {renderList(deductions, 'DEDUCTION')}
                    </div>
                </>
            )}

            <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
                <DialogContent className="sm:max-w-md bg-card" onOpenAutoFocus={e => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{draft?.id ? 'Edit component' : 'New component'}</DialogTitle>
                    </DialogHeader>
                    {draft && (
                        <div className="space-y-4">
                            <Segmented<ComponentType>
                                value={draft.type}
                                options={[{ value: 'EARNING', label: 'Earning' }, { value: 'DEDUCTION', label: 'Deduction' }]}
                                onChange={type => setDraft({ ...draft, type, isBasic: type === 'EARNING' && draft.isBasic, lopApplicable: type === 'EARNING' })}
                            />
                            <Field label="Name">
                                <input className={inputCls} placeholder={draft.type === 'EARNING' ? 'e.g. HRA, Conveyance' : 'e.g. Professional Tax, Advance'}
                                    value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} autoFocus />
                            </Field>

                            {draft.type === 'EARNING' && (
                                <Toggle
                                    checked={draft.isBasic}
                                    onChange={isBasic => setDraft({ ...draft, isBasic, calcType: isBasic ? 'FIXED' : draft.calcType })}
                                    label="This is the Basic salary"
                                    hint="Percentage components are calculated from this one"
                                />
                            )}

                            {!draft.isBasic && (
                                <Field label="How is it calculated?">
                                    <Segmented<CalcType>
                                        value={draft.calcType}
                                        options={[{ value: 'FIXED', label: 'Fixed amount' }, { value: 'PERCENT_OF_BASIC', label: '% of Basic' }]}
                                        onChange={calcType => setDraft({ ...draft, calcType, valueText: '' })}
                                    />
                                </Field>
                            )}

                            <Field label={draft.calcType === 'PERCENT_OF_BASIC' && !draft.isBasic ? 'Default percentage (optional)' : 'Default amount (optional)'}
                                hint="Pre-filled when you add this to someone's salary. You can change it per person.">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                        {draft.calcType === 'PERCENT_OF_BASIC' && !draft.isBasic ? '%' : '₹'}
                                    </span>
                                    <input type="number" min={0} step="0.01" className={`${inputCls} pl-7`}
                                        value={draft.valueText} onChange={e => setDraft({ ...draft, valueText: e.target.value })} />
                                </div>
                            </Field>

                            <Toggle
                                checked={draft.lopApplicable}
                                onChange={lopApplicable => setDraft({ ...draft, lopApplicable })}
                                label="Cut for unpaid leave (LOP)"
                                hint="Reduce this amount for LOP days. Usually ON for Basic/HRA, OFF for fixed items like Transport or Professional Tax."
                            />

                            {draft.type === 'EARNING' && !draft.isBasic && (
                                <Toggle
                                    checked={draft.pfApplicable}
                                    onChange={pfApplicable => setDraft({ ...draft, pfApplicable })}
                                    label="Counts for PF"
                                    hint="Included in PF wages (Basic always is). Usually ON for DA, OFF for HRA, Transport and other allowances."
                                />
                            )}

                            <div className="flex gap-2 pt-1">
                                <SecondaryButton className="flex-1" onClick={() => setDraft(null)}>Cancel</SecondaryButton>
                                <PrimaryButton className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={!!toDelete}
                onOpenChange={o => !o && setToDelete(null)}
                label="component"
                name={toDelete?.name ?? ''}
                loading={deleting}
                onConfirm={confirmDelete}
                description="It can only be deleted if no staff salary or template uses it."
            />
        </div>
    );
}
