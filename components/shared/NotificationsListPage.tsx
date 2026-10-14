'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, RefreshCw, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { getIconCfg, relativeTimeStr } from '@/components/shared/NotificationsBell';

// ─── Types ────────────────────────────────────────────────────────────────────

type Notif = {
    recipientId: string;
    id: string;
    title: string;
    message: string;
    tag: string;
    createdAt: string;
    isRead: boolean;
};

type Pagination = { total: number; page: number; limit: number; pages: number };

const PAGE_SIZE = 20;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
    return (
        <div className="flex items-start gap-4 px-5 py-4 border-b border-border/40 last:border-none animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/4" />
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Shared "view all notifications" page for the institution-scoped roles
 * (admin/teacher/student), all backed by the same notifications.controller.ts
 * endpoints. Unlike the older admin-only page, this uses the real per-recipient
 * `isRead`/`recipientId` fields the API already returns, instead of a
 * localStorage "last seen" timestamp.
 */
export function NotificationsListPage({ roleBase }: { roleBase: '/teacher' | '/student' }) {
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: PAGE_SIZE, pages: 0 });
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const fetchedRef = useRef(false);

    const fetchNotifs = useCallback(async (currentPage: number) => {
        setLoading(true);
        try {
            const res = await api.get(`${roleBase}/notifications`, { params: { page: currentPage, limit: PAGE_SIZE } });
            setNotifs(res.data?.notifications ?? []);
            setUnreadCount(res.data?.unreadCount ?? 0);
            setPagination({
                total: res.data?.total ?? 0,
                page: res.data?.page ?? currentPage,
                limit: res.data?.limit ?? PAGE_SIZE,
                pages: res.data?.pages ?? 0,
            });
        } catch {
            // fail silently — shows empty state
        } finally {
            setLoading(false);
        }
    }, [roleBase]);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        void fetchNotifs(1);
    }, [fetchNotifs]);

    useEffect(() => {
        if (!fetchedRef.current) return;
        void fetchNotifs(page);
    }, [page, fetchNotifs]);

    const markAllRead = async () => {
        setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        try {
            await api.patch(`${roleBase}/notifications/read-all`);
        } catch {
            void fetchNotifs(page);
        }
    };

    const markRead = async (recipientId: string) => {
        let wasUnread = false;
        setNotifs(prev => prev.map(n => {
            if (n.recipientId === recipientId && !n.isRead) { wasUnread = true; return { ...n, isRead: true }; }
            return n;
        }));
        if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
        try {
            await api.patch(`${roleBase}/notifications/${recipientId}/read`);
        } catch {
            void fetchNotifs(page);
        }
    };

    const handleRefresh = () => void fetchNotifs(page);

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-3 pt-1 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Bell size={21} />
                            Notifications
                            {unreadCount > 0 && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                                    {unreadCount} new
                                </span>
                            )}
                        </h1>
                        <p className="text-muted-foreground text-[13px]">
                            {pagination.total > 0
                                ? `${pagination.total.toLocaleString('en-IN')} total notifications`
                                : 'Updates and alerts from QubeEx'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {unreadCount > 0 && (
                            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5 text-xs h-9">
                                <CheckCheck size={14} />
                                Mark all read
                            </Button>
                        )}
                        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                    </div>
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {/* ── List ── */}
            <div className="flex-1 flex flex-col min-h-0 pb-6">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col" data-admin-surface="">
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                        {loading ? (
                            [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                        ) : notifs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Bell size={32} className="text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Updates and alerts will appear here</p>
                            </div>
                        ) : (
                            notifs.map(n => {
                                const cfg = getIconCfg(n.tag);
                                const Icon = cfg.icon;
                                return (
                                    <button
                                        key={n.recipientId}
                                        onClick={() => markRead(n.recipientId)}
                                        className={`w-full flex items-start gap-4 px-5 py-4 border-b border-border/40 last:border-none text-left transition-colors hover:bg-muted/30 ${!n.isRead ? 'bg-primary/5' : ''}`}
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconBg}`}>
                                            <Icon size={16} className={cfg.iconColor} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold' : 'font-medium'}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                                {n.message}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground/70 mt-1.5">{relativeTimeStr(n.createdAt)}</p>
                                        </div>
                                        {!n.isRead && (
                                            <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── Pagination ── */}
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between flex-wrap gap-2 mt-4 px-1">
                        <p className="text-[11px] text-muted-foreground">
                            Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString('en-IN')} total
                        </p>
                        <div className="flex items-center gap-1 flex-wrap">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                <ChevronLeft size={14} />
                            </button>
                            {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                                    if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, i) => p === '...' ? (
                                    <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">...</span>
                                ) : (
                                    <button key={p} onClick={() => setPage(p as number)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all
                                            ${page === p ? 'bg-primary text-white' : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                        {p}
                                    </button>
                                ))}
                            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
