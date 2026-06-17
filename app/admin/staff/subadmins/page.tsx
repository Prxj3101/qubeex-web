'use client';

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
    Shield, Plus, Search, X, Mail, CalendarDays, Edit2,
    PowerOff, Power, MailCheck, ChevronDown, ChevronRight,
    Users, Building2, LineChart, Headset, ScrollText,
    User, Phone, Lock, Trash2,
} from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { motion } from 'framer-motion';

// ── Permission tree definition ────────────────────────────────────────────────

interface PermNode {
    key: string;
    label: string;
    description?: string;
    children?: PermNode[];
    icon?: React.ElementType;
}

const PERMISSION_TREE: PermNode[] = [
    {
        key: 'STAFF', label: 'Staff', icon: Users,
        children: [
            { key: 'STAFF_TEACHERS',  label: 'Teachers',  description: 'View teacher profiles and assignments' },
            { key: 'STAFF_STAFFROOM', label: 'Staffroom', description: 'Access staff feed and DMs' },
            { key: 'STAFF_SUBADMINS', label: 'Subadmins', description: 'View list of subadmins' },
        ],
    },
    {
        key: 'CAMPUS', label: 'Campus', icon: Building2,
        children: [
            { key: 'CAMPUS_VIEW',   label: 'View',   description: 'Class overview, feed, timetable' },
            { key: 'CAMPUS_MANAGE', label: 'Manage', description: 'Teachers, subjects, students' },
            { key: 'CAMPUS_FEES',   label: 'Fees',   description: 'Fee structure & student fees' },
        ],
    },
    { key: 'INSIGHTS',   label: 'Insights',   icon: LineChart,  description: 'Analytics and subscription info' },
    { key: 'SUPPORT',    label: 'Support',    icon: Headset,    description: 'Support tickets and reviews' },
    { key: 'AUDIT_LOGS', label: 'Audit Logs', icon: ScrollText, description: 'Admin activity audit trail' },
];

function getLeafKeys(node: PermNode): string[] {
    if (!node.children?.length) return [node.key];
    return node.children.flatMap(getLeafKeys);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubAdminRecord {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    permissions: string[];
    invitePending?: boolean;
    createdAt: string;
    designation?: string;
    phone?: string;
    city?: string;
    state?: string;
    qualification?: string;
    experience?: string;
}

type ModalState =
    | { type: 'closed' }
    | { type: 'add' }
    | { type: 'edit'; subadmin: SubAdminRecord }
    | { type: 'delete'; subadmin: SubAdminRecord };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const AVATAR_COLORS = [
    { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300' },
    { bg: 'bg-amber-100 dark:bg-amber-950',   text: 'text-amber-700 dark:text-amber-300'   },
    { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-sky-100 dark:bg-sky-950',       text: 'text-sky-700 dark:text-sky-300'       },
    { bg: 'bg-rose-100 dark:bg-rose-950',     text: 'text-rose-700 dark:text-rose-300'     },
    { bg: 'bg-teal-100 dark:bg-teal-950',     text: 'text-teal-700 dark:text-teal-300'     },
];

function getAvatarColor(id: string) {
    return AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];
}

// ── Permission Tree Component ─────────────────────────────────────────────────

function PermissionTree({
    selected,
    onChange,
}: {
    selected: string[];
    onChange: (keys: string[]) => void;
}) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['STAFF', 'CAMPUS']));

    function toggleExpand(key: string) {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    function toggleLeaf(key: string) {
        onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
    }

    function toggleParent(node: PermNode) {
        const leaves = getLeafKeys(node);
        const allChecked = leaves.every(k => selected.includes(k));
        if (allChecked) {
            onChange(selected.filter(k => !leaves.includes(k)));
        } else {
            const next = new Set([...selected, ...leaves]);
            onChange(Array.from(next));
        }
    }

    function parentState(node: PermNode): 'none' | 'some' | 'all' {
        const leaves = getLeafKeys(node);
        const count = leaves.filter(k => selected.includes(k)).length;
        if (count === 0) return 'none';
        if (count === leaves.length) return 'all';
        return 'some';
    }

    return (
        <div className="space-y-1">
            {PERMISSION_TREE.map(node => {
                const hasChildren = !!node.children?.length;
                const state = parentState(node);
                const isExpanded = expanded.has(node.key);
                const Icon = node.icon;

                return (
                    <div key={node.key} className="rounded-xl border border-border/40 overflow-hidden">
                        <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${
                            state !== 'none' ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                        }`}>
                            <input
                                type="checkbox"
                                checked={state === 'all'}
                                ref={el => { if (el) el.indeterminate = state === 'some'; }}
                                onChange={() => toggleParent(node)}
                                className="accent-indigo-600 w-3.5 h-3.5"
                            />
                            {Icon && <Icon size={14} className="text-muted-foreground shrink-0" />}
                            <span className={`text-sm font-semibold flex-1 ${state !== 'none' ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                                {node.label}
                            </span>
                            {!hasChildren && node.description && (
                                <span className="text-[11px] text-muted-foreground">{node.description}</span>
                            )}
                            {hasChildren && (
                                <button
                                    type="button"
                                    onClick={e => { e.preventDefault(); toggleExpand(node.key); }}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            )}
                        </label>

                        {hasChildren && isExpanded && (
                            <div className="border-t border-border/40 divide-y divide-border/30">
                                {node.children!.map(child => {
                                    const checked = selected.includes(child.key);
                                    return (
                                        <label key={child.key} className={`flex items-center gap-3 pl-8 pr-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors ${
                                            checked ? 'bg-indigo-50/40 dark:bg-indigo-950/10' : ''
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleLeaf(child.key)}
                                                className="accent-indigo-600 w-3.5 h-3.5"
                                            />
                                            <span className={`text-sm font-medium flex-1 ${checked ? 'text-indigo-700 dark:text-indigo-300' : 'text-muted-foreground'}`}>
                                                {child.label}
                                            </span>
                                            {child.description && (
                                                <span className="text-[11px] text-muted-foreground/70">{child.description}</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
    name: string;
    email: string;
    designation: string;
    phone: string;
    dob: string;
    gender: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    qualification: string;
    experience: string;
    permissions: string[];
}

const EMPTY_FORM: FormState = {
    name: '', email: '', designation: '', phone: '', dob: '', gender: '',
    address: '', city: '', state: '', pincode: '', country: 'India',
    qualification: '', experience: '', permissions: [],
};

const GENDERS = ['Male', 'Female', 'Other'];

function SectionLabel({ label }: { label: string }) {
    return <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>;
}

// ── SubAdmin Card ─────────────────────────────────────────────────────────────

function SubAdminCard({
    subadmin, index, onEdit, onToggleStatus, onResendInvite, onDelete,
}: {
    subadmin: SubAdminRecord;
    index: number;
    onEdit: (s: SubAdminRecord) => void;
    onToggleStatus: (s: SubAdminRecord) => void;
    onResendInvite: (s: SubAdminRecord) => void;
    onDelete: (s: SubAdminRecord) => void;
}) {
    const avatarColor = getAvatarColor(subadmin.id);
    const isActive = subadmin.isActive;

    const permLabels: string[] = [];
    for (const node of PERMISSION_TREE) {
        const leaves = getLeafKeys(node);
        const granted = leaves.filter(k => subadmin.permissions.includes(k));
        if (granted.length === 0) continue;
        if (!node.children?.length || granted.length === leaves.length) {
            permLabels.push(node.label);
        } else {
            for (const k of granted) {
                const child = node.children?.find(c => c.key === k);
                if (child) permLabels.push(`${node.label} › ${child.label}`);
            }
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.28, ease: 'easeOut' }}
            className={`bg-card border rounded-2xl flex flex-col transition-all duration-200 overflow-hidden
                ${isActive
                    ? 'border-border/50 hover:border-primary/30 hover:shadow-md'
                    : 'border-border/30 opacity-70 hover:opacity-90'
                }`}
        >
            <div className="flex items-start gap-3 p-4 pb-3">
                <div className={`w-12 h-12 rounded-xl ring-2 ring-border shrink-0 flex items-center justify-center ${avatarColor.bg}`}>
                    <span className={`text-base font-bold select-none ${avatarColor.text}`}>
                        {getInitials(subadmin.name)}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">{subadmin.name}</p>
                        {subadmin.invitePending ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                Invite Pending
                            </span>
                        ) : (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${isActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        )}
                    </div>
                    {subadmin.designation && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{subadmin.designation}</p>
                    )}
                </div>
            </div>

            <div className="h-px bg-border/50 mx-4" />

            <div className="px-4 py-3 space-y-2 flex-1">
                {[
                    { icon: Mail,         value: subadmin.email },
                    { icon: Phone,        value: subadmin.phone ?? '—' },
                    { icon: CalendarDays, value: formatDate(subadmin.createdAt) },
                ].map(({ icon: Icon, value }) => (
                    <div key={value} className="flex items-center gap-2">
                        <Icon size={13} className="shrink-0 text-muted-foreground/60" />
                        <span className="text-[12px] truncate">{value}</span>
                    </div>
                ))}

                {permLabels.length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Shield size={11} className="text-muted-foreground/60" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Access</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {permLabels.map(l => (
                                <span key={l} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                    {l}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-4 pb-4 pt-2 flex gap-2 mt-auto">
                <button
                    onClick={() => onEdit(subadmin)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
                >
                    <Edit2 size={12} />
                    Edit Access
                </button>
                {subadmin.invitePending ? (
                    <button
                        onClick={() => onResendInvite(subadmin)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30 text-xs font-medium transition-all"
                    >
                        <MailCheck size={12} />
                        Resend Invite
                    </button>
                ) : (
                    <button
                        onClick={() => onToggleStatus(subadmin)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all ${isActive
                            ? 'border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30'
                        }`}
                    >
                        {isActive ? <PowerOff size={12} /> : <Power size={12} />}
                        {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                )}
                <button
                    onClick={() => onDelete(subadmin)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-950/30 transition-all shrink-0"
                    title="Permanently delete subadmin"
                >
                    <Trash2 size={13} />
                </button>
            </div>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SubadminsPage() {
    const [subadmins, setSubadmins] = useState<SubAdminRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState>({ type: 'closed' });
    const [actionLoading, setActionLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [showGenderDrop, setShowGenderDrop] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/admin/subadmins')
            .then(res => { if (!cancelled) setSubadmins(res.data.data ?? []); })
            .catch(err => {
                if (!cancelled) {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                    toast.error(msg ?? 'Failed to load subadmins');
                }
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const activeCount = subadmins.filter(s => s.isActive && !s.invitePending).length;
    const pendingCount = subadmins.filter(s => s.invitePending).length;

    const filtered = search.trim()
        ? subadmins.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.email.toLowerCase().includes(search.toLowerCase()) ||
            (s.designation ?? '').toLowerCase().includes(search.toLowerCase())
        )
        : subadmins;

    function openAdd() {
        setForm(EMPTY_FORM);
        setShowGenderDrop(false);
        setModal({ type: 'add' });
    }

    function openEdit(subadmin: SubAdminRecord) {
        setForm({
            name: subadmin.name,
            email: subadmin.email,
            designation: subadmin.designation ?? '',
            phone: subadmin.phone ?? '',
            dob: '', gender: '',
            address: '', city: subadmin.city ?? '',
            state: subadmin.state ?? '', pincode: '', country: 'India',
            qualification: subadmin.qualification ?? '',
            experience: subadmin.experience ?? '',
            permissions: [...subadmin.permissions],
        });
        setShowGenderDrop(false);
        setModal({ type: 'edit', subadmin });
    }

    function closeModal() {
        setModal({ type: 'closed' });
    }

    const handleAdd = useCallback(async () => {
        if (!form.name.trim() || !form.email.trim()) return;
        if (form.permissions.length === 0) { toast.error('Grant at least one permission'); return; }
        setActionLoading(true);
        try {
            const res = await api.post('/admin/subadmins', {
                name: form.name.trim(),
                email: form.email.trim(),
                permissions: form.permissions,
                designation: form.designation || undefined,
                phone: form.phone || undefined,
                dob: form.dob || undefined,
                gender: form.gender || undefined,
                address: form.address || undefined,
                city: form.city || undefined,
                state: form.state || undefined,
                pincode: form.pincode || undefined,
                country: form.country || undefined,
                qualification: form.qualification || undefined,
                experience: form.experience || undefined,
            });
            setSubadmins(prev => [res.data.data, ...prev]);
            toast.success('Subadmin invited successfully');
            closeModal();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to add subadmin');
        } finally { setActionLoading(false); }
    }, [form]);

    const handleEditPermissions = useCallback(async () => {
        if (modal.type !== 'edit') return;
        if (form.permissions.length === 0) { toast.error('Grant at least one permission'); return; }
        setActionLoading(true);
        try {
            await api.patch(`/admin/subadmins/${modal.subadmin.id}/permissions`, {
                permissions: form.permissions,
            });
            setSubadmins(prev => prev.map(s =>
                s.id === modal.subadmin.id ? { ...s, permissions: form.permissions } : s
            ));
            toast.success('Permissions updated');
            closeModal();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to update permissions');
        } finally { setActionLoading(false); }
    }, [modal, form.permissions]);

    const handleToggleStatus = useCallback(async (subadmin: SubAdminRecord) => {
        try {
            await api.patch(`/admin/subadmins/${subadmin.id}/deactivate`);
            setSubadmins(prev => prev.map(s =>
                s.id === subadmin.id ? { ...s, isActive: false } : s
            ));
            toast.success('Subadmin deactivated');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to deactivate');
        }
    }, []);

    const handleResendInvite = useCallback(async (subadmin: SubAdminRecord) => {
        try {
            await api.post(`/admin/subadmins/${subadmin.id}/resend-invite`);
            toast.success('Invite resent');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to resend invite');
        }
    }, []);

    const handleDeleteSubAdmin = useCallback(async () => {
        if (modal.type !== 'delete') return;
        setActionLoading(true);
        try {
            await api.delete(`/admin/subadmins/${modal.subadmin.id}`);
            setSubadmins(prev => prev.filter(s => s.id !== modal.subadmin.id));
            toast.success('Subadmin permanently deleted');
            closeModal();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to delete subadmin');
        } finally { setActionLoading(false); }
    }, [modal]);

    function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm(prev => ({ ...prev, [key]: value }));
    }

    const isModalOpen = modal.type === 'add' || modal.type === 'edit';

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4 px-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background pb-0">
                <div className="flex items-center justify-between pt-0 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Shield size={21} /> Subadmins
                        </h1>
                        <p className="text-muted-foreground text-[13px]">
                            {activeCount} active · {pendingCount} pending invite
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search subadmins..."
                                className="w-56 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            <Plus size={15} /> Add Subadmin
                        </button>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto pb-6">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <Shield size={24} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No subadmins yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Add one using the button above</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 items-start">
                        {filtered.map((s, i) => (
                            <SubAdminCard
                                key={s.id}
                                subadmin={s}
                                index={i}
                                onEdit={openEdit}
                                onToggleStatus={handleToggleStatus}
                                onResendInvite={handleResendInvite}
                                onDelete={s => setModal({ type: 'delete', subadmin: s })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            <Dialog open={isModalOpen} onOpenChange={v => !v && closeModal()}>
                <DialogContent
                    className="p-0 gap-0 bg-card flex flex-col"
                    style={{ width: '80vw', maxWidth: '860px', maxHeight: '88vh' }}
                >
                    {/* Header */}
                    <div className="px-6 pt-5 pb-3.5 border-b border-border/50 shrink-0">
                        <DialogTitle className="text-base font-semibold flex items-center gap-2">
                            <Shield size={16} className="text-primary" />
                            {modal.type === 'add' ? 'Add Subadmin' : 'Edit Subadmin Access'}
                        </DialogTitle>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {modal.type === 'add'
                                ? 'Add a new subadmin. An invite will be sent to their email.'
                                : 'Update the permissions for this subadmin.'}
                        </p>
                    </div>

                    <div className="flex flex-1 min-h-0">
                        {/* LEFT — Profile info */}
                        <div className="flex-1 px-6 py-5 overflow-y-auto border-r border-border/40 space-y-5 min-w-0">

                            {/* Identity */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                                        <User size={11} className="text-primary" />
                                    </div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider">Subadmin Info</p>
                                    <div className="flex-1 h-px bg-border/60" />
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <SectionLabel label="Full Name *" />
                                        <input
                                            value={form.name}
                                            onChange={e => setField('name', e.target.value)}
                                            disabled={modal.type === 'edit'}
                                            placeholder="e.g. Priya Sharma"
                                            className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <SectionLabel label="Email Address *" />
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={e => setField('email', e.target.value)}
                                            disabled={modal.type === 'edit'}
                                            placeholder="e.g. priya@school.edu.in"
                                            className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <SectionLabel label="Role / Designation" />
                                        <input
                                            value={form.designation}
                                            onChange={e => setField('designation', e.target.value)}
                                            placeholder="e.g. Finance Officer, Campus Coordinator"
                                            className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {modal.type === 'add' && (
                                <>
                                    {/* Contact & Personal */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                                                <Phone size={11} className="text-primary" />
                                            </div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider">Contact & Personal</p>
                                            <div className="flex-1 h-px bg-border/60" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <SectionLabel label="Phone" />
                                                <input
                                                    value={form.phone}
                                                    onChange={e => setField('phone', e.target.value)}
                                                    placeholder="+91 98765 43210"
                                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <SectionLabel label="Date of Birth" />
                                                <input
                                                    type="date"
                                                    value={form.dob}
                                                    onChange={e => setField('dob', e.target.value)}
                                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all"
                                                />
                                            </div>
                                            <div className="relative">
                                                <SectionLabel label="Gender" />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowGenderDrop(p => !p)}
                                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm text-left flex items-center justify-between focus:outline-none focus:border-primary/50 transition-all"
                                                >
                                                    <span className={form.gender ? '' : 'text-muted-foreground/50'}>{form.gender || 'Select gender'}</span>
                                                    <ChevronDown size={13} className="text-muted-foreground" />
                                                </button>
                                                {showGenderDrop && (
                                                    <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                                                        {GENDERS.map(g => (
                                                            <button
                                                                key={g} type="button"
                                                                onClick={() => { setField('gender', g); setShowGenderDrop(false); }}
                                                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                                                            >
                                                                {g}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <SectionLabel label="Qualification" />
                                                <input
                                                    value={form.qualification}
                                                    onChange={e => setField('qualification', e.target.value)}
                                                    placeholder="e.g. B.Com"
                                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <SectionLabel label="Experience" />
                                                <input
                                                    value={form.experience}
                                                    onChange={e => setField('experience', e.target.value)}
                                                    placeholder="e.g. 3 years in fee management"
                                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="flex-1 h-px bg-border/60" />
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Address</p>
                                            <div className="flex-1 h-px bg-border/60" />
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <SectionLabel label="Street Address" />
                                                <input
                                                    value={form.address}
                                                    onChange={e => setField('address', e.target.value)}
                                                    placeholder="Flat / Street"
                                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <SectionLabel label="City" />
                                                    <input value={form.city} onChange={e => setField('city', e.target.value)} placeholder="Mumbai" className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                                <div>
                                                    <SectionLabel label="State" />
                                                    <input value={form.state} onChange={e => setField('state', e.target.value)} placeholder="Maharashtra" className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                                <div>
                                                    <SectionLabel label="Pincode" />
                                                    <input value={form.pincode} onChange={e => setField('pincode', e.target.value)} placeholder="400001" className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                                <div>
                                                    <SectionLabel label="Country" />
                                                    <input value={form.country} onChange={e => setField('country', e.target.value)} placeholder="India" className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* RIGHT — Permissions */}
                        <div className="w-80 shrink-0 px-5 py-5 overflow-y-auto">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                                    <Lock size={11} className="text-primary" />
                                </div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider">Access Permissions</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground mb-3">
                                Select which sections this subadmin can access. Everything else will be locked.
                            </p>
                            <PermissionTree
                                selected={form.permissions}
                                onChange={perms => setField('permissions', perms)}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between shrink-0">
                        <p className="text-[11px] text-muted-foreground">
                            {form.permissions.length} permission{form.permissions.length !== 1 ? 's' : ''} selected
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={modal.type === 'add' ? handleAdd : handleEditPermissions}
                                disabled={actionLoading || !form.name.trim() || (modal.type === 'add' && !form.email.trim()) || form.permissions.length === 0}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                {actionLoading ? 'Saving...' : modal.type === 'add' ? 'Send Invite' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={modal.type === 'delete'}
                onOpenChange={v => !v && closeModal()}
                label="Subadmin"
                name={modal.type === 'delete' ? modal.subadmin.name : ''}
                loading={actionLoading}
                onConfirm={handleDeleteSubAdmin}
                confirmLabel="Delete"
                description="This will permanently delete the subadmin account. This cannot be undone."
            />
        </div>
    );
}
