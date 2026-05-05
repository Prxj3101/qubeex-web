'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star, Send, Edit2, X, Plus, Clock,
    ChevronDown, ChevronUp, MessageSquare, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReviewReply {
    id: string;
    message: string;
    time: string;
}

interface Review {
    id: string;
    rating: number;
    title: string;
    body?: string;
    createdAt: string;
    reply?: ReviewReply;
}

// ── Mock ──────────────────────────────────────────────────────────────────────
const MOCK_REVIEWS: Review[] = [
    {
        id: 'REV-001',
        rating: 5,
        title: 'Excellent platform for student management',
        body: 'QubeEx has completely transformed how we manage assessments. The AI-powered evaluation is accurate and saves our teachers hours every week. Highly recommended for any school.',
        createdAt: '2 days ago',
        reply: {
            id: 'rr1',
            message: 'Thank you so much for your kind words! We are thrilled that QubeEx is saving your teachers time. We will keep improving!',
            time: '1 day ago',
        },
    },
    {
        id: 'REV-002',
        rating: 4,
        title: 'Great product, minor issues with mobile',
        body: 'Overall very satisfied with QubeEx. The test creation interface is intuitive. Would love to see bulk import and better mobile experience in the future.',
        createdAt: '1 week ago',
    },
];

// ── Star Rating Input ─────────────────────────────────────────────────────────
function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
                <button key={s} type="button"
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(s)}
                    className="transition-transform hover:scale-110">
                    <Star size={28} className={`transition-colors ${(hover || value) >= s ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                </button>
            ))}
        </div>
    );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={size} className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'} />
            ))}
        </div>
    );
}

const ratingLabels: Record<number, string> = {
    1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent!',
};

// ── Review Card ───────────────────────────────────────────────────────────────
function ReviewCard({ review, index, expanded, onToggle, onEdit }: {
    review: Review; index: number; expanded: boolean;
    onToggle: () => void; onEdit: () => void;
}) {
    const [reply, setReply] = useState('');
    const [replyData, setReplyData] = useState<ReviewReply | undefined>(review.reply);
    const [sending, setSending] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all duration-200 overflow-hidden">

            {/* Card Header */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-sm font-bold shrink-0">
                        AD
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">Admin</p>
                        </div>

                        {/* Rating + time */}
                        <div className="flex items-center gap-3 mt-1.5">
                            <StarRating rating={review.rating} />
                            <span className="text-xs font-semibold text-amber-500">{ratingLabels[review.rating]}</span>
                            <div className="flex items-center gap-1">
                                <Clock size={10} className="text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground">{review.createdAt}</span>
                            </div>
                        </div>
                    </div>

                    {/* Edit button */}
                    <button onClick={onEdit}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                        <Edit2 size={12} /> Edit
                    </button>
                </div>

                {/* Title + body */}
                <div className="mt-3">
                    <p className="text-sm font-semibold mb-1">{review.title}</p>
                    {review.body && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 break-words overflow-hidden">
                            {review.body}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                        {replyData && (
                            <div className="flex items-center gap-1">
                                <MessageSquare size={11} className="text-violet-500" />
                                <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">QubeEx replied</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onToggle}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {expanded
                            ? <><ChevronUp size={13} /> Less</>
                            : <><ChevronDown size={13} /> {replyData ? 'View reply' : 'View full'}</>
                        }
                    </button>
                </div>
            </div>

            {/* Expanded */}
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="border-t border-border/40 px-4 py-4 space-y-4">

                            {/* Full body */}
                            {review.body && (
                                <div className="p-3 bg-muted/30 rounded-xl overflow-hidden">
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">Full Review</p>
                                    <p className="text-sm text-foreground leading-relaxed break-words">{review.body}</p>
                                </div>
                            )}

                            {/* QubeEx reply */}
                            {replyData && (
                                <div className="flex gap-2.5 flex-row-reverse">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        QX
                                    </div>
                                    <div className="flex flex-col items-end flex-1">
                                        <div className="px-3 py-2 rounded-xl text-sm max-w-[90%]"
                                            style={{ background: '#DA775620', color: '#DA7756' }}>
                                            {replyData.message}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1 px-1">QubeEx Support · {replyData.time}</p>
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

// ── Write / Edit Modal ────────────────────────────────────────────────────────
function ReviewModal({ open, onClose, onSubmit, editReview }: {
    open: boolean; onClose: () => void;
    onSubmit: (rating: number, title: string, body: string) => void;
    editReview?: Review;
}) {
    const [rating, setRating] = useState(0);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');

    // editReview change hone pe reset karo
    useEffect(() => {
        if (editReview) {
            setRating(editReview.rating);
            setTitle(editReview.title);
            setBody(editReview.body ?? '');
        } else {
            setRating(0);
            setTitle('');
            setBody('');
        }
    }, [editReview, open]);

    const handleSubmit = () => {
        if (!rating || !title.trim() || !body.trim()) return;
        onSubmit(rating, title.trim(), body.trim());
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
                    <h3 className="text-base font-bold flex items-center gap-2">
                        <Star size={16} className="text-amber-400 fill-amber-400" />
                        {editReview ? 'Edit Review' : 'Write a Review'}
                    </h3>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Rating */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Your Rating</label>
                        <div className="flex items-center gap-3">
                            <StarRatingInput value={rating} onChange={setRating} />
                            {rating > 0 && <span className="text-sm font-bold text-amber-500">{ratingLabels[rating]}</span>}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Review Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Summarize your experience..."
                            className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Your Review</label>
                        <textarea value={body} onChange={e => setBody(e.target.value)}
                            placeholder="Share your experience with QubeEx..."
                            rows={5}
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none transition-all" />
                    </div>
                </div>

                <div className="flex items-center justify-between px-5 py-4 border-t border-border/50 bg-muted/20">
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                            Cancel
                        </button>
                        <button onClick={handleSubmit} disabled={!rating || !title.trim() || !body.trim()}
                            className="h-9 px-5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Send size={13} className="inline mr-1.5" />
                            {editReview ? 'Update Review' : 'Submit Review'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminFeedbackPage() {
    const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
    const [showModal, setShowModal] = useState(false);
    const [editReview, setEditReview] = useState<Review | undefined>();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const avgRating = reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : '0.0';

    const handleSubmit = (rating: number, title: string, body: string) => {
        if (editReview) {
            setReviews(prev => prev.map(r => r.id === editReview.id
                ? { ...r, rating, title, body }
                : r
            ));
            toast.success('Review updated!');
        } else {
            setReviews(prev => [{
                id: `REV-${Date.now()}`,
                rating, title, body,
                createdAt: 'Just now',
            }, ...prev]);
            toast.success('Review submitted!');
        }
        setEditReview(undefined);
    };

    const handleEdit = (review: Review) => {
        setEditReview(review);
        setShowModal(true);
    };

    return (
        <div className="space-y-4 pt-0">

            {/* Header */}
            <div className="flex items-center justify-between px-1 pt-0">
                <div>
                    <h1 className="text-[23px] font-bold flex items-center gap-2">
                        Manage Your Reviews & Feedback
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} size={13} className={s <= Math.round(Number(avgRating)) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'} />
                            ))}
                        </div>
                        <span className="text-sm text-muted-foreground">{avgRating} avg · {reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <button onClick={() => { setEditReview(undefined); setShowModal(true); }}
                    className="flex items-center gap-1 h-8 px-3 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    <Plus size={15} /> Write Review
                </button>
            </div>

            {/* Reviews grid */}
            {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <Star size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No reviews yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Share your experience with QubeEx</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {reviews.map((review, i) => (
                        <ReviewCard key={review.id} review={review} index={i}
                            expanded={expandedId === review.id}
                            onToggle={() => setExpandedId(expandedId === review.id ? null : review.id)}
                            onEdit={() => handleEdit(review)} />
                    ))}
                </div>
            )}

            <ReviewModal
                open={showModal}
                onClose={() => { setShowModal(false); setEditReview(undefined); }}
                onSubmit={handleSubmit}
                editReview={editReview}
            />
        </div>
    );
}