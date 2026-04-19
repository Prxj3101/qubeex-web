'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star, Search, X, ThumbsUp, Send,
    ChevronDown, ChevronUp, Building2,
    Clock, Loader2, MessageSquare,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewReply {
    id: string;
    message: string;
    time: string;
}

interface Review {
    id: string;
    institution: string;
    institutionType: 'SCHOOL' | 'COLLEGE' | 'COACHING';
    adminName: string;
    adminEmail: string;
    rating: number;
    title: string;
    body: string;
    createdAt: string;
    likes: number;
    reply?: ReviewReply;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_REVIEWS: Review[] = [
    {
        id: 'REV-001',
        institution: 'Delhi Public School', institutionType: 'SCHOOL',
        adminName: 'Rohit Sharma', adminEmail: 'admin@dps.edu.in',
        rating: 5, title: 'Excellent platform for student management',
        body: 'QubeEx has completely transformed how we manage assessments. The AI-powered evaluation is accurate and saves our teachers hours every week. Highly recommended for any school.',
        createdAt: '2 days ago', likes: 12,
        reply: { id: 'rr1', message: 'Thank you so much for your kind words, Rohit! We are thrilled that QubeEx is saving your teachers time. We will keep improving!', time: '1 day ago' },
    },
    {
        id: 'REV-002',
        institution: 'Aakash Coaching', institutionType: 'COACHING',
        adminName: 'Anita Verma', adminEmail: 'admin@aakash.ac.in',
        rating: 4, title: 'Great product, few minor issues',
        body: 'Overall very satisfied with QubeEx. The test creation interface is intuitive and our students find it easy to use. Would love to see bulk import and better analytics in the future.',
        createdAt: '5 days ago', likes: 8,
    },
    {
        id: 'REV-003',
        institution: 'Fergusson College', institutionType: 'COLLEGE',
        adminName: 'Vivek Joshi', adminEmail: 'admin@fergusson.edu',
        rating: 5, title: 'Best assessment platform we have used',
        body: 'We evaluated 5 different platforms before choosing QubeEx and it was the right choice. The support team is responsive and the product keeps getting better. The AI grading is impressive.',
        createdAt: '1 week ago', likes: 21,
        reply: { id: 'rr2', message: 'We are so happy to hear this, Vivek! Our team works hard to provide the best experience. Thank you for choosing QubeEx!', time: '6 days ago' },
    },
    {
        id: 'REV-004',
        institution: 'Modern High School', institutionType: 'SCHOOL',
        adminName: 'Priya Menon', adminEmail: 'info@modernhs.in',
        rating: 3, title: 'Good but needs improvement in mobile experience',
        body: 'The desktop experience is great but students face issues on mobile devices. Buttons are sometimes unresponsive and the test interface needs better mobile optimization.',
        createdAt: '2 weeks ago', likes: 5,
    },
    {
        id: 'REV-005',
        institution: 'Shree Vidya College', institutionType: 'COLLEGE',
        adminName: 'Dinesh Shah', adminEmail: 'admin@shreevidya.edu',
        rating: 4, title: 'Very useful for managing large batches',
        body: 'With 500+ students across multiple batches, QubeEx makes it manageable. The batch-wise reporting is especially helpful. Customer support has been prompt and helpful.',
        createdAt: '3 weeks ago', likes: 14,
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INST_TYPE_COLORS: Record<string, string> = {
    SCHOOL: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    COLLEGE: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    COACHING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star
                    key={s}
                    size={size}
                    className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}
                />
            ))}
        </div>
    );
}

const TYPE_FILTERS = ['All', 'School', 'College', 'Coaching'];
const STAR_FILTERS = [5, 4, 3, 2, 1];

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ review, index }: { review: Review; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const [reply, setReply] = useState('');
    const [replyData, setReplyData] = useState<ReviewReply | undefined>(review.reply);
    const [likes, setLikes] = useState(review.likes);
    const [liked, setLiked] = useState(false);
    const [sending, setSending] = useState(false);

    const handleLike = () => {
        if (liked) { setLikes(l => l - 1); setLiked(false); }
        else { setLikes(l => l + 1); setLiked(true); }
    };

    const handleSendReply = () => {
        if (!reply.trim()) return;
        setSending(true);
        setTimeout(() => {
            setReplyData({ id: `rr-${Date.now()}`, message: reply.trim(), time: 'Just now' });
            setReply('');
            setSending(false);
        }, 600);
    };

    const initials = review.adminName.split(' ').map(n => n[0]).join('').slice(0, 2);

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all duration-200 overflow-hidden"
        >
            {/* Card Header */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-sm font-bold shrink-0">
                        {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Name + institution */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{review.adminName}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INST_TYPE_COLORS[review.institutionType]}`}>
                                {review.institutionType}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Building2 size={11} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{review.institution}</span>
                        </div>

                        {/* Rating + time */}
                        <div className="flex items-center gap-3 mt-1.5">
                            <StarRating rating={review.rating} />
                            <div className="flex items-center gap-1">
                                <Clock size={10} className="text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground">{review.createdAt}</span>
                            </div>
                        </div>
                    </div>

                    {/* Like button */}
                    <button onClick={handleLike}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${liked
                                ? 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800'
                                : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}>
                        <ThumbsUp size={12} className={liked ? 'fill-current' : ''} />
                        {likes}
                    </button>
                </div>

                {/* Review title + body */}
                <div className="mt-3">
                    <p className="text-sm font-semibold mb-1">{review.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{review.body}</p>
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                        {replyData && (
                            <div className="flex items-center gap-1">
                                <MessageSquare size={11} className="text-violet-500" />
                                <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">Replied</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {expanded ? <><ChevronUp size={13} /> Less</> : <><ChevronDown size={13} /> {replyData ? 'View thread' : 'Reply'}</>}
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
                                <p className="text-sm text-foreground leading-relaxed">{review.body}</p>
                            </div>

                            {/* Existing reply */}
                            {replyData && (
                                <div className="flex gap-2.5 flex-row-reverse">
                                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                                        SA
                                    </div>
                                    <div className="flex flex-col items-end flex-1">
                                        <div className="px-3 py-2 rounded-xl text-sm bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100 max-w-[90%]">
                                            {replyData.message}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1 px-1">Super Admin · {replyData.time}</p>
                                    </div>
                                </div>
                            )}

                            {/* Reply input — only if no reply yet */}
                            {!replyData && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reply to this review</p>
                                    <div className="flex gap-2">
                                        <textarea
                                            value={reply}
                                            onChange={e => setReply(e.target.value)}
                                            placeholder="Write a thoughtful reply..."
                                            rows={2}
                                            className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none"
                                        />
                                        <button
                                            onClick={handleSendReply}
                                            disabled={!reply.trim() || sending}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
    const [search, setSearch] = useState('');
    const [activeType, setActiveType] = useState('All');
    const [activeStars, setActiveStars] = useState<number[]>([]);

    const toggleStar = (s: number) =>
        setActiveStars(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

    const filtered = useMemo(() => {
        let list = MOCK_REVIEWS;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(r =>
                r.title.toLowerCase().includes(q) ||
                r.institution.toLowerCase().includes(q) ||
                r.adminName.toLowerCase().includes(q) ||
                r.body.toLowerCase().includes(q)
            );
        }
        if (activeType !== 'All') list = list.filter(r => r.institutionType === activeType.toUpperCase());
        if (activeStars.length > 0) list = list.filter(r => activeStars.includes(r.rating));
        return list;
    }, [search, activeType, activeStars]);

    const avgRating = (MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / MOCK_REVIEWS.length).toFixed(1);

    return (
        <div className="space-y-4 pt-3">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Star size={26} className="fill-amber-400 text-amber-400" />
                        Reviews & Feedback
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={Math.round(Number(avgRating))} size={13} />
                        <span className="text-sm text-muted-foreground">{avgRating} avg · {MOCK_REVIEWS.length} reviews</span>
                    </div>
                </div>
            </div>

            {/* ── Search + Filters ── */}
            <div className="space-y-2 px-1">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search reviews by title, institution or admin..."
                        className="w-full max-w-xl h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X size={13} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground font-medium">Type:</span>
                    {TYPE_FILTERS.map(f => (
                        <button key={f} onClick={() => setActiveType(f)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeType === f
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-border/50 text-muted-foreground hover:text-foreground'
                                }`}>
                            {f}
                        </button>
                    ))}
                    <span className="text-[11px] text-muted-foreground font-medium ml-2">Stars:</span>
                    {STAR_FILTERS.map(s => (
                        <button key={s} onClick={() => toggleStar(s)}
                            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeStars.includes(s)
                                    ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400'
                                    : 'border-border/50 text-muted-foreground hover:text-foreground'
                                }`}>
                            <Star size={10} className={activeStars.includes(s) ? 'fill-amber-500 text-amber-500' : ''} />
                            {s}
                        </button>
                    ))}
                    {activeStars.length > 0 && (
                        <button onClick={() => setActiveStars([])}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-1">
                            <X size={11} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Reviews Grid ── */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <Star size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No reviews found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filtered.map((review, i) => (
                        <ReviewCard key={review.id} review={review} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}