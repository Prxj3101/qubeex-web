'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BarChart2, CreditCard, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const INSIGHTS_TABS = [
    { label: 'Analytics', href: '/admin/insights/analytics', icon: BarChart2, permKey: 'INSIGHTS_ANALYTICS' },
    { label: 'Subscription', href: '/admin/insights/subscription', icon: CreditCard, permKey: 'INSIGHTS_SUBSCRIPTION' },
];

function TabBar({ isTabLocked }: { isTabLocked: (permKey: string) => boolean }) {
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
                const locked = isTabLocked(tab.permKey);

                if (locked) {
                    return (
                        <div
                            key={tab.href}
                            className="relative opacity-40 cursor-not-allowed"
                            onClick={() => toast.error('Access restricted — contact your admin')}
                        >
                            <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl text-muted-foreground">
                                <Icon size={14} />
                                {tab.label}
                                <Lock size={11} />
                            </div>
                        </div>
                    );
                }

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

function RedirectGuard({ isTabLocked }: { isTabLocked: (permKey: string) => boolean }) {
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const current = INSIGHTS_TABS.find(t => pathname === t.href || pathname.startsWith(t.href + '/'));
        if (current && isTabLocked(current.permKey)) {
            const first = INSIGHTS_TABS.find(t => !isTabLocked(t.permKey));
            router.replace(first ? first.href : '/admin/overview');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return null;
}

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    function isTabLocked(permKey: string): boolean {
        if (!isSubAdmin) return false;
        return !permissions.includes(permKey);
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Tab bar */}
            <div className="shrink-0 pt-0 pb-2 px-1">
                <Suspense fallback={<div className="h-9" />}>
                    <TabBar isTabLocked={isTabLocked} />
                    <RedirectGuard isTabLocked={isTabLocked} />
                </Suspense>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-1">
                {children}
            </div>
        </div>
    );
}
