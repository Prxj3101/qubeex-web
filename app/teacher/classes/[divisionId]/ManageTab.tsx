'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AddStudentModal, StudentFormData } from './AddStudentModal';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, BookOpen, ExternalLink, ChevronDown, Power, Flag, Plus,
    PowerOff, User, Shield, MapPin, Eye, EyeOff, Download, FileText, Table2,
} from 'lucide-react';
import { Division, getInitials, getAvatarColor } from './DivisionClassPageClient';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Guardian { name: string; number: string; relation: string }

interface Student {
    id: string;
    studentId: string;
    user: { id: string; name: string | null; email: string; mustChangePassword: boolean };
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
    guardians: Guardian[] | null;
    tempPassword: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    joinedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const GENDERS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];

function SectionHeader({ icon: Icon, label, editing, saving, onEdit, onSave, onCancel }: {
    icon: React.ElementType; label: string; editing: boolean; saving?: boolean;
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
                    <button onClick={onSave} disabled={saving}
                        className="h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        {saving ? 'Saving…' : 'Save'}
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
    label: string; value: string; onChange: (v: string) => void; placeholder: string;
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ManageTab({ division, isClassTeacher }: {
    division: Division;
    isClassTeacher: boolean;
}) {
    const router = useRouter();

    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [manageRightTab, setManageRightTab] = useState<'teachers' | 'student'>('student');

    const [showAddStudent, setShowAddStudent] = useState(false);
    const [addingStudent, setAddingStudent] = useState(false);

    const [confirmToggle, setConfirmToggle] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);

    const [editingSections, setEditingSections] = useState({
        studentInfo: false, academic: false, medical: false, address: false, guardians: false,
    });
    const [savingSections, setSavingSections] = useState({
        studentInfo: false, academic: false, medical: false, address: false, guardians: false,
    });
    const [editDraft, setEditDraft] = useState<Partial<Student & { name: string }>>({});
    const [showPassword, setShowPassword] = useState(false);

    const [showExportMenu, setShowExportMenu] = useState(false);
    const fetchedRef = useRef(false);

    const fetchStudents = useCallback(async () => {
        setLoadingStudents(true);
        try {
            const res = await api.get(`/teacher/classes/${division.id}/students`);
            const list: Student[] = res.data.data;
            setStudents(list);
            setSelectedStudent(prev => {
                if (!prev) return list[0] ?? null;
                return list.find(s => s.id === prev.id) ?? list[0] ?? null;
            });
        } catch {
            toast.error('Failed to load students');
        } finally {
            setLoadingStudents(false);
        }
    }, [division.id]);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchStudents();
    }, [fetchStudents]);

    // Reset edit draft when selected student changes
    useEffect(() => {
        setEditDraft({});
        setEditingSections({ studentInfo: false, academic: false, medical: false, address: false, guardians: false });
        setShowPassword(false);
    }, [selectedStudent?.id]);

    const handleAddStudent = async (data: StudentFormData) => {
        setAddingStudent(true);
        try {
            await api.post(`/teacher/classes/${division.id}/students`, {
                name: data.name,
                email: data.email || undefined,
                dob: data.dob || undefined,
                gender: data.gender || undefined,
                phone: data.contactNo || undefined,
                rollNo: data.rollNo || undefined,
                houseColor: data.houseColor || undefined,
                bloodGroup: data.bloodGroup || undefined,
                religion: data.religion || undefined,
                category: data.category || undefined,
                admissionDate: data.admissionDate || undefined,
                address: data.address || undefined,
                city: data.city || undefined,
                state: data.state || undefined,
                pincode: data.pincode || undefined,
                country: data.country || undefined,
                guardians: data.guardians?.filter(g => g.name.trim()) ?? [],
            });
            toast.success(`${data.name} added!`);
            setShowAddStudent(false);
            fetchedRef.current = false;
            fetchStudents();
        } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to add student');
        } finally {
            setAddingStudent(false);
        }
    };

    const handleSaveSection = async (section: keyof typeof editingSections) => {
        if (!selectedStudent) return;
        setSavingSections(p => ({ ...p, [section]: true }));
        try {
            const payload: Record<string, unknown> = {};
            if (section === 'studentInfo') {
                if (editDraft.name !== undefined) payload.name = editDraft.name;
                if (editDraft.dob !== undefined) payload.dob = editDraft.dob;
                if (editDraft.gender !== undefined) payload.gender = editDraft.gender;
                if (editDraft.religion !== undefined) payload.religion = editDraft.religion;
                if (editDraft.category !== undefined) payload.category = editDraft.category;
                if (editDraft.phone !== undefined) payload.phone = editDraft.phone;
            } else if (section === 'academic') {
                if (editDraft.rollNo !== undefined) payload.rollNo = editDraft.rollNo;
                if (editDraft.houseColor !== undefined) payload.houseColor = editDraft.houseColor;
            } else if (section === 'medical') {
                if (editDraft.bloodGroup !== undefined) payload.bloodGroup = editDraft.bloodGroup;
                if (editDraft.aadharNo !== undefined) payload.aadharNo = editDraft.aadharNo;
                if (editDraft.panNo !== undefined) payload.panNo = editDraft.panNo;
                if (editDraft.emergencyContact !== undefined) payload.emergencyContact = editDraft.emergencyContact;
            } else if (section === 'address') {
                if (editDraft.address !== undefined) payload.address = editDraft.address;
                if (editDraft.city !== undefined) payload.city = editDraft.city;
                if (editDraft.state !== undefined) payload.state = editDraft.state;
                if (editDraft.pincode !== undefined) payload.pincode = editDraft.pincode;
                if (editDraft.country !== undefined) payload.country = editDraft.country;
            } else if (section === 'guardians') {
                if (editDraft.guardians !== undefined) payload.guardians = editDraft.guardians;
            }

            const res = await api.patch(`/teacher/classes/${division.id}/students/${selectedStudent.id}`, payload);
            const updated: Student = res.data.data;
            setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
            setSelectedStudent(updated);
            setEditDraft({});
            setEditingSections(p => ({ ...p, [section]: false }));
            toast.success('Saved!');
        } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to save');
        } finally {
            setSavingSections(p => ({ ...p, [section]: false }));
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedStudent) return;
        setTogglingStatus(true);
        const newStatus = selectedStudent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            await api.patch(`/teacher/classes/${division.id}/students/${selectedStudent.id}/status`, { status: newStatus });
            setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, status: newStatus } : s));
            setSelectedStudent(prev => prev ? { ...prev, status: newStatus } : null);
            setConfirmToggle(false);
            toast.success(newStatus === 'ACTIVE' ? 'Student activated' : 'Student deactivated');
        } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to update status');
        } finally {
            setTogglingStatus(false);
        }
    };

    const handleExport = async (format: 'pdf' | 'csv') => {
        setShowExportMenu(false);
        try {
            const res = await api.get(`/teacher/classes/${division.id}/students/export?format=${format}`, {
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `students-${division.name}.${format === 'pdf' ? 'pdf' : 'csv'}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Export failed');
        }
    };

    const d = (key: keyof Student, fallback = '') => {
        if (!selectedStudent) return fallback;
        const draftVal = (editDraft as Record<string, unknown>)[key];
        if (draftVal !== undefined) return draftVal as string;
        const val = selectedStudent[key];
        return val != null ? String(val) : fallback;
    };
    const dName = () => {
        if (editDraft.name !== undefined) return editDraft.name;
        return selectedStudent?.user.name ?? '';
    };
    const set = (key: string) => (v: string) => setEditDraft(p => ({ ...p, [key]: v }));

    const sortedStudents = [...students].sort((a, b) => {
        const ra = parseInt(a.rollNo ?? '9999');
        const rb = parseInt(b.rollNo ?? '9999');
        return ra - rb;
    });

    return (
        <div className="flex gap-3 h-full pt-3 pb-3 px-1 overflow-hidden">

            {/* LEFT — Students List */}
            <div className="w-[40%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center justify-between">
                    <p className="text-sm font-bold flex items-center gap-2">
                        <Users size={15} /> Students ({students.length})
                    </p>
                    {isClassTeacher && (
                        <div className="flex items-center gap-2">
                            {/* Export button */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowExportMenu(v => !v)}
                                    className="flex items-center gap-1.5 h-7 px-3 rounded-xl text-xs font-semibold border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all">
                                    <Download size={12} /> Export
                                </button>
                                {showExportMenu && (
                                    <div className="absolute top-9 right-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                                        <button onClick={() => handleExport('pdf')}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors">
                                            <FileText size={12} /> Export PDF
                                        </button>
                                        <button onClick={() => handleExport('csv')}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors">
                                            <Table2 size={12} /> Export Excel (CSV)
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAddStudent(true)}
                                className="flex items-center gap-1.5 h-7 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <Plus size={13} /> Add
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto bg-background">
                    {loadingStudents ? (
                        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">Loading…</div>
                    ) : students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                            <Users size={24} className="text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No students yet</p>
                            {isClassTeacher && (
                                <p className="text-xs text-muted-foreground/60 mt-0.5">Click Add to enroll students</p>
                            )}
                        </div>
                    ) : (
                        sortedStudents.map(student => {
                            const isSelected = selectedStudent?.id === student.id;
                            return (
                                <button key={student.id}
                                    onClick={() => { setSelectedStudent(student); setManageRightTab('student'); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                        style={{ background: getAvatarColor(student.user.name ?? student.studentId) }}>
                                        {getInitials(student.user.name ?? student.studentId)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{student.user.name ?? '—'}</p>
                                        <p className="text-[10px] text-muted-foreground">{student.studentId}{student.rollNo ? ` · Roll ${student.rollNo}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {student.user.mustChangePassword && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                                First login
                                            </span>
                                        )}
                                        {student.status === 'INACTIVE' && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
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
                            <button onClick={() => setConfirmToggle(true)}
                                className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all ${selectedStudent.status === 'ACTIVE'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                    }`}>
                                {selectedStudent.status === 'ACTIVE'
                                    ? <><PowerOff size={11} /> Deactivate</>
                                    : <><Power size={11} /> Activate</>}
                            </button>
                            <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                <Flag size={11} /> Report
                            </button>
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

                        {/* Subjects & Teachers */}
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
                            <motion.div key="student" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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

                                        {/* Account status banner */}
                                        {selectedStudent.user.mustChangePassword && (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                                    Awaiting first login — student hasn&apos;t logged in yet
                                                </p>
                                            </div>
                                        )}

                                        {/* ROW 1 — Student Info + Academic */}
                                        <div className="flex gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">

                                            {/* LEFT — Student Info */}
                                            <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                                                <SectionHeader icon={User} label="Student Info"
                                                    editing={editingSections.studentInfo}
                                                    saving={savingSections.studentInfo}
                                                    onEdit={() => setEditingSections(p => ({ ...p, studentInfo: true }))}
                                                    onSave={() => handleSaveSection('studentInfo')}
                                                    onCancel={() => { setEditingSections(p => ({ ...p, studentInfo: false })); setEditDraft({}); }}
                                                />
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                                        style={{ background: getAvatarColor(selectedStudent.user.name ?? selectedStudent.studentId) }}>
                                                        {getInitials(selectedStudent.user.name ?? selectedStudent.studentId)}
                                                    </div>
                                                    <div>
                                                        {editingSections.studentInfo ? (
                                                            <input value={dName()} onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))}
                                                                className="text-sm font-bold bg-transparent border-b border-primary/50 focus:outline-none" />
                                                        ) : (
                                                            <p className="text-sm font-bold">{selectedStudent.user.name ?? '—'}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {editingSections.studentInfo ? (
                                                        <>
                                                            <EditField label="Date of Birth" value={d('dob')} onChange={set('dob')} placeholder="YYYY-MM-DD" />
                                                            <EditDropdown label="Gender" value={d('gender')} options={GENDERS} onChange={set('gender')} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ReadField label="Date of Birth" value={d('dob')} />
                                                            <ReadField label="Gender" value={d('gender') ? GENDERS.find(g => g.value === d('gender'))?.label ?? d('gender') : ''} />
                                                        </>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {editingSections.studentInfo ? (
                                                        <>
                                                            <EditField label="Religion" value={d('religion')} onChange={set('religion')} placeholder="e.g. Hindu" />
                                                            <EditDropdown label="Category" value={d('category')} options={CATEGORIES} onChange={set('category')} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ReadField label="Religion" value={d('religion')} />
                                                            <ReadField label="Category" value={d('category')} />
                                                        </>
                                                    )}
                                                </div>
                                                {editingSections.studentInfo ? (
                                                    <>
                                                        <EditField label="Email" value={selectedStudent.user.email} onChange={() => {}} placeholder="" />
                                                        <EditField label="Contact No" value={d('phone')} onChange={set('phone')} placeholder="+91 98765 43210" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <ReadField label="Email" value={selectedStudent.user.email} />
                                                        <ReadField label="Contact No" value={d('phone')} />
                                                    </>
                                                )}
                                            </div>

                                            {/* RIGHT — Academic Details */}
                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                <SectionHeader icon={BookOpen} label="Academic Details"
                                                    editing={editingSections.academic}
                                                    saving={savingSections.academic}
                                                    onEdit={() => setEditingSections(p => ({ ...p, academic: true }))}
                                                    onSave={() => handleSaveSection('academic')}
                                                    onCancel={() => { setEditingSections(p => ({ ...p, academic: false })); setEditDraft({}); }}
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <ReadField label="Class" value={division.standard.name} />
                                                    <ReadField label="Division" value={division.name} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {editingSections.academic ? (
                                                        <>
                                                            <EditField label="Roll No" value={d('rollNo')} onChange={set('rollNo')} placeholder="e.g. 01" />
                                                            <EditField label="House Color" value={d('houseColor')} onChange={set('houseColor')} placeholder="e.g. Red" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ReadField label="Roll No" value={d('rollNo')} />
                                                            <ReadField label="House Color" value={d('houseColor')} />
                                                        </>
                                                    )}
                                                </div>
                                                {/* Student ID — always readonly */}
                                                <div>
                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">Student ID</p>
                                                    <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between">
                                                        <span className="text-sm font-mono font-semibold" style={{ color: '#DA7756' }}>
                                                            {selectedStudent.studentId}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/50">Read only</span>
                                                    </div>
                                                </div>
                                                {/* Password */}
                                                <div>
                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">
                                                        {selectedStudent.user.mustChangePassword ? 'Initial Password' : 'Password'}
                                                    </p>
                                                    <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between gap-2">
                                                        <span className="text-sm font-mono flex-1" style={{ color: selectedStudent.user.mustChangePassword ? '#DA7756' : undefined }}>
                                                            {selectedStudent.user.mustChangePassword
                                                                ? (showPassword ? (selectedStudent.tempPassword ?? '—') : '••••••••••')
                                                                : '(changed by student)'}
                                                        </span>
                                                        {selectedStudent.user.mustChangePassword && (
                                                            <button type="button" onClick={() => setShowPassword(v => !v)}
                                                                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                                                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ROW 2 — Medical + Address */}
                                        <div className="flex gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">
                                            {/* LEFT — Medical & Identity */}
                                            <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                                                <SectionHeader icon={Shield} label="Medical & Identity"
                                                    editing={editingSections.medical}
                                                    saving={savingSections.medical}
                                                    onEdit={() => setEditingSections(p => ({ ...p, medical: true }))}
                                                    onSave={() => handleSaveSection('medical')}
                                                    onCancel={() => { setEditingSections(p => ({ ...p, medical: false })); setEditDraft({}); }}
                                                />
                                                {editingSections.medical ? (
                                                    <>
                                                        <EditDropdown label="Blood Group" value={d('bloodGroup')} options={BLOOD_GROUPS} onChange={set('bloodGroup')} />
                                                        <EditField label="Aadhar No" value={d('aadharNo')} onChange={set('aadharNo')} placeholder="XXXX XXXX XXXX" />
                                                        <EditField label="PAN No" value={d('panNo')} onChange={set('panNo')} placeholder="ABCDE1234F" />
                                                        <EditField label="Emergency Contact" value={d('emergencyContact')} onChange={set('emergencyContact')} placeholder="98765 43210" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <ReadField label="Blood Group" value={d('bloodGroup')} />
                                                        <ReadField label="Aadhar No" value={d('aadharNo')} />
                                                        <ReadField label="PAN No" value={d('panNo')} />
                                                        <ReadField label="Emergency Contact" value={d('emergencyContact')} />
                                                    </>
                                                )}
                                            </div>
                                            {/* RIGHT — Address */}
                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                <SectionHeader icon={MapPin} label="Address"
                                                    editing={editingSections.address}
                                                    saving={savingSections.address}
                                                    onEdit={() => setEditingSections(p => ({ ...p, address: true }))}
                                                    onSave={() => handleSaveSection('address')}
                                                    onCancel={() => { setEditingSections(p => ({ ...p, address: false })); setEditDraft({}); }}
                                                />
                                                {editingSections.address ? (
                                                    <>
                                                        <EditField label="Address" value={d('address')} onChange={set('address')} placeholder="Street / Area" />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <EditField label="City" value={d('city')} onChange={set('city')} placeholder="Mumbai" />
                                                            <EditField label="State" value={d('state')} onChange={set('state')} placeholder="Maharashtra" />
                                                            <EditField label="Pincode" value={d('pincode')} onChange={set('pincode')} placeholder="400001" />
                                                            <EditField label="Country" value={d('country')} onChange={set('country')} placeholder="India" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ReadField label="Address" value={d('address')} />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <ReadField label="City" value={d('city')} />
                                                            <ReadField label="State" value={d('state')} />
                                                            <ReadField label="Pincode" value={d('pincode')} />
                                                            <ReadField label="Country" value={d('country')} />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* ROW 3 — Guardians */}
                                        <div className="border border-border/50 rounded-2xl px-4 py-3 space-y-2.5 bg-background">
                                            <SectionHeader icon={Users} label="Parents / Guardian"
                                                editing={editingSections.guardians}
                                                saving={savingSections.guardians}
                                                onEdit={() => {
                                                    setEditDraft(p => ({
                                                        ...p,
                                                        guardians: selectedStudent.guardians?.length
                                                            ? [...selectedStudent.guardians]
                                                            : [{ name: '', number: '', relation: '' }],
                                                    }));
                                                    setEditingSections(p => ({ ...p, guardians: true }));
                                                }}
                                                onSave={() => handleSaveSection('guardians')}
                                                onCancel={() => { setEditingSections(p => ({ ...p, guardians: false })); setEditDraft(p => ({ ...p, guardians: undefined })); }}
                                            />
                                            {(() => {
                                                const guardianList = editingSections.guardians
                                                    ? (editDraft.guardians ?? [{ name: '', number: '', relation: '' }])
                                                    : (selectedStudent.guardians ?? []);
                                                if (!editingSections.guardians && guardianList.length === 0) {
                                                    return <p className="text-xs text-muted-foreground/60 italic">No guardian info</p>;
                                                }
                                                return guardianList.map((g, i) => (
                                                    <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Guardian {i + 1}</p>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {editingSections.guardians ? (
                                                                <>
                                                                    <EditField label="Name" value={g.name} onChange={v => {
                                                                        const updated = [...(editDraft.guardians ?? [])];
                                                                        updated[i] = { ...updated[i], name: v };
                                                                        setEditDraft(p => ({ ...p, guardians: updated }));
                                                                    }} placeholder="e.g. Rajesh Mehta" />
                                                                    <EditField label="Number" value={g.number} onChange={v => {
                                                                        const updated = [...(editDraft.guardians ?? [])];
                                                                        updated[i] = { ...updated[i], number: v };
                                                                        setEditDraft(p => ({ ...p, guardians: updated }));
                                                                    }} placeholder="98765 43210" />
                                                                    <EditField label="Relation" value={g.relation} onChange={v => {
                                                                        const updated = [...(editDraft.guardians ?? [])];
                                                                        updated[i] = { ...updated[i], relation: v };
                                                                        setEditDraft(p => ({ ...p, guardians: updated }));
                                                                    }} placeholder="e.g. Father" />
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ReadField label="Name" value={g.name} />
                                                                    <ReadField label="Number" value={g.number} />
                                                                    <ReadField label="Relation" value={g.relation} />
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>

                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Confirm toggle dialog */}
                    <AnimatePresence>
                        {confirmToggle && selectedStudent && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                                    <h3 className="text-base font-bold mb-2">
                                        {selectedStudent.status === 'ACTIVE' ? 'Deactivate Student?' : 'Activate Student?'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-5">
                                        {selectedStudent.status === 'ACTIVE'
                                            ? `${selectedStudent.user.name ?? 'This student'} will lose access immediately.`
                                            : `${selectedStudent.user.name ?? 'This student'} will regain access.`}
                                    </p>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setConfirmToggle(false)} disabled={togglingStatus}
                                            className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                            Cancel
                                        </button>
                                        <button onClick={handleToggleStatus} disabled={togglingStatus}
                                            className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                            style={{ background: selectedStudent.status === 'ACTIVE' ? '#ef4444' : '#10b981' }}>
                                            {togglingStatus ? '…' : selectedStudent.status === 'ACTIVE' ? 'Yes, Deactivate' : 'Yes, Activate'}
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
