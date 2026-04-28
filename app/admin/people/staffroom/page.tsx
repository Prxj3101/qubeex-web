'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Paperclip, User, Users, MessageSquare, Search, MoreVertical,
    Image as ImageIcon, FileText, ThumbsUp, MessageCircle,
    ChevronDown, Plus, X, AtSign,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FeedPost {
    id: string;
    authorName: string;
    authorInitials: string;
    authorColor: string;
    authorRole: 'ADMIN' | 'TEACHER';
    text: string;
    time: string;
    likes: number;
    liked: boolean;
    comments: { id: string; author: string; initials: string; color: string; text: string; time: string }[];
    attachment?: { type: 'image' | 'file'; name: string };
}

interface DmThread {
    id: string;
    name: string;
    initials: string;
    color: string;
    online: boolean;
    lastMessage: string;
    lastTime: string;
    unread: number;
    messages: {
        id: string;
        text: string;
        time: string;
        isMe: boolean;
        senderName: string;
        senderInitials: string;
        senderColor: string;
    }[];
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_POSTS: FeedPost[] = [
    {
        id: 'p3',
        authorName: 'Admin',
        authorInitials: 'AD',
        authorColor: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
        authorRole: 'ADMIN',
        text: '🎉 Congratulations to all teachers for the excellent performance in the annual evaluation! Keep up the great work.',
        time: 'Yesterday',
        likes: 8,
        liked: false,
        comments: [
            { id: 'c3', author: 'Ankit Verma', initials: 'AV', color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300', text: 'Thank you so much! 🙏', time: 'Yesterday' },
        ],
    },
    {
        id: 'p4',
        authorName: 'Meena Patel',
        authorInitials: 'MP',
        authorColor: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
        authorRole: 'TEACHER',
        text: 'Reminder: Class 9 science practical submission is due this Friday. Please ensure all students complete their lab reports.',
        time: 'Yesterday',
        likes: 3,
        liked: false,
        comments: [],
    },
    {
        id: 'p2',
        authorName: 'Ritu Sharma',
        authorInitials: 'RS',
        authorColor: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
        authorRole: 'TEACHER',
        text: 'Class 10 Math test papers have been checked and results are ready. Will be submitting to admin today.',
        time: '9:15 AM',
        likes: 2,
        liked: true,
        comments: [],
        attachment: { type: 'file', name: 'Class10_Math_Results.pdf' },
    },

    {
        id: 'p1',
        authorName: 'Admin',
        authorInitials: 'AD',
        authorColor: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
        authorRole: 'ADMIN',
        text: '📢 Staff meeting today at 3:00 PM in the conference room. All teachers are requested to attend. Please be on time.',
        time: '10:32 AM',
        likes: 4,
        liked: false,
        comments: [
            { id: 'c1', author: 'Ritu Sharma', initials: 'RS', color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300', text: 'Will be there on time 👍', time: '10:35 AM' },
            { id: 'c2', author: 'Priya Nair', initials: 'PN', color: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300', text: 'Noted, thank you!', time: '10:38 AM' },
        ],
    },

];

const MOCK_DMS: DmThread[] = [
    {
        id: 't1', name: 'Ritu Sharma', initials: 'RS',
        color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
        online: true, lastMessage: 'Sure, sending by evening', lastTime: '11:20 AM', unread: 1,
        messages: [
            { id: 'd1', text: 'Hi Ritu, please share Class 10 Math test paper when ready.', time: '11:00 AM', isMe: true, senderName: 'Admin', senderInitials: 'AD', senderColor: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' },
            { id: 'd2', text: 'Sure, sending by evening', time: '11:20 AM', isMe: false, senderName: 'Ritu Sharma', senderInitials: 'RS', senderColor: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
        ],
    },
    {
        id: 't2', name: 'Ankit Verma', initials: 'AV',
        color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
        online: false, lastMessage: 'Okay sir', lastTime: 'Yesterday', unread: 0,
        messages: [
            { id: 'd3', text: 'Ankit, please update attendance for Class 10-A', time: 'Yesterday', isMe: true, senderName: 'Admin', senderInitials: 'AD', senderColor: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' },
            { id: 'd4', text: 'Okay sir', time: 'Yesterday', isMe: false, senderName: 'Ankit Verma', senderInitials: 'AV', senderColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
        ],
    },
    {
        id: 't3', name: 'Priya Nair', initials: 'PN',
        color: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
        online: true, lastMessage: 'Thank you!', lastTime: 'Yesterday', unread: 0,
        messages: [
            { id: 'd5', text: 'Can I take half day tomorrow?', time: 'Yesterday', isMe: false, senderName: 'Priya Nair', senderInitials: 'PN', senderColor: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' },
            { id: 'd6', text: 'Yes that is fine, please update in system.', time: 'Yesterday', isMe: true, senderName: 'Admin', senderInitials: 'AD', senderColor: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' },
            { id: 'd7', text: 'Thank you!', time: 'Yesterday', isMe: false, senderName: 'Priya Nair', senderInitials: 'PN', senderColor: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' },
        ],
    },
    {
        id: 't4', name: 'Meena Patel', initials: 'MP',
        color: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
        online: false, lastMessage: 'No messages yet', lastTime: '', unread: 0, messages: [],
    },
    {
        id: 't5', name: 'Suresh Iyer', initials: 'SI',
        color: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
        online: true, lastMessage: 'No messages yet', lastTime: '', unread: 0, messages: [],
    },
];

// ── Feed Post Card ────────────────────────────────────────────────────────────
function PostCard({ post, onLike }: { post: FeedPost; onLike: (id: string) => void }) {
    const [showComments, setShowComments] = useState(false);
    const [commentInput, setCommentInput] = useState('');
    const [comments, setComments] = useState(post.comments);

    const isMe = post.authorRole === 'ADMIN';

    const handleComment = () => {
        if (!commentInput.trim()) return;
        setComments(prev => [...prev, {
            id: `c-${Date.now()}`,
            author: 'Admin',
            initials: 'AD',
            color: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
            text: commentInput.trim(),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        }]);
        setCommentInput('');
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
        >
            {/* Avatar */}
            {!isMe && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-1 ${post.authorColor}`}>
                    {post.authorInitials}
                </div>
            )}

            <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Name + role + time */}
                <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[11px] font-semibold text-foreground">{post.authorName}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${post.authorRole === 'ADMIN'
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                        : 'bg-muted text-muted-foreground'
                        }`}>
                        {post.authorRole === 'ADMIN' ? 'Admin' : 'Teacher'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{post.time}</span>
                </div>

                {/* Message bubble */}
                <div
                    className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe
                        ? 'text-white rounded-tr-sm'
                        : 'bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 text-foreground rounded-tl-sm'
                        }`}
                    style={isMe ? { background: '#7C3AED' } : {}}
                >
                    {post.text}

                    {/* Attachment */}
                    {post.attachment && (
                        <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-xl w-fit ${isMe ? 'bg-white/20' : 'bg-muted/50 border border-border/40'
                            }`}>
                            {post.attachment.type === 'file'
                                ? <FileText size={12} className={isMe ? 'text-white/80' : 'text-muted-foreground'} />
                                : <ImageIcon size={12} className={isMe ? 'text-white/80' : 'text-muted-foreground'} />
                            }
                            <span className={`text-[11px] font-medium ${isMe ? 'text-white/90' : 'text-muted-foreground'}`}>
                                {post.attachment.name}
                            </span>
                        </div>
                    )}
                </div>

                {/* Reactions */}
                <div className={`flex items-center gap-3 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <button
                        onClick={() => onLike(post.id)}
                        className={`flex items-center gap-1 text-[11px] font-medium transition-all ${post.liked ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-400'
                            }`}
                    >
                        <ThumbsUp size={12} fill={post.liked ? 'currentColor' : 'none'} />
                        {post.likes > 0 && post.likes}
                    </button>
                    <button
                        onClick={() => setShowComments(v => !v)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-all"
                    >
                        <MessageCircle size={12} />
                        {comments.length > 0 && comments.length}
                    </button>
                </div>

                {/* Comments */}
                <AnimatePresence>
                    {showComments && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`overflow-hidden w-full mt-1`}
                        >
                            <div className="space-y-1.5 mb-2">
                                {comments.map(c => (
                                    <div key={c.id} className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${c.color}`}>
                                            {c.initials}
                                        </div>
                                        <div className={`px-2.5 py-1.5 rounded-xl bg-muted/60 border border-border/30 ${isMe ? 'items-end' : ''}`}>
                                            <p className="text-[10px] font-semibold text-muted-foreground">{c.author}</p>
                                            <p className="text-xs text-foreground">{c.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Comment input */}
                            <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-[8px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                                    AD
                                </div>
                                <input
                                    type="text"
                                    value={commentInput}
                                    onChange={e => setCommentInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleComment(); } }}
                                    placeholder="Reply..."
                                    className="flex-1 h-7 px-3 rounded-xl bg-muted/40 border border-border/40 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                                />
                                <button
                                    onClick={handleComment}
                                    disabled={!commentInput.trim()}
                                    className="w-7 h-7 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                >
                                    <Send size={13} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffroomPage() {
    const [posts, setPosts] = useState<FeedPost[]>(MOCK_POSTS);
    const [dms, setDms] = useState<DmThread[]>(MOCK_DMS);
    const [activeDm, setActiveDm] = useState<string | null>(null);
    const [postInput, setPostInput] = useState('');
    const [dmInput, setDmInput] = useState('');
    const [dmSearch, setDmSearch] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const feedEndRef = useRef<HTMLDivElement>(null);
    const activeThread = dms.find(d => d.id === activeDm);
    const [feedSearch, setFeedSearch] = useState('');
    const [showFeedSearch, setShowFeedSearch] = useState(false);
    const [showDmSearch, setShowDmSearch] = useState(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeDm, activeThread?.messages.length]);

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [posts.length]);

    // Like post
    const handleLike = (id: string) => {
        setPosts(prev => prev.map(p =>
            p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
        ));
    };

    // New post
    const handlePost = () => {
        if (!postInput.trim()) return;
        const newPost: FeedPost = {
            id: `p-${Date.now()}`,
            authorName: 'Admin',
            authorInitials: 'AD',
            authorColor: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
            authorRole: 'ADMIN',
            text: postInput.trim(),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            likes: 0, liked: false, comments: [],
        };
        setPosts(prev => [...prev, newPost]);
        setPostInput('');
    };

    // Send DM
    const handleSendDm = () => {
        if (!dmInput.trim() || !activeDm) return;
        const newMsg = {
            id: `dm-${Date.now()}`,
            text: dmInput.trim(),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            isMe: true,
            senderName: 'Admin',
            senderInitials: 'AD',
            senderColor: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
        };
        setDms(prev => prev.map(d =>
            d.id === activeDm
                ? { ...d, messages: [...d.messages, newMsg], lastMessage: dmInput.trim(), lastTime: newMsg.time, unread: 0 }
                : d
        ));
        setDmInput('');
    };

    const filteredDms = dmSearch.trim()
        ? dms.filter(d => d.name.toLowerCase().includes(dmSearch.toLowerCase()))
        : dms;

    const filteredPosts = feedSearch.trim()
        ? posts.filter(p =>
            p.text.toLowerCase().includes(feedSearch.toLowerCase()) ||
            p.authorName.toLowerCase().includes(feedSearch.toLowerCase())
        )
        : posts;

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Header — fixed ── */}
            <div className="shrink-0 pb-3 px-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <MessageSquare size={26} />
                            Staffroom
                        </h1>
                        <p className="text-muted-foreground text-sm">Staff feed & direct messages</p>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-3" />
            </div>

            {/* ── Body — fills remaining height ── */}
            <div className="flex gap-3 flex-1 min-h-0 overflow-hidden pb-3">

                {/* LEFT — Feed 60% */}
                <div className="w-[60%] flex flex-col min-h-0 overflow-hidden border border-border/50 rounded-2xl bg-card">

                    {/* Feed header */}
                    <div className="px-4 pt-2 pb-1 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users size={16} />
                                <h2 className="text-base font-bold">Staffroom</h2>
                                {/* Tooltip */}
                                <div className="relative group">
                                    <div className="w-3 h-3 rounded-full border border-muted-foreground/40 flex items-center justify-center cursor-default">
                                        <span className="text-[10px] text-muted-foreground font-semibold">i</span>
                                    </div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 rounded-lg bg-black/90 text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                                        Shared announcements & updates
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-black/90" />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowFeedSearch(v => !v); setFeedSearch(''); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            >
                                {showFeedSearch ? <X size={14} /> : <Search size={14} />}
                            </button>
                        </div>

                        {/* Search input */}
                        <AnimatePresence>
                            {showFeedSearch && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden mt-2"
                                >
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                        <input
                                            type="text"
                                            value={feedSearch}
                                            onChange={e => setFeedSearch(e.target.value)}
                                            placeholder="Search posts..."
                                            autoFocus
                                            className="w-full h-8 pl-8 pr-3 rounded-4xl border border-border bg-muted/40 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Feed messages — scrollable */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
                        {filteredPosts.map(post => (
                            <PostCard key={post.id} post={post} onLike={handleLike} />
                        ))}
                        <div ref={feedEndRef} />
                    </div>

                    {/* Composer — fixed bottom */}
                    <div className="border-t border-border/40 px-3 py-1.5 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                                AD
                            </div>
                            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                <input
                                    type="text"
                                    value={postInput}
                                    onChange={e => setPostInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePost(); } }}
                                    placeholder="Write an announcement..."
                                    className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                    <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                        <ImageIcon size={13} />
                                    </button>
                                    <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                        <Paperclip size={13} />
                                    </button>
                                    <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                        <AtSign size={13} />
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={handlePost}
                                disabled={!postInput.trim()}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                <Send size={13} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT — Chats 40% */}
                <div className="w-[40%] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden min-h-0">

                    {/* Chats header — fixed */}
                    <div className="px-4 pt-2 pb-1 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold flex items-center gap-2">
                                <User size={16} />
                                DM's
                            </h2>
                            <button
                                onClick={() => { setShowDmSearch(v => !v); setDmSearch(''); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            >
                                {showDmSearch ? <X size={14} /> : <Search size={14} />}
                            </button>
                        </div>

                        <AnimatePresence>
                            {showDmSearch && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden mt-2"
                                >
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                        <input
                                            type="text"
                                            value={dmSearch}
                                            onChange={e => setDmSearch(e.target.value)}
                                            placeholder="Search teachers..."
                                            autoFocus
                                            className="w-full h-8 pl-8 pr-3 rounded-4xl border border-border bg-muted/40 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* DM list / Chat — scrollable */}
                    <AnimatePresence mode="wait">
                        {!activeDm ? (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex-1 overflow-y-auto min-h-0"
                            >
                                {filteredDms.map(dm => (
                                    <button
                                        key={dm.id}
                                        onClick={() => { setActiveDm(dm.id); setDms(prev => prev.map(d => d.id === dm.id ? { ...d, unread: 0 } : d)); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/30 hover:bg-muted/40 transition-all text-left"
                                    >
                                        <div className="relative shrink-0">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ${dm.color}`}>
                                                {dm.initials}
                                            </div>
                                            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${dm.online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-xs font-semibold truncate">{dm.name}</p>
                                                <p className="text-[10px] text-muted-foreground shrink-0 ml-1">{dm.lastTime}</p>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground truncate">{dm.lastMessage}</p>
                                        </div>
                                        {dm.unread > 0 && (
                                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                {dm.unread}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="chat"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex-1 flex flex-col min-h-0"
                            >
                                {/* Chat header — fixed */}
                                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 shrink-0">
                                    <button onClick={() => setActiveDm(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
                                        <ChevronDown size={15} style={{ transform: 'rotate(90deg)' }} />
                                    </button>
                                    <div className="relative shrink-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${activeThread?.color}`}>
                                            {activeThread?.initials}
                                        </div>
                                        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-card ${activeThread?.online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold">{activeThread?.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{activeThread?.online ? '🟢 Online' : '⚫ Offline'}</p>
                                    </div>
                                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                        <MoreVertical size={13} />
                                    </button>
                                </div>

                                {/* Messages — scrollable */}
                                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                                    {activeThread?.messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                                                <Send size={16} className="text-muted-foreground" />
                                            </div>
                                            <p className="text-xs font-medium text-muted-foreground">No messages yet</p>
                                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Say hello!</p>
                                        </div>
                                    ) : (
                                        activeThread?.messages.map(msg => (
                                            <div key={msg.id} className={`flex gap-2 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-1 ${msg.senderColor}`}>
                                                    {msg.senderInitials}
                                                </div>
                                                <div className={`flex flex-col max-w-[75%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                                    <div
                                                        className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.isMe ? 'text-white rounded-tr-sm' : 'bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 text-foreground rounded-tl-sm'}`}
                                                        style={msg.isMe ? { background: '#7C3AED' } : {}}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5 px-1">{msg.time}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* DM Input — fixed */}
                                <div className="px-3 py-1.5 border-t border-border/40 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                            <input
                                                type="text"
                                                value={dmInput}
                                                onChange={e => setDmInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSendDm(); } }}
                                                placeholder={`Message ${activeThread?.name}...`}
                                                className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground/60 focus:outline-none"
                                            />
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                                    <ImageIcon size={13} />
                                                </button>
                                                <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                                    <Paperclip size={13} />
                                                </button>
                                                <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                                    <AtSign size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSendDm}
                                            disabled={!dmInput.trim()}
                                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                        >
                                            <Send size={13} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}