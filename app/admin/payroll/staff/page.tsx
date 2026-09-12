'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Save, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';

interface LineItem { label: string; amount: number; }
interface StaffSalaryStructure { id: string; templateId: string | null; earnings: LineItem[]; deductions: LineItem[]; bankDetails: { accountName: string; accountNumber: string; ifsc: string; bankName: string } | null; }
interface StaffMember {
    id: string; name: string; email: string; phone: string | null; designation: string | null;
    staffType: 'TEACHER' | 'ADMIN' | 'SUB_ADMIN' | 'HELPER' | 'OTHER';
    status: 'ACTIVE' | 'INACTIVE'; userId: string | null;
    salaryStructure: StaffSalaryStructure | null;
}
interface LinkableProfile { userId: string; name: string; email: string; role: string; }
interface SalaryTemplate { id: string; name: string; earnings: LineItem[]; deductions: LineItem[]; }

const STAFF_TYPE_LABEL: Record<StaffMember['staffType'], string> = {
    TEACHER: 'Teacher', ADMIN: 'Admin', SUB_ADMIN: 'Sub-Admin', HELPER: 'Helper', OTHER: 'Other',
};

function LineItemEditor({ items, onChange, label }: { items: LineItem[]; onChange: (items: LineItem[]) => void; label: string }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input
                        className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-sm"
                        placeholder="Label"
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
            <button onClick={() => onChange([...items, { label: '', amount: 0 }])} className="text-xs font-semibold text-primary flex items-center gap-1">
                <Plus size={12} /> Add line item
            </button>
        </div>
    );
}

export default function StaffPage() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [addMode, setAddMode] = useState<'link' | 'new'>('new');
    const [addSaving, setAddSaving] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');
    const [linkResults, setLinkResults] = useState<LinkableProfile[]>([]);
    const [selectedLink, setSelectedLink] = useState<LinkableProfile | null>(null);
    const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', designation: '', staffType: 'HELPER' as StaffMember['staffType'] });

    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [salaryDraft, setSalaryDraft] = useState<{ templateId: string | null; earnings: LineItem[]; deductions: LineItem[]; bankDetails: { accountName: string; accountNumber: string; ifsc: string; bankName: string } } | null>(null);
    const [savingSalary, setSavingSalary] = useState(false);

    const fetchStaff = useCallback(() => {
        setLoading(true);
        api.get('/admin/payroll/staff')
            .then(res => setStaff(res.data.data ?? []))
            .catch(() => setStaff([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);
    useEffect(() => { api.get('/admin/payroll/templates').then(res => setTemplates(res.data.data ?? [])).catch(() => {}); }, []);

    useEffect(() => {
        if (addMode !== 'link' || linkSearch.trim().length < 2) { setLinkResults([]); return; }
        const t = setTimeout(() => {
            api.get(`/admin/payroll/staff/search-profiles?q=${encodeURIComponent(linkSearch.trim())}`)
                .then(res => setLinkResults(res.data.data ?? []))
                .catch(() => setLinkResults([]));
        }, 300);
        return () => clearTimeout(t);
    }, [addMode, linkSearch]);

    const submitAdd = async () => {
        setAddSaving(true);
        try {
            if (addMode === 'link') {
                if (!selectedLink) { toast.error('Pick a profile to link'); setAddSaving(false); return; }
                await api.post('/admin/payroll/staff', {
                    name: selectedLink.name, email: selectedLink.email,
                    staffType: selectedLink.role as StaffMember['staffType'], userId: selectedLink.userId,
                });
            } else {
                if (!newStaff.name.trim() || !newStaff.email.trim()) { toast.error('Name and email are required'); setAddSaving(false); return; }
                await api.post('/admin/payroll/staff', newStaff);
            }
            toast.success('Staff member added');
            setAddOpen(false);
            setSelectedLink(null);
            setLinkSearch('');
            setNewStaff({ name: '', email: '', phone: '', designation: '', staffType: 'HELPER' });
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to add staff member'));
        } finally {
            setAddSaving(false);
        }
    };

    const removeStaff = async (id: string) => {
        try {
            await api.delete(`/admin/payroll/staff/${id}`);
            toast.success('Staff member removed');
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to remove staff member'));
        }
    };

    const toggleStatus = async (s: StaffMember) => {
        try {
            await api.patch(`/admin/payroll/staff/${s.id}`, { status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
            toast.success(s.status === 'ACTIVE' ? 'Marked inactive' : 'Marked active');
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to update status'));
        }
    };

    const startEditSalary = (s: StaffMember) => {
        setSalaryDraft({
            templateId: s.salaryStructure?.templateId ?? null,
            earnings: s.salaryStructure?.earnings ?? [],
            deductions: s.salaryStructure?.deductions ?? [],
            bankDetails: s.salaryStructure?.bankDetails ?? { accountName: '', accountNumber: '', ifsc: '', bankName: '' },
        });
        setEditingStaffId(s.id);
    };

    const applyTemplate = (templateId: string) => {
        const tpl = templates.find(t => t.id === templateId);
        if (!tpl || !salaryDraft) return;
        setSalaryDraft({ ...salaryDraft, templateId, earnings: tpl.earnings, deductions: tpl.deductions });
    };

    const saveSalary = async () => {
        if (!salaryDraft || !editingStaffId) return;
        setSavingSalary(true);
        try {
            await api.put(`/admin/payroll/staff/${editingStaffId}/structure`, { ...salaryDraft, effectiveFrom: new Date().toISOString() });
            toast.success('Salary structure saved');
            setEditingStaffId(null);
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save salary structure'));
        } finally {
            setSavingSalary(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Staff</h1>
                    <p className="text-muted-foreground text-[13px]">Everyone on payroll — teachers, admins, and support staff, with or without a QubeEx account</p>
                </div>
                <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    <Plus size={14} /> Add Staff
                </button>
            </div>

            {loading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
            ) : staff.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No staff added yet.</div>
            ) : (
                <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden">
                    {staff.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{s.name}</p>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{STAFF_TYPE_LABEL[s.staffType]}</span>
                                    {!s.userId && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Payroll-only</span>}
                                    {s.status === 'INACTIVE' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Inactive</span>}
                                </div>
                                <p className="text-[11px] text-muted-foreground">{s.designation || '—'} · {s.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => startEditSalary(s)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold">
                                    {s.salaryStructure ? 'Edit salary' : 'Assign salary'}
                                </button>
                                <button onClick={() => toggleStatus(s)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold">
                                    {s.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                                </button>
                                <button onClick={() => removeStaff(s.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {addOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-2xl max-w-lg w-full mx-4 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold">Add Staff</h3>
                            <button onClick={() => setAddOpen(false)}><X size={16} /></button>
                        </div>
                        <div className="flex gap-1 bg-muted/50 rounded-full p-0.5 w-fit">
                            <button onClick={() => setAddMode('new')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${addMode === 'new' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>Payroll-only</button>
                            <button onClick={() => setAddMode('link')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${addMode === 'link' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>Link existing profile</button>
                        </div>

                        {addMode === 'link' ? (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm"
                                        placeholder="Search by name or email…" value={linkSearch}
                                        onChange={e => { setLinkSearch(e.target.value); setSelectedLink(null); }} />
                                </div>
                                {linkResults.length > 0 && (
                                    <div className="border border-border/50 rounded-lg divide-y divide-border/30 max-h-40 overflow-y-auto">
                                        {linkResults.map(p => (
                                            <button key={p.userId} onClick={() => setSelectedLink(p)}
                                                className={`w-full text-left px-3 py-2 text-xs ${selectedLink?.userId === p.userId ? 'bg-primary/10' : 'hover:bg-muted/40'}`}>
                                                <p className="font-semibold">{p.name}</p>
                                                <p className="text-muted-foreground">{p.email} · {p.role}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <input className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" placeholder="Full name"
                                    value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} />
                                <input className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" placeholder="Email"
                                    value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} />
                                <input className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" placeholder="Phone (optional)"
                                    value={newStaff.phone} onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })} />
                                <input className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" placeholder="Designation (e.g. Peon, Driver)"
                                    value={newStaff.designation} onChange={e => setNewStaff({ ...newStaff, designation: e.target.value })} />
                                <select className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm"
                                    value={newStaff.staffType} onChange={e => setNewStaff({ ...newStaff, staffType: e.target.value as StaffMember['staffType'] })}>
                                    <option value="HELPER">Helper</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                        )}

                        <button onClick={submitAdd} disabled={addSaving}
                            className="w-full h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Save size={14} /> {addSaving ? 'Adding…' : 'Add Staff'}
                        </button>
                    </div>
                </div>
            )}

            {editingStaffId && salaryDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-2xl max-w-lg w-full mx-4 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold">Salary Structure</h3>
                            <button onClick={() => setEditingStaffId(null)}><X size={16} /></button>
                        </div>
                        {templates.length > 0 && (
                            <select className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs"
                                value={salaryDraft.templateId ?? ''} onChange={e => e.target.value && applyTemplate(e.target.value)}>
                                <option value="">Start from a template… (optional)</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        )}
                        <LineItemEditor items={salaryDraft.earnings} onChange={earnings => setSalaryDraft({ ...salaryDraft, earnings })} label="Earnings" />
                        <LineItemEditor items={salaryDraft.deductions} onChange={deductions => setSalaryDraft({ ...salaryDraft, deductions })} label="Deductions" />
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <input placeholder="Account Name" className="h-8 px-2 rounded-lg border border-border bg-background"
                                value={salaryDraft.bankDetails.accountName}
                                onChange={e => setSalaryDraft({ ...salaryDraft, bankDetails: { ...salaryDraft.bankDetails, accountName: e.target.value } })} />
                            <input placeholder="Account Number" className="h-8 px-2 rounded-lg border border-border bg-background"
                                value={salaryDraft.bankDetails.accountNumber}
                                onChange={e => setSalaryDraft({ ...salaryDraft, bankDetails: { ...salaryDraft.bankDetails, accountNumber: e.target.value } })} />
                            <input placeholder="IFSC" className="h-8 px-2 rounded-lg border border-border bg-background"
                                value={salaryDraft.bankDetails.ifsc}
                                onChange={e => setSalaryDraft({ ...salaryDraft, bankDetails: { ...salaryDraft.bankDetails, ifsc: e.target.value } })} />
                            <input placeholder="Bank Name" className="h-8 px-2 rounded-lg border border-border bg-background"
                                value={salaryDraft.bankDetails.bankName}
                                onChange={e => setSalaryDraft({ ...salaryDraft, bankDetails: { ...salaryDraft.bankDetails, bankName: e.target.value } })} />
                        </div>
                        <button onClick={saveSalary} disabled={savingSalary}
                            className="w-full h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Save size={14} /> {savingSalary ? 'Saving…' : 'Save Salary Structure'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
