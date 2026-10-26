'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { PrintedForm, type PrintData } from '../PrintedForm';

// Printable admission form (A4): the school's own layout from settings, filled
// with the child's details. "blank" prints an empty copy for paper forms.

export default function PrintAdmissionForm() {
    const { id } = useParams<{ id: string }>();
    const [d, setD] = useState<PrintData | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const url = id === 'blank' ? '/admin/admissions/admission-form/print' : `/admin/admissions/applications/${encodeURIComponent(id)}/admission-form/print`;
        api.get(url).then(res => setD(res.data.data)).catch(err => setError(getErrorMessage(err, 'Could not open the form')));
    }, [id]);

    if (error) return <p className="p-10 text-center text-sm text-red-600">{error}</p>;
    if (!d) return <p className="p-10 text-center text-sm text-slate-500">Preparing the form...</p>;
    return <PrintedForm d={d} />;
}
