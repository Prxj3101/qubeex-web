'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Users, GraduationCap, BookOpen,
    Trophy, FileText, Upload, Crown, Send, Plus, X,
    ChevronDown, ChevronUp, User as UserIcon, Check,
    LayoutGrid, Rss, Medal, ExternalLink, Calendar, PowerOff, Power
} from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useEffect } from 'react';
import { useClassStore } from '@/store/classStore';

// ── Types ─────────────────────────────────────────────────────────────────────
type PostType = 'announcement' | 'notice' | 'material' | 'result';

interface DivAnnouncement {
    id: string; type: PostType; title: string; body: string;
    author: string; role: string; subject?: string; time: string;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_TEACHERS_LIST = [
    { id: 't1', name: 'Ritu Sharma' },
    { id: 't2', name: 'Ankit Verma' },
    { id: 't3', name: 'Priya Nair' },
    { id: 't4', name: 'Meena Patel' },
    { id: 't5', name: 'Suresh Iyer' },
];

const MOCK_DIVISION = {
    id: 'd1', name: '10-A', standardName: 'Class 10',
    classTeacher: { id: 't1', name: 'Ritu Sharma', email: 'ritu@dps.edu.in', subject: 'Mathematics' },
    subjects: [
        { id: 'sub1', name: 'Mathematics', color: '#7C3AED', teacher: { id: 't1', name: 'Ritu Sharma' } },
        { id: 'sub2', name: 'Science', color: '#0891B2', teacher: { id: 't2', name: 'Ankit Verma' } },
        { id: 'sub3', name: 'English', color: '#DA7756', teacher: { id: 't3', name: 'Priya Nair' } },
        { id: 'sub4', name: 'Hindi', color: '#059669', teacher: { id: 't4', name: 'Meena Patel' } },
        { id: 'sub5', name: 'History', color: '#D97706', teacher: { id: 't5', name: 'Suresh Iyer' } },
        { id: 'sub6', name: 'Geography', color: '#8B5CF6', teacher: { id: 't1', name: 'Ritu Sharma' } },
    ],
    students: [
        { id: 'st1', name: 'Aarav Mehta', rollNo: '01', rank: 1, totalMarks: 487, attendance: 96, dob: '12 Mar 2009', gender: 'Male', phone: '+91 98765 43210' },
        { id: 'st2', name: 'Priya Singh', rollNo: '02', rank: 2, totalMarks: 471, attendance: 92, dob: '5 Jul 2009', gender: 'Female', phone: '+91 87654 32109' },
        { id: 'st3', name: 'Rohan Gupta', rollNo: '03', rank: 3, totalMarks: 458, attendance: 88, dob: '22 Jan 2009', gender: 'Male', phone: '+91 76543 21098' },
        { id: 'st4', name: 'Sneha Patel', rollNo: '04', rank: 4, totalMarks: 445, attendance: 94, dob: '8 Sep 2009', gender: 'Female', phone: '+91 65432 10987' },
        { id: 'st5', name: 'Arjun Kumar', rollNo: '05', rank: 5, totalMarks: 432, attendance: 85, dob: '15 Apr 2009', gender: 'Male', phone: '+91 54321 09876' },
        { id: 'st6', name: 'Meera Sharma', rollNo: '06', rank: 6, totalMarks: 419, attendance: 90, dob: '3 Dec 2009', gender: 'Female', phone: '+91 43210 98765' },
        { id: 'st7', name: 'Karan Joshi', rollNo: '07', rank: 7, totalMarks: 406, attendance: 78, dob: '19 Feb 2009', gender: 'Male', phone: '+91 32109 87654' },
        { id: 'st8', name: 'Ananya Nair', rollNo: '08', rank: 8, totalMarks: 398, attendance: 95, dob: '27 Jun 2009', gender: 'Female', phone: '+91 21098 76543' },
        { id: 'st9', name: 'Vikram Rao', rollNo: '09', rank: 9, totalMarks: 385, attendance: 82, dob: '11 Oct 2009', gender: 'Male', phone: '+91 10987 65432' },
        { id: 'st10', name: 'Ishaan Verma', rollNo: '10', rank: 10, totalMarks: 372, attendance: 88, dob: '4 Aug 2009', gender: 'Male', phone: '+91 98765 43211' },
        { id: 'st11', name: 'Kavya Reddy', rollNo: '11', rank: 11, totalMarks: 361, attendance: 91, dob: '16 May 2009', gender: 'Female', phone: '+91 87654 32110' },
        { id: 'st12', name: 'Aditya Shah', rollNo: '12', rank: 12, totalMarks: 349, attendance: 76, dob: '30 Nov 2009', gender: 'Male', phone: '+91 76543 21099' },
        { id: 'st13', name: 'Riya Desai', rollNo: '13', rank: 13, totalMarks: 338, attendance: 89, dob: '7 Mar 2009', gender: 'Female', phone: '+91 65432 10988' },
        { id: 'st14', name: 'Siddharth Kulkarni', rollNo: '14', rank: 14, totalMarks: 325, attendance: 83, dob: '21 Jul 2009', gender: 'Male', phone: '+91 54321 09877' },
        { id: 'st15', name: 'Nisha Kapoor', rollNo: '15', rank: 15, totalMarks: 314, attendance: 71, dob: '9 Jan 2010', gender: 'Female', phone: '+91 43210 98766' },
    ],
    results: [
        { id: 'r1', name: 'Unit Test 1', date: '15 Jan 2026', uploadedBy: 'Ritu Sharma', type: 'PDF', maxMarks: 100 },
        { id: 'r2', name: 'Mid Term Exam', date: '28 Feb 2026', uploadedBy: 'Ritu Sharma', type: 'Excel', maxMarks: 500 },
        { id: 'r3', name: 'Unit Test 2', date: '10 Apr 2026', uploadedBy: 'Ritu Sharma', type: 'PDF', maxMarks: 100 },
    ],
    timetable: [
        {
            day: 'Mon', slots: [
                { time: '8:45–9:45', subject: 'Mathematics', room: 'R-101' },
                { time: '9:45–10:45', subject: 'Science', room: 'R-101' },
                { time: '11:00–12:00', subject: 'English', room: 'R-101' },
                { time: '12:00–1:00', subject: 'Hindi', room: 'R-101' },
                { time: '1:30–2:30', subject: 'History', room: 'R-101' },
                { time: '2:30–3:30', subject: 'Geography', room: 'R-101' },
            ]
        },
        {
            day: 'Tue', slots: [
                { time: '8:45–9:45', subject: 'Science', room: 'R-101' },
                { time: '9:45–10:45', subject: 'Mathematics', room: 'R-101' },
                { time: '11:00–12:00', subject: 'Hindi', room: 'R-101' },
                { time: '12:00–1:00', subject: 'English', room: 'R-101' },
                { time: '1:30–2:30', subject: 'Geography', room: 'R-101' },
                { time: '2:30–3:30', subject: 'History', room: 'R-101' },
            ]
        },
        {
            day: 'Wed', slots: [
                { time: '8:45–9:45', subject: 'Hindi', room: 'R-101' },
                { time: '9:45–10:45', subject: 'History', room: 'R-101' },
                { time: '11:00–12:00', subject: 'Mathematics', room: 'R-101' },
                { time: '12:00–1:00', subject: 'Science', room: 'R-101' },
                { time: '1:30–2:30', subject: 'English', room: 'R-101' },
                { time: '2:30–3:30', subject: 'Geography', room: 'R-101' },
            ]
        },
        {
            day: 'Thu', slots: [
                { time: '8:45–9:45', subject: 'Geography', room: 'R-101' },
                { time: '9:45–10:45', subject: 'English', room: 'R-101' },
                { time: '11:00–12:00', subject: 'Science', room: 'R-101' },
                { time: '12:00–1:00', subject: 'Mathematics', room: 'R-101' },
                { time: '1:30–2:30', subject: 'Hindi', room: 'R-101' },
                { time: '2:30–3:30', subject: 'History', room: 'R-101' },
            ]
        },
        {
            day: 'Fri', slots: [
                { time: '8:45–9:45', subject: 'History', room: 'R-101' },
                { time: '9:45–10:45', subject: 'Geography', room: 'R-101' },
                { time: '11:00–12:00', subject: 'Hindi', room: 'R-101' },
                { time: '12:00–1:00', subject: 'Science', room: 'R-101' },
                { time: '1:30–2:30', subject: 'Mathematics', room: 'R-101' },
                { time: '2:30–3:30', subject: 'English', room: 'R-101' },
            ]
        },
    ],
    announcements: [
        { id: 'a1', type: 'announcement' as PostType, title: 'PTM this Saturday', body: 'Parent Teacher Meeting on Saturday at 10 AM.', author: 'Ritu Sharma', role: 'Teacher', subject: undefined, time: '2h ago' },
        { id: 'a2', type: 'notice' as PostType, title: 'Unit Test 3 Schedule', body: 'Unit Test 3 will be held on 20th May. Syllabus: Full portion.', author: 'Admin', role: 'Admin', subject: undefined, time: '1d ago' },
    ],
};

const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
const POST_META = {
    announcement: { emoji: '📢', label: 'Announcement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    notice: { emoji: '📌', label: 'Notice', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    material: { emoji: '📄', label: 'Material', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    result: { emoji: '✅', label: 'Result', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
};

function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── Teacher Picker ────────────────────────────────────────────────────────────
function TeacherPicker({ value, onChange, accentColor }: {
    value?: string; onChange: (id: string, name: string) => void; accentColor?: string;
}) {
    const [open, setOpen] = useState(false);
    const [pendingTeacher, setPendingTeacher] = useState<{ id: string; name: string } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const selected = MOCK_TEACHERS_LIST.find(t => t.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setPendingTeacher(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-all"
                style={selected ? {
                    borderColor: (accentColor ?? '#7C3AED') + '60',
                    background: (accentColor ?? '#7C3AED') + '10',
                    color: accentColor ?? '#7C3AED',
                } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                <UserIcon size={11} />
                {selected ? selected.name : 'Assign'}
                <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Teacher list dropdown */}
            <AnimatePresence>
                {open && !pendingTeacher && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-8 right-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                        {MOCK_TEACHERS_LIST.map(t => (
                            <button key={t.id} type="button"
                                onClick={() => { setPendingTeacher(t); setOpen(false); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors ${value === t.id ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ background: getAvatarColor(t.name) }}>
                                    {getInitials(t.name)}
                                </div>
                                {t.name}
                                {value === t.id && <Check size={11} className="ml-auto text-primary shrink-0" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirm popup */}
            <AnimatePresence>
                {pendingTeacher && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-8 right-0 z-50 bg-card border border-border rounded-xl shadow-xl p-3 w-52">
                        <p className="text-xs font-semibold mb-1">Confirm Assignment</p>
                        <p className="text-[11px] text-muted-foreground mb-3">
                            Assign <span className="font-semibold text-foreground">{pendingTeacher.name}</span>?
                        </p>
                        <div className="flex gap-1.5">
                            <button onClick={() => setPendingTeacher(null)}
                                className="flex-1 h-7 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    onChange(pendingTeacher.id, pendingTeacher.name);
                                    setPendingTeacher(null);
                                }}
                                className="flex-1 h-7 rounded-lg text-[11px] font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                Confirm
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function DivFeedCard({ ann }: { ann: typeof MOCK_DIVISION.announcements[0] }) {
    const [expanded, setExpanded] = useState(false);
    const meta = POST_META[ann.type];
    const initials = ann.author.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const avatarColor = AVATAR_COLORS[ann.author.charCodeAt(0) % AVATAR_COLORS.length];

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {ann.subject && <span className="font-normal opacity-75">· {ann.subject}</span>}
                </span>
                <span className="text-[11px] text-muted-foreground">{ann.time}</span>
            </div>
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: avatarColor }}>
                    {initials}
                </div>
                <div>
                    <p className="text-xs font-semibold">{ann.author}</p>
                    <p className="text-[10px] text-muted-foreground">{ann.role}</p>
                </div>
            </div>
            <div>
                <p className="text-sm font-bold mb-1">{ann.title}</p>
                <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>{ann.body}</p>
            </div>
            <button onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Show less' : 'Read more'}
            </button>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DivisionDetailPage() {
    const router = useRouter();
    const division = MOCK_DIVISION;

    const [activeTab, setActiveTab] = useState<'overview' | 'manage'>('overview');
    const [manageTab, setManageTab] = useState<'teachers' | 'student'>('teachers');
    const [selectedStudent, setSelectedStudent] = useState<typeof division.students[0] | null>(null);
    const [postInput, setPostInput] = useState('');
    const [postType, setPostType] = useState<PostType>('announcement');
    const [announcements, setAnnouncements] = useState(division.announcements);
    const [showTimetable, setShowTimetable] = useState(false);
    const [feedFilter, setFeedFilter] = useState<PostType | 'all'>('all');
    const medalColors = ['#F59E0B', '#C0C0C0', '#CD7F32'];
    const [confirmToggle, setConfirmToggle] = useState(false);
    const [studentActive, setStudentActive] = useState(true);

    const { markPassedOut, markPromoted, isPassedOut } = useClassStore();
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [selectedDestDiv, setSelectedDestDiv] = useState('');

    // Mock — current standard info
    const isLastStandard = division.standardName === 'Class 10';
    const nextStandardDivisions = ['10-A', '10-B', '10-C']; // TODO: from actual data
    const nextStandardId = 's1'; // Class 10 ka id
    const currentDivPassedOut = isPassedOut(division.id);

    // Check karo next standard passout hua ya nahi
    const nextStandardPassedOut = isPassedOut(`${nextStandardId}-all`);
    const canPromote = nextStandardPassedOut;

    // Teacher assignment state
    const [classTeacher, setClassTeacher] = useState(division.classTeacher.id);
    const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>(
        Object.fromEntries(division.subjects.map(s => [s.id, s.teacher.id]))
    );

    const filteredAnnouncements = feedFilter === 'all'
        ? announcements
        : announcements.filter(a => a.type === feedFilter);

    const top5 = division.students.slice(0, 5);
    const sortedStudents = [...division.students].sort((a, b) =>
        parseInt(a.rollNo) - parseInt(b.rollNo)
    );

    const handlePost = () => {
        if (!postInput.trim()) return;
        setAnnouncements(prev => [{
            id: `a-${Date.now()}`, type: postType,
            title: postInput.trim(), body: '',
            author: 'Admin', role: 'Admin', subject: undefined,
            time: 'Just now',
        }, ...prev]);
        setPostInput('');
        toast.success('Posted!');
    };

    const TABS = [
        { key: 'overview' as const, label: 'View' },
        { key: 'manage' as const, label: 'Manage Class' },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* Header */}
            <div className="shrink-0 px-1 pt-1 pb-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Users size={24} />
                                {division.name}
                            </h1>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {division.standardName} <ChevronRight size={11} /> {division.name}
                            </p>
                        </div>

                        {/* Tab bar — header ke saath */}
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 ml-4">
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="divTab"
                                                className="absolute inset-0 bg-primary rounded-4xl"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                        )}
                                        <div className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-4xl transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                            }`}>
                                            {tab.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>



                    {/* Stats */}
                    <div className="flex items-center gap-4">
                        {/* Promote / Passout button */}
                        {isLastStandard ? (
                            <button
                                onClick={() => setShowPromoteModal(true)}
                                disabled={currentDivPassedOut}
                                className={`flex items-center gap-2 h-8 px-3 rounded-xl text-[13px] font-semibold transition-all ${currentDivPassedOut
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'text-white hover:opacity-90'
                                    }`}
                                style={!currentDivPassedOut ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}
                            >
                                {currentDivPassedOut ? '✓ Passed Out' : '🎓 Pass Out Class'}
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    if (!canPromote) {
                                        toast.error('Please pass out Class 10 first before promoting Class 9');
                                        return;
                                    }
                                    setShowPromoteModal(true);
                                }}
                                disabled={currentDivPassedOut}
                                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-all ${currentDivPassedOut
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : !canPromote
                                        ? 'border border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20 hover:opacity-80'
                                        : 'text-white hover:opacity-90'
                                    }`}
                                style={!currentDivPassedOut && canPromote ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                {currentDivPassedOut ? '✓ Promoted' : !canPromote ? '⚠️ Promote to Next Class' : '⬆️ Promote to Next Class'}
                            </button>
                        )}
                        {[
                            { label: 'Students', value: division.students.length },
                            { label: 'Subjects', value: division.subjects.length },
                        ].map(({ label, value }) => (
                            <div key={label} className="text-right">
                                <p className="text-lg font-bold leading-tight">{value}</p>
                                <p className="text-[11px] text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <AnimatePresence mode="wait">

                    {/* ── TAB 1: OVERVIEW ── */}
                    {activeTab === 'overview' && (
                        <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex gap-3 h-full pt-3 pb-3 px-1 overflow-hidden">

                            {/* LEFT — Class Teacher + Feed */}
                            <div className="w-[58%] flex flex-col gap-3 min-h-0 overflow-hidden">

                                {/* Class Teacher — small card */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm shadow-black/5">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                        style={{ background: '#F59E0B' }}>
                                        {getInitials(division.classTeacher.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold" style={{ color: '#F59E0B' }}>Class Teacher</p>
                                        <p className="text-sm font-bold truncate">{division.classTeacher.name}</p>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                        {division.classTeacher.subject}
                                    </span>
                                </div>

                                {/* Feed */}
                                <div className="flex-1 min-h-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-sm font-bold">📢 {division.name} Announcements & Feed</h2>
                                            <div className="flex items-center gap-1.5">
                                                {([
                                                    { key: 'all', label: 'All', emoji: '🗂️' },
                                                    { key: 'announcement', label: 'Alerts', emoji: '📢' },
                                                    { key: 'notice', label: 'Notice', emoji: '📌' },
                                                    { key: 'material', label: 'Files', emoji: '📄' },
                                                    { key: 'result', label: 'Results', emoji: '✅' },
                                                ] as { key: PostType | 'all'; label: string; emoji: string }[]).map(tab => {
                                                    const isActive = feedFilter === tab.key;
                                                    return (
                                                        <button key={tab.key} onClick={() => setFeedFilter(tab.key)}
                                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                                                                }`}>
                                                            {tab.emoji} {tab.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Posts */}
                                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 bg-background">
                                        {filteredAnnouncements.map(ann => (
                                            <DivFeedCard key={ann.id} ann={ann} />
                                        ))}
                                    </div>

                                    {/* Filter chips */}
                                    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/40 shrink-0 overflow-x-auto">
                                        {(['announcement', 'notice', 'material', 'result'] as PostType[]).map(type => {
                                            const meta = POST_META[type];
                                            const isActive = postType === type;
                                            return (
                                                <button key={type} onClick={() => setPostType(type)}
                                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${isActive ? meta.cls + ' border-current' : 'border-border/50 text-muted-foreground hover:border-border'
                                                        }`}>
                                                    {meta.emoji} {meta.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Composer */}
                                    <div className="border-t border-border/40 px-3 py-2 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                                <input value={postInput} onChange={e => setPostInput(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handlePost(); }}
                                                    placeholder={`Write a ${POST_META[postType].label.toLowerCase()} for ${division.name}...`}
                                                    className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none" />
                                            </div>
                                            <button onClick={handlePost} disabled={!postInput.trim()}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Send size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — Subject Teachers + Leaderboard + Timetable + Results */}
                            <div className="w-[42%] flex flex-col gap-3 min-h-0 overflow-y-auto pb-1">

                                {/* Subject Teachers */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <BookOpen size={12} /> Subject Teachers
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 divide-y divide-border/20">
                                        {division.subjects.map(sub => (
                                            <div key={sub.id} className="flex items-center justify-between py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                                    <span className="text-xs font-medium">{sub.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                        style={{ background: getAvatarColor(sub.teacher.name) }}>
                                                        {getInitials(sub.teacher.name)}
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground">{sub.teacher.name}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Leaderboard top 5 */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Trophy size={12} /> Leaderboard — Top 5
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 space-y-1.5">
                                        {top5.map((student, i) => {
                                            const medalColor = i < 3 ? medalColors[i] : undefined;
                                            return (
                                                <div key={student.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/20 last:border-none">
                                                    <div className="w-5 text-center shrink-0">
                                                        {medalColor ? (
                                                            <Crown size={14} style={{ color: medalColor }} />
                                                        ) : (
                                                            <span className="text-[11px] font-black text-muted-foreground">{student.rank}</span>
                                                        )}
                                                    </div>
                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                        style={{ background: getAvatarColor(student.name) }}>
                                                        {getInitials(student.name)}
                                                    </div>
                                                    <p className="text-xs font-semibold flex-1 truncate">{student.name}</p>
                                                    <span className="text-[11px] font-bold shrink-0"
                                                        style={{ color: medalColor ?? 'hsl(var(--muted-foreground))' }}>
                                                        {student.attendance}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Timetable */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Calendar size={12} /> Timetable
                                        </p>                                    </div>
                                    <div className="p-2 cursor-pointer" onClick={() => setShowTimetable(true)}>
                                        <img
                                            src="/timetable.jpeg"
                                            alt="Timetable"
                                            className="w-full rounded-xl object-contain max-h-96 hover:opacity-90 transition-opacity"
                                        />
                                    </div>
                                </div>


                                {/* Results */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <FileText size={12} /> Results
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 space-y-2">
                                        {division.results.map(result => (
                                            <div key={result.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/20 last:border-none">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${result.type === 'PDF' ? 'bg-red-500' : 'bg-emerald-600'}`}>
                                                    {result.type}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate">{result.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{result.date}</p>
                                                </div>
                                                <button className="text-[10px] h-6 px-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
                                                    View
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB 2: MANAGE CLASS ── */}
                    {activeTab === 'manage' && (
                        <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex gap-3 h-full pt-3 pb-3 px-1 overflow-hidden">

                            {/* LEFT — Students List */}
                            <div className="w-[50%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

                                {/* Fixed header */}
                                <div className="px-4 py-3 border-b border-border/40 shrink-0">
                                    <p className="text-sm font-bold flex items-center gap-2">
                                        <Users size={15} />
                                        Students ({division.students.length})
                                    </p>
                                </div>

                                {/* Scrollable list */}
                                <div className="flex-1 overflow-y-auto bg-background">
                                    {sortedStudents.map(student => {
                                        const isSelected = selectedStudent?.id === student.id;
                                        return (
                                            <button key={student.id}
                                                onClick={() => { setSelectedStudent(student); setManageTab('student'); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-all hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                                                    }`}>
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                    style={{ background: getAvatarColor(student.name) }}>
                                                    {getInitials(student.name)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate">{student.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <p className="text-[11px] font-bold" style={{ color: '#7C3AED' }}>#{student.rank}</p>
                                                        <p className="text-[9px] text-muted-foreground/60">rank</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[11px] font-bold ${student.attendance >= 90 ? 'text-emerald-600 dark:text-emerald-400' : student.attendance >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                                                            {student.attendance}%
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground/60">attend.</p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* RIGHT — 2 tabs */}
                            <div className="w-[50%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

                                {/* Right tab bar */}
                                <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center justify-between">
                                    <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                                        {[
                                            { key: 'teachers' as const, label: 'Teachers' },
                                            { key: 'student' as const, label: 'Student Info' },
                                        ].map(tab => {
                                            const isActive = manageTab === tab.key;
                                            return (
                                                <button key={tab.key} onClick={() => setManageTab(tab.key)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                                        }`}>
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {manageTab === 'student' && selectedStudent && (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setConfirmToggle(true)}
                                                className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all ${studentActive
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                    }`}>
                                                {studentActive ? <><PowerOff size={11} /> Deactivate</> : <><Power size={11} /> Activate</>}
                                            </button>
                                            <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                                View Details <ExternalLink size={10} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Right content */}
                                <div className="flex-1 overflow-y-auto min-h-0">
                                    <AnimatePresence mode="wait">

                                        {/* Teachers tab */}
                                        {manageTab === 'teachers' && (
                                            <motion.div key="teachers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="px-4 py-3 space-y-4">

                                                {/* Class Teacher */}
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Class Teacher</p>
                                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                                                            <span className="text-xs text-muted-foreground">Class Teacher</span>
                                                        </div>
                                                        <TeacherPicker value={classTeacher}
                                                            accentColor="#F59E0B"
                                                            onChange={(id) => setClassTeacher(id)} />
                                                    </div>
                                                </div>

                                                {/* Subject Teachers */}
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subject Teachers</p>
                                                    <div className="space-y-1.5">
                                                        {division.subjects.map(sub => (
                                                            <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                                                    <span className="text-xs text-muted-foreground">{sub.name}</span>
                                                                </div>
                                                                <TeacherPicker
                                                                    value={subjectTeachers[sub.id]}
                                                                    accentColor={sub.color}
                                                                    onChange={(id) => setSubjectTeachers(prev => ({ ...prev, [sub.id]: id }))} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Student Info tab */}
                                        {manageTab === 'student' && (
                                            <motion.div key="student" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="px-4 py-3">
                                                {!selectedStudent ? (
                                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                                            <Users size={20} className="text-muted-foreground" />
                                                        </div>
                                                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {/* Student header */}
                                                        <div className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-muted/20">
                                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white shrink-0"
                                                                style={{ background: getAvatarColor(selectedStudent.name) }}>
                                                                {getInitials(selectedStudent.name)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold">{selectedStudent.name}</p>
                                                                <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo} · {selectedStudent.gender}</p>
                                                                <p className="text-[11px] text-muted-foreground">DOB: {selectedStudent.dob}</p>
                                                            </div>
                                                        </div>

                                                        {/* Stats */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                                                                <p className="text-lg font-black" style={{ color: '#7C3AED' }}>#{selectedStudent.rank}</p>
                                                                <p className="text-[11px] text-muted-foreground">Class Rank</p>
                                                            </div>
                                                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                                                                <p className="text-lg font-black">{Math.round((selectedStudent.totalMarks / 500) * 100)}%</p>
                                                                <p className="text-[11px] text-muted-foreground">Score %</p>
                                                            </div>
                                                        </div>

                                                        {/* Attendance */}
                                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="text-xs font-semibold">Attendance</p>
                                                                <span className={`text-sm font-black ${selectedStudent.attendance >= 90 ? 'text-emerald-600 dark:text-emerald-400' : selectedStudent.attendance >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                                                                    {selectedStudent.attendance}%
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: `${selectedStudent.attendance}%`,
                                                                        background: selectedStudent.attendance >= 90 ? '#10b981' : selectedStudent.attendance >= 75 ? '#F59E0B' : '#ef4444'
                                                                    }} />
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground mt-1.5">
                                                                {selectedStudent.attendance < 75 ? '⚠️ Below minimum requirement' : selectedStudent.attendance >= 90 ? '✅ Excellent' : '📊 Satisfactory'}
                                                            </p>
                                                        </div>

                                                        {/* Contact */}
                                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1.5">
                                                            <p className="text-xs font-semibold mb-2">Contact</p>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[11px] text-muted-foreground">Phone</span>
                                                                <span className="text-[11px] font-medium">{selectedStudent.phone}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showTimetable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowTimetable(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative max-w-4xl w-full mx-4"
                            onClick={e => e.stopPropagation()}>

                            {/* Buttons */}
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-white text-sm font-semibold">Timetable — {division.name}</p>
                                <div className="flex items-center gap-2">
                                    <a href="/timetable.jpeg" download
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        ⬇ Download
                                    </a>
                                    <button onClick={() => setShowTimetable(false)}
                                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Image */}
                            <img src="/timetable.jpeg" alt="Timetable"
                                className="w-full rounded-2xl object-contain max-h-[80vh]" />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {confirmToggle && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">
                                {studentActive ? '⚠️ Deactivate Student?' : '✅ Activate Student?'}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                {studentActive
                                    ? `${selectedStudent?.name} will lose access immediately.`
                                    : `${selectedStudent?.name} will regain access to the platform.`
                                }
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmToggle(false)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { setStudentActive(v => !v); setConfirmToggle(false); toast.success(studentActive ? 'Student deactivated' : 'Student activated'); }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                    style={{ background: studentActive ? '#ef4444' : '#10b981' }}>
                                    {studentActive ? 'Yes, Deactivate' : 'Yes, Activate'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Promote / Passout Modal */}
            <AnimatePresence>
                {showPromoteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">

                            {isLastStandard ? (
                                <>
                                    <h3 className="text-base font-bold mb-2">🎓 Pass Out {division.name}?</h3>
                                    <p className="text-sm text-muted-foreground mb-5">
                                        All <span className="font-semibold text-foreground">{division.students.length} students</span> of {division.name} will be marked as passed out and removed from the active class list.
                                    </p>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setShowPromoteModal(false)}
                                            className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                markPassedOut(division.id);
                                                markPassedOut(`${nextStandardId}-all`);
                                                setShowPromoteModal(false);
                                                toast.success(`${division.name} passed out successfully!`);
                                            }}
                                            className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                            style={{ background: '#ef4444' }}>
                                            Yes, Pass Out
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-base font-bold mb-2">⬆️ Promote {division.name}</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Select destination division for <span className="font-semibold text-foreground">{division.students.length} students</span>
                                    </p>

                                    {/* Destination picker */}
                                    <div className="mb-4">
                                        <p className="text-xs font-semibold text-muted-foreground mb-2">Destination Division</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {nextStandardDivisions.map(div => (
                                                <button key={div}
                                                    onClick={() => setSelectedDestDiv(div)}
                                                    className={`py-2 rounded-xl border text-xs font-semibold transition-all ${selectedDestDiv === div
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-border/50 text-muted-foreground hover:border-border'
                                                        }`}>
                                                    {div}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedDestDiv && (
                                        <div className="bg-muted/40 rounded-xl p-3 mb-4 text-xs text-muted-foreground">
                                            {division.students.length} students from <span className="font-semibold text-foreground">{division.name}</span> → <span className="font-semibold text-foreground">{selectedDestDiv}</span>
                                        </div>
                                    )}

                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => { setShowPromoteModal(false); setSelectedDestDiv(''); }}
                                            className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                            Cancel
                                        </button>
                                        <button
                                            disabled={!selectedDestDiv}
                                            onClick={() => {
                                                markPromoted(division.id);
                                                setShowPromoteModal(false);
                                                setSelectedDestDiv('');
                                                toast.success(`${division.name} students promoted to ${selectedDestDiv}!`);
                                            }}
                                            className="h-9 px-4 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                            Confirm Promote
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}