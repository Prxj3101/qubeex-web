'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Hash, ArrowUpRight } from 'lucide-react';
import { useThemeAccent } from '@/hooks/useThemeAccent';

export interface StudentIdCardData {
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

/** "Class 10" + "A" (or "10-A") -> "10-A". */
export function classDivOf(student: Pick<StudentIdCardData, 'standard' | 'division'>) {
    const classNum = (student.standard?.name ?? '').replace(/^Class\s*/i, '');
    const divName = student.division?.name ?? '';
    // Division.name is sometimes stored as just the letter ("A") and
    // sometimes as the full "10-A" label — only prefix the class number
    // when it isn't already baked into the division's own name.
    const divLetter = divName.startsWith(`${classNum}-`) ? divName.slice(classNum.length + 1) : divName;
    return { classNum, divLetter, classDiv: `${classNum}-${divLetter}` };
}

/**
 * The student ID card shown by the Campus student search (and the Fees desk).
 * `onClick` makes the whole card a button; `footer` adds a strip at the bottom;
 * `hideOpen` hides the "open in class" arrow.
 */
export function StudentIdCard({ student, onClick, footer, hideOpen, selected }: {
    student: StudentIdCardData;
    onClick?: () => void;
    footer?: React.ReactNode;
    hideOpen?: boolean;
    selected?: boolean;
}) {
    const router = useRouter();
    // This card is styled as a fixed light card regardless of dark mode
    // (white bg, dark text) — but the purple accent inside it was still
    // hardcoded, so it never reflected the institution's chosen theme color.
    const accent = useThemeAccent('--primary');
    const heroAccent = useThemeAccent('--hero-accent');
    const dobDate = student.dob ? new Date(student.dob) : null;
    const dobValid = !!dobDate && !isNaN(dobDate.getTime());
    const age = dobValid ? new Date().getFullYear() - dobDate!.getFullYear() : null;
    const dobDisplay = dobValid
        ? dobDate!.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;
    const { classNum, divLetter, classDiv } = classDivOf(student);
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
        <div
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
            className={`rounded-[20px] border bg-white overflow-hidden shadow-sm text-left ${onClick ? 'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md' : ''}`}
            style={{
                borderColor: selected ? accent : `color-mix(in srgb, ${accent} 20%, transparent)`,
                boxShadow: selected ? `0 0 0 2px ${accent}` : undefined,
            }}
        >
            <div
                className="flex items-center justify-between gap-2.5 px-4 py-2"
                style={{ background: `linear-gradient(to right, ${heroAccent}, color-mix(in srgb, ${heroAccent} 65%, black))` }}
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
                {!hideOpen && student.standard?.id && student.division?.id && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); router.push(`/admin/campus/classes/${student.standard!.id}/${student.division!.id}?tab=manage&student=${student.id}`); }}
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
                        onClick={(e) => { if (student.avatarUrl) { e.stopPropagation(); setPhotoExpanded(true); } }}
                    >
                        <div
                            className="w-[52px] h-[52px] rounded-[12px] flex items-center justify-center overflow-hidden"
                            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 55%, white), ${accent})` }}
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
                            onClick={(e) => { e.stopPropagation(); setPhotoExpanded(false); }}
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
                    <div className="rounded-full px-2 pt-0 pb-[3px] whitespace-nowrap leading-none" style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}>
                        <span className="text-[9px] font-semibold leading-none relative -top-[1px]" style={{ color: accent }}>{classNum ? `Class ${classNum}` : '—'}</span>
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#0F172A] leading-tight truncate">{student.name}</p>
                    <p className="text-[11px] font-semibold" style={{ color: accent }}>
                        {student.standard?.name ?? ''} {student.standard && student.division ? '·' : ''} {student.division ? `Division ${divLetter}` : ''}
                    </p>
                    <div className="h-px my-1.5" style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }} />
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
            <div className="flex items-center gap-1.5 border-t px-4 py-1.5" style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 20%, transparent)` }}>
                <Hash size={13} className="text-[#94A3B8]" />
                <span className="flex-1 text-[13px] font-mono font-semibold tracking-wide" style={{ color: '#DA7756' }}>
                    {student.studentId}
                </span>
                <button
                    type="button"
                    onClick={async (e) => {
                        e.stopPropagation();
                        await navigator.clipboard.writeText(student.studentId);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-[#94A3B8]"
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            {footer}
        </div>
    );
}
