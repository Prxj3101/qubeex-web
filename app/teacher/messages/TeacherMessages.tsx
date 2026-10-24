'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Thread {
    id: string;
    studentName: string;
    rollNo: string | null;
    className: string | null;
    unread: number;
    lastMessage: { text: string; fromTeacher: boolean; createdAt: string } | null;
    lastMessageAt: string;
}

interface Message {
    id: string;
    fromTeacher: boolean;
    text: string;
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
    const [data, setData] = useState<ThreadsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
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

    const send = async () => {
        const body = text.trim();
        if (!body || !activeId || sending) return;
        setSending(true);
        try {
            const res = await api.post<{ data: { message: Message } }>(`/teacher/parent-chat/threads/${activeId}/messages`, { text: body });
            setMessages(prev => [...prev, res.data.data.message]);
            lastCreatedAt.current = res.data.data.message.createdAt;
            setText('');
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
            <div className="flex items-center gap-2 px-1">
                <MessageCircle size={18} className="text-primary" />
                <h1 className="text-lg font-semibold">Parent messages</h1>
                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                    <ShieldCheck size={12} /> School administrators can view these conversations.
                </span>
            </div>

            {data && !data.settings.enabled && (
                <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                    Parent chat is turned off by your school. You can read old messages but not reply.
                </div>
            )}

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3">
                <div className="rounded-2xl border border-border bg-card overflow-y-auto" data-dashboard-surface="">
                    {loading ? (
                        <p className="p-4 text-sm text-muted-foreground">Loading…</p>
                    ) : data && data.threads.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">
                            No parent messages yet. Parents can message you from Parent Mode in the student app.
                        </p>
                    ) : data?.threads.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveId(t.id)}
                            className={cn(
                                'w-full text-left px-4 py-3 border-b border-border/60 flex items-start gap-3 hover:bg-muted/50 transition-colors',
                                t.id === activeId && 'bg-muted/60',
                            )}
                        >
                            <div className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                                {t.studentName[0]?.toUpperCase() ?? '?'}
                            </div>
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
                        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                            Select a conversation to read and reply.
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-3 border-b border-border">
                                <p className="text-sm font-semibold">Parent of {active.studentName}</p>
                                <p className="text-xs text-muted-foreground">
                                    {[active.className, active.rollNo ? `Roll ${active.rollNo}` : null].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2">
                                {messages.map(m => {
                                    const mine = m.fromTeacher;
                                    return (
                                        <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                                            <div className={cn(
                                                'max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                                                mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
                                                m.hidden && 'italic opacity-70',
                                            )}>
                                                {m.hidden ? 'This message was removed by the school.' : m.text}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatTime(m.createdAt)}</span>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                            <form
                                onSubmit={e => { e.preventDefault(); send(); }}
                                className="p-3 border-t border-border flex items-end gap-2"
                            >
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
                                <Button type="submit" size="icon" disabled={sending || !text.trim() || (data ? !data.settings.enabled : false)} aria-label="Send">
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
