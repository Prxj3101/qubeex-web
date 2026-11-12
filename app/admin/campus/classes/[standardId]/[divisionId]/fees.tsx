'use client';

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, X, Check, Upload, QrCode, CreditCard, Building2,
    ChevronDown, ChevronRight, Landmark, Wallet, Users,
    Info, FileText, Tag, Calendar, Pencil, Trash2, ChevronUp,
    RotateCw, RefreshCw, Rotate3d, GripVertical, ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { busMonthAmount, busMonthIds } from '@/lib/busFee';
import { ThemedSelect } from '@/app/admin/payroll/_components/ui';
import { useAcademicYear, useIsHistoricalYear } from '@/context/AcademicYearContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type FeeStructureType = 'REGULAR' | 'ADDON' | 'PENALTY' | 'ONE_TIME' | 'BUS' | 'LATE_FEE';

interface FeeSubItem { id: string; label: string; amount: number; }
interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
// origin distinguishes where a structure was created: 'setup' via Fee Setup's
// "Add Structure" button, 'student' via a student's fee card "+" button.
// Absent on structures saved before this field existed — treated as 'setup'.
interface FeeStructure { id: string; name: string; type: FeeStructureType; color: string; items: FeeItem[]; origin?: 'setup' | 'student'; }
interface FeeMonth { id: string; month: string; dueDate: string; assignedStructureIds: string[]; status: 'PAID' | 'PENDING'; paidDate?: string; }
// Transport (Admin → Transport): buses with their route's stops, and who rides which.
interface TransportBusOption { id: string; name: string; morningShift: boolean; afternoonShift: boolean; route: { id: string; name: string; stops: { id: string; name: string; monthlyFee: number | null }[] } | null; }
interface StudentRide { studentId: string; busId: string; stopId: string | null; shift: 'MORNING' | 'AFTERNOON'; }
interface BankDetails { accountName: string; accountNumber: string; ifsc: string; bankName: string; branch: string; upiId?: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Parses flexible free-text dates like "10 Aug 26", "Aug 10 2026", "10 August"
// (year defaults to current year if omitted) into a comparable Date.
function parseFlexDate(input: string | null | undefined): Date | null {
    if (!input) return null;
    const str = input.trim();
    if (!str) return null;
    const monthIdx = MONTHS.findIndex(m => new RegExp(`\\b${m.slice(0, 3)}`, 'i').test(str));
    if (monthIdx === -1) return null;
    const nums = str.match(/\d+/g);
    if (!nums || nums.length === 0) return null;
    const day = parseInt(nums[0], 10);
    if (Number.isNaN(day) || day < 1 || day > 31) return null;
    let year = new Date().getFullYear();
    if (nums.length > 1) {
        const y = parseInt(nums[1], 10);
        if (!Number.isNaN(y)) year = y < 100 ? 2000 + y : y;
    }
    const d = new Date(year, monthIdx, day);
    return Number.isNaN(d.getTime()) ? null : d;
}

// Paid date is "late" if it's strictly after the due date (day-level comparison).
function isPaidLate(dueDate: string | null | undefined, paidDate: string | null | undefined): boolean {
    const due = parseFlexDate(dueDate);
    const paid = parseFlexDate(paidDate);
    if (!due || !paid) return false;
    return paid.getTime() > due.getTime();
}

// The Late Fee Fine applies once today is strictly after the due date, AND
// either no paid date has been entered yet, or the paid date entered is
// itself after the due date (i.e. actually paid late). Once it has applied
// it stays applied — status/paid-date edits don't clear it unless the paid
// date entered is on or before the due date (meaning the student genuinely
// paid on time and the admin was just late updating the record).
function isLateFeeApplicable(dueDate: string | null | undefined, paidDate: string | null | undefined): boolean {
    const due = parseFlexDate(dueDate);
    if (!due) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (today.getTime() <= due.getTime()) return false;
    if (!paidDate || !paidDate.trim()) return true;
    const paid = parseFlexDate(paidDate);
    if (!paid) return true;
    paid.setHours(0, 0, 0, 0);
    return paid.getTime() > due.getTime();
}

// Live-formats raw typed digits into "DD-MM-YY" as you type — same masking
// pattern as the DOB field elsewhere in the app (e.g. admin/profile).
function formatDateMaskLive(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    if (digits.length > 4) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
    if (digits.length > 2) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return digits;
}

// Once a full "DD-MM-YY" mask has been typed (on blur/enter), convert it into
// the friendly display format "D Mon YY". Leaves the value untouched if it
// isn't a complete/valid mask yet.
function maskToDisplayDate(val: string): string {
    const m = val.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (!m) return val;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) return val;
    if (year < 100) year += 2000;
    const check = new Date(year, month - 1, day);
    if (check.getMonth() !== month - 1 || check.getDate() !== day) return val;
    return `${day} ${MONTHS[month - 1].slice(0, 3)} ${String(year).slice(-2)}`;
}

// Converts an already-saved "D Mon YY" display value back into the "DD-MM-YY"
// typing mask when the field is re-focused, so editing stays consistent.
function displayDateToMask(val: string): string {
    const m = val.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/);
    if (!m) return val;
    const monthIdx = MONTHS.findIndex(mm => mm.slice(0, 3).toLowerCase() === m[2].slice(0, 3).toLowerCase());
    if (monthIdx === -1) return val;
    const day = String(parseInt(m[1], 10)).padStart(2, '0');
    const month = String(monthIdx + 1).padStart(2, '0');
    const year = m[3].length > 2 ? m[3].slice(-2) : m[3];
    return `${day}-${month}-${year}`;
}

const FEE_TYPE_CFG: Record<FeeStructureType, { label: string; color: string; bg: string; text: string; emoji: string; tag?: string; unique?: boolean }> = {
    REGULAR: { label: 'Regular Monthly', color: '#7C3AED', bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', emoji: '📅' },
    ADDON: { label: 'Add-on', color: '#DA7756', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', emoji: '➕' },
    PENALTY: { label: 'Penalty / Fine', color: '#DC2626', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', emoji: '⚠️' },
    ONE_TIME: { label: 'One-time', color: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', emoji: '⭐' },
    // Bus Fee and Late Fee Fine may each only exist ONCE across a division's fee
    // structures (unique: true) — enforced in FeeStructureForm's type picker.
    BUS: { label: 'Bus Fee', color: '#0891B2', bg: 'bg-cyan-100 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', emoji: '🚌', tag: 'Variable', unique: true },
    LATE_FEE: { label: 'Late Fee Fine', color: '#DC2626', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', emoji: '⚠️', tag: 'Auto', unique: true },
};

type StudentDetailField = {
    id: string;
    kind: 'default' | 'custom';
    defaultKey?: 'name' | 'rollNo' | 'studentId' | 'class' | 'division' | 'bus';
    label: string;
    value?: string;
};
const DEFAULT_STUDENT_FIELDS: StudentDetailField[] = [
    { id: 'f-name', kind: 'default', defaultKey: 'name', label: 'Name' },
    { id: 'f-rollno', kind: 'default', defaultKey: 'rollNo', label: 'Roll No' },
    { id: 'f-studentid', kind: 'default', defaultKey: 'studentId', label: 'Student ID' },
    { id: 'f-class', kind: 'default', defaultKey: 'class', label: 'Class' },
    { id: 'f-division', kind: 'default', defaultKey: 'division', label: 'Division' },
    { id: 'f-bus', kind: 'default', defaultKey: 'bus', label: 'Bus' },
];

const FEE_CARD_THEMES = {
    yellow: { name: 'Yellow', bg: '#FFF9E0', border: '#EEDD9B' },
    green: { name: 'Pista', bg: '#F1F6E1', border: '#CBDCA0' },
    blue: { name: 'Blue', bg: '#EEF6FB', border: '#CBE2EF' },
    pink: { name: 'Pink', bg: '#FCF1F4', border: '#EDCED8' },
} as const;
type FeeCardThemeKey = keyof typeof FEE_CARD_THEMES;

const STATUS_CFG = {
    PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
    PENDING: { label: 'Pending', cls: 'bg-red-100 text-red-700' },
};

interface FeesStudent { id: string; studentDisplayId: string; name: string; rollNo: string; paid: boolean; avatarUrl: string | null; }
interface FeePayment { studentId: string; feeMonthId: string; status: 'PAID' | 'PENDING'; paidDate: string | null; remark: string | null; extraFields: Record<string, string> | null; extraStructureIds: string[] | null; }
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

// Bus Fee and Late Fee Fine are no longer created via the "Add Structure" modal —
// they're fixed system structures that exist by default for every division, ready
// for the admin to edit (rename / set amount) rather than create from scratch.
function ensureDefaultStructures(structures: FeeStructure[]): FeeStructure[] {
    let result = structures;
    if (!result.some(s => s.type === 'BUS')) {
        result = [...result, { id: 'fs-bus-default', name: 'Bus Fee', type: 'BUS', color: FEE_TYPE_CFG.BUS.color, items: [] }];
    }
    if (!result.some(s => s.type === 'LATE_FEE')) {
        result = [...result, {
            id: 'fs-latefee-default', name: 'Late Fee Fine', type: 'LATE_FEE', color: FEE_TYPE_CFG.LATE_FEE.color,
            items: [{ id: 'i-latefee-default', label: 'Late Fee', amount: 0, subItems: [] }],
        }];
    }
    // These two are fixed system types with a fixed color scheme (Late Fee Fine
    // is always red like Penalty, Bus Fee always cyan) — structures created
    // before that color scheme changed still have the old hex baked into their
    // saved `color` field, so keep it in sync with the current config on every
    // load instead of leaving stale colors stuck on old fee cards.
    result = result.map(s => (s.type === 'BUS' || s.type === 'LATE_FEE') && s.color !== FEE_TYPE_CFG[s.type].color
        ? { ...s, color: FEE_TYPE_CFG[s.type].color }
        : s);
    return result;
}

// New structures are always inserted above the fixed Bus Fee / Late Fee Fine
// entries, which stay pinned at the bottom of the list.
function insertStructure(prev: FeeStructure[], s: FeeStructure): FeeStructure[] {
    const idx = prev.findIndex(x => x.type === 'BUS' || x.type === 'LATE_FEE');
    if (idx === -1) return [...prev, s];
    return [...prev.slice(0, idx), s, ...prev.slice(idx)];
}

// ── Fee Structure Card ────────────────────────────────────────────────────────

function FeeStructureCard({
    fs, onEdit, onDelete, onSelect, isAdded, isShared,
}: {
    fs: FeeStructure;
    onEdit: () => void;
    onDelete: () => void;
    onSelect?: () => void;
    isAdded?: boolean;
    isShared?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const cfg = FEE_TYPE_CFG[fs.type];
    const total = structureTotal(fs);
    // Bus Fee / Late Fee Fine are fixed system structures — not deletable.
    const canDelete = fs.type !== 'BUS' && fs.type !== 'LATE_FEE';

    return (
        <div className="rounded-xl border border-border/40 overflow-hidden">
            <div className="px-3 py-2.5 bg-muted/20">
                <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center gap-2 text-left mb-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: fs.color }} />
                    <span className="text-sm font-semibold flex-1 min-w-0 break-words">{fs.name}</span>
                    <ChevronRight size={13} className={`text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
                </button>
                <div className="flex items-center gap-1.5 pl-[18px]">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.text}`}>{cfg.emoji} {cfg.label}</span>
                    {cfg.tag && <span className="text-[9px] font-bold px-1 py-0.5 rounded-full shrink-0 bg-muted-foreground/10 text-muted-foreground">{cfg.tag}</span>}
                    <span className="text-sm font-bold ml-auto shrink-0">₹{total.toLocaleString()}</span>
                    {onSelect && (
                        isShared ? (
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-md text-muted-foreground/60 shrink-0">Assigned</span>
                        ) : (
                            <button onClick={onSelect}
                                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-all shrink-0 ${isAdded ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-white'}`}
                                style={!isAdded ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : undefined}>
                                {isAdded ? <>Remove <X size={11} /></> : <>Add <Plus size={11} /></>}
                            </button>
                        )
                    )}
                    <button onClick={onEdit} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0">
                        <Pencil size={11} />
                    </button>
                    {canDelete && (
                        <button onClick={onDelete} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0">
                            <Trash2 size={11} />
                        </button>
                    )}
                </div>
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

// ── Add/Edit Fee Structure Form (reusable — used both as a standalone modal
// and embedded inline inside the per-student "add structure" panel) ──────────

function FeeStructureForm({
    initial,
    onSave,
    onCancel,
    compact,
    excludeTypes,
    existingStructures,
    defaultOrigin,
}: {
    initial?: FeeStructure;
    onSave: (s: FeeStructure) => void;
    onCancel?: () => void;
    compact?: boolean;
    excludeTypes?: FeeStructureType[];
    existingStructures?: FeeStructure[];
    defaultOrigin?: 'setup' | 'student';
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
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editItemLabel, setEditItemLabel] = useState('');
    const [editItemAmount, setEditItemAmount] = useState('');
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [editSubLabel, setEditSubLabel] = useState('');
    const [editSubAmount, setEditSubAmount] = useState('');

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
    const startEditItem = (item: FeeItem) => {
        setEditingItemId(item.id); setEditItemLabel(item.label); setEditItemAmount(String(item.amount || ''));
        setAddingSubFor(null); setEditingSubId(null);
    };
    const saveEditItem = (itemId: string) => {
        if (!editItemLabel.trim()) return;
        setItems(prev => prev.map(it => it.id !== itemId ? it : { ...it, label: editItemLabel.trim(), amount: Number(editItemAmount) || 0 }));
        setEditingItemId(null); setEditItemLabel(''); setEditItemAmount('');
    };
    const startEditSub = (si: { id: string; label: string; amount: number }) => {
        setEditingSubId(si.id); setEditSubLabel(si.label); setEditSubAmount(String(si.amount || ''));
        setAddingSubFor(null); setEditingItemId(null);
    };
    const saveEditSub = (itemId: string, subId: string) => {
        if (!editSubLabel.trim()) return;
        setItems(prev => prev.map(it => it.id !== itemId ? it : { ...it, subItems: it.subItems.map(s => s.id !== subId ? s : { ...s, label: editSubLabel.trim(), amount: Number(editSubAmount) || 0 }) }));
        setEditingSubId(null); setEditSubLabel(''); setEditSubAmount('');
    };

    return (
        <div className="flex flex-col min-h-0 flex-1">
            <div className={`flex-1 overflow-y-auto space-y-4 ${compact ? 'px-0 py-0' : 'px-5 py-4'}`}>
                {/* Name */}
                <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">Name</p>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Regular Monthly Fee, Add-on, Penalty..."
                        className="w-full h-9 px-3 rounded-xl border border-border/50 bg-muted/30 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                </div>

                {/* Type */}
                <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Type</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        {(Object.keys(FEE_TYPE_CFG) as FeeStructureType[])
                            // Bus Fee / Late Fee Fine are fixed system structures seeded by
                            // default — not creatable here, only shown while editing themselves.
                            // When editing one of them, lock the picker to just that type —
                            // switching a Bus Fee/Late Fee structure into a different type
                            // isn't allowed, so no other types should even be shown.
                            .filter(t => {
                                if (initial && (initial.type === 'BUS' || initial.type === 'LATE_FEE')) return t === initial.type;
                                return !excludeTypes?.includes(t) && (!FEE_TYPE_CFG[t].unique || initial?.type === t);
                            })
                            .map(t => {
                                const cfg = FEE_TYPE_CFG[t];
                                const isActive = type === t;
                                const isTaken = !!cfg.unique && (existingStructures ?? []).some(s => s.type === t && s.id !== initial?.id);
                                return (
                                    <button key={t} type="button"
                                        disabled={isTaken}
                                        onClick={() => { setType(t); setColor(cfg.color); }}
                                        title={isTaken ? `Only one ${cfg.label} structure is allowed — delete the existing one first` : undefined}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${isTaken ? 'opacity-40 cursor-not-allowed border-border/50 text-muted-foreground' : isActive ? `border-current ${cfg.bg} ${cfg.text}` : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                        <span>{cfg.emoji}</span> {cfg.label}
                                        {cfg.tag && (
                                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ${isActive && !isTaken ? 'bg-white/60' : 'bg-muted-foreground/10'}`}>{cfg.tag}</span>
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                </div>

                {/* Fee Items — Bus Fee has no fixed price here; its amount is variable
                    and set separately, so the items editor doesn't apply to it. */}
                {type === 'BUS' ? (
                    <div className="rounded-xl border border-dashed border-border/50 px-3 py-3 text-center">
                        <p className="text-xs font-semibold text-muted-foreground">Variable pricing</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Bus Fee has no fixed amount here — its price is set separately, not as fee items.</p>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-semibold text-muted-foreground">Fee Items <span className="text-red-500">*</span></p>
                            <button onClick={() => setAddingItem(true)} className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1">
                                <Plus size={11} /> Add Item
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {items.map(item => {
                                const sub = item.subItems.reduce((n, s) => n + s.amount, 0);
                                return (
                                    <div key={item.id} className="rounded-xl border border-border/40 overflow-hidden">
                                        {editingItemId === item.id ? (
                                            <div className="flex items-center gap-1.5 px-3 py-2 bg-primary/5">
                                                <input value={editItemLabel} onChange={e => setEditItemLabel(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && saveEditItem(item.id)}
                                                    className="flex-1 h-7 px-2 rounded-lg border border-primary/50 bg-transparent text-xs focus:outline-none" />
                                                <input value={editItemAmount} onChange={e => setEditItemAmount(e.target.value)} type="number" placeholder="₹"
                                                    onKeyDown={e => e.key === 'Enter' && saveEditItem(item.id)}
                                                    className="w-16 h-7 px-2 rounded-lg border border-primary/50 bg-transparent text-xs focus:outline-none" />
                                                <button onClick={() => saveEditItem(item.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                    <Check size={10} />
                                                </button>
                                                <button onClick={() => { setEditingItemId(null); setEditItemLabel(''); setEditItemAmount(''); }}
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50 shrink-0">
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                                                <span className="flex-1 text-xs font-medium">{item.label}</span>
                                                <span className="text-xs font-semibold">₹{(sub > 0 ? sub : item.amount).toLocaleString()}</span>
                                                <button onClick={() => startEditItem(item)} className="w-4 h-4 flex items-center justify-center text-muted-foreground/40 hover:text-primary">
                                                    <Pencil size={9} />
                                                </button>
                                                <button onClick={() => setAddingSubFor(item.id)} className="text-[10px] text-muted-foreground hover:text-primary">+ sub</button>
                                                <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="w-4 h-4 flex items-center justify-center text-muted-foreground/40 hover:text-red-500">
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        )}
                                        {item.subItems.map(si => (
                                            editingSubId === si.id ? (
                                                <div key={si.id} className="flex items-center gap-1.5 px-3 py-1.5 pl-6 border-t border-border/20 bg-primary/5">
                                                    <input value={editSubLabel} onChange={e => setEditSubLabel(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && saveEditSub(item.id, si.id)}
                                                        className="flex-1 h-6 px-2 rounded-lg border border-primary/50 bg-transparent text-[11px] focus:outline-none" />
                                                    <input value={editSubAmount} onChange={e => setEditSubAmount(e.target.value)} type="number" placeholder="₹"
                                                        onKeyDown={e => e.key === 'Enter' && saveEditSub(item.id, si.id)}
                                                        className="w-16 h-6 px-2 rounded-lg border border-primary/50 bg-transparent text-[11px] focus:outline-none" />
                                                    <button onClick={() => saveEditSub(item.id, si.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                        <Check size={10} />
                                                    </button>
                                                    <button onClick={() => { setEditingSubId(null); setEditSubLabel(''); setEditSubAmount(''); }}
                                                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50 shrink-0">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div key={si.id} className="flex items-center justify-between px-3 py-1.5 pl-6 border-t border-border/20 bg-background">
                                                    <span className="text-[11px] text-muted-foreground">{si.label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px]">₹{si.amount.toLocaleString()}</span>
                                                        <button onClick={() => startEditSub(si)} className="w-3.5 h-3.5 flex items-center justify-center text-muted-foreground/40 hover:text-primary">
                                                            <Pencil size={8} />
                                                        </button>
                                                        <button onClick={() => setItems(prev => prev.map(it => it.id !== item.id ? it : { ...it, subItems: it.subItems.filter(s => s.id !== si.id) }))} className="w-3.5 h-3.5 flex items-center justify-center text-muted-foreground/40 hover:text-red-500">
                                                            <X size={9} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
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
                )}
            </div>

            {/* Footer */}
            <div className={`flex gap-2 justify-end shrink-0 ${compact ? 'pt-3' : 'px-5 py-4 border-t border-border/40'}`}>
                {onCancel && (
                    <button onClick={onCancel} className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                        Cancel
                    </button>
                )}
                <button
                    disabled={type !== 'BUS' && items.length === 0}
                    onClick={() => {
                        if (!name.trim()) { toast.error('Enter a name'); return; }
                        const cfg = FEE_TYPE_CFG[type];
                        if (cfg.unique && (existingStructures ?? []).some(s => s.type === type && s.id !== initial?.id)) {
                            toast.error(`Only one ${cfg.label} structure is allowed`);
                            return;
                        }
                        onSave({ id: initial?.id ?? `fs-${Date.now()}`, name: name.trim(), type, color, items: type === 'BUS' ? [] : items, origin: initial?.origin ?? defaultOrigin });
                        if (!initial) {
                            // Reset for the next entry when reused as an always-open inline form.
                            setName(''); setType('REGULAR'); setColor(FEE_TYPE_CFG['REGULAR'].color); setItems([]);
                        }
                    }}
                    className="h-9 px-5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    {initial ? 'Save Changes' : 'Add Structure'}
                </button>
            </div>
        </div>
    );
}

// ── Add/Edit Fee Structure Modal (standalone overlay wrapper around the form) ─

function FeeStructureModal({
    initial,
    onSave,
    onClose,
    existingStructures,
}: {
    initial?: FeeStructure;
    onSave: (s: FeeStructure) => void;
    onClose: () => void;
    existingStructures?: FeeStructure[];
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()} data-admin-surface="">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
                    <p className="text-sm font-bold">{initial ? 'Edit Fee Structure' : 'Add Fee Structure'}</p>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                        <X size={14} />
                    </button>
                </div>

                <FeeStructureForm initial={initial} onSave={onSave} onCancel={onClose} existingStructures={existingStructures} defaultOrigin="setup" />
            </motion.div>
        </div>
    );
}

// ── Main FeesTab ──────────────────────────────────────────────────────────────

export interface FeesTabHandle {
    save: () => Promise<void>;
}

export const FeesTab = forwardRef<FeesTabHandle, {
    divisionId: string; divisionName: string; feesSubTab: 'setup' | 'students';
    onSavingChange?: (saving: boolean) => void;
    /** Called when the setup is changed (before the auto-save runs), for a parent's "Save now" button. */
    onEdit?: () => void;
    /** Paid / pending student counts (same rule as the Student Fees list), for the class header. */
    onCounts?: (counts: { paid: number; pending: number }) => void;
}>(function FeesTab({ divisionId, divisionName, feesSubTab, onSavingChange, onEdit, onCounts }, ref) {
    const { selectedYearId, isCurrentYearSelected } = useAcademicYear();
    const isHistorical = useIsHistoricalYear();
    const effectiveYear = isCurrentYearSelected ? null : selectedYearId;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templateFrom, setTemplateFrom] = useState<string | null>(null);

    // Fee structures (multiple named bundles)
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FeeStructure | undefined>(undefined);
    const [draggedStructureId, setDraggedStructureId] = useState<string | null>(null);
    // Bifurcates the Fee Structures list by where each structure came from:
    // 'setup' = created via the "Add Structure" button here, 'student' = created
    // via a student's fee card "+" button (per-student extras like a one-off
    // penalty), 'default' = the two fixed system structures (Bus Fee / Late Fee
    // Fine). Structures saved before `origin` existed have no value — treated
    // as 'setup' so nothing old disappears.
    const [structureViewFilter, setStructureViewFilter] = useState<'setup' | 'student' | 'default'>('setup');

    // Monthly schedule
    const [feeMonths, setFeeMonths] = useState<FeeMonth[]>([]);
    const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
    const [assigningMonthId, setAssigningMonthId] = useState<string | null>(null);
    const [editingMonthId, setEditingMonthId] = useState<string | null>(null);
    const [editMonthName, setEditMonthName] = useState('');
    const [editDueDate, setEditDueDate] = useState('');
    const [editMonthDropdownOpen, setEditMonthDropdownOpen] = useState(false);
    const editMonthDropdownRef = useRef<HTMLDivElement>(null);
    const [addStructureModalMonthId, setAddStructureModalMonthId] = useState<string | null>(null);
    // Same bifurcation as the main Fee Structures list, but only Setup vs
    // Per-student here — Bus Fee / Late Fee Fine are already excluded from
    // this modal entirely, so there's no "Default" bucket to show.
    const [addModalStructureFilter, setAddModalStructureFilter] = useState<'setup' | 'student'>('setup');
    const [addingMonth, setAddingMonth] = useState(false);
    const [newMonth, setNewMonth] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const feeDetailsScrollRef = useRef<HTMLDivElement>(null);
    const itemRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // General remark
    const [generalRemark, setGeneralRemark] = useState('');

    // Bank / QR
    const [bankDetails, setBankDetails] = useState<BankDetails>(EMPTY_BANK);
    const [editingBank, setEditingBank] = useState(false);
    const [bankDraft, setBankDraft] = useState<BankDetails>(EMPTY_BANK);
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [uploadingQr, setUploadingQr] = useState(false);
    const qrInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Fee card template
    const [studentFields, setStudentFields] = useState<StudentDetailField[]>(DEFAULT_STUDENT_FIELDS);
    const [addingStudentField, setAddingStudentField] = useState(false);
    const [newStudentFieldLabel, setNewStudentFieldLabel] = useState('');
    const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ kind: 'studentField' | 'extraColumn' | 'feeMonth' | 'rule' | 'feeStructure' | 'extraStructure'; id: string; index?: number; label: string; feeMonthId?: string } | null>(null);
    const [confirmBusToggle, setConfirmBusToggle] = useState<{ studentId: string; fieldId: string; nextEnabled: boolean } | null>(null);
    const [busMonthsModal, setBusMonthsModal] = useState<{ studentId: string; fieldId: string } | null>(null);
    const [busMonthsSelection, setBusMonthsSelection] = useState<string[]>([]);
    // Transport: the school's real buses + stops, and who in this division rides which.
    const [transport, setTransport] = useState<{ buses: TransportBusOption[]; rides: StudentRide[] } | null>(null);
    // Pick bus + stop (+ shift) for a student: turning the bus on, or changing it.
    const [busPicker, setBusPicker] = useState<{ studentId: string; fieldId: string; busId: string; stopId: string; shift: 'MORNING' | 'AFTERNOON' } | null>(null);
    const [busSaving, setBusSaving] = useState(false);

    const runConfirmedDelete = () => {
        if (!confirmDelete) return;
        if (confirmDelete.kind === 'studentField') setStudentFields(prev => prev.filter(x => x.id !== confirmDelete.id));
        else if (confirmDelete.kind === 'extraColumn') setExtraColumns(prev => prev.filter((_, j) => j !== confirmDelete.index));
        else if (confirmDelete.kind === 'feeMonth') setFeeMonths(prev => prev.filter(x => x.id !== confirmDelete.id));
        else if (confirmDelete.kind === 'rule') setRulesAndRegs(prev => prev.filter(r => r.id !== confirmDelete.id));
        else if (confirmDelete.kind === 'feeStructure') {
            setFeeStructures(prev => prev.filter(s => s.id !== confirmDelete.id));
            setFeeMonths(prev => prev.map(m => ({ ...m, assignedStructureIds: m.assignedStructureIds.filter(id => id !== confirmDelete.id) })));
        }
        else if (confirmDelete.kind === 'extraStructure' && confirmDelete.feeMonthId) {
            setPaymentField(confirmDelete.feeMonthId, { toggleStructureId: confirmDelete.id });
        }
        setConfirmDelete(null);
    };
    const [extraColumns, setExtraColumns] = useState<{ label: string }[]>([]);
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnLabel, setNewColumnLabel] = useState('');
    const [feeCardFlipped, setFeeCardFlipped] = useState(false);
    const [feeCardTheme, setFeeCardTheme] = useState<FeeCardThemeKey>('yellow');
    const fc = FEE_CARD_THEMES[feeCardTheme];
    const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState('');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [rulesAndRegs, setRulesAndRegs] = useState<{ id: string; text: string }[]>([]);
    const [studentCardFlipped, setStudentCardFlipped] = useState(false);

    // Students tab
    const [rosterStudents, setRosterStudents] = useState<{ id: string; studentDisplayId: string; name: string; rollNo: string; extraDetailFields: Record<string, string> | null; avatarUrl: string | null }[]>([]);
    const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<FeesStudent | null>(null);
    const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);
    const [studentFilter, setStudentFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [showListMenu, setShowListMenu] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [expandedBreakdownItemIds, setExpandedBreakdownItemIds] = useState<Set<string>>(new Set());

    const getPayment = useCallback((studentId: string, feeMonthId: string): FeePayment =>
        feePayments.find(p => p.studentId === studentId && p.feeMonthId === feeMonthId)
        ?? { studentId, feeMonthId, status: 'PENDING', paidDate: null, remark: null, extraFields: null, extraStructureIds: null },
        [feePayments]);

    // Overall paid/pending status tracks only the CURRENT calendar month's fee status
    // (the most recently applicable configured month, at or before "now") — not every
    // month ever added. e.g. if it's August and August is paid, overall = Paid, even if
    // an older month like April is still pending. Once September starts, September's
    // status takes over.
    const isStudentPaid = useCallback((studentId: string) => {
        if (feeMonths.length === 0) return false;
        const currentMonthIndex = new Date().getMonth();
        const withIdx = feeMonths
            .map(m => ({ m, idx: MONTHS.indexOf(m.month) }))
            .filter(x => x.idx !== -1);
        if (withIdx.length === 0) return false;
        const pastOrCurrent = withIdx.filter(x => x.idx <= currentMonthIndex).sort((a, b) => b.idx - a.idx)[0];
        const target = pastOrCurrent ?? [...withIdx].sort((a, b) => a.idx - b.idx)[0];
        return getPayment(studentId, target.m.id).status === 'PAID';
    }, [feeMonths, getPayment]);

    const students: FeesStudent[] = rosterStudents.map(s => ({ ...s, paid: isStudentPaid(s.id) }));
    const paidCount = students.filter(s => s.paid).length;
    const pendingCount = students.length - paidCount;
    useEffect(() => {
        if (!loading) onCounts?.({ paid: paidCount, pending: pendingCount });
    }, [loading, paidCount, pendingCount, onCounts]);

    const paymentSyncTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const setPaymentField = (feeMonthId: string, updates: { status?: 'PAID' | 'PENDING'; paidDate?: string; remark?: string; extraFieldLabel?: string; extraFieldValue?: string; toggleStructureId?: string }) => {
        if (!selectedStudent) return;
        // StudentFeePayment has no academicYearId of its own (it's keyed by the
        // student's live division) — a write here always lands on today's live
        // payment record regardless of which year is selected, so block it
        // outright while browsing history rather than silently mutate current
        // data from a historical screen.
        if (isHistorical) return;
        const studentId = selectedStudent.id;
        const current = getPayment(studentId, feeMonthId);
        const nextExtraFields = updates.extraFieldLabel !== undefined
            ? { ...(current.extraFields ?? {}), [updates.extraFieldLabel]: updates.extraFieldValue ?? '' }
            : current.extraFields;
        const nextExtraStructureIds = updates.toggleStructureId !== undefined
            ? ((current.extraStructureIds ?? []).includes(updates.toggleStructureId)
                ? (current.extraStructureIds ?? []).filter(id => id !== updates.toggleStructureId)
                : [...(current.extraStructureIds ?? []), updates.toggleStructureId])
            : current.extraStructureIds;
        const next: FeePayment = {
            studentId,
            feeMonthId,
            status: updates.status ?? current.status,
            paidDate: updates.paidDate ?? current.paidDate,
            remark: updates.remark ?? current.remark,
            extraFields: nextExtraFields,
            extraStructureIds: nextExtraStructureIds,
        };
        // Optimistic local update so typing feels instant.
        setFeePayments(prev => {
            const idx = prev.findIndex(p => p.studentId === next.studentId && p.feeMonthId === next.feeMonthId);
            if (idx === -1) return [...prev, next];
            const copy = [...prev]; copy[idx] = next; return copy;
        });

        const key = `${studentId}:${feeMonthId}`;
        if (paymentSyncTimers.current[key]) clearTimeout(paymentSyncTimers.current[key]);
        paymentSyncTimers.current[key] = setTimeout(async () => {
            try {
                const res = await api.patch(`/admin/campus/divisions/${divisionId}/fee-payments`, {
                    studentId: next.studentId,
                    feeMonthId,
                    status: next.status,
                    paidDate: next.paidDate,
                    remark: next.remark,
                    extraFields: next.extraFields,
                    extraStructureIds: next.extraStructureIds,
                });
                const saved: FeePayment = res.data.data;
                setFeePayments(prev => {
                    const idx = prev.findIndex(p => p.studentId === saved.studentId && p.feeMonthId === saved.feeMonthId);
                    if (idx === -1) return [...prev, saved];
                    const copy = [...prev]; copy[idx] = saved; return copy;
                });
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                toast.error(msg ?? 'Failed to update payment');
            }
        }, 500);
    };

    const getStudentDetailValue = useCallback((studentId: string, fieldId: string): string =>
        rosterStudents.find(s => s.id === studentId)?.extraDetailFields?.[fieldId] ?? '',
        [rosterStudents]);

    const detailFieldSyncTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const setStudentDetailField = (studentId: string, fieldId: string, value: string) => {
        // Optimistic local update so typing feels instant.
        setRosterStudents(prev => prev.map(s =>
            s.id === studentId ? { ...s, extraDetailFields: { ...(s.extraDetailFields ?? {}), [fieldId]: value } } : s));

        const key = `${studentId}:${fieldId}`;
        if (detailFieldSyncTimers.current[key]) clearTimeout(detailFieldSyncTimers.current[key]);
        detailFieldSyncTimers.current[key] = setTimeout(async () => {
            try {
                await api.patch(`/admin/campus/divisions/${divisionId}/students/${studentId}/detail-fields`, { fieldId, value });
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                toast.error(msg ?? 'Failed to update field');
            }
        }, 500);
    };

    // ── Bus (linked to Transport) ───────────────────────────────────────────
    // Bus on/off, bus + stop, fee and months all go through the bus endpoints,
    // which also update the Transport page (who rides which bus) and lock the
    // bus fee of months already due or paid, so old bills never change.
    const applyStudentFields = (studentId: string, fields: Record<string, string>) =>
        setRosterStudents(prev => prev.map(s => s.id === studentId ? { ...s, extraDetailFields: fields } : s));
    const rideOf = (studentId: string) => transport?.rides.find(r => r.studentId === studentId) ?? null;
    const reloadTransport = () => api.get(`/admin/campus/divisions/${divisionId}/transport`).then(res => setTransport(res.data.data ?? null)).catch(() => { });

    const openBusPicker = (studentId: string, fieldId: string) => {
        const ride = rideOf(studentId);
        const busId = ride?.busId ?? transport?.buses[0]?.id ?? '';
        setBusPicker({ studentId, fieldId, busId, stopId: ride?.stopId ?? '', shift: ride?.shift ?? 'MORNING' });
    };

    const saveBusPicker = async () => {
        if (!busPicker || busSaving) return;
        if (!busPicker.busId) { toast.error('Pick a bus'); return; }
        const wasOn = getStudentDetailValue(busPicker.studentId, `${busPicker.fieldId}-enabled`) === 'true';
        setBusSaving(true);
        try {
            const res = await api.put(`/admin/campus/divisions/${divisionId}/students/${busPicker.studentId}/bus`, {
                enabled: true, busId: busPicker.busId, stopId: busPicker.stopId || null, shift: busPicker.shift,
            });
            const fields: Record<string, string> = res.data.data.extraDetailFields ?? {};
            applyStudentFields(busPicker.studentId, fields);
            await reloadTransport();
            const { studentId, fieldId } = busPicker;
            setBusPicker(null);
            if (!wasOn) {
                // just turned on: confirm which months carry the bus fee
                setBusMonthsSelection(busMonthIds(fields, fieldId));
                setBusMonthsModal({ studentId, fieldId });
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
            toast.error(msg?.message ?? msg?.error ?? 'Could not save the bus');
        } finally { setBusSaving(false); }
    };

    // Needs the bus, but which one isn't decided yet: goes on Transport → Waiting list.
    const decideBusLater = async () => {
        if (!busPicker || busSaving) return;
        setBusSaving(true);
        try {
            const res = await api.put(`/admin/campus/divisions/${divisionId}/students/${busPicker.studentId}/bus`, { enabled: true });
            applyStudentFields(busPicker.studentId, res.data.data.extraDetailFields ?? {});
            setBusPicker(null);
            toast.success('Added to Transport → Waiting list');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
            toast.error(msg?.message ?? msg?.error ?? 'Could not save');
        } finally { setBusSaving(false); }
    };

    const turnBusOff = async (studentId: string) => {
        try {
            const res = await api.put(`/admin/campus/divisions/${divisionId}/students/${studentId}/bus`, { enabled: false });
            applyStudentFields(studentId, res.data.data.extraDetailFields ?? {});
            await reloadTransport();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
            toast.error(msg?.message ?? msg?.error ?? 'Could not turn the bus off');
        }
    };

    const busFeeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const setBusFeeAmount = (studentId: string, fieldId: string, value: string) => {
        setRosterStudents(prev => prev.map(s => s.id === studentId ? { ...s, extraDetailFields: { ...(s.extraDetailFields ?? {}), [`${fieldId}-fee`]: value } } : s));
        if (busFeeTimers.current[studentId]) clearTimeout(busFeeTimers.current[studentId]);
        busFeeTimers.current[studentId] = setTimeout(async () => {
            try {
                const res = await api.patch(`/admin/campus/divisions/${divisionId}/students/${studentId}/bus-fee`, { fee: value ? Number(value) : null });
                applyStudentFields(studentId, res.data.data.extraDetailFields ?? {});
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
                toast.error(msg?.message ?? msg?.error ?? 'Could not save the bus fee');
            }
        }, 600);
    };

    const saveBusMonths = async (studentId: string, months: string[]) => {
        try {
            const res = await api.patch(`/admin/campus/divisions/${divisionId}/students/${studentId}/bus-fee`, { months });
            applyStudentFields(studentId, res.data.data.extraDetailFields ?? {});
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
            toast.error(msg?.message ?? msg?.error ?? 'Could not save the months');
        }
    };

    // ── Load / Save ─────────────────────────────────────────────────────────

    const applyData = useCallback((data: {
        feeStructures?: FeeStructure[];
        feeMonths?: { id: string; month: string; dueDate: string; assignedStructureIds?: string[] }[];
        bankDetails?: BankDetails | null;
        qrImageUrl?: string | null;
        extraColumns?: { label: string }[];
        extraStudentFields?: { id?: string; label: string; value: string }[];
        studentFields?: StudentDetailField[];
        generalRemark?: string | null;
        feeCardTheme?: string;
        schoolLogoUrl?: string | null;
        schoolName?: string | null;
        rulesAndRegs?: { id: string; text: string }[];
    }) => {
        setFeeStructures(ensureDefaultStructures(data.feeStructures ?? []));
        setFeeCardTheme((data.feeCardTheme && data.feeCardTheme in FEE_CARD_THEMES ? data.feeCardTheme : 'yellow') as FeeCardThemeKey);
        setSchoolLogoUrl(data.schoolLogoUrl ?? null);
        setSchoolName(data.schoolName ?? '');
        setFeeMonths((data.feeMonths ?? []).map(m => ({
            ...m,
            assignedStructureIds: m.assignedStructureIds ?? [],
            status: 'PENDING' as const,
        })));
        setBankDetails(data.bankDetails ?? EMPTY_BANK);
        setBankDraft(data.bankDetails ?? EMPTY_BANK);
        setQrImageUrl(data.qrImageUrl ?? null);
        setExtraColumns(data.extraColumns ?? []);
        if (data.studentFields && data.studentFields.length > 0) {
            // Backward-compat: schools whose fee-card template was saved before the
            // Bus field existed won't have it in their stored studentFields — append it.
            const hasBus = data.studentFields.some(f => f.kind === 'default' && f.defaultKey === 'bus');
            setStudentFields(hasBus ? data.studentFields : [...data.studentFields, { id: 'f-bus', kind: 'default' as const, defaultKey: 'bus' as const, label: 'Bus' }]);
        } else if (data.extraStudentFields && data.extraStudentFields.length > 0) {
            setStudentFields([
                ...DEFAULT_STUDENT_FIELDS,
                ...data.extraStudentFields.map((f, i) => ({ id: f.id ?? `esf-${i}-${Date.now()}`, kind: 'custom' as const, label: f.label, value: f.value })),
            ]);
        } else {
            setStudentFields(DEFAULT_STUDENT_FIELDS);
        }
        setGeneralRemark(data.generalRemark ?? '');
        setRulesAndRegs(data.rulesAndRegs ?? []);
    }, []);

    useEffect(() => {
        // Loading a historical year resets didLoadRef first — without this, the
        // state churn from applyData() (clearing fields when a past year has no
        // saved structure) would itself trigger the autosave effect below and
        // attempt to PUT while historical, racing the isHistorical guard there.
        didLoadRef.current = false;
        const qs = effectiveYear ? `?academicYearId=${effectiveYear}` : '';
        api.get(`/admin/campus/divisions/${divisionId}/fee-structure${qs}`)
            .then(res => {
                const data = res.data.data;
                if (data) {
                    applyData(data);
                    if (data.isTemplate && data.templateFrom) setTemplateFrom(data.templateFrom);
                } else {
                    applyData({});
                }
            })
            .catch(() => { })
            .finally(() => {
                setLoading(false);
                // Defer arming the autosave watcher until after this render's state updates
                // (from applyData) have flushed — otherwise autosave fires immediately on load.
                setTimeout(() => { didLoadRef.current = true; }, 0);
            });
    }, [divisionId, applyData, effectiveYear]);

    useEffect(() => {
        api.get(`/admin/campus/divisions/${divisionId}/students`)
            .then(res => {
                const data: { id: string; studentId: string; rollNo: string | null; user: { name: string | null }; extraDetailFields: Record<string, string> | null; avatarUrl: string | null }[] = res.data.data ?? [];
                setRosterStudents(data.map(s => ({ id: s.id, studentDisplayId: s.studentId, name: s.user.name ?? '—', rollNo: s.rollNo ?? '—', extraDetailFields: s.extraDetailFields ?? null, avatarUrl: s.avatarUrl ?? null })));
            })
            .catch(() => { });
        api.get(`/admin/campus/divisions/${divisionId}/fee-payments`)
            .then(res => setFeePayments(res.data.data ?? []))
            .catch(() => { });
        api.get(`/admin/campus/divisions/${divisionId}/transport`)
            .then(res => setTransport(res.data.data ?? null))
            .catch(() => setTransport({ buses: [], rides: [] }));
    }, [divisionId]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node))
                setMonthDropdownOpen(false);
            if (editMonthDropdownRef.current && !editMonthDropdownRef.current.contains(e.target as Node))
                setEditMonthDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSave = async (opts?: { silent?: boolean }) => {
        // Fee structures can only ever be edited for the current year — writes
        // always land on the live year server-side regardless, so skip the
        // call entirely while browsing history rather than silently save to a
        // year the admin isn't even looking at.
        if (isHistorical) return;
        setSaving(true);
        try {
            await api.put(`/admin/campus/divisions/${divisionId}/fee-structure`, {
                feeStructures,
                feeMonths: feeMonths.map(({ id, month, dueDate, assignedStructureIds }) => ({ id, month, dueDate, assignedStructureIds })),
                bankDetails: bankDetails.accountName ? bankDetails : null,
                qrImageUrl,
                extraColumns,
                studentFields,
                generalRemark: generalRemark.trim() || null,
                feeCardTheme,
                schoolLogoUrl,
                schoolName: schoolName.trim() || null,
                rulesAndRegs,
            });
            setTemplateFrom(null);
            if (!opts?.silent) toast.success('Fee structure saved');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // Keep a ref to the latest handleSave so the autosave debounce timer and the
    // imperative handle always call the freshest closure (avoids stale state).
    const handleSaveRef = useRef(handleSave);
    useEffect(() => { handleSaveRef.current = handleSave; });

    // Tell the parent (which renders the header Save button) whenever saving state changes.
    useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

    // ── Autosave ────────────────────────────────────────────────────────────
    // Debounced auto-save whenever fee-setup data changes, skipped for the initial load.
    const didLoadRef = useRef(false);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!didLoadRef.current) return;
        onEdit?.();
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
            handleSaveRef.current({ silent: true });
        }, 1500);
        return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feeStructures, feeMonths, bankDetails, qrImageUrl, extraColumns, studentFields, generalRemark, feeCardTheme, schoolLogoUrl, schoolName, rulesAndRegs]);

    useImperativeHandle(ref, () => ({
        save: () => handleSaveRef.current(),
    }), []);

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

    const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploadingLogo(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await api.post('/admin/campus/feed/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSchoolLogoUrl(res.data.data.url);
            toast.success('Logo uploaded');
        } catch {
            toast.error('Logo upload failed');
        } finally {
            setUploadingLogo(false);
        }
    };

    const addMonth = () => {
        if (!newMonth || !newDueDate) return;
        setFeeMonths(prev => [...prev, { id: `m-${Date.now()}`, month: newMonth, dueDate: newDueDate, assignedStructureIds: [], status: 'PENDING' }]);
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

    // If this student's payment for month `m` is overdue (past due date, no
    // paid date, still Pending), the Late Fee Fine structure auto-applies —
    // this isn't stored anywhere, it's derived live from dates so it clears
    // itself automatically the moment the payment is marked paid/paid-date set.
    const getAutoLateFee = (studentId: string, m: FeeMonth): FeeStructure | null => {
        const payment = getPayment(studentId, m.id);
        if (!isLateFeeApplicable(m.dueDate, payment.paidDate)) return null;
        const lateFee = feeStructures.find(s => s.type === 'LATE_FEE');
        if (!lateFee) return null;
        if (m.assignedStructureIds.includes(lateFee.id)) return null;
        if ((payment.extraStructureIds ?? []).includes(lateFee.id)) return null;
        return lateFee;
    };

    // Which months the admin has explicitly picked for this student's Bus Fee
    // (stored as a JSON array of feeMonth ids in the same generic detail-field
    // store used for the toggle/number/fee, under key `${fieldId}-months`).
    const studentFieldsOf = (studentId: string) => rosterStudents.find(s => s.id === studentId)?.extraDetailFields ?? null;
    const getBusMonthIds = (studentId: string, fieldId: string): string[] => busMonthIds(studentFieldsOf(studentId), fieldId);

    // Once the admin turns a student's Bus toggle ON, they explicitly pick
    // which months get the Bus Fee structure via the month picker — it only
    // applies to the months chosen, not automatically to every month going
    // forward. Its amount isn't the shared structure's own items total
    // (that's empty/variable), it's this specific student's own Bus Fee
    // amount entered in their Student Details box, since bus fee varies per
    // student by pickup location.
    const getAutoBusFee = (studentId: string, m: FeeMonth): { structure: FeeStructure; amount: number } | null => {
        const busField = studentFields.find(f => f.kind === 'default' && f.defaultKey === 'bus');
        if (!busField) return null;
        // months locked at an old amount still count after the bus is turned off (lib/busFee)
        const amount = busMonthAmount(studentFieldsOf(studentId), busField.id, m.id);
        if (amount == null) return null;
        const busStructure = feeStructures.find(s => s.type === 'BUS');
        if (!busStructure) return null;
        if (m.assignedStructureIds.includes(busStructure.id)) return null;
        return { structure: busStructure, amount };
    };

    // Shared month total (m.assignedStructureIds) plus this specific student's
    // own extra structures (e.g. a Penalty added just for them this month),
    // plus the auto-applied Late Fee Fine when this month is overdue & unpaid,
    // plus the auto-applied Bus Fee once the student's Bus toggle is on.
    const studentMonthTotal = (studentId: string, m: FeeMonth) => {
        const extraIds = (getPayment(studentId, m.id).extraStructureIds ?? []).filter(id => !m.assignedStructureIds.includes(id));
        const extra = feeStructures.filter(s => extraIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);
        const autoLateFee = getAutoLateFee(studentId, m);
        const autoBusFee = getAutoBusFee(studentId, m);
        return monthTotal(m) + extra + (autoLateFee ? structureTotal(autoLateFee) : 0) + (autoBusFee ? autoBusFee.amount : 0);
    };

    const generatePDF = (type: 'all' | 'pending') => {
        const list = type === 'all' ? students : students.filter(s => !s.paid);
        const blob = new Blob([`${divisionName} — Fee List\n\n${list.map(s => `${s.rollNo}. ${s.name} (${s.studentDisplayId}) — ${s.paid ? 'Paid' : 'Pending'}`).join('\n')}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${divisionName}-fees.txt`; a.click();
        URL.revokeObjectURL(url); toast.success('Downloaded');
    };

    if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading fee structure...</div>;

    // ── Render ──────────────────────────────────────────────────────────────

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

                        {/* ROW 1: Fee Card Template + Payment Methods */}
                        <div className="flex flex-col lg:flex-row gap-3">

                            {/* LEFT — Fee Card Template */}
                            <div className="w-full lg:w-[55%] flex flex-col rounded-2xl shadow-sm shadow-black/5 border" style={{ perspective: '1000px', background: fc.bg, borderColor: fc.border }}>

                                {/* School branding — logo + name shown at the top of the card */}
                                <div className="px-4 py-2.5 flex items-center justify-between gap-2.5 rounded-t-2xl" style={{ borderBottom: `1px solid ${fc.border}` }}>
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                                            className="w-20 h-20 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 hover:bg-white/30 transition-all"
                                            style={{ borderColor: fc.border, background: schoolLogoUrl ? fc.bg : '#FFFFFF' }} title="Upload your school PNG logo">
                                            {schoolLogoUrl
                                                ? <img src={schoolLogoUrl} alt="School logo" className="w-full h-full object-contain" />
                                                : <ImagePlus size={30} style={{ color: '#000000', opacity: 0.5 }} />}
                                        </button>
                                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                                        <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="School name (shown on fee card)"
                                            className="flex-1 h-14 px-3 rounded-lg border text-2xl font-semibold focus:outline-none placeholder:text-black/40 placeholder:font-normal"
                                            style={{ borderColor: fc.border, background: '#FFFFFF', color: '#000000' }} />
                                    </div>
                                    <button
                                        onClick={() => setFeeCardFlipped(v => !v)}
                                        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border transition-all hover:bg-white/30 shrink-0"
                                        style={{ borderColor: fc.border, color: '#000000' }}>
                                        <motion.span animate={{ rotate: feeCardFlipped ? 180 : 0 }} transition={{ duration: 0.4 }}>
                                            <span style={{ fontSize: '16px', display: 'inline-block', transform: feeCardFlipped ? 'scaleX(-1)' : 'none' }}>↺</span>
                                        </motion.span>
                                        {feeCardFlipped ? 'View Front' : 'View Back'}
                                    </button>
                                </div>

                                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${fc.border}` }}>
                                    <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: '#000000' }}>
                                        Fee Card Template
                                    </p>
                                    <div className="flex items-center gap-1" style={{ borderColor: fc.border }}>
                                        {(Object.keys(FEE_CARD_THEMES) as FeeCardThemeKey[]).map(key => {
                                            const t = FEE_CARD_THEMES[key];
                                            const active = feeCardTheme === key;
                                            return (
                                                <button key={key} type="button" onClick={() => setFeeCardTheme(key)} title={t.name}
                                                    className="w-5 h-5 rounded-full transition-all"
                                                    style={{ background: t.bg, border: `1.5px solid ${t.border}`, boxShadow: active ? `0 0 0 2px ${t.border}` : 'none', transform: active ? 'scale(1.15)' : 'scale(1)' }} />
                                            );
                                        })}
                                    </div>
                                </div>

                                <motion.div
                                    animate={{ rotateY: feeCardFlipped ? 180 : 0 }}
                                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                                    style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: '200px' }}>

                                    {/* FRONT */}
                                    <div style={{ backfaceVisibility: 'hidden' }} className={feeCardFlipped ? 'invisible' : ''}>
                                        <div className="px-4 py-3 space-y-4" style={{ color: '#000000' }}>

                                            {/* 1. Student Details */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#000000' }}>Student Details</p>
                                                    <button onClick={() => setAddingStudentField(true)} className="text-[11px] font-medium hover:underline flex items-center gap-1" style={{ color: '#000000' }}>
                                                        <Plus size={11} /> Add Field
                                                    </button>
                                                </div>
                                                <div className="rounded-xl border p-2" style={{ borderColor: fc.border }}>
                                                    <div className="flex flex-wrap gap-2">
                                                        {studentFields.map((f) => {
                                                            const previewValue = f.kind === 'default'
                                                                ? f.defaultKey === 'name' ? 'Student Name'
                                                                    : f.defaultKey === 'rollNo' ? 'Roll Number'
                                                                        : f.defaultKey === 'studentId' ? 'Student ID'
                                                                            : f.defaultKey === 'class' ? (divisionName.split('-')[0] ?? divisionName)
                                                                                : f.defaultKey === 'bus' ? 'On/Off + Bus No.'
                                                                                    : (divisionName.split('-')[1] ?? '')
                                                                : f.value;
                                                            return (
                                                                <div key={f.id}
                                                                    draggable
                                                                    onDragStart={() => setDraggedFieldId(f.id)}
                                                                    onDragOver={e => e.preventDefault()}
                                                                    onDrop={e => {
                                                                        e.preventDefault();
                                                                        if (!draggedFieldId || draggedFieldId === f.id) return;
                                                                        setStudentFields(prev => {
                                                                            const from = prev.findIndex(x => x.id === draggedFieldId);
                                                                            const to = prev.findIndex(x => x.id === f.id);
                                                                            if (from === -1 || to === -1) return prev;
                                                                            const copy = [...prev];
                                                                            const [moved] = copy.splice(from, 1);
                                                                            copy.splice(to, 0, moved);
                                                                            return copy;
                                                                        });
                                                                        setDraggedFieldId(null);
                                                                    }}
                                                                    onDragEnd={() => setDraggedFieldId(null)}
                                                                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg group basis-[calc(50%-4px)] grow-0 shrink-0"
                                                                    style={{ border: `1px solid ${fc.border}`, cursor: 'grab', background: 'rgba(255,255,255,0.35)', opacity: draggedFieldId === f.id ? 0.4 : 1 }}>
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <GripVertical size={12} style={{ color: '#000000', opacity: 0.3 }} className="shrink-0" />
                                                                        <span className="text-[11px] shrink-0 truncate" style={{ color: '#000000' }}>{f.label}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <span className={`text-[11px] font-medium italic truncate ${f.kind === 'default' && f.defaultKey === 'studentId' ? 'font-mono' : ''}`} style={{ color: '#000000', opacity: 0.6 }}>{previewValue}</span>
                                                                        {f.kind === 'custom' && (
                                                                            <button onClick={() => setConfirmDelete({ kind: 'studentField', id: f.id, label: f.label })}
                                                                                className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0"
                                                                                style={{ color: '#000000' }}>
                                                                                <X size={10} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {addingStudentField && (
                                                        <div className="flex items-center gap-2 px-1 pt-2 mt-2 border-t" style={{ borderColor: fc.border }}>
                                                            <input value={newStudentFieldLabel} onChange={e => setNewStudentFieldLabel(e.target.value)} placeholder="Field name"
                                                                className="flex-1 h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-xs focus:outline-none" />
                                                            <button onClick={() => {
                                                                if (!newStudentFieldLabel.trim()) return;
                                                                setStudentFields(prev => [...prev, { id: `esf-${Date.now()}`, kind: 'custom', label: newStudentFieldLabel.trim(), value: newStudentFieldLabel.trim() }]);
                                                                setNewStudentFieldLabel(''); setAddingStudentField(false);
                                                            }} className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                <Check size={11} />
                                                            </button>
                                                            <button onClick={() => setAddingStudentField(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/10 border shrink-0" style={{ color: '#000000', opacity: 0.6, borderColor: fc.border }}>
                                                                <X size={11} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ borderTop: `1px dashed ${fc.border}` }} />

                                            {/* 2. Fee Table Columns */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#000000' }}>Fee Table Columns</p>
                                                    <button onClick={() => setAddingColumn(true)} className="text-[11px] font-medium hover:underline flex items-center gap-1" style={{ color: '#000000' }}>
                                                        <Plus size={11} /> Add Column
                                                    </button>
                                                </div>
                                                <div className="rounded-xl border overflow-x-auto" style={{ borderColor: fc.border }}>
                                                    <table className="text-xs w-full">
                                                        <thead>
                                                            <tr style={{ borderBottom: `1px solid ${fc.border}`, background: 'rgba(0,0,0,0.03)' }}>
                                                                {['Month', 'Fee Structures', 'Amount', 'Due Date', 'Paid Date', 'Status', 'Remark'].map((col, i) => (
                                                                    <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap" style={{ color: '#000000', borderRight: `1px solid ${fc.border}` }}>{col}</th>
                                                                ))}
                                                                {extraColumns.map((col, i) => (
                                                                    <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap" style={{ color: '#000000', borderRight: `1px solid ${fc.border}` }}>
                                                                        <div className="flex items-center gap-1">
                                                                            {col.label}
                                                                            <button onClick={() => setConfirmDelete({ kind: 'extraColumn', id: String(i), index: i, label: col.label })}
                                                                                className="w-3.5 h-3.5 flex items-center justify-center hover:text-red-500" style={{ color: '#000000', opacity: 0.4 }}>
                                                                                <X size={9} />
                                                                            </button>
                                                                        </div>
                                                                    </th>
                                                                ))}
                                                                <th className="px-2 py-2">
                                                                    {addingColumn && (
                                                                        <div className="flex items-center gap-1">
                                                                            <input value={newColumnLabel} onChange={e => setNewColumnLabel(e.target.value)}
                                                                                placeholder="Name" autoFocus
                                                                                onKeyDown={e => { if (e.key === 'Enter' && newColumnLabel.trim()) { setExtraColumns(prev => [...prev, { label: newColumnLabel.trim() }]); setNewColumnLabel(''); setAddingColumn(false); } }}
                                                                                className="w-20 h-6 px-2 rounded-lg border border-primary/50 bg-primary/5 text-[10px] focus:outline-none" />
                                                                            <button onClick={() => { if (!newColumnLabel.trim()) return; setExtraColumns(prev => [...prev, { label: newColumnLabel.trim() }]); setNewColumnLabel(''); setAddingColumn(false); }}
                                                                                className="w-5 h-5 rounded flex items-center justify-center text-white"
                                                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                                <Check size={9} />
                                                                            </button>
                                                                            <button onClick={() => setAddingColumn(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/10" style={{ color: '#000000', opacity: 0.6 }}>
                                                                                <X size={9} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr className="italic" style={{ color: '#000000', opacity: 0.4 }}>
                                                                {['June', '—', '—', '10 Jun', '—', 'Pending', '—', ...extraColumns.map(() => '—')].map((val, i) => (
                                                                    <td key={i} className="px-3 py-2 text-[11px]" style={{ borderRight: `1px solid ${fc.border}` }}>{val}</td>
                                                                ))}
                                                                <td className="px-2 py-2"></td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div style={{ borderTop: `1px dashed ${fc.border}` }} />

                                            {/* 3. Monthly Fee Schedule */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#000000' }}>Monthly Fee Schedule</p>
                                                        <p className="text-[10px] mt-0.5" style={{ color: '#000000', opacity: 0.7 }}>Assign fee structures to each month</p>
                                                    </div>
                                                    <button onClick={() => setAddingMonth(true)}
                                                        className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                        <Plus size={11} /> Add Month
                                                    </button>
                                                </div>

                                                {feeMonths.length === 0 && !addingMonth && (
                                                    <div className="py-6 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                        <Calendar size={20} className="mx-auto mb-2" style={{ color: '#000000', opacity: 0.5 }} />
                                                        <p className="text-xs" style={{ color: '#000000' }}>No months added yet</p>
                                                    </div>
                                                )}

                                                <div className="h-[270px] overflow-y-auto space-y-1 pr-1"
                                                    style={{ scrollbarWidth: 'thin', scrollbarColor: `${fc.border} transparent` }}>
                                                    {feeMonths.map(m => {
                                                        const total = monthTotal(m);
                                                        const isExpanded = expandedMonthId === m.id;
                                                        const isAssigning = assigningMonthId === m.id;
                                                        const isEditing = editingMonthId === m.id;
                                                        const assignedCount = m.assignedStructureIds.length;
                                                        return (
                                                            <div key={m.id} className="rounded-xl border" style={{ borderColor: fc.border }}>
                                                                <div className="flex items-center flex-wrap gap-3 px-3 py-2.5 rounded-t-xl hover:bg-black/5 transition-colors">
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <div ref={editMonthDropdownRef} className="relative">
                                                                                <button type="button" onClick={() => setEditMonthDropdownOpen(v => !v)}
                                                                                    className="flex items-center gap-1 h-7 px-2 rounded-lg border text-[11px] font-medium hover:border-primary/40 transition-all"
                                                                                    style={{ borderColor: fc.border, background: '#FFFFFF', color: '#000000' }}>
                                                                                    {editMonthName || 'Month'} <ChevronDown size={10} className={`transition-transform ${editMonthDropdownOpen ? 'rotate-180' : ''}`} />
                                                                                </button>
                                                                                <AnimatePresence>
                                                                                    {editMonthDropdownOpen && (
                                                                                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                                                            className="absolute top-8 left-0 z-50 rounded-xl shadow-xl py-1 min-w-[130px] max-h-48 overflow-y-auto border"
                                                                                            style={{ background: '#FFFFFF', borderColor: fc.border }}>
                                                                                            {MONTHS.map(mo => (
                                                                                                <button key={mo} type="button" onClick={() => { setEditMonthName(mo); setEditMonthDropdownOpen(false); }}
                                                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 transition-colors"
                                                                                                    style={{ color: editMonthName === mo ? '#DA7756' : '#000000', fontWeight: editMonthName === mo ? 600 : 400 }}>
                                                                                                    {mo}
                                                                                                </button>
                                                                                            ))}
                                                                                        </motion.div>
                                                                                    )}
                                                                                </AnimatePresence>
                                                                            </div>
                                                                            <input value={editDueDate} onChange={e => setEditDueDate(formatDateMaskLive(e.target.value))}
                                                                                onFocus={e => setEditDueDate(displayDateToMask(e.target.value))}
                                                                                onBlur={e => setEditDueDate(maskToDisplayDate(e.target.value))}
                                                                                placeholder="DD-MM-YY"
                                                                                className="w-20 h-7 px-2 rounded-lg border text-[11px] focus:outline-none"
                                                                                style={{ borderColor: fc.border, background: '#FFFFFF', color: '#000000' }} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-20 shrink-0">
                                                                            <p className="text-xs font-semibold" style={{ color: '#000000' }}>{m.month}</p>
                                                                            <p className="text-[10px]" style={{ color: '#000000' }}>{m.dueDate || 'No due date'}</p>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1 flex flex-wrap gap-1 min-w-0">
                                                                        {m.assignedStructureIds.length === 0 ? (
                                                                            <span className="text-[11px] italic" style={{ color: '#000000', opacity: 0.55 }}>No structures assigned</span>
                                                                        ) : (
                                                                            feeStructures.filter(s => m.assignedStructureIds.includes(s.id)).map(s => (
                                                                                <span key={s.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                                                    style={{ background: s.color + '20', color: s.color }}>
                                                                                    {s.name}
                                                                                </span>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                    {total > 0 && <p className="text-xs font-bold shrink-0" style={{ color: '#7C3AED' }}>₹{total.toLocaleString()}</p>}
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {isEditing ? (
                                                                            <>
                                                                                <button onClick={() => {
                                                                                    setFeeMonths(prev => prev.map(x => x.id === m.id ? { ...x, month: editMonthName, dueDate: editDueDate } : x));
                                                                                    setEditingMonthId(null);
                                                                                }} className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                                                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                                    <Check size={12} />
                                                                                </button>
                                                                                <button onClick={() => setEditingMonthId(null)}
                                                                                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-black/10 transition-all" style={{ color: '#000000', opacity: 0.6 }}>
                                                                                    <X size={12} />
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <button onClick={() => setAssigningMonthId(isAssigning ? null : m.id)}
                                                                                    className={`flex items-center gap-1 h-6 px-2 rounded-lg text-[10px] font-semibold border transition-all ${isAssigning ? 'bg-primary text-white border-primary' : 'hover:border-primary/40 hover:text-primary'}`}
                                                                                    style={!isAssigning ? { borderColor: fc.border, color: '#000000', opacity: 0.75 } : undefined}>
                                                                                    {assignedCount > 0 ? `${assignedCount} assigned` : 'Assign'}
                                                                                    <ChevronDown size={10} className={`transition-transform ${isAssigning ? 'rotate-180' : ''}`} />
                                                                                </button>
                                                                                <button onClick={() => setExpandedMonthId(isExpanded ? null : m.id)}
                                                                                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-black/10 transition-all" style={{ color: '#000000', opacity: 0.7 }}>
                                                                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                                </button>
                                                                                <button onClick={() => { setEditingMonthId(m.id); setEditMonthName(m.month); setEditDueDate(m.dueDate); }}
                                                                                    className="w-6 h-6 rounded-md flex items-center justify-center hover:text-primary transition-all" style={{ color: '#000000', opacity: 0.45 }}>
                                                                                    <Pencil size={11} />
                                                                                </button>
                                                                                <button onClick={() => setConfirmDelete({ kind: 'feeMonth', id: m.id, label: m.month })}
                                                                                    className="w-6 h-6 rounded-md flex items-center justify-center hover:text-red-500 transition-all" style={{ color: '#000000', opacity: 0.45 }}>
                                                                                    <X size={11} />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <AnimatePresence>
                                                                    {isAssigning && (
                                                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                                            <div className="px-3 pb-2.5 pt-2 border-t" style={{ borderColor: fc.border }}>
                                                                                <p className="text-[10px] font-semibold mb-2" style={{ color: '#000000', opacity: 0.7 }}>Select fee structures for {m.month}</p>
                                                                                {feeStructures.filter(s => s.type !== 'BUS' && s.type !== 'LATE_FEE').length === 0 ? (
                                                                                    <p className="text-[11px] italic" style={{ color: '#000000', opacity: 0.55 }}>Create fee structures first</p>
                                                                                ) : (
                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                        {feeStructures.filter(s => s.type !== 'BUS' && s.type !== 'LATE_FEE').map(s => {
                                                                                            const active = m.assignedStructureIds.includes(s.id);
                                                                                            return (
                                                                                                <button key={s.id} onClick={() => toggleStructureForMonth(m.id, s.id)}
                                                                                                    className="flex items-center gap-1.5 h-7 px-3 rounded-xl border-2 text-[11px] font-semibold transition-all"
                                                                                                    style={active ? { borderColor: s.color, background: s.color + '20', color: s.color } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
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

                                                {addingMonth && (
                                                    <div className="mt-2 px-3 py-2 rounded-xl border flex items-center flex-wrap gap-2" style={{ borderColor: fc.border, background: 'rgba(255,255,255,0.5)' }}>
                                                        <div ref={monthDropdownRef} className="relative">
                                                            <button type="button" onClick={() => setMonthDropdownOpen(v => !v)}
                                                                className="flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-medium hover:border-primary/40 transition-all"
                                                                style={{ borderColor: fc.border, background: '#FFFFFF', color: '#000000' }}>
                                                                {newMonth || 'Select Month'} <ChevronDown size={11} className={`transition-transform ${monthDropdownOpen ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            <AnimatePresence>
                                                                {monthDropdownOpen && (
                                                                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                                        className="absolute bottom-9 left-0 z-50 rounded-xl shadow-xl py-1 min-w-[130px] max-h-48 overflow-y-auto border"
                                                                        style={{ background: '#FFFFFF', borderColor: fc.border }}>
                                                                        {MONTHS.map(m => (
                                                                            <button key={m} type="button" onClick={() => { setNewMonth(m); setMonthDropdownOpen(false); }}
                                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 transition-colors"
                                                                                style={{ color: newMonth === m ? '#DA7756' : '#000000', fontWeight: newMonth === m ? 600 : 400 }}>
                                                                                {m}
                                                                            </button>
                                                                        ))}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                        <input value={newDueDate} onChange={e => setNewDueDate(formatDateMaskLive(e.target.value))}
                                                            onFocus={e => setNewDueDate(displayDateToMask(e.target.value))}
                                                            onBlur={e => setNewDueDate(maskToDisplayDate(e.target.value))}
                                                            placeholder="DD-MM-YY"
                                                            className="w-36 h-8 px-3 rounded-xl border text-xs focus:outline-none focus:border-primary/50 placeholder:text-black/50"
                                                            style={{ borderColor: fc.border, background: '#FFFFFF', color: '#000000' }} />
                                                        <button onClick={addMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                            <Check size={13} />
                                                        </button>
                                                        <button onClick={() => { setAddingMonth(false); setNewMonth(''); setNewDueDate(''); }}
                                                            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-black/10 border"
                                                            style={{ borderColor: fc.border, color: '#000000' }}>
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                )}

                                                {feeMonths.length > 0 && (
                                                    <div className="flex items-center justify-between mt-2 px-1">
                                                        <span className="text-[11px]" style={{ color: '#000000', opacity: 0.6 }}>{feeMonths.length} months</span>
                                                        <span className="text-xs font-bold">
                                                            Annual Total: <span style={{ color: '#7C3AED' }}>₹{feeMonths.reduce((n, m) => n + monthTotal(m), 0).toLocaleString()}</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>

                                    {/* BACK — Rules & Regulations */}
                                    <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: fc.bg }}
                                        className={!feeCardFlipped ? 'invisible' : ''}>
                                        <div className="px-4 py-3 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#000000' }}>Rules & Regulations</p>
                                                <button onClick={() => {
                                                    setRulesAndRegs(prev => [...prev, { id: `r-${Date.now()}`, text: '' }]);
                                                }} className="text-[11px] font-medium hover:underline flex items-center gap-1" style={{ color: '#000000' }}>
                                                    <Plus size={11} /> Add Rule
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {rulesAndRegs.map((rule, i) => (
                                                    <div key={rule.id} className="flex items-start gap-2">
                                                        <span className="text-[11px] font-bold mt-2 w-5 shrink-0" style={{ color: '#000000' }}>{i + 1}.</span>
                                                        <textarea
                                                            value={rule.text}
                                                            onChange={e => setRulesAndRegs(prev => prev.map(r => r.id === rule.id ? { ...r, text: e.target.value } : r))}
                                                            placeholder="Enter rule or regulation..."
                                                            rows={2}
                                                            className="flex-1 px-3 py-2 rounded-xl border bg-white/30 text-xs focus:outline-none transition-all resize-none"
                                                            style={{ borderColor: fc.border, color: '#000000' }}
                                                        />
                                                        <button onClick={() => setConfirmDelete({ kind: 'rule', id: rule.id, label: `Rule ${i + 1}` })}
                                                            className="w-6 h-6 mt-1.5 rounded flex items-center justify-center hover:text-red-500 shrink-0" style={{ color: '#000000', opacity: 0.4 }}>
                                                            <X size={11} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {rulesAndRegs.length === 0 && (
                                                    <div className="py-8 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                        <p className="text-xs" style={{ color: '#000000' }}>No rules added yet</p>
                                                        <p className="text-[11px] mt-1" style={{ color: '#000000', opacity: 0.6 }}>Add fee counter timings, late fee rules, etc.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </motion.div>
                            </div>

                            {/* RIGHT — Payment Methods */}
                            <div className="w-full lg:w-[45%] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5" data-admin-surface="">
                                <div className="px-4 py-3.5 border-b border-border/50 bg-muted/20 shrink-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Landmark size={14} /> Payment Methods
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 divide-y divide-border/30">

                                    {/* Bank Details */}
                                    <div className="pb-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-semibold flex items-center gap-1.5"><Building2 size={14} /> Bank Details</p>
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
                                            <p className="text-xs font-semibold flex items-center gap-1.5"><QrCode size={14} /> QR Code</p>
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
                                        <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><CreditCard size={14} /> Payment Gateway</p>
                                        <div className="rounded-xl border-2 border-dashed border-border/40 px-4 py-4 flex flex-col items-center gap-1.5">
                                            <CreditCard size={18} className="text-muted-foreground/30" />
                                            <p className="text-xs text-muted-foreground">Coming Soon</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: Fee Structures */}
                        <div className="flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5" data-admin-surface="">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/20 shrink-0 flex-wrap gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Tag size={13} /> Fee Structures
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {(Object.keys(FEE_TYPE_CFG) as FeeStructureType[]).map(t => {
                                            const cfg = FEE_TYPE_CFG[t];
                                            return (
                                                <span key={t} className={`text-[10px] font-semibold flex items-center gap-1 ${cfg.text}`}>
                                                    {cfg.emoji} {cfg.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Bifurcation pill — Setup / Per-student / Default */}
                                    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/50">
                                        {([
                                            { key: 'setup' as const, label: 'Setup' },
                                            { key: 'student' as const, label: 'Per-student' },
                                            { key: 'default' as const, label: 'Default' },
                                        ]).map(opt => (
                                            <button key={opt.key} onClick={() => setStructureViewFilter(opt.key)}
                                                className={`h-6 px-2.5 rounded-md text-[10px] font-semibold transition-all ${structureViewFilter === opt.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => { setEditingStructure(undefined); setShowStructureModal(true); }}
                                        className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        <Plus size={11} /> Add Structure
                                    </button>
                                </div>
                            </div>
                            <div className="h-[260px] overflow-y-auto px-4 py-3 space-y-2"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                {(() => {
                                    const visibleStructures = feeStructures.filter(fs => {
                                        if (structureViewFilter === 'default') return fs.type === 'BUS' || fs.type === 'LATE_FEE';
                                        if (fs.type === 'BUS' || fs.type === 'LATE_FEE') return false;
                                        return (fs.origin ?? 'setup') === structureViewFilter;
                                    });
                                    if (visibleStructures.length === 0) {
                                        return (
                                            <div className="text-center py-8">
                                                <Tag size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                                                <p className="text-xs text-muted-foreground/60">
                                                    {structureViewFilter === 'default' ? 'No default structures'
                                                        : structureViewFilter === 'student' ? 'No per-student structures yet'
                                                            : 'No fee structures yet'}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground/40 mt-1">
                                                    {structureViewFilter === 'student'
                                                        ? 'These appear here once added from a student’s fee card'
                                                        : 'Add Regular, Add-on, or Event fee structures'}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return visibleStructures.map(fs => (
                                        <div key={fs.id}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => {
                                                e.preventDefault();
                                                if (!draggedStructureId || draggedStructureId === fs.id) return;
                                                setFeeStructures(prev => {
                                                    const from = prev.findIndex(x => x.id === draggedStructureId);
                                                    const to = prev.findIndex(x => x.id === fs.id);
                                                    if (from === -1 || to === -1) return prev;
                                                    const copy = [...prev];
                                                    const [moved] = copy.splice(from, 1);
                                                    copy.splice(to, 0, moved);
                                                    return copy;
                                                });
                                                setDraggedStructureId(null);
                                            }}
                                            className="flex items-start gap-1"
                                            style={{ opacity: draggedStructureId === fs.id ? 0.4 : 1 }}>
                                            <div draggable
                                                onDragStart={() => setDraggedStructureId(fs.id)}
                                                onDragEnd={() => setDraggedStructureId(null)}
                                                className="pt-3 shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
                                                style={{ cursor: 'grab' }}>
                                                <GripVertical size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <FeeStructureCard fs={fs}
                                                    onEdit={() => { setEditingStructure(fs); setShowStructureModal(true); }}
                                                    onDelete={() => setConfirmDelete({ kind: 'feeStructure', id: fs.id, label: fs.name })}
                                                />
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                    </motion.div>
                )}

                {/* ── Student Fees ── */}
                {feesSubTab === 'students' && (
                    <motion.div key="students" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">

                        {/* LEFT — Student list */}
                        <div className="w-full lg:w-[25%] h-[45vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl lg:overflow-hidden shadow-sm shadow-black/5" data-admin-surface="">
                            <div className="px-3.5 py-2.5 border-b border-border/40 shrink-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold flex items-center gap-2"><Users size={14} /> Students ({students.length})</p>
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
                                {students.filter(s => studentFilter === 'all' ? true : studentFilter === 'paid' ? s.paid : !s.paid).map(student => (
                                    <button key={student.id} onClick={() => setSelectedStudent(prev => prev?.id === student.id ? null : student)}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3 border-b border-border/20 text-left hover:bg-muted/30 transition-colors ${selectedStudent?.id === student.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                        <div onClick={e => { if (student.avatarUrl) { e.stopPropagation(); setExpandedPhoto({ url: student.avatarUrl, name: student.name }); } }}
                                            className={`w-7 h-7 rounded-full overflow-hidden relative flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${student.avatarUrl ? 'cursor-pointer' : ''}`}
                                            style={{ background: student.avatarUrl ? 'transparent' : getAvatarColor(student.name) }}>
                                            {student.avatarUrl
                                                ? <NextImage src={student.avatarUrl} alt={student.name} fill sizes="56px" quality={90} className="object-cover" />
                                                : getInitials(student.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{student.name}</p>
                                            <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo} · <span className="font-mono" style={{ color: '#DA7756' }}>{student.studentDisplayId}</span></p>
                                        </div>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${student.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                            {student.paid ? 'Paid' : 'Pending'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT — Student fee card */}
                        <div className="flex-1 h-[65vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5" data-admin-surface="">
                            <div className="px-4 py-3 border-b border-border/40 shrink-0">
                                <p className="text-sm font-bold">Fee Details</p>
                            </div>
                            <div ref={feeDetailsScrollRef} className="flex-1 overflow-y-auto bg-background px-4 py-3">
                                {!selectedStudent ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3"><Users size={20} className="text-muted-foreground" /></div>
                                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student to view their fee card</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">

                                        {/* Student header */}
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-white dark:bg-muted/20" data-admin-surface="">
                                            <div onClick={() => selectedStudent.avatarUrl && setExpandedPhoto({ url: selectedStudent.avatarUrl, name: selectedStudent.name })}
                                                className={`w-10 h-10 rounded-xl overflow-hidden relative flex items-center justify-center text-sm font-bold text-white shrink-0 ${selectedStudent.avatarUrl ? 'cursor-pointer' : ''}`}
                                                style={{ background: selectedStudent.avatarUrl ? 'transparent' : getAvatarColor(selectedStudent.name) }}>
                                                {selectedStudent.avatarUrl
                                                    ? <NextImage src={selectedStudent.avatarUrl} alt={selectedStudent.name} fill sizes="80px" quality={90} className="object-cover" />
                                                    : getInitials(selectedStudent.name)}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold">{selectedStudent.name}</p>
                                                <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo} · {divisionName} · <span className="font-mono" style={{ color: '#DA7756' }}>{selectedStudent.studentDisplayId}</span></p>
                                            </div>
                                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${isStudentPaid(selectedStudent.id) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                                {isStudentPaid(selectedStudent.id) ? '✓ Paid' : '⏳ Pending'}
                                            </span>
                                        </div>

                                        {/* Fee Card with flip */}
                                        <div style={{ perspective: '1200px' }}>
                                            <motion.div
                                                animate={{ rotateY: studentCardFlipped ? 180 : 0 }}
                                                transition={{ duration: 0.6, ease: 'easeInOut' }}
                                                style={{ transformStyle: 'preserve-3d', position: 'relative' }}>

                                                {/* FRONT */}
                                                <div style={{ backfaceVisibility: 'hidden', background: fc.bg, borderColor: fc.border }}
                                                    className={`rounded-2xl border ${studentCardFlipped ? 'invisible' : ''}`}>

                                                    {/* School branding */}
                                                    <div className="px-4 py-2.5 flex items-center justify-between gap-2.5 rounded-t-2xl" style={{ background: fc.bg, borderBottom: `1px solid ${fc.border}` }}>
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {schoolLogoUrl
                                                                ? <img src={schoolLogoUrl} alt="School logo" className="w-20 h-20 rounded-lg object-contain shrink-0" style={{ background: fc.bg }} />
                                                                : <div className="w-20 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FFFFFF', border: `1px dashed ${fc.border}` }}><ImagePlus size={30} style={{ color: '#000000', opacity: 0.3 }} /></div>}
                                                            {schoolName
                                                                ? <p className="text-3xl font-bold" style={{ color: '#000000' }}>{schoolName}</p>
                                                                : <p className="text-xs italic" style={{ color: '#000000', opacity: 0.4 }}>School name not added yet</p>}
                                                        </div>
                                                        <button onClick={() => setStudentCardFlipped(true)}
                                                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border transition-all hover:bg-white/40 shrink-0"
                                                            style={{ borderColor: fc.border, color: '#000000' }}>
                                                            <span style={{ fontSize: '16px', display: 'inline-block', transform: studentCardFlipped ? 'scaleX(-1)' : 'none' }}>↺</span>
                                                            View Back
                                                        </button>
                                                    </div>

                                                    {/* Strip — student name's fee card */}
                                                    <div className="px-4 py-2 border-b" style={{ borderColor: fc.border }}>
                                                        <p className="text-sm font-bold tracking-wide" style={{ color: '#000000' }}>{selectedStudent.name}'s Fee Card</p>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="space-y-4 px-4 py-3" style={{ color: '#000000' }}>

                                                        {/* Student Details */}
                                                        <div>
                                                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#000000' }}>Student Details</p>
                                                            <div className="rounded-xl border p-2 flex flex-wrap gap-2" style={{ borderColor: fc.border, background: fc.bg }}>
                                                                {studentFields.map((f) => {
                                                                    const isBus = f.kind === 'default' && f.defaultKey === 'bus';
                                                                    if (isBus) {
                                                                        const busEnabled = getStudentDetailValue(selectedStudent.id, `${f.id}-enabled`) === 'true';
                                                                        const busNumber = getStudentDetailValue(selectedStudent.id, `${f.id}-number`);
                                                                        const busFee = getStudentDetailValue(selectedStudent.id, `${f.id}-fee`);
                                                                        const busRide = rideOf(selectedStudent.id);
                                                                        const busWaiting = !!getStudentDetailValue(selectedStudent.id, 'bus-request');
                                                                        const busStop = busRide?.stopId ? transport?.buses.find(b => b.id === busRide.busId)?.route?.stops.find(st => st.id === busRide.stopId)?.name ?? '' : '';
                                                                        return (
                                                                            <div key={f.id} className="flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg basis-[calc(50%-4px)] grow-0 shrink-0" style={{ border: `1px solid ${fc.border}` }}>
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    <span className="text-[11px]" style={{ color: '#000000' }}>{f.label}</span>
                                                                                    <button type="button"
                                                                                        onClick={() => busEnabled ? setConfirmBusToggle({ studentId: selectedStudent.id, fieldId: f.id, nextEnabled: false }) : openBusPicker(selectedStudent.id, f.id)}
                                                                                        title={busEnabled ? 'Turn the bus off' : 'Put this student on a bus'}
                                                                                        className="relative w-7 h-4 rounded-full shrink-0 transition-colors"
                                                                                        style={{ background: busEnabled ? '#10B981' : 'rgba(0,0,0,0.18)' }}>
                                                                                        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
                                                                                            style={{ left: busEnabled ? '14px' : '2px' }} />
                                                                                    </button>
                                                                                    {busEnabled && (
                                                                                        <button type="button"
                                                                                            onClick={() => {
                                                                                                setBusMonthsSelection(getBusMonthIds(selectedStudent.id, f.id));
                                                                                                setBusMonthsModal({ studentId: selectedStudent.id, fieldId: f.id });
                                                                                            }}
                                                                                            title="Edit which months this student's Bus Fee applies to"
                                                                                            className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground hover:text-primary transition-all"
                                                                                            style={{ color: '#000000', opacity: 0.5 }}>
                                                                                            <Pencil size={10} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                                                        <span className="text-[11px]" style={{ color: '#000000', opacity: busEnabled ? 0.6 : 0.3 }}>Bus</span>
                                                                                        <button type="button" disabled={!busEnabled && !busWaiting} onClick={() => openBusPicker(selectedStudent.id, f.id)}
                                                                                            title={busEnabled ? `${busNumber || 'No bus'}${busStop ? ` · ${busStop}` : ''} (click to change bus or stop)` : undefined}
                                                                                            className="max-w-[9rem] truncate text-[11px] font-semibold text-right shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                            style={{ color: '#000000', borderBottom: '1px solid rgba(0,0,0,0.35)' }}>
                                                                                            {busEnabled ? (busNumber || 'Pick bus') : busWaiting ? 'Waiting list' : '—'}
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                                                        <span className="text-[11px]" style={{ color: '#000000', opacity: busEnabled ? 0.6 : 0.3 }}>Bus Fee ₹</span>
                                                                                        <input value={busFee} onChange={e => setBusFeeAmount(selectedStudent.id, f.id, e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                                                                            disabled={!busEnabled} placeholder="0" inputMode="numeric"
                                                                                            title="This student's monthly bus fee. Filled from their stop's fee; you can change it. Months already due or paid keep their old amount."
                                                                                            className="text-[11px] font-semibold text-right bg-transparent focus:outline-none shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                            style={{ color: '#000000', width: `${Math.max(1, busFee.length || 1) + 0.5}ch`, minWidth: 0, borderBottom: '1px solid rgba(0,0,0,0.35)' }} />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    const value = f.kind === 'default'
                                                                        ? f.defaultKey === 'name' ? selectedStudent.name
                                                                            : f.defaultKey === 'rollNo' ? selectedStudent.rollNo
                                                                                : f.defaultKey === 'studentId' ? selectedStudent.studentDisplayId
                                                                                    : f.defaultKey === 'class' ? (divisionName.split('-')[0] ?? divisionName)
                                                                                        : (divisionName.split('-')[1] ?? '')
                                                                        : getStudentDetailValue(selectedStudent.id, f.id);
                                                                    const isStudentId = f.kind === 'default' && f.defaultKey === 'studentId';
                                                                    return (
                                                                        <div key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg basis-[calc(50%-4px)] grow-0 shrink-0" style={{ border: `1px solid ${fc.border}` }}>
                                                                            <span className="text-[11px] shrink-0" style={{ color: '#000000' }}>{f.label}</span>
                                                                            {f.kind === 'custom' ? (
                                                                                <input value={value} onChange={e => setStudentDetailField(selectedStudent.id, f.id, e.target.value)}
                                                                                    placeholder="Enter value"
                                                                                    className="text-[11px] font-semibold text-right bg-transparent focus:outline-none shrink-0"
                                                                                    style={{ color: '#000000', width: `${Math.max(4, Math.min(value.length || 1, 14)) + 0.5}ch`, minWidth: 0, borderBottom: '1px solid rgba(0,0,0,0.35)' }} />
                                                                            ) : (
                                                                                <span className={`text-[11px] font-semibold truncate ${isStudentId ? 'font-mono' : ''}`} style={{ color: isStudentId ? '#DA7756' : '#000000' }}>{value}</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        <div style={{ borderTop: `1px dashed ${fc.border}` }} />

                                                        {/* Monthly Payment Schedule */}
                                                        {feeMonths.length > 0 && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#000000' }}>Monthly Payment Schedule</p>
                                                                <div className="rounded-xl border overflow-x-auto overflow-y-auto max-h-[340px]" style={{ borderColor: fc.border, scrollbarWidth: 'thin', scrollbarColor: `${fc.border} transparent` }}>
                                                                    <table className="text-xs w-full" style={{ color: '#000000' }}>
                                                                        <thead className="sticky top-0 z-10">
                                                                            <tr style={{ background: fc.bg, borderBottom: `1px solid ${fc.border}` }}>
                                                                                {['Month', 'Fee Structures', 'Amount (₹)', 'Due Date', 'Paid Date', 'Status', 'Remark', ...extraColumns.map(c => c.label)].map((col, i) => (
                                                                                    <th key={i} className="px-3 py-2 text-left text-[11px] font-bold whitespace-nowrap" style={{ color: '#000000', borderRight: `1px solid ${fc.border}` }}>{col}</th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {feeMonths.map((m, mi) => {
                                                                                const total = studentMonthTotal(selectedStudent.id, m);
                                                                                const assigned = feeStructures.filter(s => m.assignedStructureIds.includes(s.id));
                                                                                const extraIds = (getPayment(selectedStudent.id, m.id).extraStructureIds ?? []).filter(id => !m.assignedStructureIds.includes(id));
                                                                                const extraStructures = extraIds.map(id => feeStructures.find(s => s.id === id)).filter((s): s is FeeStructure => !!s);
                                                                                const autoLateFee = getAutoLateFee(selectedStudent.id, m);
                                                                                const autoBusFee = getAutoBusFee(selectedStudent.id, m);
                                                                                return (
                                                                                    <tr key={m.id} className="transition-colors" style={{ background: selectedMonth === m.id ? `${fc.border}80` : mi % 2 === 1 ? fc.bg : 'transparent', borderTop: `1px solid ${fc.border}` }}>
                                                                                        <td className="px-3 py-2 font-semibold whitespace-nowrap cursor-pointer" style={{ borderRight: `1px solid ${fc.border}` }}
                                                                                            onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>
                                                                                            {m.month}
                                                                                        </td>
                                                                                        <td className="px-3 py-2" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                                                            <div className="flex flex-wrap items-center gap-0.5">
                                                                                                {assigned.length === 0 && extraStructures.length === 0 && !autoLateFee && !autoBusFee
                                                                                                    ? <span className="text-[10px] italic cursor-pointer" style={{ color: '#000000', opacity: 0.4 }} onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>—</span>
                                                                                                    : null
                                                                                                }
                                                                                                {assigned.map(s => (
                                                                                                    <span key={s.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer"
                                                                                                        onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}
                                                                                                        style={{ background: s.color + '20', color: s.color }}>
                                                                                                        {s.name}
                                                                                                    </span>
                                                                                                ))}
                                                                                                {extraStructures.map(s => (
                                                                                                    <span key={s.id} className="text-[9px] font-semibold pl-1.5 pr-1 py-0.5 rounded-full inline-flex items-center gap-0.5 cursor-pointer border border-dashed"
                                                                                                        style={{ background: s.color + '15', color: s.color, borderColor: s.color + '60' }}
                                                                                                        title="Added just for this student"
                                                                                                        onClick={() => setConfirmDelete({ kind: 'extraStructure', id: s.id, feeMonthId: m.id, label: s.name })}>
                                                                                                        {s.name}
                                                                                                        <X size={8} />
                                                                                                    </span>
                                                                                                ))}
                                                                                                {autoLateFee && (
                                                                                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"
                                                                                                        style={{ background: autoLateFee.color + '20', color: autoLateFee.color }}
                                                                                                        title="Auto-applied: payment is overdue and unpaid">
                                                                                                        {autoLateFee.name}
                                                                                                    </span>
                                                                                                )}
                                                                                                {autoBusFee && (
                                                                                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"
                                                                                                        style={{ background: autoBusFee.structure.color + '20', color: autoBusFee.structure.color }}
                                                                                                        title="Auto-applied: this student's Bus service is on">
                                                                                                        {autoBusFee.structure.name}
                                                                                                    </span>
                                                                                                )}
                                                                                                <button type="button" onClick={() => setAddStructureModalMonthId(m.id)}
                                                                                                    className="flex items-center justify-center w-4 h-4 rounded-full border hover:border-primary/50 hover:text-primary transition-all"
                                                                                                    style={{ borderColor: fc.border, color: '#000000', opacity: 0.6 }}
                                                                                                    title="Add a fee structure for this student only">
                                                                                                    <Plus size={9} />
                                                                                                </button>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-3 py-2 font-bold" style={{ borderRight: `1px solid ${fc.border}` }}>{total > 0 ? `₹${total.toLocaleString()}` : '—'}</td>
                                                                                        <td className="px-3 py-2" style={{ color: '#000000', borderRight: `1px solid ${fc.border}` }}>{m.dueDate}</td>
                                                                                        <td className="px-3 py-2" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                                                            <input value={getPayment(selectedStudent.id, m.id).paidDate ?? ''} onChange={e => setPaymentField(m.id, { paidDate: formatDateMaskLive(e.target.value) })}
                                                                                                onFocus={e => { const back = displayDateToMask(e.target.value); if (back !== e.target.value) setPaymentField(m.id, { paidDate: back }); }}
                                                                                                onBlur={e => { const disp = maskToDisplayDate(e.target.value); if (disp !== e.target.value) setPaymentField(m.id, { paidDate: disp }); }}
                                                                                                placeholder="DD-MM-YY" className="w-24 h-6 px-2 rounded-lg border bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-black/40"
                                                                                                style={{ borderColor: fc.border, color: isPaidLate(m.dueDate, getPayment(selectedStudent.id, m.id).paidDate) ? '#DC2626' : '#000000', fontWeight: isPaidLate(m.dueDate, getPayment(selectedStudent.id, m.id).paidDate) ? 600 : 400 }} />
                                                                                        </td>
                                                                                        <td className="px-3 py-2" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                                                            <button onClick={() => {
                                                                                                const current = getPayment(selectedStudent.id, m.id);
                                                                                                if (current.status !== 'PAID' && !current.paidDate?.trim()) {
                                                                                                    toast.error('Enter the paid date before marking as Paid');
                                                                                                    return;
                                                                                                }
                                                                                                setPaymentField(m.id, { status: current.status === 'PAID' ? 'PENDING' : 'PAID' });
                                                                                            }}
                                                                                                className={`flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold transition-all ${STATUS_CFG[getPayment(selectedStudent.id, m.id).status].cls}`}>
                                                                                                {getPayment(selectedStudent.id, m.id).status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[getPayment(selectedStudent.id, m.id).status].label}
                                                                                            </button>
                                                                                        </td>
                                                                                        <td className="px-3 py-2" style={{ borderRight: extraColumns.length > 0 ? `1px solid ${fc.border}` : 'none' }}>
                                                                                            <input value={getPayment(selectedStudent.id, m.id).remark ?? ''} onChange={e => setPaymentField(m.id, { remark: e.target.value })}
                                                                                                placeholder="e.g. Late payment" className="w-28 h-6 px-2 rounded-lg border bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-black/40"
                                                                                                style={{ borderColor: fc.border, color: '#000000' }} />
                                                                                        </td>
                                                                                        {extraColumns.map((col, ci) => (
                                                                                            <td key={ci} className="px-3 py-2" style={{ borderRight: ci === extraColumns.length - 1 ? 'none' : `1px solid ${fc.border}` }}>
                                                                                                <input
                                                                                                    value={getPayment(selectedStudent.id, m.id).extraFields?.[col.label] ?? ''}
                                                                                                    onChange={e => setPaymentField(m.id, { extraFieldLabel: col.label, extraFieldValue: e.target.value })}
                                                                                                    placeholder="—" className="w-16 h-6 px-2 rounded-lg border bg-transparent text-[11px] focus:outline-none focus:border-primary/50 placeholder:text-black/40"
                                                                                                    style={{ borderColor: fc.border, color: '#000000' }} />
                                                                                            </td>
                                                                                        ))}
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                            <tr style={{ background: fc.bg, borderTop: `2px solid ${fc.border}` }}>
                                                                                <td className="px-3 py-2 font-bold text-[11px]" style={{ color: '#000000' }}>Annual Total</td>
                                                                                <td />
                                                                                <td className="px-3 py-2 text-[11px] font-black" style={{ color: '#000000' }}>
                                                                                    ₹{feeMonths.reduce((n, m) => n + studentMonthTotal(selectedStudent.id, m), 0).toLocaleString()}
                                                                                </td>
                                                                                <td colSpan={4 + extraColumns.length} />
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div style={{ borderTop: `1px dashed ${fc.border}` }} />

                                                        {/* Fee Structure Breakdown */}
                                                        <div>
                                                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#000000' }}>
                                                                {selectedMonth
                                                                    ? `Fee Structure Breakdown - ${feeMonths.find(m => m.id === selectedMonth)?.month}`
                                                                    : 'Fee Structure Breakdown'
                                                                }
                                                            </p>
                                                            {!selectedMonth ? (
                                                                <div className="py-6 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                                    <p className="text-xs" style={{ color: '#000000' }}>Click a month row to view breakdown</p>
                                                                </div>
                                                            ) : (() => {
                                                                const month = feeMonths.find(m => m.id === selectedMonth);
                                                                if (!month) return null;
                                                                const sharedIds = new Set(month.assignedStructureIds);
                                                                const extraIds = selectedStudent
                                                                    ? (getPayment(selectedStudent.id, month.id).extraStructureIds ?? []).filter(id => !sharedIds.has(id))
                                                                    : [];
                                                                const autoLateFee = selectedStudent ? getAutoLateFee(selectedStudent.id, month) : null;
                                                                const autoBusFee = selectedStudent ? getAutoBusFee(selectedStudent.id, month) : null;
                                                                const assigned = feeStructures.filter(s => sharedIds.has(s.id) || extraIds.includes(s.id) || s.id === autoLateFee?.id || s.id === autoBusFee?.structure.id);
                                                                if (assigned.length === 0) return (
                                                                    <div className="py-6 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                                        <p className="text-xs" style={{ color: '#000000' }}>No fee structures assigned to {month.month}</p>
                                                                    </div>
                                                                );
                                                                return (
                                                                    <div className="space-y-2">
                                                                        {assigned.map(fs => {
                                                                            const isAutoBusFee = fs.id === autoBusFee?.structure.id;
                                                                            const total = isAutoBusFee && autoBusFee ? autoBusFee.amount : structureTotal(fs);
                                                                            const cfg = FEE_TYPE_CFG[fs.type];
                                                                            const isExtra = extraIds.includes(fs.id);
                                                                            const isAutoLateFee = fs.id === autoLateFee?.id;
                                                                            return (
                                                                                <div key={fs.id} className="rounded-xl border overflow-hidden" style={(isExtra || isAutoLateFee || isAutoBusFee) ? { borderColor: fs.color + '60', borderStyle: 'dashed' } : { borderColor: fc.border }}>
                                                                                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: fc.bg }}>
                                                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fs.color }} />
                                                                                        <span className="flex-1 text-xs font-semibold" style={{ color: '#000000' }}>{fs.name}</span>
                                                                                        {isExtra && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: fs.color + '20', color: fs.color }}>For this student</span>}
                                                                                        {isAutoLateFee && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: fs.color + '20', color: fs.color }}>Auto-applied</span>}
                                                                                        {isAutoBusFee && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: fs.color + '20', color: fs.color }}>Auto-applied</span>}
                                                                                        <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.emoji} {cfg.label}</span>
                                                                                        <span className="text-xs font-bold" style={{ color: '#000000' }}>₹{total.toLocaleString()}</span>
                                                                                    </div>
                                                                                    {fs.items.map(item => {
                                                                                        const subTotal = item.subItems.reduce((n, s) => n + s.amount, 0);
                                                                                        const hasSub = item.subItems.length > 0;
                                                                                        const isOpen = expandedBreakdownItemIds.has(item.id);
                                                                                        const Row = hasSub ? 'button' : 'div';
                                                                                        return (
                                                                                            <div key={item.id}>
                                                                                                <Row type={hasSub ? 'button' : undefined}
                                                                                                    onClick={hasSub ? () => setExpandedBreakdownItemIds(prev => {
                                                                                                        const next = new Set(prev);
                                                                                                        if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                                                                                        return next;
                                                                                                    }) : undefined}
                                                                                                    className="w-full flex items-center justify-between px-3 py-1.5 pl-5 text-left" style={{ borderTop: `1px solid ${fc.border}`, background: fc.bg }}>
                                                                                                    <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: '#000000' }}>
                                                                                                        {item.label}
                                                                                                        {hasSub && <ChevronDown size={11} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ opacity: 0.5 }} />}
                                                                                                    </span>
                                                                                                    <span className="text-[11px] font-semibold" style={{ color: '#000000' }}>₹{(subTotal || item.amount).toLocaleString()}</span>
                                                                                                </Row>
                                                                                                <AnimatePresence>
                                                                                                    {hasSub && isOpen && (
                                                                                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                                                                            {item.subItems.map(si => (
                                                                                                                <div key={si.id} className="flex items-center justify-between px-3 py-1 pl-8" style={{ borderTop: `1px solid ${fc.border}`, background: 'rgba(255,255,255,0.35)' }}>
                                                                                                                    <span className="text-[10px]" style={{ color: '#000000', opacity: 0.65 }}>{si.label}</span>
                                                                                                                    <span className="text-[10px]" style={{ color: '#000000', opacity: 0.65 }}>₹{si.amount.toLocaleString()}</span>
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </motion.div>
                                                                                                    )}
                                                                                                </AnimatePresence>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        {feeMonths.length === 0 && feeStructures.length === 0 && (
                                                            <div className="text-center py-8">
                                                                <p className="text-sm" style={{ color: '#000000' }}>No fee structure set up yet</p>
                                                                <p className="text-xs mt-1" style={{ color: '#000000' }}>Go to Fee Setup tab to configure fee structures</p>
                                                            </div>
                                                        )}

                                                    </div>
                                                </div>

                                                {/* BACK — Rules & Regulations */}
                                                <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: fc.bg, borderColor: fc.border }}
                                                    className={`rounded-2xl border ${!studentCardFlipped ? 'invisible' : ''}`}>

                                                    {/* Header — school branding, same as front */}
                                                    <div className="px-4 py-2.5 flex items-center justify-between gap-2.5 rounded-t-2xl" style={{ background: fc.bg, borderBottom: `1px solid ${fc.border}` }}>
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {schoolLogoUrl
                                                                ? <img src={schoolLogoUrl} alt="School logo" className="w-20 h-20 rounded-lg object-contain shrink-0" style={{ background: fc.bg }} />
                                                                : <div className="w-20 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FFFFFF', border: `1px dashed ${fc.border}` }}><ImagePlus size={30} style={{ color: '#000000', opacity: 0.3 }} /></div>}
                                                            {schoolName
                                                                ? <p className="text-3xl font-bold" style={{ color: '#000000' }}>{schoolName}</p>
                                                                : <p className="text-xs italic" style={{ color: '#000000', opacity: 0.4 }}>School name not added yet</p>}
                                                        </div>
                                                        <button onClick={() => setStudentCardFlipped(false)}
                                                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border transition-all hover:bg-white/40 shrink-0"
                                                            style={{ borderColor: fc.border, color: '#000000' }}>
                                                            <span style={{ fontSize: '16px', display: 'inline-block', transform: 'scaleX(-1)' }}>↺</span>
                                                            View Front
                                                        </button>
                                                    </div>

                                                    {/* Strip — student name's fee card / rules & regulations */}
                                                    <div className="px-4 py-2 border-b" style={{ borderColor: fc.border }}>
                                                        <p className="text-sm font-bold tracking-wide" style={{ color: '#000000' }}>{selectedStudent.name}'s Fee Card</p>
                                                        <p className="text-[11px]" style={{ color: '#000000', opacity: 0.7 }}>Rules & Regulations</p>
                                                    </div>

                                                    {/* Rules Content */}
                                                    <div className="px-4 py-3 space-y-3">
                                                        {rulesAndRegs.length === 0 ? (
                                                            <div className="py-8 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                                <p className="text-xs" style={{ color: '#000000' }}>No rules defined yet</p>
                                                                <p className="text-[11px] mt-1" style={{ color: '#000000', opacity: 0.7 }}>Add rules from Fee Setup → Fee Card Template → View Back</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2.5">
                                                                {rulesAndRegs.map((rule, i) => (
                                                                    <div key={rule.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${fc.border}` }}>
                                                                        <span className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0" style={{ background: fc.border, color: '#000000' }}>{i + 1}</span>
                                                                        <p className="text-sm leading-relaxed flex-1 pt-0.5" style={{ color: '#000000' }}>{rule.text}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                            </motion.div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add per-student fee structure (penalty/fine etc.) modal */}
            <AnimatePresence>
                {addStructureModalMonthId && selectedStudent && (() => {
                    const m = feeMonths.find(fm => fm.id === addStructureModalMonthId);
                    if (!m) return null;
                    const extraIds = (getPayment(selectedStudent.id, m.id).extraStructureIds ?? []).filter(id => !m.assignedStructureIds.includes(id));
                    // Bus Fee / Late Fee Fine structures are managed only from Fee Setup —
                    // they don't show up here as selectable per-student extras.
                    const selectableStructures = feeStructures.filter(fs => fs.type !== 'BUS' && fs.type !== 'LATE_FEE');
                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAddStructureModalMonthId(null)}>
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                onClick={e => e.stopPropagation()}
                                className="bg-card border border-border rounded-2xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col max-h-[85vh]" data-admin-surface="">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                                    <div>
                                        <h3 className="text-sm font-bold">Add Fee Structure</h3>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{selectedStudent.name} · {m.month}</p>
                                    </div>
                                    <button onClick={() => setAddStructureModalMonthId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-all">
                                        <X size={14} />
                                    </button>
                                </div>

                                <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                                    {/* LEFT — existing structures, pick one */}
                                    <div className="w-full md:w-1/2 md:border-r border-border/50 flex flex-col min-h-0">
                                        <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0 gap-2">
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Existing Structures</p>
                                            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/50 shrink-0">
                                                {([
                                                    { key: 'setup' as const, label: 'Setup' },
                                                    { key: 'student' as const, label: 'Per-student' },
                                                ]).map(opt => (
                                                    <button key={opt.key} onClick={() => setAddModalStructureFilter(opt.key)}
                                                        className={`h-6 px-2.5 rounded-md text-[10px] font-semibold transition-all ${addModalStructureFilter === opt.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2"
                                            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                            {(() => {
                                                const filteredSelectable = selectableStructures.filter(fs => (fs.origin ?? 'setup') === addModalStructureFilter);
                                                if (filteredSelectable.length === 0) {
                                                    return (
                                                        <div className="text-center py-8">
                                                            <Tag size={22} className="mx-auto text-muted-foreground/30 mb-2" />
                                                            <p className="text-xs text-muted-foreground/60">
                                                                {addModalStructureFilter === 'student' ? 'No per-student structures yet' : 'No fee structures yet'}
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground/40 mt-1">Create one on the right to add it for this student</p>
                                                        </div>
                                                    );
                                                }
                                                return filteredSelectable.map(fs => (
                                                    <FeeStructureCard key={fs.id} fs={fs}
                                                        isShared={m.assignedStructureIds.includes(fs.id)}
                                                        isAdded={extraIds.includes(fs.id)}
                                                        onSelect={() => setPaymentField(m.id, { toggleStructureId: fs.id })}
                                                        onEdit={() => { setEditingStructure(fs); setShowStructureModal(true); }}
                                                        onDelete={() => setConfirmDelete({ kind: 'feeStructure', id: fs.id, label: fs.name })}
                                                    />
                                                ));
                                            })()}
                                        </div>
                                    </div>

                                    {/* RIGHT — create a brand new structure inline (saved into the shared list) */}
                                    <div className="w-full md:w-1/2 flex flex-col min-h-0 border-t md:border-t-0 border-border/50">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-3 pb-2 shrink-0">Create New Structure</p>
                                        <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col min-h-0"
                                            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                            <FeeStructureForm compact
                                                excludeTypes={['BUS', 'LATE_FEE']}
                                                defaultOrigin="student"
                                                onSave={s => {
                                                    setFeeStructures(prev => insertStructure(prev, s));
                                                    setPaymentField(m.id, { toggleStructureId: s.id });
                                                    toast.success(`${s.name} added for ${selectedStudent.name}`);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* Add/Edit fee structure modal (rendered after the per-student panel so an
                Edit opened from within it stacks visually on top, not behind) */}
            <AnimatePresence>
                {showStructureModal && (
                    <FeeStructureModal
                        initial={editingStructure}
                        existingStructures={feeStructures}
                        onSave={s => {
                            if (editingStructure) {
                                setFeeStructures(prev => prev.map(fs => fs.id === s.id ? s : fs));
                            } else {
                                setFeeStructures(prev => insertStructure(prev, s));
                            }
                            setShowStructureModal(false);
                        }}
                        onClose={() => setShowStructureModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* Confirm delete — Fee Card Template items */}
            <AnimatePresence>
                {confirmDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" data-admin-surface="">
                            <h3 className="text-base font-bold mb-2">
                                Delete {confirmDelete.kind === 'studentField' ? 'Field'
                                    : confirmDelete.kind === 'extraColumn' ? 'Column'
                                        : confirmDelete.kind === 'feeMonth' ? 'Month'
                                            : confirmDelete.kind === 'feeStructure' ? 'Structure'
                                                : confirmDelete.kind === 'extraStructure' ? 'Structure'
                                                    : 'Rule'}?
                            </h3>
                            <p className={`text-sm text-muted-foreground ${confirmDelete.kind === 'feeStructure' || confirmDelete.kind === 'extraStructure' ? 'mb-1.5' : 'mb-5'}`}>
                                &ldquo;{confirmDelete.label}&rdquo; will be permanently deleted. Are you sure?
                            </p>
                            {(confirmDelete.kind === 'feeStructure' || confirmDelete.kind === 'extraStructure') && (
                                <p className="text-xs text-amber-600 dark:text-amber-500 mb-5">
                                    If this structure is assigned anywhere, it will also disappear from those students&rsquo; fee cards.
                                </p>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDelete(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={runConfirmedDelete}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-all">
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirm bus service toggle */}
            <AnimatePresence>
                {confirmBusToggle && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" data-admin-surface="">
                            <h3 className="text-base font-bold mb-2">
                                {confirmBusToggle.nextEnabled ? 'Enable Bus Service?' : 'Disable Bus Service?'}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                {confirmBusToggle.nextEnabled
                                    ? 'This student will be marked as taking the bus service.'
                                    : 'This student will be taken off their bus (also on the Transport page and in the parent app). Bus fee stops from the next due month; months already due or paid keep their bus fee.'}
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmBusToggle(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => {
                                    if (!confirmBusToggle) return;
                                    const { studentId, fieldId, nextEnabled } = confirmBusToggle;
                                    setConfirmBusToggle(null);
                                    if (nextEnabled) openBusPicker(studentId, fieldId);
                                    else void turnBusOff(studentId);
                                }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                    style={{ background: confirmBusToggle.nextEnabled ? '#10B981' : '#DC2626' }}>
                                    Yes, {confirmBusToggle.nextEnabled ? 'Enable' : 'Disable'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bus - pick the real bus + stop (+ shift) from Transport */}
            <AnimatePresence>
                {busPicker && (() => {
                    const buses = transport?.buses ?? [];
                    const bus = buses.find(b => b.id === busPicker.busId) ?? null;
                    const stops = bus?.route?.stops ?? [];
                    const name = rosterStudents.find(s => s.id === busPicker.studentId)?.name ?? 'this student';
                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!busSaving) setBusPicker(null); }}>
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()} data-admin-surface="">
                                <h3 className="text-sm font-bold mb-1">Bus for {name}</h3>
                                {!transport ? (
                                    <p className="text-xs text-muted-foreground mb-4">Loading buses...</p>
                                ) : !buses.length ? (
                                    <p className="text-xs text-muted-foreground mb-4">No buses yet. Add the school&apos;s buses and routes in <b>Transport</b> first, then come back here.</p>
                                ) : (
                                    <div className="space-y-3 mb-4">
                                        <p className="text-xs text-muted-foreground">The bus fee is filled from the stop&apos;s monthly fee. You can still change it on the card.</p>
                                        <div className="space-y-1">
                                            <span className="text-xs font-semibold text-muted-foreground">Bus</span>
                                            <ThemedSelect value={busPicker.busId} placeholder="Pick a bus"
                                                options={buses.map(b => ({ value: b.id, label: `${b.name}${b.route ? ` · ${b.route.name}` : ' · no route yet'}` }))}
                                                onChange={v => {
                                                    const next = buses.find(b => b.id === v);
                                                    const shift = next && !next.afternoonShift ? 'MORNING' : next && !next.morningShift ? 'AFTERNOON' : busPicker.shift;
                                                    setBusPicker({ ...busPicker, busId: v, stopId: '', shift });
                                                }} />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs font-semibold text-muted-foreground">Stop</span>
                                            {stops.length
                                                ? <ThemedSelect value={busPicker.stopId} placeholder="Pick the stop"
                                                    options={stops.map((st, i) => ({ value: st.id, label: `${i + 1}. ${st.name}${st.monthlyFee != null ? ` · ₹${st.monthlyFee.toLocaleString('en-IN')}/month` : ''}` }))}
                                                    onChange={v => setBusPicker({ ...busPicker, stopId: v })} />
                                                : <p className="text-xs text-muted-foreground">This bus has no route or stops yet. Add them in Transport.</p>}
                                        </div>
                                        {bus?.morningShift && bus.afternoonShift && (
                                            <div className="space-y-1">
                                                <span className="text-xs font-semibold text-muted-foreground">Shift</span>
                                                <div className="flex gap-1.5">
                                                    {(['MORNING', 'AFTERNOON'] as const).map(sh => (
                                                        <button key={sh} type="button" onClick={() => setBusPicker({ ...busPicker, shift: sh })}
                                                            className="flex-1 h-8 rounded-xl border-2 text-xs font-semibold transition-all"
                                                            style={busPicker.shift === sh ? { borderColor: '#0891B2', background: '#0891B220', color: '#0891B2' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                                                            {sh === 'MORNING' ? '🌅 Morning' : '☀️ Afternoon'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setBusPicker(null)} disabled={busSaving}
                                        className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all disabled:opacity-60">
                                        Cancel
                                    </button>
                                    {getStudentDetailValue(busPicker.studentId, `${busPicker.fieldId}-enabled`) !== 'true' && (
                                        <button onClick={() => void decideBusLater()} disabled={busSaving} title="Needs the bus, but which one isn't decided yet. Shows on Transport → Waiting list."
                                            className="h-9 px-3 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-all disabled:opacity-60 mr-auto">
                                            Decide later
                                        </button>
                                    )}
                                    {!!buses.length && (
                                        <button onClick={() => void saveBusPicker()} disabled={busSaving}
                                            className="h-9 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all disabled:opacity-60"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                            {busSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* Bus Fee - pick which months it applies to for this student */}
            <AnimatePresence>
                {busMonthsModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setBusMonthsModal(null)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()} data-admin-surface="">
                            <h3 className="text-sm font-bold mb-1">Bus Fee - Select Months</h3>
                            <p className="text-xs text-muted-foreground mb-3">Pick the months this student&apos;s Bus Fee should be added to.</p>
                            {feeMonths.length > 0 && (
                                <button type="button"
                                    onClick={() => setBusMonthsSelection(prev => prev.length === feeMonths.length ? [] : feeMonths.map(m => m.id))}
                                    className="text-[11px] font-semibold text-primary hover:underline mb-2">
                                    {busMonthsSelection.length === feeMonths.length ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                            {feeMonths.length === 0 ? (
                                <p className="text-xs italic text-muted-foreground mb-4">No fee months set up yet.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5 mb-5 max-h-64 overflow-y-auto"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                    {feeMonths.map(m => {
                                        const active = busMonthsSelection.includes(m.id);
                                        return (
                                            <button key={m.id} type="button"
                                                onClick={() => setBusMonthsSelection(prev => active ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-xl border-2 text-[11px] font-semibold transition-all"
                                                style={active ? { borderColor: '#0891B2', background: '#0891B220', color: '#0891B2' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                                                {active && <Check size={10} />}
                                                {m.month}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setBusMonthsModal(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => {
                                    if (!busMonthsModal) return;
                                    void saveBusMonths(busMonthsModal.studentId, busMonthsSelection);
                                    setBusMonthsModal(null);
                                }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    Save
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Expanded student photo — same treatment as My Profile's avatar zoom */}
            <AnimatePresence>
                {expandedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setExpandedPhoto(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <img src={expandedPhoto.url} alt={expandedPhoto.name} className="w-full h-full object-cover" />
                            <button
                                onClick={() => setExpandedPhoto(null)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                <X size={14} className="text-white" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
