'use client';

import { Suspense, type ComponentType, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface ParentsHubTab {
    key: string;
    label: string;
    icon: ComponentType<{ size?: number }>;
    content: ReactNode;
    badge?: number;
}

function Hub({ tabs, title, subtitle }: { tabs: ParentsHubTab[]; title: string; subtitle: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const params = useSearchParams();
    const active = tabs.find(t => t.key === params.get('tab')) ?? tabs[0];

    return (
        <div className="flex flex-col gap-3 h-full min-h-0">
            <div className="shrink-0 rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card px-4 py-3 flex flex-wrap items-center justify-between gap-3" data-dashboard-surface="">
                <div className="min-w-0">
                    <h1 className="text-base font-semibold leading-5">{title}</h1>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 max-w-full overflow-x-auto">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => router.replace(`${pathname}?tab=${t.key}`, { scroll: false })}
                            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap transition-colors', active.key === t.key ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                            <t.icon size={14} /> {t.label}
                            {t.badge ? (
                                <span className="min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-4 text-center">{t.badge > 99 ? '99+' : t.badge}</span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">{active.content}</div>
        </div>
    );
}

/** One "Parents" page for chat, forms & polls and parent meetings; the tab lives in `?tab=`. */
export function ParentsHub({ tabs, title = 'Parents', subtitle = 'Messages, forms & polls and meetings with parents' }: { tabs: ParentsHubTab[]; title?: string; subtitle?: string }) {
    return (
        <Suspense fallback={null}>
            <Hub tabs={tabs} title={title} subtitle={subtitle} />
        </Suspense>
    );
}
