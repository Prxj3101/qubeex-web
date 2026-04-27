'use client';

import api from '@/lib/api';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LucideIcon, User, LogOut } from 'lucide-react';
import { NotificationsBell } from './NotificationsBell';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface NavItem {
    label: string;
    href: string;
    icon?: LucideIcon;
}

interface TopbarProps {
    navItems?: NavItem[];
}

type RoleKey = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';

const emojiMap: Record<RoleKey, string> = {
    SUPER_ADMIN: '👑',
    ADMIN: '🏛️',
    TEACHER: '🧑‍🏫',
    STUDENT: '🎓',
};

const labelMap: Record<RoleKey, string> = {
    SUPER_ADMIN: 'SuperAdmin',
    ADMIN: 'Admin',
    TEACHER: 'Teacher',
    STUDENT: 'Student',
};

const initialMap: Record<RoleKey, string> = {
    SUPER_ADMIN: 'SA',
    ADMIN: 'A',
    TEACHER: 'T',
    STUDENT: 'S',
};

function getRole(pathname: string, userRole?: string | null): RoleKey {
    if (pathname.startsWith('/superadmin')) return 'SUPER_ADMIN';
    if (pathname.startsWith('/admin')) return 'ADMIN';
    if (pathname.startsWith('/teacher')) return 'TEACHER';
    if (pathname.startsWith('/student')) return 'STUDENT';
    const validRoles: RoleKey[] = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT'];
    if (userRole && validRoles.includes(userRole as RoleKey)) return userRole as RoleKey;
    return 'STUDENT';
}

function RoleBadge() {
    const { user } = useAuthStore();
    const pathname = usePathname();
    const role = getRole(pathname, user?.role);

    return (
        <div className="group relative flex items-center cursor-pointer">
            <div className="h-9 w-9 flex items-center justify-center rounded-full
                bg-gradient-to-b from-[#F2B8A3] to-[#E28A6B] text-white
                shadow-[0_10px_20px_rgba(218,119,86,0.35),0_4px_6px_rgba(0,0,0,0.15)]">
                <span className="text-[23px] leading-none">
                    {emojiMap[role]}
                </span>
            </div>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                px-2 py-1 text-xs rounded-md bg-black/90 text-white
                opacity-0 group-hover:opacity-100 transition duration-200
                whitespace-nowrap pointer-events-none">
                {labelMap[role]}
            </div>
        </div>
    );
}

function AvatarMenu() {
    const { user, clearAuth } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const role = getRole(pathname, user?.role);

    const settingsHref =
        pathname.startsWith('/superadmin') ? '/superadmin/settings' :
            pathname.startsWith('/admin') ? '/admin/settings' :
                pathname.startsWith('/teacher') ? '/teacher/settings' :
                    '/student/settings';

    const handleLogout = async () => {
        try { await api.post('/auth/logout'); } catch { /* ignore */ }
        clearAuth();
        router.replace('/login');
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full">
                    <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-border">
                        <AvatarFallback className="text-[11px] font-semibold bg-violet-100 dark:bg-[#7C3AED]/25 text-violet-700 dark:text-violet-300">
                            {initialMap[role]}
                        </AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl border border-border/50 shadow-lg bg-card">
                <div className="flex items-center gap-3 px-2 py-2.5 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-[#7C3AED]/25 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300 shrink-0">
                        {initialMap[role]}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{user?.name || user?.email || 'Signed in'}</p>
                        <p className="text-[11px] text-muted-foreground">{labelMap[role]}</p>
                    </div>
                </div>

                <div className="h-px bg-border/50 mx-1 mb-1" />

                <DropdownMenuItem
                    onClick={() => router.push(settingsHref)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-[#7C3AED]/25 flex items-center justify-center shrink-0">
                        <User size={13} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-sm font-medium">My Profile</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors mt-0.5">
                    <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
                        <LogOut size={13} className="text-red-500" />
                    </div>
                    <span className="text-sm font-medium text-red-500">Logout</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Topbar({ navItems }: TopbarProps) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-2 px-2">
            <header className="h-17 rounded-4xl bg-card shadow-sm flex items-center justify-between px-5">
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

                <div className="flex items-center gap-2">
                    <NotificationsBell />
                    <ThemeToggle />
                    <AvatarMenu />
                </div>
            </header>

            {navItems && (
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/30 w-fit items-center">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} className="relative flex-1 min-w-fit">
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <div className={cn(
                                    "relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl",
                                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                                )}>
                                    {Icon && <Icon size={15} />}
                                    {item.label}
                                </div>
                            </Link>
                        );
                    })}

                    <div className="h-5 w-px bg-border mx-1.5" />
                    <div className="ml-1">
                        <RoleBadge />
                    </div>
                </div>
            )}
        </div>
    );
}