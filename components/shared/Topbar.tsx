'use client';

import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bell, Crown, ShieldCheck, GraduationCap, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface NavItem {
    label: string;
    href: string;
    icon?: any;
}

interface TopbarProps {
    navItems?: NavItem[];
}


import { motion } from 'framer-motion';
import { useState, useRef } from 'react';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';

function RoleBadge() {
    const { user } = useAuthStore();

    const pathname = usePathname();

    const role =
        user?.role ??
        (pathname.startsWith('/superadmin') ? 'SUPER_ADMIN' :
            pathname.startsWith('/admin') ? 'ADMIN' :
                pathname.startsWith('/teacher') ? 'TEACHER' :
                    'STUDENT');

    const emojiMap = {
        SUPER_ADMIN: '👑',
        ADMIN: '🏛️',
        TEACHER: '🧑‍🏫',
        STUDENT: '🎓',
    } as const;

    const labelMap = {
        SUPER_ADMIN: 'SuperAdmin',
        ADMIN: 'Admin',
        TEACHER: 'Teacher',
        STUDENT: 'Student',
    } as const;

    const currentRole = (role && role in emojiMap ? role : 'STUDENT') as keyof typeof emojiMap;

    return (
        <div className="group relative flex items-center cursor-pointer">

            {/* Circle */}
            <div className="h-9 w-9 flex items-center justify-center rounded-full 
                bg-gradient-to-b from-[#F2B8A3] to-[#E28A6B] text-white
                shadow-[0_10px_20px_rgba(218,119,86,0.35),
                        0_4px_6px_rgba(0,0,0,0.15)]">

                <span className="text-[23px] leading-none">
                    {emojiMap[currentRole]}
                </span>
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                px-2 py-1 text-xs rounded-md bg-black/90 text-white
                opacity-0 group-hover:opacity-100 transition duration-200
                whitespace-nowrap pointer-events-none">

                {labelMap[currentRole]}
            </div>

        </div>
    );

    const [show, setShow] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleHover = () => {
        setShow(true);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setShow(false);
        }, 3000);
    };
}

export function Topbar({ navItems }: TopbarProps) {
    const { user } = useAuthStore();
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-2 px-2">
            {/* Header */}
            <header className="h-17 rounded-4xl border bg-card shadow-sm flex items-center justify-between px-5">
                <div className="flex items-center gap-2.5">
                    <Image
                        src="/QubeEx_darkmode_DA7756.png"
                        alt="QubeEx Logo"
                        width={33}
                        height={33}
                        style={{ width: 'auto', height: '40px' }}
                        className="rounded-md"
                    />
                    <span className="text-[25px] font-bold text-[#374151] dark:text-[#FAE5D9]" style={{ fontFamily: 'var(--font-poppins)' }}>
                        QubeEx
                    </span>
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="relative h-8 w-8">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    </Button>
                    <ThemeToggle />
                    <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[11px] bg-primary text-white">
                            {user?.email?.[0]?.toUpperCase() ?? 'U'}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </header>

            {/* Tabs + Role Badge Row */}
            {navItems && (
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit items-center">

                    {/* Tabs */}
                    {navItems.map((item) => {
                        const isActive =
                            pathname === item.href || pathname.startsWith(item.href + "/");

                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative flex-1 min-w-fit"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <div
                                    className={cn(
                                        "relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl",
                                        isActive
                                            ? "text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {Icon && <Icon size={15} />}
                                    {item.label}
                                </div>
                            </Link>
                        );
                    })}

                    {/* Divider */}
                    <div className="h-5 w-px bg-border mx-1.5" />

                    {/* Role Badge inside tabs */}
                    <div className="ml-1">
                        <RoleBadge />
                    </div>
                </div>
            )}
        </div>
    );
}
