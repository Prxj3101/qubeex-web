'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, X, Check, Upload, QrCode, CreditCard, Building2,
    ChevronDown, ChevronRight, Landmark, Wallet, Users, Save,
    Info, FileText, Tag, Calendar, Pencil, Trash2, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type FeeStructureType = 'REGULAR' | 'ADDON' | 'EVENT' | 'ONE_TIME';

interface FeeSubItem { id: string; label: string; amount: number; }
interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
interface FeeStructure { id: string; name: string; type: FeeStructureType; color: string; items: FeeItem[]; }
interface FeeMonth { id: string; month: string; dueDate: string; assignedStructureIds: string[]; remark: string; status: 'PAID' | 'PENDING'; paidDate?: string; }
interface BankDetails { accountName: string; accountNumber: string; ifsc: string; bankName: string; branch: string; upiId?: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const FEE_TYPE_CFG: Record<FeeStructureType, { label: string; color: string; bg: string; text: string; emoji: string }> = {
    REGULAR:  { label: 'Regular Monthly', color: '#7C3AED', bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', emoji: '📅' },
    ADDON:    { label: 'Add-on',           color: '#DA7756', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', emoji: '➕' },
    EVENT:    { label: 'Event / Trip',     color: '#0891B2', bg: 'bg-cyan-100 dark:bg-cyan-950/40',    text: 'text-cyan-700 dark:text-cyan-400',    emoji: '🎒' },
    ONE_TIME: { label: 'One-time',         color: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', emoji: '⭐' },
};

const STATUS_CFG = {
    PAID:    { label: 'Paid',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING: { label: 'Pending', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const MOCK_STUDENTS = [
    { id: 'st1', name: 'Aarav Mehta',   rollNo: '01', paid: true  },
    { id: 'st2', name: 'Priya Singh',   rollNo: '02', paid: false },
    { id: 'st3', name: 'Rohan Gupta',   rollNo: '03', paid: true  },
    { id: 'st4', name: 'Sneha Patel',   rollNo: '04', paid: false },
    { id: 'st5', name: 'Arjun Kumar',   rollNo: '05', paid: true  },
];
const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

const EMPTY_BANK: BankDetails = { accountName: '', accountNumber: '', ifsc: '', bankName: '', branch: '', upiId: '' };

function structureTotal(s: FeeStructure) {
    return s.items.reduce((n, item) => {
        const sub = item.subItems.reduce((m, si) => m + si.amount, 0);
        return n + (sub > 0 ? sub : item.amount);
    }, 0);
}

// ── Fee Structure Card ────────────────────────────────────────────────────────

function FeeStructureCard({
    fs, onEdit, onDelete,
}: {
    fs: FeeStructure;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const cfg = FEE_TYPE_CFG[fs.type];
    const total = structureTotal(fs);

    return (
        <div className="rounded-xl border border-border/40 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/20">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: fs.color }} />
                <button onClick={() => setExpanded(v => !v)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <span className="text-sm font-semibold truncate">{fs.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.text}`}>{cfg.emoji} {cfg.label}</span>
                    <ChevronRight size={13} className={`text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
                </button>
                <span className="text-sm font-bold ml-auto shrink-0">₹{total.toLocaleString()}</span>
                <button onClick={onEdit} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                    <Pencil size={11} />
                </button>
                <button onClick={onDelete} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                    <Trash2 size={11} />
                </button>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-3 py-2 space-y-1 border-t border-border/30 bg-background">
                            {fs.items.length === 0 && (
                                <p className="text-[11px] text-muted-foreground/60 italic py-1">No items added yet</p>
                            )}
                            {fs.items.map(item => {
                                const sub = item.subItems.reduce((n, s) => n + s.amount, 0);
                                const amt = sub > 0 ? sub : item.amount;
                                return (
                                    <div key={item.id}>
                                        <div className="flex items-center justify-between py-1">
                                            <span className="text-xs font-medium">{item.label}</span>
                                            <span className="text-xs font-semibold">₹{amt.toLocaleString()}</span>
                                        </div>
                                        {item.subItems.map(si => (
                                            <div key={si.id} className="flex items-center justify-between py-0.5 pl-4">
                                                <span className="text-[11px] text-muted-foreground">{si.label}</span>
                                                <span className="text-[11px] text-muted-foreground">₹{si.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Month Breakdown (inline) ──────────────────────────────────────────────────

function MonthBreakdown({ month, feeStructures }: { month: FeeMonth; feeStructures: FeeStructure[] }) {
    const assigned = feeStructures.filter(s => month.assignedStructureIds.includes(s.id));
    const total = assigned.reduce((n, s) => n + structureTotal(s), 0);

    if (assigned.length === 0) {
        return <p className="text-[11px] text-muted-foreground/60 italic py-2 px-3">No fee structures assigned to this month</p>;
    }

    return (
        <div className="px-3 py-2 space-y-2">
            {assigned.map(s => {
                const cfg = FEE_TYPE_CFG[s.type];
                const st = structureTotal(s);
                return (
                    <div key={s.id}>
                        <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-bold ${cfg.text} flex items-center gap-1`}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                                {s.name}
                            </span>
                            <span className="text-[11px] font-semibold">₹{st.toLocaleString()}</span>
                        </div>
                        {s.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between py-0.5 pl-3">
                                <span className="text-[10px] text-muted-foreground">{item.label}</span>
                                <span className="text-[10px] text-muted-foreground">₹{(item.subItems.reduce((n, si) => n + si.amount, 0) || item.amount).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                );
            })}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                <span className="text-xs font-bold">Total for {month.month}</span>
                <span className="text-sm font-black" style={{ color: '#7C3AED' }}>₹{total.toLocaleString()}</span>
            </div>
        </div>
    );
}

// ── Add/Edit Fee Structure Modal ──────────────────────────────────────────────

function FeeStructureModal({
    initial,
    onSave,
    onClose,
}: {
    initial?: FeeStructure;
    onSave: (s: FeeStructure) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? '');
    const [type, setType] = useState<FeeStructureType>(initial?.type ?? 'REGULAR');
    const [color, setColor] = useState(initial?.color ?? FEE_TYPE_CFG['REGULAR'].color);
    const [items, setItems] = useState<FeeItem[]>(initial?.items ?? []);
    const [newItemLabel, setNewItemLabel] = useState('');
    const [newItemAmount, setNewItemAmount] = useState('');
    const [addingItem, setAddingItem] = useState(false);
    const [newSubLabel, setNewSubLabel] = useState('');
    const [newSubAmount, setNewSubAmount] = useState('');
    const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

    const total = items.reduce((n, item) => {
        const sub = item.subItems.reduce((m, si) => m + si.amount, 0);
        return n + (sub > 0 ? sub : item.amount);
    }, 0);

    const addItem = () => {
        if (!newItemLabel.trim()) return;
        setItems(prev => [...prev, { id: `i-${Date.now()}`, label: newItemLabel.trim(), amount: Number(newItemAmount) || 0, subItems: [] }]);
        setNewItemLabel(''); setNewItemAmount(''); setAddingItem(false);
    };
    const addSub = (itemId: string) => {
        if (!newSubLabel.trim()) return;
        setItems(prev => prev.map(it => it.id !== itemId ? it : { ...it, subItems: [...it.subItems, { id: `s-${Date.now()}`, label: newSubLabel.trim(), amount: Number(newSubAmount) || 0 }] }));
        setNewSubLabel(''); setNewSubAmount(''); setAddingSubFor(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
                    <p className="text-sm font-bold">{initial ? 'Edit Fee Structure' : 'Add Fee Structure'}</p>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Name */}
                    <div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Name</p>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Regular Monthly Fee, Annual Picnic..."
                            className="w-full h-9 px-3 rounded-xl border border-border/50 bg-muted/30 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                    </div>

                    {/* Type */}
                    <div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Type</p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {(Object.keys(FEE_TYPE_CFG) as FeeStructureType[]).map(t => {
                                const cfg = FEE_TYPE_CFG[t];
                                const isActive = type === t;
                                return (
                                    <button key={t} onClick={() => { setType(t); setColor(cfg.color); }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${isActive ? `border-current ${cfg.bg} ${cfg.text}` : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                        <span>{cfg.emoji}</span> {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fee Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-semibold text-muted-foreground">Fee Items</p>
                            <button onClick={() => setAddingItem(true)} className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1">
                                <Plus size={11} /> Add Item
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {items.map(item => {
                                const sub = item.subItems.reduce((n, s) => n + s.amount, 0);
                                return (
                                    <div key={item.id} className="rounded-xl border border-border/40 overflow-hidden">
                                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                                            <span className="flex-1 text-xs font-medium">{item.label}</span>
                                            <span className="text-xs font-semibold">₹{(sub > 0 ? sub : item.amount).toLocaleString()}</span>
                                            <button onClick={() => setAddingSubFor(item.id)} className="text-[10px] text-muted-foreground hover:text-primary">+ sub</button>
                                            <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="w-4 h-4 flex items-center justify-center text-muted-foreground/40 hover:text-red-500">
                                                <X size={10} />
                                            </button>
                                        </div>
                                        {item.subItems.map(si => (
                                            <div key={si.id} className="flex items-center justify-between px-3 py-1.5 pl-6 border-t border-border/20 bg-background">
                                                <span className="text-[11px] text-muted-foreground">{si.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px]">₹{si.amount.toLocaleString()}</span>
                                                    <button onClick={() => setItems(prev => prev.map(it => it.id !== item.id ? it : { ...it, subItems: it.subItems.filter(s => s.id !== si.id) }))} className="w-3.5 h-3.5 flex items-center justify-center text-muted-foreground/40 hover:text-red-500">
                                                        <X size={9} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {addingSubFor === item.id && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 pl-6 border-t border-border/20 bg-primary/5">
                                                <input value={newSubLabel} onChange={e => setNewSubLabel(e.target.value)} placeholder="Sub-item name"
                                                    className="flex-1 h-6 px-2 rounded-lg border border-primary/50 bg-transparent text-[11px] focus:outline-none" />
                                                <input value={newSubAmount} onChange={e => setNewSubAmount(e.target.value)} type="number" placeholder="₹"
                                                    className="w-16 h-6 px-2 rounded-lg border border-primary/50 bg-transparent text-[11px] focus:outline-none" />
                                                <button onClick={() => addSub(item.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                    <Check size={10} />
                                                </button>
                                                <button onClick={() => { setAddingSubFor(null); setNewSubLabel(''); setNewSubAmount(''); }}
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {addingItem && (
                                <div className="flex items-center gap-1.5">
                                    <input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)} placeholder="Item name (e.g. Tuition Fee)"
                                        onKeyDown={e => e.key === 'Enter' && addItem()}
                                        className="flex-1 h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                    <input value={newItemAmount} onChange={e => setNewItemAmount(e.target.value)} type="number" placeholder="₹"
                                        className="w-20 h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                    <button onClick={addItem} className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        <Check size={12} />
                                    </button>
                                    <button onClick={() => { setAddingItem(false); setNewItemLabel(''); setNewItemAmount(''); }}
                                        className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {total > 0 && (
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                                <span className="text-xs font-semibold text-muted-foreground">Total</span>
                                <span className="text-sm font-black" style={{ color }}> ₹{total.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border/40 flex gap-2 justify-end shrink-0">
                    <button onClick={onClose} className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (!name.trim()) { toast.error('Enter a name'); return; }
                            onSave({ id: initial?.id ?? `fs-${Date.now()}`, name: name.trim(), type, color, items });
                        }}
                        className="h-9 px-5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        {initial ? 'Save Changes' : 'Add Structure'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ── Main FeesTab ──────────────────────────────────────────────────────────────

export function FeesTab({ divisionId, divisionName, feesSubTab }: {
    divisionId: string; divisionName: string; feesSubTab: 'setup' | 'students';
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templateFrom, setTemplateFrom] = useState<string | null>(null);

    // Fee structures (multiple named bundles)
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FeeStructure | undefined>(undefined);

    // Monthly schedule
    const [feeMonths, setFeeMonths] = useState<FeeMonth[]>([]);
    const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
    const [assigningMonthId, setAssigningMonthId] = useState<string | null>(null);
    const [addingMonth, setAddingMonth] = useState(false);
    const [newMonth, setNewMonth] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);

    // General remark
    const [generalRemark, setGeneralRemark] = useState('');

    // Bank / QR
    const [bankDetails, setBankDetails] = useState<BankDetails>(EMPTY_BANK);
    const [editingBank, setEditingBank] = useState(false);
    const [bankDraft, setBankDraft] = useState<BankDetails>(EMPTY_BANK);
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [uploadingQr, setUploadingQr] = useState(false);
    const qrInputRef = useRef<HTMLInputElement>(null);

    // Fee card template
    const [extraStudentFields, setExtraStudentFields] = useState<{ label: string; value: string }[]>([]);
    const [addingStudentField, setAddingStudentField] = useState(false);
    const [newStudentFieldLabel, setNewStudentFieldLabel] = useState('');
    const [extraColumns, setExtraColumns] = useState<{ label: string }[]>([]);
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnLabel, setNewColumnLabel] = useState('');

    // Students tab
    const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
    const [studentFilter, setStudentFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [showListMenu, setShowListMenu] = useState(false);

    // ── Load / Save ─────────────────────────────────────────────────────────

    const applyData = useCallback((data: {
        feeStructures?: FeeStructure[];
        feeMonths?: { id: string; month: string; dueDate: string; assignedStructureIds?: string[]; remark?: string }[];
        bankDetails?: BankDetails | null;
        qrImageUrl?: string | null;
        extraColumns?: { label: string }[];
        extraStudentFields?: { label: string; value: string }[];
        generalRemark?: string | null;
    }) => {
        setFeeStructures(data.feeStructures ?? []);
        setFeeMonths((data.feeMonths ?? []).map(m => ({
            ...m,
            assignedStructureIds: m.assignedStructureIds ?? [],
            remark: m.remark ?? '',
            status: 'PENDING' as const,
        })));
        setBankDetails(data.bankDetails ?? EMPTY_BANK);
        setBankDraft(data.bankDetails ?? EMPTY_BANK);
        setQrImageUrl(data.qrImageUrl ?? null);
        setExtraColumns(data.extraColumns ?? []);
        setExtraStudentFields(data.extraStudentFields ?? []);
        setGeneralRemark(data.generalRemark ?? '');
    }, []);

    useEffect(() => {
        api.get(`/admin/campus/divisions/${divisionId}/fee-structure`)
            .then(res => {
                const data = res.data.data;
                if (data) {
                    applyData(data);
                    if (data.isTemplate && data.templateFrom) setTemplateFrom(data.templateFrom);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [divisionId, applyData]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node))
                setMonthDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/admin/campus/divisions/${divisionId}/fee-structure`, {
                feeStructures,
                feeMonths: feeMonths.map(({ id, month, dueDate, assignedStructureIds, remark }) => ({ id, month, dueDate, assignedStructureIds, remark })),
                bankDetails: bankDetails.accountName ? bankDetails : null,
                qrImageUrl,
                extraColumns,
                extraStudentFields,
                generalRemark: generalRemark.trim() || null,
            });
            setTemplateFrom(null);
            toast.success('Fee structure saved');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleQrSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploadingQr(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await api.post('/admin/campus/feed/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setQrImageUrl(res.data.data.url);
            toast.success('QR uploaded');
        } catch {
            toast.error('QR upload failed');
        } finally {
            setUploadingQr(false);
        }
    };

    const addMonth = () => {
        if (!newMonth || !newDueDate) return;
        setFeeMonths(prev => [...prev, { id: `m-${Date.now()}`, month: newMonth, dueDate: newDueDate, assignedStructureIds: [], remark: '', status: 'PENDING' }]);
        setNewMonth(''); setNewDueDate(''); setAddingMonth(false);
    };

    const toggleStructureForMonth = (monthId: string, structureId: string) => {
        setFeeMonths(prev => prev.map(m => {
            if (m.id !== monthId) return m;
            const has = m.assignedStructureIds.includes(structureId);
            return { ...m, assignedStructureIds: has ? m.assignedStructureIds.filter(id => id !== structureId) : [...m.assignedStructureIds, structureId] };
        }));
    };

    const monthTotal = (m: FeeMonth) =>
        feeStructures.filter(s => m.assignedStructureIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);

    const generatePDF = (type: 'all' | 'pending') => {
        const students = type === 'all' ? MOCK_STUDENTS : MOCK_STUDENTS.filter(s => !s.paid);
        const blob = new Blob([`${divisionName} — Fee List\n\n${students.map(s => `${s.rollNo}. ${s.name} — ${s.paid ? 'Paid' : 'Pending'}`).join('\n')}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${divisionName}-fees.txt`; a.click();
        URL.revokeObjectURL(url); toast.success('Downloaded');
    };

    if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading fee structure...</div>;

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-3 h-full">
            <AnimatePresence mode="wait">

                {/* ── Fee Setup ── */}
                {feesSubTab === 'setup' && (
                    <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 overflow-y-auto space-y-3 pb-2">

                        {/* Template banner */}
                        {templateFrom && (
                            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <Info size={13} /> Pre-filled from <span className="font-semibold">{templateFrom}</span> — modify as needed for {divisionName}
                                </p>
                                <button onClick={() => setTemplateFrom(null)} className="w-5 h-5 rounded flex items-center justify-center text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950 transition-all">
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* Save + General Remark row */}
                        <div className="flex items-start gap-3">
                            <div className="flex-1 bg-card border border-border/50 rounded-2xl px-4 py-3">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <FileText size={12} /> General Remark / Notes
                                </p>
                                <textarea
                                    value={generalRemark}
                                    onChange={e => setGeneralRemark(e.target.value)}
                                    placeholder="e.g. Fee due by 10th of every month. Late fee ₹100 after 15th. Contact accounts@school.com for queries."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl border border-border/40 bg-muted/30 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all resize-none"
                                />
                            </div>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-1.5 h-9 px-5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-all shrink-0 mt-1"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <Save size={12} /> {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>

                        {/* ROW 1: Fee Structures + Payment Methods */}
                        <div className="flex gap-3">

                            {/* LEFT — Fee Structures */}
                            <div className="w-[55%] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/20 shrink-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Tag size={13} /> Fee Structures
                                    </p>
                                    <button onClick={() => { setEditingStructure(undefined); setShowStructureModal(true); }}
                                        className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        <Plus size={11} /> Add Structure
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                                    {feeStructures.length === 0 && (
                                        <div className="text-center py-8">
                                            <Tag size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                                            <p className="text-xs text-muted-foreground/60">No fee structures yet</p>
                                            <p className="text-[11px] text-muted-foreground/40 mt-1">Add Regular, Add-on, or Event fee structures</p>
                                        </div>
                                    )}
                                    {feeStructures.map(fs => (
                                        <FeeStructureCard key={fs.id} fs={fs}
                                            onEdit={() => { setEditingStructure(fs); setShowStructureModal(true); }}
                                            onDelete={() => {
                                                setFeeStructures(prev => prev.filter(s => s.id !== fs.id));
                                                setFeeMonths(prev => prev.map(m => ({ ...m, assignedStructureIds: m.assignedStructureIds.filter(id => id !== fs.id) })));
                                            }}
                                        />
                                    ))}

                                    {/* Type legend */}
                                    {feeStructures.length > 0 && (
                                        <div className="pt-2 border-t border-border/30 flex flex-wrap gap-x-3 gap-y-1">
                                            {(Object.keys(FEE_TYPE_CFG) as FeeStructureType[]).map(t => {
                                                const cfg = FEE_TYPE_CFG[t];
                                                return (
                                                    <span key={t} className={`text-[10px] font-semibold flex items-center gap-1 ${cfg.text}`}>
                                                        {cfg.emoji} {cfg.label}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT — Payment Methods */}
                            <div className="w-[45%] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                <div className="px-4 py-2.5 border-b border-border/50 bg-muted/20 shrink-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Landmark size={13} /> Payment Methods
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 divide-y divide-border/30">

                                    {/* Bank Details */}
                                    <div className="pb-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-semibold flex items-center gap-1.5"><Building2 size={13} /> Bank Details</p>
                                            {!editingBank
                                                ? <button onClick={() => { setBankDraft(bankDetails); setEditingBank(true); }} className="text-[11px] text-primary font-medium hover:underline">Edit</button>
                                                : <div className="flex gap-2">
                                                    <button onClick={() => { setBankDetails(bankDraft); setEditingBank(false); toast.success('Saved'); }} className="text-[11px] text-emerald-600 font-semibold hover:underline">Save</button>
                                                    <button onClick={() => setEditingBank(false)} className="text-[11px] text-muted-foreground hover:underline">Cancel</button>
                                                </div>
                                            }
                                        </div>
                                        <div className="space-y-1">
                                            {[
                                                { label: 'Account Name', key: 'accountName' },
                                                { label: 'Account No.', key: 'accountNumber' },
                                                { label: 'IFSC', key: 'ifsc' },
                                                { label: 'Bank', key: 'bankName' },
                                                { label: 'Branch', key: 'branch' },
                                                { label: 'UPI ID', key: 'upiId' },
                                            ].map(({ label, key }) => (
                                                <div key={key} className="flex items-center justify-between">
                                                    <span className="text-[11px] text-muted-foreground">{label}</span>
                                                    {editingBank
                                                        ? <input value={(bankDraft as unknown as Record<string, string>)[key] ?? ''} onChange={e => setBankDraft(prev => ({ ...prev, [key]: e.target.value }))}
                                                            className="w-36 h-6 px-2 rounded-lg border border-primary/50 bg-primary/5 text-[11px] focus:outline-none text-right" />
                                                        : <span className="text-[11px] font-semibold">{(bankDetails as unknown as Record<string, string>)[key] || '—'}</span>
                                                    }
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* QR Code */}
                                    <div className="pt-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-semibold flex items-center gap-1.5"><QrCode size={13} /> QR Code</p>
                                            <button onClick={() => qrInputRef.current?.click()} disabled={uploadingQr}
                                                className="flex items-center gap-1 text-[11px] font-semibold text-white h-6 px-2.5 rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Upload size={11} /> {uploadingQr ? 'Uploading...' : qrImageUrl ? 'Replace' : 'Upload'}
                                            </button>
                                            <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrSelect} />
                                        </div>
                                        <div className="flex justify-center">
                                            {qrImageUrl ? (
                                                <div className="relative w-36 h-36">
                                                    <img src={qrImageUrl} alt="QR" className="w-36 h-36 rounded-xl object-cover border border-border/50" />
                                                    <button onClick={() => setQrImageUrl(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-36 h-36 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/40 transition-all"
                                                    onClick={() => qrInputRef.current?.click()}>
                                                    {uploadingQr
                                                        ? <span className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                                                        : <QrCode size={28} className="text-muted-foreground/40" />}
                                                    <p className="text-[10px] text-muted-foreground/60">{uploadingQr ? 'Uploading...' : 'Upload QR'}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Payment Gateway placeholder */}
                                    <div className="pt-3">
                                        <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><CreditCard size={13} /> Payment Gateway</p>
                                        <div className="rounded-xl border-2 border-dashed border-border/40 px-4 py-4 flex flex-col items-center gap-1.5">
                                            <CreditCard size={18} className="text-muted-foreground/30" />
                                            <p className="text-xs text-muted-foreground">Coming Soon</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: Fee Schedule (Monthly Planner) */}
                        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/20">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Calendar size={13} /> Monthly Fee Schedule
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Assign fee structures to each month. Click a month to see breakdown.</p>
                                </div>
                                <button onClick={() => setAddingMonth(true)}
                                    className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    <Plus size={11} /> Add Month
                                </button>
                            </div>

                            {feeMonths.length === 0 && !addingMonth && (
                                <div className="py-8 text-center">
                                    <Calendar size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                                    <p className="text-xs text-muted-foreground/60">No months in the schedule yet</p>
                                    <p className="text-[11px] text-muted-foreground/40 mt-1">Add months (e.g. June–March) to build the academic year fee calendar</p>
                                </div>
                            )}

                            <div className="divide-y divide-border/20">
                                {feeMonths.map(m => {
                                    const total = monthTotal(m);
                                    const isExpanded = expandedMonthId === m.id;
                                    const isAssigning = assigningMonthId === m.id;
                                    const assignedCount = m.assignedStructureIds.length;

                                    return (
                                        <div key={m.id}>
                                            {/* Month row */}
                                            <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                                {/* Month name */}
                                                <div className="w-20 shrink-0">
                                                    <p className="text-xs font-semibold">{m.month}</p>
                                                    <p className="text-[10px] text-muted-foreground">{m.dueDate || 'No due date'}</p>
                                                </div>

                                                {/* Assigned structures chips */}
                                                <div className="flex-1 flex flex-wrap gap-1 min-w-0">
                                                    {m.assignedStructureIds.length === 0 ? (
                                                        <span className="text-[11px] text-muted-foreground/50 italic">No structures assigned</span>
                                                    ) : (
                                                        feeStructures.filter(s => m.assignedStructureIds.includes(s.id)).map(s => (
                                                            <span key={s.id} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                                style={{ background: s.color + '20', color: s.color }}>
                                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                                                                {s.name}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Total */}
                                                <div className="text-right shrink-0 w-20">
                                                    {total > 0
                                                        ? <p className="text-sm font-bold" style={{ color: '#7C3AED' }}>₹{total.toLocaleString()}</p>
                                                        : <p className="text-[11px] text-muted-foreground/50">—</p>
                                                    }
                                                </div>

                                                {/* Remark */}
                                                <input value={m.remark} onChange={e => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, remark: e.target.value } : x))}
                                                    placeholder="Remark..."
                                                    className="w-28 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shrink-0" />

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => setAssigningMonthId(isAssigning ? null : m.id)}
                                                        className={`h-6 px-2 rounded-lg text-[10px] font-semibold border transition-all ${isAssigning ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary'}`}>
                                                        {assignedCount > 0 ? `${assignedCount} assigned` : 'Assign'}
                                                    </button>
                                                    <button onClick={() => setExpandedMonthId(isExpanded ? null : m.id)}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                    <button onClick={() => setFeeMonths(prev => prev.filter(x => x.id !== m.id))}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Assign structures dropdown */}
                                            <AnimatePresence>
                                                {isAssigning && (
                                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                        <div className="px-4 pb-3 pt-1 bg-muted/10 border-t border-border/20">
                                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Select fee structures for {m.month}</p>
                                                            {feeStructures.length === 0 ? (
                                                                <p className="text-[11px] text-muted-foreground/60 italic">Create fee structures first</p>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {feeStructures.map(s => {
                                                                        const active = m.assignedStructureIds.includes(s.id);
                                                                        return (
                                                                            <button key={s.id} onClick={() => toggleStructureForMonth(m.id, s.id)}
                                                                                className={`flex items-center gap-1.5 h-7 px-3 rounded-xl border-2 text-[11px] font-semibold transition-all`}
                                                                                style={active
                                                                                    ? { borderColor: s.color, background: s.color + '20', color: s.color }
                                                                                    : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                                                                                {active && <Check size={10} />}
                                                                                {s.name}
                                                                                <span className="opacity-60 text-[10px]">₹{structureTotal(s).toLocaleString()}</span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Month breakdown */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                        <div className="border-t border-border/20 bg-muted/5">
                                                            <MonthBreakdown month={m} feeStructures={feeStructures} />
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add month form */}
                            {addingMonth && (
                                <div className="px-4 py-3 border-t border-border/40 bg-primary/5 flex items-center gap-2">
                                    <div ref={monthDropdownRef} className="relative">
                                        <button type="button" onClick={() => setMonthDropdownOpen(v => !v)}
                                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/50 bg-card text-xs font-medium text-muted-foreground hover:border-primary/40 transition-all">
                                            {newMonth || 'Select Month'} <ChevronDown size={11} className={`transition-transform ${monthDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        <AnimatePresence>
                                            {monthDropdownOpen && (
                                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                    className="absolute bottom-9 left-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[130px] max-h-48 overflow-y-auto">
                                                    {MONTHS.map(m => (
                                                        <button key={m} type="button" onClick={() => { setNewMonth(m); setMonthDropdownOpen(false); }}
                                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${newMonth === m ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                                            {m}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <input value={newDueDate} onChange={e => setNewDueDate(e.target.value)} placeholder="Due date (e.g. 10 Jun)"
                                        className="w-36 h-8 px-3 rounded-xl border border-border/50 bg-card text-xs focus:outline-none focus:border-primary/50" />
                                    <button onClick={addMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        <Check size={13} />
                                    </button>
                                    <button onClick={() => { setAddingMonth(false); setNewMonth(''); setNewDueDate(''); }}
                                        className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                        <X size={13} />
                                    </button>
                                </div>
                            )}

                            {/* Annual summary */}
                            {feeMonths.length > 0 && (
                                <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between">
                                    <span className="text-[11px] text-muted-foreground">{feeMonths.length} months in schedule</span>
                                    <span className="text-xs font-bold">
                                        Annual Total: <span style={{ color: '#7C3AED' }}>₹{feeMonths.reduce((n, m) => n + monthTotal(m), 0).toLocaleString()}</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* ROW 3: Fee Card Template */}
                        <div className="bg-card border border-border/50 rounded-2xl shadow-sm shadow-black/5">
                            <div className="px-4 py-2.5 border-b border-border/50 bg-muted/20">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Wallet size={13} /> Fee Card Template
                                </p>
                            </div>
                            <div className="flex gap-4 px-4 py-3">

                                {/* Student fields */}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[11px] font-semibold text-muted-foreground">Student Details</p>
                                        <button onClick={() => setAddingStudentField(true)} className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1"><Plus size={11} /> Add Field</button>
                                    </div>
                                    <div className="rounded-xl border border-border/40 overflow-hidden">
                                        {[{ label: 'Name', value: 'Student Name' }, { label: 'Roll No', value: 'Roll Number' }, { label: 'Class', value: 'Class Name' }, { label: 'Division', value: 'Division Name' }, ...extraStudentFields].map((f, i) => (
                                            <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-none">
                                                <span className="text-[11px] text-muted-foreground w-24 shrink-0">{f.label}</span>
                                                <span className="text-[11px] font-medium text-foreground/50 italic">{f.value}</span>
                                            </div>
                                        ))}
                                        {addingStudentField && (
                                            <div className="flex items-center gap-2 px-3 py-2 border-t border-border/20">
                                                <input value={newStudentFieldLabel} onChange={e => setNewStudentFieldLabel(e.target.value)} placeholder="Field name"
                                                    className="flex-1 h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                                <button onClick={() => { if (!newStudentFieldLabel.trim()) return; setExtraStudentFields(prev => [...prev, { label: newStudentFieldLabel.trim(), value: newStudentFieldLabel.trim() }]); setNewStudentFieldLabel(''); setAddingStudentField(false); }}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                    <Check size={11} />
                                                </button>
                                                <button onClick={() => setAddingStudentField(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50"><X size={11} /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Extra columns */}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[11px] font-semibold text-muted-foreground">Extra Fee Table Columns</p>
                                        <button onClick={() => setAddingColumn(true)} className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1"><Plus size={11} /> Add Column</button>
                                    </div>
                                    {extraColumns.length === 0 && !addingColumn && (
                                        <p className="text-[11px] text-muted-foreground/50 italic">No extra columns added</p>
                                    )}
                                    <div className="space-y-1">
                                        {extraColumns.map((col, i) => (
                                            <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/30 border border-border/30">
                                                <span className="text-[11px] font-medium">{col.label}</span>
                                                <button onClick={() => setExtraColumns(prev => prev.filter((_, j) => j !== i))} className="w-4 h-4 flex items-center justify-center text-muted-foreground/40 hover:text-red-500"><X size={10} /></button>
                                            </div>
                                        ))}
                                        {addingColumn && (
                                            <div className="flex items-center gap-2">
                                                <input value={newColumnLabel} onChange={e => setNewColumnLabel(e.target.value)} placeholder="Column name" autoFocus
                                                    onKeyDown={e => { if (e.key === 'Enter' && newColumnLabel.trim()) { setExtraColumns(prev => [...prev, { label: newColumnLabel.trim() }]); setNewColumnLabel(''); setAddingColumn(false); } }}
                                                    className="flex-1 h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                                <button onClick={() => { if (!newColumnLabel.trim()) return; setExtraColumns(prev => [...prev, { label: newColumnLabel.trim() }]); setNewColumnLabel(''); setAddingColumn(false); }}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                    <Check size={11} />
                                                </button>
                                                <button onClick={() => setAddingColumn(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50"><X size={11} /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                )}

                {/* ── Student Fees ── */}
                {feesSubTab === 'students' && (
                    <motion.div key="students" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex gap-3 flex-1 min-h-0 overflow-hidden">

                        {/* LEFT — Student list */}
                        <div className="w-[25%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="px-3.5 py-2.5 border-b border-border/40 shrink-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold flex items-center gap-2"><Users size={14} /> Students ({MOCK_STUDENTS.length})</p>
                                    <div className="relative">
                                        <button onClick={() => setShowListMenu(v => !v)}
                                            className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                            Get List <ChevronDown size={11} />
                                        </button>
                                        <AnimatePresence>
                                            {showListMenu && (
                                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                    className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                                                    <button onClick={() => { generatePDF('all'); setShowListMenu(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted">📋 All Students</button>
                                                    <button onClick={() => { generatePDF('pending'); setShowListMenu(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted">⏳ Pending Only</button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                            <div className="px-3.5 py-1.5 border-b border-border/40 shrink-0 flex gap-1 bg-background">
                                {(['all', 'paid', 'pending'] as const).map(f => (
                                    <button key={f} onClick={() => setStudentFilter(f)}
                                        className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all ${studentFilter === f
                                            ? f === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                : f === 'pending' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                                    : 'bg-primary text-white'
                                            : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto bg-background">
                                {MOCK_STUDENTS.filter(s => studentFilter === 'all' ? true : studentFilter === 'paid' ? s.paid : !s.paid).map(student => (
                                    <button key={student.id} onClick={() => setSelectedStudent(student)}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3 border-b border-border/20 text-left hover:bg-muted/30 transition-all ${selectedStudent?.id === student.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                            style={{ background: getAvatarColor(student.name) }}>
                                            {getInitials(student.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{student.name}</p>
                                            <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                        </div>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${student.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                            {student.paid ? 'Paid' : 'Pending'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT — Student fee card */}
                        <div className="flex-1 flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="px-4 py-3 border-b border-border/40 shrink-0">
                                <p className="text-sm font-bold">Fee Card</p>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                                {!selectedStudent ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3"><Users size={20} className="text-muted-foreground" /></div>
                                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student to view their fee card</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">

                                        {/* Student header */}
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(selectedStudent.name) }}>
                                                {getInitials(selectedStudent.name)}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold">{selectedStudent.name}</p>
                                                <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo} · {divisionName}</p>
                                            </div>
                                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${selectedStudent.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                                {selectedStudent.paid ? '✓ Paid' : '⏳ Pending'}
                                            </span>
                                        </div>

                                        {/* Monthly payment schedule */}
                                        {feeMonths.length > 0 && (
                                            <div className="rounded-2xl border border-border/50 overflow-hidden">
                                                <div className="px-4 py-2.5 bg-muted/20 border-b border-border/40">
                                                    <p className="text-xs font-bold">Monthly Payment Schedule</p>
                                                    {generalRemark && <p className="text-[11px] text-muted-foreground mt-0.5 italic">{generalRemark}</p>}
                                                </div>
                                                <table className="text-xs w-full">
                                                    <thead>
                                                        <tr className="bg-muted/10 border-b border-border/30">
                                                            {['Month', 'Fee Structures', 'Amount (₹)', 'Due Date', 'Paid Date', 'Status', 'Remark', ...extraColumns.map(c => c.label)].map((col, i) => (
                                                                <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/20">
                                                        {feeMonths.map(m => {
                                                            const total = monthTotal(m);
                                                            const assigned = feeStructures.filter(s => m.assignedStructureIds.includes(s.id));
                                                            return (
                                                                <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                                                                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{m.month}</td>
                                                                    <td className="px-3 py-2">
                                                                        <div className="flex flex-wrap gap-0.5">
                                                                            {assigned.length === 0
                                                                                ? <span className="text-[10px] text-muted-foreground/50 italic">—</span>
                                                                                : assigned.map(s => (
                                                                                    <span key={s.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                                        style={{ background: s.color + '20', color: s.color }}>
                                                                                        {s.name}
                                                                                    </span>
                                                                                ))
                                                                            }
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-bold">{total > 0 ? `₹${total.toLocaleString()}` : '—'}</td>
                                                                    <td className="px-3 py-2 text-muted-foreground">{m.dueDate}</td>
                                                                    <td className="px-3 py-2">
                                                                        <input value={m.paidDate ?? ''} onChange={e => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, paidDate: e.target.value } : x))}
                                                                            placeholder="—" className="w-20 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40" />
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <button onClick={() => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, status: x.status === 'PAID' ? 'PENDING' : 'PAID' } : x))}
                                                                            className={`flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold transition-all ${STATUS_CFG[m.status].cls}`}>
                                                                            {m.status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[m.status].label}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-muted-foreground">{m.remark || '—'}</td>
                                                                    {extraColumns.map((col, ci) => (
                                                                        <td key={ci} className="px-3 py-2">
                                                                            <input placeholder="—" className="w-16 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none" />
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr className="bg-muted/20 border-t-2 border-border/40">
                                                            <td className="px-3 py-2 font-bold text-[11px]">Annual Total</td>
                                                            <td />
                                                            <td className="px-3 py-2 text-[11px] font-black" style={{ color: '#7C3AED' }}>
                                                                ₹{feeMonths.reduce((n, m) => n + monthTotal(m), 0).toLocaleString()}
                                                            </td>
                                                            <td colSpan={4 + extraColumns.length} />
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Fee structure breakdown */}
                                        {feeStructures.length > 0 && (
                                            <div className="rounded-2xl border border-border/50 overflow-hidden">
                                                <div className="px-4 py-2.5 bg-muted/20 border-b border-border/40">
                                                    <p className="text-xs font-bold">Fee Structure Breakdown</p>
                                                </div>
                                                <div className="px-4 py-3 space-y-2">
                                                    {feeStructures.map(fs => {
                                                        const total = structureTotal(fs);
                                                        const cfg = FEE_TYPE_CFG[fs.type];
                                                        return (
                                                            <div key={fs.id} className="rounded-xl border border-border/40 overflow-hidden">
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fs.color }} />
                                                                    <span className="flex-1 text-xs font-semibold">{fs.name}</span>
                                                                    <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.emoji} {cfg.label}</span>
                                                                    <span className="text-xs font-bold">₹{total.toLocaleString()}</span>
                                                                </div>
                                                                {fs.items.map(item => (
                                                                    <div key={item.id} className="flex items-center justify-between px-3 py-1.5 pl-5 border-t border-border/20 bg-background">
                                                                        <span className="text-[11px] text-muted-foreground">{item.label}</span>
                                                                        <span className="text-[11px] font-medium">₹{(item.subItems.reduce((n, s) => n + s.amount, 0) || item.amount).toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {feeMonths.length === 0 && feeStructures.length === 0 && (
                                            <div className="text-center py-8">
                                                <p className="text-sm text-muted-foreground">No fee structure set up yet</p>
                                                <p className="text-xs text-muted-foreground/60 mt-1">Go to Fee Setup tab to configure fee structures</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add/Edit fee structure modal */}
            <AnimatePresence>
                {showStructureModal && (
                    <FeeStructureModal
                        initial={editingStructure}
                        onSave={s => {
                            if (editingStructure) {
                                setFeeStructures(prev => prev.map(fs => fs.id === s.id ? s : fs));
                            } else {
                                setFeeStructures(prev => [...prev, s]);
                            }
                            setShowStructureModal(false);
                        }}
                        onClose={() => setShowStructureModal(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
