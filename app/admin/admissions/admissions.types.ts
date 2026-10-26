// Shapes returned by /admin/admissions and small helpers shared by the screens.
import { getErrorMessage } from '@/lib/error';

/** API error text, preferring the first field message over a bare "Validation failed". */
export function apiError(err: unknown, fallback: string) {
    const first = (err as { response?: { data?: { errors?: { message?: string }[] } } })?.response?.data?.errors?.[0]?.message;
    return first || getErrorMessage(err, fallback);
}

export type Stage = 'ENQUIRY' | 'REGISTERED' | 'INTERACTION' | 'SELECTED' | 'ADMITTED';
export type Outcome = 'WAITLIST' | 'NOT_SELECTED' | 'WITHDRAWN' | 'LAPSED';

export const STAGES: { key: Stage; label: string; hint: string; dot: string }[] = [
    { key: 'ENQUIRY', label: 'Enquiry', hint: 'Called or visited, form not filled yet', dot: 'bg-slate-400' },
    { key: 'REGISTERED', label: 'Registered', hint: 'Form filled', dot: 'bg-blue-500' },
    { key: 'INTERACTION', label: 'Interaction / Test', hint: 'Slot given', dot: 'bg-amber-500' },
    { key: 'SELECTED', label: 'Selected', hint: 'Offer sent or on waitlist', dot: 'bg-violet-500' },
    { key: 'ADMITTED', label: 'Admitted', hint: 'Admission number given', dot: 'bg-emerald-500' },
];

export interface Section { id: string; name: string }
export interface StandardWithSections { id: string; name: string; divisions: Section[] }
export interface Session { id: string; label: string; isCurrent: boolean }

export interface DocumentDef { id: string; name: string; required: boolean }
export interface Question { id: string; label: string; required: boolean }
export type FieldKey = 'bloodGroup' | 'previousSchool' | 'address' | 'sibling' | 'transport' | 'religion' | 'category' | 'motherTongue';
export const FIELD_LABELS: Record<FieldKey, string> = {
    bloodGroup: 'Blood group', previousSchool: 'Previous school', address: 'Address', sibling: 'Sibling in this school',
    transport: 'Needs school transport', religion: 'Religion', category: 'Category (General / OBC / SC / ST)', motherTongue: 'Mother tongue',
};

// ── Admission form (school's full form after selection) ─────────────────────
export const FORM_FIELD_TYPES = ['text', 'textarea', 'date', 'number', 'select', 'checkbox'] as const;
export type FormFieldType = typeof FORM_FIELD_TYPES[number];
export const FORM_SOURCES = {
    childName: "Child's name", dob: 'Date of birth', gender: 'Gender', className: 'Class', fatherName: "Father's name", motherName: "Mother's name",
    guardianName: 'Guardian', phone: 'Phone', altPhone: 'Second phone', email: 'Email', address: 'Address', city: 'City', pincode: 'PIN code',
    bloodGroup: 'Blood group', previousSchool: 'Previous school', sibling: 'Sibling', transport: 'Transport', religion: 'Religion', category: 'Category', motherTongue: 'Mother tongue',
} as const;
export type FormSource = keyof typeof FORM_SOURCES;
export interface FormField { id: string; label: string; type: FormFieldType; options: string[]; required: boolean; source?: FormSource | null }
export interface FormSection { id: string; title: string; fields: FormField[] }
export interface FormTemplatePage { url: string; type: 'pdf' | 'image'; pdfPage: number; width: number; height: number }
export interface FormBox {
    id: string; page: number; x: number; y: number; w: number; h: number; fieldId: string;
    kind: 'text' | 'comb' | 'tick'; cells?: number; option?: string; upper: boolean; size: number;
    part?: 'first' | 'middle' | 'last';
    /** The next line of the answer in the box before it (same question). */
    next?: boolean;
}
export interface FormTemplate { kind: 'QUBEEX' | 'UPLOAD'; pages: FormTemplatePage[]; boxes: FormBox[] }
/** Things a box can print that are not questions on the form. */
export const SPECIAL_BOXES: Record<string, string> = { _applicationNo: 'Application number', _admissionNo: 'Admission number', _session: 'Session', _today: "Today's date" };
export interface AdmissionFormConfig {
    enabled: boolean; mode: 'ONLINE' | 'OFFLINE'; requiredForAdmit: boolean; title: string;
    sections: FormSection[]; declaration: string; signatures: string[]; photoBox: boolean;
    template: FormTemplate;
}
export type FormValues = Record<string, string | boolean>;

export interface AdmissionSettings {
    academicYearId: string | null;
    formOpen: boolean;
    interactionStep: boolean;
    registrationFee: number | null;
    admissionFeeDays: number;
    ageCutoff: string;
    ageRules: { standardId: string; minMonths: number; maxMonths?: number | null }[];
    fields: Record<FieldKey, boolean>;
    questions: Question[];
    documents: DocumentDef[];
    admissionNoPrefix: string;
    nextAdmissionNo: number;
    revision: number;
    admissionForm: AdmissionFormConfig;
}

export interface SettingsResponse {
    settings: AdmissionSettings;
    sessions: Session[];
    standards: StandardWithSections[];
    session: Session;
    school: { name: string; formCode: string; logoUrl?: string | null };
}

export interface BoardRow {
    id: string; applicationNo: string; revision: number; childName: string; parentName: string; phoneLast4: string;
    gender: 'Male' | 'Female' | 'Other' | null; photoUrl: string | null;
    standardId: string; standardName: string; stage: Stage; outcome: Outcome | null; waitlistRank: number | null;
    source: 'ONLINE' | 'COUNTER' | 'PHONE'; createdAt: string; updatedAt: string; ageWarning: string | null;
    registrationFeePaid: boolean; registrationFeeDue?: boolean; admissionFormPending?: boolean; admissionFeePaid: boolean; offerDueOn: string | null; offerOverdue: boolean;
    interactionAt: string | null; interactionDone: boolean; docsPending: number; admissionNo: string | null;
    sectionName: string | null; placed: boolean;
}

export interface Details {
    phone: string; email: string; fatherName: string; motherName: string; guardianName: string; altPhone: string;
    address: string; city: string; pincode: string; bloodGroup: string; previousSchool: string; sibling: string;
    transport: string; religion: string; category: string; motherTongue: string; answers: Record<string, string>; notes: string;
}

export const emptyDetails = (): Details => ({
    phone: '', email: '', fatherName: '', motherName: '', guardianName: '', altPhone: '', address: '', city: '', pincode: '',
    bloodGroup: '', previousSchool: '', sibling: '', transport: '', religion: '', category: '', motherTongue: '', answers: {}, notes: '',
});

export interface FeeRecord { status: 'PAID' | 'WAIVED'; mode: 'COUNTER' | 'ONLINE' | 'WAIVED'; ref: string; amount: number | null; at: string; by: string }
export interface DocumentTick extends DocumentDef { seen: boolean; seenAt?: string; seenBy?: string; note?: string }
export interface AdmissionEvent { action: string; at: string; by: string; note?: string }

export interface ApplicationDetail {
    id: string; applicationNo: string; revision: number; stage: Stage; outcome: Outcome | null; waitlistRank: number | null;
    source: 'ONLINE' | 'COUNTER' | 'PHONE'; childName: string; dob: string | null; gender: string | null;
    standardId: string; standardName: string; sections: Section[]; details: Details;
    registrationFee: FeeRecord | null; interaction: { at?: string; note?: string; doneAt?: string; remark?: string; result?: string; by?: string; doneBy?: string } | null;
    offer: { sentAt: string; dueOn: string; by: string } | null; admissionFee: FeeRecord | null;
    documents: DocumentTick[]; docsPending: string[]; admissionNo: string | null; divisionId: string | null;
    placed: boolean; student: { studentId: string; tempPassword: string | null } | null;
    events: AdmissionEvent[]; createdAt: string; session: Session | null; ageWarning: string | null;
    interactionStep: boolean; registrationFeeAmount: number | null; questions: Question[]; fields: Record<FieldKey, boolean>;
    statusLink: string | null;
    schoolName?: string;
    admissionForm?: { config: AdmissionFormConfig; status: 'PENDING' | 'FILLED' | 'RECEIVED'; at: string | null; by: string | null; values: FormValues } | null;
    /** The number the register gives next, e.g. DEHS/2027/0001. */
    nextAdmissionNo?: string;
}

export const EVENT_LABELS: Record<string, string> = {
    ENQUIRY_ADDED: 'Enquiry noted', REGISTERED: 'Registered', REGISTER: 'Registered', REG_FEE: 'Registration fee received',
    SCHEDULE: 'Interaction slot given', INTERACTION_DONE: 'Interaction done', SELECT: 'Selected, offer sent', WAITLIST: 'Put on waitlist',
    NOT_SELECTED: 'Not selected', WITHDRAW: 'Withdrawn', LAPSE: 'Offer lapsed', REOPEN: 'Reopened', ADM_FEE: 'Admission fee received',
    DOCUMENTS_UPDATED: 'Documents checked', ADMIT: 'Admitted', SET_SECTION: 'Section changed', PLACED: 'Added to class', DETAILS_EDITED: 'Details edited', EMAIL_RESENT: 'Email sent again', ADMISSION_FORM: 'Admission form',
};

/** Before the school has had its say (no interaction yet), "Not selected" is really "Close application". */
export const beforeDecision = (a: { stage: Stage; interactionStep: boolean; interaction: { doneAt?: string } | null }) =>
    a.stage === 'ENQUIRY' || (a.interactionStep && (a.stage === 'REGISTERED' || (a.stage === 'INTERACTION' && !a.interaction?.doneAt)));

// 3D boy / girl character (Microsoft Fluent Emoji, MIT licence) until the school adds the real photo.
export const kidImage = (gender: string | null | undefined) => (gender === 'Female' ? '/admissions/girl.png' : '/admissions/boy.png');

export const formatDate = (ymd: string | null | undefined) => {
    if (!ymd) return '';
    const d = new Date(ymd.length === 10 ? `${ymd}T00:00:00Z` : ymd);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: ymd.length === 10 ? 'UTC' : 'Asia/Kolkata' });
};
export const formatDateTime = (iso: string | null | undefined) => iso
    ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    : '';
export const ago = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    return days <= 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
};
export const todayYmd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDaysYmd = (n: number) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** WhatsApp link with the text pre-typed; opens that chat when a number is given. */
export function whatsappLink(text: string, phone?: string | null) {
    let digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    const body = encodeURIComponent(text);
    // api.whatsapp.com keeps emojis; the wa.me redirect turns many of them into "?".
    return digits.length >= 11 ? `https://api.whatsapp.com/send?phone=${digits}&text=${body}` : `https://api.whatsapp.com/send?text=${body}`;
}

export const scrollStyle = { scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' } as const;

/** The body for PUT /admin/admissions/settings (the whole settings, as the server expects them). */
export const settingsBody = (s: AdmissionSettings, registrationFee: number | null) => ({
    revision: s.revision, academicYearId: s.academicYearId, formOpen: s.formOpen, interactionStep: s.interactionStep,
    registrationFee, admissionFeeDays: s.admissionFeeDays, ageCutoff: s.ageCutoff,
    ageRules: s.ageRules, fields: s.fields, questions: s.questions.map(q => ({ ...q, label: q.label.trim() })),
    documents: s.documents.map(d => ({ ...d, name: d.name.trim() })), admissionNoPrefix: s.admissionNoPrefix.trim(), nextAdmissionNo: s.nextAdmissionNo,
    admissionForm: s.admissionForm,
});
