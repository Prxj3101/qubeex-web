'use client';

import { Fragment, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Pencil, RotateCcw, Check, CheckCheck, SkipForward, PhoneOff, Send } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import api from '@/lib/api';
import {
    type Lang, type LastReminder, type OpenMonth, type Phone, type Receipt, type ReminderKind,
    KINDS, inr, reminderText, thanksText, timeAgo, whatsappLink,
} from '../_lib';

// WhatsApp reminders from the Fees desk: one parent at a time (composer with a
// live WhatsApp-style preview) or a whole list one after another (Remind all).
// The message opens in WhatsApp ready to send; we keep a note that it was opened.

export interface ReminderTarget {
    studentId: string;
    child: string;
    classLabel: string;
    school: string;
    avatarUrl: string | null;
    months: OpenMonth[];
    upiId: string | null;
    lateFee: number;
    phones: Phone[];
    lastReminder: LastReminder | null;
}

type Kind = Exclude<ReminderKind, 'THANKS'>;
const WA_GREEN = '#25D366';
const defaultKind = (t: ReminderTarget): Kind => (t.months.some(m => m.due) ? 'OVERDUE' : 'GENTLE');
const dueOf = (t: ReminderTarget, kind: Kind) => {
    const list = kind === 'GENTLE' ? t.months : t.months.filter(m => m.due).length ? t.months.filter(m => m.due) : t.months;
    return list.reduce((n, m) => n + m.balance, 0);
};
const who = (p: Phone | null) => (p ? `${p.label}${p.name ? ` (${p.name})` : ''}` : null);
const KIND_LABEL: Record<string, string> = { GENTLE: 'Gentle', OVERDUE: 'Overdue', FINAL: 'Final', THANKS: 'Thank you' };

async function logSent(studentId: string, kind: ReminderKind, lang: Lang, sentTo: string | null, amount: number): Promise<LastReminder> {
    try {
        const r = await api.post('/admin/fees/reminders', { studentId, kind, lang, sentTo, amount });
        return r.data.data;
    } catch {
        // Only the note failed; the message still opened.
        return { kind, sentTo, createdAt: new Date().toISOString() };
    }
}

/** WhatsApp shows *text* in bold. */
function WaText({ text }: { text: string }) {
    return (
        <>
            {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
                part.startsWith('*') && part.endsWith('*') && part.length > 2
                    ? <strong key={i}>{part.slice(1, -1)}</strong>
                    : <Fragment key={i}>{part}</Fragment>)}
        </>
    );
}

const WALLPAPER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%23CBBFA8' stroke-width='1.2' opacity='.45'%3E%3Ccircle cx='14' cy='16' r='5'/%3E%3Cpath d='M52 10l6 6-6 6-6-6z'/%3E%3Cpath d='M10 58c4-6 10-6 14 0'/%3E%3Ccircle cx='60' cy='60' r='3'/%3E%3Cpath d='M38 40h8M42 36v8'/%3E%3C/g%3E%3C/svg%3E")`;

/** A phone-style WhatsApp chat with the message as a sent bubble. */
function WhatsAppPreview({ school, to, text, editing, onEdit }: { school: string; to: string; text: string; editing: boolean; onEdit: (t: string) => void }) {
    const now = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return (
        <div className="rounded-[22px] overflow-hidden border border-black/10 shadow-xl flex flex-col h-full min-h-0" style={{ background: '#EFEAE2' }}>
            <div className="shrink-0 flex items-center gap-2.5 px-3 py-2.5 text-white" style={{ background: '#008069' }}>
                <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold">{to.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight truncate">{to}</p>
                    <p className="text-[10px] text-white/75 leading-tight">from {school}</p>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4" style={{ backgroundImage: WALLPAPER, scrollbarWidth: 'thin' }}>
                <div className="flex justify-center mb-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 text-slate-500 shadow-sm">TODAY</span>
                </div>
                <motion.div key={text.length > 0 ? 'b' : 'e'} initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`relative ml-auto ${editing ? 'w-[88%]' : 'max-w-[88%]'} rounded-lg rounded-tr-none px-2.5 pt-1.5 pb-1 shadow-sm text-[12.5px] leading-[1.45] text-[#111B21]`}
                    style={{ background: '#D9FDD3' }}>
                    <span className="absolute -right-1.5 top-0 w-0 h-0 border-t-[8px] border-l-[8px] border-t-[#D9FDD3] border-l-transparent" />
                    {editing ? (
                        <textarea value={text} onChange={e => onEdit(e.target.value)} autoFocus
                            className="block w-full h-[420px] bg-transparent resize-none focus:outline-none whitespace-pre-wrap" style={{ scrollbarWidth: 'thin' }} />
                    ) : (
                        <p className="whitespace-pre-wrap break-words"><WaText text={text} /></p>
                    )}
                    <span className="flex items-center justify-end gap-1 text-[10px] text-slate-500 mt-0.5">
                        {now} <CheckCheck size={13} className="text-[#53BDEB]" />
                    </span>
                </motion.div>
            </div>
        </div>
    );
}

function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
    return (
        <div className="rounded-xl overflow-hidden bg-primary/15 flex items-center justify-center font-bold text-primary shrink-0" style={{ width: size, height: size, fontSize: size * 0.32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
    );
}

function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
    return (
        <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
            {([['en', 'English'], ['hi', 'हिंदी']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => onChange(k)}
                    className={`flex-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${lang === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
            ))}
        </div>
    );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
    return (
        <motion.div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 backdrop-blur-sm p-3 sm:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div onClick={e => e.stopPropagation()} initial={{ scale: 0.97, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97 }}
                className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-3xl'} h-[min(680px,92vh)] rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col`}>
                <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"><X size={16} /></button>
                {children}
            </motion.div>
        </motion.div>
    );
}

// ── One parent ────────────────────────────────────────────────────────────────
export function ReminderComposer({ target, thanks, onClose, onSent }: {
    target: ReminderTarget;
    /** Send a "fee received" message for this receipt instead of a reminder. */
    thanks?: { receipt: Receipt; balance: number };
    onClose: () => void;
    onSent?: (last: LastReminder) => void;
}) {
    const [kind, setKind] = useState<Kind>(defaultKind(target));
    const [lang, setLang] = useState<Lang>('en');
    // Several numbers can be picked (e.g. both parents). WhatsApp opens one chat
    // at a time, so the button goes through them one after another.
    const [picked, setPicked] = useState<number[]>(target.phones.length ? [0] : []);
    const [sentTo, setSentTo] = useState<number[]>([]);
    const [custom, setCustom] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [sentNoPhone, setSentNoPhone] = useState(false);
    // The reminder sent before this window opened (not the ones sent from it).
    const [earlier] = useState(target.lastReminder);
    const order = [...picked].sort((a, b) => a - b);
    const nextIdx = order.find(i => !sentTo.includes(i));
    const allSent = order.length > 0 && nextIdx === undefined;
    const previewPhone = target.phones[nextIdx ?? order[0] ?? -1] ?? null;
    const togglePhone = (i: number) => setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i]));

    const built = thanks
        ? thanksText(lang, { child: target.child, classLabel: target.classLabel, school: target.school, receipt: thanks.receipt, balance: thanks.balance })
        : reminderText(kind, lang, { child: target.child, classLabel: target.classLabel, school: target.school, months: target.months, upiId: target.upiId, lateFee: target.lateFee });
    const text = custom ?? built;
    const amount = thanks ? thanks.receipt.amount : dueOf(target, kind);

    const pick = (fn: () => void) => { fn(); setCustom(null); setEditing(false); };
    const send = async () => {
        let phone: Phone | null = null;
        if (target.phones.length) {
            // After everyone got it, a click starts the round again.
            const idx = nextIdx ?? order[0];
            if (idx === undefined) return;
            phone = target.phones[idx];
            setSentTo(s => (nextIdx === undefined ? [idx] : [...s, idx]));
        } else {
            setSentNoPhone(true);
        }
        window.open(whatsappLink(text, phone?.number), '_blank', 'noopener');
        const last = await logSent(target.studentId, thanks ? 'THANKS' : kind, lang, who(phone), amount);
        onSent?.(last);
    };
    const sendLabel = !target.phones.length
        ? (sentNoPhone ? 'Opened in WhatsApp, open again' : 'Open in WhatsApp')
        : !order.length ? 'Choose who to send to'
            : allSent ? `Sent to ${order.length === 1 ? target.phones[order[0]].label : 'all'}, open again`
                : order.length === 1 ? 'Open in WhatsApp'
                    : `Open for ${target.phones[nextIdx!].label} (${sentTo.filter(i => order.includes(i)).length + 1} of ${order.length})`;

    return (
        <Modal onClose={onClose}>
            <div className="grid md:grid-cols-[minmax(0,1fr)_340px] min-h-0 flex-1">
                {/* Controls */}
                <div className="p-5 space-y-4 overflow-y-auto min-h-0">
                    <div className="flex items-center gap-3 pr-8">
                        <Avatar name={target.child} url={target.avatarUrl} size={44} />
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5"><FaWhatsapp size={12} style={{ color: WA_GREEN }} /> {thanks ? 'Send receipt' : 'Fee reminder'}</p>
                            <p className="text-base font-bold truncate">{target.child}</p>
                            <p className="text-xs text-muted-foreground">Class {target.classLabel} · {thanks ? `${inr(thanks.receipt.amount)} received` : `${inr(dueOf(target, kind))} due`}</p>
                        </div>
                    </div>

                    {!thanks && earlier && (
                        <p className="text-[11px] px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            Last reminded {timeAgo(earlier.createdAt)} ({KIND_LABEL[earlier.kind] ?? earlier.kind}{earlier.sentTo ? `, to ${earlier.sentTo}` : ''})
                        </p>
                    )}

                    {!thanks && (
                        <div>
                            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Message</p>
                            <div className="grid grid-cols-3 gap-2">
                                {KINDS.map(k => {
                                    const on = kind === k.key;
                                    return (
                                        <button key={k.key} type="button" onClick={() => pick(() => setKind(k.key))}
                                            className={`text-left rounded-2xl border px-3 py-2.5 transition-all ${on ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:bg-muted/50'}`}>
                                            <span className="text-lg leading-none">{k.emoji}</span>
                                            <p className={`text-xs font-bold mt-1 ${on ? 'text-primary' : ''}`}>{k.label}</p>
                                            <p className="text-[10px] text-muted-foreground leading-tight">{k.hint}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Language</p>
                        <LangSwitch lang={lang} onChange={l => pick(() => setLang(l))} />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[11px] font-semibold text-muted-foreground">Send to</p>
                            {target.phones.length > 1 && (
                                <button type="button" onClick={() => setPicked(picked.length === target.phones.length ? [] : target.phones.map((_, i) => i))}
                                    className="text-[11px] font-semibold text-primary hover:underline">{picked.length === target.phones.length ? 'Clear' : 'Select all'}</button>
                            )}
                        </div>
                        {target.phones.length === 0 ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border">
                                <PhoneOff size={14} /> No phone number saved. WhatsApp will open and you can pick the contact.
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {target.phones.map((p, i) => {
                                    const on = picked.includes(i);
                                    const done = sentTo.includes(i);
                                    return (
                                        <button key={p.number + i} type="button" onClick={() => togglePhone(i)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${on ? 'border-[#25D366] bg-[#25D366]/10' : 'border-border hover:bg-muted/50'}`}>
                                            <span className="w-4 h-4 rounded-[5px] border-2 flex items-center justify-center shrink-0"
                                                style={on ? { background: WA_GREEN, borderColor: WA_GREEN } : undefined}>
                                                {on && <Check size={11} strokeWidth={3} className="text-white" />}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="text-xs font-semibold">{p.label}</span>
                                                {p.name && <span className="text-xs text-muted-foreground"> · {p.name}</span>}
                                            </span>
                                            {done && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><CheckCheck size={12} /> Sent</span>}
                                            <span className="text-xs font-mono text-muted-foreground">{p.number}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button type="button" onClick={send} disabled={target.phones.length > 0 && !order.length}
                            className="flex-1 h-11 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                            style={{ background: WA_GREEN }}>
                            {allSent || sentNoPhone ? <Check size={17} /> : <FaWhatsapp size={18} />}
                            {sendLabel}
                        </button>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground -mt-2">
                        {order.length > 1 ? 'WhatsApp opens one chat at a time. Press send there, come back and open the next one.' : 'WhatsApp opens with the message ready. Press send there.'}
                    </p>
                </div>

                {/* Preview */}
                <div className="hidden md:flex flex-col gap-2 p-4 pl-0 min-h-0">
                    <div className="flex items-center justify-between pr-9">
                        <p className="text-[11px] font-semibold text-muted-foreground">Preview</p>
                        <div className="flex items-center gap-1">
                            {custom != null && (
                                <button type="button" onClick={() => { setCustom(null); setEditing(false); }} className="inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] text-muted-foreground hover:bg-muted"><RotateCcw size={11} /> Reset</button>
                            )}
                            <button type="button" onClick={() => { setEditing(e => !e); if (custom == null) setCustom(built); }}
                                className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] font-semibold ${editing ? 'bg-primary text-white' : 'text-primary hover:bg-primary/10'}`}>
                                {editing ? <><Check size={11} /> Done</> : <><Pencil size={11} /> Edit</>}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <WhatsAppPreview school={target.school} to={previewPhone ? `${previewPhone.label}${previewPhone.name ? ` · ${previewPhone.name}` : ''}` : 'Parent'} text={text} editing={editing} onEdit={setCustom} />
                    </div>
                </div>
            </div>
        </Modal>
    );
}

// ── A whole list, one after another ───────────────────────────────────────────
export function RemindAll({ targets, onClose, onSent }: {
    targets: ReminderTarget[];
    onClose: () => void;
    onSent?: (studentId: string, last: LastReminder) => void;
}) {
    const [kind, setKind] = useState<Kind>('OVERDUE');
    const [lang, setLang] = useState<Lang>('en');
    const [toAll, setToAll] = useState(false);
    const [sentN, setSentN] = useState<Record<string, number>>({});
    const [skipped, setSkipped] = useState<Record<string, boolean>>({});
    const [previewId, setPreviewId] = useState<string | null>(null);
    // Numbers each parent gets: the first one, or every saved number (both parents).
    const numbersOf = (t: ReminderTarget): (Phone | null)[] => (t.phones.length ? (toAll ? t.phones : [t.phones[0]]) : [null]);
    const finished = (t: ReminderTarget) => skipped[t.studentId] || (sentN[t.studentId] ?? 0) >= numbersOf(t).length;
    const totalMsgs = targets.reduce((n, t) => n + (skipped[t.studentId] ? 0 : numbersOf(t).length), 0);
    const sentMsgs = targets.reduce((n, t) => n + Math.min(sentN[t.studentId] ?? 0, numbersOf(t).length), 0);
    const next = targets.find(t => !finished(t)) ?? null;
    const nextPhone = (t: ReminderTarget) => numbersOf(t)[sentN[t.studentId] ?? 0] ?? null;
    const shown = targets.find(t => t.studentId === previewId) ?? next ?? targets[0];
    const textFor = (t: ReminderTarget) => reminderText(kind, lang, { child: t.child, classLabel: t.classLabel, school: t.school, months: t.months, upiId: t.upiId, lateFee: t.lateFee });

    const send = async (t: ReminderTarget) => {
        const phone = nextPhone(t);
        window.open(whatsappLink(textFor(t), phone?.number), '_blank', 'noopener');
        setSentN(s => ({ ...s, [t.studentId]: (s[t.studentId] ?? 0) + 1 }));
        setPreviewId(null);
        const last = await logSent(t.studentId, kind, lang, who(phone), dueOf(t, kind));
        onSent?.(t.studentId, last);
    };

    return (
        <Modal onClose={onClose} wide>
            <div className="grid md:grid-cols-[minmax(0,1fr)_330px] min-h-0 flex-1">
                <div className="flex flex-col min-h-0">
                    <div className="p-5 pb-3 space-y-3 border-b border-border/50 pr-12">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5"><FaWhatsapp size={12} style={{ color: WA_GREEN }} /> Remind all</p>
                            <p className="text-base font-bold">{targets.length} students, one after another</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                {KINDS.map(k => (
                                    <button key={k.key} type="button" onClick={() => setKind(k.key)}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${kind === k.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{k.emoji} {k.label}</button>
                                ))}
                            </div>
                            <div className="w-40"><LangSwitch lang={lang} onChange={setLang} /></div>
                            <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                {([[false, 'First number'], [true, 'Both parents']] as const).map(([v, l]) => (
                                    <button key={l} type="button" onClick={() => setToAll(v)} disabled={sentMsgs > 0}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:cursor-not-allowed ${toAll === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                                ))}
                            </div>
                        </div>
                        {/* Progress */}
                        <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-semibold">{sentMsgs} of {totalMsgs} messages sent</span>
                                {next && <span className="text-muted-foreground">Next: {next.child}</span>}
                                {!next && <span className="text-emerald-600 font-semibold">All done 🎉</span>}
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <motion.div className="h-full rounded-full" style={{ background: WA_GREEN }} animate={{ width: `${(sentMsgs / Math.max(1, totalMsgs)) * 100}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5" style={{ scrollbarWidth: 'thin' }}>
                        {targets.map(t => {
                            const nums = numbersOf(t);
                            const n = Math.min(sentN[t.studentId] ?? 0, nums.length);
                            const st = skipped[t.studentId] ? 'skipped' : n >= nums.length ? 'sent' : null;
                            const isNext = next?.studentId === t.studentId;
                            const np = nextPhone(t);
                            return (
                                <div key={t.studentId} onClick={() => setPreviewId(t.studentId)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-2xl border cursor-pointer transition-all ${isNext ? 'border-[#25D366] bg-[#25D366]/[0.07]' : shown?.studentId === t.studentId ? 'border-primary/40' : 'border-transparent hover:bg-muted/40'} ${st ? 'opacity-60' : ''}`}>
                                    <Avatar name={t.child} url={t.avatarUrl} size={34} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{t.child}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {t.classLabel} · {!t.phones.length ? 'No number saved' : st ? nums.map(p => p?.label).join(' + ') : `${np?.label} ${np?.number}`}
                                            {!st && nums.length > 1 && ` · ${n + 1} of ${nums.length}`}
                                            {t.lastReminder && ` · reminded ${timeAgo(t.lastReminder.createdAt)}`}
                                        </p>
                                    </div>
                                    <p className="text-sm font-bold tabular-nums shrink-0">{inr(dueOf(t, kind))}</p>
                                    {st === 'sent' ? (
                                        <span className="w-[84px] text-center text-[11px] font-semibold text-emerald-600 inline-flex items-center justify-center gap-1"><CheckCheck size={14} /> Sent</span>
                                    ) : st === 'skipped' ? (
                                        <span className="w-[84px] text-center text-[11px] text-muted-foreground">Skipped</span>
                                    ) : (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button type="button" title="Skip" onClick={e => { e.stopPropagation(); setSkipped(s => ({ ...s, [t.studentId]: true })); }}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><SkipForward size={13} /></button>
                                            <button type="button" onClick={e => { e.stopPropagation(); void send(t); }}
                                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold text-white inline-flex items-center gap-1 ${isNext ? '' : 'opacity-80'}`} style={{ background: WA_GREEN }}>
                                                <Send size={11} /> {nums.length > 1 ? np?.label ?? 'Send' : 'Send'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-3 border-t border-border/50">
                        {next ? (
                            <button type="button" onClick={() => void send(next)}
                                className="w-full h-11 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all" style={{ background: WA_GREEN }}>
                                <FaWhatsapp size={18} /> Send next: {next.child}{numbersOf(next).length > 1 && nextPhone(next) ? ` (${nextPhone(next)!.label})` : ''}
                            </button>
                        ) : (
                            <button type="button" onClick={onClose} className="w-full h-11 rounded-xl text-sm font-bold bg-muted hover:bg-muted/70">Close</button>
                        )}
                    </div>
                </div>

                <div className="hidden md:flex flex-col gap-2 p-4 pl-0 min-h-0">
                    <p className="text-[11px] font-semibold text-muted-foreground pr-9">Preview · {shown?.child}</p>
                    <div className="flex-1 min-h-0">
                        {shown && <WhatsAppPreview school={shown.school} to={(() => { const p = nextPhone(shown) ?? shown.phones[0]; return p ? `${p.label}${p.name ? ` · ${p.name}` : ''}` : 'Parent'; })()} text={textFor(shown)} editing={false} onEdit={() => {}} />}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
