'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { FlagItem } from '@/lib/flags';
import FlagsBoard from '@/components/shared/FlagsBoard';
import ReportStudentModal, { ReportFormData } from '@/app/teacher/classes/[divisionId]/ReportStudentModal';

export default function AdminStudentReportsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const standardId = params.standardId as string;
    const divisionId = params.divisionId as string;
    const studentId = params.studentId as string;
    const studentName = searchParams.get('name') ?? 'Student';

    const [flags, setFlags] = useState<FlagItem[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(() => {
        api.get(`/admin/campus/divisions/${divisionId}/students/${studentId}/remarks`)
            .then(res => setFlags(res.data.data))
            .catch(() => setFlags([]));
    }, [divisionId, studentId]);

    useEffect(() => { load(); }, [load]);

    const handleSubmit = async (data: ReportFormData) => {
        setSubmitting(true);
        try {
            await api.post(`/admin/campus/divisions/${divisionId}/students/${studentId}/remarks`, data);
            toast.success('Report submitted');
            setShowAddModal(false);
            load();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error ?? 'Failed to submit report');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <FlagsBoard
                flags={flags}
                title={`${studentName} — Reports`}
                subtitle="Yellow & red card history for this student"
                onBack={() => router.push(`/admin/campus/classes/${standardId}/${divisionId}?tab=manage&student=${studentId}`)}
                headerAction={
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                    >
                        <Plus size={13} /> Report
                    </button>
                }
                appealNote="Discuss with the student's class teacher, or record the outcome directly."
            />
            <ReportStudentModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                studentName={studentName}
                loading={submitting}
                onSubmit={handleSubmit}
            />
        </>
    );
}
