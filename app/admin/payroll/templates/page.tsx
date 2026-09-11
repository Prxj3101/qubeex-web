'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';

interface LineItem { label: string; amount: number; }
interface SalaryTemplate {
    id: string; name: string;
    earnings: LineItem[]; deductions: LineItem[];
}

function LineItemEditor({ items, onChange, label }: { items: LineItem[]; onChange: (items: LineItem[]) => void; label: string }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input
                        className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-sm"
                        placeholder="Label (e.g. Basic)"
                        value={item.label}
                        onChange={e => onChange(items.map((it, idx) => idx === i ? { ...it, label: e.target.value } : it))}
                    />
                    <input
                        type="number"
                        className="w-28 h-8 px-2 rounded-lg border border-border bg-background text-sm"
                        placeholder="Amount"
                        value={item.amount}
                        onChange={e => onChange(items.map((it, idx) => idx === i ? { ...it, amount: Number(e.target.value) || 0 } : it))}
                    />
                    <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500">
                        <X size={14} />
                    </button>
                </div>
            ))}
            <button
                onClick={() => onChange([...items, { label: '', amount: 0 }])}
                className="text-xs font-semibold text-primary flex items-center gap-1"
            >
                <Plus size={12} /> Add line item
            </button>
        </div>
    );
}

export default function SalaryTemplatesPage() {
    const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<{ id: string | null; name: string; earnings: LineItem[]; deductions: LineItem[] } | null>(null);
    const [saving, setSaving] = useState(false);

    const fetchTemplates = useCallback(() => {
        setLoading(true);
        api.get('/admin/payroll/templates')
            .then(res => setTemplates(res.data.data ?? []))
            .catch(() => setTemplates([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const startNew = () => setEditing({ id: null, name: '', earnings: [], deductions: [] });
    const startEdit = (t: SalaryTemplate) => setEditing({ id: t.id, name: t.name, earnings: t.earnings, deductions: t.deductions });

    const save = async () => {
        if (!editing || !editing.name.trim()) { toast.error('Template name is required'); return; }
        setSaving(true);
        try {
            const payload = { name: editing.name.trim(), earnings: editing.earnings, deductions: editing.deductions };
            if (editing.id) {
                await api.patch(`/admin/payroll/templates/${editing.id}`, payload);
            } else {
                await api.post('/admin/payroll/templates', payload);
            }
            toast.success('Template saved');
            setEditing(null);
            fetchTemplates();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save template'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: string) => {
        try {
            await api.delete(`/admin/payroll/templates/${id}`);
            toast.success('Template deleted');
            fetchTemplates();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete template'));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Salary Templates</h1>
                    <p className="text-muted-foreground text-[13px]">Reusable earnings/deductions bundles to assign to teachers</p>
                </div>
                <button onClick={startNew} className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    <Plus size={14} /> New Template
                </button>
            </div>

            {loading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
            ) : templates.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No salary templates yet.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {templates.map(t => (
                        <div key={t.id} className="bg-card border border-border/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm">{t.name}</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => startEdit(t)} className="text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                                    <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t.earnings.length} earning{t.earnings.length !== 1 ? 's' : ''}, {t.deductions.length} deduction{t.deductions.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-2xl max-w-lg w-full mx-4 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold">{editing.id ? 'Edit' : 'New'} Salary Template</h3>
                            <button onClick={() => setEditing(null)}><X size={16} /></button>
                        </div>
                        <input
                            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm"
                            placeholder="Template name (e.g. Senior Teacher)"
                            value={editing.name}
                            onChange={e => setEditing({ ...editing, name: e.target.value })}
                        />
                        <LineItemEditor items={editing.earnings} onChange={earnings => setEditing({ ...editing, earnings })} label="Earnings" />
                        <LineItemEditor items={editing.deductions} onChange={deductions => setEditing({ ...editing, deductions })} label="Deductions" />
                        <button
                            onClick={save}
                            disabled={saving}
                            className="w-full h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            <Save size={14} /> {saving ? 'Saving…' : 'Save Template'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
