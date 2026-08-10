'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {
    Bell, X, CheckCheck, TicketIcon, Star, MessageSquare,
    Building2, CreditCard, UserCheck, Megaphone, ChevronRight,
    BookOpen, AlertTriangle, IndianRupee, Calendar,
    ClipboardList, GraduationCap, Wrench, Sparkles, Bug,
    ShieldAlert, Clock, Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BellNotif {
    id: string;
    recipientId: string;
    title: string;
    subtitle: string;
    time: string;
    read: boolean;
    iconKey: string;
}
interface ApiNotif {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    tag?: string;
}
// Institution-scoped feed (admin/teacher/student) carries a per-recipient id + read state.
interface InstApiNotif extends ApiNotif {
    recipientId: string;
    isRead: boolean;
}

// ─── Icon configs ─────────────────────────────────────────────────────────────

export const ICON_CFG: Record<string, { icon: React.ElementType; iconBg: string; iconColor: string }> = {
    // Broadcast tags
    ANNOUNCEMENT:  { icon: Megaphone,   iconBg: 'bg-violet-100 dark:bg-violet-950/50', iconColor: 'text-violet-600 dark:text-violet-400' },
    MAINTENANCE:   { icon: Wrench,      iconBg: 'bg-amber-100 dark:bg-amber-950/50',   iconColor: 'text-amber-500' },
    UPDATE:        { icon: Bell,        iconBg: 'bg-sky-100 dark:bg-sky-950/50',       iconColor: 'text-sky-500' },
    FEATURE:       { icon: Sparkles,    iconBg: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-500' },
    BUG_FIXED:     { icon: Bug,         iconBg: 'bg-green-100 dark:bg-green-950/50',   iconColor: 'text-green-600' },
    PLAN_EXPIRY:   { icon: CreditCard,  iconBg: 'bg-red-100 dark:bg-red-950/50',       iconColor: 'text-red-500' },
    SECURITY:      { icon: ShieldAlert, iconBg: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-500' },
    TRIAL:         { icon: Clock,       iconBg: 'bg-blue-100 dark:bg-blue-950/50',     iconColor: 'text-blue-500' },
    SYSTEM:        { icon: Bell,        iconBg: 'bg-muted',                            iconColor: 'text-muted-foreground' },
    // Superadmin activity types (used by mock data for other roles)
    NEW_TICKET:            { icon: TicketIcon,   iconBg: 'bg-red-100 dark:bg-red-950/50',        iconColor: 'text-red-500' },
    NEW_REVIEW:            { icon: Star,         iconBg: 'bg-amber-100 dark:bg-amber-950/50',    iconColor: 'text-amber-500' },
    TICKET_REPLY:          { icon: MessageSquare,iconBg: 'bg-blue-100 dark:bg-blue-950/50',      iconColor: 'text-blue-500' },
    NEW_INSTITUTION:       { icon: Building2,    iconBg: 'bg-violet-100 dark:bg-[#7C3AED]/20',  iconColor: 'text-violet-600 dark:text-violet-400' },
    PLAN_EXPIRING:         { icon: CreditCard,   iconBg: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-500' },
    ADMIN_STATUS:          { icon: UserCheck,    iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',iconColor: 'text-emerald-500' },
    BROADCAST_SENT:        { icon: Megaphone,    iconBg: 'bg-sky-100 dark:bg-sky-950/50',       iconColor: 'text-sky-500' },
    SYSTEM_UPDATE:         { icon: Bell,         iconBg: 'bg-sky-100 dark:bg-sky-950/50',       iconColor: 'text-sky-500' },
    STUDENT_ENROLLED:      { icon: GraduationCap,iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',iconColor: 'text-emerald-500' },
    TEST_PUBLISHED:        { icon: BookOpen,     iconBg: 'bg-violet-100 dark:bg-[#7C3AED]/20',  iconColor: 'text-violet-600 dark:text-violet-400' },
    PLAN_EXPIRY_ADMIN:     { icon: CreditCard,   iconBg: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-500' },
    ASSIGNMENT_SUBMITTED:  { icon: ClipboardList,iconBg: 'bg-violet-100 dark:bg-[#7C3AED]/20',  iconColor: 'text-violet-600 dark:text-violet-400' },
    TEST_SCHEDULED:        { icon: Calendar,     iconBg: 'bg-blue-100 dark:bg-blue-950/50',     iconColor: 'text-blue-500' },
    STUDENT_FLAGGED:       { icon: AlertTriangle,iconBg: 'bg-red-100 dark:bg-red-950/50',       iconColor: 'text-red-500' },
    EXAM_REMINDER:         { icon: Calendar,     iconBg: 'bg-red-100 dark:bg-red-950/50',       iconColor: 'text-red-500' },
    RESULT_PUBLISHED:      { icon: BookOpen,     iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',iconColor: 'text-emerald-500' },
    ATTENDANCE_WARNING:    { icon: AlertTriangle,iconBg: 'bg-amber-100 dark:bg-amber-950/50',   iconColor: 'text-amber-500' },
    FEE_DUE:               { icon: IndianRupee,  iconBg: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-500' },
    ANNOUNCEMENT_ADMIN:    { icon: Megaphone,    iconBg: 'bg-sky-100 dark:bg-sky-950/50',       iconColor: 'text-sky-500' },
};

export function getIconCfg(key: string) {
    return ICON_CFG[key] ?? ICON_CFG['SYSTEM'];
}

export function relativeTimeStr(dateStr: string): string {
    return relativeTime(dateStr);
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const SA_LAST_SEEN_KEY = 'sa-notifs-last-seen';

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationsBell({ restrictNav, lockMessage }: { restrictNav?: boolean; lockMessage?: string } = {}) {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState<BellNotif[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const isSuperAdmin = pathname.startsWith('/superadmin');
    // Teachers don't get notifications — the bell is hidden for them entirely.
    const isTeacher = pathname.startsWith('/teacher');
    // Admin and student share one institution-scoped notification API, with real
    // per-recipient read state on the backend.
    const roleBase =
        pathname.startsWith('/admin')   ? '/admin'   :
        pathname.startsWith('/student') ? '/student' :
        null;

    // Superadmin's feed has no per-recipient read state, so unread is tracked
    // against a "last seen" timestamp instead.
    const [lastSeen, setLastSeen] = useState<Date | null>(() => {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(SA_LAST_SEEN_KEY);
        return raw ? new Date(raw) : null;
    });

    const fetchSANotifs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/superadmin/notifications/feed', { params: { limit: 15 } });
            const raw: ApiNotif[] = res.data?.notifications ?? [];
            const seen = lastSeen;
            const mapped: BellNotif[] = raw.map(n => ({
                id: n.id,
                recipientId: n.id,
                title: n.title,
                subtitle: n.message,
                time: relativeTime(n.createdAt),
                read: seen ? new Date(n.createdAt) <= seen : false,
                iconKey: n.tag ?? 'SYSTEM',
            }));
            setNotifs(mapped);
            setUnreadCount(mapped.filter(n => !n.read).length);
        } catch {
            // fail silently — bell just shows empty
        } finally {
            setLoading(false);
        }
    }, [lastSeen]);

    const fetchInstitutionNotifs = useCallback(async () => {
        if (!roleBase) return;
        setLoading(true);
        try {
            const res = await api.get(`${roleBase}/notifications`, { params: { page: 1, limit: 10 } });
            const raw: InstApiNotif[] = res.data?.notifications ?? [];
            const mapped: BellNotif[] = raw.map(n => ({
                id: n.id,
                recipientId: n.recipientId,
                title: n.title,
                subtitle: n.message,
                time: relativeTime(n.createdAt),
                read: n.isRead,
                iconKey: n.tag ?? 'SYSTEM',
            }));
            setNotifs(mapped);
            setUnreadCount(res.data?.unreadCount ?? mapped.filter(n => !n.read).length);
        } catch {
            // fail silently — bell just shows empty
        } finally {
            setLoading(false);
        }
    }, [roleBase]);

    const refresh = useCallback(() => {
        if (isSuperAdmin) return fetchSANotifs();
        if (roleBase) return fetchInstitutionNotifs();
    }, [isSuperAdmin, roleBase, fetchSANotifs, fetchInstitutionNotifs]);

    // Initial fetch + poll so the unread dot surfaces everywhere when a new
    // notification arrives, without needing a page navigation/reload.
    useEffect(() => {
        void refresh();
        const interval = setInterval(() => { void refresh(); }, 30000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleOpen = () => {
        setOpen(true);
        void refresh();
    };

    const handleClose = () => {
        setOpen(false);
        if (isSuperAdmin) {
            const now = new Date();
            localStorage.setItem(SA_LAST_SEEN_KEY, now.toISOString());
            setLastSeen(now);
            setNotifs(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        }
    };

    const markAllRead = async () => {
        setNotifs(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        if (isSuperAdmin) {
            const now = new Date();
            localStorage.setItem(SA_LAST_SEEN_KEY, now.toISOString());
            setLastSeen(now);
            return;
        }
        if (roleBase) {
            try { await api.patch(`${roleBase}/notifications/read-all`); } catch { void refresh(); }
        }
    };

    const markRead = async (recipientId: string) => {
        let wasUnread = false;
        setNotifs(prev => prev.map(n => {
            if (n.recipientId === recipientId && !n.read) { wasUnread = true; return { ...n, read: true }; }
            return n;
        }));
        if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
        if (isSuperAdmin || !roleBase) return;
        try { await api.patch(`${roleBase}/notifications/${recipientId}/read`); } catch { void refresh(); }
    };

    const handleViewAll = () => {
        handleClose();
        if (isSuperAdmin) router.push('/superadmin/notifications');
        else if (roleBase === '/admin') router.push('/admin/notifications');
    };

    const hasViewAllPage = isSuperAdmin || roleBase === '/admin';

    // Teachers have no notifications — don't render the bell at all.
    if (isTeacher) return null;

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={restrictNav ? () => toast.error(lockMessage ?? 'Navigation is locked') : (open ? handleClose : handleOpen)}
                className={`relative h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${restrictNav ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50'}`}
            >
                <Bell size={18} className="text-muted-foreground" />
                {!restrictNav && unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Backdrop */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={handleClose}
                    />
                )}
            </AnimatePresence>

            {/* Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute right-0 top-11 z-50 w-[calc(100vw-2rem)] max-w-[380px] bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">Notifications</p>
                                {unreadCount > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead}
                                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                                        <CheckCheck size={13} />
                                        Mark all read
                                    </button>
                                )}
                                <button onClick={handleClose}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
                                    <X size={13} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/30">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={22} className="text-muted-foreground animate-spin" />
                                </div>
                            ) : notifs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Bell size={28} className="text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium text-muted-foreground">No notifications</p>
                                    {isSuperAdmin && (
                                        <p className="text-xs text-muted-foreground/60 mt-1">Broadcast a notification to see it here</p>
                                    )}
                                </div>
                            ) : (
                                notifs.map(notif => {
                                    const cfg = getIconCfg(notif.iconKey);
                                    const Icon = cfg.icon;
                                    return (
                                        <motion.button
                                            key={notif.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            onClick={() => markRead(notif.recipientId)}
                                            className={`w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconBg}`}>
                                                <Icon size={14} className={cfg.iconColor} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs leading-snug ${!notif.read ? 'font-semibold' : 'font-medium'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                                                    {notif.subtitle}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/70 mt-1">{notif.time}</p>
                                            </div>
                                            {!notif.read && (
                                                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                            )}
                                        </motion.button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        {hasViewAllPage && (
                            <div className="border-t border-border/50 px-4 py-3">
                                <button
                                    onClick={handleViewAll}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                    View all notifications
                                    <ChevronRight size={13} />
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
