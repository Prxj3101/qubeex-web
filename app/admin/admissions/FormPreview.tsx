'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, X } from 'lucide-react';
import { BoxText, PageBackground, answerLines, boxTexts } from './formTemplate';
import { SPECIAL_BOXES, scrollStyle, type AdmissionFormConfig, type FormBox } from './admissions.types';

// A floating window with the school's form and its marked boxes (as on the
// marking screen), to arrange the questions in the same order. Drag it by the
// top bar, resize it from the corner. It follows every change straight away.

type Rect = { x: number; y: number; w: number; h: number };
const MIN_W = 320, MIN_H = 260;

export default function FormPreview({ config, onClose }: { config: AdmissionFormConfig; onClose: () => void }) {
    const [rect, setRect] = useState<Rect>(() => {
        const w = Math.min(560, Math.round(window.innerWidth * 0.4)), h = Math.round(window.innerHeight * 0.8);
        return { x: Math.max(8, window.innerWidth - w - 24), y: Math.max(8, Math.round(window.innerHeight * 0.1)), w, h };
    });
    const action = useRef<{ mode: 'move' | 'size'; sx: number; sy: number; start: Rect } | null>(null);
    const body = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => { if (body.current) setWidth(body.current.clientWidth - 16); }, [rect.w]);

    const down = (e: React.PointerEvent, mode: 'move' | 'size') => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        action.current = { mode, sx: e.clientX, sy: e.clientY, start: rect };
    };
    const move = (e: React.PointerEvent) => {
        const a = action.current;
        if (!a) return;
        const dx = e.clientX - a.sx, dy = e.clientY - a.sy;
        if (a.mode === 'move') setRect({ ...a.start, x: Math.min(window.innerWidth - 80, Math.max(80 - a.start.w, a.start.x + dx)), y: Math.min(window.innerHeight - 40, Math.max(0, a.start.y + dy)) });
        else setRect({ ...a.start, w: Math.max(MIN_W, Math.min(window.innerWidth - a.start.x - 4, a.start.w + dx)), h: Math.max(MIN_H, Math.min(window.innerHeight - a.start.y - 4, a.start.h + dy)) });
    };
    const up = () => { action.current = null; };

    return createPortal(
        <div role="dialog" aria-label="Form preview" className="fixed z-[60] flex flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
            <div className="flex h-10 shrink-0 cursor-move select-none items-center gap-2 border-b border-border/50 px-3" style={{ touchAction: 'none' }}
                onPointerDown={e => down(e, 'move')} onPointerMove={move} onPointerUp={up}>
                <GripHorizontal size={15} className="text-muted-foreground" />
                <p className="flex-1 truncate text-xs font-semibold">Your form, with the marked boxes</p>
                <button type="button" aria-label="Close preview" title="Close" onPointerDown={e => e.stopPropagation()} onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X size={15} /></button>
            </div>
            <div ref={body} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/40 p-2" style={scrollStyle}>
                {width > 0 && <MarkedPages config={config} width={width} />}
            </div>
            <span aria-hidden className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize" style={{ touchAction: 'none', background: 'linear-gradient(135deg, transparent 50%, rgba(120,120,120,0.55) 50%)' }}
                onPointerDown={e => down(e, 'size')} onPointerMove={move} onPointerUp={up} />
        </div>,
        document.body,
    );
}

/** The school's form pages with every marked box and its question, as on the marking screen. */
export function MarkedPages({ config, width }: { config: AdmissionFormConfig; width: number }) {
    const pages = config.template.pages;
    const boxes = config.template.boxes;
    const fields = config.sections.flatMap(s => s.fields);
    const label = (b: FormBox) => (b.kind === 'tick' ? '' : fields.find(f => f.id === b.fieldId)?.label ?? SPECIAL_BOXES[b.fieldId] ?? '');
    const texts = boxTexts(boxes, pages, label);
    const lineOf = new Map<string, string>();
    for (const chain of answerLines(boxes)) if (chain.length > 1) chain.forEach((b, i) => lineOf.set(b.id, `${i + 1}/${chain.length}`));
    return <>
        {pages.map((pg, i) => (
            <div key={`${pg.url}-${pg.pdfPage}-${i}`} className="relative bg-white shadow-sm" style={{ width, height: width * (pg.height / pg.width) }}>
                <PageBackground page={pg} width={width} />
                {boxes.filter(b => b.page === i).map(b => (
                    <div key={b.id} className="pointer-events-none absolute rounded-[2px] ring-1 ring-blue-500/70 bg-blue-500/10"
                        style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
                        {lineOf.has(b.id) && <span className="absolute -top-2 right-1 rounded bg-blue-600 px-1 text-[9px] font-bold leading-[14px] text-white">{lineOf.get(b.id)}</span>}
                    </div>
                ))}
                {boxes.filter(b => b.page === i).map(b => <BoxText key={`t${b.id}`} box={b} text={b.kind === 'tick' ? (b.option ?? '✓') : texts.get(b.id) ?? ''} page={pg} pageWidthPx={width} color="#1D4ED8" sample />)}
                <span className="absolute bottom-1 right-2 text-[10px] font-semibold text-slate-400">Page {i + 1}</span>
            </div>
        ))}
    </>;
}
