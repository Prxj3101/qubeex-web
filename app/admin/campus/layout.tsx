'use client';

import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Rss, LayoutGrid } from 'lucide-react';
import { useMockInstType } from '@/context/MockInstTypeContext';

export default function CampusLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { instType } = useMockInstType();

    const classesLabel = instType === 'COLLEGE' ? 'Departments' : instType === 'COACHING' ? 'Batches' : 'Classes';

    const TABS = [
        { key: 'feed', label: 'Feed', icon: Rss, href: '/admin/campus' },
        { key: 'classes', label: classesLabel, icon: LayoutGrid, href: '/admin/campus/classes' },


    ];

    const activeTab = pathname.startsWith('/admin/campus/classes') ? 'classes' : 'feed';

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {(pathname === '/admin/campus' || pathname === '/admin/campus/classes') && (
                <div className="shrink-0 pt-0 pb-2 px-1">
                    <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const Icon = tab.icon;
                            return (
                                <button key={tab.key} onClick={() => router.push(tab.href)} className="relative">
                                    {isActive && (
                                        <motion.div
                                            layoutId="campusTab"
                                            className="absolute inset-0 bg-primary rounded-4xl"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                        />
                                    )}
                                    <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
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
            {/* Page content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}