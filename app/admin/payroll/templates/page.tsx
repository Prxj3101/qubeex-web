'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { SalaryComponent, SalaryTemplate, StructureItem, formatINR, previewMonthly } from '@/lib/payroll';
import { PageHeader, PrimaryButton, SecondaryButton, EmptyState, Field, inputCls } from '../_components/ui';
import { SalaryItemsEditor } from '../_components/SalaryItemsEditor';

export default function SalaryTemplatesPage() {
    const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<{ id?: string; name: string; items: StructureItem[] } | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<SalaryTemplate | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchAll = useCallback(() => {
        Promise.all([api.get('/admin/payroll/templates'), api.get('/admin/payroll/components')])
            .then(([t, c]) => { setTemplates(t.data.data ?? []); setComponents(c.data.data ?? []); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { fetchAll(); }, [fetchAll]);

    const startNew = () => {
        const basic = components.find(c => c.isBasic);
        setEditing({ name: '', items: basic ? [{ componentId: basic.id, value: basic.defaultValue }] : [] });
    };

    const save = async () => {
        if (!editing) return;
        if (!editing.name.trim()) { toast.error('Give the template a name'); return; }
        setSaving(true);
        try {
            const payload = { name: editing.name.trim(), items: editing.items };
            if (editing.id) await api.patch(`/admin/payroll/templates/${editing.id}`, payload);
            else await api.post('/admin/payroll/templates', payload);
            toast.success(editing.id ? 'Template updated' : 'Template created');
            setEditing(null);
            fetchAll();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save template'));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/payroll/templates/${toDelete.id}`);
            toast.success('Template deleted');
            setToDelete(null);
            fetchAll();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete template'));
        } finally {
            setDeleting(false);
        }
    };

    const nameOf = (id: string) => components.find(c => c.id === id)?.name;

    return (
        <div className="space-y-3">
            <PageHeader title="Salary Templates" subtitle="Ready-made salary setups (like “Primary Teacher”) to assign staff in one click">
                <PrimaryButton onClick={startNew} disabled={components.length === 0}><Plus size={14} /> New Template</PrimaryButton>
            </PageHeader>

            {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-muted/40 animate-pulse" />)}</div>
            ) : templates.length === 0 ? (
                <EmptyState icon={FileText} title="No templates yet"
                    text={components.length === 0 ? 'Add salary components first, then build templates from them.' : 'Create one per role (Primary Teacher, Senior Teacher, Support Staff) and reuse it for everyone in that role.'}>
                    {components.length > 0 && <PrimaryButton onClick={startNew}><Plus size={14} /> Create template</PrimaryButton>}
                </EmptyState>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(t => {
                        const p = previewMonthly(t.items, components);
                        return (
                            <div key={t.id} className="group rounded-2xl border border-border/60 bg-card p-4 hover:border-border hover:shadow-sm transition-all">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><FileText size={16} /></div>
                                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                                        <button onClick={() => setEditing({ id: t.id, name: t.name, items: t.items })} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><Pencil size={13} /></button>
                                        <button onClick={() => setToDelete(t)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                                <p className="text-sm font-semibold mt-3">{t.name}</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    {t.items.map(i => nameOf(i.componentId)).filter(Boolean).join(' · ') || 'No components'}
                                </p>
                                <div className="flex items-end justify-between mt-3 pt-3 border-t border-border/40">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Take-home</p>
                                        <p className="text-base font-bold text-primary">{formatINR(p.netPay)}</p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Gross {formatINR(p.grossPay)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
                <DialogContent className="sm:max-w-2xl bg-card max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit template' : 'New template'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-4">
                            <Field label="Template name">
                                <input className={inputCls} placeholder="e.g. Primary Teacher" value={editing.name}
                                    onChange={e => setEditing({ ...editing, name: e.target.value })} autoFocus />
                            </Field>
                            <SalaryItemsEditor items={editing.items} components={components} onChange={items => setEditing({ ...editing, items })} />
                            <div className="flex gap-2">
                                <SecondaryButton className="flex-1" onClick={() => setEditing(null)}>Cancel</SecondaryButton>
                                <PrimaryButton className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save template'}</PrimaryButton>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={!!toDelete}
                onOpenChange={o => !o && setToDelete(null)}
                label="template"
                name={toDelete?.name ?? ''}
                loading={deleting}
                onConfirm={confirmDelete}
                description="Staff already given this salary keep their salary. Only the template is removed."
            />
        </div>
    );
}
