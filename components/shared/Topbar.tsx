'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LucideIcon, User, LogOut, Settings, Lock, X } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationsBell } from './NotificationsBell';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudentStore } from '@/store/studentStore';
import { useUserAvatarStore } from '@/store/userAvatarStore';
import { useUserTitleStore } from '@/store/userTitleStore';
import { AvatarImage } from '@/components/ui/avatar';
import { formatDisplayName } from '@/lib/displayName';

interface NavItem {
    label: string;
    href: string;
    icon?: LucideIcon;
    activePath?: string | string[];
    locked?: boolean;
    badge?: boolean;
    lockToastMessage?: string;
}

interface TopbarProps {
    navItems?: NavItem[];
    restrictNav?: boolean;
    lockMessage?: string;
}

type RoleKey = 'SUPER_ADMIN' | 'ADMIN' | 'SUB_ADMIN' | 'TEACHER' | 'STUDENT';

const emojiMap: Record<RoleKey, string> = {
    SUPER_ADMIN: '👑',
    ADMIN: '🏛️',
    SUB_ADMIN: '🛡️',
    TEACHER: '🧑‍🏫',
    STUDENT: '🎓',
};

const labelMap: Record<RoleKey, string> = {
    SUPER_ADMIN: 'SuperAdmin',
    ADMIN: 'Admin',
    SUB_ADMIN: 'SubAdmin',
    TEACHER: 'Teacher',
    STUDENT: 'Student',
};

const initialMap: Record<RoleKey, string> = {
    SUPER_ADMIN: 'SA',
    ADMIN: 'A',
    SUB_ADMIN: 'SA',
    TEACHER: 'T',
    STUDENT: 'S',
};

function getRole(pathname: string, userRole?: string | null): RoleKey {
    if (pathname.startsWith('/superadmin')) return 'SUPER_ADMIN';
    if (pathname.startsWith('/admin')) {
        if (userRole === 'SUB_ADMIN') return 'SUB_ADMIN';
        return 'ADMIN';
    }
    if (pathname.startsWith('/teacher')) return 'TEACHER';
    if (pathname.startsWith('/student')) return 'STUDENT';
    const validRoles: RoleKey[] = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'TEACHER', 'STUDENT'];
    if (userRole && validRoles.includes(userRole as RoleKey)) return userRole as RoleKey;
    return 'STUDENT';
}

function RoleBadge() {
    const { user } = useAuthStore();
    const pathname = usePathname();
    const role = getRole(pathname, user?.role);
    const customTitle = useUserTitleStore(s => s.title);
    const roleLabel = (role === 'ADMIN' || role === 'TEACHER' || role === 'SUB_ADMIN') && customTitle ? customTitle : labelMap[role];

    return (
        <div className="group relative flex items-center cursor-pointer">
            <div className="h-9 w-9 flex items-center justify-center rounded-full
                bg-gradient-to-b from-[#F2B8A3] to-[#E28A6B] text-white
                shadow-[0_10px_20px_rgba(218,119,86,0.35),0_4px_6px_rgba(0,0,0,0.15)]">
                <span className="text-[23px] leading-[0] mb-1">
                    {emojiMap[role]}
                </span>
            </div>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                px-2 py-1 text-xs rounded-md bg-black/90 text-white
                opacity-0 group-hover:opacity-100 transition duration-200
                whitespace-nowrap pointer-events-none">
                {roleLabel}
            </div>
        </div>
    );
}

function AvatarMenu({ restrictNav, lockMessage }: { restrictNav?: boolean; lockMessage: string }) {
    const { user, clearAuth } = useAuthStore();
    const [expandedPhoto, setExpandedPhoto] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const role = getRole(pathname, user?.role);
    const customTitle = useUserTitleStore(s => s.title);
    const customPrefix = useUserTitleStore(s => s.prefix);
    const roleLabel = (role === 'ADMIN' || role === 'TEACHER' || role === 'SUB_ADMIN') && customTitle ? customTitle : labelMap[role];
    const studentPhoto = useStudentStore(s => s.photo);
    const studentName = useStudentStore(s => s.name);
    const userAvatarUrl = useUserAvatarStore(s => s.avatarUrl);
    const isStudent = pathname.startsWith('/student');
    const photoUrl = isStudent ? studentPhoto : userAvatarUrl;
    const rawName = isStudent && studentName ? studentName : (user?.name || user?.email || 'Signed in');
    const displayName = (role === 'ADMIN' || role === 'TEACHER' || role === 'SUB_ADMIN') ? formatDisplayName(rawName, customPrefix) : rawName;

    const settingsHref =
        pathname.startsWith('/superadmin') ? '/superadmin/settings' :
            pathname.startsWith('/admin') ? '/admin/settings' :
                pathname.startsWith('/teacher') ? '/teacher/settings' :
                    '/student/settings';

    const profileHref =
        pathname.startsWith('/superadmin') ? '/superadmin/settings' :
            pathname.startsWith('/admin') ? '/admin/profile' :
                pathname.startsWith('/teacher') ? '/teacher/profile' :
                    '/student/profile';

    const handleLogout = async () => {
        try { await api.post('/auth/logout'); } catch { /* ignore */ }
        clearAuth();
        router.replace('/login');
    };

    return (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
                <button className="outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full">
                    <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-border">
                        {photoUrl && <AvatarImage src={photoUrl} alt={displayName} className="object-cover" />}
                        <AvatarFallback className="text-[11px] font-semibold bg-muted text-primary">
                            {isStudent && studentName
                                ? studentName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                                : initialMap[role]}
                        </AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl border border-border/50 shadow-lg bg-card text-card-foreground">
                <div className="flex items-center gap-3 px-2 py-2.5 mb-1">
                    <Avatar
                        onClick={e => { if (photoUrl) { e.stopPropagation(); setMenuOpen(false); setExpandedPhoto(true); } }}
                        className={cn("w-9 h-9 rounded-xl shrink-0", photoUrl && "cursor-pointer")}>
                        {photoUrl && <AvatarImage src={photoUrl} alt={displayName} className="object-cover rounded-xl" />}
                        <AvatarFallback className="rounded-xl bg-muted text-sm font-bold text-primary">
                            {isStudent && studentName
                                ? studentName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                                : initialMap[role]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{displayName}</p>
                        <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
                    </div>
                </div>

                <div className="h-px bg-border/50 mx-1 mb-1" />

                <DropdownMenuItem
                    onClick={() => restrictNav ? toast.error(lockMessage) : router.push(profileHref)}
                    className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
                        restrictNav ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                    )}>
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <User size={13} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium">My Profile</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={() => restrictNav ? toast.error('Set your password to continue') : router.push(settingsHref)}
                    className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
                        restrictNav ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                    )}>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Settings size={13} className="text-slate-600 dark:text-slate-400" />
                    </div>
                    <span className="text-sm font-medium">Settings</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={() => restrictNav ? toast.error(lockMessage) : handleLogout()}
                    className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors mt-0.5",
                        restrictNav ? "opacity-40 cursor-not-allowed" : "hover:bg-red-50 dark:hover:bg-red-950/30"
                    )}>
                    <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
                        <LogOut size={13} className="text-red-500" />
                    </div>
                    <span className="text-sm font-medium text-red-500">Logout</span>
                </DropdownMenuItem>
            </DropdownMenuContent>

            {/* Expanded profile photo — same treatment as My Profile's avatar zoom */}
            <AnimatePresence>
                {expandedPhoto && photoUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setExpandedPhoto(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                            <button
                                onClick={() => setExpandedPhoto(false)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                <X size={14} className="text-white" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </DropdownMenu>
    );
}

export function Topbar({ navItems, restrictNav, lockMessage }: TopbarProps) {
    const pathname = usePathname();
    const effectiveLockMessage = lockMessage ?? 'Set your password to continue';

    return (
        <div className="flex flex-col gap-2 px-2">
            <header className="h-17 rounded-4xl bg-card shadow-sm flex items-center justify-between px-3 sm:px-5 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Image
                        src="/QubeEx_darkmode_DA7756.png"
                        alt="QubeEx Logo"
                        width={33}
                        height={33}
                        style={{ width: 'auto', height: '40px' }}
                        className="rounded-md shrink-0"
                    />
                    <div className="flex items-end gap-1.5 -mt-1 min-w-0">
                        <span className="text-[19px] sm:text-[25.5px] font-bold text-[#374151] dark:text-[#FAE5D9] truncate" style={{ fontFamily: 'var(--font-poppins)' }}>
                            QubeEx
                        </span>
                        <span className="hidden sm:inline-block mb-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border border-border/60 text-muted-foreground tracking-wide bg-transparent">
                            BETA
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <NotificationsBell restrictNav={restrictNav} lockMessage={effectiveLockMessage} />
                    <ThemeToggle />
                    <AvatarMenu restrictNav={restrictNav} lockMessage={effectiveLockMessage} />
                </div>
            </header>

            {navItems && (
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/30 w-fit max-w-full items-center">
                <div className="flex gap-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {navItems.map((item) => {
                        const activePaths = item.activePath
                            ? (Array.isArray(item.activePath) ? item.activePath : [item.activePath])
                            : [];
                        const isActive = pathname === item.href ||
                            pathname.startsWith(item.href + '/') ||
                            activePaths.some((p) => pathname.startsWith(p));
                        const Icon = item.icon;

                        if (item.locked) {
                            return (
                                <div
                                    key={item.href}
                                    className="relative flex-1 min-w-fit opacity-40 cursor-not-allowed"
                                    onClick={() => toast.error(item.lockToastMessage ?? 'Access restricted - contact your admin')}
                                >
                                    <div className="relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl text-muted-foreground">
                                        {Icon && <Icon size={15} />}
                                        {item.label}
                                        <Lock size={11} className="-ml-0.5" />
                                    </div>
                                </div>
                            );
                        }

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
                                    <span className="relative">
                                        {Icon && <Icon size={15} />}
                                        {item.badge && (
                                            <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 border border-background" />
                                        )}
                                    </span>
                                    {item.label}
                                </div>
                            </Link>
                        );
                    })}
                </div>

                    <div className="h-5 w-px bg-border mx-1.5 shrink-0" />
                    <div className="ml-1 shrink-0">
                        <RoleBadge />
                    </div>
                </div>
            )}
        </div>
    );
}