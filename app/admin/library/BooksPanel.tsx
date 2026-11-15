'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Barcode, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CreditCard, Loader2, Pencil, Plus, Printer, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { EmptyState, Field, Pill, PrimaryButton, SecondaryButton, SmallButton, inputCls } from '@/app/admin/payroll/_components/ui';
import ImportDialog from './ImportDialog';
import LabelSheet, { type Label } from './LabelSheet';
import { fromPaise, toPaise, type BookRow, type CopyRow } from './types';

const PAGE_SIZE = 20;
const STATUS_TONE: Record<CopyRow['status'], 'green' | 'amber' | 'red' | 'muted' | 'blue'> = { AVAILABLE: 'green', ISSUED: 'blue', LOST: 'red', DAMAGED: 'amber', WITHDRAWN: 'muted' };

interface Draft { id?: string; title: string; author: string; isbn: string; category: string; language: string; shelf: string; price: string; copies: string }
const blank: Draft = { title: '', author: '', isbn: '', category: '', language: '', shelf: '', price: '', copies: '1' };

function BookForm({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
    const [d, setD] = useState(draft);
    const [saving, setSaving] = useState(false);
    const [looking, setLooking] = useState(false);
    const set = (k: keyof Draft, v: string) => setD((p) => ({ ...p, [k]: v }));

    const lookup = async () => {
        const isbn = d.isbn.replace(/[-\s]/g, '');
        if (!/^(\d{9}[\dXx]|\d{13})$/.test(isbn)) return;
        setLooking(true);
        try {
            const res = await api.get(`/admin/library/isbn/${isbn}`);
            const found = res.data.data as { title?: string; author?: string };
            // Only fills empty fields, so typed details are never overwritten.
            setD((p) => ({ ...p, title: p.title || found.title || '', author: p.author || found.author || '' }));
            if (!found.title) toast.message('No details found for this ISBN. You can type them in.');
        } catch { /* lookup is optional */ } finally { setLooking(false); }
    };

    const save = async () => {
        if (!d.title.trim()) { toast.error('Title is required'); return; }
        const copies = Number(d.copies);
        if (!d.id && (!Number.isInteger(copies) || copies < 1 || copies > 500)) { toast.error('Copies must be between 1 and 500'); return; }
        const fields = {
            title: d.title.trim(), author: d.author.trim(), isbn: d.isbn.trim(), category: d.category.trim(),
            language: d.language.trim(), shelf: d.shelf.trim(), ...(d.price.trim() ? { pricePaise: toPaise(d.price) } : {}),
        };
        setSaving(true);
        try {
            if (d.id) await api.patch(`/admin/library/books/${d.id}`, fields);
            else {
                const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== ''));
                await api.post('/admin/library/books', { ...clean, copies });
            }
            toast.success(d.id ? 'Book updated' : 'Book added');
            onSaved();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not save the book'));
        } finally { setSaving(false); }
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
            <DialogContent className="sm:max-w-lg bg-card max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{d.id ? 'Edit book' : 'Add book'}</DialogTitle>
                    <DialogDescription>{d.id ? 'Change the details shared by all copies.' : 'Enter an ISBN to fill in the title and author automatically.'}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Field label="ISBN" hint={looking ? 'Looking up…' : 'Optional'}><input className={inputCls} value={d.isbn} onChange={(e) => set('isbn', e.target.value)} onBlur={() => void lookup()} /></Field></div>
                    <div className="sm:col-span-2"><Field label="Title *"><input className={inputCls} value={d.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
                    <Field label="Author"><input className={inputCls} value={d.author} onChange={(e) => set('author', e.target.value)} /></Field>
                    <Field label="Category"><input className={inputCls} value={d.category} onChange={(e) => set('category', e.target.value)} /></Field>
                    <Field label="Language"><input className={inputCls} value={d.language} onChange={(e) => set('language', e.target.value)} /></Field>
                    <Field label="Shelf / rack"><input className={inputCls} value={d.shelf} onChange={(e) => set('shelf', e.target.value)} /></Field>
                    <Field label="Price (₹)"><input className={inputCls} inputMode="decimal" value={d.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                    {!d.id && <Field label="Number of copies" hint="Each copy gets its own barcode"><input className={inputCls} inputMode="numeric" value={d.copies} onChange={(e) => set('copies', e.target.value.replace(/\D/g, ''))} /></Field>}
                </div>
                <PrimaryButton onClick={() => void save()} disabled={saving} className="h-9 px-5 w-fit">{saving && <Loader2 size={14} className="animate-spin" />}{d.id ? 'Save changes' : 'Add book'}</PrimaryButton>
            </DialogContent>
        </Dialog>
    );
}

function LabelRangeDialog({ initial, onClose, onPrint }: { initial: { from: string; to: string }; onClose: () => void; onPrint: (l: Label[]) => void }) {
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true);
        try {
            const res = await api.get('/admin/library/books/labels', { params: { from: from.trim(), to: to.trim() } });
            const { labels, truncated } = res.data.data as { labels: { code: string; title: string }[]; truncated: boolean };
            if (labels.length === 0) { toast.error('No copies found in that range'); return; }
            if (truncated) toast.message('Only the first 2000 labels are shown. Print this batch, then continue from the next code.');
            onPrint(labels.map((l) => ({ code: l.code, caption: l.title })));
        } catch (err) { toast.error(getErrorMessage(err, 'Could not load labels')); } finally { setBusy(false); }
    };
    return (
        <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
            <DialogContent className="sm:max-w-sm bg-card">
                <DialogHeader>
                    <DialogTitle>Print labels by code</DialogTitle>
                    <DialogDescription>Print barcode labels for every copy from one code to another, for example after importing your whole library.</DialogDescription>
                </DialogHeader>
                <Field label="From code"><input className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="LIB-000001" /></Field>
                <Field label="To code"><input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} placeholder="LIB-000200" /></Field>
                <PrimaryButton onClick={() => void go()} disabled={busy || !from.trim() || !to.trim()} className="h-9 px-5 w-fit">{busy && <Loader2 size={14} className="animate-spin" />}Preview labels</PrimaryButton>
            </DialogContent>
        </Dialog>
    );
}

function MemberCardDialog({ onClose, onPrint }: { onClose: () => void; onPrint: (l: Label[]) => void }) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-sm bg-card">
                <DialogHeader>
                    <DialogTitle>Member card label</DialogTitle>
                    <DialogDescription>Print a scannable label for someone whose ID card has no barcode. Use their ID exactly as it appears in QubeEx.</DialogDescription>
                </DialogHeader>
                <Field label="Member ID"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
                <Field label="Name (printed above the barcode)"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <PrimaryButton disabled={!code.trim()} onClick={() => onPrint([{ code: code.trim().toUpperCase(), caption: name.trim() || code.trim().toUpperCase() }])} className="h-9 px-5 w-fit">Preview label</PrimaryButton>
            </DialogContent>
        </Dialog>
    );
}

export default function BooksPanel() {
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<BookRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [importing, setImporting] = useState(false);
    const [card, setCard] = useState(false);
    const [range, setRange] = useState<{ from: string; to: string } | null>(null);
    const [labels, setLabels] = useState<{ labels: Label[]; title: string } | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [copies, setCopies] = useState<CopyRow[]>([]);
    const [copiesLoading, setCopiesLoading] = useState(false);
    const [addCount, setAddCount] = useState('1');
    const [toDelete, setToDelete] = useState<BookRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

    const [tick, setTick] = useState(0);
    const load = useCallback(() => setTick((t) => t + 1), []);
    useEffect(() => {
        let live = true;
        api.get('/admin/library/books', { params: { q: query || undefined, page, pageSize: PAGE_SIZE } })
            .then((res) => { if (live) { setItems(res.data.data.items as BookRow[]); setTotal(res.data.data.total as number); } })
            .catch((err) => { if (live) toast.error(getErrorMessage(err, 'Could not load books')); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [query, page, tick]);

    const loadCopies = useCallback(async (bookId: string) => {
        setCopiesLoading(true);
        try {
            const res = await api.get(`/admin/library/books/${bookId}/copies`);
            setCopies(res.data.data.copies as CopyRow[]);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not load copies')); } finally { setCopiesLoading(false); }
    }, []);

    const toggle = (b: BookRow) => {
        if (expanded === b.id) { setExpanded(null); return; }
        setExpanded(b.id);
        setCopies([]);
        void loadCopies(b.id);
    };

    const setStatus = async (b: BookRow, copy: CopyRow, status: string) => {
        try {
            await api.patch(`/admin/library/books/copies/${copy.id}/status`, { status });
            await Promise.all([loadCopies(b.id), load()]);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not change the status')); }
    };

    const addCopies = async (b: BookRow) => {
        const count = Number(addCount);
        if (!Number.isInteger(count) || count < 1 || count > 500) { toast.error('Enter 1 to 500 copies'); return; }
        try {
            await api.post(`/admin/library/books/${b.id}/copies`, { count });
            toast.success(`Added ${count} cop${count === 1 ? 'y' : 'ies'}`);
            await Promise.all([loadCopies(b.id), load()]);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not add copies')); }
    };

    const remove = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/library/books/${toDelete.id}`);
            toast.success('Book deleted');
            setToDelete(null);
            setExpanded(null);
            await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not delete the book')); } finally { setDeleting(false); }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-3 pb-10">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input className={`${inputCls} pl-8`} placeholder="Search title, author or ISBN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search books" />
                </div>
                <PrimaryButton onClick={() => setDraft(blank)}><Plus size={14} /> Add book</PrimaryButton>
                <SecondaryButton onClick={() => setImporting(true)}><Upload size={14} /> Import</SecondaryButton>
                <SecondaryButton onClick={() => setRange({ from: '', to: '' })}><Barcode size={14} /> Labels by code</SecondaryButton>
                <SecondaryButton onClick={() => setCard(true)}><CreditCard size={14} /> Member card</SecondaryButton>
            </div>

            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
                : items.length === 0 ? (
                    <EmptyState icon={BookOpen} title={query ? 'No books match your search' : 'No books yet'} text={query ? 'Try a different word.' : 'Add a book, or import your existing list from Excel.'}>
                        {!query && <><PrimaryButton onClick={() => setDraft(blank)}><Plus size={14} /> Add book</PrimaryButton><SecondaryButton onClick={() => setImporting(true)}><Upload size={14} /> Import</SecondaryButton></>}
                    </EmptyState>
                ) : (
                    <ul className="rounded-2xl border border-border bg-card divide-y divide-border/60">
                        {items.map((b) => (
                            <li key={b.id}>
                                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold truncate">{b.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{[b.author, b.category, b.shelf && `Shelf ${b.shelf}`].filter(Boolean).join(' · ') || 'No details'}</p>
                                    </div>
                                    <Pill tone={b.available > 0 ? 'green' : 'amber'}>{b.available} of {b.total} available</Pill>
                                    <SmallButton type="button" onClick={() => toggle(b)} aria-expanded={expanded === b.id}>Copies {expanded === b.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</SmallButton>
                                    <SmallButton type="button" aria-label={`Edit ${b.title}`} onClick={() => setDraft({ id: b.id, title: b.title, author: b.author ?? '', isbn: b.isbn ?? '', category: b.category ?? '', language: b.language ?? '', shelf: b.shelf ?? '', price: fromPaise(b.pricePaise), copies: '1' })}><Pencil size={12} /></SmallButton>
                                    <SmallButton type="button" aria-label={`Delete ${b.title}`} onClick={() => setToDelete(b)}><Trash2 size={12} /></SmallButton>
                                </div>
                                {expanded === b.id && (
                                    <div className="px-4 pb-4 space-y-3 bg-muted/20">
                                        {copiesLoading ? <Loader2 size={16} className="animate-spin text-muted-foreground mt-3" /> : (
                                            <>
                                                <div className="flex flex-wrap items-center gap-2 pt-3">
                                                    <SmallButton type="button" onClick={() => setLabels({ title: `Labels: ${b.title}`, labels: copies.map((c) => ({ code: c.accessionCode, caption: b.title })) })}><Printer size={12} /> Print labels</SmallButton>
                                                    <span className="text-xs text-muted-foreground ml-auto">Add copies</span>
                                                    <input className={`${inputCls} !w-16 !h-8`} inputMode="numeric" value={addCount} onChange={(e) => setAddCount(e.target.value.replace(/\D/g, ''))} aria-label="Number of copies to add" />
                                                    <SmallButton type="button" onClick={() => void addCopies(b)}><Plus size={12} /> Add</SmallButton>
                                                </div>
                                                <ul className="grid gap-1.5 sm:grid-cols-2">
                                                    {copies.map((c) => (
                                                        <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
                                                            <span className="text-sm font-mono flex-1">{c.accessionCode}</span>
                                                            <Pill tone={STATUS_TONE[c.status]}>{c.status.toLowerCase()}</Pill>
                                                            <select aria-label={`Status of ${c.accessionCode}`} className="h-7 rounded-md border border-border bg-background text-xs px-1" value={c.status === 'ISSUED' ? '' : c.status} disabled={c.status === 'ISSUED'}
                                                                onChange={(e) => void setStatus(b, c, e.target.value)}>
                                                                {c.status === 'ISSUED' && <option value="">Issued</option>}
                                                                <option value="AVAILABLE">Available</option><option value="LOST">Lost</option><option value="DAMAGED">Damaged</option><option value="WITHDRAWN">Withdrawn</option>
                                                            </select>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 text-xs">
                    <SmallButton type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={12} /> Prev</SmallButton>
                    <span>Page {page} of {totalPages}</span>
                    <SmallButton type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={12} /></SmallButton>
                </div>
            )}

            {draft && <BookForm draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); void load(); if (expanded) void loadCopies(expanded); }} />}
            {importing && <ImportDialog onClose={() => setImporting(false)} onDone={(r) => { setImporting(false); void load(); setRange({ from: r.firstCode, to: r.lastCode }); }} />}
            {range && <LabelRangeDialog initial={range} onClose={() => setRange(null)} onPrint={(l) => { setRange(null); setLabels({ labels: l, title: 'Book labels' }); }} />}
            {card && <MemberCardDialog onClose={() => setCard(false)} onPrint={(l) => { setCard(false); setLabels({ labels: l, title: 'Member card label' }); }} />}
            {labels && <LabelSheet labels={labels.labels} title={labels.title} onClose={() => setLabels(null)} />}
            <DeleteConfirmDialog open={!!toDelete} onOpenChange={(open) => { if (!open && !deleting) setToDelete(null); }} label="book" name={toDelete?.title ?? ''} loading={deleting} onConfirm={() => void remove()} />
        </div>
    );
}
