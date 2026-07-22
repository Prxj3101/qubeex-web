'use client';

import { ArrowLeft, User, BookOpen, Shield, MapPin, Users, Hash, Heart, Copy, CheckCircle } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toTitleCase } from '@/lib/utils';

interface Guardian { name: string; number: string; relation: string }

interface RawStudent {
    id: string;
    studentId: string;
    avatarUrl: string | null;
    user: { name: string | null; email: string };
    phone: string | null;
    dob: string | null;
    gender: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    rollNo: string | null;
    houseColor: string | null;
    bloodGroup: string | null;
    aadharNo: string | null;
    panNo: string | null;
    emergencyContact: string | null;
    religion: string | null;
    category: string | null;
    nationality: string | null;
    admissionYear: string | null;
    guardians: Guardian[] | null;
    status: 'ACTIVE' | 'INACTIVE';
}

function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function dobDisplay(dob: string | null): string {
    if (!dob) return '';
    const d = new Date(dob);
    if (isNaN(d.getTime())) return dob;
    const age = new Date().getFullYear() - d.getFullYear();
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ` (${age} yrs)`;
}

function ReadField({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className={`px-3 rounded-md border border-border/50 bg-muted flex ${multiline ? 'min-h-8 py-2 items-start' : 'h-8 items-center'}`}>
                <span className="text-xs text-foreground leading-relaxed">{value || '—'}</span>
            </div>
        </div>
    );
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-3 min-h-[24px]">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Icon size={11} className="text-primary" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{label}</p>
            <div className="flex-1 h-px bg-border/60" />
        </div>
    );
}

export default function AdminStudentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const standardId = params.standardId as string;
    const divisionId = params.divisionId as string;
    const studentId = params.studentId as string;

    const [student, setStudent] = useState<RawStudent | null>(null);
    const [standardName, setStandardName] = useState('');
    const [divisionName, setDivisionName] = useState('');
    const [institutionName, setInstitutionName] = useState('');
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get(`/admin/campus/divisions/${divisionId}/students`),
            api.get(`/admin/campus/divisions/${divisionId}`),
        ])
            .then(([studentsRes, divisionRes]) => {
                const found = (studentsRes.data.data as RawStudent[]).find(s => s.id === studentId);
                if (!found) { setNotFound(true); return; }
                setStudent(found);
                const div = divisionRes.data.data;
                setStandardName(div.standard.name);
                setDivisionName(div.name);
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));

        api.get('/admin/overview')
            .then(res => setInstitutionName(res.data.data?.institution?.name ?? ''))
            .catch(() => {});
    }, [divisionId, studentId]);

    const handleCopy = () => {
        if (!student) return;
        navigator.clipboard.writeText(student.studentId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>;
    }
    if (notFound || !student) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-sm text-muted-foreground">Student not found.</p>
                <button onClick={() => router.push(`/admin/campus/classes/${standardId}/${divisionId}?tab=manage&student=${studentId}`)} className="text-xs font-semibold text-primary hover:underline">Go back</button>
            </div>
        );
    }

    const classLabel = standardName.replace(/^Class\s*/i, '');
    const divisionLetter = divisionName.split('-').pop() ?? divisionName;
    const name = student.user.name ?? '—';

    return (
        <div className="flex flex-col h-full">

            {/* Header */}
            <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                <button
                    onClick={() => router.push(`/admin/campus/classes/${standardId}/${divisionId}/students/${studentId}/profile`)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0"
                >
                    <ArrowLeft size={15} className="text-foreground" />
                </button>
                <p className="text-xl font-bold">{name}&apos;s Profile</p>
            </div>
            <div className="h-px bg-border/60 shrink-0" />

            {/* Body row: left fixed, right scrollable */}
            <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 bg-white dark:bg-muted/40 py-4 -mx-2 px-2 overflow-y-auto lg:overflow-visible">

                {/* LEFT — Profile Banner */}
                <div className="w-full lg:w-[30%] lg:shrink-0">
                    <div className="space-y-3">
                        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                            <div
                                className="px-5 pt-7 pb-6 flex flex-col items-center gap-3 dark:[background:linear-gradient(135deg,#4C1D95,#2D1F50)]"
                                style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
                            >
                                <div
                                    className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden"
                                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
                                >
                                    {student.avatarUrl
                                        ? <img src={student.avatarUrl} alt="profile" className="w-full h-full object-cover" />
                                        : getInitials(name)
                                    }
                                </div>

                                <div className="text-center">
                                    <p className="text-white font-bold text-base leading-tight">{name}</p>
                                    <p className="text-white/70 text-xs mt-0.5">
                                        Class {classLabel} · Division {divisionLetter}
                                    </p>
                                </div>

                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {[
                                        `Roll No: ${student.rollNo ?? '—'}`,
                                        standardName,
                                        student.admissionYear,
                                    ].filter(Boolean).map((chip, i) => (
                                        <span key={i}
                                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'white' }}>
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/30 border-t border-violet-200/50 dark:border-violet-900/50">
                                <Hash size={13} className="text-muted-foreground shrink-0" />
                                <span className="font-mono text-xs font-semibold tracking-wider flex-1 truncate" style={{ color: '#DA7756' }}>
                                    {student.studentId}
                                </span>
                                <button onClick={handleCopy}
                                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-all shrink-0">
                                    {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>

                            <div className="px-4 py-3 bg-card border-t border-border/40">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-muted-foreground">Status</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${student.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                                        <span className={`text-[11px] font-semibold ${student.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {student.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-[11px] text-muted-foreground">Blood Group</span>
                                    <div className="flex items-center gap-1">
                                        <Heart size={11} className="text-red-500" />
                                        <span className="text-[11px] font-bold text-red-500">{student.bloodGroup || '—'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-[11px] text-muted-foreground">Emergency</span>
                                    <span className="text-[11px] font-medium">{student.emergencyContact || '—'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-900/50">
                            <Shield size={12} className="text-violet-500 shrink-0" />
                            <p className="text-[10px] text-violet-600 dark:text-violet-400 leading-relaxed">
                                {`Read-only view. ${institutionName || 'Your institution'} manages this student's record.`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* RIGHT — Detail Sections */}
                <div className="w-full lg:w-[70%] min-w-0 space-y-3 lg:overflow-y-auto pb-6 lg:pr-2"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>

                    {/* ROW 1 — Student Info + Academic Details */}
                    <div className="flex flex-col lg:flex-row gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">
                        <div className="flex-1 px-4 py-3 border-b lg:border-b-0 lg:border-r border-border/40 min-w-0 space-y-2.5">
                            <SectionLabel icon={User} label="Student Info" />
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>
                                    {student.avatarUrl
                                        ? <img src={student.avatarUrl} alt="profile" className="w-full h-full object-cover" />
                                        : getInitials(name)
                                    }
                                </div>
                                <p className="text-sm font-bold">{name}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <ReadField label="Date of Birth" value={dobDisplay(student.dob)} />
                                <ReadField label="Gender" value={toTitleCase(student.gender)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <ReadField label="Religion" value={student.religion} />
                                <ReadField label="Category" value={student.category} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <ReadField label="Nationality" value={student.nationality} />
                                <ReadField label="Admission Year" value={student.admissionYear} />
                            </div>
                            <ReadField label="Email" value={student.user.email} />
                            <ReadField label="Contact No" value={student.phone} />
                        </div>

                        <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                            <SectionLabel icon={BookOpen} label="Academic Details" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <ReadField label="Class" value={classLabel} />
                                <ReadField label="Division" value={divisionLetter} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <ReadField label="Roll No" value={student.rollNo} />
                                <ReadField label="House Color" value={student.houseColor} />
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground mb-1 font-medium">Student ID</p>
                                <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between">
                                    <span className="text-sm font-mono font-semibold" style={{ color: '#DA7756' }}>
                                        {student.studentId}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/50">Read only</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ROW 2 — Medical & Identity + Address */}
                    <div className="flex flex-col lg:flex-row gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">
                        <div className="flex-1 px-4 py-3 border-b lg:border-b-0 lg:border-r border-border/40 min-w-0 space-y-2.5">
                            <SectionLabel icon={Shield} label="Medical & Identity" />
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/50">
                                <Heart size={18} className="text-red-500 shrink-0" />
                                <div>
                                    <p className="text-[10px] text-red-400 font-medium">Blood Group</p>
                                    <p className="text-xl font-black text-red-500">{student.bloodGroup || '—'}</p>
                                </div>
                            </div>
                            <ReadField label="Aadhar No" value={student.aadharNo} />
                            <ReadField label="PAN No" value={student.panNo} />
                            <ReadField label="Emergency Contact" value={student.emergencyContact} />
                        </div>

                        <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                            <SectionLabel icon={MapPin} label="Address" />
                            <ReadField label="Address" value={student.address} multiline />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <ReadField label="City" value={student.city} />
                                <ReadField label="State" value={student.state} />
                                <ReadField label="Pincode" value={student.pincode} />
                                <ReadField label="Country" value={student.country} />
                            </div>
                        </div>
                    </div>

                    {/* ROW 3 — Parents / Guardian */}
                    <div className="border border-border/50 rounded-2xl px-4 py-3 space-y-2.5 bg-background">
                        <SectionLabel icon={Users} label="Parents / Guardian" />
                        {(!student.guardians || student.guardians.length === 0) && (
                            <p className="text-xs text-muted-foreground/60 text-center py-2">No parents or guardians added yet</p>
                        )}
                        {(student.guardians ?? []).map((g, i) => (
                            <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    {g.relation || `Entry ${i + 1}`}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <ReadField label="Name" value={g.name} />
                                    <ReadField label="Number" value={g.number} />
                                    <ReadField label="Relation" value={g.relation} />
                                </div>
                            </div>
                        ))}
                    </div>

                </div>

            </div>
        </div>
    );
}
