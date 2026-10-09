'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls } from '@/app/admin/payroll/_components/ui';

interface Location { id: string; name: string; description: string }
interface Draft { id?: string; name: string; description: string }

export default function LocationsPanel({ setupNavigation }: { setupNavigation: React.ReactNode }) {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Location | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback((signal?: AbortSignal) => {
        return api.get('/admin/inventory/locations', { signal }).then(res => {
            if (signal?.aborted) return;
            setLocations(res.data.data);
            setError('');
        }).catch(err => {
            if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load locations'));
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
        if (!name) { toast.error('Enter a location name'); return; }
        setSaving(true);
        try {
            const payload = { name, description: draft.description.trim() };
            const res = draft.id
                ? await api.patch(`/admin/inventory/locations/${draft.id}`, payload)
                : await api.post('/admin/inventory/locations', payload);
            setLocations(previous => [...previous.filter(c => c.id !== res.data.data.id), res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success(draft.id ? 'Location updated' : 'Location added');
            setDraft(null);
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to save location')); }
        finally { setSaving(false); }
    };
    const remove = async () => {
        if (!toDelete || deleting) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/inventory/locations/${toDelete.id}`);
            setLocations(previous => previous.filter(c => c.id !== toDelete.id));
            setToDelete(null);
            toast.success('Location deleted');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to delete location')); }
        finally { setDeleting(false); }
    };
    const filtered = locations.filter(c => `${c.name} ${c.description}`.toLowerCase().includes(search.trim().toLowerCase()));

    return <>
        <PageHeader title="Setup" subtitle="Set up categories, units, locations and suppliers.">
            <div className="flex flex-wrap items-center justify-end gap-3 max-w-full">
            <div className="relative w-full sm:w-60 shrink-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Search locations" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search locations..." className="w-full h-8 pl-8 pr-3 rounded-full text-xs bg-muted/50 border border-border/50 focus:outline-none focus:border-primary/50" />
            </div>
            {setupNavigation}
            <PrimaryButton disabled={loading || !!error} onClick={() => setDraft({ name: '', description: '' })}><Plus size={14} />Add location</PrimaryButton>
            </div>
        </PageHeader>
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <MapPin size={16} className="text-primary" /><h2 className="text-sm font-semibold">Locations</h2>
                {!loading && !error && <span className="text-xs text-muted-foreground">({locations.length})</span>}
            </div>
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading locations...</div>
                : error ? <EmptyState icon={MapPin} title="Could not load locations" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={MapPin} title={search ? 'No matching locations' : 'No locations added yet'} text={search ? 'Try another name or clear your search.' : 'Create locations such as Main Store, Science Lab or Class 5A.'} />
                : <div className="divide-y divide-border/50">{filtered.map(location => <div key={location.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="text-sm font-medium break-words">{location.name}</p>{location.description && <p className="text-xs text-muted-foreground mt-1 break-words">{location.description}</p>}</div>
                    <div className="flex gap-1.5 shrink-0"><SmallButton aria-label={`Edit ${location.name}`} onClick={() => setDraft({ ...location })}><Pencil size={13} /><span className="hidden sm:inline">Edit</span></SmallButton><SmallButton aria-label={`Delete ${location.name}`} onClick={() => setToDelete(location)}><Trash2 size={13} /><span className="hidden sm:inline">Delete</span></SmallButton></div>
                </div>)}</div>}
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-md bg-card">
                <DialogHeader><DialogTitle>{draft?.id ? 'Edit location' : 'New location'}</DialogTitle><DialogDescription>Record where school stock and equipment are kept.</DialogDescription></DialogHeader>
                {draft && <form onSubmit={save} className="space-y-4">
                    <Field label="Location name"><input autoFocus required maxLength={80} disabled={saving} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Main Store" className={inputCls} /></Field>
                    <Field label="Description (optional)"><textarea maxLength={300} disabled={saving} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="e.g. Ground floor, next to the school office" className={`${inputCls} h-24 py-2 resize-none`} /></Field>
                    <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim()}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add location'}</PrimaryButton></div>
                </form>}
            </DialogContent>
        </Dialog>
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="location" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
