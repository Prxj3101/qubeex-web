'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Paperclip, User, Users, Search, MoreVertical,
    Image as ImageIcon, FileText, ThumbsUp, MessageCircle,
    ChevronDown, X, Trash2, Loader2, MessageSquare, ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { validateAttachment, ATTACHMENT_ACCEPT } from '@/lib/attachmentValidation';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';
import { LinkifiedText } from '@/components/shared/LinkifiedText';
import NextImage from 'next/image';
import { formatDisplayName } from '@/lib/displayName';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PostAuthor { id: string; name: string; role: 'ADMIN' | 'TEACHER'; avatarUrl?: string | null; prefix?: string | null; title?: string | null; }

interface StaffroomPost {
    id: string; text: string;
    attachmentUrl: string | null; attachmentType: string | null; attachmentName: string | null;
    createdAt: string; author: PostAuthor;
    likeCount: number; liked: boolean;
    comments: { id: string; text: string; createdAt: string; author: PostAuthor }[];
}

interface DmThread {
    teacherId: string; teacherUserId: string; name: string;
    avatarUrl: string | null; isActive: boolean;
    lastMessage: string | null; lastMessageAt: string | null;
    lastMessageIsMe: boolean; unread: number;
    prefix?: string | null; title?: string | null;
}

interface DmMessage {
    id: string; isMe: boolean; text: string | null;
    attachmentUrl: string | null; attachmentType: string | null; attachmentName: string | null;
    createdAt: string;
}

interface PendingAttachment { url: string; name: string; type: 'image' | 'file'; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
    'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
    'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
    'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
];

function getAvatarColor(id: string) { return AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function fmtTime(iso: string) {
    const d = new Date(iso); const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fmtDateTime(iso: string) {
    const d = new Date(iso); const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Today, ${time}`;
    if (diffDays === 1) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

// ── Attachment Chip ───────────────────────────────────────────────────────────
function AttachmentChip({ attachment, dark, onRemove }: {
    attachment: { url: string; name: string; type: string };
    dark?: boolean; onRemove?: () => void;
}) {
    const isImage = attachment.type === 'image';
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit max-w-[220px] ${dark ? 'bg-white/20' : 'bg-muted/50 border border-border/40'}`}>
            {isImage
                ? <ImageIcon size={12} className={dark ? 'text-white/80' : 'text-muted-foreground'} />
                : <FileText size={12} className={dark ? 'text-white/80' : 'text-muted-foreground'} />}
            <span className={`text-[11px] font-medium truncate flex-1 ${dark ? 'text-white/90' : 'text-muted-foreground'}`}>{attachment.name}</span>
            {onRemove && (
                <button type="button" onClick={onRemove} className="shrink-0 hover:opacity-60">
                    <X size={10} className={dark ? 'text-white/80' : 'text-muted-foreground'} />
                </button>
            )}
        </div>
    );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, myUserId, onLike, onDelete, onAddComment, onDeleteComment }: {
    post: StaffroomPost; myUserId: string;
    onLike: (id: string) => void; onDelete: (id: string) => void;
    onAddComment: (postId: string, text: string) => Promise<StaffroomPost['comments'][0]>;
    onDeleteComment: (postId: string, commentId: string) => void;
}) {
    const [showComments, setShowComments] = useState(false);
    const [commentInput, setCommentInput] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isMe = post.author.id === myUserId;
    const avatarColor = post.author.role === 'ADMIN'
        ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
        : getAvatarColor(post.author.id);

    const handleComment = async () => {
        if (!commentInput.trim() || submittingComment) return;
        setSubmittingComment(true);
        try { await onAddComment(post.id, commentInput.trim()); setCommentInput(''); }
        finally { setSubmittingComment(false); }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold shrink-0 mt-1 relative ${post.author.avatarUrl ? '' : avatarColor}`}>
                {post.author.avatarUrl
                    ? <NextImage src={post.author.avatarUrl} alt={post.author.name} fill sizes="32px" className="object-cover" />
                    : getInitials(post.author.name)}
            </div>
            <div className={`flex flex-col max-w-[82%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[11px] font-semibold">{formatDisplayName(post.author.name, post.author.prefix)}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${post.author.role === 'ADMIN'
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                        : 'bg-muted text-muted-foreground'}`}>
                        {post.author.role === 'ADMIN' ? 'Admin' : 'Teacher'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(post.createdAt)}</span>
                    {isMe && (
                        <div className="relative">
                            <button onClick={() => setShowMenu(v => !v)}
                                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                <MoreVertical size={12} />
                            </button>
                            {showMenu && (
                                <div className="absolute top-6 right-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[110px]">
                                    <button onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted transition-colors">
                                        <Trash2 size={11} /> Delete post
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'text-white rounded-tr-sm' : 'bg-card border border-border/40 text-foreground rounded-tl-sm'}`}
                    style={isMe ? { background: '#7C3AED' } : {}}>
                    <LinkifiedText
                        text={post.text}
                        className={isMe ? 'text-white underline decoration-white/70 hover:opacity-80 break-all' : 'text-primary underline hover:opacity-80 break-all'}
                    />
                    {post.attachmentUrl && post.attachmentName && post.attachmentType && (
                        <div className="mt-2">
                            <AttachmentPreview attachment={{ url: post.attachmentUrl, name: post.attachmentName, type: post.attachmentType }} dark={isMe} compact />
                        </div>
                    )}
                </div>
                <div className={`flex items-center gap-3 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <button onClick={() => onLike(post.id)}
                        className={`flex items-center gap-1 text-[11px] font-medium transition-all ${post.liked ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-400'}`}>
                        <ThumbsUp size={12} fill={post.liked ? 'currentColor' : 'none'} />
                        {post.likeCount > 0 && post.likeCount}
                    </button>
                    <button onClick={() => setShowComments(v => !v)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-all">
                        <MessageCircle size={12} />
                        {post.comments.length > 0 && post.comments.length}
                    </button>
                </div>
                <AnimatePresence>
                    {showComments && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }} className="overflow-hidden w-full mt-1">
                            <div className="space-y-1.5 mb-2">
                                {post.comments.map(c => (
                                    <div key={c.id} className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${c.author.role === 'ADMIN' ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' : getAvatarColor(c.author.id)}`}>
                                            {getInitials(c.author.name)}
                                        </div>
                                        <div className="px-2.5 py-1.5 rounded-xl bg-muted/60 border border-border/30 group relative">
                                            <p className="text-[10px] font-semibold text-muted-foreground">{formatDisplayName(c.author.name, c.author.prefix)}</p>
                                            <p className="text-xs text-foreground"><LinkifiedText text={c.text} /></p>
                                            {c.author.id === myUserId && (
                                                <button onClick={() => onDeleteComment(post.id, c.id)}
                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all">
                                                    <Trash2 size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <input type="text" value={commentInput} onChange={e => setCommentInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleComment(); } }}
                                    placeholder="Reply..."
                                    className="flex-1 h-7 px-3 rounded-xl bg-muted/40 border border-border/40 text-xs focus:outline-none focus:border-primary/50 transition-all" />
                                <button onClick={handleComment} disabled={!commentInput.trim() || submittingComment}
                                    className="w-7 h-7 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    {submittingComment ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <h3 className="text-base font-bold mb-1">Delete Post?</h3>
                        <p className="text-sm text-muted-foreground mb-5">This post will be permanently deleted. Are you sure?</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfirmDelete(false)}
                                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                Cancel
                            </button>
                            <button onClick={() => { onDelete(post.id); setConfirmDelete(false); }}
                                className="h-9 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all">
                                Delete
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function TeacherStaffroom() {
    const [myUserId, setMyUserId] = useState('');
    const [myName, setMyName] = useState('Teacher');
    const [posts, setPosts] = useState<StaffroomPost[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const [postInput, setPostInput] = useState('');
    const [postAttachment, setPostAttachment] = useState<PendingAttachment | null>(null);
    const [postUploading, setPostUploading] = useState(false);
    const [postSubmitting, setPostSubmitting] = useState(false);
    const [feedSearch, setFeedSearch] = useState('');
    const [showFeedSearch, setShowFeedSearch] = useState(false);
    const [threads, setThreads] = useState<DmThread[]>([]);
    const [threadsLoading, setThreadsLoading] = useState(true);
    const [activeDm, setActiveDm] = useState<DmThread | null>(null);
    const [messages, setMessages] = useState<DmMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [dmInput, setDmInput] = useState('');
    const [dmAttachment, setDmAttachment] = useState<PendingAttachment | null>(null);
    const [dmUploading, setDmUploading] = useState(false);
    const [dmSubmitting, setDmSubmitting] = useState(false);
    const [dmSearch, setDmSearch] = useState('');
    const [showDmSearch, setShowDmSearch] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const feedScrollRef = useRef<HTMLDivElement>(null);
    const dmScrollRef = useRef<HTMLDivElement>(null);
    const dmObsRef = useRef<IntersectionObserver | null>(null);
    const [showFeedScrollDown, setShowFeedScrollDown] = useState(false);
    const [showDmScrollDown, setShowDmScrollDown] = useState(false);
    const feedEndRef = useRef<HTMLDivElement>(null);
    const feedInitialScrollDone = useRef(false);
    const messagesInitialScrollDone = useRef(false);
    const postFileRef = useRef<HTMLInputElement>(null);
    const dmFileRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const threadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        api.get('/teacher/me').then(res => {
            const u = res.data.data;
            setMyUserId(u?.userId ?? u?.id ?? '');
            setMyName(u?.name ?? 'Teacher');
        }).catch(() => { });
    }, []);

    // Presence heartbeat: ping every 30s to stay online
    // After the first heartbeat, re-fetch threads so online contacts appear immediately
    useEffect(() => {
        const sendBeat = () => api.post('/teacher/presence').catch(() => {});
        sendBeat().then(() => {
            api.get('/teacher/staffroom/dms')
                .then(res => setThreads(res.data.data))
                .catch(() => {});
        });
        heartbeatRef.current = setInterval(sendBeat, 30000);
        return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
    }, []);

    // Thread list refresh every 15s to pick up presence changes
    useEffect(() => {
        threadPollRef.current = setInterval(() => {
            api.get('/teacher/staffroom/dms')
                .then(res => setThreads(res.data.data))
                .catch(() => {});
        }, 15000);
        return () => { if (threadPollRef.current) clearInterval(threadPollRef.current); };
    }, []);

    useEffect(() => {
        api.get('/teacher/staffroom/posts')
            .then(res => setPosts((res.data.data as StaffroomPost[]).reverse()))
            .catch(() => toast.error('Failed to load staffroom posts'))
            .finally(() => setFeedLoading(false));
    }, []);

    useEffect(() => {
        api.get('/teacher/staffroom/dms')
            .then(res => setThreads(res.data.data))
            .catch(() => { })
            .finally(() => setThreadsLoading(false));
    }, []);

    const fetchMessages = useCallback(async (teacherUserId: string, silent = false) => {
        if (!silent) setMessagesLoading(true);
        try {
            const res = await api.get(`/teacher/staffroom/dms/${teacherUserId}`);
            setMessages(res.data.data);
            setThreads(prev => prev.map(t => t.teacherUserId === teacherUserId ? { ...t, unread: 0 } : t));
        } catch (err: unknown) {
            if (!silent) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                toast.error(msg ?? 'Failed to load messages');
            }
        }
        finally { if (!silent) setMessagesLoading(false); }
    }, []);

    useEffect(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (!activeDm) return;
        messagesInitialScrollDone.current = false;
        fetchMessages(activeDm.teacherUserId);
        pollRef.current = setInterval(() => fetchMessages(activeDm.teacherUserId, true), 4000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [activeDm, fetchMessages]);

    // Feed scroll-down button via IntersectionObserver (flex-col-reverse safe)
    useEffect(() => {
        if (!feedEndRef.current || !feedScrollRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => setShowFeedScrollDown(!entry.isIntersecting),
            { root: feedScrollRef.current, threshold: 0 }
        );
        observer.observe(feedEndRef.current);
        return () => observer.disconnect();
    }, [posts]);

    // DM scroll-down button — ref callback on scroll container fires AFTER child refs are set
    const dmScrollCallbackRef = useCallback((node: HTMLDivElement | null) => {
        dmObsRef.current?.disconnect();
        dmObsRef.current = null;
        dmScrollRef.current = node;
        if (!node || !messagesEndRef.current) return;
        dmObsRef.current = new IntersectionObserver(
            ([entry]) => setShowDmScrollDown(!entry.isIntersecting),
            { root: node, threshold: 0 }
        );
        dmObsRef.current.observe(messagesEndRef.current);
    }, []);

    useEffect(() => {
        if (!activeDm) {
            setShowDmScrollDown(false);
            dmObsRef.current?.disconnect();
            dmObsRef.current = null;
        }
    }, [activeDm]);



    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, context: 'post' | 'dm') => {
        const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
        const err = validateAttachment(file);
        if (err) { toast.error(err); return; }
        const setUploading = context === 'post' ? setPostUploading : setDmUploading;
        const setAttachment = context === 'post' ? setPostAttachment : setDmAttachment;
        setUploading(true);
        try {
            const form = new FormData(); form.append('file', file);
            const res = await api.post(`/teacher/staffroom/upload?context=${context === 'dm' ? 'dm' : 'post'}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setAttachment({ url: res.data.data.url, name: res.data.data.name, type: res.data.data.type });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Upload failed');
        }
        finally { setUploading(false); }
    };

    const handlePost = async () => {
        if ((!postInput.trim() && !postAttachment) || postSubmitting) return;
        setPostSubmitting(true);
        try {
            const res = await api.post('/teacher/staffroom/posts', {
                text: postInput.trim() || postAttachment?.name,
                attachmentUrl: postAttachment?.url, attachmentType: postAttachment?.type, attachmentName: postAttachment?.name,
            });
            setPosts(prev => [...prev, res.data.data]);
            setPostInput(''); setPostAttachment(null);
        } catch { toast.error('Failed to post'); }
        finally { setPostSubmitting(false); }
    };

    const handleLike = async (id: string) => {
        try {
            const res = await api.post(`/teacher/staffroom/posts/${id}/like`);
            const { liked, likeCount } = res.data.data;
            setPosts(prev => prev.map(p => p.id === id ? { ...p, liked, likeCount } : p));
        } catch { toast.error('Failed to update like'); }
    };

    const handleDeletePost = async (id: string) => {
        try {
            await api.delete(`/teacher/staffroom/posts/${id}`);
            setPosts(prev => prev.filter(p => p.id !== id));
            toast.success('Post deleted');
        } catch { toast.error('Failed to delete post'); }
    };

    const handleAddComment = async (postId: string, text: string): Promise<StaffroomPost['comments'][0]> => {
        const res = await api.post(`/teacher/staffroom/posts/${postId}/comments`, { text });
        const comment = res.data.data;
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, comment] } : p));
        return comment;
    };

    const handleDeleteComment = async (postId: string, commentId: string) => {
        try {
            await api.delete(`/teacher/staffroom/posts/${postId}/comments/${commentId}`);
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p));
        } catch { toast.error('Failed to delete comment'); }
    };

    const handleSendDm = async () => {
        if ((!dmInput.trim() && !dmAttachment) || !activeDm || dmSubmitting) return;
        setDmSubmitting(true);
        try {
            const res = await api.post(`/teacher/staffroom/dms/${activeDm.teacherUserId}`, {
                text: dmInput.trim() || undefined,
                attachmentUrl: dmAttachment?.url, attachmentType: dmAttachment?.type, attachmentName: dmAttachment?.name,
            });
            const newMsg: DmMessage = res.data.data;
            setMessages(prev => [...prev, newMsg]);
            setThreads(prev => prev.map(t => t.teacherUserId === activeDm.teacherUserId
                ? { ...t, lastMessage: newMsg.text ?? newMsg.attachmentName ?? 'Attachment', lastMessageAt: newMsg.createdAt, lastMessageIsMe: true } : t));
            setDmInput(''); setDmAttachment(null);
        } catch (err: unknown) {
            const data = (err as { response?: { data?: { message?: string; errors?: { field: string; message: string }[] } } })?.response?.data;
            const msg = data?.errors?.length
                ? `${data.message ?? 'Validation failed'}: ${data.errors.map(e => e.message).join(', ')}`
                : (data?.message ?? 'Failed to send message');
            toast.error(msg);
        } finally { setDmSubmitting(false); }
    };

    const openDm = (thread: DmThread) => { setActiveDm(thread); setMessages([]); setDmInput(''); setDmAttachment(null); };
    const filteredPosts = feedSearch.trim() ? posts.filter(p => p.text.toLowerCase().includes(feedSearch.toLowerCase()) || p.author.name.toLowerCase().includes(feedSearch.toLowerCase())) : posts;
    const filteredThreads = dmSearch.trim() ? threads.filter(t => t.name.toLowerCase().includes(dmSearch.toLowerCase())) : threads;
    const myInitials = getInitials(myName);
    // Derive live presence from threads so chat header updates without reopening the DM
    const activeIsOnline = activeDm
        ? (threads.find(t => t.teacherUserId === activeDm.teacherUserId)?.isActive ?? activeDm.isActive)
        : false;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-1 pb-3">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare size={21} /> Staffroom
                </h1>
                <p className="text-[13px] text-muted-foreground">Staff feed &amp; direct messages</p>
                <div className="h-px bg-border/60 mt-2" />
            </div>
            <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-3">
                {/* LEFT — Feed */}
                <div className="relative w-full lg:w-[60%] h-[520px] lg:h-auto shrink-0 lg:shrink flex flex-col min-h-0 overflow-hidden border border-border/50 rounded-2xl bg-card shadow-md shadow-black/20">
                    <div className="px-4 pt-2 pb-1 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users size={16} />
                                <h2 className="text-base font-bold">Staffroom</h2>
                                <div className="relative group">
                                    <div className="w-3 h-3 rounded-full border border-muted-foreground/40 flex items-center justify-center cursor-default">
                                        <span className="text-[10px] text-muted-foreground font-semibold">i</span>
                                    </div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 rounded-lg bg-black/90 text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                                        For staff members only
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-black/90" />
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => { setShowFeedSearch(v => !v); setFeedSearch(''); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                {showFeedSearch ? <X size={14} /> : <Search size={14} />}
                            </button>
                        </div>
                        <AnimatePresence>
                            {showFeedSearch && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mt-2">
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                        <input type="text" value={feedSearch} onChange={e => setFeedSearch(e.target.value)} placeholder="Search posts..." autoFocus
                                            className="w-full h-8 pl-8 pr-3 rounded-4xl border border-border bg-muted/40 text-xs focus:outline-none focus:border-primary/50 transition-all" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div ref={feedScrollRef} className="flex-1 overflow-y-auto min-h-0 bg-background flex flex-col-reverse">
                        <div className="px-4 py-3 space-y-4">
                        {feedLoading
                            ? <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
                            : filteredPosts.length === 0
                                ? <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <MessageSquare size={32} className="text-muted-foreground/30 mb-2" />
                                    <p className="text-sm text-muted-foreground">No posts yet</p>
                                </div>
                                : filteredPosts.map(post => (
                                    <PostCard key={post.id} post={post} myUserId={myUserId}
                                        onLike={handleLike} onDelete={handleDeletePost}
                                        onAddComment={handleAddComment} onDeleteComment={handleDeleteComment} />
                                ))
                        }
                        <div ref={feedEndRef} />
                        </div>
                    </div>

                    <AnimatePresence>
                        {showFeedScrollDown && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ y: 5, transition: { type: 'spring', stiffness: 500, damping: 8 } }}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => { if (feedScrollRef.current) feedScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className="absolute bottom-[72px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-md border border-border/60 bg-card text-foreground z-10 hover:shadow-lg hover:border-primary/40 hover:text-primary"
                                title="Scroll to bottom">
                                <ArrowDown size={15} />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {postAttachment && <div className="px-4 pb-1 shrink-0"><AttachmentChip attachment={postAttachment} onRemove={() => setPostAttachment(null)} /></div>}

                    <div className="border-t border-border/40 px-3 py-1.5 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                                {myInitials || 'T'}
                            </div>
                            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                <input type="text" value={postInput} onChange={e => setPostInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePost(); } }}
                                    placeholder="Write an announcement..."
                                    className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none" />
                                <div className="flex items-center gap-1 shrink-0">
                                    <button type="button" onClick={() => postFileRef.current?.click()} disabled={postUploading}
                                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50">
                                        {postUploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                                    </button>
                                    <button type="button" onClick={() => { if (postFileRef.current) { postFileRef.current.accept = 'image/*'; postFileRef.current.click(); } }} disabled={postUploading}
                                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50">
                                        <ImageIcon size={13} />
                                    </button>
                                </div>
                            </div>
                            <button onClick={handlePost} disabled={(!postInput.trim() && !postAttachment) || postSubmitting || postUploading}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                {postSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            </button>
                        </div>
                    </div>
                    <input ref={postFileRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={e => handleFileSelect(e, 'post')} />
                </div>

                {/* RIGHT — DMs */}
                <div className="w-full lg:w-[40%] h-[420px] lg:h-auto shrink-0 lg:shrink flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden min-h-0 shadow-md shadow-black/20">
                    <div className="px-4 pt-2 pb-1 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold flex items-center gap-2"><User size={16} /> Direct Messages</h2>
                            <button onClick={() => { setShowDmSearch(v => !v); setDmSearch(''); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                {showDmSearch ? <X size={14} /> : <Search size={14} />}
                            </button>
                        </div>
                        <AnimatePresence>
                            {showDmSearch && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mt-2">
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                        <input type="text" value={dmSearch} onChange={e => setDmSearch(e.target.value)} placeholder="Search teachers..." autoFocus
                                            className="w-full h-8 pl-8 pr-3 rounded-4xl border border-border bg-muted/40 text-xs focus:outline-none focus:border-primary/50 transition-all" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <AnimatePresence mode="wait">
                        {!activeDm ? (
                            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto min-h-0">
                                {threadsLoading
                                    ? <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
                                    : filteredThreads.length === 0
                                        ? <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                            <Users size={28} className="text-muted-foreground/30 mb-2" />
                                            <p className="text-xs text-muted-foreground">No conversations yet</p>
                                        </div>
                                        : filteredThreads.map(t => (
                                            <button key={t.teacherUserId} onClick={() => openDm(t)}
                                                className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/30 hover:bg-muted/40 transition-all text-left">
                                                <div className="relative shrink-0">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ${getAvatarColor(t.teacherUserId)}`}>
                                                        {getInitials(t.name)}
                                                    </div>
                                                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${t.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <p className="text-xs font-semibold truncate">{formatDisplayName(t.name, t.prefix)}</p>
                                                        <p className="text-[10px] text-muted-foreground shrink-0 ml-1">{t.lastMessageAt ? fmtTime(t.lastMessageAt) : ''}</p>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground truncate">
                                                        {t.lastMessage ? `${t.lastMessageIsMe ? 'You: ' : ''}${t.lastMessage}` : 'No messages yet'}
                                                    </p>
                                                </div>
                                                {t.unread > 0 && (
                                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                        {t.unread}
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                }
                            </motion.div>
                        ) : (
                            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex-1 flex flex-col min-h-0">
                                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 shrink-0">
                                    <button onClick={() => { setActiveDm(null); if (pollRef.current) clearInterval(pollRef.current); }}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
                                        <ChevronDown size={15} style={{ transform: 'rotate(90deg)' }} />
                                    </button>
                                    <div className="relative shrink-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(activeDm.teacherUserId)}`}>
                                            {getInitials(activeDm.name)}
                                        </div>
                                        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-card ${activeIsOnline ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold">{formatDisplayName(activeDm.name, activeDm.prefix)}</p>
                                        <p className="text-[10px] text-muted-foreground">{activeIsOnline ? '🟢 Active' : '⚫ Inactive'}</p>
                                    </div>
                                </div>

                                <div ref={dmScrollCallbackRef} className="flex-1 overflow-y-auto min-h-0 bg-background flex flex-col-reverse">
                                    <div className="px-3 py-3 space-y-3">
                                    {messagesLoading
                                        ? <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
                                        : messages.length === 0
                                            ? <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <Send size={18} className="text-muted-foreground/30 mb-2" />
                                                <p className="text-xs text-muted-foreground">No messages yet — say hello!</p>
                                            </div>
                                            : messages.map(msg => {
                                                const color = msg.isMe ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' : getAvatarColor(activeDm.teacherUserId);
                                                const initials = msg.isMe ? myInitials || 'T' : getInitials(activeDm.name);
                                                return (
                                                    <div key={msg.id} className={`flex gap-2 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-1 ${color}`}>{initials}</div>
                                                        <div className={`flex flex-col max-w-[75%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                                            <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.isMe ? 'text-white rounded-tr-sm' : 'bg-card border border-border/40 text-foreground rounded-tl-sm'}`}
                                                                style={msg.isMe ? { background: '#7C3AED' } : {}}>
                                                                {msg.text && (
                                                                    <p>
                                                                        <LinkifiedText
                                                                            text={msg.text}
                                                                            className={msg.isMe ? 'text-white underline decoration-white/70 hover:opacity-80 break-all' : 'text-primary underline hover:opacity-80 break-all'}
                                                                        />
                                                                    </p>
                                                                )}
                                                                {msg.attachmentUrl && msg.attachmentName && msg.attachmentType && (
                                                                    <div className={msg.text ? 'mt-1.5' : ''}>
                                                                        <AttachmentPreview attachment={{ url: msg.attachmentUrl, name: msg.attachmentName, type: msg.attachmentType }} dark={msg.isMe} compact />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5 px-1">{fmtDateTime(msg.createdAt)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    }
                                    <div ref={messagesEndRef} />
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {showDmScrollDown && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                            whileHover={{ y: 5, transition: { type: 'spring', stiffness: 500, damping: 8 } }}
                                            whileTap={{ scale: 0.9 }}
                                            transition={{ duration: 0.15 }}
                                            onClick={() => { if (dmScrollRef.current) dmScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                            className="absolute bottom-[72px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-md border border-border/60 bg-card text-foreground z-10 hover:shadow-lg hover:border-primary/40 hover:text-primary"
                                            title="Scroll to bottom">
                                            <ArrowDown size={15} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>

                                {dmAttachment && <div className="px-3 pb-1 shrink-0"><AttachmentChip attachment={dmAttachment} onRemove={() => setDmAttachment(null)} /></div>}

                                <div className="px-3 py-1.5 border-t border-border/40 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                            <input type="text" value={dmInput} onChange={e => setDmInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSendDm(); } }}
                                                placeholder={`Message ${activeDm.name}...`}
                                                className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground/60 focus:outline-none" />
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button type="button" onClick={() => dmFileRef.current?.click()} disabled={dmUploading}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50">
                                                    {dmUploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                                                </button>
                                                <button type="button" onClick={() => { if (dmFileRef.current) { dmFileRef.current.accept = 'image/*'; dmFileRef.current.click(); } }} disabled={dmUploading}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50">
                                                    <ImageIcon size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        <button onClick={handleSendDm} disabled={(!dmInput.trim() && !dmAttachment) || dmSubmitting || dmUploading}
                                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                            {dmSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                        </button>
                                    </div>
                                </div>
                                <input ref={dmFileRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={e => handleFileSelect(e, 'dm')} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}