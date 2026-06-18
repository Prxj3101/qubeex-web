'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { BarChart2, CreditCard } from 'lucide-react';

const INSIGHTS_TABS = [
    { label: 'Analytics', href: '/admin/insights/analytics', icon: BarChart2 },
    { label: 'Subscription', href: '/admin/insights/subscription', icon: CreditCard },
];

function TabBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const from = searchParams.get('from');

    return (
        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
            {INSIGHTS_TABS.map((tab) => {
                const isActive = pathname === tab.href
                    || pathname.startsWith(tab.href + '/')
                    || (pathname === '/admin/insights/users' && from === tab.href.split('/').pop());
                const Icon = tab.icon;
                return (
                    <Link key={tab.href} href={tab.href} className="relative">
                        {isActive && (
                            <motion.div
                                layoutId="insightsTab"
                                className="absolute inset-0 bg-primary rounded-4xl"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                            />
                        )}
                        <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl
                            ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                            <Icon size={14} />
                            {tab.label}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Tab bar */}
            <div className="shrink-0 pt-0 pb-2 px-1">
                <Suspense fallback={<div className="h-9" />}>
                    <TabBar />
                </Suspense>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-1">
                {children}
            </div>
        </div>
    );
}
