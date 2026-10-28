'use client';

import { useCallback, useEffect, useState } from 'react';
import { EyeOff, FileText, Flag, Save } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Settings { enabled: boolean; officeStart: string; officeEnd: string }

interface ThreadRow {
    id: string;
    studentName: string;
    rollNo: string | null;
    className: string | null;
    teacherName: string;
    messageCount: number;
    reportedCount: number;
    lastMessageAt: string;
}

interface AdminMessage {
    id: string;
    fromTeacher: boolean;
    text: string;
    attachment: { url: string; type: 'image' | 'pdf'; name: string } | null;
    hidden: boolean;
    reportedAt: string | null;
    reportReason: string | null;
    createdAt: string;
}

interface ThreadDetail {
    id: string;
    studentName: string;
    teacherName: string;
    messages: AdminMessage[];
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function ParentChatAdmin() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [saving, setSaving] = useState(false);
    const [threads, setThreads] = useState<ThreadRow[]>([]);
    const [detail, setDetail] = useState<ThreadDetail | null>(null);

    const load = useCallback(async () => {
        try {
            const [s, t] = await Promise.all([
                api.get<{ data: Settings }>('/admin/parent-chat/settings'),
                api.get<{ data: ThreadRow[] }>('/admin/parent-chat/threads'),
            ]);
            setSettings(s.data.data);
            setThreads(t.data.data);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not load parent chat'));
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const res = await api.put<{ data: Settings }>('/admin/parent-chat/settings', settings);
            setSettings(res.data.data);
            toast.success('Parent chat settings saved');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not save settings'));
        } finally {
            setSaving(false);
        }
    };

    const open = async (id: string) => {
        try {
            const res = await api.get<{ data: ThreadDetail }>(`/admin/parent-chat/threads/${id}`);
            setDetail(res.data.data);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not open conversation'));
        }
    };

    const hide = async (messageId: string) => {
        try {
            await api.patch(`/admin/parent-chat/messages/${messageId}/hide`);
            setDetail(d => d && { ...d, messages: d.messages.map(m => (m.id === messageId ? { ...m, hidden: true } : m)) });
            toast.success('Message hidden from parent and teacher');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not hide message'));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3" data-dashboard-surface="">
                <div>
                    <h2 className="text-sm font-semibold">Parent–teacher chat settings</h2>
                    <p className="text-xs text-muted-foreground">
                        Parents message their child&apos;s teachers from Parent Mode. Outside office hours messages are still delivered, but teachers are not notified.
                        Times are in IST.
                    </p>
                </div>
                {settings && (
                    <div className="flex flex-wrap items-end gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={settings.enabled}
                                onChange={e => setSettings({ ...settings, enabled: e.target.checked })}
                            />
                            Chat enabled
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                            Office hours start
                            <input
                                type="time"
                                value={settings.officeStart}
                                onChange={e => setSettings({ ...settings, officeStart: e.target.value })}
                                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                            Office hours end
                            <input
                                type="time"
                                value={settings.officeEnd}
                                onChange={e => setSettings({ ...settings, officeEnd: e.target.value })}
                                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                        </label>
                        <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
                            <Save size={14} /> Save
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3">
                <div className="rounded-2xl border border-border bg-card overflow-y-auto max-h-[60vh]" data-dashboard-surface="">
                    <p className="px-4 py-3 text-sm font-semibold border-b border-border">Conversations</p>
                    {threads.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
                    ) : threads.map(t => (
                        <button
                            key={t.id}
                            onClick={() => open(t.id)}
                            className={cn(
                                'w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/50 transition-colors',
                                detail?.id === t.id && 'bg-muted/60',
                            )}
                        >
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                {t.reportedCount > 0 && (
                                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-semibold">
                                        <Flag size={9} /> {t.reportedCount}
                                    </span>
                                )}
                                <span className="truncate">{t.studentName} ↔ {t.teacherName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {[t.className, t.rollNo ? `Roll ${t.rollNo}` : null].filter(Boolean).join(' · ')} · {t.messageCount} messages · {formatDateTime(t.lastMessageAt)}
                            </p>
                        </button>
                    ))}
                </div>

                <div className="rounded-2xl border border-border bg-card flex flex-col max-h-[60vh]" data-dashboard-surface="">
                    {!detail ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                            Select a conversation to review it. Opening a conversation is recorded in the audit log.
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-3 border-b border-border">
                                <p className="text-sm font-semibold">Parent of {detail.studentName} ↔ {detail.teacherName}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                                {detail.messages.map(m => (
                                    <div key={m.id} className={cn('flex flex-col', m.fromTeacher ? 'items-end' : 'items-start')}>
                                        <div className={cn(
                                            'max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                                            m.fromTeacher ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
                                            m.hidden && 'opacity-60 line-through',
                                        )}>
                                            {m.attachment?.type === 'image' && (
                                                <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="block mb-1">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={m.attachment.url} alt={m.attachment.name} className="max-h-48 rounded-lg object-cover" />
                                                </a>
                                            )}
                                            {m.attachment?.type === 'pdf' && (
                                                <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline mb-1">
                                                    <FileText size={16} /> <span className="truncate">{m.attachment.name}</span>
                                                </a>
                                            )}
                                            {m.text}
                                        </div>
                                        {m.reportedAt && (
                                            <p className="text-[11px] text-red-600 px-1 mt-0.5 flex items-center gap-1">
                                                <Flag size={10} /> Reported{m.reportReason ? `: ${m.reportReason}` : ''}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-0.5 px-1">
                                            <span className="text-[10px] text-muted-foreground">
                                                {m.fromTeacher ? detail.teacherName : `Parent of ${detail.studentName}`} · {formatDateTime(m.createdAt)}
                                            </span>
                                            {m.hidden ? (
                                                <span className="text-[10px] text-muted-foreground">hidden</span>
                                            ) : (
                                                <button
                                                    onClick={() => hide(m.id)}
                                                    className="text-[10px] text-muted-foreground hover:text-red-600 flex items-center gap-0.5"
                                                >
                                                    <EyeOff size={10} /> Hide
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
