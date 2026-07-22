'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlagItem } from '@/lib/flags';
import api from '@/lib/api';
import FlagsBoard from '@/components/shared/FlagsBoard';
import { useStudentStore } from '@/store/studentStore';

export default function FlagsPage() {
    const [flags, setFlags] = useState<FlagItem[]>([]);
    const router = useRouter();
    const division = useStudentStore(s => s.division);

    useEffect(() => {
        api.get('/student/remarks')
            .then(res => setFlags(res.data.data))
            .catch(() => setFlags([]));
    }, []);

    return (
        <FlagsBoard
            flags={flags}
            title="Flags & Warnings"
            subtitle="Your conduct record & disciplinary remarks"
            onBack={() => router.back()}
            classLabel={division || undefined}
        />
    );
}
