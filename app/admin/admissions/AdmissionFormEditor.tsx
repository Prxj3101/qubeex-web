'use client';

import { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { CheckCircle2, ChevronDown, Circle, ExternalLink, Eye, FileUp, GripVertical, MousePointerSquareDashed, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import AdmissionFormMapper from './AdmissionFormMapper';
import FormPreview, { MarkedPages } from './FormPreview';
import { PageBackground, pdfPageSizes } from './formTemplate';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Field, inputCls, Segmented, SecondaryButton, ThemedSelect, Toggle } from '@/app/admin/payroll/_components/ui';
import { apiError, FORM_SOURCES, scrollStyle, SPECIAL_BOXES, type AdmissionFormConfig, type FormField, type FormFieldType, type FormSection, type FormSource, type FormTemplatePage } from './admissions.types';

const TYPE_LABELS: Record<FormFieldType, string> = { text: 'Short text', textarea: 'Long text', date: 'Date', number: 'Number', select: 'Choose one', checkbox: 'Yes / No' };
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'field';
const uniqueId = (base: string, taken: string[]) => { let id = base, n = 2; while (taken.includes(id)) id = `${base}_${n++}`; return id; };
const move = <T,>(list: T[], i: number, by: number) => { const j = i + by; if (j < 0 || j >= list.length) return list; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; return next; };

const IconBtn = ({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) => (
    <button type="button" aria-label={label} title={label} onClick={onClick}
        className={`w-8 h-8 shrink-0 rounded-lg border border-border flex items-center justify-center text-muted-foreground ${danger ? 'hover:text-red-500' : 'hover:text-foreground'}`}>{children}</button>
);

/** The admission form setup page: how parents fill it, the printed form, the questions. */
export default function AdmissionFormEditor({ value: f, onChange }: { value: AdmissionFormConfig; onChange: (next: AdmissionFormConfig) => void }) {
    // Removing a question also removes its marked boxes on the school's form.
    const set = (patch: Partial<AdmissionFormConfig>) => onChange(dropLostBoxes({ ...f, ...patch }));
    // Sections fold so a long form stays easy to scan; one opens at a time.
    const [openId, setOpenId] = useState<string | null>(null);
    // An opened section starts at its top: scroll it there once the other one has folded.
    useEffect(() => {
        if (!openId) return;
        const t = setTimeout(() => {
            const el = document.querySelector<HTMLElement>(`[data-section="${CSS.escape(openId)}"]`);
            if (!el) return;
            // The list moves rows with an animation, so measure by layout (offsetTop), not by what is on screen.
            let box: HTMLElement | null = el.parentElement;
            while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
            if (!box) return;
            // Measure from the scroll box itself (made the offset parent for a moment).
            const was = box.style.position;
            if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
            let top = 0, node: HTMLElement | null = el;
            while (node && node !== box) { top += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
            box.style.position = was;
            box.scrollTo({ top: Math.max(0, top - 4), behavior: 'smooth' });
        }, 30);
        return () => clearTimeout(t);
    }, [openId]);
    const [mapping, setMapping] = useState(false);
    const [viewing, setViewing] = useState<false | 'form' | 'marked'>(false);
    const [preview, setPreview] = useState(false);
    const [toRemove, setToRemove] = useState<{ label: string; name: string; description: string; run: () => void } | null>(null);
    // Pages are drawn as wide as the dialog.
    const viewBox = useRef<HTMLDivElement>(null);
    const [viewWidth, setViewWidth] = useState(0);
    useEffect(() => {
        if (!viewing) return;
        const t = setTimeout(() => { if (viewBox.current) setViewWidth(viewBox.current.clientWidth - 4); }, 50);
        return () => clearTimeout(t);
    }, [viewing]);
    const [uploading, setUploading] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const t = f.template ?? { kind: 'QUBEEX', pages: [], boxes: [] };
    const setTemplate = (patch: Partial<typeof t>) => set({ template: { ...t, ...patch } });

    // The school's own form: a PDF is kept as it is; photos are shrunk to a
    // clear print size and kept as page images. Marks start fresh.
    const upload = async (files: FileList | null) => {
        if (!files?.length) return;
        try {
            const list = Array.from(files);
            let pages: FormTemplatePage[] = [];
            if (list.length === 1 && list[0].type === 'application/pdf') {
                setUploading('Uploading the PDF...');
                const bytes = new Uint8Array(await list[0].arrayBuffer());
                const sizes = await pdfPageSizes(bytes);
                if (!sizes.length) throw new Error('This PDF has no pages');
                const res = await api.post('/admin/admissions/admission-form/file', bytes, { headers: { 'Content-Type': 'application/pdf' } });
                pages = sizes.map((sz, i) => ({ url: res.data.data.url, type: 'pdf', pdfPage: i, width: sz.width, height: sz.height }));
            } else {
                for (const [i, file] of list.slice(0, 20).entries()) {
                    if (!file.type.startsWith('image/')) throw new Error('Upload one PDF, or photos of the pages');
                    setUploading(`Uploading page ${i + 1} of ${list.length}...`);
                    const { blob, w, h } = await toPrintJpeg(file);
                    const res = await api.post('/admin/admissions/admission-form/page', blob, { headers: { 'Content-Type': 'image/jpeg' } });
                    // Photo pages are treated as A4 wide, so text sizes match PDF pages.
                    pages.push({ url: res.data.data.url, type: 'image', pdfPage: 0, width: 595, height: Math.round(595 * (h / w)) });
                }
            }
            setTemplate({ kind: 'UPLOAD', pages, boxes: [] });
            toast.success(`${pages.length} page${pages.length === 1 ? '' : 's'} uploaded. Now mark where the answers go.`);
        } catch (err) { toast.error(err instanceof Error && !('response' in err) ? err.message : apiError(err, 'Could not upload the form')); }
        finally { setUploading(''); if (fileInput.current) fileInput.current.value = ''; }
    };

    // After marking, parents are asked only the questions that are on the school's form.
    const onlyMarked = (cfg: AdmissionFormConfig): AdmissionFormConfig => {
        const used = new Set((cfg.template?.boxes ?? []).map(b => b.fieldId));
        if (!used.size) return cfg;
        const sections = cfg.sections.map(x => ({ ...x, fields: x.fields.filter(q => used.has(q.id)) })).filter(x => x.fields.length);
        return sections.length ? { ...cfg, sections } : cfg;
    };
    // Every remove asks first, and says when marked boxes on the school's form go with it.
    const askRemove = (label: string, name: string, ids: string[], run: () => void) => {
        const n = (f.template?.boxes ?? []).filter(b => ids.includes(b.fieldId)).length;
        setToRemove({ label, name: name.trim() || `this ${label}`, run, description: n ? `${n} marked box${n === 1 ? '' : 'es'} on your form ${n === 1 ? 'uses' : 'use'} it and will be removed too.` : 'Parents will not be asked this any more.' });
    };
    const allIds = f.sections.flatMap(s => s.fields.map(x => x.id));
    const setSection = (id: string, patch: Partial<FormSection>) => set({ sections: f.sections.map(s => (s.id === id ? { ...s, ...patch } : s)) });
    // A question moves to the end of another section (drag only works inside one section).
    const moveToSection = (fieldId: string, from: string, to: string) => {
        if (from === to) return;
        const q = f.sections.find(x => x.id === from)?.fields.find(x => x.id === fieldId);
        if (!q) return;
        set({ sections: f.sections.map(x => (x.id === from ? { ...x, fields: x.fields.filter(y => y.id !== fieldId) } : x.id === to ? { ...x, fields: [...x.fields, q] } : x)) });
        toast.success(`Moved to ${f.sections.find(x => x.id === to)?.title || 'the section'}`);
    };
    const setField = (sectionId: string, fieldId: string, patch: Partial<FormField>) => {
        const s = f.sections.find(x => x.id === sectionId);
        if (s) setSection(sectionId, { fields: s.fields.map(x => (x.id === fieldId ? { ...x, ...patch } : x)) });
    };

    const step = (n: number) => <span className="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{n}</span>;
    const fieldCount = f.sections.reduce((n, s) => n + s.fields.length, 0);

    return (
        // On a wide screen the cards reach the bottom of the page and scroll inside.
        <div className="grid xl:grid-cols-2 gap-3 items-start xl:h-full xl:min-h-0 xl:items-stretch">
            <div className="space-y-3 xl:space-y-0 xl:flex xl:flex-col xl:gap-3 xl:min-h-0">
                <Card fill={f.mode === 'OFFLINE' ? false : undefined} head={<>{step(1)}How parents fill it</>} text="Choose once. You can change it any time.">
                    <Segmented value={f.mode} onChange={v => set({ mode: v })} options={[{ value: 'ONLINE', label: 'Online' }, { value: 'OFFLINE', label: 'Offline (paper)' }]} />
                    <p className="text-[11px] text-muted-foreground">
                        {f.mode === 'ONLINE'
                            ? 'Parents get a link with the offer and fill it on their phone. The office checks it and prints it for signatures.'
                            : "Your school's own paper form, the same as today. Give it to the parent; when it comes back filled, tick Form received in the child's details. Nothing else to set up."}
                    </p>
                    <Toggle checked={f.requiredForAdmit} onChange={v => set({ requiredForAdmit: v })} label="Needed before admitting" hint={f.mode === 'ONLINE' ? 'The child can be admitted only after the form is filled' : 'The child can be admitted only after the paper form is received'} />
                </Card>

                {f.mode === 'ONLINE' && <Card fill={t.kind === 'UPLOAD'} head={<>{step(2)}Printed form</>} text="What the office prints for signatures.">
                    <Segmented value={t.kind} onChange={v => setTemplate({ kind: v })} options={[{ value: 'QUBEEX', label: 'General form' }, { value: 'UPLOAD', label: "Our school's own form" }]} />
                    {t.kind === 'QUBEEX' ? (
                        <div className="space-y-3">
                            <p className="text-[11px] text-muted-foreground">Made from the questions in step 3, with your logo, school name and signature lines.</p>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Form title"><input maxLength={80} className={inputCls} value={f.title} onChange={e => set({ title: e.target.value })} /></Field>
                                <div className="flex items-end"><Toggle checked={f.photoBox} onChange={v => set({ photoBox: v })} label="Photo box" hint="The parent pastes a passport photo" /></div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple className="hidden" onChange={e => void upload(e.target.files)} />
                            <Task done={t.pages.length > 0} title="Upload your form" text={t.pages.length ? `${t.pages.length} page${t.pages.length === 1 ? '' : 's'} uploaded` : 'A PDF works best. Photos of each page also work. It is printed exactly as it is.'}>
                                <div className="flex gap-2">
                                    {t.pages.length > 0 && !uploading && <SecondaryButton type="button" onClick={() => setViewing('form')}><Eye size={13} />View</SecondaryButton>}
                                    <SecondaryButton type="button" disabled={!!uploading} onClick={() => (t.boxes.length ? setToRemove({ label: 'form', name: 'your uploaded form', description: `The ${t.boxes.length} boxes you marked will be removed. You then upload the new form and mark it again.`, run: () => fileInput.current?.click() }) : fileInput.current?.click())}><FileUp size={13} />{uploading || (t.pages.length ? 'Replace' : 'Upload')}</SecondaryButton>
                                </div>
                            </Task>
                            <Task done={t.boxes.length > 0} disabled={!t.pages.length} title="Mark where the answers go" text={t.boxes.length ? `${t.boxes.length} box${t.boxes.length === 1 ? '' : 'es'} marked. Parents are asked only these questions.` : 'AI can mark them for you. You check and fix. Parents are then asked only the questions on your form.'}>
<div className="flex gap-2">
                                    {t.boxes.length > 0 && <SecondaryButton type="button" onClick={() => setViewing('marked')}><Eye size={13} />View</SecondaryButton>}
                                    <SecondaryButton type="button" disabled={!t.pages.length} onClick={() => setMapping(true)}><MousePointerSquareDashed size={13} />{t.boxes.length ? 'Open' : 'Start'}</SecondaryButton>
                                </div>
                            </Task>
                        </div>
                    )}
                    <a href="/print/admission-form/blank" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                        <ExternalLink size={13} />See the printed form
                    </a>
                </Card>}

                {f.mode === 'ONLINE' && t.kind === 'QUBEEX' && (
                    <Card fill head={<>{step(4)}Declaration and signatures</>} text="Printed at the end of the form.">
                        <Field label="Declaration">
                            <textarea maxLength={1500} className={`${inputCls} h-24 py-2 resize-none`} value={f.declaration} onChange={e => set({ declaration: e.target.value })} />
                        </Field>
                        <Field label="Signature lines" hint="Up to 4, separated by commas">
                            <input className={inputCls} value={f.signatures.join(', ')} onChange={e => set({ signatures: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 4) })} />
                        </Field>
                    </Card>
                )}
            </div>

            {f.mode === 'ONLINE' && <Card fill head={<>{step(3)}Questions parents answer<span className="ml-auto text-[11px] font-normal text-muted-foreground">{f.sections.length} sections | {fieldCount} questions</span>
                {t.kind === 'UPLOAD' && t.pages.length > 0 && <SecondaryButton type="button" onClick={() => setPreview(v => !v)} aria-pressed={preview}><Eye size={13} />{preview ? 'Hide preview' : 'Preview'}</SecondaryButton>}</>} text="Open a section to change its questions. Questions marked From are filled for the parent from the application.">
                <Reorder.Group as="div" axis="y" values={f.sections} onReorder={next => set({ sections: next })} className="space-y-2">
                        {f.sections.map((s, si) => (
                            <DragItem key={s.id} anchor={s.id} value={s} label={`Reorder section ${s.title}`} onMove={by => set({ sections: move(f.sections, si, by) })} className="rounded-xl bg-muted/40 dark:bg-white/[0.04] p-3 space-y-2">{grip => <>
                                <div className="flex items-center gap-2">
                                    {grip}
                                    <button type="button" aria-expanded={openId === s.id} aria-label={openId === s.id ? 'Close section' : 'Open section'} onClick={() => setOpenId(openId === s.id ? null : s.id)}
                                        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"><ChevronDown size={15} className={`transition-transform ${openId === s.id ? 'rotate-180' : ''}`} /></button>
                                    <span className="w-5 text-xs font-bold text-muted-foreground">{si + 1}.</span>
                                    <input aria-label={`Section ${si + 1} title`} maxLength={80} className={`${inputCls} font-semibold`} value={s.title} onChange={e => setSection(s.id, { title: e.target.value })} />
                                    <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">{s.fields.length} field{s.fields.length === 1 ? '' : 's'}</span>
                                    <IconBtn label={`Remove section ${s.title}`} danger onClick={() => askRemove('section', s.title, s.fields.map(x => x.id), () => set({ sections: f.sections.filter(x => x.id !== s.id) }))}><Trash2 size={13} /></IconBtn>
                                </div>
                                {openId === s.id && <div className="space-y-2 pl-8">
                                    <Reorder.Group as="div" axis="y" values={s.fields} onReorder={next => setSection(s.id, { fields: next })} className="space-y-2">
                                    {s.fields.map((x, fi) => (
                                        <DragItem key={x.id} value={x} label={`Reorder ${x.label || 'question'}`} onMove={by => setSection(s.id, { fields: move(s.fields, fi, by) })} surface className="rounded-lg bg-card p-2 space-y-2">{fieldGrip => <>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {fieldGrip}
                                                <input aria-label="Field label" maxLength={120} className={`${inputCls} flex-1 min-w-[180px]`} value={x.label} onChange={e => setField(s.id, x.id, { label: e.target.value })} />
                                                <div className="w-36"><ThemedSelect value={x.type} onChange={v => setField(s.id, x.id, { type: v as FormFieldType })} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} /></div>
                                                <div className="w-40"><ThemedSelect value={x.source ?? 'NONE'} onChange={v => setField(s.id, x.id, { source: v === 'NONE' ? null : v as FormSource })}
                                                    options={[{ value: 'NONE', label: 'Parent fills' }, ...Object.entries(FORM_SOURCES).map(([value, label]) => ({ value, label: `From: ${label}` }))]} /></div>
                                                {f.sections.length > 1 && <div className="w-40"><ThemedSelect value={s.id} onChange={v => moveToSection(x.id, s.id, v)}
                                                    options={f.sections.map(o => ({ value: o.id, label: o.id === s.id ? `Section: ${o.title || 'Untitled'}` : `Move to: ${o.title || 'Untitled'}` }))} /></div>}
                                                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap"><input type="checkbox" checked={x.required} onChange={e => setField(s.id, x.id, { required: e.target.checked })} className="accent-[#DA7756]" />Must fill</label>
                                                <IconBtn label={`Remove ${x.label || 'field'}`} danger onClick={() => askRemove('question', x.label, [x.id], () => setSection(s.id, { fields: s.fields.filter(y => y.id !== x.id) }))}><Trash2 size={13} /></IconBtn>
                                            </div>
                                            {x.type === 'select' && (
                                                <input aria-label="Choices" placeholder="Choices, separated by commas (e.g. Hindi, English, Marathi)" className={inputCls}
                                                    value={x.options.join(', ')} onChange={e => setField(s.id, x.id, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean).slice(0, 20) })} />
                                            )}
                                        </>}</DragItem>
                                    ))}
                                    </Reorder.Group>
                                    {s.fields.length < 40 && (
                                        <SecondaryButton type="button" onClick={() => setSection(s.id, { fields: [...s.fields, { id: uniqueId(slug(`${s.id} field ${s.fields.length + 1}`), allIds), label: '', type: 'text', options: [], required: false, source: null }] })}>
                                            <Plus size={13} />Add field
                                        </SecondaryButton>
                                    )}
                                </div>}
                            </>}</DragItem>
                        ))}
                        </Reorder.Group>
                        {f.sections.length < 12 && (
                            <SecondaryButton type="button" onClick={() => { const id = uniqueId(`section_${f.sections.length + 1}`, f.sections.map(s => s.id)); set({ sections: [...f.sections, { id, title: 'New section', fields: [] }] }); setOpenId(id); }}>
                                <Plus size={13} />Add section
                            </SecondaryButton>
                        )}
            </Card>}
            <Dialog open={!!viewing} onOpenChange={o => { if (!o) setViewing(false); }}>
                <DialogContent className="sm:max-w-3xl bg-card max-h-[90vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{viewing === 'marked' ? 'Where the answers go' : 'Your uploaded form'}</DialogTitle>
                        <DialogDescription>{viewing === 'marked'
                            ? `${t.boxes.length} box${t.boxes.length === 1 ? '' : 'es'} marked on ${t.pages.length} page${t.pages.length === 1 ? '' : 's'}. Each box shows its question. Use Open to change them.`
                            : `${t.pages.length} page${t.pages.length === 1 ? '' : 's'}. This is printed as it is, with the answers filled in.`}</DialogDescription>
                    </DialogHeader>
                    <div ref={viewBox} className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1" style={scrollStyle}>
                        {viewing === 'marked' && viewWidth > 0 && <MarkedPages config={f} width={viewWidth} />}
                        {viewing === 'form' && t.pages.map((pg, i) => (
                            <div key={`${pg.url}-${pg.pdfPage}-${i}`} className="relative w-full bg-white shadow-sm" style={{ aspectRatio: `${pg.width} / ${pg.height}` }}>
                                <PageBackground page={pg} width={viewWidth} />
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
            <DeleteConfirmDialog open={!!toRemove} onOpenChange={o => { if (!o) setToRemove(null); }}
                confirmLabel={toRemove?.label === 'form' ? 'Replace' : 'Remove'} label={toRemove?.label === 'form' ? '' : toRemove?.label ?? ''} name={toRemove?.name ?? ''} description={toRemove?.description}
                onConfirm={() => { toRemove?.run(); setToRemove(null); }} />
            {preview && t.kind === 'UPLOAD' && t.pages.length > 0 && <FormPreview config={f} onClose={() => setPreview(false)} />}
            {mapping && <AdmissionFormMapper config={f} onClose={() => setMapping(false)} onSave={next => { onChange(onlyMarked(next)); setMapping(false); }} />}
        </div>
    );
}

const Card = ({ head, text, children, fill }: { head: React.ReactNode; text?: string; children: React.ReactNode; fill?: boolean }) => (
    <section data-admin-surface="" className={`rounded-2xl border border-border/60 bg-card p-5 space-y-4 xl:flex xl:flex-col xl:min-h-0 ${fill ? 'xl:flex-1' : 'xl:shrink-0'}`}>
        <div className="xl:shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2">{head}</h2>
            {text && <p className="text-xs text-muted-foreground mt-1">{text}</p>}
        </div>
        <div className={`space-y-4 ${fill ? 'xl:flex-1 xl:min-h-0 xl:overflow-y-auto xl:pr-1' : ''}`} style={fill ? scrollStyle : undefined}>{children}</div>
    </section>
);

/** A row that can be dragged by its grip (or moved with the arrow keys on the grip). */
function DragItem<T>({ value, label, className, onMove, surface, anchor, children }: { value: T; label: string; className: string; onMove: (by: -1 | 1) => void; surface?: boolean; anchor?: string; children: (grip: React.ReactNode) => React.ReactNode }) {
    const controls = useDragControls();
    const grip = (
        <button type="button" aria-label={label} title="Drag to move. Arrow keys also move it."
            className="flex h-8 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ touchAction: 'none' }} onPointerDown={e => controls.start(e)}
            onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); onMove(e.key === 'ArrowUp' ? -1 : 1); } }}>
            <GripVertical size={15} />
        </button>
    );
    return (
        <Reorder.Item as="div" value={value} dragListener={false} dragControls={controls} dragMomentum={false} className={`relative ${className}`} whileDrag={{ zIndex: 10, boxShadow: '0 8px 24px -8px rgba(0,0,0,0.25)' }} {...(surface ? { 'data-admin-surface': '' } : {})} {...(anchor ? { 'data-section': anchor } : {})}>
            {children(grip)}
        </Reorder.Item>
    );
}

/** One step of setting up the school's own form: done tick, what it is, its button. */
const Task = ({ done, disabled, title, text, children }: { done: boolean; disabled?: boolean; title: string; text: string; children?: React.ReactNode }) => (
    <div className={`flex items-center gap-3 rounded-xl bg-muted/40 dark:bg-white/[0.04] p-3 ${disabled ? 'opacity-50' : ''}`}>
        {done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : <Circle size={18} className="shrink-0 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{title}</p>
            <p className="text-[11px] text-muted-foreground">{text}</p>
        </div>
        {children}
    </div>
);

/** Drops marked boxes whose question was removed (the school's own form keeps only boxes it can fill). */
export const dropLostBoxes = (cfg: AdmissionFormConfig): AdmissionFormConfig => {
    const boxes = cfg.template?.boxes ?? [];
    if (!boxes.length) return cfg;
    const ids = new Set([...cfg.sections.flatMap(x => x.fields.map(q => q.id)), ...Object.keys(SPECIAL_BOXES)]);
    const keep = boxes.filter(b => ids.has(b.fieldId));
    return keep.length === boxes.length ? cfg : { ...cfg, template: { ...cfg.template, boxes: keep } };
};

/** True when every section and field has a name, so the form can be saved. */
export const formValid = (f: AdmissionFormConfig) =>
    !f.enabled || f.mode === 'OFFLINE' || (f.sections.length > 0 && f.title.trim() !== '' && f.sections.every(s => s.title.trim() && s.fields.every(x => x.label.trim() && (x.type !== 'select' || x.options.length > 0))));

/** A photo of a form page, shrunk to a clear print size (longest side 2000px) under 2 MB. */
async function toPrintJpeg(file: File): Promise<{ blob: Blob; w: number; h: number }> {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('Could not read the photo')); img.src = url; });
        const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const c = canvas.getContext('2d');
        if (!c) throw new Error('Could not read the photo');
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
        c.drawImage(img, 0, 0, w, h);
        for (const q of [0.85, 0.7, 0.55]) {
            const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', q));
            if (blob && blob.size <= 2 * 1024 * 1024) return { blob, w, h };
        }
        throw new Error('This photo is too large. Try a smaller one.');
    } finally { URL.revokeObjectURL(url); }
}
