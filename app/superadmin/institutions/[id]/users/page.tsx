'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Users, Search, Shield, BookOpen, GraduationCap, Crown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import api from '@/lib/api';

const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DirectoryUser {
    id: string;
    name: string;
    role: 'ADMIN' | 'SUB_ADMIN' | 'TEACHER' | 'STUDENT';
    email: string;
    phone: string | null;
    userId: string;
    class: string | null;
    addedBy: string | null;
    joinedAt: string;
    status: 'ACTIVE' | 'INACTIVE';
}

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; initBg: string }> = {
    ADMIN:     { label: 'Admin',     icon: Crown,         color: 'text-[#DA7756]',          bg: 'bg-[#DA7756]/10',         initBg: '#DA7756' },
    SUB_ADMIN: { label: 'Sub-Admin', icon: Shield,        color: 'text-amber-600',           bg: 'bg-amber-500/10',         initBg: '#D97706' },
    TEACHER:   { label: 'Teacher',   icon: BookOpen,      color: 'text-violet-500',          bg: 'bg-violet-500/10',        initBg: '#7C3AED' },
    STUDENT:   { label: 'Student',   icon: GraduationCap, color: 'text-sky-500',             bg: 'bg-sky-500/10',           initBg: '#0284C7' },
};

type Role = 'ALL' | 'ADMIN' | 'SUB_ADMIN' | 'TEACHER' | 'STUDENT';
type Status = 'ALL' | 'ACTIVE' | 'INACTIVE';

function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SuperadminInstitutionUsersPage() {
    const router = useRouter();
    const params = useParams();
    const instId = params?.id as string;
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role>('ALL');
    const [statusFilter, setStatusFilter] = useState<Status>('ALL');

    // ── Billing month snapshot — shows which users existed as of that month ──
    const now = new Date();
    const BILL_MONTHS = useMemo(() => {
        const arr: { key: number; short: string; year: number; monthIdx: number; isFuture: boolean }[] = [];
        for (let i = 11; i >= -1; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            arr.push({ key: 11 - i, short: MONTHS_S[d.getMonth()], year: d.getFullYear(), monthIdx: d.getMonth(), isFuture: i < 0 });
        }
        return arr;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const currentBillKey = BILL_MONTHS.length - 2; // last non-future month
    const [activeBillMonth, setActiveBillMonth] = useState(currentBillKey);
    const [billMonthOffset, setBillMonthOffset] = useState(Math.max(0, currentBillKey - 1));
    const billSel = BILL_MONTHS[activeBillMonth];
    const isCurrentMonth = activeBillMonth === currentBillKey;

    const [usersAsOfMonth, setUsersAsOfMonth] = useState<DirectoryUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!instId) return;
        setLoading(true);
        api.get(`/superadmin/institutions/${instId}/users`, { params: { year: billSel.year, month: billSel.monthIdx + 1 } })
            .then(res => setUsersAsOfMonth(res.data.data ?? []))
            .catch(() => setUsersAsOfMonth([]))
            .finally(() => setLoading(false));
    }, [instId, billSel.year, billSel.monthIdx]);

    const filtered = useMemo(() => {
        return usersAsOfMonth.filter(u => {
            if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
            if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
            if (search.trim()) {
                const q = search.toLowerCase();
                return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q);
            }
            return true;
        });
    }, [usersAsOfMonth, search, roleFilter, statusFilter]);

    const total = usersAsOfMonth.length;
    const active = usersAsOfMonth.filter(u => u.status === 'ACTIVE').length;
    const inactive = usersAsOfMonth.filter(u => u.status === 'INACTIVE').length;

    const roleCounts = {
        ADMIN:     usersAsOfMonth.filter(u => u.role === 'ADMIN').length,
        SUB_ADMIN: usersAsOfMonth.filter(u => u.role === 'SUB_ADMIN').length,
        TEACHER:   usersAsOfMonth.filter(u => u.role === 'TEACHER').length,
        STUDENT:   usersAsOfMonth.filter(u => u.role === 'STUDENT').length,
    };

    const ROLE_FILTERS: { value: Role; label: string }[] = [
        { value: 'ALL',       label: `All (${total})` },
        { value: 'ADMIN',     label: `Admin (${roleCounts.ADMIN})` },
        { value: 'SUB_ADMIN', label: `Sub-Admin (${roleCounts.SUB_ADMIN})` },
        { value: 'TEACHER',   label: `Teacher (${roleCounts.TEACHER})` },
        { value: 'STUDENT',   label: `Student (${roleCounts.STUDENT})` },
    ];

    return (
        <div className="flex flex-col h-full">

            {/* ── Sticky header ── */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex flex-wrap items-center gap-3 px-0">
                    <button
                        onClick={() => router.back()}
                        className="w-8 h-8 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-all shrink-0">
                        <ArrowLeft size={15} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Users size={21} />
                            Users
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                                isCurrentMonth
                                    ? 'border-border/60 text-muted-foreground bg-muted/30'
                                    : 'border-[#DA7756]/30 text-[#DA7756] bg-[#DA7756]/10'
                            }`}>
                                {!isCurrentMonth && <History size={10} />}
                                {billSel.short} {billSel.year}
                            </span>
                        </h1>
                        <p className="text-[13px] text-muted-foreground">All billable users on this institution&rsquo;s plan</p>
                    </div>
                    <div className="flex items-center gap-3 sm:ml-auto">
                        <div className="text-center">
                            <p className="text-lg font-bold leading-tight">{total}</p>
                            <p className="text-[11px] text-muted-foreground">Total</p>
                        </div>
                        <div className="w-px h-7 bg-border/50" />
                        <div className="text-center">
                            <p className="text-lg font-bold leading-tight text-emerald-500">{active}</p>
                            <p className="text-[11px] text-muted-foreground">Active</p>
                        </div>
                        <div className="w-px h-7 bg-border/50" />
                        <div className="text-center">
                            <p className="text-lg font-bold leading-tight text-muted-foreground">{inactive}</p>
                            <p className="text-[11px] text-muted-foreground">Inactive</p>
                        </div>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-hidden flex flex-col gap-3 py-3">

                {/* Filters */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {/* Search */}
                    <div className="relative shrink-0 w-full sm:w-80">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search…"
                            className="w-full h-8 pl-8 pr-3 rounded-full bg-muted/40 border border-border/50 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                    </div>

                    {/* Role + Status filters */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {ROLE_FILTERS.map(f => (
                            <button key={f.value} onClick={() => setRoleFilter(f.value)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                    roleFilter === f.value
                                        ? 'border-transparent text-white'
                                        : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                                }`}
                                style={roleFilter === f.value ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                {f.label}
                            </button>
                        ))}
                        <div className="w-px h-5 bg-border/50 mx-1" />
                        {(['ALL', 'ACTIVE', 'INACTIVE'] as Status[]).map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                    statusFilter === s
                                        ? s === 'ACTIVE'
                                            ? 'bg-emerald-500 text-white border-transparent'
                                            : s === 'INACTIVE'
                                                ? 'bg-muted text-foreground border-transparent'
                                                : 'border-transparent text-white'
                                        : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                                }`}
                                style={statusFilter === s && s === 'ALL' ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                {s === 'ALL' ? `All (${total})` : s === 'ACTIVE' ? `Active (${active})` : `Inactive (${inactive})`}
                            </button>
                        ))}
                    </div>

                    {/* Billing month selector — same navigator as Attendance Sheet */}
                    <div className="flex items-center gap-1 sm:ml-auto">
                        <button onClick={() => setBillMonthOffset(v => Math.max(0, v - 1))} disabled={billMonthOffset === 0}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all">
                            <ChevronLeft size={13} />
                        </button>
                        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/40">
                            {BILL_MONTHS.slice(billMonthOffset, billMonthOffset + 3).map(m => {
                                const isActive = activeBillMonth === m.key;
                                return (
                                    <button key={m.key} onClick={() => !m.isFuture && setActiveBillMonth(m.key)}
                                        disabled={m.isFuture}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                            m.isFuture
                                                ? 'text-muted-foreground/30 cursor-not-allowed'
                                                : isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                        }`}>
                                        {m.short} {String(m.year).slice(-2)}
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setBillMonthOffset(v => Math.min(BILL_MONTHS.length - 3, v + 1))} disabled={billMonthOffset >= BILL_MONTHS.length - 3}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all">
                            <ChevronRight size={13} />
                        </button>
                    </div>
                </div>

                {/* User table */}
                <div className="flex-1 overflow-hidden bg-card border border-border/50 rounded-2xl flex flex-col">
                    {loading ? (
                        <div className="py-12 text-center">
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <Users size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No users found</p>
                        </div>
                    ) : (<>
                        {/* Fixed header */}
                        <div className="shrink-0 overflow-x-auto">
                        <table className="w-full text-xs shrink-0 table-fixed">
                            <colgroup>
                                <col className="w-10" />
                                <col className="w-40" />
                                <col className="w-32" />
                                <col className="w-28" />
                                <col className="w-56" />
                                <col className="w-40" />
                                <col className="w-36" />
                                <col className="w-20" />
                                <col className="w-24" />
                            </colgroup>
                            <thead>
                                <tr className="border-b border-border/40 bg-muted/20">
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider w-10">#</th>
                                    <th className="text-left pl-5 pr-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Name</th>
                                    <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">User ID</th>
                                    <th className="text-left pl-4 pr-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Role</th>
                                    <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Email</th>
                                    <th className="text-left pl-4 pr-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Contact No.</th>
                                    <th className="text-left pl-2 pr-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Added By</th>
                                    <th className="text-left pl-0 pr-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Class</th>
                                    <th className="text-left pl-1 pr-3 py-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                        </table>
                        </div>

                        {/* Scrollable body */}
                        <div className="overflow-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent', scrollbarGutter: 'stable' }}>
                            <table className="w-full text-xs table-fixed">
                                <colgroup>
                                    <col className="w-10" />
                                    <col className="w-40" />
                                    <col className="w-32" />
                                    <col className="w-28" />
                                    <col className="w-56" />
                                    <col className="w-40" />
                                    <col className="w-36" />
                                    <col className="w-20" />
                                    <col className="w-24" />
                                </colgroup>
                                <tbody className="divide-y divide-border/30">
                                    {filtered.map((u, idx) => {
                                        const rc = ROLE_CONFIG[u.role];
                                        return (
                                            <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3 text-[11px] text-muted-foreground/60 font-medium w-10">{idx + 1}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold"
                                                            style={{ background: rc.initBg }}>
                                                            {initials(u.name)}
                                                        </div>
                                                        <span className="font-semibold text-foreground">{u.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="font-mono text-[13px] font-semibold tracking-wider" style={{ color: '#DA7756' }}>{u.userId}</span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${rc.color} ${rc.bg}`}>
                                                        {rc.label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{u.email}</td>
                                                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{u.phone ?? '—'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="text-[12px] text-muted-foreground">{u.addedBy ?? '—'}</span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {u.class
                                                        ? <span className="font-semibold text-foreground">{u.class}</span>
                                                        : <span className="text-muted-foreground/40">—</span>
                                                    }
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                        u.status === 'ACTIVE'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                            : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                        {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>)}
                </div>

            </div>
        </div>
    );
}
