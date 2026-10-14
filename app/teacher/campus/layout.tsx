'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Rss, MessageSquare, Boxes } from 'lucide-react';

const CAMPUS_TABS = [
    { key: 'feed', label: 'Feed', icon: Rss, href: '/teacher/campus' },
    { key: 'staffroom', label: 'Staffroom', icon: MessageSquare, href: '/teacher/campus/staffroom' },
    { key: 'inventory', label: 'Inventory', icon: Boxes, href: '/teacher/campus/inventory' },
];

export default function TeacherCampusLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const activeTab = pathname.startsWith('/teacher/campus/inventory') ? 'inventory' : pathname.startsWith('/teacher/campus/staffroom') ? 'staffroom' : 'feed';

    return (
        <div className="flex flex-col h-full overflow-visible">
            {/* Sub navbar */}
            <div className="shrink-0 pt-0 pb-2 px-1">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {CAMPUS_TABS.map(tab => {
                        const isActive = activeTab === tab.key;
                        const Icon = tab.icon;
                        return (
                            <Link key={tab.href} href={tab.href} className="relative">
                                {isActive && (
                                    <motion.div
                                        layoutId="campusTeacherTab"
                                        className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <Icon size={14} />
                                    {tab.label}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Page content */}
            <div className="flex-1 min-h-0 overflow-visible">
                {children}
            </div>
        </div>
    );
}