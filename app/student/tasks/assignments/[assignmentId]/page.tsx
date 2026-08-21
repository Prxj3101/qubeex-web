'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface PaperQuestion {
    id: string;
    type: string;
    question: string;
    options: string[];
    sectionId: string | null;
    marks: number;
    order: number;
}

interface PaperSection {
    id: string;
    title?: string;
    instruction?: string;
}

interface AssignmentPaper {
    assignment: {
        id: string;
        title: string;
        description: string | null;
        subjectName: string;
        className: string;
        totalMarks: number;
        dueDate: string | null;
        submissionType: 'ONLINE' | 'OFFLINE';
        answerSpace: boolean;
        isRandomized: boolean;
        sections: PaperSection[];
    };
    questions: PaperQuestion[];
    student: { name: string; rollNo: string; studentId: string };
    institution: { name: string; logoUrl: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null } | null;
}

// Exact same colour theme the teacher's paper builder uses for an ASSIGNMENT
// paper (TasksTab.tsx PaperBuilder — `theme` object, the non-TEST branch),
// so this read-only view/PDF looks identical to what the teacher built.
const theme = {
    outerBg: '#B8C8D8',
    paperBg: '#F8FBFF', paperBorder: '#A8C0DC',
    topBar1: '#1A2F4A', topBar2: '#2563EB',
    headingColor: '#4A7AAA', titleColor: '#0D1B2A',
    metaColor: '#1E3A5F', accentColor: '#2563EB',
    sectionMeta: '#4A7AAA',
    rowBorder: '#DDEAFB', marksBadgeBg: '#DDEAFB', marksBadgeText: '#1E3A5F', marksBadgeBorder: '#A8C0DC',
    footerText: '#4A7AAA',
    fontFamily: 'inherit',
};

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

// Same A4 pagination scheme as the paper builder (TasksTab.tsx PaperBuilder —
// PAGE_HEIGHT_PX/PAGE_CHROME_PX/PAGE_PADDING_Y_PX/PAGE_CONTENT_CAPACITY_PX):
// CSS spec fixes 1in = 96px, so mm→px is an exact conversion, not an approximation.
const MM_TO_PX = 96 / 25.4;
const PAGE_WIDTH_PX = 210 * MM_TO_PX;
const PAGE_HEIGHT_PX = 297 * MM_TO_PX;
const PAGE_CHROME_PX = 11 + 11; // top decorative bars (6+3+2) + bottom bars (2+3+6)
const PAGE_PADDING_Y_PX = 48; // content wrapper padding: 24px top + 24px bottom
const PAGE_CONTENT_CAPACITY_PX = PAGE_HEIGHT_PX - PAGE_CHROME_PX - PAGE_PADDING_Y_PX;

type FlowBlock =
    | { key: string; kind: 'header' }
    | { key: string; kind: 'sectionHeader'; section: PaperSection; isFirst: boolean }
    | { key: string; kind: 'question'; question: PaperQuestion; num: number }
    | { key: string; kind: 'footer' };

export default function AssignmentPaperPage() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.assignmentId as string;

    // The app's native WebView header already has its own back button above
    // this page, so this page's own back button is redundant there — hide it
    // only inside the app's WebView (set by student/layout.tsx's token
    // bridging into sessionStorage), never on a normal browser tab. Read
    // this in an effect (not during render) so the first client render
    // still matches the server-rendered HTML (server has no sessionStorage
    // at all) and doesn't trip a hydration mismatch.
    const [hideBackButton, setHideBackButton] = useState(false);
    useEffect(() => {
        try {
            if (sessionStorage.getItem('isAppWebView') === '1') setHideBackButton(true);
        } catch { /* storage unavailable */ }
    }, []);

    const [loading, setLoading] = useState(true);
    const [paper, setPaper] = useState<AssignmentPaper | null>(null);
    // Manual zoom for the laptop/browser view — the paper is a fixed A4
    // width, so this just scales it up/down for readability, independent of
    // the browser's own page zoom. Uses CSS `zoom` (not `transform: scale`)
    // so the layout box actually shrinks/grows with it instead of leaving
    // dead space or getting clipped.
    const [zoom, setZoom] = useState(1);
    const zoomIn = () => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10));
    const zoomOut = () => setZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10));
    const [downloading, setDownloading] = useState(false);
    const [pageGroups, setPageGroups] = useState<string[][] | null>(null);
    const blockElRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // App WebView (narrow, no sm:): `position: sticky` doesn't reliably hold
    // inside a scrollable container on some mobile WebKit/WebView builds — it
    // detaches and scrolls away with the content instead of staying pinned.
    // `position: fixed` (relative to the viewport, not the scroll container)
    // always holds, so the header uses that on mobile, with a measured
    // spacer below to keep content from jumping under it. Desktop (sm+) uses
    // normal sticky — same pattern as the test result page.
    const headerRef = useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = useState(0);
    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => setHeaderHeight(entries[0].contentRect.height));
        ro.observe(el);
        return () => ro.disconnect();
    }, [paper]);

    const [topOffset, setTopOffset] = useState(0);
    useEffect(() => {
        const computeOffset = () => {
            const mainEl = headerRef.current?.closest('main');
            if (mainEl) setTopOffset(mainEl.getBoundingClientRect().top);
        };
        computeOffset();
        window.addEventListener('resize', computeOffset);
        return () => window.removeEventListener('resize', computeOffset);
    }, [paper]);

    // On a phone-width screen the fixed 210mm-wide A4 sheet is much wider than
    // the viewport, so the default `width=device-width, initial-scale=1` meta
    // tag leaves it zoomed in with only horizontal scrolling to see the rest.
    // Widen the viewport to match the actual paper width and dial initial-scale
    // down to fit, so the whole page is visible on first load — pinch-zoom
    // still works normally from there (user-scalable stays on). Restores the
    // original tag on unmount so other pages aren't affected. No-op on wide
    // (desktop) screens where the paper already fits.
    useEffect(() => {
        if (!paper) return;
        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return;
        const originalContent = meta.getAttribute('content');
        if (window.innerWidth < PAGE_WIDTH_PX) {
            const scale = window.innerWidth / PAGE_WIDTH_PX;
            meta.setAttribute('content', `width=${Math.round(PAGE_WIDTH_PX)}, initial-scale=${scale}, minimum-scale=${scale / 2}, maximum-scale=5, user-scalable=yes`);
        }
        return () => {
            if (originalContent) meta.setAttribute('content', originalContent);
        };
    }, [paper]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get(`/student/tasks/assignments/${assignmentId}/paper`);
                if (!cancelled) setPaper(res.data.data as AssignmentPaper);
            } catch {
                if (!cancelled) {
                    toast.error('Could not load this assignment');
                    router.replace('/student/tasks?tab=assignments');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [assignmentId, router]);

    async function handleDownloadPdf() {
        setDownloading(true);
        try {
            const res = await api.get(`/student/tasks/assignments/${assignmentId}/paper/pdf`, { responseType: 'blob' });
            const blob = res.data as Blob;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${paper?.assignment.title ?? 'Assignment'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Download failed');
        } finally {
            setDownloading(false);
        }
    }

    // Group questions by section — unsectioned first, then each section in
    // the order the teacher defined it. Same flow as the builder's testFlowBlocks.
    const flowBlocks: FlowBlock[] = [];
    if (paper) {
        flowBlocks.push({ key: 'header', kind: 'header' });
        const bySection = new Map<string | null, PaperQuestion[]>();
        for (const q of paper.questions) {
            const key = q.sectionId;
            if (!bySection.has(key)) bySection.set(key, []);
            bySection.get(key)!.push(q);
        }
        const orderedGroups: { section: PaperSection | null; questions: PaperQuestion[] }[] = [];
        if (bySection.has(null)) orderedGroups.push({ section: null, questions: bySection.get(null)!.sort((a, b) => a.order - b.order) });
        for (const sec of paper.assignment.sections) {
            if (bySection.has(sec.id)) orderedGroups.push({ section: sec, questions: bySection.get(sec.id)!.sort((a, b) => a.order - b.order) });
        }
        let qNum = 0;
        orderedGroups.forEach((group, gi) => {
            if (group.section) {
                flowBlocks.push({ key: `sh-${group.section.id}`, kind: 'sectionHeader', section: group.section, isFirst: gi === 0 });
            }
            group.questions.forEach((q) => {
                qNum += 1;
                flowBlocks.push({ key: `q-${q.id}`, kind: 'question', question: q, num: qNum });
            });
        });
        flowBlocks.push({ key: 'footer', kind: 'footer' });
    }
    const flowBlocksByKey = new Map(flowBlocks.map(b => [b.key, b] as const));

    // Measure each block's rendered height and greedily pack into A4 pages —
    // identical algorithm to the paper builder's pagination. Runs after every
    // render; on the first pass (before any measurement exists) everything
    // falls into one page via `effectivePageGroups` below, then this recomputes
    // real page breaks and triggers one more render with the true grouping.
    useLayoutEffect(() => {
        if (!paper) return;
        const heights = flowBlocks.map(b => {
            const el = blockElRefs.current.get(b.key);
            return { key: b.key, height: el ? el.getBoundingClientRect().height : 0 };
        });
        const groups: string[][] = [];
        let current: string[] = [];
        let currentHeight = 0;
        for (const { key, height } of heights) {
            if (current.length > 0 && currentHeight + height > PAGE_CONTENT_CAPACITY_PX) {
                groups.push(current);
                current = [];
                currentHeight = 0;
            }
            current.push(key);
            currentHeight += height;
        }
        if (current.length > 0 || groups.length === 0) groups.push(current);
        setPageGroups(prev => {
            if (prev && prev.length === groups.length && prev.every((g, i) => g.length === groups[i].length && g.every((k, j) => k === groups[i][j]))) {
                return prev;
            }
            return groups;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paper]);

    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading assignment…</div>;
    }
    if (!paper) return null;

    const effectivePageGroups: string[][] = pageGroups && pageGroups.length > 0
        ? pageGroups
        : [flowBlocks.map(b => b.key)];

    const renderBlock = (block: FlowBlock) => {
        switch (block.kind) {
            case 'header':
                return (
                    <div style={{ borderBottom: `1.5px solid ${theme.paperBorder}`, paddingBottom: 6, marginBottom: 8 }}>
                        <div style={{ textAlign: 'center', marginBottom: 4 }}>
                            <p style={{ fontSize: 20, fontWeight: 700, color: theme.titleColor, borderBottom: `1px solid ${theme.paperBorder}`, paddingBottom: 2, display: 'inline-block' }}>
                                {paper.assignment.title}
                            </p>
                            {paper.assignment.description && (
                                <p style={{ fontSize: 12, color: theme.sectionMeta, marginTop: 8 }}>{paper.assignment.description}</p>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginTop: 28, color: theme.metaColor }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                <span>
                                    {paper.assignment.subjectName && <><span style={{ fontWeight: 600 }}>Subject:</span> {paper.assignment.subjectName}&nbsp;&nbsp;&nbsp;&nbsp;</>}
                                    <span style={{ fontWeight: 600 }}>Due:</span> {paper.assignment.dueDate ? formatDateTime(paper.assignment.dueDate) : 'Not set'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <span><span style={{ fontWeight: 600 }}>Total Questions:</span> {paper.questions.length}</span>
                                <span style={{ fontWeight: 700, fontSize: 15, color: theme.accentColor }}>Total Marks: {paper.assignment.totalMarks}</span>
                            </div>
                        </div>
                    </div>
                );
            case 'sectionHeader': {
                const sectionQs = paper.questions.filter(q => q.sectionId === block.section.id);
                const sectionMarks = sectionQs.reduce((s, q) => s + q.marks, 0);
                return (
                    <div style={{ marginTop: block.isFirst ? 0 : 28 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 0', marginBottom: 12, borderBottom: `1px solid ${theme.paperBorder}`,
                        }}>
                            <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: theme.titleColor }}>
                                {block.section.title || 'Section'}
                            </span>
                            {sectionQs.length > 0 && (
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: theme.sectionMeta }}>
                                    {sectionQs.length} Q. {sectionMarks} mks
                                </span>
                            )}
                        </div>
                    </div>
                );
            }
            case 'question': {
                const q = block.question;
                return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: `1px solid ${theme.rowBorder}` }}>
                        <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2, width: 20, textAlign: 'right', color: theme.accentColor }}>Q{block.num}.</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, lineHeight: 1.6, color: theme.titleColor }}>{q.question}</span>
                            {(q.type === 'MCQ' || q.type === 'CONCEPTUAL') && q.options.length > 0 && (
                                <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 2, paddingLeft: 4 }}>
                                    {q.options.map((opt, oi) => (
                                        <span key={oi} style={{ fontSize: 11.5, color: theme.metaColor }}>{String.fromCharCode(65 + oi)}) {opt}</span>
                                    ))}
                                </div>
                            )}
                            {q.type === 'TRUE_FALSE' && (
                                <div style={{ marginTop: 6, display: 'flex', gap: 32, paddingLeft: 4 }}>
                                    <span style={{ fontSize: 11.5, color: theme.metaColor }}>A) True</span>
                                    <span style={{ fontSize: 11.5, color: theme.metaColor }}>B) False</span>
                                </div>
                            )}
                            {paper.assignment.answerSpace && q.type === 'NUMERICAL' && (
                                <div style={{ marginTop: 8, paddingLeft: 4, borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.3, width: '60%' }} />
                            )}
                            {paper.assignment.answerSpace && q.type === 'SHORT_ANSWER' && (
                                <div style={{ marginTop: 8, paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[0, 1, 2].map((i) => <div key={i} style={{ borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.22 }} />)}
                                </div>
                            )}
                        </div>
                        <span style={{
                            flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap',
                            background: theme.marksBadgeBg, color: theme.marksBadgeText, border: `0.5px solid ${theme.marksBadgeBorder}`,
                        }}>
                            [{q.marks}m]
                        </span>
                    </div>
                );
            }
            case 'footer':
                return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, marginTop: 8, borderTop: `1px solid ${theme.paperBorder}` }}>
                        <span style={{ fontSize: 12, fontStyle: 'italic', color: theme.footerText }}>— End of Assignment —</span>
                        <span style={{ fontSize: 12, color: theme.footerText }}>Total: {paper.assignment.totalMarks} marks</span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div>
            {/* Header — back button, title, Download PDF, all in one row. Full-width
                sticky strip (fixed on mobile WebView, see comment above) so the whole
                line stays pinned edge-to-edge while the paper scrolls underneath. */}
            <div ref={headerRef} style={{ top: topOffset }} className="fixed left-0 right-0 z-20 bg-background sm:sticky sm:!top-0 sm:z-20">
                <div className="flex items-center gap-3 max-w-3xl mx-auto px-3 pt-1 pb-3">
                    {!hideBackButton && (
                        <button onClick={() => router.back()}
                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                            <ArrowLeft size={15} className="text-foreground" />
                        </button>
                    )}
                    <h1 className="flex-1 min-w-0 text-lg font-bold truncate">{paper.assignment.title}</h1>
                    <div className="hidden sm:flex items-center gap-0.5 shrink-0 border border-border/50 rounded-xl bg-card p-0.5">
                        <button onClick={zoomOut} disabled={zoom <= 0.5}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-all disabled:opacity-40">
                            <ZoomOut size={14} className="text-foreground" />
                        </button>
                        <span className="text-[11px] font-semibold text-muted-foreground w-9 text-center select-none">{Math.round(zoom * 100)}%</span>
                        <button onClick={zoomIn} disabled={zoom >= 2}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-all disabled:opacity-40">
                            <ZoomIn size={14} className="text-foreground" />
                        </button>
                    </div>
                    <button onClick={handleDownloadPdf} disabled={downloading}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-xl disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                        <Download size={13} /> {downloading ? 'Downloading…' : 'Download PDF'}
                    </button>
                </div>
            </div>
            <div style={{ height: headerHeight }} className="sm:hidden" />

            {/* Outer grey/blue backdrop, same as the paper builder's scroll area —
                paginates into separate A4 sheets, one below the other, exactly
                like the teacher's builder does. */}
            <div className="overflow-x-auto pt-3 pb-8 px-3 sm:px-6" style={{ background: theme.outerBg }}>
                <div className="mx-auto" style={{ width: 'fit-content', zoom }}>
                    {paper.questions.length === 0 ? (
                        <div style={{
                            width: '210mm', maxWidth: '100%', minHeight: `${PAGE_HEIGHT_PX}px`,
                            display: 'flex', flexDirection: 'column',
                            background: theme.paperBg, border: `1px solid ${theme.paperBorder}`,
                            boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                            fontFamily: theme.fontFamily,
                        }}>
                            <div style={{ height: 6, background: theme.topBar1, flexShrink: 0 }} />
                            <div style={{ height: 2, background: theme.topBar2, marginTop: 3, flexShrink: 0 }} />
                            <div style={{ padding: '24px 40px', flex: 1 }}>
                                {renderBlock({ key: 'header', kind: 'header' })}
                                <p style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: theme.sectionMeta }}>No paper was attached to this assignment.</p>
                            </div>
                            <div style={{ height: 2, background: theme.topBar2, flexShrink: 0 }} />
                            <div style={{ height: 6, background: theme.topBar1, marginTop: 3, flexShrink: 0 }} />
                        </div>
                    ) : (
                        effectivePageGroups.map((group, pi) => (
                            <div key={`page-${pi}`} className={pi > 0 ? 'mt-6' : ''} style={{
                                width: '210mm', maxWidth: '100%', minHeight: `${PAGE_HEIGHT_PX}px`,
                                display: 'flex', flexDirection: 'column',
                                background: theme.paperBg, border: `1px solid ${theme.paperBorder}`,
                                boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                                fontFamily: theme.fontFamily,
                            }}>
                                <div style={{ height: 6, background: theme.topBar1, flexShrink: 0 }} />
                                <div style={{ height: 2, background: theme.topBar2, marginTop: 3, flexShrink: 0 }} />

                                {paper.institution && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 18,
                                        padding: '20px 40px 16px',
                                        borderBottom: `3px double ${theme.paperBorder}`, flexShrink: 0,
                                    }}>
                                        {paper.institution.logoUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={paper.institution.logoUrl} alt="" style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0 }} />
                                        )}
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <p style={{ fontSize: 26, fontWeight: 800, color: theme.titleColor, letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 1.15 }}>{paper.institution.name}</p>
                                            {(paper.institution.address || paper.institution.city || paper.institution.state || paper.institution.pincode) && (
                                                <p style={{ fontSize: 12.5, color: theme.sectionMeta, marginTop: 5 }}>
                                                    {[paper.institution.address, paper.institution.city, paper.institution.state, paper.institution.pincode].filter(Boolean).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        {paper.institution.logoUrl && <div style={{ width: 72, flexShrink: 0 }} />}
                                    </div>
                                )}

                                <div style={{ padding: '24px 40px', flex: 1 }}>
                                    {group.map((key) => {
                                        const block = flowBlocksByKey.get(key);
                                        if (!block) return null;
                                        return (
                                            <div key={key} ref={el => { if (el) blockElRefs.current.set(key, el); }} style={{ display: 'flow-root' }}>
                                                {renderBlock(block)}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ height: 2, background: theme.topBar2, flexShrink: 0 }} />
                                <div style={{ height: 6, background: theme.topBar1, marginTop: 3, flexShrink: 0 }} />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
