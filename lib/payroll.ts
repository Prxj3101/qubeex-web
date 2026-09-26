// Shared payroll types + helpers for the admin payroll screens.
//
// The API stores and returns all money as integer PAISE (₹1 = 100) and
// percentages as basis points (40% = 4000). Convert only at the UI edge.

export type ComponentType = 'EARNING' | 'DEDUCTION';
export type CalcType = 'FIXED' | 'PERCENT_OF_BASIC';
export type DayBasis = 'CALENDAR' | 'FIXED_30' | 'FIXED_26';
export type PaymentMode = 'BANK' | 'CASH' | 'CHEQUE';
export type StaffType = 'TEACHER' | 'ADMIN' | 'SUB_ADMIN' | 'HELPER' | 'OTHER';

export interface SalaryComponent {
    id: string;
    name: string;
    type: ComponentType;
    calcType: CalcType;
    isBasic: boolean;
    lopApplicable: boolean;
    defaultValue: number;
    sortOrder: number;
}

export interface StructureItem { componentId: string; value: number }
export interface MoneyLine { label: string; amount: number }

export interface SalaryTemplate { id: string; name: string; items: StructureItem[] }

export interface SalaryVersion {
    id: string;
    staffId: string;
    templateId: string | null;
    items: StructureItem[];
    effectiveFrom: string;
    note: string | null;
    createdAt: string;
}

export interface BankDetails { accountName: string; accountNumber: string; ifsc: string; bankName: string }

export interface StaffMember {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    designation: string | null;
    staffType: StaffType;
    status: 'ACTIVE' | 'INACTIVE';
    userId: string | null;
    joinedAt: string | null; // school joining date, only set for new joiners
    exitDate: string | null;
    employeeCode: string | null;
    pan: string | null;
    uan: string | null;
    paymentMode: PaymentMode;
    bankDetails: BankDetails | null;
    avatarUrl: string | null; // from the linked QubeEx profile (signed URL)
    profileDesignation: string | null; // teacher title / sub-admin designation from the profile
    salaryStructure: SalaryVersion | null;
    monthlySalary: { grossPay: number; netPay: number; earnings: MoneyLine[]; deductions: MoneyLine[] } | null;
    salaryVersions: number;
}

export const STAFF_TYPE_LABEL: Record<StaffType, string> = {
    TEACHER: 'Teacher', ADMIN: 'Admin', SUB_ADMIN: 'Sub-Admin', HELPER: 'Helper', OTHER: 'Other',
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
    BANK: 'Bank transfer', CASH: 'Cash', CHEQUE: 'Cheque',
};

export const DAY_BASIS_LABEL: Record<DayBasis, string> = {
    CALENDAR: 'Actual days in month', FIXED_30: 'Fixed 30 days', FIXED_26: 'Fixed 26 days',
};

// ── Money ────────────────────────────────────────────────────────────────────

/** ₹ amount from paise, e.g. 2763334 → "₹27,633.34" (drops ".00"). */
export function formatINR(paise: number): string {
    const rupees = paise / 100;
    const hasPaise = Math.round(paise) % 100 !== 0;
    return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Rupees typed in an input → integer paise. Blank/invalid → 0. */
export function rupeesToPaise(input: string | number): number {
    const n = typeof input === 'number' ? input : parseFloat(input);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Integer paise → rupee string for an input box ("" for 0). */
export function paiseToInput(paise: number): string {
    if (!paise) return '';
    const r = paise / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/** Basis points → percent string for an input box (4000 → "40"). */
export function bpToInput(bp: number): string {
    if (!bp) return '';
    const p = bp / 100;
    return Number.isInteger(p) ? String(p) : p.toFixed(2);
}

/** Percent typed in an input → basis points ("40" → 4000). */
export function percentToBp(input: string | number): number {
    const n = typeof input === 'number' ? input : parseFloat(input);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Stored value → the text shown next to a component ("₹20,000" / "40% of Basic"). */
export function describeValue(comp: Pick<SalaryComponent, 'calcType'>, value: number): string {
    return comp.calcType === 'PERCENT_OF_BASIC' ? `${bpToInput(value) || '0'}% of Basic` : formatINR(value);
}

// ── Full-month preview (mirrors the backend engine, without LOP/proration) ────

export interface MonthlyPreview { earnings: MoneyLine[]; deductions: MoneyLine[]; grossPay: number; netPay: number }

export function previewMonthly(items: StructureItem[], components: SalaryComponent[]): MonthlyPreview {
    const byId = new Map(components.map(c => [c.id, c]));
    const rows = items
        .map(it => ({ it, c: byId.get(it.componentId) }))
        .filter((r): r is { it: StructureItem; c: SalaryComponent } => !!r.c)
        .sort((a, b) => a.c.sortOrder - b.c.sortOrder);
    const basicRow = rows.find(r => r.c.isBasic && r.c.type === 'EARNING');
    const basic = basicRow ? basicRow.it.value : 0;
    const amountOf = (r: { it: StructureItem; c: SalaryComponent }) =>
        r.c.calcType === 'PERCENT_OF_BASIC' ? Math.round((basic * r.it.value) / 10000) : r.it.value;

    const earnings = rows.filter(r => r.c.type === 'EARNING').map(r => ({ label: r.c.name, amount: amountOf(r) }));
    const deductions = rows.filter(r => r.c.type === 'DEDUCTION').map(r => ({ label: r.c.name, amount: amountOf(r) }));
    const grossPay = earnings.reduce((s, l) => s + l.amount, 0);
    const netPay = grossPay - deductions.reduce((s, l) => s + l.amount, 0);
    return { earnings, deductions, grossPay, netPay };
}

// ── Dates ────────────────────────────────────────────────────────────────────

export function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** ISO date/datetime → "12 Apr 2026" (uses the stored calendar day, not local tz). */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** ISO → "YYYY-MM-DD" for <input type="date">. */
export function toDateInput(iso: string | null | undefined): string {
    return iso ? iso.slice(0, 10) : '';
}

export function todayInput(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "Rupees Twenty Nine Thousand Four Hundred Only" - Indian numbering (lakh / crore),
// as printed on payslips. Input in paise.
export function amountInWords(paise: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
        'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
    const three = (n: number) => {
        const h = Math.floor(n / 100), r = n % 100;
        return [h ? `${ones[h]} Hundred` : '', r ? two(r) : ''].filter(Boolean).join(' ');
    };
    const words = (n: number): string => {
        if (n === 0) return 'Zero';
        const parts: string[] = [];
        const crore = Math.floor(n / 10000000); n %= 10000000;
        const lakh = Math.floor(n / 100000); n %= 100000;
        const thousand = Math.floor(n / 1000); n %= 1000;
        if (crore) parts.push(`${words(crore)} Crore`);
        if (lakh) parts.push(`${two(lakh)} Lakh`);
        if (thousand) parts.push(`${two(thousand)} Thousand`);
        if (n) parts.push(three(n));
        return parts.join(' ');
    };
    const abs = Math.abs(Math.round(paise));
    const rupees = Math.floor(abs / 100), p = abs % 100;
    return `Rupees ${words(rupees)}${p ? ` and ${two(p)} Paise` : ''} Only`;
}
