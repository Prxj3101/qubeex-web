'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Rss, LayoutGrid, CalendarDays, Lock, Search, X } from 'lucide-react';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import api from '@/lib/api';
import { StudentIdCard, type StudentIdCardData } from '@/components/shared/StudentIdCard';

// The search result card is the shared student ID card (also used by the Fees desk).
type StudentSearchResult = StudentIdCardData;
const StudentSearchCard = StudentIdCard;

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
    const canSeeClasses = !isSubAdmin || ['CAMPUS_VIEW', 'CAMPUS_MANAGE', 'CAMPUS_FEES', 'CAMPUS_ATTENDANCE', 'CAMPUS_MARKSHEET'].some(key => permissions.includes(key));

    const canSeeTimetable = !isSubAdmin || ['TIMETABLE_VIEW', 'TIMETABLE_MANAGE'].some(key => permissions.includes(key));
    // A sub-admin without the Feed lands on the first tab they can open.
    const landingHref = canSeeClasses || !canSeeTimetable ? classesHref : '/admin/campus/timetable';

    const onCampusRoot = pathname === '/admin/campus' || pathname === '/admin/campus/';
    const needsRedirect = !!user && isSubAdmin && !canSeeFeed && onCampusRoot;

    useEffect(() => {
        if (needsRedirect) router.replace(landingHref);
    }, [needsRedirect, router, landingHref]);

    const TABS = [
        { key: 'feed', label: 'Feed', icon: Rss, href: '/admin/campus', locked: !canSeeFeed },
        { key: 'classes', label: classesLabel, icon: LayoutGrid, href: classesHref, locked: !canSeeClasses },
        { key: 'timetable', label: 'AI Timetable', icon: CalendarDays, href: '/admin/campus/timetable', locked: !canSeeTimetable },
    ];

    const activeTab = pathname.startsWith('/admin/campus/timetable') ? 'timetable' : (pathname.startsWith('/admin/campus/classes') || pathname.startsWith('/admin/campus/courses')) ? 'classes' : 'feed';

    // Only show the tab bar on the top-level campus pages (not inside a class detail)
    const showTabs = pathname === '/admin/campus' || pathname === '/admin/campus/classes' || pathname === '/admin/campus/courses' || pathname === '/admin/campus/timetable';

    if (needsRedirect) return null;

    return (
        <div className="flex flex-col h-full overflow-visible">
            {showTabs && mounted && (
                <div className="shrink-0 pt-0 pb-2 px-1 flex items-center justify-between gap-2">
                    {/* The sliding pill overshoots for a moment while it springs; hide the scrollbar so it never flashes. */}
                    <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
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
            <div className="flex-1 min-h-0 overflow-visible">
                {children}
            </div>
        </div>
    );
}
