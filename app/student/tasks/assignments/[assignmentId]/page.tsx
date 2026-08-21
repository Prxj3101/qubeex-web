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
    const [downloading, setDownloading] = useState(false);
    const [pageGroups, setPageGroups] = useState<string[][] | null>(null);
    const blockElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    // Fully custom pan + zoom for the section below the header — no native
    // browser/WebView scrolling or pinch-zoom involved at all anymore. Every
    // earlier attempt that mixed native scroll/zoom with our own JS state
    // (CSS `zoom`, then native pinch, then native scroll + JS zoom) kept
    // fighting itself in some platform-specific way (reflow jitter, the
    // whole page incl. header scaling, drifting off-center during pinch on
    // Android). Taking over both gestures entirely removes that ambiguity:
    // `zoom` is the scale factor, `panX`/`panY` is the translate offset (in
    // *unscaled* content px) — applied together as
    // `translate(panX, panY) scale(zoom)` with `transformOrigin: '0 0'` on
    // the content, inside a `backdropRef` viewport with `overflow: hidden`
    // and `touchAction: 'none'` so nothing native ever intercepts a touch.
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const MIN_ZOOM = 0.3;
    const MAX_ZOOM = 2.5;

    const backdropRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // Natural (unscaled) content size, measured via `offsetWidth/Height` —
    // pure layout properties, unaffected by the `transform` applied to this
    // same element, so they stay correct at any zoom level.
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const measure = () => setNaturalSize({ width: el.offsetWidth, height: el.offsetHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [paper, pageGroups]);

    // Live values for use inside native event listeners below, which close
    // over stale state otherwise since they're only attached once.
    const liveRef = useRef({ zoom, panX, panY });
    useEffect(() => { liveRef.current = { zoom, panX, panY }; }, [zoom, panX, panY]);

    // Re-centers the content on first load, once both the backdrop's visible
    // size and the content's natural size are known — fits the whole paper
    // to the viewport width (never upscaling past 100% on a screen that's
    // already wide enough, e.g. desktop) and centers it horizontally, top
    // edge flush. Only runs once per paper load (`initializedRef`), so it
    // doesn't fight the user's own zoom/pan afterwards.
    const initializedRef = useRef(false);
    useEffect(() => { initializedRef.current = false; }, [paper]);
    useEffect(() => {
        const backdropEl = backdropRef.current;
        if (!backdropEl || !naturalSize.width || initializedRef.current) return;
        initializedRef.current = true;
        const vw = backdropEl.clientWidth;
        const fitZoom = Math.min(1, vw / naturalSize.width);
        setZoom(fitZoom);
        setPanX((vw - naturalSize.width * fitZoom) / 2);
        setPanY(0);
    }, [naturalSize]);

    // Zooms the same way a pinch or the +/- buttons do — anchored on the
    // backdrop's own visible center, so whatever's currently in the middle
    // of the view stays there as the scale changes (instead of re-centering
    // on the *content's* center, which would jump the view if the user had
    // panned anywhere away from center first).
    const zoomAroundViewportCenter = (newZoomRaw: number) => {
        const backdropEl = backdropRef.current;
        if (!backdropEl) return;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoomRaw));
        const vw = backdropEl.clientWidth;
        const vh = backdropEl.clientHeight;
        const { zoom: curZoom, panX: curPanX, panY: curPanY } = liveRef.current;
        const contentCenterX = (vw / 2 - curPanX) / curZoom;
        const contentCenterY = (vh / 2 - curPanY) / curZoom;
        setZoom(newZoom);
        setPanX(vw / 2 - contentCenterX * newZoom);
        setPanY(vh / 2 - contentCenterY * newZoom);
    };
    const zoomIn = () => zoomAroundViewportCenter(Math.round((liveRef.current.zoom + 0.1) * 10) / 10);
    const zoomOut = () => zoomAroundViewportCenter(Math.round((liveRef.current.zoom - 0.1) * 10) / 10);

    // Touch handling — attached once (deps: `[]`) and always reads the
    // latest zoom/pan via `liveRef`, so it works correctly from the very
    // first touch (no more needing to tap a button once before pinch would
    // "wake up"). `touchAction: 'none'` on the backdrop means nothing native
    // ever competes with this: one finger drags to pan, two fingers pinch to
    // zoom (around the viewport's own center, same math as the buttons).
    useEffect(() => {
        const el = backdropRef.current;
        if (!el) return;
        const distance = (touches: TouchList) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.hypot(dx, dy);
        };
        let dragLast: { x: number; y: number } | null = null;
        let pinchStart: { distance: number; zoom: number; panX: number; panY: number } | null = null;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                dragLast = null;
                pinchStart = { distance: distance(e.touches), ...liveRef.current };
            } else if (e.touches.length === 1) {
                pinchStart = null;
                dragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 2 && pinchStart) {
                const factor = distance(e.touches) / pinchStart.distance;
                const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStart.zoom * factor));
                const rect = el.getBoundingClientRect();
                const vw = rect.width;
                const vh = rect.height;
                const contentCenterX = (vw / 2 - pinchStart.panX) / pinchStart.zoom;
                const contentCenterY = (vh / 2 - pinchStart.panY) / pinchStart.zoom;
                setZoom(newZoom);
                setPanX(vw / 2 - contentCenterX * newZoom);
                setPanY(vh / 2 - contentCenterY * newZoom);
            } else if (e.touches.length === 1 && dragLast) {
                const dx = e.touches[0].clientX - dragLast.x;
                const dy = e.touches[0].clientY - dragLast.y;
                setPanX(x => x + dx);
                setPanY(y => y + dy);
                dragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };
        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                pinchStart = null;
                dragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else {
                pinchStart = null;
                dragLast = null;
            }
        };
        // `passive: false` on touchmove is required so preventDefault()
        // actually stops any native handling from also kicking in.
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, []);

    // The fit-to-width and zoom/pan are now entirely our own JS (see above),
    // so the native browser/WebView viewport doesn't need to compute any
    // scaling itself anymore — just make sure its own pinch-zoom stays off
    // so it never competes with our custom gesture handling.
    useEffect(() => {
        if (!paper) return;
        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return;
        const originalContent = meta.getAttribute('content');
        meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
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
        // `offsetHeight` (not `getBoundingClientRect().height`) — it's a pure
        // layout measurement, unaffected by the `transform: scale` zoom
        // applied further up the tree, so page-break math always uses real
        // A4-scale pixel heights no matter what zoom level is showing.
        const heights = flowBlocks.map(b => {
            const el = blockElRefs.current.get(b.key);
            return { key: b.key, height: el ? el.offsetHeight : 0 };
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
        // A fixed-height flex column filling `main`'s box exactly — the
        // header is just a normal flex item now (no more position:fixed /
        // sticky / measured-offset juggling), and the backdrop below it is a
        // clipped viewport with no native scrolling at all, so our own
        // pan+zoom is the only thing moving the paper around. That removes
        // the whole earlier class of bugs (header/paper gap appearing on
        // Android, sticky header detaching in some WebViews, pinch drifting
        // because native scroll was fighting our transform).
        <div className="flex flex-col h-full">
            {/* Header — back button, title, Download PDF, all in one row. */}
            <div className="shrink-0 bg-background">
                <div className="flex items-center gap-3 max-w-3xl mx-auto px-3 pt-1 pb-3">
                    {!hideBackButton && (
                        <button onClick={() => router.back()}
                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                            <ArrowLeft size={15} className="text-foreground" />
                        </button>
                    )}
                    <h1 className="flex-1 min-w-0 text-lg font-bold truncate">{paper.assignment.title}</h1>
                    <div className="hidden sm:flex items-center gap-0.5 shrink-0 border border-border/50 rounded-xl bg-card p-0.5">
                        <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-all disabled:opacity-40">
                            <ZoomOut size={14} className="text-foreground" />
                        </button>
                        <span className="text-[11px] font-semibold text-muted-foreground w-9 text-center select-none">{Math.round(zoom * 100)}%</span>
                        <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
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

            {/* Backdrop — the clipped, pannable/zoomable viewport. Same grey/blue
                backdrop colour as the paper builder; paginates into separate A4
                sheets, one below the other, exactly like the teacher's builder. */}
            <div ref={backdropRef} className="relative flex-1 min-h-0 overflow-hidden" style={{ background: theme.outerBg, touchAction: 'none' }}>
                <div ref={contentRef} style={{ width: 'fit-content', transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: '0 0' }}>
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
