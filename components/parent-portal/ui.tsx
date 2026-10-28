'use client';

import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Icon = ComponentType<{ size?: number; className?: string }>;

export const CHOICE_COLORS = [
    { bar: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400', chip: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
    { bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400', chip: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
    { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
    { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
    { bar: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400', chip: 'bg-pink-500/12 text-pink-600 dark:text-pink-400' },
    { bar: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', chip: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' },
];

const TONES = {
    primary: 'bg-primary/12 text-primary',
    good: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    bad: 'bg-red-500/12 text-red-600 dark:text-red-400',
    muted: 'bg-muted text-muted-foreground',
} as const;

export function Pill({ tone = 'primary', icon: Icon, children, className }: { tone?: keyof typeof TONES; icon?: Icon; children: ReactNode; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', TONES[tone], className)}>
            {Icon && <Icon size={11} />}{children}
        </span>
    );
}

export function IconTile({ icon: Icon, className }: { icon: Icon; className?: string }) {
    return (
        <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary', className)}>
            <Icon size={18} />
        </span>
    );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
    const initials = name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';
    return (
        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-xs font-bold text-primary-foreground', className)}>
            {initials}
        </span>
    );
}

export function Progress({ value, total, tone = 'bg-primary', className }: { value: number; total: number; tone?: string; className?: string }) {
    const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
    return (
        <div className={cn('h-1.5 rounded-full bg-muted overflow-hidden', className)}>
            <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
        </div>
    );
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'primary' }: { label: string; value: ReactNode; hint?: string; icon: Icon; tone?: 'primary' | 'good' | 'warn' | 'bad' }) {
    const bg = {
        primary: 'from-primary/18 to-primary/[0.03] border-primary/20',
        good: 'from-emerald-500/18 to-emerald-500/[0.03] border-emerald-500/25',
        warn: 'from-amber-500/18 to-amber-500/[0.03] border-amber-500/25',
        bad: 'from-red-500/15 to-red-500/[0.03] border-red-500/25',
    }[tone];
    return (
        <div className={cn('rounded-2xl border bg-gradient-to-br p-3.5 flex items-center gap-3', bg)}>
            <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', TONES[tone])}><Icon size={17} /></span>
            <div className="min-w-0">
                <p className="text-xl font-bold leading-6">{value}</p>
                <p className="text-xs text-muted-foreground truncate">{label}{hint ? ` · ${hint}` : ''}</p>
            </div>
        </div>
    );
}

export function EmptyState({ icon: Icon, title, text }: { icon: Icon; title: string; text?: string }) {
    return (
        <div className="flex flex-col items-center justify-center text-center gap-2 px-6 py-12">
            <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary"><Icon size={26} /></span>
            </span>
            <p className="text-sm font-semibold">{title}</p>
            {text && <p className="text-xs text-muted-foreground max-w-xs">{text}</p>}
        </div>
    );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/70 animate-pulse" />
            ))}
        </div>
    );
}

export function PanelHeader({ title, subtitle, icon: Icon, action }: { title: string; subtitle?: string; icon: Icon; action?: ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-transparent">
            <IconTile icon={Icon} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{title}</p>
                {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}
