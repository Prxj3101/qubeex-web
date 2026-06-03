'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star, Search, X, ThumbsUp, Send,
    ChevronDown, ChevronUp, Building2,
    Clock, Loader2, MessageSquare, RefreshCw,
    ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Review {
    id: string;
    institution: { name: string; type: string };
    adminName: string;
    adminEmail: string;
    rating: number;
    title: string;
    body: string;
    createdAt: string;
    likes: number;
    replyMessage: string | null;
    repliedAt: string | null;
}

type Pagination = { total: number; page: number; limit: number; pages: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const INST_TYPE_COLORS: Record<string, string> = {
    SCHOOL:   'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    COLLEGE:  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    COACHING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={size}
                    className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'} />
            ))}
        </div>
    );
}

const TYPE_FILTERS  = ['All', 'SCHOOL', 'COLLEGE', 'COACHING'];
const STAR_FILTERS  = [5, 4, 3, 2, 1];
const PAGE_SIZE     = 20;

// ─── Review Card ─────────────────────────────────────────────────────────────

function ReviewCard({ review, index, expanded, onToggle, onReply }: {
    review: Review;
    index: number;
    expanded: boolean;
    onToggle: () => void;
    onReply: (id: string, message: string) => Promise<void>;
}) {
    const [replyText, setReplyText]     = useState('');
    const [replyMessage, setReplyMessage] = useState<string | null>(review.replyMessage);
    const [repliedAt, setRepliedAt]     = useState<string | null>(review.repliedAt);
    const [sending, setSending]         = useState(false);
    const [likes, setLikes]             = useState(review.likes);
    const [liked, setLiked]             = useState(false);
    const [liking, setLiking]           = useState(false);

    const handleLike = async () => {
        if (liked || liking) return;
        setLiking(true);
        setLiked(true);
        setLikes(l => l + 1);
        try {
            await api.post(`/superadmin/support/reviews/${review.id}/like`);
        } catch {
            setLiked(false);
            setLikes(l => l - 1);
            toast.error('Failed to like review');
        } finally {
            setLiking(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            await onReply(review.id, replyText.trim());
            setReplyMessage(replyText.trim());
            setRepliedAt(new Date().toISOString());
            setReplyText('');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to send reply'));
        } finally {
            setSending(false);
        }
    };

    const initials = review.adminName.split(' ').map(n => n[0]).join('').slice(0, 2);

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all duration-200 overflow-hidden"
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-sm font-bold shrink-0">
                        {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{review.adminName}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INST_TYPE_COLORS[review.institution.type] ?? ''}`}>
                                {review.institution.type}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Building2 size={11} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{review.institution.name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                            <StarRating rating={review.rating} />
                            <div className="flex items-center gap-1">
                                <Clock size={10} className="text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground">{relativeTime(review.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Like button */}
                    <button
                        onClick={handleLike}
                        disabled={liked || liking}
                        className={`flex items-center gap-1 text-[11px] font-medium transition-all disabled:cursor-default shrink-0 ${liked ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-400'}`}
                    >
                        <ThumbsUp size={12} fill={liked ? 'currentColor' : 'none'} />
                        <span>{likes}</span>
                    </button>
                </div>

                {/* Review content */}
                <div className="mt-3">
                    <p className="text-sm font-semibold mb-1">{review.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{review.body}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                        {replyMessage && (
                            <div className="flex items-center gap-1">
                                <MessageSquare size={11} className="text-violet-500" />
                                <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">Replied</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onToggle}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {expanded
                            ? <><ChevronUp size={13} /> Less</>
                            : <><ChevronDown size={13} /> {replyMessage ? 'View thread' : 'Reply'}</>
                        }
                    </button>
                </div>
            </div>

            {/* Expanded */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-border/40 px-4 py-4 space-y-4">
                            {/* Full body */}
                            <div className="p-3 bg-muted/30 rounded-xl">
                                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Full Review</p>
                                <p className="text-sm leading-relaxed">{review.body}</p>
                                <p className="text-[11px] text-muted-foreground mt-2">{review.adminEmail}</p>
                            </div>

                            {/* Existing reply */}
                            {replyMessage && repliedAt && (
                                <div className="flex gap-2.5 flex-row-reverse">
                                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                                        SA
                                    </div>
                                    <div className="flex flex-col items-end flex-1">
                                        <div className="px-3 py-2 rounded-xl text-sm bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100 max-w-[90%]">
                                            {replyMessage}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                            Super Admin · {relativeTime(repliedAt)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Reply input — only if not yet replied */}
                            {!replyMessage && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reply to this review</p>
                                    <div className="flex gap-2">
                                        <textarea
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            placeholder="Write a thoughtful reply..."
                                            rows={2}
                                            className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none"
                                        />
                                        <button
                                            onClick={handleSendReply}
                                            disabled={!replyText.trim() || sending}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold self-end disabled:opacity-50 transition-all hover:opacity-90"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                        >
                                            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                            Reply
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
    const [reviews, setReviews]         = useState<Review[]>([]);
    const [pagination, setPagination]   = useState<Pagination>({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    const [loading, setLoading]         = useState(false);
    const [page, setPage]               = useState(1);
    const [expandedId, setExpandedId]   = useState<string | null>(null);

    const [search, setSearch]                   = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeType, setActiveType]           = useState('All');
    const [activeStars, setActiveStars]         = useState<number[]>([]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    };

    const fetchReviews = useCallback(async (currentPage = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('limit', String(PAGE_SIZE));
            if (activeType !== 'All') params.set('type', activeType);
            if (activeStars.length === 1) params.set('rating', String(activeStars[0]));
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

            const res = await api.get(`/superadmin/support/reviews?${params}`);
            setReviews(res.data?.reviews ?? []);
            setPagination(res.data?.pagination ?? { total: 0, page: currentPage, limit: PAGE_SIZE, pages: 1 });
        } catch {
            toast.error('Failed to load reviews');
        } finally {
            setLoading(false);
        }
    }, [page, activeType, activeStars, debouncedSearch]);

    useEffect(() => {
        void fetchReviews(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, activeType, activeStars, debouncedSearch]);

    const handleReply = async (id: string, message: string) => {
        await api.post(`/superadmin/support/reviews/${id}/reply`, { message });
    };

    const toggleStar = (s: number) => {
        setActiveStars(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
        setPage(1);
    };

    const hasFilters = debouncedSearch || activeType !== 'All' || activeStars.length > 0;
    const avgRating  = reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null;

    return (
        <div className="space-y-4 pt-3">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-1 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Star size={26} className="fill-amber-400 text-amber-400" />
                        Reviews & Feedback
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        {avgRating && <StarRating rating={Math.round(Number(avgRating))} size={13} />}
                        <span className="text-sm text-muted-foreground">
                            {avgRating ? `${avgRating} avg · ` : ''}{pagination.total} review{pagination.total !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            placeholder="Search reviews..."
                            className="w-56 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                        />
                        {search && (
                            <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Type filters */}
                    {TYPE_FILTERS.map(f => (
                        <button key={f} onClick={() => { setActiveType(f); setPage(1); }}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeType === f
                                ? 'bg-primary text-white border-primary'
                                : 'border-border/50 text-muted-foreground hover:text-foreground'}`}>
                            {f === 'All' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                    ))}

                    {/* Star filters */}
                    {STAR_FILTERS.map(s => (
                        <button key={s} onClick={() => toggleStar(s)}
                            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeStars.includes(s)
                                ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400'
                                : 'border-border/50 text-muted-foreground hover:text-foreground'}`}>
                            <Star size={10} className={activeStars.includes(s) ? 'fill-amber-500 text-amber-500' : ''} />
                            {s}
                        </button>
                    ))}

                    {hasFilters && (
                        <button onClick={() => { setSearch(''); setDebouncedSearch(''); setActiveType('All'); setActiveStars([]); setPage(1); }}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            <X size={11} /> Clear
                        </button>
                    )}

                    <Button variant="outline" size="icon" onClick={() => fetchReviews(page)} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* ── Reviews Grid ── */}
            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border/50 rounded-2xl h-36 animate-pulse" />
                    ))}
                </div>
            ) : reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <Star size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                        {hasFilters ? 'No reviews match your filters' : 'No reviews yet'}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        {hasFilters ? 'Try adjusting your filters' : 'Reviews from institutions will appear here'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {reviews.map((review, i) => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            index={i}
                            expanded={expandedId === review.id}
                            onToggle={() => setExpandedId(expandedId === review.id ? null : review.id)}
                            onReply={handleReply}
                        />
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {!loading && pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1">
                    <p className="text-[11px] text-muted-foreground">
                        Page {pagination.page} of {pagination.pages} · {pagination.total} total
                    </p>
                    <div className="flex items-center gap-1">
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
                            .map((p, i) => p === '...'
                                ? <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">...</span>
                                : <button key={p} onClick={() => setPage(p as number)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${page === p ? 'bg-primary text-white' : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                    {p}
                                  </button>
                            )
                        }
                        <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
