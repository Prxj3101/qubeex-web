import { Suspense } from 'react';
import { StudioClient } from '@/components/timetable/StudioClient';

export default function TimetableStudioPage() {
    return (
        <Suspense fallback={null}>
            <StudioClient />
        </Suspense>
    );
}
