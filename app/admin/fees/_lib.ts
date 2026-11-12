import { Banknote, Smartphone, FileCheck2, CreditCard, Landmark, type LucideIcon } from 'lucide-react';
import type { StudentIdCardData } from '@/components/shared/StudentIdCard';

// Shared types and helpers for the Fees desk (Admin > Fees).

export type Mode = 'CASH' | 'UPI' | 'CHEQUE' | 'CARD' | 'BANK';

export const MODES: { key: Mode; label: string; icon: LucideIcon; color: string; refLabel?: string }[] = [
    { key: 'CASH', label: 'Cash', icon: Banknote, color: '#059669' },
    { key: 'UPI', label: 'UPI', icon: Smartphone, color: '#7C3AED', refLabel: 'UPI ref / UTR no.' },
    { key: 'CHEQUE', label: 'Cheque', icon: FileCheck2, color: '#D97706', refLabel: 'Cheque no. and bank' },
    { key: 'CARD', label: 'Card', icon: CreditCard, color: '#2563EB', refLabel: 'Card last 4 / txn no.' },
    { key: 'BANK', label: 'Bank', icon: Landmark, color: '#0891B2', refLabel: 'NEFT / IMPS ref no.' },
];
export const modeOf = (m: Mode) => MODES.find(x => x.key === m) ?? MODES[0];

export interface Totals { total: number; paid: number; balance: number; overdue: number }

export type SearchStudent = StudentIdCardData & Totals;

export interface MonthPart { id: string; name: string; type: string; color: string; amount: number; auto?: 'late' | 'bus'; extra?: boolean }
export interface Bill {
    feeMonthId: string; month: string; dueDate: string; parts: MonthPart[]; total: number;
    status: 'PAID' | 'PENDING'; paidDate: string | null; due: boolean; received: number; balance: number;
}

export interface ReceiptLine { feeMonthId: string; month: string; heads: string[]; amount: number; discount: number; markedPaid: boolean }
export interface Receipt {
    id: string; receiptNo: string; number: number; studentId: string; day: string; amount: number; discount: number;
    mode: Mode; reference: string | null; note: string | null; lines: ReceiptLine[]; collectedBy: string | null;
    cancelled: boolean; cancelledAt: string | null; cancelReason: string | null; createdAt: string;
}

export interface StudentField { id: string; kind: 'default' | 'custom'; defaultKey?: 'name' | 'rollNo' | 'studentId' | 'class' | 'division' | 'bus'; label: string }
export interface FeeCardData {
    feeCardTheme: string | null; schoolLogoUrl: string | null; schoolName: string | null;
    studentFields: StudentField[]; extraColumns: { label: string }[];
}
export interface PaymentRow { feeMonthId: string; status: string; paidDate: string | null; remark: string | null; extraFields: Record<string, string> | null }

export interface Account {
    student: StudentIdCardData & { extraDetailFields: Record<string, string> | null };
    card: FeeCardData | null;
    payments: PaymentRow[];
    bills: Bill[];
    totals: Totals;
    receipts: Receipt[];
    canCollect: boolean;
    phones: Phone[];
    payment: { upiId: string | null; accountName: string | null; accountNumber: string | null; ifsc: string | null; bankName: string | null } | null;
    lateFee: number;
    lastReminder: LastReminder | null;
}

export const FEE_CARD_THEMES: Record<string, { bg: string; border: string }> = {
    yellow: { bg: '#FFF9E0', border: '#EEDD9B' },
    green: { bg: '#F1F6E1', border: '#CBDCA0' },
    blue: { bg: '#EEF6FB', border: '#CBE2EF' },
    pink: { bg: '#FCF1F4', border: '#EDCED8' },
};
export const themeOf = (key: string | null | undefined) => FEE_CARD_THEMES[key ?? ''] ?? FEE_CARD_THEMES.yellow;

export const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Today in India as "YYYY-MM-DD". */
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** "2026-11-11" -> "11 Nov 2026". */
export const prettyDay = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const shiftDay = (day: string, by: number) => {
    const [y, m, d] = day.split('-').map(Number);
    const x = new Date(y, m - 1, d + by);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Month status for chips: Paid / Partial / Overdue / Due. */
export function billState(b: Bill): { label: string; cls: string } {
    if (b.balance <= 0) return { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' };
    if (b.received > 0) return { label: 'Partial', cls: 'bg-amber-100 text-amber-700' };
    if (b.due) return { label: 'Overdue', cls: 'bg-red-100 text-red-700' };
    return { label: 'Upcoming', cls: 'bg-slate-100 text-slate-600' };
}

/**
 * Spreads the cash and discount over the chosen months, oldest first. The
 * discount is used first, so a part payment leaves the newest month open.
 */
export function allocate(bills: Bill[], amount: number, discount: number) {
    let cash = Math.round(amount * 100);
    let disc = Math.round(discount * 100);
    const lines: { feeMonthId: string; amount: number; discount: number }[] = [];
    for (const b of bills) {
        let need = Math.round(b.balance * 100);
        const d = Math.min(need, disc); disc -= d; need -= d;
        const c = Math.min(need, cash); cash -= c;
        if (c + d > 0) lines.push({ feeMonthId: b.feeMonthId, amount: c / 100, discount: d / 100 });
    }
    return { lines, extra: (cash + disc) / 100 };
}

// ── WhatsApp reminders ───────────────────────────────────────────────────────

export type ReminderKind = 'GENTLE' | 'OVERDUE' | 'FINAL' | 'THANKS';
export type Lang = 'en' | 'hi';
export interface Phone { label: string; name: string | null; number: string }
export interface LastReminder { kind: string; sentTo: string | null; createdAt: string }
export interface OpenMonth { month: string; dueDate: string; balance: number; due: boolean }

export const KINDS: { key: Exclude<ReminderKind, 'THANKS'>; emoji: string; label: string; hint: string }[] = [
    { key: 'GENTLE', emoji: '🙂', label: 'Gentle', hint: 'Due date is coming up' },
    { key: 'OVERDUE', emoji: '⏰', label: 'Overdue', hint: 'Past the due date, polite' },
    { key: 'FINAL', emoji: '⚠️', label: 'Final', hint: 'Late fee is adding up' },
];

const HI_MONTHS: Record<string, string> = {
    January: 'जनवरी', February: 'फ़रवरी', March: 'मार्च', April: 'अप्रैल', May: 'मई', June: 'जून',
    July: 'जुलाई', August: 'अगस्त', September: 'सितंबर', October: 'अक्टूबर', November: 'नवंबर', December: 'दिसंबर',
};
const monthIn = (m: string, lang: Lang) => (lang === 'hi' ? HI_MONTHS[m] ?? m : m);
const rs = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** The reminder text a parent gets on WhatsApp (*text* shows in bold there). */
export function reminderText(kind: Exclude<ReminderKind, 'THANKS'>, lang: Lang, d: {
    child: string; classLabel: string; school: string; months: OpenMonth[]; upiId: string | null; lateFee: number;
}) {
    const months = kind === 'GENTLE' ? d.months : d.months.filter(m => m.due).length ? d.months.filter(m => m.due) : d.months;
    const total = months.reduce((n, m) => n + m.balance, 0);
    const lines = months.map(m => `📅 ${monthIn(m.month, lang)}: ${rs(m.balance)}`).join('\n');
    const nextDue = months.find(m => !m.due)?.dueDate ?? months[0]?.dueDate ?? '';
    const late = kind !== 'GENTLE' && d.lateFee > 0;
    if (lang === 'hi') {
        const head = kind === 'GENTLE' ? '🙂 *फीस रिमाइंडर*' : kind === 'OVERDUE' ? '⏰ *फीस बाकी है*' : '⚠️ *अंतिम फीस रिमाइंडर*';
        const intro = kind === 'GENTLE'
            ? `यह एक विनम्र याद दिलाना है कि *${d.child}* (कक्षा ${d.classLabel}) की फीस${nextDue ? ` की अंतिम तिथि *${nextDue}* है` : ' जमा करनी है'}।`
            : kind === 'OVERDUE'
                ? `*${d.child}* (कक्षा ${d.classLabel}) की यह फीस अभी बाकी है:`
                : `*${d.child}* (कक्षा ${d.classLabel}) की फीस की तिथि निकल चुकी है। कृपया जल्द से जल्द भुगतान करें।`;
        return [
            head, '', 'आदरणीय अभिभावक,', intro, '', lines, '━━━━━━━━━━', `💰 *कुल बकाया: ${rs(total)}*`,
            ...(late ? ['', `⚠️ देर से भुगतान पर हर महीने ${rs(d.lateFee)} लेट फीस लगती है।`] : []),
            '', ...(d.upiId ? [`💳 UPI से भुगतान करें: *${d.upiId}*`] : []), '🏫 या स्कूल के फीस काउंटर पर जमा करें।',
            '', 'यदि आपने भुगतान कर दिया है तो कृपया इस संदेश को नज़रअंदाज़ करें। 🙏', '', 'सादर,', `*${d.school}*`,
        ].join('\n');
    }
    const head = kind === 'GENTLE' ? '🙂 *Fee reminder*' : kind === 'OVERDUE' ? '⏰ *Fee pending*' : '⚠️ *Final fee reminder*';
    const intro = kind === 'GENTLE'
        ? `This is a friendly reminder that the fee for *${d.child}* (Class ${d.classLabel}) is due${nextDue ? ` on *${nextDue}*` : ''}.`
        : kind === 'OVERDUE'
            ? `This is a gentle reminder that the fees for *${d.child}* (Class ${d.classLabel}) are pending:`
            : `The fees for *${d.child}* (Class ${d.classLabel}) are overdue. Please pay at the earliest.`;
    return [
        head, '', 'Dear Parent,', intro, '', lines, '━━━━━━━━━━', `💰 *Total due: ${rs(total)}*`,
        ...(late ? ['', `⚠️ A late fee of ${rs(d.lateFee)} is added for every month paid late.`] : []),
        '', ...(d.upiId ? [`💳 Pay by UPI: *${d.upiId}*`] : []), '🏫 Or at the school fee counter',
        '', 'Please ignore this message if already paid. 🙏', '', 'Warm regards,', `*${d.school}*`,
    ].join('\n');
}

/** "Thank you, fee received" message after a receipt. */
export function thanksText(lang: Lang, d: { child: string; classLabel: string; school: string; receipt: Receipt; balance: number }) {
    const r = d.receipt;
    const months = r.lines.map(l => monthIn(l.month, lang)).join(', ');
    const mode = modeOf(r.mode).label;
    if (lang === 'hi') {
        return [
            '✅ *फीस प्राप्त हुई*', '', 'आदरणीय अभिभावक,', `*${d.child}* (कक्षा ${d.classLabel}) की *${rs(r.amount)}* फीस प्राप्त हो गई है। धन्यवाद! 🙏`, '',
            `🧾 रसीद नंबर: *${r.receiptNo}*`, `📅 तारीख: ${prettyDay(r.day)}`, `📌 महीने: ${months}`, `💳 भुगतान: ${mode}`, '',
            d.balance > 0 ? `अभी बाकी: *${rs(d.balance)}*` : 'अब तक की सारी फीस जमा है। ✨', '', 'सादर,', `*${d.school}*`,
        ].join('\n');
    }
    return [
        '✅ *Fee received*', '', 'Dear Parent,', `We have received *${rs(r.amount)}* for *${d.child}* (Class ${d.classLabel}). Thank you! 🙏`, '',
        `🧾 Receipt no: *${r.receiptNo}*`, `📅 Date: ${prettyDay(r.day)}`, `📌 For: ${months}`, `💳 Paid by: ${mode}`, '',
        d.balance > 0 ? `Still due this year: *${rs(d.balance)}*` : 'All fees are paid up to date. ✨', '', 'Warm regards,', `*${d.school}*`,
    ].join('\n');
}

export function whatsappLink(text: string, phone?: string | null) {
    let digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    const body = encodeURIComponent(text);
    // api.whatsapp.com keeps emojis; the wa.me redirect turns many of them into "?".
    return digits.length >= 11 ? `https://api.whatsapp.com/send?phone=${digits}&text=${body}` : `https://api.whatsapp.com/send?text=${body}`;
}

export function timeAgo(iso: string) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.round(h / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}
