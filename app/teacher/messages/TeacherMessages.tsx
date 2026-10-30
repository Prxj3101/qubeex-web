'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Flag, MessageCircle, Paperclip, Send, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, EmptyState, ListSkeleton } from '@/components/parent-portal/ui';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface Thread {
    id: string;
    studentName: string;
    rollNo: string | null;
    className: string | null;
    unread: number;
    lastMessage: { text: string; fromTeacher: boolean; createdAt: string } | null;
    lastMessageAt: string;
}

interface Attachment {
    url: string;
    type: 'image' | 'pdf';
    name: string;
}

interface Message {
    id: string;
    fromTeacher: boolean;
    text: string;
    attachment: Attachment | null;
    reportedByMe: boolean;
    hidden: boolean;
    createdAt: string;
    readAt: string | null;
}

interface ThreadsPayload {
    settings: { enabled: boolean; officeStart: string; officeEnd: string; withinOfficeHours: boolean };
    threads: Thread[];
}

const POLL_MS = 15_000;

function formatTime(iso: string): string {
    const d = new Date(iso);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString()
        ? time
        : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

export function TeacherMessages() {
    const confirm = useConfirm();
    const [data, setData] = useState<ThreadsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [pending, setPending] = useState<Attachment | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastCreatedAt = useRef<string | null>(null);

    const loadThreads = useCallback(async () => {
        try {
            const res = await api.get<{ data: ThreadsPayload }>('/teacher/parent-chat/threads');
            setData(res.data.data);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not load messages'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadThreads();
        const id = setInterval(loadThreads, POLL_MS);
        return () => clearInterval(id);
    }, [loadThreads]);

    const markRead = useCallback(async (threadId: string) => {
        try {
            await api.patch(`/teacher/parent-chat/threads/${threadId}/read`);
            loadThreads();
        } catch { /* non-blocking */ }
    }, [loadThreads]);

    const loadMessages = useCallback(async (threadId: string, initial: boolean) => {
        try {
            const params = !initial && lastCreatedAt.current ? { after: lastCreatedAt.current } : undefined;
            const res = await api.get<{ data: { messages: Message[] } }>(`/teacher/parent-chat/threads/${threadId}/messages`, { params });
            const incoming = res.data.data.messages;
            if (initial) setMessages(incoming);
            else if (incoming.length > 0) {
                setMessages(prev => {
                    const seen = new Set(prev.map(m => m.id));
                    return [...prev, ...incoming.filter(m => !seen.has(m.id))];
                });
            }
            if (incoming.length > 0) {
                lastCreatedAt.current = incoming[incoming.length - 1].createdAt;
                if (incoming.some(m => !m.fromTeacher && !m.readAt)) markRead(threadId);
            }
        } catch { /* next poll retries */ }
    }, [markRead]);

    useEffect(() => {
        if (!activeId) return;
        lastCreatedAt.current = null;
        setMessages([]);
        loadMessages(activeId, true);
        const id = setInterval(() => loadMessages(activeId, false), POLL_MS);
        return () => clearInterval(id);
    }, [activeId, loadMessages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const onFile = async (file: File | undefined) => {
        if (fileRef.current) fileRef.current.value = '';
        if (!file) return;
        const isPdf = file.type === 'application/pdf';
        const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
        if (!isPdf && !isImage) { toast.error('Attach a photo (JPG, PNG, WebP) or a PDF'); return; }
        if (file.size > (isPdf ? 10 : 5) * 1024 * 1024) { toast.error(isPdf ? 'PDF must be 10 MB or smaller' : 'Image must be 5 MB or smaller'); return; }
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await api.post<{ data: Attachment }>('/teacher/parent-chat/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPending(res.data.data);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not upload the file'));
        } finally {
            setUploading(false);
        }
    };

    const report = async (m: Message) => {
        const ok = await confirm({
            title: 'Report this message?',
            message: 'The school administrator will be notified and will review it.',
            confirmLabel: 'Report',
            tone: 'warning',
            icon: Flag,
        });
        if (!ok) return;
        try {
            await api.post(`/teacher/parent-chat/messages/${m.id}/report`, {});
            setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, reportedByMe: true } : x)));
            toast.success('Message reported');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not report message'));
        }
    };

    const send = async () => {
        const body = text.trim();
        if ((!body && !pending) || !activeId || sending || uploading) return;
        setSending(true);
        try {
            const res = await api.post<{ data: { message: Message } }>(
                `/teacher/parent-chat/threads/${activeId}/messages`,
                { text: body || undefined, attachment: pending ?? undefined }
            );
            setMessages(prev => [...prev, res.data.data.message]);
            lastCreatedAt.current = res.data.data.message.createdAt;
            setText('');
            setPending(null);
            loadThreads();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not send message'));
        } finally {
            setSending(false);
        }
    };

    const active = data?.threads.find(t => t.id === activeId) ?? null;

    return (
        <div className="flex flex-col gap-3 h-full min-h-0">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                <ShieldCheck size={12} className="text-primary" /> School administrators can view these conversations.
            </p>

            {data && !data.settings.enabled && (
                <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                    Parent chat is turned off by your school. You can read old messages but not reply.
                </div>
            )}

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3">
                <div className="rounded-2xl border border-border bg-card overflow-y-auto" data-dashboard-surface="">
                    {loading ? (
                        <ListSkeleton />
                    ) : data && data.threads.length === 0 ? (
                        <EmptyState icon={MessageCircle} title="No parent messages yet" text="Parents can message you from Parent Mode in the student app." />
                    ) : data?.threads.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveId(t.id)}
                            className={cn(
                                'w-full text-left px-4 py-3 border-b border-border/60 flex items-start gap-3 hover:bg-muted/50 transition-colors',
                                t.id === activeId && 'bg-primary/8',
                            )}
                        >
                            <Avatar name={t.studentName} />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">Parent of {t.studentName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {[t.className, t.rollNo ? `Roll ${t.rollNo}` : null].filter(Boolean).join(' · ')}
                                </p>
                                {t.lastMessage && (
                                    <p className={cn('text-xs truncate mt-0.5', t.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                        {t.lastMessage.fromTeacher ? 'You: ' : ''}{t.lastMessage.text}
                                    </p>
                                )}
                            </div>
                            {t.unread > 0 && (
                                <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center">
                                    {t.unread}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="rounded-2xl border border-border bg-card flex flex-col min-h-0" data-dashboard-surface="">
                    {!active ? (
                        <div className="flex-1 flex items-center justify-center">
                            <EmptyState icon={MessageCircle} title="Select a conversation" text="Pick a parent on the left to read and reply." />
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-gradient-to-r from-primary/12 via-transparent to-transparent">
                                <Avatar name={active.studentName} />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">Parent of {active.studentName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {[active.className, active.rollNo ? `Roll ${active.rollNo}` : null].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2">
                                {messages.map(m => {
                                    const mine = m.fromTeacher;
                                    return (
                                        <div key={m.id} className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}>
                                            <div className={cn(
                                                'max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words flex flex-col gap-1.5',
                                                mine ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-br-sm shadow-sm' : 'bg-muted rounded-bl-sm',
                                                m.hidden && 'italic opacity-70',
                                            )}>
                                                {m.attachment?.type === 'image' && (
                                                    <a href={m.attachment.url} target="_blank" rel="noopener noreferrer">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={m.attachment.url} alt={m.attachment.name} className="max-h-52 rounded-lg object-cover" />
                                                    </a>
                                                )}
                                                {m.attachment?.type === 'pdf' && (
                                                    <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline">
                                                        <FileText size={16} /> <span className="truncate">{m.attachment.name}</span>
                                                    </a>
                                                )}
                                                {(m.hidden || m.text) && <span>{m.hidden ? 'This message was removed by the school.' : m.text}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 px-1">
                                                <span className="text-[10px] text-muted-foreground">{formatTime(m.createdAt)}</span>
                                                {!mine && !m.hidden && (m.reportedByMe ? (
                                                    <span className="text-[10px] text-muted-foreground">Reported</span>
                                                ) : (
                                                    <button
                                                        onClick={() => report(m)}
                                                        className="text-[10px] text-muted-foreground hover:text-red-600 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                    >
                                                        <Flag size={10} /> Report
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                            {pending && (
                                <div className="px-3 pt-2 flex items-center gap-2 text-xs text-muted-foreground border-t border-border">
                                    <FileText size={14} /> <span className="truncate">{pending.name}</span>
                                    <button onClick={() => setPending(null)} aria-label="Remove attachment"><X size={14} /></button>
                                </div>
                            )}
                            <form
                                onSubmit={e => { e.preventDefault(); send(); }}
                                className="p-3 border-t border-border flex items-end gap-2"
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    className="hidden"
                                    onChange={e => onFile(e.target.files?.[0])}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploading || !!pending || (data ? !data.settings.enabled : false)}
                                    aria-label="Attach photo or PDF"
                                >
                                    <Paperclip size={16} />
                                </Button>
                                <textarea
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                                    }}
                                    maxLength={1000}
                                    rows={1}
                                    placeholder="Type a reply…"
                                    disabled={data ? !data.settings.enabled : false}
                                    className="flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm max-h-32 outline-none focus:border-primary"
                                />
                                <Button type="submit" size="icon" disabled={sending || uploading || (!text.trim() && !pending) || (data ? !data.settings.enabled : false)} aria-label="Send">
                                    <Send size={16} />
                                </Button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
