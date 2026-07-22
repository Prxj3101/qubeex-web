'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import StudentProfileView, { ProfileViewMarksheet, ProfileViewAttendance } from '@/components/shared/StudentProfileView';
import { FlagItem } from '@/lib/flags';

interface RawStudent {
    id: string;
    studentId: string;
    avatarUrl: string | null;
    user: { name: string | null; email: string };
    rollNo: string | null;
    dob: string | null;
    admissionYear: string | null;
    status: 'ACTIVE' | 'INACTIVE';
}

export default function AdminStudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const standardId = params.standardId as string;
    const divisionId = params.divisionId as string;
    const studentId = params.studentId as string;

    const [student, setStudent] = useState<RawStudent | null>(null);
    const [standardName, setStandardName] = useState('');
    const [divisionName, setDivisionName] = useState('');
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [marksheetData, setMarksheetData] = useState<ProfileViewMarksheet | null>(null);
    const [attendanceApiData, setAttendanceApiData] = useState<ProfileViewAttendance | null>(null);
    const [flags, setFlags] = useState<FlagItem[]>([]);

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
    }, [divisionId, studentId]);

    useEffect(() => {
        api.get(`/admin/campus/divisions/${divisionId}/students/${studentId}/marksheet`)
            .then(res => setMarksheetData(res.data.data))
            .catch(() => setMarksheetData(null));
        api.get(`/admin/campus/divisions/${divisionId}/students/${studentId}/attendance-trend`)
            .then(res => setAttendanceApiData(res.data.data))
            .catch(() => setAttendanceApiData(null));
        api.get(`/admin/campus/divisions/${divisionId}/students/${studentId}/remarks`)
            .then(res => setFlags(res.data.data))
            .catch(() => setFlags([]));
    }, [divisionId, studentId]);

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

    return (
        <StudentProfileView
            studentName={student.user.name ?? '—'}
            studentIdCode={student.studentId}
            standard={standardName}
            division={divisionName}
            rollNo={student.rollNo}
            admissionYear={student.admissionYear}
            dob={student.dob}
            email={student.user.email}
            photo={student.avatarUrl}
            status={student.status}
            marksheetData={marksheetData}
            attendanceApiData={attendanceApiData}
            flags={flags}
            onBack={() => router.push(`/admin/campus/classes/${standardId}/${divisionId}?tab=manage&student=${studentId}`)}
            onViewAllFlags={() => router.push(`/admin/campus/classes/${standardId}/${divisionId}/students/${studentId}/reports?name=${encodeURIComponent(student.user.name ?? 'Student')}`)}
        />
    );
}
