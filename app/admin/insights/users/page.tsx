'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Search, Shield, BookOpen, GraduationCap, Crown } from 'lucide-react';

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_USERS = [
    // Admin
    { id: 'a1',  name: 'Rajesh Kumar',  role: 'ADMIN',     email: 'rajesh@dps.edu.in',             phone: '+91 98100 00001', status: 'ACTIVE',   joinedAt: '2024-06-01', userId: 'ADM-001',  class: null,   addedBy: 'SuperAdmin' },
    // Sub-Admins
    { id: 'sa1', name: 'Sunita Mehta',  role: 'SUB_ADMIN', email: 'sunita@dps.edu.in',             phone: '+91 98100 00002', status: 'ACTIVE',   joinedAt: '2024-07-10', userId: 'SUB-001',  class: null,   addedBy: 'Rajesh Kumar' },
    { id: 'sa2', name: 'Deepak Joshi',  role: 'SUB_ADMIN', email: 'deepak@dps.edu.in',             phone: '+91 98100 00003', status: 'INACTIVE', joinedAt: '2024-08-05', userId: 'SUB-002',  class: null,   addedBy: 'Rajesh Kumar' },
    // Teachers
    { id: 't1',  name: 'Ritu Sharma',   role: 'TEACHER',   email: 'ritu.sharma@dps.edu.in',        phone: '+91 98765 43210', status: 'ACTIVE',   joinedAt: '2025-08-15', userId: 'TCH-001',  class: null,   addedBy: 'Rajesh Kumar' },
    { id: 't2',  name: 'Ankit Verma',   role: 'TEACHER',   email: 'ankit.verma@dps.edu.in',        phone: '+91 98765 43211', status: 'ACTIVE',   joinedAt: '2025-08-15', userId: 'TCH-002',  class: null,   addedBy: 'Rajesh Kumar' },
    { id: 't3',  name: 'Priya Nair',    role: 'TEACHER',   email: 'priya.nair@dps.edu.in',         phone: '+91 98765 43212', status: 'ACTIVE',   joinedAt: '2025-09-01', userId: 'TCH-003',  class: null,   addedBy: 'Rajesh Kumar' },
    { id: 't4',  name: 'Meena Patel',   role: 'TEACHER',   email: 'meena.patel@dps.edu.in',        phone: '+91 98765 43213', status: 'INACTIVE', joinedAt: '2025-09-10', userId: 'TCH-004',  class: null,   addedBy: 'Rajesh Kumar' },
    { id: 't5',  name: 'Suresh Iyer',   role: 'TEACHER',   email: 'suresh.iyer@dps.edu.in',        phone: '+91 98765 43214', status: 'ACTIVE',   joinedAt: '2025-09-15', userId: 'TCH-005',  class: null,   addedBy: 'Rajesh Kumar' },
    { id: 't6',  name: 'Kavita Singh',  role: 'TEACHER',   email: 'kavita.singh@dps.edu.in',       phone: '+91 98765 43215', status: 'ACTIVE',   joinedAt: '2025-10-01', userId: 'TCH-006',  class: null,   addedBy: 'Rajesh Kumar' },
    // Students
    { id: 's1',  name: 'Aarav Gupta',   role: 'STUDENT',   email: 'aarav@student.dps.edu.in',      phone: '+91 99001 00001', status: 'ACTIVE',   joinedAt: '2025-06-01', userId: 'STU-0001', class: '10-A', addedBy: 'Ritu Sharma' },
    { id: 's2',  name: 'Sneha Reddy',   role: 'STUDENT',   email: 'sneha@student.dps.edu.in',      phone: '+91 99001 00002', status: 'ACTIVE',   joinedAt: '2025-06-01', userId: 'STU-0002', class: '10-A', addedBy: 'Ritu Sharma' },
    { id: 's3',  name: 'Rohan Kapoor',  role: 'STUDENT',   email: 'rohan@student.dps.edu.in',      phone: '+91 99001 00003', status: 'ACTIVE',   joinedAt: '2025-06-01', userId: 'STU-0003', class: '10-B', addedBy: 'Ankit Verma' },
    { id: 's4',  name: 'Pooja Das',     role: 'STUDENT',   email: 'pooja@student.dps.edu.in',      phone: '+91 99001 00004', status: 'INACTIVE', joinedAt: '2025-06-01', userId: 'STU-0004', class: '9-A',  addedBy: 'Priya Nair' },
    { id: 's5',  name: 'Arjun Nair',    role: 'STUDENT',   email: 'arjun@student.dps.edu.in',      phone: '+91 99001 00005', status: 'ACTIVE',   joinedAt: '2025-06-02', userId: 'STU-0005', class: '9-B',  addedBy: 'Meena Patel' },
    { id: 's6',  name: 'Ishita Sharma', role: 'STUDENT',   email: 'ishita@student.dps.edu.in',     phone: '+91 99001 00006', status: 'ACTIVE',   joinedAt: '2025-06-02', userId: 'STU-0006', class: '8-A',  addedBy: 'Suresh Iyer' },
    { id: 's7',  name: 'Karan Mehta',   role: 'STUDENT',   email: 'karan@student.dps.edu.in',      phone: '+91 99001 00007', status: 'ACTIVE',   joinedAt: '2025-06-03', userId: 'STU-0007', class: '8-B',  addedBy: 'Kavita Singh' },
    { id: 's8',  name: 'Divya Pillai',  role: 'STUDENT',   email: 'divya@student.dps.edu.in',      phone: '+91 99001 00008', status: 'ACTIVE',   joinedAt: '2025-06-03', userId: 'STU-0008', class: '7-A',  addedBy: 'Ritu Sharma' },
    { id: 's9',  name: 'Nikhil Verma',  role: 'STUDENT',   email: 'nikhil@student.dps.edu.in',     phone: '+91 99001 00009', status: 'INACTIVE', joinedAt: '2025-06-04', userId: 'STU-0009', class: '7-B',  addedBy: 'Ankit Verma' },
    { id: 's10', name: 'Tanya Bose',    role: 'STUDENT',   email: 'tanya@student.dps.edu.in',      phone: '+91 99001 00010', status: 'ACTIVE',   joinedAt: '2025-06-04', userId: 'STU-0010', class: '6-A',  addedBy: 'Priya Nair' },
];

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

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UsersInsightPage() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role>('ALL');
    const [statusFilter, setStatusFilter] = useState<Status>('ALL');

    const filtered = useMemo(() => {
        return MOCK_USERS.filter(u => {
            if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
            if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
            if (search.trim()) {
                const q = search.toLowerCase();
                return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q);
            }
            return true;
        });
    }, [search, roleFilter, statusFilter]);

    const total = MOCK_USERS.length;
    const active = MOCK_USERS.filter(u => u.status === 'ACTIVE').length;
    const inactive = MOCK_USERS.filter(u => u.status === 'INACTIVE').length;

    const roleCounts = {
        ADMIN:     MOCK_USERS.filter(u => u.role === 'ADMIN').length,
        SUB_ADMIN: MOCK_USERS.filter(u => u.role === 'SUB_ADMIN').length,
        TEACHER:   MOCK_USERS.filter(u => u.role === 'TEACHER').length,
        STUDENT:   MOCK_USERS.filter(u => u.role === 'STUDENT').length,
    };

    const ROLE_FILTERS: { value: Role; label: string }[] = [
        { value: 'ALL',       label: 'All' },
        { value: 'ADMIN',     label: `Admin (${roleCounts.ADMIN})` },
        { value: 'SUB_ADMIN', label: `Sub-Admin (${roleCounts.SUB_ADMIN})` },
        { value: 'TEACHER',   label: `Teacher (${roleCounts.TEACHER})` },
        { value: 'STUDENT',   label: `Student (${roleCounts.STUDENT})` },
    ];

    return (
        <div className="flex flex-col h-full">

            {/* ── Sticky header ── */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex items-center gap-3 px-0">
                    <button
                        onClick={() => router.back()}
                        className="w-8 h-8 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-all shrink-0">
                        <ArrowLeft size={15} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Users size={21} />
                            Users
                        </h1>
                        <p className="text-[13px] text-muted-foreground">All billable users on your plan</p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
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
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative shrink-0 w-80">
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
                                {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* User table */}
                <div className="flex-1 overflow-hidden bg-card border border-border/50 rounded-2xl flex flex-col">
                    {filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <Users size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No users found</p>
                        </div>
                    ) : (<>
                        {/* Fixed header */}
                        <div className="shrink-0">
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
                                                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{u.phone}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="text-[12px] text-muted-foreground">{u.addedBy}</span>
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
