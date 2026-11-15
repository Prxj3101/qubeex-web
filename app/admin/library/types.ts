export type BorrowerType = 'STUDENT' | 'TEACHER' | 'STAFF';
export const BORROWER_LABEL: Record<BorrowerType, string> = { STUDENT: 'Students', TEACHER: 'Teachers', STAFF: 'Admins & sub-admins' };

export interface RuleSet {
    maxBooks: number;
    loanDays: number;
    maxRenewals: number;
    finePerDayPaise: number;
    graceDays: number;
    fineCapPaise: number | null;
}

export type FinesMode = 'OFF' | 'LIBRARIAN' | 'FEES';

export interface LibrarySettings {
    finesMode: FinesMode;
    dueSoonDays: number;
    lostChargePaise: number;
    damagedChargePaise: number;
    rulesConfigured: boolean;
    rules: Record<BorrowerType, RuleSet | null>;
}

export interface Member {
    userId: string;
    name: string;
    code: string;
    borrowerType: BorrowerType;
    isActive: boolean;
    activeLoans: number;
}

export interface OpenLoan {
    id: string;
    dueAt: string;
    renewals: number;
    copy: { accessionCode: string; book: { title: string } };
}

export interface Fine {
    id: string;
    kind: 'LATE' | 'LOST' | 'DAMAGED';
    amountPaise: number;
    status?: 'PENDING' | 'PAID' | 'WAIVED';
    collectedVia?: 'LIBRARIAN' | 'FEES';
    borrowerUserId?: string;
    loan?: { copy: { accessionCode: string; book: { title: string } } };
}

export interface BookRow {
    id: string;
    title: string;
    author: string | null;
    isbn: string | null;
    category: string | null;
    language: string | null;
    shelf: string | null;
    pricePaise: number | null;
    total: number;
    available: number;
}

export interface CopyRow { id: string; accessionCode: string; status: 'AVAILABLE' | 'ISSUED' | 'LOST' | 'DAMAGED' | 'WITHDRAWN' }

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const toPaise = (rupeeText: string) => Math.round(parseFloat(rupeeText || '0') * 100);
export const fromPaise = (paise: number | null | undefined) => (paise == null ? '' : String(paise / 100));
export const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
