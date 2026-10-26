'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormBox, FormField, FormTemplatePage, FormValues } from './admissions.types';

// Shared by the marking screen and the printed form: draws one page of the
// school's own form (a PDF page or a photo) and the answers on top of it.

type PdfDoc = { getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }) => { promise: Promise<void> } }> };

let pdfjsPromise: Promise<{ getDocument: (o: object) => { promise: Promise<PdfDoc> } }> | null = null;
function loadPdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = import('react-pdf').then(m => {
            m.pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
            return m.pdfjs as unknown as { getDocument: (o: object) => { promise: Promise<PdfDoc> } };
        });
    }
    return pdfjsPromise;
}

const docs = new Map<string, Promise<PdfDoc>>();
/** Opens a PDF once (from a URL or the bytes just picked) and keeps it for every page. */
export function openPdf(src: string | Uint8Array): Promise<PdfDoc> {
    const key = typeof src === 'string' ? src : `bytes:${src.byteLength}:${src[100]}:${src[src.byteLength - 1]}`;
    let doc = docs.get(key);
    if (!doc) {
        doc = loadPdfjs().then(p => p.getDocument(typeof src === 'string' ? { url: src, disableRange: true, disableStream: true } : { data: src.slice() }).promise);
        docs.set(key, doc);
    }
    return doc;
}

/** Page sizes (in PDF points) of every page of a PDF. */
export async function pdfPageSizes(src: string | Uint8Array): Promise<{ width: number; height: number }[]> {
    const doc = await openPdf(src) as PdfDoc & { numPages: number };
    const out: { width: number; height: number }[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
        const v = (await doc.getPage(i)).getViewport({ scale: 1 });
        out.push({ width: v.width, height: v.height });
    }
    return out;
}

/** The page itself, drawn sharp at the shown width (PDF) or as the photo. */
export function PageBackground({ page, width, sharpness = 2 }: { page: FormTemplatePage; width: number; sharpness?: number }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    // Which page has finished drawing; anything else shows the loader.
    const key = `${page.url}#${page.pdfPage}#${Math.round(width)}`;
    const [drawn, setDrawn] = useState('');
    const [failed, setFailed] = useState('');
    useEffect(() => {
        if (page.type !== 'pdf' || !width) return;
        let cancelled = false;
        let task: { promise: Promise<void>; cancel?: () => void } | null = null;
        void openPdf(page.url).then(doc => doc.getPage(page.pdfPage + 1)).then(p => {
            const el = canvas.current;
            if (cancelled || !el) return;
            const base = p.getViewport({ scale: 1 });
            const viewport = p.getViewport({ scale: (width / base.width) * sharpness });
            el.width = Math.round(viewport.width);
            el.height = Math.round(viewport.height);
            const ctx = el.getContext('2d');
            if (!ctx) return;
            task = p.render({ canvasContext: ctx, viewport, canvas: el }) as typeof task;
            return task!.promise;
        }).then(() => { if (!cancelled) setDrawn(key); }).catch(() => { if (!cancelled) setFailed(key); });
        // A new size draws again on the same canvas: stop the old drawing first.
        return () => { cancelled = true; task?.cancel?.(); };
    }, [page.url, page.pdfPage, page.type, width, sharpness, key]);

    // eslint-disable-next-line @next/next/no-img-element
    if (page.type === 'image') return <img src={page.url} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />;
    return (
        <>
            <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
            {drawn !== key && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white text-slate-500" role="status">
                    {failed === key
                        ? <p className="text-sm font-medium text-red-600">Could not open this page. Check your internet and try again.</p>
                        : <>
                            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#DA7756]" />
                            <p className="text-sm font-medium">Opening the form...</p>
                        </>}
                </div>
            )}
        </>
    );
}

const dateDigits = (v: string, cells: number) => {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return v;
    return cells <= 6 ? `${m[3]}${m[2]}${m[1].slice(2)}` : `${m[3]}${m[2]}${m[1]}`;
};

/** What a box prints for this answer (empty when nothing should show). */
export function boxValue(box: FormBox, field: FormField | undefined, value: string | boolean | undefined): string {
    if (box.kind === 'tick') {
        if (value === true) return !box.option || box.option.toLowerCase() === 'yes' ? '✓' : '';
        if (value === false) return box.option?.toLowerCase() === 'no' ? '✓' : '';
        return typeof value === 'string' && box.option && value.trim().toLowerCase() === box.option.trim().toLowerCase() ? '✓' : '';
    }
    let text = typeof value === 'string' ? value : value === true ? 'Yes' : '';
    if (box.part && text) {
        // "Prajwal Jagdish Kotian": first = Prajwal, last = Kotian, middle = what is between.
        const words = text.trim().split(/\s+/);
        text = box.part === 'first' ? words[0] : box.part === 'last' ? (words.length > 1 ? words[words.length - 1] : '') : words.slice(1, -1).join(' ');
    }
    if (field?.type === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(text)) {
        text = box.kind === 'comb' ? dateDigits(text, box.cells ?? 8) : text.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
    }
    return box.upper ? text.toUpperCase() : text;
}

/** Boxes grouped into answers: a box marked "next" joins the box before it of the same question. */
export function answerLines(boxes: FormBox[]): FormBox[][] {
    const order = [...boxes].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    const chains: FormBox[][] = [];
    for (const b of order) {
        let prev: FormBox[] | undefined;
        for (let i = chains.length - 1; i >= 0 && !prev; i--) if (chains[i][0].fieldId === b.fieldId) prev = chains[i];
        if (b.next && b.kind === 'text' && prev && prev[prev.length - 1].kind === 'text') prev.push(b);
        else chains.push([b]);
    }
    return chains;
}

/**
 * The text each box prints. A box marked "next" takes over what did not fit in
 * the box before it of the same question, like writing on to the next line.
 */
let measureCtx: CanvasRenderingContext2D | null = null;
/** Answers are printed in this font, so the measured width matches what is shown. */
const ANSWER_FONT = 'Arial, Helvetica, sans-serif';
/** Width of a text at a font size (same units as the size). */
function textWidth(t: string, size: number): number {
    if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
    if (!measureCtx) return t.length * size * 0.55;
    measureCtx.font = `600 ${size}px ${ANSWER_FONT}`;
    return measureCtx.measureText(t).width;
}
export function boxTexts(boxes: FormBox[], pages: FormTemplatePage[], textOf: (b: FormBox) => string): Map<string, string> {
    const out = new Map<string, string>();
    // Width in PDF points at the box's size, with a little spare.
    const width = (t: string, b: FormBox) => textWidth(t, b.size) * 1.03;
    for (const chain of answerLines(boxes)) {
        let rest = textOf(chain[0]);
        if (chain.length === 1) { out.set(chain[0].id, rest); continue; }
        chain.forEach((b, i) => {
            if (i === chain.length - 1 || !rest) { out.set(b.id, rest); rest = ''; return; }
            const room = b.w * (pages[b.page]?.width ?? 595);
            const words = rest.split(/\s+/);
            let line = '';
            while (words.length && (!line || width(`${line} ${words[0]}`, b) <= room)) line = line ? `${line} ${words.shift()}` : words.shift()!;
            out.set(b.id, line);
            rest = words.join(' ');
        });
    }
    return out;
}

/** One box with its answer, placed on a page shown `pageWidthPx` wide. */
export function BoxText({ box, text, page, pageWidthPx, color = '#0B2A6F', sample = false }: { box: FormBox; text: string; page: FormTemplatePage; pageWidthPx: number; color?: string; sample?: boolean }) {
    if (!text) return null;
    const px = box.size * (pageWidthPx / page.width); // box.size is in PDF points
    const style: React.CSSProperties = { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, color, fontSize: px, lineHeight: 1.1, fontFamily: ANSWER_FONT };
    if (box.kind === 'tick') {
        const h = box.h * pageWidthPx * (page.height / page.width);
        return <span className="pointer-events-none absolute flex items-center justify-center font-bold" style={{ ...style, fontSize: Math.max(px, h * 0.9) }}>✓</span>;
    }
    if (box.kind === 'comb') {
        const n = Math.max(1, box.cells ?? text.length);
        return (
            <span className="pointer-events-none absolute flex items-center font-semibold" style={style}>
                {Array.from({ length: n }, (_, i) => <span key={i} className="flex-1 text-center">{text[i] ?? ''}</span>)}
            </span>
        );
    }
    // The set size when it fits; a longer answer shrinks to fit the line (down to 65%), then wraps.
    // A sample (on the marking screen) always shows the set size, cut with "..." when long.
    if (sample) return <span className="pointer-events-none absolute flex items-center overflow-hidden font-semibold whitespace-nowrap" style={style}><span className="truncate">{text}</span></span>;
    const avail = box.w * pageWidthPx * 0.98;
    const need = textWidth(text, px);
    const fit = need <= avail ? px : px * (avail / need);
    const wrap = fit < px * 0.65;
    return <span className={`pointer-events-none absolute flex items-center overflow-hidden font-semibold ${wrap ? 'whitespace-pre-wrap' : 'whitespace-nowrap'}`} style={{ ...style, fontSize: wrap ? px * 0.8 : fit }}>{text}</span>;
}

/** Answer lookup for printing: questions, plus the special boxes. */
export const valueFor = (fieldId: string, values: FormValues) => values[fieldId];
