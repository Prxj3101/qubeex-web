'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    User, Mail, KeyRound, Eye, EyeOff, Check, X,
    Calendar, Clock, Monitor, MapPin, LogOut, AlertTriangle,
    Edit3, Save, RefreshCw, ShieldCheck, Hash,
    Activity, Lock, Settings, Palette, ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { readCachedBranding, writeCachedBranding } from '@/lib/brandingCache';
import { readCachedInstType } from '@/lib/instTypeCache';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIST(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        ...opts,
    });
}

type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong' | null;

function calculateStrength(password: string): { level: PasswordStrength; score: number; checks: Record<string, boolean> } {
    const checks = {
        length: password.length >= 8,
        lengthStrong: password.length >= 12,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length;
    let level: PasswordStrength = null;
    if (password.length === 0) level = null;
    else if (score <= 2) level = 'weak';
    else if (score <= 3) level = 'medium';
    else if (score <= 4) level = 'strong';
    else level = 'very-strong';
    return { level, score, checks };
}

// Swatch hex mirrors each preset's light-mode --primary in globals.css —
// keep these in sync manually if a preset's color ever changes there.
const THEME_PRESETS: { id: string; label: string; swatch: string }[] = [
    { id: 'purple', label: 'Purple', swatch: '#7C3AED' },
    { id: 'blue', label: 'Blue', swatch: '#3970E0' },
    { id: 'teal', label: 'Teal', swatch: '#009999' },
    { id: 'amber', label: 'Amber', swatch: '#ED9A1F' },
    { id: 'rose', label: 'Rose', swatch: '#DC2626' },
    { id: 'indigo', label: 'Indigo', swatch: '#4F46E5' },
    { id: 'slate', label: 'Slate', swatch: '#475569' },
];

const strengthConfig = {
    weak: { label: 'Weak', color: 'bg-red-500', text: 'text-red-500', width: '25%' },
    medium: { label: 'Medium', color: 'bg-amber-500', text: 'text-amber-500', width: '50%' },
    strong: { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500', width: '75%' },
    'very-strong': { label: 'Very Strong', color: 'bg-violet-500', text: 'text-violet-500', width: '100%' },
};

type LoginActivity = {
    id: string;
    device: string;
    ip: string;
    location: string;
    time: string;
    latest: boolean;
    userAgent?: string | null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, description, children, action }: {
    title: string;
    icon: React.ElementType;
    description?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden" data-admin-surface="">
            <div className="bg-muted/20 px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-[#7C3AED]/25 flex items-center justify-center shrink-0">
                        <Icon size={15} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{title}</p>
                        {description && <p className="text-[11px] text-muted-foreground truncate">{description}</p>}
                    </div>
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function FieldRow({ icon: Icon, label, value, editing, onChange, type = 'text', placeholder }: {
    icon: React.ElementType;
    label: string;
    value: string;
    editing: boolean;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
}) {
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-none">
            <Icon size={15} className="shrink-0 text-muted-foreground/60" />
            <span className="text-[13px] text-muted-foreground w-28 shrink-0">{label}</span>
            {editing ? (
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 h-8 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50 transition-all"
                />
            ) : (
                <span className="text-[13px] font-medium truncate flex-1">{value || '—'}</span>
            )}
        </div>
    );
}

// Miniature 1:1 mockup of the real app chrome (Topbar.tsx's rounded header +
// pill nav row) plus a couple of SectionCard-style content blocks, tinted
// with the preset's accent color — same idea as Slack's sidebar-theme picker
// cards, just built to mirror our own layout instead of a generic one.
function ThemeMiniPreview({ color }: { color: string }) {
    return (
        <div className="w-full aspect-[4/3] rounded-xl bg-background p-1.5 flex flex-col gap-1 overflow-hidden" data-admin-surface="">
            {/* main topbar — neutral logo spot + brand line on the left, bell/toggle/avatar spot on the right (no accent here, same as the real Topbar) */}
            <div className="h-4 rounded-full bg-card flex items-center justify-between px-1.5 shrink-0">
                <div className="flex items-center gap-1 min-w-0">
                    <span className="w-2 h-2 rounded-[3px] shrink-0 bg-muted-foreground/30" />
                    <span className="h-[3px] w-6 rounded-full bg-foreground/25 shrink-0" />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                </div>
            </div>
            {/* pill nav — only the active item gets an accent pill; the rest are plain
                muted text, same as the real Topbar (one bg-primary chip, everything
                else transparent) */}
            <div className="h-3.5 rounded-full bg-foreground/[0.07] flex items-center px-1 shrink-0 w-[60%] overflow-hidden">
                <span className="h-2 w-6 rounded-full shrink-0" style={{ background: color }} />
            </div>
            {/* secondary pill nav — same style, half the width, active chip on the right */}
            <div className="h-3.5 rounded-full bg-foreground/[0.07] flex items-center justify-end px-1 shrink-0 w-[30%] overflow-hidden">
                <span className="h-2 w-4 rounded-full shrink-0" style={{ background: color }} />
            </div>
            {/* content — two SectionCard-style blocks: icon chip + text lines */}
            <div className="flex-1 grid grid-cols-2 gap-1">
                {[0, 1].map((i) => (
                    <div key={i} className="rounded-lg bg-card shadow-sm p-1 flex flex-col gap-1 justify-center">
                        <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: `${color}40` }} />
                        <span className="h-[3px] w-full rounded-full bg-muted-foreground/20" />
                        <span className="h-[3px] w-2/3 rounded-full bg-muted-foreground/15" />
                    </div>
                ))}
            </div>
        </div>
    );
}

function PasswordInput({ value, onChange, placeholder, show, onToggleShow, disabled }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    show: boolean;
    onToggleShow: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full h-10 pl-9 pr-10 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
                type="button"
                onClick={onToggleShow}
                disabled={disabled}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSettingsPageClient() {
    const { clearAuth, user } = useAuthStore();
    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const router = useRouter();

    // ── Profile data ──
    const [profileLoading, setProfileLoading] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [profileCreatedAt, setProfileCreatedAt] = useState<string | null>(null);

    // ── Theme customization — PRO + TRIAL only, admin-only (not sub-admins) ──
    const [isCollegeInstitution, setIsCollegeInstitution] = useState(false);
    const [themeColor, setThemeColor] = useState('purple');
    const [themeCustomizationEligible, setThemeCustomizationEligible] = useState(false);
    const [themeSaving, setThemeSaving] = useState<string | null>(null);

    // Apply the synchronous localStorage caches (same ones used elsewhere for
    // FOUC avoidance — see instTypeCache.ts / brandingCache.ts) in a
    // useLayoutEffect rather than a lazy useState initializer. A lazy
    // initializer runs during the client's hydration render too, and the
    // server has no localStorage to match it against — 'purple'/non-college
    // there vs 'blue'/college here — which is exactly what caused the
    // "Encountered a script tag" + hydration-mismatch errors on this page.
    // useLayoutEffect runs after hydration reconciles (so no mismatch) but
    // before the browser paints (so no visible flash) — same fix already
    // applied to BrandingContext.tsx for the same class of bug.
    useLayoutEffect(() => {
        const cachedIsCollege = readCachedInstType() === 'COLLEGE';
        const cachedTheme = readCachedBranding().themeColor || 'purple';
        setIsCollegeInstitution(cachedIsCollege);
        setThemeColor(cachedIsCollege && cachedTheme === 'purple' ? 'blue' : cachedTheme);
    }, []);

    // ── Personal details edit ──
    const [editing, setEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [snapshot, setSnapshot] = useState({ name: '', email: '' });

    // ── Login activity ──
    const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);
    const [activityLoading, setActivityLoading] = useState(true);

    // ── Password change ──
    const [oldPwd, setOldPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [savingPwd, setSavingPwd] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showSignOutAllConfirm, setShowSignOutAllConfirm] = useState(false);

    const strength = useMemo(() => calculateStrength(newPwd), [newPwd]);
    const passwordsMatch = confirmPwd.length > 0 && newPwd === confirmPwd;
    const passwordsMismatch = confirmPwd.length > 0 && newPwd !== confirmPwd;
    const samePwd = oldPwd.length > 0 && newPwd.length > 0 && oldPwd === newPwd;

    const canSubmitPwd =
        oldPwd.length > 0 &&
        newPwd.length >= 8 &&
        passwordsMatch &&
        !samePwd &&
        (strength.level === 'medium' || strength.level === 'strong' || strength.level === 'very-strong');

    // ── Fetch on mount ──
    const fetchedProfile = useRef(false);
    const fetchedActivity = useRef(false);

    useEffect(() => {
        if (fetchedProfile.current) return;
        fetchedProfile.current = true;
        const load = async () => {
            try {
                setProfileLoading(true);
                const res = await api.get('/admin/profile');
                const p = res.data.data;
                setName(p.name ?? '');
                setEmail(p.email ?? '');
                setProfileCreatedAt(p.createdAt ?? null);
                setSnapshot({ name: p.name ?? '', email: p.email ?? '' });
            } catch {
                toast.error('Failed to load profile');
            } finally {
                setProfileLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (fetchedActivity.current) return;
        fetchedActivity.current = true;
        const load = async () => {
            try {
                setActivityLoading(true);
                const res = await api.get('/admin/profile/login-activity?limit=5');
                setLoginActivity(res.data.data ?? []);
            } catch {
                // non-blocking
            } finally {
                setActivityLoading(false);
            }
        };
        load();
    }, []);

    // Sub-admins never see the theme picker, so skip the fetch entirely for them.
    const fetchedTheme = useRef(false);
    useEffect(() => {
        if (isSubAdmin || fetchedTheme.current) return;
        fetchedTheme.current = true;
        api.get('/admin/me')
            .then((res) => {
                const d = res.data?.data ?? res.data;
                // College institutions render blue by default via the
                // `.theme-college` CSS class, applied unconditionally
                // regardless of the `themeColor` DB field (which defaults to
                // the string "purple" for every institution, college or not
                // — see prisma schema.prisma). So a college that's never
                // touched this picker actually SHOWS blue, but the field
                // read literally says "purple" — highlighting Purple here
                // would contradict what's on screen. Only treat that
                // untouched-default case as blue; once a college admin
                // explicitly picks a color themselves, respect it as-is.
                const rawTheme = d?.themeColor ?? 'purple';
                const isCollege = String(d?.type ?? '').toUpperCase() === 'COLLEGE';
                setIsCollegeInstitution(isCollege);
                setThemeColor(isCollege && rawTheme === 'purple' ? 'blue' : rawTheme);
                setThemeCustomizationEligible(!!d?.themeCustomizationEligible);
            })
            .catch(() => { /* non-critical */ });
    }, [isSubAdmin]);

    // College institutions default to Blue (see .theme-college in
    // globals.css), so Blue should lead the picker for them with Purple
    // second — the reverse of every other institution type, where Purple
    // (the actual app-wide default) leads.
    const orderedThemePresets = useMemo(() => {
        if (!isCollegeInstitution) return THEME_PRESETS;
        const purpleIdx = THEME_PRESETS.findIndex(p => p.id === 'purple');
        const blueIdx = THEME_PRESETS.findIndex(p => p.id === 'blue');
        if (purpleIdx === -1 || blueIdx === -1) return THEME_PRESETS;
        const swapped = [...THEME_PRESETS];
        [swapped[purpleIdx], swapped[blueIdx]] = [swapped[blueIdx], swapped[purpleIdx]];
        return swapped;
    }, [isCollegeInstitution]);

    // ── Handlers ──

    const handleStartEdit = () => {
        setSnapshot({ name, email });
        setEditing(true);
    };

    const handleCancelEdit = () => {
        setName(snapshot.name);
        setEmail(snapshot.email);
        setEditing(false);
    };

    const handleSaveProfile = async () => {
        if (!name.trim()) return toast.error('Name is required');
        if (!email.trim()) return toast.error('Email is required');
        try {
            setSavingProfile(true);
            await api.put('/admin/profile', { name, email });
            setEditing(false);
            setSnapshot({ name, email });
            toast.success('Profile updated successfully');
        } catch (e: unknown) {
            toast.error(getErrorMessage(e, 'Failed to update profile'));
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        if (!canSubmitPwd) return;
        try {
            setSavingPwd(true);
            await api.put('/admin/profile/password', { oldPassword: oldPwd, newPassword: newPwd });
            setOldPwd(''); setNewPwd(''); setConfirmPwd('');
            setShowOld(false); setShowNew(false); setShowConfirm(false);
            toast.success('Password changed successfully');
        } catch (e: unknown) {
            toast.error(getErrorMessage(e, 'Failed to change password'));
        } finally {
            setSavingPwd(false);
        }
    };

    const handleLogout = () => {
        clearAuth();
        router.replace('/login');
        api.post('/auth/logout').catch(() => {});
    };

    const handleThemeSelect = async (id: string) => {
        if (isSubAdmin) return;
        if (id === themeColor) return;
        if (!themeCustomizationEligible) {
            toast.error('Theme customization needs Pro', {
                description: 'Upgrade to Pro (or start a trial) to change your accent color.',
                action: { label: 'Upgrade', onClick: () => router.push('/admin/insights/subscription') },
            });
            return;
        }
        setThemeSaving(id);
        try {
            await api.patch('/admin/institution', { themeColor: id });
            setThemeColor(id);
            if (id === 'purple') document.documentElement.removeAttribute('data-theme');
            else document.documentElement.setAttribute('data-theme', id);
            // Persist to the qubeex_theme cookie immediately — BrandingContext only
            // re-fetches /branding once per session (on mount), so without this the
            // cookie stays stale until that next fetch happens to land, and every
            // refresh in between renders the OLD theme color first (visible flash)
            // before client JS catches up and flips it. Writing it here closes that gap.
            writeCachedBranding({ ...readCachedBranding(), themeColor: id });
            toast.success('Theme updated');
        } catch {
            toast.error('Failed to update theme');
        } finally {
            setThemeSaving(null);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── STICKY HEADER ── */}
            <div className="sticky top-0 z-20 bg-background shrink-0">
                <div className="flex items-center justify-between pt-0 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Settings size={21} />
                            Settings
                        </h1>
                        <p className="text-[13px] text-muted-foreground">Manage your account and security</p>
                    </div>
                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="flex items-center gap-2 h-9 px-4 rounded-xl border border-red-200 dark:border-red-900/50 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all active:scale-95"
                    >
                        <LogOut size={14} />
                        Log out
                    </button>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* ── SCROLLABLE BODY ── */}
            <div className="flex-1 min-h-0 overflow-y-auto pb-6 px-1 pt-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ── LEFT COLUMN ── */}
                    <div className="space-y-4">

                        {/* Personal Details */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
                            <SectionCard
                                title="Personal Details"
                                icon={User}
                                description="Your basic information"
                            >
                                {profileLoading ? (
                                    <div className="space-y-3 py-1">
                                        {[1, 2].map(i => <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />)}
                                    </div>
                                ) : (
                                    <div className="space-y-0">
                                        <FieldRow icon={User} label="Full Name" value={name} editing={editing} onChange={setName} placeholder="Enter your name" />
                                        <FieldRow icon={Mail} label="Email" value={email} editing={editing} onChange={setEmail} type="email" placeholder="you@example.com" />
                                    </div>
                                )}
                            </SectionCard>
                        </motion.div>

                        {/* Account Information */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
                            <SectionCard title="Account Information" icon={Hash} description="Read-only system details">
                                {profileLoading ? (
                                    <div className="space-y-3 py-1">
                                        {[1, 2, 3].map(i => <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />)}
                                    </div>
                                ) : (
                                    <div className="space-y-0">
                                        <div className="flex items-center gap-3 py-2.5 border-b border-border/40">
                                            <Calendar size={15} className="shrink-0 text-muted-foreground/60" />
                                            <span className="text-[13px] text-muted-foreground w-28 shrink-0">Member Since</span>
                                            <span className="text-[13px] font-medium">{toIST(profileCreatedAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 py-2.5 border-b border-border/40">
                                            <Activity size={15} className="shrink-0 text-muted-foreground/60" />
                                            <span className="text-[13px] text-muted-foreground w-28 shrink-0">Last Login</span>
                                            <span className="text-[13px] font-medium">
                                                {activityLoading ? '...' : loginActivity[0] ? toIST(loginActivity[0].time) : '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 py-2.5 border-b border-border/40">
                                            <Monitor size={15} className="shrink-0 text-muted-foreground/60" />
                                            <span className="text-[13px] text-muted-foreground w-28 shrink-0">Last Device</span>
                                            <span className="text-[13px] font-medium truncate">
                                                {activityLoading ? '...' : loginActivity[0]?.device ?? '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 py-2.5">
                                            <MapPin size={15} className="shrink-0 text-muted-foreground/60" />
                                            <span className="text-[13px] text-muted-foreground w-28 shrink-0">Last IP</span>
                                            <span className="text-[13px] font-mono">
                                                {activityLoading ? '...' : loginActivity[0]?.ip ?? '—'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </SectionCard>
                        </motion.div>

                        {/* Theme — PRO/TRIAL self-service accent color, admin-only */}
                        {!isSubAdmin && (
                            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
                                <SectionCard
                                    title="Theme"
                                    icon={Palette}
                                    description={themeCustomizationEligible
                                        ? 'Pick an accent color for your admin, teacher and student app'
                                        : 'Upgrade to Pro to customize your accent color'}
                                >
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {orderedThemePresets.map((preset) => {
                                            const active = themeColor === preset.id;
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => handleThemeSelect(preset.id)}
                                                    disabled={themeSaving !== null}
                                                    className="flex flex-col items-center gap-1.5 group text-left"
                                                >
                                                    <div
                                                        className="relative w-full rounded-xl p-0.5 transition-all"
                                                        style={{
                                                            boxShadow: active ? `0 0 0 2px ${preset.swatch}` : '0 0 0 1px var(--border)',
                                                        }}
                                                    >
                                                        <ThemeMiniPreview color={preset.swatch} />
                                                        {themeSaving === preset.id && (
                                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
                                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            </div>
                                                        )}
                                                        {!themeCustomizationEligible && !active && themeSaving === null && (
                                                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Lock size={14} className="text-white drop-shadow" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="flex items-center gap-1.5">
                                                        <span
                                                            className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                                                            style={{ borderColor: active ? preset.swatch : 'var(--border)' }}
                                                        >
                                                            {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: preset.swatch }} />}
                                                        </span>
                                                        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                                            {preset.label}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {!themeCustomizationEligible && (
                                        <button
                                            onClick={() => router.push('/admin/insights/subscription')}
                                            className="mt-3 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                                        >
                                            <Palette size={11} /> Upgrade to Pro <ArrowUpRight size={11} />
                                        </button>
                                    )}
                                </SectionCard>
                            </motion.div>
                        )}
                    </div>

                    {/* ── RIGHT COLUMN ── */}
                    <div className="space-y-4">

                        {/* Change Password */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
                            <SectionCard title="Change Password" icon={KeyRound} description="You must remember your current password">
                                <div className="space-y-3.5">
                                    <div>
                                        <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Current Password</label>
                                        <PasswordInput value={oldPwd} onChange={setOldPwd} placeholder="Enter your current password" show={showOld} onToggleShow={() => setShowOld(s => !s)} />
                                    </div>

                                    <div>
                                        <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">New Password</label>
                                        <PasswordInput value={newPwd} onChange={setNewPwd} placeholder="Enter a strong new password" show={showNew} onToggleShow={() => setShowNew(s => !s)} disabled={oldPwd.length === 0} />

                                        <AnimatePresence>
                                            {newPwd.length > 0 && strength.level && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <motion.div animate={{ width: strengthConfig[strength.level].width }} transition={{ duration: 0.3 }} className={`h-full rounded-full ${strengthConfig[strength.level].color}`} />
                                                        </div>
                                                        <span className={`text-[11px] font-semibold ${strengthConfig[strength.level].text}`}>{strengthConfig[strength.level].label}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                                        {[
                                                            { key: 'length', label: 'At least 8 characters' },
                                                            { key: 'upper', label: 'Uppercase letter' },
                                                            { key: 'lower', label: 'Lowercase letter' },
                                                            { key: 'number', label: 'Number' },
                                                            { key: 'special', label: 'Special character' },
                                                        ].map(c => {
                                                            const ok = strength.checks[c.key as keyof typeof strength.checks];
                                                            return (
                                                                <div key={c.key} className="flex items-center gap-1.5">
                                                                    {ok ? <Check size={11} className="text-emerald-500" /> : <X size={11} className="text-muted-foreground/40" />}
                                                                    <span className={`text-[10.5px] ${ok ? 'text-foreground' : 'text-muted-foreground/60'}`}>{c.label}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {samePwd && (
                                            <p className="text-[11px] text-amber-500 mt-1.5 flex items-center gap-1">
                                                <AlertTriangle size={11} /> New password must be different from current
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Confirm New Password</label>
                                        <div className="relative">
                                            <PasswordInput value={confirmPwd} onChange={setConfirmPwd} placeholder="Re-enter the new password" show={showConfirm} onToggleShow={() => setShowConfirm(s => !s)} disabled={oldPwd.length === 0 || newPwd.length === 0} />
                                            {confirmPwd.length > 0 && (
                                                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                                    {passwordsMatch ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-red-500" />}
                                                </div>
                                            )}
                                        </div>
                                        {passwordsMismatch && (
                                            <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
                                                <X size={11} /> Passwords do not match
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleChangePassword}
                                        disabled={!canSubmitPwd || savingPwd}
                                        className="w-full flex items-center justify-center h-10 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                    >
                                        {savingPwd
                                            ? <><RefreshCw size={14} className="mr-2 animate-spin" /> Updating...</>
                                            : <><ShieldCheck size={14} className="mr-2" /> Update Password</>
                                        }
                                    </button>
                                </div>
                            </SectionCard>
                        </motion.div>

                        {/* Recent Login Activity */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
                            <SectionCard title="Recent Login Activity" icon={Activity} description="Sessions in the last 30 days">
                                <div className="space-y-0">
                                    {activityLoading ? (
                                        [...Array(3)].map((_, i) => (
                                            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-none">
                                                <div className="w-8 h-8 rounded-lg bg-muted animate-pulse shrink-0" />
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="h-3 bg-muted animate-pulse rounded w-40" />
                                                    <div className="h-2.5 bg-muted animate-pulse rounded w-56" />
                                                </div>
                                            </div>
                                        ))
                                    ) : loginActivity.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-8 text-center">No login activity found</p>
                                    ) : loginActivity.map((session, idx) => (
                                        <div key={session.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-none">
                                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                <Monitor size={14} className="text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[13px] font-medium truncate">{session.device}</p>
                                                    {idx === 0 && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                                                            LATEST
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                                                    <span className="flex items-center gap-1"><MapPin size={10} />{session.location}</span>
                                                    <span className="text-muted-foreground/40">·</span>
                                                    <span className="font-mono">{session.ip}</span>
                                                    <span className="text-muted-foreground/40">·</span>
                                                    <span className="flex items-center gap-1"><Clock size={10} />{toIST(session.time)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </motion.div>

                        {/* Danger Zone */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}
                            className="bg-card border border-red-200 dark:border-red-900/50 rounded-2xl overflow-hidden" data-admin-surface=""
                        >
                            <div className="bg-red-50/50 dark:bg-red-950/20 px-5 py-4 border-b border-red-200 dark:border-red-900/50 flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
                                    <AlertTriangle size={15} className="text-red-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</p>
                                    <p className="text-[11px] text-red-500/80">Irreversible actions</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Sign out from all devices</p>
                                        <p className="text-[11px] text-muted-foreground">Invalidates your session everywhere — you&apos;ll need to sign in again</p>
                                    </div>
                                    <button
                                        onClick={() => setShowSignOutAllConfirm(true)}
                                        className="flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95 shrink-0"
                                    >
                                        <LogOut size={13} />
                                        Sign out everywhere
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── Sign Out All Confirm ── */}
            <AnimatePresence>
                {showSignOutAllConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowSignOutAllConfirm(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ duration: 0.18 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-card border border-border/50 rounded-2xl shadow-xl p-6 w-80 mx-4"
                        >
                            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
                                <AlertTriangle size={20} className="text-red-500" />
                            </div>
                            <h3 className="text-base font-semibold mb-1">Sign out everywhere?</h3>
                            <p className="text-[13px] text-muted-foreground mb-5">This will invalidate your session on all devices. You&apos;ll need to sign in again on each one.</p>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setShowSignOutAllConfirm(false)}>
                                    Cancel
                                </Button>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 h-9 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95"
                                >
                                    Sign out all
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Logout Confirm ── */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowLogoutConfirm(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ duration: 0.18 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-card border border-border/50 rounded-2xl shadow-xl p-6 w-80 mx-4"
                        >
                            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
                                <LogOut size={20} className="text-red-500" />
                            </div>
                            <h3 className="text-base font-semibold mb-1">Log out?</h3>
                            <p className="text-[13px] text-muted-foreground mb-5">You will be signed out of your account and redirected to the login page.</p>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setShowLogoutConfirm(false)}>
                                    Cancel
                                </Button>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 h-9 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95"
                                >
                                    Log out
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
