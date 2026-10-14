'use client';
import { InventorySearch } from './InventoryHeaderControls';
import { SupplierArtwork } from './SupplierArtwork';
import { SortableSetupList } from './SortableSetupList';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls, PhoneInput } from '@/app/admin/payroll/_components/ui';

interface Supplier { id: string; name: string; contactPerson: string; phone: string; email: string; address: string }
interface Draft { id?: string; name: string; contactPerson: string; phone: string; email: string; address: string }

export default function SuppliersPanel({ setupNavigation }: { setupNavigation: React.ReactNode }) {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [orderRevision, setOrderRevision] = useState(0);
    const [reordering, setReordering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Supplier | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback((signal?: AbortSignal) => {
        return api.get('/admin/inventory/suppliers', { signal }).then(res => {
            if (signal?.aborted) return;
            setSuppliers(res.data.data); setOrderRevision(res.data.orderRevision || 0);
            setError('');
        }).catch(err => {
            if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load suppliers'));
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
        if (!name) { toast.error('Enter a supplier name'); return; }
        setSaving(true);
        try {
            const payload = { name, contactPerson: draft.contactPerson.trim(), phone: draft.phone.trim(), email: draft.email.trim(), address: draft.address.trim() };
            const res = draft.id
                ? await api.patch(`/admin/inventory/suppliers/${draft.id}`, payload)
                : await api.post('/admin/inventory/suppliers', payload);
            setSuppliers(previous => previous.some(row => row.id === res.data.data.id) ? previous.map(row => row.id === res.data.data.id ? res.data.data : row) : [...previous, res.data.data]);
            toast.success(draft.id ? 'Supplier updated' : 'Supplier added');
            setDraft(null);
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to save supplier')); }
        finally { setSaving(false); }
    };
    const remove = async () => {
        if (!toDelete || deleting) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/inventory/suppliers/${toDelete.id}`);
            setSuppliers(previous => previous.filter(c => c.id !== toDelete.id));
            setToDelete(null);
            toast.success('Supplier deleted');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to delete supplier')); }
        finally { setDeleting(false); }
    };
    const filtered = suppliers.filter(c => `${c.name} ${c.contactPerson} ${c.phone} ${c.email} ${c.address}`.toLowerCase().includes(search.trim().toLowerCase()));

    return <>
        <PageHeader title="Setup" subtitle="Set up categories, units, locations and suppliers.">
            <div className="flex flex-wrap items-center justify-end gap-3 max-w-full">
            <InventorySearch value={search} onChange={setSearch} label="Search suppliers" placeholder="Search suppliers..." />
            {setupNavigation}
            <PrimaryButton disabled={loading || !!error || reordering} onClick={() => setDraft({ name: '', contactPerson: '', phone: '', email: '', address: '' })}><Plus size={14} />Add</PrimaryButton>
            </div>
        </PageHeader>
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] overflow-hidden" data-admin-surface="">
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <Truck size={16} className="text-primary" /><h2 className="text-sm font-semibold">Suppliers</h2>
                {!loading && !error && <span className="text-xs text-muted-foreground">({suppliers.length})</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain visible-scrollbar">
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading suppliers...</div>
                : error ? <EmptyState icon={Truck} title="Could not load suppliers" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={Truck} title={search ? 'No matching suppliers' : 'No suppliers added yet'} text={search ? 'Try another name or clear your search.' : 'Add the vendors who supply stationery, furniture and equipment to your school.'} />
                : <SortableSetupList kind="suppliers" items={suppliers} visible={filtered} revision={orderRevision} disabled={saving || deleting} onChange={setSuppliers} onRevisionChange={setOrderRevision} onBusyChange={setReordering} onReload={() => load()}>{supplier => <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3"><SupplierArtwork id={supplier.id} /><div className="min-w-0">
                        <p className="text-sm font-medium break-words">{supplier.name}</p>
                        {supplier.contactPerson && <p className="text-xs text-muted-foreground mt-1 break-words">{supplier.contactPerson}</p>}
                        {(supplier.phone || supplier.email) && <p className="text-xs text-muted-foreground mt-1 break-words">{[supplier.phone, supplier.email].filter(Boolean).join(' | ')}</p>}
                        {supplier.address && <p className="text-xs text-muted-foreground mt-1 break-words">{supplier.address}</p>}
                    </div></div>
                    <div className="flex gap-1.5 shrink-0"><SmallButton disabled={reordering} aria-label={`Edit ${supplier.name}`} onClick={() => setDraft({ ...supplier })}><Pencil size={13} /><span className="hidden sm:inline">Edit</span></SmallButton><SmallButton disabled={reordering} aria-label={`Delete ${supplier.name}`} onClick={() => setToDelete(supplier)}><Trash2 size={13} /><span className="hidden sm:inline">Delete</span></SmallButton></div>
                </div>}</SortableSetupList>}
            </div>
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0 pr-6 "><DialogTitle>{draft?.id ? 'Edit supplier' : 'New supplier'}</DialogTitle><DialogDescription>Keep supplier contact details together for school purchases.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                {draft && <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                    <Field label="Supplier name"><input autoFocus required maxLength={80} disabled={saving} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. City Stationery" className={inputCls} /></Field>
                    <Field label="Contact person (optional)"><input maxLength={80} disabled={saving} value={draft.contactPerson} onChange={e => setDraft({ ...draft, contactPerson: e.target.value })} placeholder="e.g. Rahul Shah" className={inputCls} /></Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Phone (optional)"><fieldset disabled={saving}><PhoneInput value={draft.phone} onChange={phone => setDraft({ ...draft, phone })} /></fieldset></Field>
                        <Field label="Email (optional)"><input type="email" maxLength={254} disabled={saving} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="e.g. orders@example.com" className={inputCls} /></Field>
                    </div>
                    <Field label="Address (optional)"><textarea maxLength={300} disabled={saving} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Shop address, area and city" className={`${inputCls} h-24 py-2 resize-none`} /></Field>

                    
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim()}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add supplier'}</PrimaryButton></div>
                </form>}
            
</div>
</DialogContent>
        </Dialog>
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="supplier" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
