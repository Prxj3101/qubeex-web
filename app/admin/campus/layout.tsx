'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Rss, LayoutGrid, Lock, Search, X, Hash, ArrowUpRight } from 'lucide-react';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import api from '@/lib/api';

interface StudentSearchResult {
    id: string;
    studentId: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    rollNo: string | null;
    dob: string | null;
    admissionYear: string | null;
    institutionName: string;
    institutionLogoUrl: string | null;
    standard: { id: string; name: string } | null;
    division: { id: string; name: string } | null;
}

function StudentSearchCard({ student }: { student: StudentSearchResult }) {
    const router = useRouter();
    const dobDate = student.dob ? new Date(student.dob) : null;
    const dobValid = !!dobDate && !isNaN(dobDate.getTime());
    const age = dobValid ? new Date().getFullYear() - dobDate!.getFullYear() : null;
    const dobDisplay = dobValid
        ? dobDate!.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;
    const classNum = (student.standard?.name ?? '').replace(/^Class\s*/i, '');
    const divName = student.division?.name ?? '';
    // Division.name is sometimes stored as just the letter ("A") and
    // sometimes as the full "10-A" label — only prefix the class number
    // when it isn't already baked into the division's own name.
    const divLetter = divName.startsWith(`${classNum}-`) ? divName.slice(classNum.length + 1) : divName;
    const classDiv = `${classNum}-${divLetter}`;
    const initials = (student.name ?? '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const [copied, setCopied] = useState(false);
    const [photoExpanded, setPhotoExpanded] = useState(false);

    const rows = [
        { label: 'Roll No', value: student.rollNo || '—' },
        { label: 'Class', value: (student.standard || student.division) ? classDiv : '—' },
        { label: 'Admission Year', value: student.admissionYear || '—' },
        { label: 'Date of Birth', value: dobValid ? `${dobDisplay} (${age} yrs)` : '—' },
        { label: 'Email', value: student.email || '—' },
    ];

    return (
        <div className="rounded-[20px] border border-[#EDE9FE] bg-white overflow-hidden shadow-sm">
            <div
                className="flex items-center justify-between gap-2.5 px-4 py-2"
                style={{ background: 'linear-gradient(to right, #7C3AED, #5B21B6)' }}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {student.institutionLogoUrl && (
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/15 shrink-0 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={student.institutionLogoUrl} alt="" className="w-full h-full object-contain" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white leading-tight truncate">{student.institutionName || 'School'}</p>
                        <p className="text-[10px] text-white/75">Student ID Card</p>
                    </div>
                </div>
                {student.standard?.id && student.division?.id && (
                    <button
                        type="button"
                        onClick={() => router.push(`/admin/campus/classes/${student.standard!.id}/${student.division!.id}?tab=manage&student=${student.id}`)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                    >
                        <ArrowUpRight size={14} className="text-white" />
                    </button>
                )}
            </div>
            <div className="flex gap-3 px-4 py-3">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div
                        className={`relative w-[52px] h-[52px] ${student.avatarUrl ? 'cursor-pointer' : ''}`}
                        onClick={() => student.avatarUrl && setPhotoExpanded(true)}
                    >
                        <div
                            className="w-[52px] h-[52px] rounded-[12px] flex items-center justify-center overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
                        >
                            {student.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={student.avatarUrl} alt={student.name ?? ''} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-white">{initials}</span>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#10B981] border-2 border-white" />
                    </div>
                    {photoExpanded && student.avatarUrl && (
                        <div
                            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                            onClick={() => setPhotoExpanded(false)}
                        >
                            <div
                                className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={student.avatarUrl} alt={student.name ?? ''} className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setPhotoExpanded(false)}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all"
                                >
                                    <X size={14} className="text-white" />
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="rounded-full bg-[#EDE9FE] px-2 pt-0 pb-[3px] whitespace-nowrap leading-none">
                        <span className="text-[9px] font-semibold text-[#7C3AED] leading-none relative -top-[1px]">{classNum ? `Class ${classNum}` : '—'}</span>
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#0F172A] leading-tight truncate">{student.name}</p>
                    <p className="text-[11px] font-semibold text-[#7C3AED]">
                        {student.standard?.name ?? ''} {student.standard && student.division ? '·' : ''} {student.division ? `Division ${divLetter}` : ''}
                    </p>
                    <div className="h-px bg-[#EDE9FE] my-1.5" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {rows.map((r) => (
                            <div key={r.label} className="min-w-0">
                                <p className="text-[9px] text-[#94A3B8] leading-tight">{r.label}</p>
                                <p className="text-[11px] font-semibold text-[#0F172A] leading-tight truncate">{r.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1.5 border-t border-[#EDE9FE] bg-[#EDE9FE] px-4 py-1.5">
                <Hash size={13} className="text-[#94A3B8]" />
                <span className="flex-1 text-[13px] font-mono font-semibold tracking-wide" style={{ color: '#DA7756' }}>
                    {student.studentId}
                </span>
                <button
                    type="button"
                    onClick={async () => {
                        await navigator.clipboard.writeText(student.studentId);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-[#94A3B8]"
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
        </div>
    );
}

export default function CampusLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { instType } = useMockInstType();
    const { user } = useAuthStore();

    // Search box lives here (same row as the Feed/Classes tabs). It searches
    // students by name or student ID and shows a dropdown of Student ID Cards
    // (matching the app's student profile card, field-for-field).
    const [searchInput, setSearchInput] = useState('');
    const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchBoxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const trimmed = searchInput.trim();
        if (!trimmed) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        const id = setTimeout(async () => {
            try {
                const res = await api.get('/admin/students/search', { params: { q: trimmed } });
                setSearchResults(res.data?.data ?? []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // The server always renders as if instType === 'SCHOOL' (it has no way to
    // know the real value, which only lives in localStorage/the /admin/me
    // fetch). Rendering the tab label only after mount means there's nothing
    // server-rendered here to conflict with — no hydration mismatch, no stuck
    // stale text, no error overlay. By the time `mounted` flips true (next
    // tick after the first commit), instType is already correct thanks to
    // MockInstTypeContext's cached lazy init, so this doesn't reintroduce the
    // flash the caching was added to avoid.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const classesLabel = instType === 'COLLEGE' ? 'Courses' : instType === 'COACHING' ? 'Batches' : 'Classes';
    const classesHref = instType === 'COLLEGE' ? '/admin/campus/courses' : '/admin/campus/classes';

    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    const canSeeFeed = !isSubAdmin || permissions.includes('CAMPUS_FEED');

    const onCampusRoot = pathname === '/admin/campus' || pathname === '/admin/campus/';
    const needsRedirect = !!user && isSubAdmin && !canSeeFeed && onCampusRoot;

    useEffect(() => {
        if (needsRedirect) router.replace(classesHref);
    }, [needsRedirect, router, classesHref]);

    const TABS = [
        { key: 'feed', label: 'Feed', icon: Rss, href: '/admin/campus', locked: !canSeeFeed },
        { key: 'classes', label: classesLabel, icon: LayoutGrid, href: classesHref, locked: false },
    ];

    const activeTab = (pathname.startsWith('/admin/campus/classes') || pathname.startsWith('/admin/campus/courses')) ? 'classes' : 'feed';

    // Only show the tab bar on the top-level campus pages (not inside a class detail)
    const showTabs = pathname === '/admin/campus' || pathname === '/admin/campus/classes' || pathname === '/admin/campus/courses';

    if (needsRedirect) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {showTabs && mounted && (
                <div className="shrink-0 pt-0 pb-2 px-1 flex items-center justify-between gap-2">
                    <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit shrink-0 overflow-x-auto">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const Icon = tab.icon;

                            if (tab.locked) {
                                return (
                                    <div
                                        key={tab.key}
                                        className="relative opacity-40 cursor-not-allowed"
                                        onClick={() => toast.error('Access restricted — contact your admin')}
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl text-muted-foreground">
                                            <Icon size={14} />
                                            {tab.label}
                                            <Lock size={11} />
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <button key={tab.key} onClick={() => router.push(tab.href)} className="relative">
                                    {isActive && (
                                        <motion.div
                                            layoutId="campusTab"
                                            className="absolute inset-0 bg-primary rounded-4xl"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                        />
                                    )}
                                    <div
                                        className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl transition-colors ${
                                            isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                        }`}>
                                        <Icon size={14} />
                                        {tab.label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {activeTab === 'classes' && (
                    <div ref={searchBoxRef} className="relative shrink-0 w-full max-w-[240px]">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onFocus={() => setShowResults(true)}
                                placeholder="Search student name or ID..."
                                className="w-full h-8 pl-8 pr-7 rounded-full text-xs bg-muted/50 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchInput(''); setSearchResults([]); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X size={13} />
                                </button>
                            )}

                            {showResults && searchInput.trim() && (
                                <div
                                    className="absolute right-0 top-[calc(100%+6px)] z-50 w-[420px] max-h-[70vh] overflow-y-auto rounded-2xl border border-border/50 bg-background shadow-lg p-2 space-y-2"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}
                                >
                                    {searching && (
                                        <p className="text-xs text-muted-foreground text-center py-4">Searching...</p>
                                    )}
                                    {!searching && searchResults.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-4">No students found</p>
                                    )}
                                    {!searching && searchResults.map((s) => (
                                        <StudentSearchCard key={s.id} student={s} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
