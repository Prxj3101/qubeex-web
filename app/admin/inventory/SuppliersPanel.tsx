'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Truck, Search, Loader2 } from 'lucide-react';
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
            setSuppliers(res.data.data);
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
            setSuppliers(previous => [...previous.filter(c => c.id !== res.data.data.id), res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
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
            <div className="relative w-full sm:w-60 shrink-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Search suppliers" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." className="w-full h-8 pl-8 pr-3 rounded-full text-xs bg-muted/50 border border-border/50 focus:outline-none focus:border-primary/50" />
            </div>
            {setupNavigation}
            <PrimaryButton disabled={loading || !!error} onClick={() => setDraft({ name: '', contactPerson: '', phone: '', email: '', address: '' })}><Plus size={14} />Add supplier</PrimaryButton>
            </div>
        </PageHeader>
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <Truck size={16} className="text-primary" /><h2 className="text-sm font-semibold">Suppliers</h2>
                {!loading && !error && <span className="text-xs text-muted-foreground">({suppliers.length})</span>}
            </div>
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading suppliers...</div>
                : error ? <EmptyState icon={Truck} title="Could not load suppliers" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={Truck} title={search ? 'No matching suppliers' : 'No suppliers added yet'} text={search ? 'Try another name or clear your search.' : 'Add the vendors who supply stationery, furniture and equipment to your school.'} />
                : <div className="divide-y divide-border/50">{filtered.map(supplier => <div key={supplier.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium break-words">{supplier.name}</p>
                        {supplier.contactPerson && <p className="text-xs text-muted-foreground mt-1 break-words">{supplier.contactPerson}</p>}
                        {(supplier.phone || supplier.email) && <p className="text-xs text-muted-foreground mt-1 break-words">{[supplier.phone, supplier.email].filter(Boolean).join(' | ')}</p>}
                        {supplier.address && <p className="text-xs text-muted-foreground mt-1 break-words">{supplier.address}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0"><SmallButton aria-label={`Edit ${supplier.name}`} onClick={() => setDraft({ ...supplier })}><Pencil size={13} /><span className="hidden sm:inline">Edit</span></SmallButton><SmallButton aria-label={`Delete ${supplier.name}`} onClick={() => setToDelete(supplier)}><Trash2 size={13} /><span className="hidden sm:inline">Delete</span></SmallButton></div>
                </div>)}</div>}
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{draft?.id ? 'Edit supplier' : 'New supplier'}</DialogTitle><DialogDescription>Keep supplier contact details together for school purchases.</DialogDescription></DialogHeader>
                {draft && <form onSubmit={save} className="space-y-4">
                    <Field label="Supplier name"><input autoFocus required maxLength={80} disabled={saving} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. City Stationery" className={inputCls} /></Field>
                    <Field label="Contact person (optional)"><input maxLength={80} disabled={saving} value={draft.contactPerson} onChange={e => setDraft({ ...draft, contactPerson: e.target.value })} placeholder="e.g. Rahul Shah" className={inputCls} /></Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Phone (optional)"><fieldset disabled={saving}><PhoneInput value={draft.phone} onChange={phone => setDraft({ ...draft, phone })} /></fieldset></Field>
                        <Field label="Email (optional)"><input type="email" maxLength={254} disabled={saving} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="e.g. orders@example.com" className={inputCls} /></Field>
                    </div>
                    <Field label="Address (optional)"><textarea maxLength={300} disabled={saving} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Shop address, area and city" className={`${inputCls} h-24 py-2 resize-none`} /></Field>

                    <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim()}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add supplier'}</PrimaryButton></div>
                </form>}
            </DialogContent>
        </Dialog>
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="supplier" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
