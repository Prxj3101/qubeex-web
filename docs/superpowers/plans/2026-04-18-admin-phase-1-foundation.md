# Admin Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Institution Admin module shell — layout, nav, Overview dashboard, Settings, Suspended page, route guard — mirroring the SuperAdmin visual language so Phases 2-5 slot into consistent chrome.

**Architecture:** Next.js App Router pages under `app/admin/*`, with a client-side layout guard that checks `useAuthStore().user.role === 'ADMIN'` and an axios interceptor that routes suspended-institution 403s to `/suspended`. Role-specific dashboard components live under `components/admin/`. A shared `getInstitutionAccent(type)` helper drives per-institution-type theming for hero backgrounds (SCHOOL=violet, COLLEGE=emerald, COACHING=amber).

**Tech Stack:** Next.js 16.2.3, React 19, TypeScript, Tailwind 4, shadcn/ui, zustand, axios, react-hook-form + zod, framer-motion, recharts, sonner, lucide-react.

**Spec reference:** `docs/superpowers/specs/2026-04-17-admin-phase-1-foundation-design.md`

**Verification approach:** No unit tests in this repo. Each task ends with `npm run build` (runs TypeScript type-check + Next.js compilation) and, where UI is visible, manual browser verification against the spec's §9 checklist. Commits happen after each passing build.

---

## File Structure Overview

**New files:**

```
app/
  admin/
    layout.tsx                        Admin shell + role guard
    overview/page.tsx                 Dashboard
    settings/page.tsx                 Settings
    structure/page.tsx                Phase-2 stub
    people/page.tsx                   Redirect → /admin/people/teachers
    people/teachers/page.tsx          Phase-3 stub
    insights/page.tsx                 Redirect → /admin/insights/analytics
    insights/analytics/page.tsx       Phase-4 stub
    support/page.tsx                  Redirect → /admin/support/notifications
    support/notifications/page.tsx    Phase-5 stub
    audit-logs/page.tsx               Phase-5 stub
  suspended/page.tsx                  Standalone (no admin layout)

components/
  admin/
    OverviewHero.tsx                  Gradient hero with per-type accent
    StatCards.tsx                     4 summary cards (type-aware 4th label)
    EnrollmentGrowthChart.tsx         6-month BarChart
    PlanUsageCard.tsx                 Plan name + 3 progress bars
    RecentActivityCard.tsx            Dot+text+time list
    NotificationsPreviewCard.tsx      Last-3 notifications with "View all"
    InstitutionDetailsForm.tsx        Settings: editable institution fields
    AccountCard.tsx                   Settings: account info + actions
    ChangePasswordModal.tsx           Settings: password change dialog
    PhaseStub.tsx                     Shared "coming in Phase N" card

lib/
  getInstitutionAccent.ts             Type → { bg, bgDark, emoji, label }
```

**Modified files:**

- `components/shared/Topbar.tsx` — remove dead code in `RoleBadge`, wrap avatar in `DropdownMenu` with Settings + Logout items.
- `lib/api.ts` — extend response interceptor to route `403 INSTITUTION_SUSPENDED` to `/suspended`.
- `types/index.ts` — add `AdminOverview`, `Plan` types; extend `Institution` with `logoUrl`.

---

## Task 1: Types + Institution Accent Helper

**Files:**
- Modify: `types/index.ts`
- Create: `lib/getInstitutionAccent.ts`

- [ ] **Step 1: Extend `types/index.ts` with new types**

Open `types/index.ts` and replace its contents with:

```ts
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';
export type InstitutionType = 'SCHOOL' | 'COLLEGE' | 'COACHING';
export type InstitutionStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface User {
    id: string;
    email: string;
    role: Role;
    institutionId?: string;
    createdAt: string;
}

export interface Institution {
    id: string;
    name: string;
    email: string;
    type: InstitutionType;
    status: InstitutionStatus;
    createdAt: string;
    updatedAt: string;
    users?: User[];
    phone?: string;
    city?: string;
    logoUrl?: string;
}

export interface AuditLog {
    id: string;
    action: string;
    userId: string;
    institutionId?: string;
    createdAt: string;
    user?: User;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface Plan {
    id: string;
    name: 'BASIC' | 'PRO';
    limits: {
        users: number;
        storageMb: number;
        tests: number;
    };
}

export interface AdminOverview {
    institution: {
        id: string;
        name: string;
        type: InstitutionType;
        status: InstitutionStatus;
        logoUrl?: string;
    };
    stats: {
        totalUsers: number;
        totalStudents: number;
        totalTeachers: number;
        totalClasses: number;
    };
    enrollmentGrowth: { month: string; students: number; teachers: number }[];
    plan: {
        name: string;
        usage: {
            users: { used: number; limit: number };
            storage: { used: number; limit: number };
            tests: { used: number; limit: number };
        };
    };
    recentActivity: { id: string; dot: string; text: string; time: string }[];
    notifications: { id: string; title: string; body: string; time: string }[];
}
```

- [ ] **Step 2: Create `lib/getInstitutionAccent.ts`**

```ts
import type { InstitutionType } from '@/types';

export interface InstitutionAccent {
    bg: string;
    bgDark: string;
    emoji: string;
    label: string;
}

export function getInstitutionAccent(type: InstitutionType): InstitutionAccent {
    switch (type) {
        case 'SCHOOL':
            return { bg: '#7C3AED', bgDark: '#4C1D95', emoji: '🏫', label: 'School' };
        case 'COLLEGE':
            return { bg: '#059669', bgDark: '#064E3B', emoji: '🎓', label: 'College' };
        case 'COACHING':
            return { bg: '#D97706', bgDark: '#78350F', emoji: '📚', label: 'Coaching' };
    }
}

export function getFourthStatLabel(type: InstitutionType): string {
    switch (type) {
        case 'SCHOOL': return 'Classes';
        case 'COLLEGE': return 'Courses';
        case 'COACHING': return 'Batches';
    }
}
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: Build succeeds without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/getInstitutionAccent.ts
git commit -m "feat(admin): add AdminOverview/Plan types and institution accent helper"
```

---

## Task 2: Extend axios interceptor for suspension 403

**Files:**
- Modify: `lib/api.ts`

- [ ] **Step 1: Replace `lib/api.ts`**

```ts
import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const code = error.response?.data?.code;

        if (status === 403 && code === 'INSTITUTION_SUSPENDED') {
            localStorage.removeItem('token');
            localStorage.removeItem('auth-storage');
            if (typeof window !== 'undefined' && window.location.pathname !== '/suspended') {
                window.location.href = '/suspended';
            }
            return Promise.reject(error);
        }

        if (status === 401) {
            localStorage.removeItem('token');
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/api.ts
git commit -m "feat(api): route 403 INSTITUTION_SUSPENDED responses to /suspended"
```

---

## Task 3: Suspended page

**Files:**
- Create: `app/suspended/page.tsx`

- [ ] **Step 1: Create `app/suspended/page.tsx`**

```tsx
'use client';

import { ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

export default function SuspendedPage() {
    const router = useRouter();
    const { clearAuth } = useAuthStore();

    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@qubeex.com';

    const handleLogout = () => {
        clearAuth();
        router.replace('/login');
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-8 text-center shadow-sm">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center mb-5">
                    <ShieldAlert size={28} className="text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                    Institution suspended
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                    Your institution&apos;s access has been suspended. Please contact your super admin.
                </p>
                <div className="flex flex-col gap-2">
                    <Button onClick={handleLogout} className="w-full">
                        Logout
                    </Button>
                    <a
                        href={`mailto:${supportEmail}`}
                        className="w-full inline-flex items-center justify-center h-9 rounded-md border border-border bg-transparent text-sm font-medium hover:bg-muted/50 transition-colors"
                    >
                        Contact support
                    </a>
                </div>
            </div>
        </main>
    );
}
```

- [ ] **Step 2: Build + manual check**

Run: `npm run build`
Expected: Build succeeds.

Run: `npm run dev`, then visit `http://localhost:3000/suspended`.
Expected: Red shield icon, "Institution suspended" heading, Logout (primary) and Contact support (secondary mailto link) visible. Theme-aware.

- [ ] **Step 3: Commit**

```bash
git add app/suspended/page.tsx
git commit -m "feat(admin): add /suspended page with logout + support mailto"
```

---

## Task 4: Update Topbar — remove dead code + add avatar dropdown

**Files:**
- Modify: `components/shared/Topbar.tsx`

- [ ] **Step 1: Replace `components/shared/Topbar.tsx`**

```tsx
'use client';

import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
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
    icon?: any;
}

interface TopbarProps {
    navItems?: NavItem[];
}

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
            <div className="h-9 w-9 flex items-center justify-center rounded-full
                bg-gradient-to-b from-[#F2B8A3] to-[#E28A6B] text-white
                shadow-[0_10px_20px_rgba(218,119,86,0.35),0_4px_6px_rgba(0,0,0,0.15)]">
                <span className="text-[23px] leading-none">
                    {emojiMap[currentRole]}
                </span>
            </div>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                px-2 py-1 text-xs rounded-md bg-black/90 text-white
                opacity-0 group-hover:opacity-100 transition duration-200
                whitespace-nowrap pointer-events-none">
                {labelMap[currentRole]}
            </div>
        </div>
    );
}

function AvatarMenu() {
    const { user, clearAuth } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();

    const settingsHref =
        pathname.startsWith('/superadmin') ? '/superadmin/settings' :
            pathname.startsWith('/admin') ? '/admin/settings' :
                pathname.startsWith('/teacher') ? '/teacher/settings' :
                    '/student/settings';

    const handleLogout = () => {
        clearAuth();
        router.replace('/login');
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full">
                    <Avatar className="h-7 w-7 cursor-pointer">
                        <AvatarFallback className="text-[11px] bg-primary text-white">
                            {user?.email?.[0]?.toUpperCase() ?? 'U'}
                        </AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate text-xs">
                    {user?.email ?? 'Signed in'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(settingsHref)}>
                    Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 focus:text-red-600">
                    Logout
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Topbar({ navItems }: TopbarProps) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-2 px-2">
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

                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="relative h-8 w-8">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    </Button>
                    <ThemeToggle />
                    <AvatarMenu />
                </div>
            </header>

            {navItems && (
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit items-center">
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

                    <div className="h-5 w-px bg-border mx-1.5" />

                    <div className="ml-1">
                        <RoleBadge />
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Build + manual check**

Run: `npm run build`
Expected: Build succeeds.

Run: `npm run dev`, visit `/superadmin/overview` (log in as super admin if needed).
Expected: Clicking avatar opens dropdown with email label, "Settings" (navigates to `/superadmin/settings`), and "Logout" (clears auth + routes to `/login`). Nav tabs still work.

- [ ] **Step 3: Commit**

```bash
git add components/shared/Topbar.tsx
git commit -m "refactor(topbar): remove dead code; add avatar dropdown with Settings + Logout"
```

---

## Task 5: PhaseStub component

**Files:**
- Create: `components/admin/PhaseStub.tsx`

- [ ] **Step 1: Create `components/admin/PhaseStub.tsx`**

```tsx
'use client';

import { Hammer } from 'lucide-react';

interface PhaseStubProps {
    phase: number;
    title: string;
    description?: string;
}

export function PhaseStub({ phase, title, description }: PhaseStubProps) {
    return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center max-w-md">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
                    <Hammer size={24} className="text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                    {title}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {description ?? `This module arrives in Phase ${phase}.`}
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: Build succeeds (component not yet rendered, but should compile).

- [ ] **Step 3: Commit**

```bash
git add components/admin/PhaseStub.tsx
git commit -m "feat(admin): add PhaseStub placeholder component"
```

---

## Task 6: Admin layout with route guard

**Files:**
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Create `app/admin/layout.tsx`**

```tsx
'use client';

import { Topbar } from '@/components/shared/Topbar';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    LayoutDashboard,
    Building2,
    Users,
    LineChart,
    LifeBuoy,
    ScrollText,
} from 'lucide-react';

const ADMIN_NAV_ITEMS = [
    { label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
    { label: 'Structure', href: '/admin/structure', icon: Building2 },
    { label: 'People', href: '/admin/people/teachers', icon: Users },
    { label: 'Insights', href: '/admin/insights/analytics', icon: LineChart },
    { label: 'Support', href: '/admin/support/notifications', icon: LifeBuoy },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!user || user.role !== 'ADMIN') {
            router.replace('/login');
            return;
        }
        setReady(true);
    }, [user, router]);

    if (!ready) return null;

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={ADMIN_NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: Build fails because `/admin/overview` and sibling routes don't exist yet — that's expected. Proceed.

If build errors are only "Page not found" types for admin routes, skip this step's expected pass; we'll verify after Task 7. If there are TypeScript errors in `layout.tsx` itself, fix them now.

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(admin): add admin layout with role guard and nav"
```

---

## Task 7: Stub pages for Phase 2-5 + audit-logs

**Files:**
- Create: `app/admin/structure/page.tsx`
- Create: `app/admin/people/page.tsx`
- Create: `app/admin/people/teachers/page.tsx`
- Create: `app/admin/insights/page.tsx`
- Create: `app/admin/insights/analytics/page.tsx`
- Create: `app/admin/support/page.tsx`
- Create: `app/admin/support/notifications/page.tsx`
- Create: `app/admin/audit-logs/page.tsx`

- [ ] **Step 1: Create `app/admin/structure/page.tsx`**

```tsx
import { PhaseStub } from '@/components/admin/PhaseStub';

export default function StructureStubPage() {
    return <PhaseStub phase={2} title="Institution Structure" />;
}
```

- [ ] **Step 2: Create `app/admin/people/page.tsx` (redirect)**

```tsx
import { redirect } from 'next/navigation';

export default function PeopleIndexPage() {
    redirect('/admin/people/teachers');
}
```

- [ ] **Step 3: Create `app/admin/people/teachers/page.tsx`**

```tsx
import { PhaseStub } from '@/components/admin/PhaseStub';

export default function TeachersStubPage() {
    return <PhaseStub phase={3} title="Teachers" />;
}
```

- [ ] **Step 4: Create `app/admin/insights/page.tsx` (redirect)**

```tsx
import { redirect } from 'next/navigation';

export default function InsightsIndexPage() {
    redirect('/admin/insights/analytics');
}
```

- [ ] **Step 5: Create `app/admin/insights/analytics/page.tsx`**

```tsx
import { PhaseStub } from '@/components/admin/PhaseStub';

export default function AnalyticsStubPage() {
    return <PhaseStub phase={4} title="Analytics" />;
}
```

- [ ] **Step 6: Create `app/admin/support/page.tsx` (redirect)**

```tsx
import { redirect } from 'next/navigation';

export default function SupportIndexPage() {
    redirect('/admin/support/notifications');
}
```

- [ ] **Step 7: Create `app/admin/support/notifications/page.tsx`**

```tsx
import { PhaseStub } from '@/components/admin/PhaseStub';

export default function NotificationsStubPage() {
    return <PhaseStub phase={5} title="Notifications" />;
}
```

- [ ] **Step 8: Create `app/admin/audit-logs/page.tsx`**

```tsx
import { PhaseStub } from '@/components/admin/PhaseStub';

export default function AdminAuditLogsStubPage() {
    return <PhaseStub phase={5} title="Audit Logs" />;
}
```

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: Build succeeds. The layout now compiles because all nav-targeted routes resolve.

- [ ] **Step 10: Commit**

```bash
git add app/admin/structure app/admin/people app/admin/insights app/admin/support app/admin/audit-logs
git commit -m "feat(admin): add Phase 2-5 stub pages and redirects"
```

---

## Task 8: Overview sub-components (Hero, StatCards)

**Files:**
- Create: `components/admin/OverviewHero.tsx`
- Create: `components/admin/StatCards.tsx`

- [ ] **Step 1: Create `components/admin/OverviewHero.tsx`**

Dark-mode swap uses a `MutationObserver` on the `<html class="dark">` class toggled by `next-themes`, so the hero background follows the theme reactively without a style-jsx block.

```tsx
'use client';

import type { InstitutionType } from '@/types';
import { getInstitutionAccent } from '@/lib/getInstitutionAccent';
import { useEffect, useState } from 'react';

interface OverviewHeroProps {
    adminName: string;
    institutionName: string;
    institutionType: InstitutionType;
}

export function OverviewHero({ adminName, institutionName, institutionType }: OverviewHeroProps) {
    const accent = getInstitutionAccent(institutionType);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div
            className="-mx-4 relative overflow-hidden rounded-b-[65px] px-13 py-10 flex items-center justify-between"
            style={{ background: isDark ? accent.bgDark : accent.bg }}
        >
            <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
            <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />

            <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
            <div className="absolute w-1 h-1 rounded-full bg-white/70 top-27 left-36 animate-pulse delay-300" />
            <div className="absolute w-1 h-1 rounded-full bg-white/70 top-22 left-5 animate-pulse delay-600" />
            <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

            <div className="space-y-1 z-10">
                <p className="text-white/70 text-base">{greeting} {accent.emoji}, {adminName}</p>
                <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                    {institutionName}
                </p>
                <p className="text-white/60 text-sm">Here&apos;s what&apos;s happening at your {accent.label.toLowerCase()} today.</p>
                <p className="text-white/50 text-xs mt-2">{dateStr}</p>
            </div>

            <div className="z-10 opacity-90 hidden sm:block">
                <svg width="140" height="120" viewBox="0 0 140 120" fill="none">
                    <rect x="10" y="20" width="120" height="85" rx="10" fill="white" fillOpacity="0.12" />
                    <rect x="18" y="28" width="50" height="30" rx="6" fill="white" fillOpacity="0.15" />
                    <rect x="76" y="28" width="46" height="30" rx="6" fill="white" fillOpacity="0.15" />
                    <rect x="18" y="64" width="104" height="6" rx="3" fill="white" fillOpacity="0.1" />
                    <rect x="18" y="74" width="80" height="6" rx="3" fill="white" fillOpacity="0.1" />
                    <rect x="18" y="84" width="60" height="6" rx="3" fill="white" fillOpacity="0.1" />
                    <rect x="24" y="46" width="6" height="8" rx="2" fill="white" fillOpacity="0.5" />
                    <rect x="33" y="40" width="6" height="14" rx="2" fill="white" fillOpacity="0.5" />
                    <rect x="42" y="44" width="6" height="10" rx="2" fill="white" fillOpacity="0.5" />
                    <rect x="51" y="36" width="6" height="18" rx="2" fill="white" fillOpacity="0.7" />
                    <circle cx="99" cy="43" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="3" />
                    <circle cx="99" cy="43" r="10" stroke="white" strokeOpacity="0.8" strokeWidth="3"
                        strokeDasharray="40 23" strokeLinecap="round" />
                </svg>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create `components/admin/StatCards.tsx`**

```tsx
'use client';

import { Users, GraduationCap, BookOpen, Layers } from 'lucide-react';
import type { AdminOverview, InstitutionType } from '@/types';
import { getFourthStatLabel } from '@/lib/getInstitutionAccent';

interface StatCardsProps {
    stats: AdminOverview['stats'];
    institutionType: InstitutionType;
}

export function StatCards({ stats, institutionType }: StatCardsProps) {
    const items = [
        {
            label: 'Total users',
            value: stats.totalUsers.toLocaleString('en-IN'),
            icon: Users,
            iconBg: 'bg-violet-100 dark:bg-violet-950',
            iconColor: 'text-violet-600 dark:text-violet-400',
        },
        {
            label: 'Students',
            value: stats.totalStudents.toLocaleString('en-IN'),
            icon: GraduationCap,
            iconBg: 'bg-emerald-100 dark:bg-emerald-950',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            label: 'Teachers',
            value: stats.totalTeachers.toLocaleString('en-IN'),
            icon: BookOpen,
            iconBg: 'bg-amber-100 dark:bg-amber-950',
            iconColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            label: getFourthStatLabel(institutionType),
            value: stats.totalClasses.toLocaleString('en-IN'),
            icon: Layers,
            iconBg: 'bg-sky-100 dark:bg-sky-950',
            iconColor: 'text-sky-600 dark:text-sky-400',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map((s) => {
                const Icon = s.icon;
                return (
                    <div key={s.label} className="bg-muted/50 rounded-xl p-4 relative">
                        <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                            <Icon size={15} className={s.iconColor} />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                        <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/admin/OverviewHero.tsx components/admin/StatCards.tsx
git commit -m "feat(admin): add OverviewHero and StatCards components"
```

---

## Task 9: Overview sub-components (Chart, PlanUsage, Activity, Notifications)

**Files:**
- Create: `components/admin/EnrollmentGrowthChart.tsx`
- Create: `components/admin/PlanUsageCard.tsx`
- Create: `components/admin/RecentActivityCard.tsx`
- Create: `components/admin/NotificationsPreviewCard.tsx`

- [ ] **Step 1: Create `components/admin/EnrollmentGrowthChart.tsx`**

```tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { AdminOverview, InstitutionType } from '@/types';
import { getInstitutionAccent } from '@/lib/getInstitutionAccent';

interface EnrollmentGrowthChartProps {
    data: AdminOverview['enrollmentGrowth'];
    institutionType: InstitutionType;
}

export function EnrollmentGrowthChart({ data, institutionType }: EnrollmentGrowthChartProps) {
    const accent = getInstitutionAccent(institutionType);

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Enrollment growth</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: accent.bg }} />
                        Students
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-border inline-block" />
                        Teachers
                    </span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} barGap={4}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
                    />
                    <Bar dataKey="students" fill={accent.bg} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="teachers" fill="hsl(var(--border))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
```

- [ ] **Step 2: Create `components/admin/PlanUsageCard.tsx`**

```tsx
'use client';

import Link from 'next/link';
import type { AdminOverview } from '@/types';
import { ArrowUpRight } from 'lucide-react';

interface PlanUsageCardProps {
    plan: AdminOverview['plan'];
}

function formatBytes(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
}

export function PlanUsageCard({ plan }: PlanUsageCardProps) {
    const bars = [
        { label: 'Users', used: plan.usage.users.used, limit: plan.usage.users.limit, format: (n: number) => n.toLocaleString('en-IN') },
        { label: 'Storage', used: plan.usage.storage.used, limit: plan.usage.storage.limit, format: formatBytes },
        { label: 'Tests', used: plan.usage.tests.used, limit: plan.usage.tests.limit, format: (n: number) => n.toLocaleString('en-IN') },
    ];

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">Current plan</p>
                    <p className="text-lg font-semibold">{plan.name}</p>
                </div>
                <Link
                    href="/admin/insights/analytics"
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                    Request upgrade <ArrowUpRight size={12} />
                </Link>
            </div>

            <div className="space-y-3">
                {bars.map((b) => {
                    const pct = Math.min(100, Math.round((b.used / b.limit) * 100));
                    const overLimit = b.used >= b.limit;
                    return (
                        <div key={b.label}>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-muted-foreground">{b.label}</span>
                                <span className="text-xs font-medium">
                                    {b.format(b.used)} <span className="text-muted-foreground">/ {b.format(b.limit)}</span>
                                </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${overLimit ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Create `components/admin/RecentActivityCard.tsx`**

```tsx
'use client';

import type { AdminOverview } from '@/types';

const dotColor: Record<string, string> = {
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
};

interface RecentActivityCardProps {
    activity: AdminOverview['recentActivity'];
}

export function RecentActivityCard({ activity }: RecentActivityCardProps) {
    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Recent activity</p>
            </div>
            {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No recent activity.</p>
            ) : (
                <div className="space-y-0.5">
                    {activity.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor[log.dot] ?? 'bg-muted-foreground'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground leading-relaxed">{log.text}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{log.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Create `components/admin/NotificationsPreviewCard.tsx`**

```tsx
'use client';

import Link from 'next/link';
import type { AdminOverview } from '@/types';
import { Bell } from 'lucide-react';

interface NotificationsPreviewCardProps {
    notifications: AdminOverview['notifications'];
}

export function NotificationsPreviewCard({ notifications }: NotificationsPreviewCardProps) {
    const preview = notifications.slice(0, 3);

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Notifications</p>
                <Link href="/admin/support/notifications" className="text-xs text-primary hover:underline">
                    View all →
                </Link>
            </div>
            {preview.length === 0 ? (
                <div className="flex items-center gap-3 py-4 text-xs text-muted-foreground">
                    <Bell size={14} />
                    No notifications yet.
                </div>
            ) : (
                <div className="space-y-0.5">
                    {preview.map((n) => (
                        <div key={n.id} className="py-2.5 border-b border-border/40 last:border-none">
                            <p className="text-sm font-medium leading-tight">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{n.time}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/admin/EnrollmentGrowthChart.tsx components/admin/PlanUsageCard.tsx components/admin/RecentActivityCard.tsx components/admin/NotificationsPreviewCard.tsx
git commit -m "feat(admin): add chart, plan-usage, activity, notifications cards"
```

---

## Task 10: Overview page assembly

**Files:**
- Create: `app/admin/overview/page.tsx`

- [ ] **Step 1: Create `app/admin/overview/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { AdminOverview } from '@/types';
import { OverviewHero } from '@/components/admin/OverviewHero';
import { StatCards } from '@/components/admin/StatCards';
import { EnrollmentGrowthChart } from '@/components/admin/EnrollmentGrowthChart';
import { PlanUsageCard } from '@/components/admin/PlanUsageCard';
import { RecentActivityCard } from '@/components/admin/RecentActivityCard';
import { NotificationsPreviewCard } from '@/components/admin/NotificationsPreviewCard';
import { Skeleton } from '@/components/ui/skeleton';

// TODO: wire to API — backend endpoint /admin/overview not confirmed ready.
const MOCK_OVERVIEW: AdminOverview = {
    institution: {
        id: 'inst-mock',
        name: 'Delhi Public School',
        type: 'SCHOOL',
        status: 'ACTIVE',
    },
    stats: {
        totalUsers: 248,
        totalStudents: 210,
        totalTeachers: 18,
        totalClasses: 12,
    },
    enrollmentGrowth: [
        { month: 'Nov', students: 180, teachers: 14 },
        { month: 'Dec', students: 188, teachers: 15 },
        { month: 'Jan', students: 194, teachers: 16 },
        { month: 'Feb', students: 201, teachers: 16 },
        { month: 'Mar', students: 206, teachers: 17 },
        { month: 'Apr', students: 210, teachers: 18 },
    ],
    plan: {
        name: 'Pro',
        usage: {
            users: { used: 248, limit: 500 },
            storage: { used: 1840, limit: 5120 },
            tests: { used: 142, limit: 1000 },
        },
    },
    recentActivity: [
        { id: '1', dot: 'violet', text: 'Teacher Ritu Sharma added to Class 10-A', time: '12 min ago' },
        { id: '2', dot: 'emerald', text: '24 new students enrolled in Class 9', time: '1 hr ago' },
        { id: '3', dot: 'amber', text: 'Plan usage crossed 80% for storage', time: '3 hr ago' },
        { id: '4', dot: 'sky', text: 'Monthly test results published', time: '1 day ago' },
        { id: '5', dot: 'violet', text: 'Admin settings updated', time: '2 days ago' },
    ],
    notifications: [
        { id: 'n1', title: 'Upgrade available', body: 'A new plan tier is available with more storage.', time: '2 hr ago' },
        { id: 'n2', title: 'Maintenance window', body: 'Scheduled maintenance on 2026-04-22 from 2-4 AM IST.', time: '1 day ago' },
        { id: 'n3', title: 'New feature: Bulk imports', body: 'You can now import students via CSV.', time: '3 days ago' },
    ],
};

export default function AdminOverviewPage() {
    const { user } = useAuthStore();
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchOverview() {
            try {
                const res = await api.get('/admin/overview');
                if (!cancelled) setOverview(res.data.data);
            } catch {
                if (!cancelled) setOverview(MOCK_OVERVIEW);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchOverview();
        return () => { cancelled = true; };
    }, []);

    if (loading || !overview) {
        return (
            <div className="space-y-6">
                <Skeleton className="-mx-4 h-48 rounded-b-[65px]" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-28 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-56 rounded-xl" />
            </div>
        );
    }

    const adminName = user?.email?.split('@')[0] ?? 'Admin';

    return (
        <div className="space-y-6">
            <OverviewHero
                adminName={adminName}
                institutionName={overview.institution.name}
                institutionType={overview.institution.type}
            />

            <StatCards
                stats={overview.stats}
                institutionType={overview.institution.type}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">
                    <EnrollmentGrowthChart
                        data={overview.enrollmentGrowth}
                        institutionType={overview.institution.type}
                    />
                </div>
                <PlanUsageCard plan={overview.plan} />
            </div>

            <div className="flex flex-col gap-3">
                <RecentActivityCard activity={overview.recentActivity} />
                <NotificationsPreviewCard notifications={overview.notifications} />
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, log in as an ADMIN user (if backend returns ADMIN role). If none available, temporarily set auth in DevTools console:

```js
localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { id: 'u1', email: 'admin@test.com', role: 'ADMIN' }, token: 'fake' }, version: 0 }));
location.href = '/admin/overview';
```

Expected:
- Hero shows violet background (SCHOOL accent), "Good morning 🏫, admin" greeting, institution name.
- 4 stat cards: Total users, Students, Teachers, Classes.
- Growth chart renders 6 months.
- Plan card shows Pro + 3 progress bars (users ~50%, storage ~36%, tests ~14%).
- Recent activity list shows 5 items with colored dots.
- Notifications preview shows 3 items with "View all →".
- Theme toggle still works.

- [ ] **Step 4: Commit**

```bash
git add app/admin/overview/page.tsx
git commit -m "feat(admin): assemble overview dashboard with mock fallback"
```

---

## Task 11: Settings sub-components (InstitutionDetailsForm, AccountCard, ChangePasswordModal)

**Files:**
- Create: `components/admin/InstitutionDetailsForm.tsx`
- Create: `components/admin/AccountCard.tsx`
- Create: `components/admin/ChangePasswordModal.tsx`

- [ ] **Step 1: Create `components/admin/ChangePasswordModal.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const schema = z.object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z.string().min(8, 'Min 8 characters'),
    confirmPassword: z.string().min(8, 'Min 8 characters'),
}).refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

type FormValues = z.infer<typeof schema>;

interface ChangePasswordModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
    const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormValues) => {
        try {
            await api.post('/auth/change-password', {
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });
            toast.success('Password changed');
            reset();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to change password');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Change password</DialogTitle>
                    <DialogDescription>Enter your current password and a new password.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                    <div className="space-y-1">
                        <Label>Current password</Label>
                        <Input type="password" {...register('currentPassword')} />
                        {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label>New password</Label>
                        <Input type="password" {...register('newPassword')} />
                        {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label>Confirm new password</Label>
                        <Input type="password" {...register('confirmPassword')} />
                        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 size={14} className="animate-spin mr-2" />Changing...</> : 'Change password'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Create `components/admin/InstitutionDetailsForm.tsx`**

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Institution, InstitutionType } from '@/types';
import { getInstitutionAccent } from '@/lib/getInstitutionAccent';
import { useRef, useState } from 'react';
import Image from 'next/image';

const schema = z.object({
    name: z.string().min(2, 'Name required'),
    email: z.string().email('Invalid email'),
    phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface InstitutionDetailsFormProps {
    initial: Institution;
    onUpdated?: (updated: Institution) => void;
}

export function InstitutionDetailsForm({ initial, onUpdated }: InstitutionDetailsFormProps) {
    const accent = getInstitutionAccent(initial.type as InstitutionType);
    const [logoUrl, setLogoUrl] = useState<string | undefined>(initial.logoUrl);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: initial.name,
            email: initial.email,
            phone: initial.phone ?? '',
        },
    });

    const onSubmit = async (data: FormValues) => {
        try {
            const res = await api.patch('/admin/institution', data);
            const updated: Institution = res.data.data;
            toast.success('Institution updated');
            reset({ name: updated.name, email: updated.email, phone: updated.phone ?? '' });
            onUpdated?.(updated);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Update failed');
        }
    };

    const onLogoUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('logo', file);
        setUploading(true);
        try {
            const res = await api.post('/admin/institution/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setLogoUrl(res.data.data.logoUrl);
            toast.success('Logo updated');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Logo upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="mb-4">
                <p className="text-sm font-semibold">Institution details</p>
                <p className="text-xs text-muted-foreground">Update your institution&apos;s public info.</p>
            </div>

            <div className="flex items-center gap-4 mb-5">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-border/50 flex items-center justify-center text-2xl"
                    style={{ background: `${accent.bg}20` }}>
                    {logoUrl ? (
                        <Image src={logoUrl} alt="Logo" fill sizes="64px" style={{ objectFit: 'cover' }} />
                    ) : (
                        <span>{accent.emoji}</span>
                    )}
                </div>
                <div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onLogoUpload(f);
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? <><Loader2 size={14} className="animate-spin mr-2" />Uploading...</> : 'Upload logo'}
                    </Button>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input {...register('name')} />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label>Type</Label>
                        <Input value={accent.label} disabled />
                    </div>
                    <div className="space-y-1">
                        <Label>Contact email</Label>
                        <Input type="email" {...register('email')} />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label>Phone</Label>
                        <Input {...register('phone')} />
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 size={14} className="animate-spin mr-2" />Saving...</> : 'Save changes'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
```

- [ ] **Step 3: Create `components/admin/AccountCard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { ChangePasswordModal } from './ChangePasswordModal';

export function AccountCard() {
    const { user, clearAuth } = useAuthStore();
    const router = useRouter();
    const [pwOpen, setPwOpen] = useState(false);

    const handleLogout = () => {
        clearAuth();
        router.replace('/login');
    };

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5 space-y-5">
            <div>
                <p className="text-sm font-semibold">Account</p>
                <p className="text-xs text-muted-foreground">Manage your admin account.</p>
            </div>

            <div className="space-y-1">
                <Label>Email</Label>
                <Input value={user?.email ?? ''} disabled />
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">Change your sign-in password.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
                    Change password
                </Button>
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <div>
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-muted-foreground">Toggle light or dark mode.</p>
                </div>
                <ThemeToggle />
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <div>
                    <p className="text-sm font-medium">Sign out</p>
                    <p className="text-xs text-muted-foreground">End your current session.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600 dark:text-red-400">
                    Logout
                </Button>
            </div>

            <ChangePasswordModal open={pwOpen} onOpenChange={setPwOpen} />
        </div>
    );
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/admin/InstitutionDetailsForm.tsx components/admin/AccountCard.tsx components/admin/ChangePasswordModal.tsx
git commit -m "feat(admin): add institution details form, account card, password modal"
```

---

## Task 12: Settings page assembly

**Files:**
- Create: `app/admin/settings/page.tsx`

- [ ] **Step 1: Create `app/admin/settings/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { InstitutionDetailsForm } from '@/components/admin/InstitutionDetailsForm';
import { AccountCard } from '@/components/admin/AccountCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Institution } from '@/types';

// TODO: wire to API — backend endpoint /admin/institution not confirmed ready.
const MOCK_INSTITUTION: Institution = {
    id: 'inst-mock',
    name: 'Delhi Public School',
    email: 'admin@dps.example.com',
    type: 'SCHOOL',
    status: 'ACTIVE',
    phone: '+91 98765 43210',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-04-18T10:00:00Z',
};

export default function AdminSettingsPage() {
    const [institution, setInstitution] = useState<Institution | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchInstitution() {
            try {
                const res = await api.get('/admin/institution');
                if (!cancelled) setInstitution(res.data.data);
            } catch {
                if (!cancelled) setInstitution(MOCK_INSTITUTION);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchInstitution();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="space-y-4 max-w-3xl pt-2">
            <div>
                <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                    Settings
                </h1>
                <p className="text-sm text-muted-foreground">Manage your institution and account.</p>
            </div>

            {loading || !institution ? (
                <>
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-80 rounded-xl" />
                </>
            ) : (
                <>
                    <InstitutionDetailsForm
                        initial={institution}
                        onUpdated={setInstitution}
                    />
                    <AccountCard />
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. With admin auth in localStorage (from Task 10 Step 3), visit `/admin/settings`.

Expected:
- Page renders "Settings" heading + subtitle.
- Institution details card: logo circle with 🏫 emoji placeholder, "Upload logo" button, Name/Type(disabled)/Email/Phone fields, Save button.
- Typing in Name and clicking Save fires PATCH (expected to fail in mock mode — toast.error shows).
- Account card: email (disabled), "Change password" → modal with 3 fields + validation (mismatch shows error), Theme toggle, Logout.
- Logout clears auth and routes to `/login`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "feat(admin): assemble settings page with institution + account cards"
```

---

## Task 13: Final end-to-end verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors, no unresolved imports.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No errors. Warnings acceptable only if they're pre-existing; any new-code warnings should be fixed.

- [ ] **Step 3: Manual flow check**

Run: `npm run dev`. Walk through the spec §9 checklist:

1. `/login` with admin credentials (or localStorage-injected auth from Task 10) → redirects to `/admin/overview`.
2. Click each primary nav tab:
   - Overview → dashboard renders.
   - Structure → PhaseStub (Phase 2).
   - People → redirects to `/admin/people/teachers` → stub (Phase 3).
   - Insights → redirects to `/admin/insights/analytics` → stub (Phase 4).
   - Support → redirects to `/admin/support/notifications` → stub (Phase 5).
   - Audit Logs → stub (Phase 5).
3. Avatar dropdown → Settings lands on `/admin/settings`; Logout clears auth and routes to `/login`.
4. On Overview, change auth store user-role manually to `STUDENT` via DevTools → on next navigation to `/admin/*`, routed to `/login`.
5. To test suspension flow manually, temporarily inject a 403 in DevTools network tab for `/admin/overview` with body `{"code":"INSTITUTION_SUSPENDED"}` (or stub it in `MOCK_OVERVIEW` fetch by throwing from the try) — page routes to `/suspended`.
6. Change institution type in MOCK_OVERVIEW to `COLLEGE`, refresh → hero is emerald, 4th stat card label is "Courses". Change to `COACHING` → hero is amber, label is "Batches".
7. Theme toggle works on overview, settings, suspended.
8. SuperAdmin pages still work: `/superadmin/overview` renders, avatar dropdown navigates to `/superadmin/settings`.

- [ ] **Step 4: No uncommitted changes**

Run: `git status`
Expected: Working tree clean.

- [ ] **Step 5: Final commit (if any stragglers)**

If manual testing turned up any small fixes, commit them:

```bash
git add <files>
git commit -m "fix(admin): <description>"
```

Otherwise, skip.

---

## Verification Summary

At the end of Task 13, the following should be true:

- `/admin/overview`, `/admin/settings`, `/suspended`, and all stubs are reachable and render.
- Role guard kicks unauthorized users to `/login`.
- Axios interceptor routes `403 INSTITUTION_SUSPENDED` to `/suspended`.
- Overview dashboard theme matches institution type (SCHOOL=violet, COLLEGE=emerald, COACHING=amber).
- 4th stat card label adapts (Classes / Courses / Batches).
- Institution form and change-password modal validate via zod and show sonner toasts.
- Topbar dead code is removed; avatar dropdown shows Settings + Logout and works on both SuperAdmin and Admin contexts.
- `npm run build` passes cleanly; `npm run lint` passes cleanly.
