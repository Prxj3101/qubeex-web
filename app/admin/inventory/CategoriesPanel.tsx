'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Tags, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls } from '@/app/admin/payroll/_components/ui';

interface Category { id: string; name: string; description: string }
interface Draft { id?: string; name: string; description: string }

export default function CategoriesPanel({ setupNavigation }: { setupNavigation: React.ReactNode }) {
    const [categories, setCategories] = useState<Category[]>([]);
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
            setCategories(res.data.data);
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
            setCategories(previous => [...previous.filter(c => c.id !== res.data.data.id), res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
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
            <div className="relative w-full sm:w-60 shrink-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Search categories" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories..." className="w-full h-8 pl-8 pr-3 rounded-full text-xs bg-muted/50 border border-border/50 focus:outline-none focus:border-primary/50" />
            </div>
            {setupNavigation}
            <PrimaryButton disabled={loading || !!error} onClick={() => setDraft({ name: '', description: '' })}><Plus size={14} />Add category</PrimaryButton>
            </div>
        </PageHeader>
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <Tags size={16} className="text-primary" /><h2 className="text-sm font-semibold">Categories</h2>
                {!loading && !error && <span className="text-xs text-muted-foreground">({categories.length})</span>}
            </div>
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading categories...</div>
                : error ? <EmptyState icon={Tags} title="Could not load categories" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={Tags} title={search ? 'No matching categories' : 'No categories added yet'} text={search ? 'Try another name or clear your search.' : 'Create categories such as Stationery, Furniture or Lab equipment.'} />
                : <div className="divide-y divide-border/50">{filtered.map(category => <div key={category.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="text-sm font-medium break-words">{category.name}</p>{category.description && <p className="text-xs text-muted-foreground mt-1 break-words">{category.description}</p>}</div>
                    <div className="flex gap-1.5 shrink-0"><SmallButton aria-label={`Edit ${category.name}`} onClick={() => setDraft({ ...category })}><Pencil size={13} /><span className="hidden sm:inline">Edit</span></SmallButton><SmallButton aria-label={`Delete ${category.name}`} onClick={() => setToDelete(category)}><Trash2 size={13} /><span className="hidden sm:inline">Delete</span></SmallButton></div>
                </div>)}</div>}
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-md bg-card">
                <DialogHeader><DialogTitle>{draft?.id ? 'Edit category' : 'New category'}</DialogTitle><DialogDescription>Organise your school inventory into categories.</DialogDescription></DialogHeader>
                {draft && <form onSubmit={save} className="space-y-4">
                    <Field label="Category name"><input autoFocus required maxLength={80} disabled={saving} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Stationery" className={inputCls} /></Field>
                    <Field label="Description (optional)"><textarea maxLength={300} disabled={saving} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="What belongs in this category?" className={`${inputCls} h-24 py-2 resize-none`} /></Field>
                    <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim()}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add category'}</PrimaryButton></div>
                </form>}
            </DialogContent>
        </Dialog>
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="category" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
