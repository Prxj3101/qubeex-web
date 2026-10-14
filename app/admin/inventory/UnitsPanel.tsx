'use client';
import { InventorySearch } from './InventoryHeaderControls';
import { SetupArtwork } from './SetupArtwork';
import { SortableSetupList } from './SortableSetupList';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Ruler, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls } from '@/app/admin/payroll/_components/ui';

interface Unit { id: string; name: string; abbreviation: string; isDefault?: boolean }
interface Draft { id?: string; name: string; abbreviation: string }

export default function UnitsPanel({ setupNavigation }: { setupNavigation: React.ReactNode }) {
    const [units, setUnits] = useState<Unit[]>([]);
    const [orderRevision, setOrderRevision] = useState(0);
    const [reordering, setReordering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Unit | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback((signal?: AbortSignal) => {
        return api.get('/admin/inventory/units', { signal }).then(res => {
            if (signal?.aborted) return;
            setUnits(res.data.data); setOrderRevision(res.data.orderRevision || 0);
            setError('');
        }).catch(err => {
            if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load units'));
        }).finally(() => { if (!signal?.aborted) setLoading(false); });
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!draft || saving) return;
        const name = draft.name.trim().replace(/\s+/g, ' ');
        if (!name) { toast.error('Enter a unit name'); return; }
        setSaving(true);
        try {
            const payload = { name, abbreviation: draft.abbreviation.trim() };
            const res = draft.id
                ? await api.patch(`/admin/inventory/units/${draft.id}`, payload)
                : await api.post('/admin/inventory/units', payload);
            setUnits(previous => previous.some(row => row.id === res.data.data.id) ? previous.map(row => row.id === res.data.data.id ? res.data.data : row) : [...previous, res.data.data]);
            toast.success(draft.id ? 'Unit updated' : 'Unit added');
            setDraft(null);
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to save unit')); }
        finally { setSaving(false); }
    };
    const remove = async () => {
        if (!toDelete || deleting) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/inventory/units/${toDelete.id}`);
            setUnits(previous => previous.filter(c => c.id !== toDelete.id));
            setToDelete(null);
            toast.success('Unit deleted');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to delete unit')); }
        finally { setDeleting(false); }
    };
    const filtered = units.filter(c => `${c.name} ${c.abbreviation}`.toLowerCase().includes(search.trim().toLowerCase()));

    return <>
        <PageHeader title="Setup" subtitle="Set up categories, units, locations and suppliers.">
            <div className="flex flex-wrap items-center justify-end gap-3 max-w-full">
            <InventorySearch value={search} onChange={setSearch} label="Search units" placeholder="Search units..." />
            {setupNavigation}
            <PrimaryButton disabled={loading || !!error || reordering} onClick={() => setDraft({ name: '', abbreviation: '' })}><Plus size={14} />Add</PrimaryButton>
            </div>
        </PageHeader>
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] overflow-hidden" data-admin-surface="">
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <Ruler size={16} className="text-primary" /><h2 className="text-sm font-semibold">Units</h2>
                {!loading && !error && <span className="text-xs text-muted-foreground">({units.length})</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain visible-scrollbar">
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading units...</div>
                : error ? <EmptyState icon={Ruler} title="Could not load units" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={Ruler} title={search ? 'No matching units' : 'No units added yet'} text={search ? 'Try another name or clear your search.' : 'Create units such as Pieces, Boxes, Packets or Litres.'} />
                : <SortableSetupList kind="units" items={units} visible={filtered} revision={orderRevision} disabled={saving || deleting} onChange={setUnits} onRevisionChange={setOrderRevision} onBusyChange={setReordering} onReload={() => load()}>{unit => <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3"><SetupArtwork kind="units" name={unit.name} /><div className="min-w-0"><p className="text-sm font-medium break-words">{unit.name}{unit.isDefault && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-[10px] font-medium text-muted-foreground" title="Built-in. You can rename it but not delete it.">Built-in</span>}</p>{unit.abbreviation && <p className="text-xs text-muted-foreground mt-1 break-words">{unit.abbreviation}</p>}</div></div>
                    <div className="flex gap-1.5 shrink-0"><SmallButton disabled={reordering} aria-label={`Edit ${unit.name}`} onClick={() => setDraft({ ...unit })}><Pencil size={13} /><span className="hidden sm:inline">Edit</span></SmallButton>{unit.isDefault ? null : <SmallButton disabled={reordering} aria-label={`Delete ${unit.name}`} onClick={() => setToDelete(unit)}><Trash2 size={13} /><span className="hidden sm:inline">Delete</span></SmallButton>}</div>
                </div>}</SortableSetupList>}
            </div>
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0 pr-6 "><DialogTitle>{draft?.id ? 'Edit unit' : 'New unit'}</DialogTitle><DialogDescription>Choose how inventory quantities are counted.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                {draft && <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                    <Field label="Unit name"><input autoFocus required maxLength={80} disabled={saving} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Pieces" className={inputCls} /></Field>
                    <Field label="Abbreviation (optional)" hint="A short label for quantities, such as pcs or L."><input maxLength={16} disabled={saving} value={draft.abbreviation} onChange={e => setDraft({ ...draft, abbreviation: e.target.value })} placeholder="e.g. pcs" className={inputCls} /></Field>
                    
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim()}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add unit'}</PrimaryButton></div>
                </form>}
            
</div>
</DialogContent>
        </Dialog>
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="unit" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
