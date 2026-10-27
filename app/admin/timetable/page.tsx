import { redirect } from 'next/navigation';

// The timetable lives in Campus now (Campus > Timetable). Old links keep working.
export default async function OldTimetablePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') q.set(k, v);
    redirect(`/admin/campus/timetable${q.size ? `?${q}` : ''}`);
}
