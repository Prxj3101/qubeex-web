'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MousePointer2, Plus, Search, Sparkles, SquareDashed, Trash2, Type } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { detectBlanks, labelBlanks, matchLocally, numberedPicture, pageCanvas, pageWords, stripPictures, type Candidate } from './formDetect';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, inputCls, PrimaryButton, SecondaryButton, ThemedSelect, Toggle } from '@/app/admin/payroll/_components/ui';
import { BoxText, PageBackground, answerLines, boxTexts, boxValue } from './formTemplate';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { apiError, SPECIAL_BOXES, scrollStyle, type AdmissionFormConfig, type FormBox, type FormField } from './admissions.types';

type Tool = 'text' | 'comb' | 'tick';
const TOOLS: { value: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
    { value: 'text', label: 'Text', hint: 'A line or space for an answer', icon: <Type size={14} /> },
    { value: 'comb', label: 'Letter boxes', hint: 'One letter or date digit per box', icon: <SquareDashed size={14} /> },
    { value: 'tick', label: 'Tick', hint: 'A small box ticked for one choice', icon: <Check size={14} /> },
];
const OWN_SECTION = 'own_form';
let seq = 0;
const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'field';

/**
 * Full screen: the school's own form with boxes drawn where each answer goes.
 * Draw a box, pick which question it is, done. Once per form.
 */
export default function AdmissionFormMapper({ config, onSave, onClose }: { config: AdmissionFormConfig; onSave: (next: AdmissionFormConfig) => void; onClose: () => void }) {
    const [cfg, setCfg] = useState(config);
    const [pageNo, setPageNo] = useState(0);
    const [tool, setTool] = useState<Tool>('text');
    const [selected, setSelected] = useState<string | null>(null);
    const [sample, setSample] = useState(true);
    const [newField, setNewField] = useState('');
    const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const area = useRef<HTMLDivElement>(null);
    const drag = useRef<{ mode: 'draw' | 'move' | 'resize'; startX: number; startY: number; box?: FormBox } | null>(null);
    const [width, setWidth] = useState(820);
    const [auto, setAuto] = useState('');

    const pages = cfg.template.pages;
    const page = pages[pageNo];
    const boxes = cfg.template.boxes;
    const box = boxes.find(b => b.id === selected) ?? null;
    const fields = useMemo(() => cfg.sections.flatMap(s => s.fields.map(f => ({ ...f, section: s.title }))), [cfg.sections]);
    const fieldOf = (id: string) => fields.find(f => f.id === id);

    // Page width follows the screen; positions are fractions, so nothing moves.
    useEffect(() => {
        const el = area.current?.parentElement;
        if (!el) return;
        const ro = new ResizeObserver(() => setWidth(Math.max(320, Math.min(1000, el.clientWidth - 32))));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const setBoxes = (next: FormBox[]) => setCfg(c => ({ ...c, template: { ...c.template, boxes: next } }));
    const patchBox = (id: string, patch: Partial<FormBox>) => setBoxes(boxes.map(b => (b.id === id ? { ...b, ...patch } : b)));
    const removeBox = (id: string) => { setBoxes(boxes.filter(b => b.id !== id)); setSelected(null); };
    // Removing a box asks first (from the button or the Delete key).
    const [askRemove, setAskRemove] = useState<string | null>(null);
    // A new line just below, for the same question; the answer runs on into it.
    const addNextLine = (b: FormBox) => {
        const gap = b.h * 0.35;
        const nb: FormBox = { ...b, id: newId(), y: Math.min(1 - b.h, b.y + b.h + gap), next: true, part: undefined };
        setBoxes([...boxes, nb]);
        setSelected(nb.id);
        if (fieldOf(b.fieldId)?.type === 'text') setCfg(c => ({ ...c, sections: c.sections.map(x => ({ ...x, fields: x.fields.map(q => (q.id === b.fieldId ? { ...q, type: 'textarea' } : q)) })) }));
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!selected || askRemove || (e.target as HTMLElement)?.closest('input, textarea, select, [role="combobox"]')) return;
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setAskRemove(selected); return; }
            // Arrow keys move the box 1px (10px with Shift); Alt + arrows change its size.
            const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            const b = boxes.find(x => x.id === selected);
            if (!dir || !b || !page) return;
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const dx = (dir[0] * step) / width, dy = (dir[1] * step) / (width * (page.height / page.width));
            if (e.altKey) patchBox(b.id, { w: clamp(b.w + dx, 0.005, 1 - b.x), h: clamp(b.h + dy, 0.005, 1 - b.y) });
            else patchBox(b.id, { x: clamp(b.x + dx, 0, 1 - b.w), y: clamp(b.y + dy, 0, 1 - b.h) });
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const point = (e: React.PointerEvent) => {
        const r = area.current!.getBoundingClientRect();
        return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
    };
    const onDown = (e: React.PointerEvent, target?: FormBox, mode: 'move' | 'resize' = 'move') => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const p = point(e);
        if (target) { setSelected(target.id); drag.current = { mode, startX: p.x, startY: p.y, box: target }; }
        else { setSelected(null); drag.current = { mode: 'draw', startX: p.x, startY: p.y }; setDraft({ x: p.x, y: p.y, w: 0, h: 0 }); }
    };
    const onMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const p = point(e);
        if (d.mode === 'draw') setDraft({ x: Math.min(d.startX, p.x), y: Math.min(d.startY, p.y), w: Math.abs(p.x - d.startX), h: Math.abs(p.y - d.startY) });
        else if (d.box && d.mode === 'move') patchBox(d.box.id, { x: clamp(d.box.x + p.x - d.startX, 0, 1 - d.box.w), y: clamp(d.box.y + p.y - d.startY, 0, 1 - d.box.h) });
        else if (d.box) patchBox(d.box.id, { w: clamp(d.box.w + p.x - d.startX, 0.004, 1 - d.box.x), h: clamp(d.box.h + p.y - d.startY, 0.004, 1 - d.box.y) });
    };
    const onUp = () => {
        const d = drag.current;
        drag.current = null;
        if (d?.mode === 'draw' && draft) {
            setDraft(null);
            if (draft.w < 0.006 || draft.h < 0.004) return;
            const b: FormBox = { id: newId(), page: pageNo, ...draft, fieldId: '', kind: tool, upper: tool === 'comb', size: 10, ...(tool === 'comb' ? { cells: 10 } : {}) };
            setBoxes([...boxes, b]);
            setSelected(b.id);
        }
    };

    // A new question that only this school asks, kept in its own section.
    const addField = (label: string, type: FormField['type']) => {
        const taken = fields.map(f => f.id);
        let id = slug(label), n = 2;
        while (taken.includes(id) || id in SPECIAL_BOXES) id = `${slug(label)}_${n++}`;
        const f: FormField = { id, label, type, options: [], required: false, source: null };
        setCfg(c => {
            const has = c.sections.some(s => s.id === OWN_SECTION);
            const sections = has ? c.sections.map(s => (s.id === OWN_SECTION ? { ...s, fields: [...s.fields, f] } : s)) : [...c.sections, { id: OWN_SECTION, title: 'More details', fields: [f] }];
            return { ...c, sections };
        });
        return id;
    };
    const renameField = (fieldId: string, label: string) => setCfg(c => ({
        ...c, sections: c.sections.map(x => ({ ...x, fields: x.fields.map(q => (q.id === fieldId ? { ...q, label } : q)) })),
    }));
    const addOption = (fieldId: string, option: string) => setCfg(c => ({
        ...c, sections: c.sections.map(s => ({ ...s, fields: s.fields.map(f => (f.id === fieldId && !f.options.includes(option) ? { ...f, type: f.type === 'text' ? 'select' : f.type, options: [...f.options, option] } : f)) })),
    }));

    const fieldOptions = [
        ...Object.entries(SPECIAL_BOXES).map(([value, label]) => ({ value, label: `School: ${label}` })),
        ...fields.map(f => ({ value: f.id, label: `${f.section}: ${f.label}` })),
    ];
    // Which line of a longer answer each box is ("2/3").
    const lineOf = new Map<string, { n: number; of: number }>();
    for (const chain of answerLines(boxes.filter(b => b.fieldId))) if (chain.length > 1) chain.forEach((b, i) => lineOf.set(b.id, { n: i + 1, of: chain.length }));
    const done = boxes.filter(b => b.fieldId).length;
    const pageBoxes = boxes.filter(b => b.page === pageNo);
    const sampleText = (b: FormBox) => {
        const f = fieldOf(b.fieldId);
        if (b.kind === 'tick') return b.fieldId ? '✓' : '';
        // "Occupation" is asked for the father and the mother: say whose it is.
        const shared = f && fields.some(o => o.id !== f.id && o.label.trim().toLowerCase() === f.label.trim().toLowerCase());
        const label = f ? (shared ? `${f.section.replace(/\s*details$/i, '')} ${f.label}` : f.label) : SPECIAL_BOXES[b.fieldId] ?? '';
        if (b.part) return boxValue(b, f, 'Aarav Kumar Sharma');
        // A question with more lines: a long sample shows how the answer runs on.
        if (b.kind === 'text' && boxes.some(o => o.next && o.fieldId === b.fieldId)) return boxValue(b, f, `${label}: Flat 12, Green Park Society, MG Road, Near City Hospital, Sector 5, New Town, Pune, Maharashtra 411001`);
        return boxValue(b, f, b.kind === 'comb' ? (f?.type === 'date' ? '2021-06-15' : label.replace(/\s+/g, '')) : label);
    };

    // AI auto-mark: the browser finds the blanks, the AI names them. Pages that
    // already have boxes are left as they are.
    const autoMark = async () => {
        if (auto) return;
        let next = cfg;
        let added = 0, skipped = 0;
        try {
            for (let i = 0; i < pages.length; i++) {
                if (next.template.boxes.some(b => b.page === i)) { skipped++; continue; }
                setAuto(`Reading page ${i + 1} of ${pages.length}...`);
                const canvas = await pageCanvas(pages[i]);
                const words = await pageWords(pages[i]);
                const list = labelBlanks(detectBlanks(canvas), words);
                if (!list.length) continue;
                // Boxes whose printed words are exactly one of our questions are named here, free.
                const local = matchLocally(list, next.sections.flatMap(x => x.fields));
                const items: AutoItem[] = local.map(l => ({ n: l.n, field: l.field, label: null, option: null }));
                const rest = list.filter(c => !local.some(l => l.n === c.n));
                if (rest.length) {
                    const allFields = next.sections.flatMap(x => x.fields.map(f => ({ ...f, label: `${x.title}: ${f.label}`.slice(0, 120) })));
                    // A PDF with real text: its words go to the AI as text, no pictures needed.
                    const textOnly = words.length > 20 && rest.filter(c => c.text || c.after).length >= rest.length * 0.7;
                    const body = {
                        ...(textOnly ? {} : { image: numberedPicture(canvas, rest), strips: stripPictures(canvas, rest) }),
                        candidates: rest.map(c => ({ n: c.n, kind: c.kind, ...(c.cells ? { cells: c.cells } : {}), ...(c.text ? { text: c.text } : {}), ...(c.after ? { after: c.after } : {}), ...(c.under ? { under: c.under } : {}) })),
                        fields: allFields.map(f => ({ id: f.id, label: f.label, type: f.type, options: f.options })),
                    };
                    // The AI allows only so much per minute: when it is busy, wait and try again (twice).
                    let res;
                    for (let tries = 0; ; tries++) {
                        try { res = await api.post('/admin/admissions/admission-form/auto-mark', body); break; } catch (err) {
                            if ((err as { response?: { status?: number } })?.response?.status !== 429 || tries >= 2) throw err;
                            for (let s = 40; s > 0; s--) {
                                setAuto(`The AI is busy. Trying page ${i + 1} again in ${s}s...`);
                                await new Promise(r => setTimeout(r, 1000));
                            }
                            setAuto(`Reading page ${i + 1} of ${pages.length}...`);
                        }
                    }
                    items.push(...(res.data.data.items as AutoItem[]));
                }
                const result = applyAuto(next, i, list, items);
                next = result.cfg;
                added += result.added;
            }
            setCfg(next);
            if (added) toast.success(`${added} boxes marked. Check them, fix any that are wrong, then use these boxes.`);
            else toast.message(skipped ? 'Pages that already had boxes were left as they are.' : 'No blanks were found. Please mark the boxes by hand.');
        } catch (err) {
            setCfg(next);
            toast.error(apiError(err, 'Auto-mark stopped. You can mark the rest by hand.'), { description: added ? 'The pages already marked are kept. Press Auto-mark again later to do the rest.' : undefined });
        } finally { setAuto(''); }
    };

    const save = () => {
        onSave({ ...cfg, template: { ...cfg.template, boxes: boxes.filter(b => b.fieldId) } });
    };

    if (!page) return null;
    const heightPx = width * (page.height / page.width);

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="!max-w-[min(1400px,98vw)] w-[98vw] h-[94vh] bg-card flex flex-col overflow-hidden p-0 gap-0" onEscapeKeyDown={e => { if ((e.target as HTMLElement | null)?.closest?.('[data-search-select]')) e.preventDefault(); }}>
                <DialogHeader className="shrink-0 px-5 pt-4 pb-3 border-b border-border/50">
                    <DialogTitle>Mark your form</DialogTitle>
                    <DialogDescription>Pick a tool, then drag on the form where an answer goes and choose the question. Done once; every child&apos;s form is printed this way.</DialogDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50">
                            {TOOLS.map(t => (
                                <button key={t.value} type="button" title={t.hint} aria-pressed={tool === t.value} onClick={() => setTool(t.value)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${tool === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{t.icon}{t.label}</button>
                            ))}
                        </div>
                        {pages.length > 1 && (
                            <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                {pages.map((_, i) => (
                                    <button key={i} type="button" aria-pressed={pageNo === i} onClick={() => { setPageNo(i); setSelected(null); }}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium ${pageNo === i ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                        Page {i + 1}<span className="ml-1 text-[10px] text-muted-foreground">({boxes.filter(b => b.page === i && b.fieldId).length})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <button type="button" disabled={!!auto} onClick={() => void autoMark()} title="AI finds the blanks and names them. You check and fix."
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
                            {auto ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Sparkles size={13} />}{auto || 'Auto-mark with AI'}
                        </button>
                        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={sample} onChange={e => setSample(e.target.checked)} className="accent-[#DA7756]" />Show sample text</label>
                        <span className="text-xs text-muted-foreground">{done} marked</span>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex">
                    <div className="flex-1 min-w-0 overflow-auto bg-muted/40 p-4" style={scrollStyle}>
                        <div ref={area} className="relative mx-auto bg-white shadow-md select-none touch-none cursor-crosshair" style={{ width, height: heightPx }}
                            onPointerDown={e => onDown(e)} onPointerMove={onMove} onPointerUp={onUp}>
                            <PageBackground page={page} width={width} />
                            {pageBoxes.map(b => {
                                const on = b.id === selected;
                                return (
                                    <div key={b.id} onPointerDown={e => onDown(e, b)}
                                        className={`absolute cursor-move rounded-[2px] ${on ? 'ring-2 ring-[#DA7756] bg-[#DA7756]/10' : b.fieldId ? 'ring-1 ring-blue-500/70 bg-blue-500/10' : 'ring-2 ring-amber-500 bg-amber-400/20'}`}
                                        style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
                                        {b.kind === 'comb' && <div className="absolute inset-0 flex">{Array.from({ length: b.cells ?? 1 }, (_, i) => <span key={i} className="flex-1 border-r border-blue-500/30 last:border-r-0" />)}</div>}
                                        {lineOf.has(b.id) && <span className="pointer-events-none absolute -top-2 right-1 rounded bg-blue-600 px-1 text-[9px] font-bold leading-[14px] text-white">{lineOf.get(b.id)!.n}/{lineOf.get(b.id)!.of}</span>}
                                        {on && <span onPointerDown={e => onDown(e, b, 'resize')} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-[#DA7756]" />}
                                    </div>
                                );
                            })}
                            {sample && (() => {
                                const texts = boxTexts(boxes, pages, sampleText);
                                return pageBoxes.map(b => <BoxText key={`t${b.id}`} box={b} text={texts.get(b.id) ?? ''} page={page} pageWidthPx={width} color="#1D4ED8" sample />);
                            })()}
                            {draft && <div className="absolute ring-2 ring-[#DA7756] bg-[#DA7756]/10" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
                        </div>
                    </div>

                    <aside className="w-[320px] shrink-0 border-l border-border/50 overflow-y-auto p-4 space-y-4" style={scrollStyle}>
                        {!box ? (
                            <div className="space-y-3 text-sm">
                                <p className="flex items-center gap-2 font-semibold"><MousePointer2 size={15} />How to mark</p>
                                <ol className="list-decimal pl-5 space-y-1.5 text-[13px] text-muted-foreground">
                                    <li>Pick <b>Text</b>, <b>Letter boxes</b> or <b>Tick</b> at the top.</li>
                                    <li>Drag on the form over the space for the answer.</li>
                                    <li>Choose which question it is (or add a new one).</li>
                                    <li>For Tick, draw one box per choice (e.g. Male, Female) and pick the choice.</li>
                                </ol>
                                <p className="text-[12px] text-muted-foreground">Click a box to change it. Drag to move, the corner to resize, Delete to remove. Amber boxes still need a question.</p>
                                <p className="text-[12px] text-muted-foreground">Fine moves: arrow keys move the box (Shift for bigger steps), Alt + arrows change its size.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">{TOOLS.find(t => t.value === box.kind)?.label} box</p>
                                    <button type="button" onClick={() => setAskRemove(box.id)} className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline"><Trash2 size={12} />Remove</button>
                                </div>
                                <Field label="Type of box">
                                    <ThemedSelect value={box.kind} onChange={v => patchBox(box.id, { kind: v as Tool, ...(v === 'comb' && !box.cells ? { cells: 10 } : {}) })} options={TOOLS.map(t => ({ value: t.value, label: t.label }))} />
                                </Field>
                                <Field label="Question">
                                    <SearchSelect value={box.fieldId} placeholder="Choose the question" onChange={v => patchBox(box.id, { fieldId: v, option: undefined })} options={fieldOptions} />
                                </Field>
                                {box.fieldId && fieldOf(box.fieldId) && (
                                    <Field label="Question name" hint="Change the words; every box of this question uses them">
                                        <input className={inputCls} maxLength={120} value={fieldOf(box.fieldId)!.label} onChange={e => renameField(box.fieldId, e.target.value)} />
                                    </Field>
                                )}
                                <div className="rounded-xl bg-muted/40 p-2.5 space-y-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground">Not in the list? Add the question</p>
                                    <div className="flex gap-2">
                                        <input className={inputCls} placeholder="e.g. Social category" maxLength={120} value={newField} onChange={e => setNewField(e.target.value)} />
                                        <SecondaryButton type="button" disabled={!newField.trim()} onClick={() => { const id = addField(newField.trim(), box.kind === 'tick' ? 'select' : 'text'); patchBox(box.id, { fieldId: id }); setNewField(''); }}><Plus size={13} /></SecondaryButton>
                                    </div>
                                </div>
                                {box.kind === 'tick' && box.fieldId && (() => {
                                    const f = fieldOf(box.fieldId);
                                    return (
                                        <Field label="Tick when the answer is" hint="Draw one tick box for every choice on your form">
                                            {f && f.type === 'checkbox'
                                                ? <ThemedSelect value={box.option ?? 'Yes'} onChange={v => patchBox(box.id, { option: v })} options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                                                : <>
                                                    {f && f.options.length > 0 && <ThemedSelect value={box.option ?? ''} placeholder="Choose" onChange={v => patchBox(box.id, { option: v })} options={f.options.map(o => ({ value: o, label: o }))} />}
                                                    <input className={`${inputCls} mt-2`} placeholder="Or type a new choice, e.g. OBC" maxLength={60}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = e.currentTarget.value.trim(); if (v) { addOption(box.fieldId, v); patchBox(box.id, { option: v }); e.currentTarget.value = ''; } } }} />
                                                </>}
                                        </Field>
                                    );
                                })()}
                                {box.kind !== 'tick' && box.fieldId && (fieldOf(box.fieldId)?.label ?? '').toLowerCase().includes('name') && (
                                    <Field label="Which part of the name" hint="For forms with separate first name, middle name and surname">
                                        <ThemedSelect value={box.part ?? 'whole'} onChange={v => patchBox(box.id, { part: v === 'whole' ? undefined : v as FormBox['part'] })}
                                            options={[{ value: 'whole', label: 'Whole name' }, { value: 'first', label: 'First name' }, { value: 'middle', label: 'Middle name' }, { value: 'last', label: 'Surname (last word)' }]} />
                                    </Field>
                                )}
                                {box.kind === 'comb' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Field label="Number of boxes"><input type="number" min={1} max={80} className={inputCls} value={box.cells ?? 10} onChange={e => patchBox(box.id, { cells: Math.min(80, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
                                        <div className="flex items-end pb-1"><Toggle checked={box.upper} onChange={v => patchBox(box.id, { upper: v })} label="CAPITALS" /></div>
                                    </div>
                                )}
                                {box.kind === 'text' && <Toggle checked={box.upper} onChange={v => patchBox(box.id, { upper: v })} label="Print in CAPITAL letters" />}
                                {box.kind === 'text' && box.fieldId && (
                                    <div className="rounded-xl bg-muted/40 p-2.5 space-y-2">
                                        <p className="text-[11px] font-semibold text-muted-foreground">Answer on more than one line</p>
                                        <p className="text-[11px] text-muted-foreground">{lineOf.has(box.id) ? `This answer uses ${lineOf.get(box.id)!.of} lines - this box is line ${lineOf.get(box.id)!.n}. To remove a line, delete its box.` : 'This answer uses 1 line. If your form has more lines for it, add them here.'}</p>
                                        <SecondaryButton type="button" onClick={() => addNextLine(box)}><Plus size={13} />Add next line</SecondaryButton>
                                    </div>
                                )}
                                {box.kind !== 'tick' && (
                                    <Field label={`Text size: ${box.size}`}>
                                        <input type="range" min={6} max={20} step={0.5} value={box.size} onChange={e => patchBox(box.id, { size: Number(e.target.value) })} className="w-full accent-[#DA7756]" />
                                    </Field>
                                )}
                            </div>
                        )}
                    </aside>
                </div>

                <div className="shrink-0 flex items-center justify-between gap-2 border-t border-border/50 px-5 py-3">
                    <p className="text-xs text-muted-foreground">{boxes.some(b => !b.fieldId) ? 'Boxes without a question are left out when you save.' : 'Settings save by themselves after you use the boxes.'}</p>
                    <div className="flex gap-2">
                        <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
                        <PrimaryButton type="button" onClick={save}>Use these boxes</PrimaryButton>
                    </div>
                </div>
                <DeleteConfirmDialog open={!!askRemove} onOpenChange={o => { if (!o) setAskRemove(null); }} confirmLabel="Remove" label="box"
                    name={(() => { const b = boxes.find(x => x.id === askRemove); return b ? fieldOf(b.fieldId)?.label ?? SPECIAL_BOXES[b.fieldId] ?? 'without a question' : ''; })()}
                    description="It is removed from your form. You can draw it again any time."
                    onConfirm={() => { if (askRemove) removeBox(askRemove); setAskRemove(null); }} />
            </DialogContent>
        </Dialog>
    );
}

/** Turns the AI's answers into boxes (and new questions) on one page. */
type AutoItem = { n: number; field: string | null; label: string | null; option: string | null; part?: 'first' | 'middle' | 'last' | null; next?: boolean };
function applyAuto(cfg: AdmissionFormConfig, page: number, list: Candidate[], items: AutoItem[]): { cfg: AdmissionFormConfig; added: number } {
    let sections = cfg.sections.map(s => ({ ...s, fields: s.fields.map(f => ({ ...f, options: [...f.options] })) }));
    const all = () => sections.flatMap(s => s.fields);
    const byLabel = new Map<string, string>();
    const ensureField = (label: string, kind: Candidate['kind']): string => {
        const key = label.trim().toLowerCase();
        const same = all().find(f => f.label.trim().toLowerCase() === key) ?? (byLabel.has(key) ? all().find(f => f.id === byLabel.get(key)) : undefined);
        if (same) return same.id;
        const taken = all().map(f => f.id);
        let id = slug(label), n = 2;
        while (taken.includes(id) || id in SPECIAL_BOXES) id = `${slug(label)}_${n++}`;
        const type: FormField['type'] = kind === 'box' ? 'select' : /\b(date|dob|birth)\b/i.test(label) ? 'date' : 'text';
        const f: FormField = { id, label: label.trim().slice(0, 120), type, options: [], required: false, source: null };
        sections = sections.some(s => s.id === OWN_SECTION)
            ? sections.map(s => (s.id === OWN_SECTION ? { ...s, fields: [...s.fields, f] } : s))
            : [...sections, { id: OWN_SECTION, title: 'More details', fields: [f] }];
        byLabel.set(key, id);
        return id;
    };
    const boxes: FormBox[] = [];
    for (const it of items) {
        const c = list.find(x => x.n === it.n);
        if (!c) continue;
        const fieldId = it.field ?? (it.label ? ensureField(it.label, c.kind) : null);
        if (!fieldId) continue;
        const kind = c.kind === 'box' ? 'tick' : c.kind === 'comb' ? 'comb' : 'text';
        let option: string | undefined;
        if (kind === 'tick') {
            option = it.option?.trim() || 'Yes';
            const f = all().find(x => x.id === fieldId);
            if (f && f.type !== 'checkbox' && !f.options.some(o => o.toLowerCase() === option!.toLowerCase())) {
                if (f.type === 'text') f.type = 'select';
                f.options.push(option);
            } else if (f) option = f.options.find(o => o.toLowerCase() === option!.toLowerCase()) ?? option;
        }
        boxes.push({ id: newId(), page, x: c.x, y: c.y, w: c.w, h: c.h, fieldId, kind, upper: kind === 'comb', size: 10, ...(kind === 'comb' ? { cells: c.cells } : {}), ...(option ? { option } : {}), ...(it.part && kind !== 'tick' ? { part: it.part } : {}), ...(it.next && kind === 'text' ? { next: true } : {}) });
        // A question with more lines is a long answer for the parent too.
        if (it.next && kind === 'text') { const f = all().find(x => x.id === fieldId); if (f && f.type === 'text') f.type = 'textarea'; }
    }
    return { cfg: { ...cfg, sections, template: { ...cfg.template, boxes: [...cfg.template.boxes, ...boxes] } }, added: boxes.length };
}

/** A list to choose from with a search box on top (the question list is long). */
function SearchSelect({ value, options, onChange, placeholder }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder: string }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [at, setAt] = useState(0);
    const root = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = options.filter(o => words.every(w => o.label.toLowerCase().includes(w)));
    const current = options.find(o => o.value === value);
    useEffect(() => {
        if (!open) return;
        const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', away);
        return () => document.removeEventListener('pointerdown', away);
    }, [open]);
    useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${at}"]`)?.scrollIntoView({ block: 'nearest' }); }, [at]);
    const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };
    return (
        <div ref={root} className="relative" data-search-select="">
            <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen(o => !o); setQ(''); setAt(Math.max(0, options.findIndex(o => o.value === value))); }}
                className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm">
                <span className={`truncate ${current ? '' : 'text-muted-foreground'}`}>{current?.label ?? placeholder}</span>
                <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-border bg-card p-1 shadow-xl">
                    <div className="relative mb-1">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input autoFocus value={q} placeholder="Search questions" className={`${inputCls} pl-8`}
                            onChange={e => { setQ(e.target.value); setAt(0); }}
                            onKeyDown={e => {
                                if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => Math.min(shown.length - 1, i + 1)); }
                                else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => Math.max(0, i - 1)); }
                                else if (e.key === 'Enter') { e.preventDefault(); if (shown[at]) pick(shown[at].value); }
                                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
                            }} />
                    </div>
                    <div ref={list} role="listbox" className="max-h-72 overflow-y-auto" style={scrollStyle}>
                        {shown.length === 0 && <p className="px-2.5 py-2 text-xs text-muted-foreground">No question matches. Add it below.</p>}
                        {shown.map((o, i) => (
                            <button key={o.value} type="button" role="option" aria-selected={o.value === value} data-i={i}
                                onMouseEnter={() => setAt(i)} onClick={() => pick(o.value)}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${i === at ? 'bg-muted' : ''}`}>
                                <span className="truncate">{o.label}</span>
                                {o.value === value && <Check size={14} className="shrink-0 text-primary" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
