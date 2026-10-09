'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Headset, TicketIcon, Star } from 'lucide-react';

const SUPPORT_TABS = [
    { label: 'Tickets', href: '/admin/support/tickets', icon: TicketIcon },
    { label: 'Reviews & Feedback', href: '/admin/support/feedback', icon: Star },
];

export default function SupportHeader({ children, subtitle }: { children: React.ReactNode; subtitle: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="shrink-0 px-1 sticky top-0 z-20 bg-background">
            <div className="shrink-0 bg-background pb-0">
                <div className="flex items-center flex-wrap gap-3">
                    <div className="w-44 max-w-full shrink-0">
                        <h1 className="text-xl font-bold flex items-center gap-2"><Headset size={21} />Support</h1>
                        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
                    </div>
                    <div className="max-w-full shrink-0 overflow-x-auto">
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                            {SUPPORT_TABS.map(tab => {
                                const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                                const Icon = tab.icon;
                                return (
                                    <Link key={tab.href} href={tab.href} className="relative" aria-current={isActive ? 'page' : undefined}>
                                        {isActive && <motion.div layoutId="adminSupportTab" className="absolute inset-0 bg-primary rounded-4xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                                        <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                            <Icon size={14} />{tab.label}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2 flex-wrap">{children}</div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

        </div>
    );
}
