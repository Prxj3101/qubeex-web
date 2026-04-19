'use client';

import type { AdminOverview } from '@/types';

const dotColor: Record<string, string> = {
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
};

interface RecentActivityCardProps {
    activity: AdminOverview['recentActivity'];
}

export function RecentActivityCard({ activity }: RecentActivityCardProps) {
    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Recent activity</p>
            </div>
            {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No recent activity.</p>
            ) : (
                <div className="space-y-0.5">
                    {activity.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor[log.dot] ?? 'bg-muted-foreground'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground leading-relaxed">{log.text}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{log.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
