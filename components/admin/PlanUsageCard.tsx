'use client';

import Link from 'next/link';
import type { AdminOverview } from '@/types';
import { ArrowUpRight } from 'lucide-react';

interface PlanUsageCardProps {
    plan: AdminOverview['plan'];
}

function formatBytes(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
}

export function PlanUsageCard({ plan }: PlanUsageCardProps) {
    const bars = [
        { label: 'Users', used: plan.usage.users.used, limit: plan.usage.users.limit, format: (n: number) => n.toLocaleString('en-IN') },
        { label: 'Storage', used: plan.usage.storage.used, limit: plan.usage.storage.limit, format: formatBytes },
    ];

    return (
        <div className="bg-card border border-border/50 rounded-xl p-4 lg:p-5 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">Current plan</p>
                    <p className="text-lg font-semibold">{plan.name}</p>
                </div>
                {plan.name.toUpperCase() !== 'PRO' && (
                    <Link
                        href="/admin/insights/subscription"
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                        Request upgrade <ArrowUpRight size={12} />
                    </Link>
                )}
            </div>

            <div className="space-y-3">
                {bars.map((b) => {
                    const isInfinite = b.label === 'Users';
                    const pct = Math.min(100, Math.round((b.used / b.limit) * 100));
                    const overLimit = isInfinite ? false : b.used >= b.limit;
                    return (
                        <div key={b.label}>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-muted-foreground">{b.label}</span>
                                <span className="text-xs font-medium">
                                    {b.format(b.used)} <span className="text-muted-foreground">/ {b.label === 'Users' ? '∞' : b.format(b.limit)}</span>
                                </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${overLimit ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
