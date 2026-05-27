'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AddStudentModal, StudentFormData } from './AddStudentModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, BookOpen, ExternalLink, ChevronDown, Power, Flag, Plus, PowerOff, User, Shield, MapPin, Eye, EyeOff } from 'lucide-react';
import { Division, MOCK_STUDENTS, getInitials, getAvatarColor } from './DivisionClassPageClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const GENDERS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];

function SectionHeader({ icon: Icon, label, editing, onEdit, onSave, onCancel }: {
    icon: React.ElementType; label: string; editing: boolean;
    onEdit: () => void; onSave: () => void; onCancel: () => void;
}) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon size={11} className="text-primary" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{label}</p>
            <div className="flex-1 h-px bg-border/60" />
            {editing ? (
                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={onCancel}
                        className="h-6 px-2.5 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                        Cancel
                    </button>
                    <button onClick={onSave}
                        className="h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        Save
                    </button>
                </div>
            ) : (
                <button onClick={onEdit}
                    className="h-6 px-2.5 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all shrink-0">
                    Edit
                </button>
            )}
        </div>
    );
}

function ReadField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className="h-8 px-3 rounded-md border border-border/50 bg-muted flex items-center">
                <span className="text-xs text-foreground">{value || '—'}</span>
            </div>
        </div>
    );
}

function EditField({ label, value, onChange, placeholder }: {
    label: string; value: string;
    onChange: (v: string) => void; placeholder: string;
}) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full h-8 px-3 rounded-md border border-border/50 bg-muted text-xs focus:outline-none focus:border-primary/50 transition-all" />
        </div>
    );
}

function EditDropdown({ label, value, options, onChange }: {
    label: string; value: string;
    options: { value: string; label: string }[] | string[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const normalized = (options as (string | { value: string; label: string })[]).map(o =>
        typeof o === 'string' ? { value: o, label: o } : o
    );
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className="relative">
                <button type="button" onClick={() => setOpen(v => !v)}
                    className="w-full h-8 px-3 rounded-md border border-border/40 bg-background text-xs text-left flex items-center justify-between hover:bg-muted transition-all">
                    <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
                        {value ? normalized.find(o => o.value === value)?.label ?? value : 'Select'}
                    </span>
                    <ChevronDown size={11} className="text-muted-foreground" />
                </button>
                {open && (
                    <div className="absolute top-9 left-0 z-50 w-full bg-card border border-border rounded-xl shadow-xl py-1 max-h-36 overflow-y-auto">
                        {normalized.map(o => (
                            <button key={o.value} type="button"
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors ${value === o.value ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ManageTab({ division, isClassTeacher }: {
    division: Division;
    isClassTeacher: boolean;
}) {
    const router = useRouter();
    const [studentActive, setStudentActive] = useState(true);
    const [confirmToggle, setConfirmToggle] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(MOCK_STUDENTS[0]); const [manageRightTab, setManageRightTab] = useState<'teachers' | 'student'>('student');

    const [showAddStudent, setShowAddStudent] = useState(false);
    const [addingStudent, setAddingStudent] = useState(false);

    const [editingSections, setEditingSections] = useState({
        studentInfo: false,
        academic: false,
        medical: false,
        address: false,
        guardians: false,
    });
    const [editingStudent, setEditingStudent] = useState<any>(null);
    const [showPassword, setShowPassword] = useState(false);

    const toggleSection = (section: keyof typeof editingSections, save = false) => {
        if (save) toast.success('Saved!');
        setEditingSections(prev => ({ ...prev, [section]: !prev[section] }));
    };



    const handleAddStudent = (data: StudentFormData) => {
        setAddingStudent(true);
        // mock add — baad mein API se replace karenge
        console.log('New student:', data);
        toast.success(`${data.name} added!`);
        setAddingStudent(false);
        setShowAddStudent(false);
    };

    return (
        <div className="flex gap-3 h-full pt-3 pb-3 px-1 overflow-hidden">

            {/* LEFT — Students List */}
            <div className="w-[40%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center justify-between">
                    <p className="text-sm font-bold flex items-center gap-2">
                        <Users size={15} /> Students ({MOCK_STUDENTS.length})
                    </p>
                    {isClassTeacher && (
                        <button
                            onClick={() => setShowAddStudent(true)}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={13} /> Add Student
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto bg-background">
                    {[...MOCK_STUDENTS].sort((a, b) => parseInt(a.rollNo) - parseInt(b.rollNo)).map(student => {
                        const isSelected = selectedStudent?.id === student.id;
                        return (
                            <button key={student.id}
                                onClick={() => {
                                    setSelectedStudent(prev => prev?.id === student.id ? null : student);
                                    setManageRightTab('student');
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
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
                                        <div className={`text-[11px] font-bold ${student.attendance >= 75 ? 'text-emerald-600 dark:text-emerald-400' : student.attendance >= 65 ? 'text-amber-600' : 'text-red-500'}`}>
                                            {student.attendance}%
                                        </div>
                                        <p className="text-[9px] text-muted-foreground/60">attend.</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT */}
            <div className="w-[60%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center justify-between">
                    <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                        {[
                            { key: 'student' as const, label: 'Student Info' },
                            { key: 'teachers' as const, label: 'Subjects & Teachers' },
                        ].map(tab => {
                            const isActive = manageRightTab === tab.key;
                            return (
                                <button key={tab.key} onClick={() => setManageRightTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    {manageRightTab === 'student' && selectedStudent && isClassTeacher && (
                        <div className="flex items-center gap-2">
                            {/* Deactivate button */}
                            <button onClick={() => setConfirmToggle(true)}
                                className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all ${studentActive
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                    }`}>
                                {studentActive ? <><PowerOff size={11} /> Deactivate</> : <><Power size={11} /> Activate</>}
                            </button>

                            {/* Report button */}
                            <button
                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                <Flag size={11} /> Report
                            </button>

                            {/* View Profile button */}
                            <button
                                onClick={() => router.push(`/student/${selectedStudent.id}/profile`)}
                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                <ExternalLink size={10} /> View Profile
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <AnimatePresence mode="wait">

                        {/* Subjects & Teachers — read only */}
                        {manageRightTab === 'teachers' && (
                            <motion.div key="teachers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="px-4 py-3 space-y-4">
                                <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Class Teacher</p>
                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                                            <span className="text-xs text-muted-foreground">Class Teacher</span>
                                        </div>
                                        <span className="text-[11px] font-semibold text-foreground">
                                            {division.assignments.find(a => a.subjectId === null)?.teacher.user.name ?? 'Not assigned'}
                                        </span>
                                    </div>
                                </div>

                                <div className="h-px bg-border/40" />

                                <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subject Teachers</p>
                                    {division.subjects.length === 0 ? (
                                        <p className="text-xs text-muted-foreground/60 italic">No subjects</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {division.subjects.map(sub => {
                                                const assignment = division.assignments.find(a => a.subjectId === sub.id);
                                                return (
                                                    <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color ?? '#7C3AED' }} />
                                                            <span className="text-xs text-muted-foreground">{sub.name}</span>
                                                        </div>
                                                        <span className="text-[11px] font-semibold text-foreground">
                                                            {assignment?.teacher.user.name ?? 'Not assigned'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Student Info */}
                        {manageRightTab === 'student' && (
                            <motion.div key="student" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex-1 overflow-y-auto min-h-0">
                                {!selectedStudent ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                            <Users size={20} className="text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                                    </div>
                                ) : (
                                    <div className="px-4 py-3 space-y-3 pb-6">

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="rounded-xl border border-border/40 bg-background p-3 text-center">
                                                <p className="text-lg font-black" style={{ color: '#7C3AED' }}>#{selectedStudent.rank}</p>
                                                <p className="text-[11px] text-muted-foreground">Class Rank</p>
                                            </div>
                                            <div className="rounded-xl border border-border/40 bg-background p-3 text-center">
                                                <p className="text-lg font-black">{Math.round((selectedStudent.totalMarks / 500) * 100)}%</p>
                                                <p className="text-[11px] text-muted-foreground">Score %</p>
                                            </div>
                                            <div className="rounded-xl border border-border/40 bg-background p-3 text-center">
                                                <p className={`text-lg font-black ${selectedStudent.attendance >= 75 ? 'text-emerald-600' : selectedStudent.attendance >= 65 ? 'text-amber-600' : 'text-red-500'}`}>
                                                    {selectedStudent.attendance}%
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">Attendance</p>
                                            </div>
                                        </div>

                                        {/* ROW 1 — Student Info + Academic */}
                                        <div className="flex gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">

                                            {/* LEFT — Student Info */}
                                            <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                                                <SectionHeader icon={User} label="Student Info"
                                                    editing={editingSections.studentInfo}
                                                    onEdit={() => toggleSection('studentInfo')}
                                                    onSave={() => toggleSection('studentInfo', true)}
                                                    onCancel={() => toggleSection('studentInfo')}
                                                />

                                                {/* Avatar */}
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                                        style={{ background: getAvatarColor(selectedStudent.name) }}>
                                                        {getInitials(selectedStudent.name)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{selectedStudent.name}</p>
                                                        {editingSections.studentInfo && (
                                                            <button className="text-[11px] text-primary hover:underline">Change Photo</button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    {editingSections.studentInfo ? (
                                                        <>
                                                            <EditField label="Date of Birth" value={editingStudent?.dob ?? '12/03/2009'} onChange={v => setEditingStudent((p: any) => ({ ...p, dob: v }))} placeholder="DD/MM/YYYY" />
                                                            <EditDropdown label="Gender" value={editingStudent?.gender ?? 'MALE'} options={GENDERS} onChange={v => setEditingStudent((p: any) => ({ ...p, gender: v }))} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ReadField label="Date of Birth" value={editingStudent?.dob ?? '12/03/2009'} />
                                                            <ReadField label="Gender" value={editingStudent?.gender ? GENDERS.find(g => g.value === editingStudent.gender)?.label ?? '' : 'Male'} />
                                                        </>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    {editingSections.studentInfo ? (
                                                        <>
                                                            <EditField label="Religion" value={editingStudent?.religion ?? 'Hindu'} onChange={v => setEditingStudent((p: any) => ({ ...p, religion: v }))} placeholder="e.g. Hindu" />
                                                            <EditDropdown label="Category" value={editingStudent?.category ?? 'General'} options={CATEGORIES} onChange={v => setEditingStudent((p: any) => ({ ...p, category: v }))} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ReadField label="Religion" value={editingStudent?.religion ?? 'Hindu'} />
                                                            <ReadField label="Category" value={editingStudent?.category ?? 'General'} />
                                                        </>
                                                    )}
                                                </div>

                                                {editingSections.studentInfo ? (
                                                    <>
                                                        <EditField label="Admission Date" value={editingStudent?.admissionDate ?? '01/06/2023'} onChange={v => setEditingStudent((p: any) => ({ ...p, admissionDate: v }))} placeholder="DD/MM/YYYY" />
                                                        <EditField label="Email" value={editingStudent?.email ?? `${selectedStudent.name.split(' ')[0].toLowerCase()}@school.in`} onChange={v => setEditingStudent((p: any) => ({ ...p, email: v }))} placeholder="student@email.com" />
                                                        <EditField label="Contact No" value={editingStudent?.contactNo ?? selectedStudent.phone ?? ''} onChange={v => setEditingStudent((p: any) => ({ ...p, contactNo: v }))} placeholder="+91 98765 43210" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <ReadField label="Admission Date" value={editingStudent?.admissionDate ?? '01/06/2023'} />
                                                        <ReadField label="Email" value={editingStudent?.email ?? `${selectedStudent.name.split(' ')[0].toLowerCase()}@school.in`} />
                                                        <ReadField label="Contact No" value={editingStudent?.contactNo ?? selectedStudent.phone ?? ''} />
                                                    </>
                                                )}
                                            </div>

                                            {/* RIGHT — Academic Details */}
                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                <SectionHeader icon={BookOpen} label="Academic Details"
                                                    editing={editingSections.academic}
                                                    onEdit={() => toggleSection('academic')}
                                                    onSave={() => toggleSection('academic', true)}
                                                    onCancel={() => toggleSection('academic')}
                                                />

                                                <div className="grid grid-cols-2 gap-2">
                                                    {editingSections.academic ? (
                                                        <>
                                                            <EditField label="Class" value={editingStudent?.className ?? 'Class 10'} onChange={v => setEditingStudent((p: any) => ({ ...p, className: v }))} placeholder="e.g. 10" />
                                                            <EditField label="Division" value={editingStudent?.division ?? 'A'} onChange={v => setEditingStudent((p: any) => ({ ...p, division: v }))} placeholder="e.g. A" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ReadField label="Class" value={editingStudent?.className ?? 'Class 10'} />
                                                            <ReadField label="Division" value={editingStudent?.division ?? 'A'} />
                                                        </>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    {editingSections.academic ? (
                                                        <>
                                                            <EditField label="Roll No" value={editingStudent?.rollNo ?? selectedStudent.rollNo} onChange={v => setEditingStudent((p: any) => ({ ...p, rollNo: v }))} placeholder="e.g. 01" />
                                                            <EditField label="House Color" value={editingStudent?.houseColor ?? 'Red'} onChange={v => setEditingStudent((p: any) => ({ ...p, houseColor: v }))} placeholder="e.g. Red" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ReadField label="Roll No" value={editingStudent?.rollNo ?? selectedStudent.rollNo} />
                                                            <ReadField label="House Color" value={editingStudent?.houseColor ?? 'Red'} />
                                                        </>
                                                    )}
                                                </div>

                                                {/* Student ID — always readonly */}
                                                <div>
                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">Student ID</p>
                                                    <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between">
                                                        <span className="text-sm font-mono font-semibold" style={{ color: '#DA7756' }}>
                                                            STU-2026-0001
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/50">Read only</span>
                                                    </div>
                                                </div>

                                                {/* Password — always readonly with eye */}
                                                <div>
                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">Current Password</p>
                                                    {editingSections.academic ? (
                                                        <div className="relative">
                                                            <input
                                                                type={showPassword ? 'text' : 'password'}
                                                                value={editingStudent?.password ?? 'Abc@12345x'}
                                                                onChange={e => setEditingStudent((p: any) => ({ ...p, password: e.target.value }))}
                                                                className="w-full h-8 px-3 pr-8 rounded-md border border-border/40 bg-background text-xs font-mono focus:outline-none focus:border-primary/50 transition-all" />
                                                            <button type="button" onClick={() => setShowPassword(v => !v)}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                                                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between gap-2">
                                                            <span className="text-sm font-mono flex-1">
                                                                {showPassword ? (editingStudent?.password ?? 'Abc@12345x') : '••••••••••'}
                                                            </span>
                                                            <button type="button" onClick={() => setShowPassword(v => !v)}
                                                                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                                                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ROW 2 — Medical + Address */}
                                        <div className="flex gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">

                                            {/* LEFT — Medical & Identity */}
                                            <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                                                <SectionHeader icon={Shield} label="Medical & Identity"
                                                    editing={editingSections.medical}
                                                    onEdit={() => toggleSection('medical')}
                                                    onSave={() => toggleSection('medical', true)}
                                                    onCancel={() => toggleSection('medical')}
                                                />
                                                {editingSections.medical ? (
                                                    <>
                                                        <EditDropdown label="Blood Group" value={editingStudent?.bloodGroup ?? 'B+'} options={BLOOD_GROUPS} onChange={v => setEditingStudent((p: any) => ({ ...p, bloodGroup: v }))} />
                                                        <EditField label="Aadhar No" value={editingStudent?.aadharNo ?? '1234 5678 9012'} onChange={v => setEditingStudent((p: any) => ({ ...p, aadharNo: v }))} placeholder="XXXX XXXX XXXX" />
                                                        <EditField label="PAN No" value={editingStudent?.panNo ?? ''} onChange={v => setEditingStudent((p: any) => ({ ...p, panNo: v }))} placeholder="ABCDE1234F" />
                                                        <EditField label="Emergency Contact" value={editingStudent?.emergencyContact ?? '+91 98765 00000'} onChange={v => setEditingStudent((p: any) => ({ ...p, emergencyContact: v }))} placeholder="98765 43210" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <ReadField label="Blood Group" value={editingStudent?.bloodGroup ?? 'B+'} />
                                                        <ReadField label="Aadhar No" value={editingStudent?.aadharNo ?? '1234 5678 9012'} />
                                                        <ReadField label="PAN No" value={editingStudent?.panNo ?? '—'} />
                                                        <ReadField label="Emergency Contact" value={editingStudent?.emergencyContact ?? '+91 98765 00000'} />
                                                    </>
                                                )}
                                            </div>

                                            {/* RIGHT — Address */}
                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                <SectionHeader icon={MapPin} label="Address"
                                                    editing={editingSections.address}
                                                    onEdit={() => toggleSection('address')}
                                                    onSave={() => toggleSection('address', true)}
                                                    onCancel={() => toggleSection('address')}
                                                />
                                                {editingSections.address ? (
                                                    <>
                                                        <EditField label="Address" value={editingStudent?.address ?? '123 MG Road'} onChange={v => setEditingStudent((p: any) => ({ ...p, address: v }))} placeholder="Street / Area" />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <EditField label="City" value={editingStudent?.city ?? 'Mumbai'} onChange={v => setEditingStudent((p: any) => ({ ...p, city: v }))} placeholder="Mumbai" />
                                                            <EditField label="State" value={editingStudent?.state ?? 'Maharashtra'} onChange={v => setEditingStudent((p: any) => ({ ...p, state: v }))} placeholder="Maharashtra" />
                                                            <EditField label="Pincode" value={editingStudent?.pincode ?? '400001'} onChange={v => setEditingStudent((p: any) => ({ ...p, pincode: v }))} placeholder="400001" />
                                                            <EditField label="Country" value={editingStudent?.country ?? 'India'} onChange={v => setEditingStudent((p: any) => ({ ...p, country: v }))} placeholder="India" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ReadField label="Address" value={editingStudent?.address ?? '123 MG Road'} />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <ReadField label="City" value={editingStudent?.city ?? 'Mumbai'} />
                                                            <ReadField label="State" value={editingStudent?.state ?? 'Maharashtra'} />
                                                            <ReadField label="Pincode" value={editingStudent?.pincode ?? '400001'} />
                                                            <ReadField label="Country" value={editingStudent?.country ?? 'India'} />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* ROW 3 — Parents/Guardian */}
                                        <div className="border border-border/50 rounded-2xl px-4 py-3 space-y-2.5 bg-background">
                                            <SectionHeader icon={Users} label="Parents / Guardian"
                                                editing={editingSections.guardians}
                                                onEdit={() => toggleSection('guardians')}
                                                onSave={() => toggleSection('guardians', true)}
                                                onCancel={() => toggleSection('guardians')}
                                            />
                                            {[
                                                { name: 'Rajesh ' + selectedStudent.name.split(' ')[1], number: '+91 98765 43210', relation: 'Father' },
                                                { name: 'Sunita ' + selectedStudent.name.split(' ')[1], number: '+91 87654 32109', relation: 'Mother' },
                                            ].map((g, i) => (
                                                <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Guardian {i + 1}</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {editingSections.guardians ? (
                                                            <>
                                                                <EditField label="Name" value={editingStudent?.guardians?.[i]?.name ?? g.name} onChange={v => {
                                                                    const updated = [...(editingStudent?.guardians ?? [
                                                                        { name: 'Rajesh ' + selectedStudent.name.split(' ')[1], number: '+91 98765 43210', relation: 'Father' },
                                                                        { name: 'Sunita ' + selectedStudent.name.split(' ')[1], number: '+91 87654 32109', relation: 'Mother' },
                                                                    ])];
                                                                    updated[i] = { ...updated[i], name: v };
                                                                    setEditingStudent((p: any) => ({ ...p, guardians: updated }));
                                                                }} placeholder="e.g. Rajesh Mehta" />
                                                                <EditField label="Number" value={editingStudent?.guardians?.[i]?.number ?? g.number} onChange={v => {
                                                                    const updated = [...(editingStudent?.guardians ?? [
                                                                        { name: 'Rajesh ' + selectedStudent.name.split(' ')[1], number: '+91 98765 43210', relation: 'Father' },
                                                                        { name: 'Sunita ' + selectedStudent.name.split(' ')[1], number: '+91 87654 32109', relation: 'Mother' },
                                                                    ])];
                                                                    updated[i] = { ...updated[i], number: v };
                                                                    setEditingStudent((p: any) => ({ ...p, guardians: updated }));
                                                                }} placeholder="98765 43210" />
                                                                <EditField label="Relation" value={editingStudent?.guardians?.[i]?.relation ?? g.relation} onChange={v => {
                                                                    const updated = [...(editingStudent?.guardians ?? [
                                                                        { name: 'Rajesh ' + selectedStudent.name.split(' ')[1], number: '+91 98765 43210', relation: 'Father' },
                                                                        { name: 'Sunita ' + selectedStudent.name.split(' ')[1], number: '+91 87654 32109', relation: 'Mother' },
                                                                    ])];
                                                                    updated[i] = { ...updated[i], relation: v };
                                                                    setEditingStudent((p: any) => ({ ...p, guardians: updated }));
                                                                }} placeholder="e.g. Father" />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ReadField label="Name" value={editingStudent?.guardians?.[i]?.name ?? g.name} />
                                                                <ReadField label="Number" value={editingStudent?.guardians?.[i]?.number ?? g.number} />
                                                                <ReadField label="Relation" value={editingStudent?.guardians?.[i]?.relation ?? g.relation} />
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>
                                )}
                            </motion.div>
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
                                            : `${selectedStudent?.name} will regain access to the platform.`}
                                    </p>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setConfirmToggle(false)}
                                            className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                            Cancel
                                        </button>
                                        <button onClick={() => { setStudentActive(v => !v); setConfirmToggle(false); toast.success(studentActive ? 'Student deactivated' : 'Student activated'); }}
                                            className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                            style={{ background: studentActive ? '#ef4444' : '#10b981' }}>
                                            {studentActive ? 'Yes, Deactivate' : 'Yes, Activate'}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    <AddStudentModal
                        open={showAddStudent}
                        onOpenChange={setShowAddStudent}
                        loading={addingStudent}
                        onSubmit={handleAddStudent}
                    />

                </div>
            </div>
        </div>
    );
}