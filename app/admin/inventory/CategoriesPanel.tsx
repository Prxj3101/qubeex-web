'use client';
import { InventorySearch } from './InventoryHeaderControls';
import { CategoryArtwork } from './CategoryArtwork';
import { SortableSetupCards } from './SortableSetupCards';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Tags, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls } from '@/app/admin/payroll/_components/ui';

interface Category { id: string; name: string; description: string; isDefault?: boolean }
interface Draft { id?: string; name: string; description: string }

export default function CategoriesPanel({ setupNavigation }: { setupNavigation: React.ReactNode }) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [orderRevision, setOrderRevision] = useState(0);
    const [reordering, setReordering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Category | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback((signal?: AbortSignal) => {
        return api.get('/admin/inventory/categories', { signal }).then(res => {
            if (signal?.aborted) return;
            setCategories(res.data.data); setOrderRevision(res.data.orderRevision || 0);
            setError('');
        }).catch(err => {
            if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load categories'));
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
        if (!name) { toast.error('Enter a category name'); return; }
        setSaving(true);
        try {
            const payload = { name, description: draft.description.trim() };
            const res = draft.id
                ? await api.patch(`/admin/inventory/categories/${draft.id}`, payload)
                : await api.post('/admin/inventory/categories', payload);
            setCategories(previous => previous.some(row => row.id === res.data.data.id) ? previous.map(row => row.id === res.data.data.id ? res.data.data : row) : [...previous, res.data.data]);
            toast.success(draft.id ? 'Category updated' : 'Category added');
            setDraft(null);
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to save category')); }
        finally { setSaving(false); }
    };
    const remove = async () => {
        if (!toDelete || deleting) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/inventory/categories/${toDelete.id}`);
            setCategories(previous => previous.filter(c => c.id !== toDelete.id));
            setToDelete(null);
            toast.success('Category deleted');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to delete category')); }
        finally { setDeleting(false); }
    };
    const filtered = categories.filter(c => `${c.name} ${c.description}`.toLowerCase().includes(search.trim().toLowerCase()));

    return <>
        <PageHeader title="Setup" subtitle="Set up categories, units, locations and suppliers.">
            <div className="flex flex-wrap items-center justify-end gap-3 max-w-full">
            <InventorySearch value={search} onChange={setSearch} label="Search categories" placeholder="Search categories..." />
            {setupNavigation}
            <PrimaryButton disabled={loading || !!error || reordering} onClick={() => setDraft({ name: '', description: '' })}><Plus size={14} />Add</PrimaryButton>
            </div>
        </PageHeader>
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] overflow-hidden" data-admin-surface="">
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <Tags size={16} className="text-primary" /><h2 className="text-sm font-semibold">Categories</h2>
                {!loading && !error && <span className="text-xs text-muted-foreground">({categories.length})</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain visible-scrollbar">
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading categories...</div>
                : error ? <EmptyState icon={Tags} title="Could not load categories" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={Tags} title={search ? 'No matching categories' : 'No categories added yet'} text={search ? 'Try another name or clear your search.' : 'Create categories such as Stationery, Furniture or Lab equipment.'} />
                : <SortableSetupCards items={categories} visible={filtered} revision={orderRevision} disabled={saving || deleting} onChange={setCategories} onRevisionChange={setOrderRevision} onBusyChange={setReordering} onReload={() => load()}>{category => <div className="flex h-full flex-col pt-6">
                    <div className="absolute right-3 top-2 flex items-center gap-2">{category.isDefault && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title="Built-in. You can rename it but not delete it.">Built-in</span>}<SmallButton disabled={reordering} aria-label={`Edit ${category.name}`} onClick={() => setDraft({ ...category })}><Pencil size={13} /><span>Edit</span></SmallButton></div>
                    <div className="flex flex-1 items-center gap-3">
                        <CategoryArtwork name={category.name} size={80} />
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold break-words">{category.name}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 break-words">{category.description}</p></div>
                    </div>
                    {!category.isDefault && <div className="flex justify-end gap-1.5 mt-3"> <SmallButton disabled={reordering} aria-label={`Delete ${category.name}`} onClick={() => setToDelete(category)}><Trash2 size={13} /><span>Delete</span></SmallButton></div>}
                </div>}</SortableSetupCards>}
            </div>
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0 pr-6 "><DialogTitle>{draft?.id ? 'Edit category' : 'New category'}</DialogTitle><DialogDescription>Organise your school inventory into categories.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                {draft && <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                    <Field label="Category name"><input autoFocus required maxLength={80} disabled={saving} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Stationery" className={inputCls} /></Field>
                    <Field label="Description (optional)"><textarea maxLength={300} disabled={saving} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="What belongs in this category?" className={`${inputCls} h-24 py-2 resize-none`} /></Field>
                    
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim()}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add category'}</PrimaryButton></div>
                </form>}
            
</div>
</DialogContent>
        </Dialog>
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="category" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
