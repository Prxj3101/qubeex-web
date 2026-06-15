'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
    Plus, Search, X, Shield, Mail, CalendarDays, Edit2,
    PowerOff, Power, MailCheck,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubAdminRecord {
    id: string;
    name: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE';
    permissions: string[];
    createdAt: string;
    invitePending?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PERMISSION_OPTIONS = [
    { key: 'CAMPUS', label: 'Campus & Classes', description: 'Manage classes, divisions, timetable' },
    { key: 'FEES', label: 'Fees Management', description: 'View and manage student fees' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

const AVATAR_COLORS = [
    { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300' },
    { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-300' },
    { bg: 'bg-rose-100 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300' },
    { bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-teal-700 dark:text-teal-300' },
];

function getAvatarColor(id: string) {
    const idx = id.charCodeAt(id.length - 1) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

// ── Modal state ───────────────────────────────────────────────────────────────
type ModalState =
    | { type: 'closed' }
    | { type: 'add' }
    | { type: 'edit'; subadmin: SubAdminRecord };

// ── SubAdmin Card ─────────────────────────────────────────────────────────────
function SubAdminCard({
    subadmin,
    index,
    onEdit,
    onToggleStatus,
    onResendInvite,
}: {
    subadmin: SubAdminRecord;
    index: number;
    onEdit: (s: SubAdminRecord) => void;
    onToggleStatus: (s: SubAdminRecord) => void;
    onResendInvite: (s: SubAdminRecord) => void;
}) {
    const avatarColor = getAvatarColor(subadmin.id);
    const isActive = subadmin.status === 'ACTIVE';

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.28, ease: 'easeOut' }}
            className={`bg-card border rounded-2xl flex flex-col transition-all duration-200 group overflow-hidden
                ${isActive
                    ? 'border-border/50 hover:border-primary/30 hover:shadow-md'
                    : 'border-border/30 opacity-70 hover:opacity-90'
                }`}
        >
            {/* ── Top: Avatar + Name + Status ── */}
            <div className="flex items-start gap-3 p-4 pb-3">
                <div className={`w-12 h-12 rounded-xl ring-2 ring-border shrink-0 flex items-center justify-center ${avatarColor.bg}`}>
                    <span className={`text-base font-bold select-none ${avatarColor.text}`}>
                        {getInitials(subadmin.name)}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">
                            {subadmin.name}
                        </p>
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {subadmin.permissions.length > 0
                            ? `${subadmin.permissions.length} permission${subadmin.permissions.length > 1 ? 's' : ''}`
                            : 'No permissions assigned'
                        }
                    </p>
                </div>
            </div>

            <div className="h-px bg-border/50 mx-4" />

            {/* ── Details ── */}
            <div className="px-4 py-3 space-y-2.5 flex-1">
                <div className="flex items-center gap-2">
                    <Mail size={15} className="shrink-0 text-muted-foreground/60" />
                    <span className="text-[13px] text-muted-foreground w-16 shrink-0">Email</span>
                    <span className="text-[13px] font-medium truncate">{subadmin.email}</span>
                </div>
                <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="shrink-0 text-muted-foreground/60" />
                    <span className="text-[13px] text-muted-foreground w-16 shrink-0">Joined</span>
                    <span className="text-[13px] font-medium truncate">{formatDate(subadmin.createdAt)}</span>
                </div>

                {/* Permissions */}
                {subadmin.permissions.length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Shield size={12} className="text-muted-foreground/60" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                                Permissions
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {subadmin.permissions.map(perm => {
                                const opt = PERMISSION_OPTIONS.find(o => o.key === perm);
                                return (
                                    <span
                                        key={perm}
                                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                    >
                                        <Shield size={9} />
                                        {opt?.label ?? perm}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Footer buttons ── */}
            <div className="px-4 pb-4 pt-2 flex gap-2 mt-auto">
                <button
                    onClick={() => onEdit(subadmin)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
                >
                    <Edit2 size={12} />
                    Edit Permissions
                </button>
                {subadmin.invitePending ? (
                    <button
                        onClick={() => onResendInvite(subadmin)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30 text-xs font-medium transition-all duration-150"
                    >
                        <MailCheck size={12} />
                        Resend Invite
                    </button>
                ) : (
                    <button
                        onClick={() => onToggleStatus(subadmin)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all duration-150 ${isActive
                            ? 'border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30'
                            }`}
                    >
                        {isActive ? <PowerOff size={12} /> : <Power size={12} />}
                        {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                )}
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

    // Form state
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPermissions, setFormPermissions] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        async function fetchData() {
            try {
                const res = await api.get('/admin/subadmins');
                if (!cancelled) setSubadmins(res.data.data ?? []);
            } catch (err: unknown) {
                if (!cancelled) {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                    toast.error(msg ?? 'Failed to load subadmins');
                    setSubadmins([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchData();
        return () => { cancelled = true; };
    }, []);

    const activeCount = subadmins.filter(s => s.status === 'ACTIVE').length;
    const pendingCount = subadmins.filter(s => s.invitePending).length;

    const filtered = search.trim()
        ? subadmins.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.email.toLowerCase().includes(search.toLowerCase())
        )
        : subadmins;

    // ── Open modal helpers ──
    function openAdd() {
        setFormName('');
        setFormEmail('');
        setFormPermissions([]);
        setModal({ type: 'add' });
    }

    function openEdit(subadmin: SubAdminRecord) {
        setFormName(subadmin.name);
        setFormEmail(subadmin.email);
        setFormPermissions([...subadmin.permissions]);
        setModal({ type: 'edit', subadmin });
    }

    function closeModal() {
        setModal({ type: 'closed' });
    }

    function togglePermission(key: string) {
        setFormPermissions(prev =>
            prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
        );
    }

    // ── Handlers ──
    const handleAdd = useCallback(async () => {
        setActionLoading(true);
        try {
            const res = await api.post('/admin/subadmins', {
                name: formName.trim(),
                email: formEmail.trim(),
                permissions: formPermissions,
            });
            setSubadmins(prev => [...prev, res.data.data]);
            toast.success('Subadmin invited successfully');
            closeModal();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to add subadmin');
        } finally { setActionLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formName, formEmail, formPermissions]);

    const handleEditPermissions = useCallback(async () => {
        if (modal.type !== 'edit') return;
        setActionLoading(true);
        try {
            await api.patch(`/admin/subadmins/${modal.subadmin.id}/permissions`, {
                permissions: formPermissions,
            });
            setSubadmins(prev => prev.map(s =>
                s.id === modal.subadmin.id ? { ...s, permissions: formPermissions } : s
            ));
            toast.success('Permissions updated');
            closeModal();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to update permissions');
        } finally { setActionLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modal, formPermissions]);

    const handleToggleStatus = useCallback(async (subadmin: SubAdminRecord) => {
        const isActive = subadmin.status === 'ACTIVE';
        try {
            if (isActive) {
                await api.patch(`/admin/subadmins/${subadmin.id}/deactivate`);
                setSubadmins(prev => prev.map(s =>
                    s.id === subadmin.id ? { ...s, status: 'INACTIVE' } : s
                ));
                toast.success('Subadmin deactivated');
            } else {
                await api.patch(`/admin/subadmins/${subadmin.id}/activate`);
                setSubadmins(prev => prev.map(s =>
                    s.id === subadmin.id ? { ...s, status: 'ACTIVE' } : s
                ));
                toast.success('Subadmin activated');
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to update status');
        }
    }, []);

    const handleResendInvite = useCallback(async (subadmin: SubAdminRecord) => {
        try {
            await api.post(`/admin/subadmins/${subadmin.id}/resend-invite`);
            toast.success('Invite resent successfully');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to resend invite');
        }
    }, []);

    // ── Loading ──
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4 px-2">
                {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
            </div>
        );
    }

    const isModalOpen = modal.type === 'add' || modal.type === 'edit';

    return (
        <div className="flex flex-col" style={{ height: '100%' }}>

            {/* ── STICKY SECTION ── */}
            <div className="sticky top-0 z-20 bg-background space-y-2 pt-0 pb-0">

                {/* Header row */}
                <div className="flex items-center justify-between pt-0 px-1">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Shield size={21} />
                                Subadmins
                            </h1>
                            <p className="text-muted-foreground text-[13px]">
                                {activeCount} active · {pendingCount} pending
                            </p>
                        </div>
                    </div>

                    {/* Right — Search + Add */}
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
                            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            <Plus size={15} />
                            Add Subadmin
                        </button>
                    </div>
                </div>

                <div className="h-px bg-border/60" />
            </div>

            {/* ── SCROLLABLE CARDS ── */}
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
                        {filtered.map((subadmin, i) => (
                            <SubAdminCard
                                key={subadmin.id}
                                subadmin={subadmin}
                                index={i}
                                onEdit={openEdit}
                                onToggleStatus={handleToggleStatus}
                                onResendInvite={handleResendInvite}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Inline Modal ── */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                    onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md"
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                            <div className="flex items-center gap-2">
                                <Shield size={18} className="text-primary" />
                                <h2 className="text-base font-semibold">
                                    {modal.type === 'add' ? 'Add Subadmin' : 'Edit Permissions'}
                                </h2>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-5 py-4 space-y-4">
                            {modal.type === 'add' ? (
                                <>
                                    {/* Name */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            placeholder="e.g. Priya Sharma"
                                            className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                                        />
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={formEmail}
                                            onChange={e => setFormEmail(e.target.value)}
                                            placeholder="e.g. priya@institution.edu.in"
                                            className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                                        />
                                    </div>
                                </>
                            ) : (
                                /* Edit mode: show name read-only */
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Subadmin
                                    </label>
                                    <div className="h-9 px-3 rounded-xl border border-border/40 bg-muted/20 flex items-center">
                                        <span className="text-sm text-muted-foreground">{formName}</span>
                                    </div>
                                </div>
                            )}

                            {/* Permissions */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Permissions
                                </label>
                                <div className="space-y-2">
                                    {PERMISSION_OPTIONS.map(opt => {
                                        const checked = formPermissions.includes(opt.key);
                                        return (
                                            <label
                                                key={opt.key}
                                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${checked
                                                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                                                    : 'border-border/50 hover:border-border hover:bg-muted/30'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => togglePermission(opt.key)}
                                                    className="mt-0.5 accent-indigo-600"
                                                />
                                                <div>
                                                    <p className={`text-sm font-medium ${checked ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                                                        {opt.label}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        {opt.description}
                                                    </p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="px-5 pb-5 flex gap-2 justify-end">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={modal.type === 'add' ? handleAdd : handleEditPermissions}
                                disabled={actionLoading || (modal.type === 'add' && (!formName.trim() || !formEmail.trim()))}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                {actionLoading
                                    ? 'Saving...'
                                    : modal.type === 'add' ? 'Send Invite' : 'Update Permissions'
                                }
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
