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
    const [classLabel, setClassLabel] = useState<string | undefined>(searchParams.get('class') ?? undefined);

    const [flags, setFlags] = useState<FlagItem[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(() => {
        api.get(`/admin/campus/divisions/${divisionId}/students/${studentId}/remarks`)
            .then(res => setFlags(res.data.data))
            .catch(() => setFlags([]));
    }, [divisionId, studentId]);

    useEffect(() => { load(); }, [load]);

    // Fallback: fetch the division's own name directly, in case the ?class= param
    // wasn't present (e.g. page reached via an older cached link).
    useEffect(() => {
        if (classLabel) return;
        api.get(`/admin/campus/divisions/${divisionId}`)
            .then(res => setClassLabel(res.data.data?.name))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [divisionId]);

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

    // Admin-only: deletes the card everywhere — the teacher's assigned
    // reports and the student's own Flags & Warnings board read the same
    // underlying row, so it disappears from both automatically.
    const handleDelete = async (flag: FlagItem) => {
        try {
            await api.delete(`/admin/campus/reports/${flag.id}`);
            toast.success('Card deleted');
            setFlags(prev => prev.filter(f => f.id !== flag.id));
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error ?? 'Failed to delete card');
        }
    };

    return (
        <>
            <FlagsBoard
                flags={flags}
                title={`Flags & Warnings - ${studentName}`}
                subtitle={`${studentName.split(' ')[0]}'s conduct record & disciplinary remarks`}
                classLabel={classLabel}
                onBack={() => router.back()}
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
                onDelete={handleDelete}
            />
            <ReportStudentModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                studentName={studentName}
                loading={submitting}
                onSubmit={handleSubmit}
                uploadUrl="/admin/campus/feed/upload"
            />
        </>
    );
}
