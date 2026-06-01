'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Monitor, FolderOpen } from 'lucide-react';

const TABS = [
    { key: 'blackboard', label: 'Blackboard', icon: Monitor, href: '/teacher/blackboard' },
    { key: 'storage', label: 'Storage', icon: FolderOpen, href: '/teacher/blackboard/storage' },
];

export default function BlackboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const activeTab = pathname.startsWith('/teacher/blackboard/storage') ? 'storage' : 'blackboard';

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Sub navbar */}
            <div className="shrink-0 pt-0 pb-2 px-1">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.key;
                        const Icon = tab.icon;
                        return (
                            <Link key={tab.href} href={tab.href} className="relative">
                                {isActive && (
                                    <motion.div
                                        layoutId="blackboardTab"
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

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}