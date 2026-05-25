'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, X, Check, Upload, QrCode,
    CreditCard, Building2, ChevronDown,
    Landmark, Wallet, Users, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface FeeSubItem { id: string; label: string; amount: number; }
interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
interface BankDetails { accountName: string; accountNumber: string; ifsc: string; bankName: string; branch: string; }
interface FeeMonth { id: string; month: string; dueDate: string; status: 'PAID' | 'PENDING'; paidDate?: string; remark?: string; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUS_CFG = {
    PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING: { label: 'Pending', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};
const MOCK_STUDENTS = [
    { id: 'st1', name: 'Aarav Mehta', rollNo: '01', paid: true },
    { id: 'st2', name: 'Priya Singh', rollNo: '02', paid: false },
    { id: 'st3', name: 'Rohan Gupta', rollNo: '03', paid: true },
    { id: 'st4', name: 'Sneha Patel', rollNo: '04', paid: false },
    { id: 'st5', name: 'Arjun Kumar', rollNo: '05', paid: true },
    { id: 'st6', name: 'Meera Sharma', rollNo: '06', paid: false },
    { id: 'st7', name: 'Karan Joshi', rollNo: '07', paid: true },
    { id: 'st8', name: 'Ananya Nair', rollNo: '08', paid: false },
    { id: 'st9', name: 'Vikram Rao', rollNo: '09', paid: true },
    { id: 'st10', name: 'Ishaan Verma', rollNo: '10', paid: false },
];
const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

export function FeesTab({ divisionId, divisionName, feesSubTab }: {
    divisionId: string; divisionName: string; feesSubTab: 'setup' | 'students';
}) {
    const [feeItems, setFeeItems] = useState<FeeItem[]>([
        { id: 'f1', label: 'Tuition Fee', amount: 6000, subItems: [{ id: 'f1s1', label: 'Term 1', amount: 2000 }, { id: 'f1s2', label: 'Term 2', amount: 2000 }, { id: 'f1s3', label: 'Term 3', amount: 2000 }] },
        { id: 'f2', label: 'Lab Fee', amount: 500, subItems: [{ id: 'f2s1', label: 'Physics Lab', amount: 200 }, { id: 'f2s2', label: 'Chemistry Lab', amount: 300 }] },
        { id: 'f3', label: 'Library Fee', amount: 200, subItems: [] },
    ]);
    const [addingFeeItem, setAddingFeeItem] = useState(false);
    const [addingSubItem, setAddingSubItem] = useState<string | null>(null);
    const [newFeeLabel, setNewFeeLabel] = useState('');
    const [newFeeAmount, setNewFeeAmount] = useState('');
    const [newSubLabel, setNewSubLabel] = useState('');
    const [newSubAmount, setNewSubAmount] = useState('');
    const [expandedFeeId, setExpandedFeeId] = useState<string[]>(['f1']);
    const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [extraStudentFields, setExtraStudentFields] = useState<{ label: string; value: string }[]>([]);
    const [addingStudentField, setAddingStudentField] = useState(false);
    const [newStudentFieldLabel, setNewStudentFieldLabel] = useState('');
    const [extraColumns, setExtraColumns] = useState<{ label: string }[]>([]);
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnLabel, setNewColumnLabel] = useState('');
    const [feeMonths, setFeeMonths] = useState<FeeMonth[]>([
        { id: 'm1', month: 'June', dueDate: '10 Jun 2026', status: 'PAID', paidDate: '8 Jun 2026' },
        { id: 'm2', month: 'July', dueDate: '10 Jul 2026', status: 'PENDING' },
        { id: 'm3', month: 'August', dueDate: '10 Aug 2026', status: 'PENDING' },
        { id: 'm4', month: 'September', dueDate: '10 Sep 2026', status: 'PENDING' },
    ]);
    const [addingMonth, setAddingMonth] = useState(false);
    const [newMonth, setNewMonth] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [bankDetails, setBankDetails] = useState<BankDetails>({ accountName: 'Delhi Public School', accountNumber: '1234567890', ifsc: 'HDFC0001234', bankName: 'HDFC Bank', branch: 'Connaught Place' });
    const [editingBank, setEditingBank] = useState(false);
    const [bankDraft, setBankDraft] = useState<BankDetails>(bankDetails);
    const [qrImage, setQrImage] = useState<string | null>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);
    const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
    const [studentFilter, setStudentFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [showListMenu, setShowListMenu] = useState(false);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node))
                setMonthDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const totalFee = feeItems.reduce((n, f) => {
        const s = f.subItems.reduce((m, s) => m + s.amount, 0);
        return n + (s > 0 ? s : f.amount);
    }, 0);

    const addFeeItem = () => {
        if (!newFeeLabel.trim()) return;
        setFeeItems(prev => [...prev, { id: `f-${Date.now()}`, label: newFeeLabel.trim(), amount: Number(newFeeAmount) || 0, subItems: [] }]);
        setNewFeeLabel(''); setNewFeeAmount(''); setAddingFeeItem(false);
        toast.success('Fee item added');
    };

    const toggleFeeExpand = (id: string) => {
        setExpandedFeeId(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };
    const addSubItem = (feeId: string) => {
        if (!newSubLabel.trim()) return;
        setFeeItems(prev => prev.map(f => f.id !== feeId ? f : { ...f, subItems: [...f.subItems, { id: `s-${Date.now()}`, label: newSubLabel.trim(), amount: Number(newSubAmount) || 0 }] }));
        setNewSubLabel(''); setNewSubAmount(''); setAddingSubItem(null);
        toast.success('Sub-item added');
    };
    const removeFeeItem = (id: string) => setFeeItems(prev => prev.filter(f => f.id !== id));
    const removeSubItem = (feeId: string, subId: string) => setFeeItems(prev => prev.map(f => f.id !== feeId ? f : { ...f, subItems: f.subItems.filter(s => s.id !== subId) }));
    const addMonth = () => {
        if (!newMonth || !newDueDate) return;
        setFeeMonths(prev => [...prev, { id: `m-${Date.now()}`, month: newMonth, dueDate: newDueDate, status: 'PENDING' }]);
        setNewMonth(''); setNewDueDate(''); setAddingMonth(false);
        toast.success('Month added');
    };
    const updateMonthStatus = (id: string, status: FeeMonth['status']) => setFeeMonths(prev => prev.map(m => m.id === id ? { ...m, status } : m));

    const generatePDF = (type: 'all' | 'pending') => {
        const students = type === 'all' ? MOCK_STUDENTS : MOCK_STUDENTS.filter(s => !s.paid);
        const content = students.map(s => `${s.rollNo}. ${s.name} — ${s.paid ? 'Paid' : 'Pending'}`).join('\n');
        const blob = new Blob([
            `${divisionName} — Fee List (${type === 'all' ? 'All Students' : 'Pending Only'})\n\n${content}`
        ], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${divisionName}-fees-${type}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('List downloaded!');
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <AnimatePresence mode="wait">

                {/* ── Fee Setup ── */}
                {feesSubTab === 'setup' && (
                    <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 overflow-y-auto space-y-3 pb-2">

                        {/* ROW 1 — Fee Structure + Payment Methods */}
                        <div className="flex gap-3">

                            {/* LEFT — Fee Structure */}
                            <div className="w-[50%] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/20 shrink-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <CreditCard size={15} /> Monthly Fee Structure
                                    </p>
                                    <button onClick={() => setAddingFeeItem(true)}
                                        className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        <Plus size={11} /> Add Field
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                                    {feeItems.map(fee => {
                                        const subTotal = fee.subItems.reduce((n, s) => n + s.amount, 0);
                                        const displayAmount = subTotal > 0 ? subTotal : fee.amount;
                                        const isExpanded = expandedFeeId.includes(fee.id);
                                        return (
                                            <div key={fee.id} className="rounded-xl border border-border/40 overflow-hidden">
                                                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20">
                                                    {editingFeeId === fee.id ? (
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <input defaultValue={fee.label}
                                                                onChange={e => setFeeItems(prev => prev.map(f => f.id === fee.id ? { ...f, label: e.target.value } : f))}
                                                                className="flex-1 h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                                            <input defaultValue={fee.amount} type="number"
                                                                onChange={e => setFeeItems(prev => prev.map(f => f.id === fee.id ? { ...f, amount: Number(e.target.value) } : f))}
                                                                className="w-20 h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                                            <button onClick={() => { setEditingFeeId(null); toast.success('Updated'); }}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                <Check size={11} />
                                                            </button>
                                                            <button onClick={() => setEditingFeeId(null)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                                <X size={11} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => toggleFeeExpand(fee.id)}
                                                                    className="text-muted-foreground hover:text-foreground transition-colors">
                                                                    <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                                </button>
                                                                <span className="text-sm font-semibold">{fee.label}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold">₹{displayAmount.toLocaleString()}</span>
                                                                <button onClick={() => setEditingFeeId(fee.id)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">Edit</button>
                                                                <button onClick={() => removeFeeItem(fee.id)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 transition-colors">
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                            <div className="px-3 py-2 space-y-1 border-t border-border/30 bg-background">
                                                                {fee.subItems.map(sub => (
                                                                    <div key={sub.id} className="flex items-center justify-between py-1.5 pl-5 border-b border-border/20 last:border-none">
                                                                        {editingSubId === sub.id ? (
                                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                                <input defaultValue={sub.label}
                                                                                    onChange={e => setFeeItems(prev => prev.map(f => f.id === fee.id ? { ...f, subItems: f.subItems.map(s => s.id === sub.id ? { ...s, label: e.target.value } : s) } : f))}
                                                                                    className="flex-1 h-6 px-2 rounded-lg border border-primary/50 bg-primary/5 text-[11px] focus:outline-none" />
                                                                                <input defaultValue={sub.amount} type="number"
                                                                                    onChange={e => setFeeItems(prev => prev.map(f => f.id === fee.id ? { ...f, subItems: f.subItems.map(s => s.id === sub.id ? { ...s, amount: Number(e.target.value) } : s) } : f))}
                                                                                    className="w-16 h-6 px-2 rounded-lg border border-primary/50 bg-primary/5 text-[11px] focus:outline-none" />
                                                                                <button onClick={() => { setEditingSubId(null); toast.success('Updated'); }}
                                                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                                                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                                    <Check size={10} />
                                                                                </button>
                                                                                <button onClick={() => setEditingSubId(null)} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                                                    <X size={10} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-xs text-muted-foreground">{sub.label}</span>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs font-semibold">₹{sub.amount.toLocaleString()}</span>
                                                                                    <button onClick={() => setEditingSubId(sub.id)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">Edit</button>
                                                                                    <button onClick={() => removeSubItem(fee.id, sub.id)} className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500">
                                                                                        <X size={10} />
                                                                                    </button>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {addingSubItem === fee.id ? (
                                                                    <div className="flex items-center gap-1.5 pl-5 pt-1">
                                                                        <input value={newSubLabel} onChange={e => setNewSubLabel(e.target.value)} placeholder="Sub-field name"
                                                                            className="flex-1 h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                                                        <input value={newSubAmount} onChange={e => setNewSubAmount(e.target.value)} type="number" placeholder="₹"
                                                                            className="w-20 h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                                                        <button onClick={() => addSubItem(fee.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                            <Check size={11} />
                                                                        </button>
                                                                        <button onClick={() => setAddingSubItem(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                                            <X size={11} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => setAddingSubItem(fee.id)} className="flex items-center gap-1 pl-5 text-[11px] text-muted-foreground hover:text-primary transition-colors pt-1">
                                                                        <Plus size={11} /> Add sub-field
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}

                                    {addingFeeItem && (
                                        <div className="flex items-center gap-2">
                                            <input value={newFeeLabel} onChange={e => setNewFeeLabel(e.target.value)} placeholder="Field name (e.g. Tuition Fee)"
                                                className="flex-1 h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                            <input value={newFeeAmount} onChange={e => setNewFeeAmount(e.target.value)} type="number" placeholder="₹ Amount"
                                                className="w-24 h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                            <button onClick={addFeeItem} className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Check size={13} />
                                            </button>
                                            <button onClick={() => setAddingFeeItem(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                <X size={13} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="border-t-2 border-border/50 mt-2" />
                                    <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1.5">
                                        <p className="text-[11px] font-semibold text-muted-foreground mb-2">Summary</p>
                                        {feeItems.map(fee => {
                                            const s = fee.subItems.reduce((n, s) => n + s.amount, 0);
                                            const amount = s > 0 ? s : fee.amount;
                                            return (
                                                <div key={fee.id} className="flex items-center justify-between">
                                                    <span className="text-[11px] text-muted-foreground">{fee.label}</span>
                                                    <span className="text-[11px] font-semibold">₹{amount.toLocaleString()}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-between py-2 mt-2">
                                        <span className="text-sm font-bold">Total</span>
                                        <span className="text-base font-black" style={{ color: '#7C3AED' }}>₹{totalFee.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — Payment Methods */}
                            <div className="w-[50%] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                <div className="px-5 py-3.5 border-b border-border/50 bg-muted/20 shrink-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Landmark size={15} /> Payment Methods
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 divide-y divide-border/40">

                                    {/* Bank Details */}
                                    <div className="pb-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-semibold flex items-center gap-1.5"><Building2 size={14} /> Bank Details</p>
                                            {!editingBank ? (
                                                <button onClick={() => { setBankDraft(bankDetails); setEditingBank(true); }} className="text-[11px] text-primary font-medium hover:underline">Edit</button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setBankDetails(bankDraft); setEditingBank(false); toast.success('Saved'); }} className="text-[11px] text-emerald-600 font-semibold hover:underline">Save</button>
                                                    <button onClick={() => setEditingBank(false)} className="text-[11px] text-muted-foreground hover:underline">Cancel</button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            {[{ label: 'Account Name', key: 'accountName' }, { label: 'Account No.', key: 'accountNumber' }, { label: 'IFSC', key: 'ifsc' }, { label: 'Bank', key: 'bankName' }, { label: 'Branch', key: 'branch' }].map(({ label, key }) => (
                                                <div key={key} className="flex items-center justify-between">
                                                    <span className="text-[11px] text-muted-foreground">{label}</span>
                                                    {editingBank ? (
                                                        <input value={bankDraft[key as keyof BankDetails]} onChange={e => setBankDraft(prev => ({ ...prev, [key]: e.target.value }))}
                                                            className="w-40 h-6 px-2 rounded-lg border border-primary/50 bg-primary/5 text-[11px] focus:outline-none text-right" />
                                                    ) : (
                                                        <span className="text-[11px] font-semibold">{bankDetails[key as keyof BankDetails]}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* QR Code */}
                                    <div className="pt-1 pb-3">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-semibold flex items-center gap-1.5"><QrCode size={14} /> QR Code</p>
                                            <button onClick={() => qrInputRef.current?.click()}
                                                className="flex items-center gap-1 text-[11px] font-semibold text-white h-6 px-2.5 rounded-lg hover:opacity-90 transition-all"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Upload size={11} /> {qrImage ? 'Replace' : 'Upload'}
                                            </button>
                                            <input ref={qrInputRef} type="file" accept="image/*" className="hidden"
                                                onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file) { const reader = new FileReader(); reader.onload = () => setQrImage(reader.result as string); reader.readAsDataURL(file); toast.success('QR uploaded'); }
                                                }} />
                                        </div>

                                        {/* QR center mein */}
                                        <div className="flex justify-center pt-0">
                                            {qrImage ? (
                                                <div className="relative w-48 h-48">
                                                    <img src={qrImage} alt="QR" className="w-48 h-48 rounded-xl object-cover border border-border/50" />
                                                    <button onClick={() => setQrImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-48 h-48 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/40 transition-all"
                                                    onClick={() => qrInputRef.current?.click()}>
                                                    <QrCode size={32} className="text-muted-foreground/40" />
                                                    <p className="text-[10px] text-muted-foreground/60">Upload QR</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Payment Gateway */}
                                    <div className="pt-0">
                                        <p className="text-xs font-semibold flex items-center gap-1.5 mb-3"><CreditCard size={14} /> Payment Gateway</p>
                                        <div className="rounded-xl border-2 border-dashed border-border/40 px-4 py-6 flex flex-col items-center justify-center text-center gap-2">
                                            <CreditCard size={20} className="text-muted-foreground/30" />
                                            <p className="text-xs font-medium text-muted-foreground">Coming Soon</p>
                                            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">Payment gateway will be available in a future update</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2 — Fee Card Template full width */}
                        <div className="w-[70%] bg-card border border-border/50 rounded-2xl shadow-sm shadow-black/5">
                            <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Wallet size={15} /> Fee Card Template
                                </p>
                            </div>

                            {/* Student Details */}
                            <div className="px-4 pt-3 pb-2">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Student Details</p>
                                    <button onClick={() => setAddingStudentField(true)} className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline">
                                        <Plus size={11} /> Add Field
                                    </button>
                                </div>
                                <div className="rounded-xl border border-border/40 overflow-hidden">
                                    {[{ label: 'Name', value: 'Student Name' }, { label: 'Roll No', value: 'Roll Number' }, { label: 'Class', value: 'Class Name' }, { label: 'Division', value: 'Division Name' }, ...extraStudentFields].map((field, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-none">
                                            <span className="text-[11px] text-muted-foreground w-24 shrink-0">{field.label}</span>
                                            <span className="text-[11px] font-medium text-foreground/50 italic">{field.value}</span>
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
                                            <button onClick={() => setAddingStudentField(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                <X size={11} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Fee Table */}
                            <div className="px-4 pb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fee Table</p>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setAddingColumn(true)} className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline">
                                            <Plus size={11} /> Add Column
                                        </button>
                                        <button onClick={() => setAddingMonth(true)} className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline">
                                            <Plus size={11} /> Add Row
                                        </button>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border/40 overflow-hidden inline-block">
                                    <table className="text-xs">
                                        <thead>
                                            <tr className="bg-muted/30 border-b border-border/40">
                                                {['Month', 'Due Date', 'Paid Date', 'Status', 'Remark', ...extraColumns.map(c => c.label)].map((col, i) => (
                                                    <th key={i} className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                                ))}
                                                <th className="px-2 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/20">
                                            {feeMonths.map(m => (
                                                <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="px-2 py-2 font-semibold whitespace-nowrap">{m.month}</td>
                                                    <td className="px-2 py-2">
                                                        <input value={m.dueDate} onChange={e => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, dueDate: e.target.value } : x))}
                                                            className="w-22 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input value={m.paidDate ?? ''} onChange={e => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, paidDate: e.target.value } : x))}
                                                            placeholder="—" className="w-22 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <button onClick={() => updateMonthStatus(m.id, m.status === 'PAID' ? 'PENDING' : 'PAID')}
                                                            className={`flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-semibold transition-all ${STATUS_CFG[m.status].cls}`}>
                                                            {m.status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[m.status].label}
                                                        </button>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input value={m.remark ?? ''} onChange={e => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, remark: e.target.value } : x))}
                                                            placeholder="—" className="w-25 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40" />
                                                    </td>
                                                    {extraColumns.map((col, ci) => (
                                                        <td key={ci} className="px-2 py-2">
                                                            <input placeholder="—" className="w-20 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40" />
                                                        </td>
                                                    ))}
                                                    <td className="px-2 py-2">
                                                        <button onClick={() => setFeeMonths(prev => prev.filter(x => x.id !== m.id))}
                                                            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 transition-colors">
                                                            <X size={11} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {addingMonth && (
                                        <div className="px-3 py-2 border-t border-border/40 bg-primary/5 flex items-center gap-2">
                                            <div ref={monthDropdownRef} className="relative">
                                                <button type="button" onClick={() => setMonthDropdownOpen(v => !v)}
                                                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border/50 bg-muted/30 text-xs font-medium text-muted-foreground hover:border-primary/40 transition-all">
                                                    {newMonth || 'Select Month'}
                                                    <ChevronDown size={11} className={`transition-transform ${monthDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                <AnimatePresence>
                                                    {monthDropdownOpen && (
                                                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                            transition={{ duration: 0.15 }}
                                                            className="absolute bottom-8 left-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[130px] max-h-48 overflow-y-auto">
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
                                            <input value={newDueDate} onChange={e => setNewDueDate(e.target.value)} placeholder="Due date"
                                                className="w-28 h-7 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none" />
                                            <button onClick={addMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Check size={11} />
                                            </button>
                                            <button onClick={() => { setAddingMonth(false); setNewMonth(''); setNewDueDate(''); }}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                <X size={11} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </motion.div>
                )}

                {/* ── Student Fees ── */}
                {feesSubTab === 'students' && (
                    <motion.div key="students" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex gap-3 flex-1 min-h-0 overflow-hidden">

                        {/* LEFT — Students List */}
                        <div className="w-[25%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="px-3.5 py-2.5 border-b border-border/40 shrink-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold flex items-center gap-2"><Users size={15} /> Students ({MOCK_STUDENTS.length})</p>
                                    <div className="relative">
                                        <button onClick={() => setShowListMenu(v => !v)}
                                            className="flex items-center gap-1.5 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                            Get List <ChevronDown size={11} />
                                        </button>
                                        <AnimatePresence>
                                            {showListMenu && (
                                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[150px]">
                                                    <button onClick={() => { generatePDF('all'); setShowListMenu(false); }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2">
                                                        📋 All Students
                                                    </button>
                                                    <button onClick={() => { generatePDF('pending'); setShowListMenu(false); }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2">
                                                        ⏳ Pending Only
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                            {/* Filters — header ke niche */}
                            <div className="px-4 py-2 border-b border-border/40 shrink-0 flex gap-1 bg-background">                                {[
                                { key: 'all' as const, label: 'All' },
                                { key: 'paid' as const, label: 'Paid' },
                                { key: 'pending' as const, label: 'Pending' },
                            ].map(f => (
                                <button key={f.key} onClick={() => setStudentFilter(f.key)}
                                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${studentFilter === f.key
                                        ? f.key === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                            : f.key === 'pending' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                                : 'bg-primary text-white'
                                        : 'bg-muted text-muted-foreground hover:text-foreground'
                                        }`}>
                                    {f.label}
                                </button>
                            ))}
                            </div>

                            <div className="flex-1 overflow-y-auto bg-background">
                                {MOCK_STUDENTS.filter(s => studentFilter === 'all' ? true : studentFilter === 'paid' ? s.paid : !s.paid).map(student => {
                                    const isSelected = selectedStudent?.id === student.id;
                                    return (
                                        <button key={student.id} onClick={() => setSelectedStudent(student)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-all hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(student.name) }}>
                                                {getInitials(student.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate">{student.name}</p>
                                                <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                            </div>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${student.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                                {student.paid ? 'Paid' : 'Pending'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT — Student Fee Details */}
                        <div className="w-[75%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="px-4 py-3 border-b border-border/40 shrink-0">
                                <p className="text-sm font-bold">Fee Details</p>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                                {!selectedStudent ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                            <Users size={20} className="text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student to view fee details</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">

                                        {/* Student Header */}
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(selectedStudent.name) }}>
                                                {getInitials(selectedStudent.name)}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold">{selectedStudent.name}</p>
                                                <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo}</p>
                                            </div>
                                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${selectedStudent.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                                {selectedStudent.paid ? '✓ Paid' : '⏳ Pending'}
                                            </span>
                                        </div>

                                        {/* Fee Card */}
                                        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm shadow-black/5">
                                            {/* Fee Card Header */}
                                            <div className="px-4 py-3 bg-muted/20 border-b border-border/40">
                                                <p className="text-sm font-bold">{selectedStudent.name}'s Fee Card</p>
                                                <p className="text-[11px] text-muted-foreground">{divisionName}</p>
                                            </div>

                                            {/* Student Details from template */}
                                            <div className="px-4 py-3 border-b border-border/40">
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Student Details</p>
                                                <div className="rounded-xl border border-border/40 overflow-hidden">
                                                    {[
                                                        { label: 'Name', value: selectedStudent.name },
                                                        { label: 'Roll No', value: selectedStudent.rollNo },
                                                        { label: 'Class', value: 'Class Name' },
                                                        { label: 'Division', value: divisionName },
                                                    ].map((field, i) => (
                                                        <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-none">
                                                            <span className="text-[11px] text-muted-foreground w-24 shrink-0">{field.label}</span>
                                                            <span className="text-[11px] font-medium">{field.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Fee Table from template */}
                                            <div className="px-4 py-3 border-b border-border/40">
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fee Table</p>
                                                <div className="rounded-xl border border-border/40 overflow-hidden">
                                                    <table className="text-xs w-full">
                                                        <thead>
                                                            <tr className="bg-muted/30 border-b border-border/40">
                                                                {['Month', 'Due Date', 'Paid Date', 'Status', 'Remark', ...extraColumns.map(c => c.label)].map((col, i) => (
                                                                    <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/20">
                                                            {feeMonths.map(m => (
                                                                <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                                                                    {/* Month — non editable */}
                                                                    <td className="px-3 py-2 text-[11px] font-semibold whitespace-nowrap">{m.month}</td>
                                                                    {/* Due Date — non editable */}
                                                                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.dueDate}</td>
                                                                    {/* Paid Date — editable */}
                                                                    <td className="px-3 py-2">
                                                                        <input value={m.paidDate ?? ''}
                                                                            onChange={e => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, paidDate: e.target.value } : x))}
                                                                            placeholder="—"
                                                                            className="w-24 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40" />
                                                                    </td>
                                                                    {/* Status — editable */}
                                                                    <td className="px-3 py-2">
                                                                        <button onClick={() => updateMonthStatus(m.id, m.status === 'PAID' ? 'PENDING' : 'PAID')}
                                                                            className={`flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-semibold transition-all ${STATUS_CFG[m.status].cls}`}>
                                                                            {m.status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[m.status].label}
                                                                        </button>
                                                                    </td>
                                                                    {/* Remark — editable */}
                                                                    <td className="px-3 py-2">
                                                                        <input value={m.remark ?? ''}
                                                                            onChange={e => setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, remark: e.target.value } : x))}
                                                                            placeholder="—"
                                                                            className="w-28 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40" />
                                                                    </td>
                                                                    {/* Extra columns — editable */}
                                                                    {extraColumns.map((col, ci) => (
                                                                        <td key={ci} className="px-3 py-2">
                                                                            <input placeholder="—"
                                                                                className="w-20 h-6 px-2 rounded-lg border border-border/40 bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40" />
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Monthly Fee Structure */}
                                        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                            <div className="px-4 py-3 bg-muted/20 border-b border-border/40">
                                                <p className="text-sm font-bold">{selectedStudent.name}'s Fee Structure</p>
                                                <p className="text-[11px] text-muted-foreground">{divisionName}</p>
                                            </div>
                                            <div className="px-4 py-3 space-y-2">
                                                {feeItems.map(fee => {
                                                    const subTotal = fee.subItems.reduce((n, s) => n + s.amount, 0);
                                                    const displayAmount = subTotal > 0 ? subTotal : fee.amount;
                                                    const isExpanded = expandedFeeId.includes(fee.id);
                                                    return (
                                                        <div key={fee.id} className="rounded-xl border border-border/40 overflow-hidden">
                                                            <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20">
                                                                <div className="flex items-center gap-2">
                                                                    {fee.subItems.length > 0 ? (
                                                                        <button onClick={() => toggleFeeExpand(fee.id)}
                                                                            className="text-muted-foreground hover:text-foreground transition-colors">
                                                                            <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                                        </button>
                                                                    ) : (
                                                                        <div className="w-3.5" />
                                                                    )}
                                                                    <span className="text-sm font-semibold">{fee.label}</span>
                                                                </div>
                                                                <span className="text-sm font-bold">₹{displayAmount.toLocaleString()}</span>
                                                            </div>
                                                            <AnimatePresence>
                                                                {isExpanded && (
                                                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                                                        className="overflow-hidden">
                                                                        <div className="px-3 py-2 space-y-1 border-t border-border/30 bg-background">
                                                                            {fee.subItems.map(sub => (
                                                                                <div key={sub.id} className="flex items-center justify-between py-1.5 pl-5 border-b border-border/20 last:border-none">
                                                                                    <span className="text-xs text-muted-foreground">{sub.label}</span>
                                                                                    <span className="text-xs font-semibold">₹{sub.amount.toLocaleString()}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })}

                                                {/* Divider */}
                                                <div className="border-t-2 border-border/50 mt-2" />

                                                {/* Summary */}
                                                <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1.5">
                                                    <p className="text-[11px] font-semibold text-muted-foreground mb-2">Summary</p>
                                                    {feeItems.map(fee => {
                                                        const s = fee.subItems.reduce((n, s) => n + s.amount, 0);
                                                        const amount = s > 0 ? s : fee.amount;
                                                        return (
                                                            <div key={fee.id} className="flex items-center justify-between">
                                                                <span className="text-[11px] text-muted-foreground">{fee.label}</span>
                                                                <span className="text-[11px] font-semibold">₹{amount.toLocaleString()}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Total */}
                                                <div className="flex items-center justify-between py-2 mt-2">
                                                    <span className="text-sm font-bold">Total</span>
                                                    <span className="text-base font-black" style={{ color: '#7C3AED' }}>₹{totalFee.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Column Modal */}
            <AnimatePresence>
                {addingColumn && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAddingColumn(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 shadow-2xl w-64" onClick={e => e.stopPropagation()}>
                            <p className="text-sm font-semibold mb-3">Add Column</p>
                            <input value={newColumnLabel} onChange={e => setNewColumnLabel(e.target.value)} placeholder="Column name" autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && newColumnLabel.trim()) { setExtraColumns(prev => [...prev, { label: newColumnLabel.trim() }]); setNewColumnLabel(''); setAddingColumn(false); } if (e.key === 'Escape') setAddingColumn(false); }}
                                className="w-full h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-sm focus:outline-none mb-3" />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setAddingColumn(false)} className="h-8 px-3 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">Cancel</button>
                                <button onClick={() => { if (!newColumnLabel.trim()) return; setExtraColumns(prev => [...prev, { label: newColumnLabel.trim() }]); setNewColumnLabel(''); setAddingColumn(false); }}
                                    className="h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    Add
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}