'use client';

import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import type { AdminOverview } from '@/types';

const dotColor: Record<string, string> = {
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
};

const dotBg: Record<string, string> = {
    violet: 'bg-violet-100 dark:bg-violet-950/50',
    emerald: 'bg-emerald-100 dark:bg-emerald-950/50',
    amber: 'bg-amber-100 dark:bg-amber-950/50',
    red: 'bg-red-100 dark:bg-red-950/50',
    sky: 'bg-sky-100 dark:bg-sky-950/50',
};

const dotText: Record<string, string> = {
    violet: 'text-violet-700 dark:text-violet-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-red-700 dark:text-red-300',
    sky: 'text-sky-700 dark:text-sky-300',
};

interface RecentAuditLogsCardProps {
    auditLogs: AdminOverview['auditLogs'];
}

export function RecentActivityCard({ auditLogs }: RecentAuditLogsCardProps) {
    return (
        <div className="bg-card border border-border/50 rounded-xl p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ScrollText size={15} className="text-muted-foreground" />
                    <p className="text-sm font-medium">Recent Audit Logs</p>
                </div>
                <Link href="/admin/insights/audit-logs" className="text-xs text-primary hover:underline">
                    View all →
                </Link>
            </div>

            {auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No recent activity.</p>
            ) : (
                <div className="space-y-0.5">
                    {auditLogs.slice(0, 4).map((log) => (
                        <div key={log.id} className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] lg:grid-cols-[140px_1fr] items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit mt-0.5 ${dotBg[log.dot]} ${dotText[log.dot]}`}>
                                {log.action}
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs text-foreground leading-relaxed">{log.detail}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[11px] text-muted-foreground">{log.actor}</p>
                                    <span className="text-muted-foreground/40">·</span>
                                    <p className="text-[11px] text-muted-foreground">{log.time}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}