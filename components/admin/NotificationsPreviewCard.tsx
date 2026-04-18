'use client';

import Link from 'next/link';
import type { AdminOverview } from '@/types';
import { Bell } from 'lucide-react';

interface NotificationsPreviewCardProps {
    notifications: AdminOverview['notifications'];
}

export function NotificationsPreviewCard({ notifications }: NotificationsPreviewCardProps) {
    const preview = notifications.slice(0, 3);

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Notifications</p>
                <Link href="/admin/support/notifications" className="text-xs text-primary hover:underline">
                    View all →
                </Link>
            </div>
            {preview.length === 0 ? (
                <div className="flex items-center gap-3 py-4 text-xs text-muted-foreground">
                    <Bell size={14} />
                    No notifications yet.
                </div>
            ) : (
                <div className="space-y-0.5">
                    {preview.map((n) => (
                        <div key={n.id} className="py-2.5 border-b border-border/40 last:border-none">
                            <p className="text-sm font-medium leading-tight">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{n.time}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
