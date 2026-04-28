'use client';

import Link from 'next/link';
import { TicketIcon, Bug, Sparkles, CreditCard, HelpCircle, AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import type { AdminOverview } from '@/types';

type TicketCategory = 'BUG' | 'FEATURE' | 'BILLING' | 'OTHER';
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const CATEGORY_CFG: Record<TicketCategory, { label: string; cls: string; icon: React.ElementType }> = {
    BUG: { label: 'Bug', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', icon: Bug },
    FEATURE: { label: 'Feature', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', icon: Sparkles },
    BILLING: { label: 'Billing', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', icon: CreditCard },
    OTHER: { label: 'Other', cls: 'bg-muted text-muted-foreground', icon: HelpCircle },
};

const STATUS_CFG: Record<TicketStatus, { label: string; cls: string; dot: string; icon: React.ElementType }> = {
    OPEN: { label: 'Open', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', dot: 'bg-blue-500', icon: AlertCircle },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500', icon: Loader2 },
    RESOLVED: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500', icon: CheckCircle2 },
    CLOSED: { label: 'Closed', cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', icon: X },
};

const PRIORITY_CFG: Record<TicketPriority, { label: string; cls: string }> = {
    LOW: { label: 'Low', cls: 'text-muted-foreground border-border' },
    MEDIUM: { label: 'Medium', cls: 'text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-800' },
    HIGH: { label: 'High', cls: 'text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-800' },
    URGENT: { label: 'Urgent', cls: 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-800' },
};

interface TicketsSummaryCardProps {
    tickets: AdminOverview['tickets'];
}

export function NotificationsPreviewCard({ tickets }: TicketsSummaryCardProps) {
    const openCount = tickets.filter(t => t.status === 'OPEN').length;
    const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <TicketIcon size={15} className="text-muted-foreground" />
                    <p className="text-sm font-medium">My Tickets</p>
                </div>
                <Link href="/admin/support/tickets" className="text-xs text-primary hover:underline">
                    View all →
                </Link>
            </div>

            {/* Summary pills */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                    {openCount} Open
                </span>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                    {inProgressCount} In Progress
                </span>
                <span className="text-[11px] text-muted-foreground">
                    {tickets.length} total
                </span>
            </div>

            {tickets.length === 0 ? (
                <div className="flex items-center gap-3 py-4 text-xs text-muted-foreground">
                    <TicketIcon size={14} />
                    No tickets raised yet.
                </div>
            ) : (
                <div className="space-y-0.5">
                    {tickets.slice(0, 3).map((t) => {
                        const cat = CATEGORY_CFG[t.category];
                        const status = STATUS_CFG[t.status];
                        const priority = PRIORITY_CFG[t.priority];
                        const CatIcon = cat.icon;
                        return (
                            <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-none">
                                {/* Category icon */}
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.cls}`}>
                                    <CatIcon size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{t.title}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {/* Status dot */}
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                                        <span className="text-[10px] text-muted-foreground">{status.label}</span>
                                        <span className="text-muted-foreground/40">·</span>
                                        <span className={`text-[10px] font-medium border px-1.5 py-0 rounded-full ${priority.cls}`}>
                                            {priority.label}
                                        </span>
                                        <span className="text-muted-foreground/40">·</span>
                                        <span className="text-[10px] text-muted-foreground">{t.createdAt}</span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{t.id}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}