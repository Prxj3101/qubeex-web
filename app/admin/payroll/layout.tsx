'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Send, FileText, Layers, Settings2, SlidersHorizontal } from 'lucide-react';

// Components and Templates live inside Settings (switched with the toggle on the
// right of the tab bar); their URLs stay the same so old links keep working.
const SETTINGS_PAGES = [
    { label: 'General',    href: '/admin/payroll/settings',   icon: SlidersHorizontal },
    { label: 'Components', href: '/admin/payroll/components', icon: Layers },
    { label: 'Templates',  href: '/admin/payroll/templates',  icon: FileText },
];

const PAYROLL_TABS = [
    { label: 'Payroll Runs', href: '/admin/payroll/runs',     icon: Send,      match: ['/admin/payroll/runs'] },
    { label: 'Staff',        href: '/admin/payroll/staff',    icon: Users,     match: ['/admin/payroll/staff'] },
    { label: 'Settings',     href: '/admin/payroll/settings', icon: Settings2, match: SETTINGS_PAGES.map(p => p.href) },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const inSettings = SETTINGS_PAGES.some(p => under(pathname, p.href));

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Tab bar (+ Settings sub-toggle on the right) */}
            <div className="shrink-0 pt-0 pb-1 px-1 flex items-center justify-between gap-3 overflow-x-auto">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit shrink-0">
                    {PAYROLL_TABS.map((tab) => {
                        const isActive = tab.match.some(h => under(pathname, h));
                        const Icon = tab.icon;

                        return (
                            <Link key={tab.href} href={tab.href} className="relative">
                                {isActive && (
                                    <motion.div
                                        layoutId="payrollTab"
                                        className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap
                                    ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <Icon size={14} />
                                    {tab.label}
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {inSettings && (
                    // same toggle style as Attendance → Daily / Overall
                    <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50 shrink-0">
                        {SETTINGS_PAGES.map(({ label, href, icon: Icon }) => {
                            const active = under(pathname, href);
                            return (
                                <Link key={href} href={href}
                                    className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <Icon size={14} />
                                    {label}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-1 pb-6">
                {children}
            </div>
        </div>
    );
}
