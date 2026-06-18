import PencilLoader from '@/components/student/PencilLoader';

export default function StudentLoading() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
            <style>{`
                :root { --pencil-accent: #000000; --pencil-lead: #000000; }
                .dark { --pencil-accent: #D97757; --pencil-lead: #D97757; }
            `}</style>
            <PencilLoader size={120} />
            <p className="text-xs text-muted-foreground font-medium tracking-wide">Loading...</p>
        </div>
    );
}
