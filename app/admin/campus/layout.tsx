'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Rss, LayoutGrid, Lock } from 'lucide-react';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export default function CampusLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { instType } = useMockInstType();
    const { user } = useAuthStore();

    const classesLabel = instType === 'COLLEGE' ? 'Departments' : instType === 'COACHING' ? 'Batches' : 'Classes';

    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    const canSeeFeed = !isSubAdmin || permissions.includes('CAMPUS_FEED');

    const onCampusRoot = pathname === '/admin/campus' || pathname === '/admin/campus/';
    const needsRedirect = !!user && isSubAdmin && !canSeeFeed && onCampusRoot;

    useEffect(() => {
        if (needsRedirect) router.replace('/admin/campus/classes');
    }, [needsRedirect, router]);

    const TABS = [
        { key: 'feed', label: 'Feed', icon: Rss, href: '/admin/campus', locked: !canSeeFeed },
        { key: 'classes', label: classesLabel, icon: LayoutGrid, href: '/admin/campus/classes', locked: false },
    ];

    const activeTab = pathname.startsWith('/admin/campus/classes') ? 'classes' : 'feed';

    // Only show the tab bar on the top-level campus pages (not inside a class detail)
    const showTabs = pathname === '/admin/campus' || pathname === '/admin/campus/classes';

    if (needsRedirect) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {showTabs && (
                <div className="shrink-0 pt-0 pb-2 px-1 overflow-x-auto">
                    <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const Icon = tab.icon;

                            if (tab.locked) {
                                return (
                                    <div
                                        key={tab.key}
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
                                <button key={tab.key} onClick={() => router.push(tab.href)} className="relative">
                                    {isActive && (
                                        <motion.div
                                            layoutId="campusTab"
                                            className="absolute inset-0 bg-primary rounded-4xl"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                        />
                                    )}
                                    <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl transition-colors ${
                                        isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                    }`}>
                                        <Icon size={14} />
                                        {tab.label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
