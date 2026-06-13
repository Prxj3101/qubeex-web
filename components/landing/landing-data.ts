import {
    CalendarCheck, Brain, Wallet, ShieldCheck, BarChart3, StickyNote,
    GraduationCap, Building2, Users, type LucideIcon,
} from 'lucide-react';

/* ---------------- Features ---------------- */
export interface Feature {
    icon: LucideIcon;
    title: string;
    desc: string;
    accent: string;       // hex
    accentSoft: string;   // hex bg tint
    span?: boolean;       // wide bento cell
}

export const FEATURES: Feature[] = [
    {
        icon: Brain,
        title: 'AI-driven insights',
        desc: 'Every classroom generates signals. QubeEx turns them into clear, actionable insights — flagging falling attendance, learning gaps and at-risk students before they become problems.',
        accent: '#7C3AED', accentSoft: '#F1EBFD', span: true,
    },
    {
        icon: CalendarCheck,
        title: 'Effortless attendance',
        desc: 'Daily marking, holidays, short-attendance alerts and month-wise trends — exportable in one click.',
        accent: '#0D9488', accentSoft: '#E6F7F5',
    },
    {
        icon: Wallet,
        title: 'Fees, simplified',
        desc: 'Payment schedules, breakdowns and rules — visible to the right people at the right time.',
        accent: '#DA7756', accentSoft: '#FBEFEA',
    },
    {
        icon: BarChart3,
        title: 'Live analytics',
        desc: 'Enrollment growth, usage and performance dashboards for every level of your institution.',
        accent: '#2563EB', accentSoft: '#EAF1FE',
    },
    {
        icon: ShieldCheck,
        title: 'Audit everything',
        desc: 'Every action logged. Activity and security trails with filters, so nothing slips through.',
        accent: '#D97706', accentSoft: '#FDF3E3',
    },
    {
        icon: StickyNote,
        title: 'Teacher workspace',
        desc: 'To-dos, sticky notes and a personal notepad — the little things that make daily work lighter.',
        accent: '#DB2777', accentSoft: '#FCEDF4',
    },
];

/* ---------------- Audiences ---------------- */
export interface Audience {
    icon: LucideIcon;
    title: string;
    desc: string;
    live: boolean;
}

export const AUDIENCES: Audience[] = [
    { icon: GraduationCap, title: 'Schools', desc: 'Complete day-to-day management — live now.', live: true },
    { icon: Building2, title: 'Colleges', desc: 'Department-level assessment at scale.', live: false },
    { icon: Users, title: 'Coaching', desc: 'Batch-wise tracking built for institutes.', live: false },
];

/* ---------------- Modules ---------------- */
export interface Module {
    tag: string;
    title: string;
    desc: string;
    points: string[];
    accent: string;
}

export const MODULES: Module[] = [
    {
        tag: 'For Teachers',
        title: 'A classroom command centre',
        desc: 'Everything a teacher touches in a day — one calm dashboard.',
        points: ['Daily & overall attendance with smart alerts', 'Class and subject views with student profiles', 'Fee visibility per student', 'Personal to-dos and notes'],
        accent: '#7C3AED',
    },
    {
        tag: 'For Admins',
        title: 'The whole campus, at a glance',
        desc: 'From enrollment growth to subscription usage — admins see it all.',
        points: ['Campus, classes and teacher management', 'Analytics and enrollment trends', 'Plan usage: storage, users, AI tokens', 'Full audit logs'],
        accent: '#DA7756',
    },
    {
        tag: 'For Students',
        title: 'Learning, in their pocket',
        desc: 'A companion app that keeps students connected and on track.',
        points: ['Feed, tasks and course material', 'Assessment results and progress', 'Available on web and mobile'],
        accent: '#0D9488',
    },
];

/* ---------------- Pricing (School — live) ---------------- */
export interface PlanCard {
    name: string;
    tagline: string;
    licence: number;
    rate: number;
    rateBulk: number;
    highlight: boolean;
    points: string[];
}

export const PLANS: PlanCard[] = [
    {
        name: 'Basic',
        tagline: 'Everything to run your school digitally.',
        licence: 39999,
        rate: 20,
        rateBulk: 17,
        highlight: false,
        points: ['Attendance & class management', 'Fee schedules & tracking', 'Audit logs', 'Standard analytics', 'Email support'],
    },
    {
        name: 'Pro',
        tagline: 'Unlock the full power of AI.',
        licence: 69999,
        rate: 25,
        rateBulk: 22,
        highlight: true,
        points: ['Everything in Basic', 'AI-driven insights & assessments', 'Higher AI token limits', 'Advanced analytics', 'Priority support'],
    },
];

/* ---------------- Testimonials ---------------- */
export interface Testimonial {
    quote: string;
    name: string;
    role: string;
}

export const TESTIMONIALS: Testimonial[] = [
    { quote: 'Attendance that used to take 20 minutes now takes 2. My mornings finally start with teaching.', name: 'Priya Sharma', role: 'Class Teacher, Grade 7' },
    { quote: 'The AI flagged three students with falling attendance before I would have noticed. That alone is worth it.', name: 'Rahul Verma', role: 'Academic Coordinator' },
    { quote: 'Fee tracking used to live in four spreadsheets. Now it lives in one place — and parents stopped calling to ask.', name: 'Sunita Rao', role: 'School Administrator' },
    { quote: 'We rolled out to 1,200 students in a week. The audit logs make my compliance reviews painless.', name: 'Vikram Mehta', role: 'Principal' },
    { quote: 'The dashboard feels calm. That sounds small, but when you check it 30 times a day, it matters.', name: 'Anjali Desai', role: 'Vice Principal' },
    { quote: 'My to-do list, notes and attendance in one tab. I closed the other twelve.', name: 'Karan Patel', role: 'Subject Teacher' },
];

/* ---------------- FAQ ---------------- */
export interface Faq { q: string; a: string }

export const FAQS: Faq[] = [
    { q: 'What exactly is QubeEx?', a: 'QubeEx is an AI-powered Student Assessment System (SAS) — a single platform where institutions manage attendance, assessments, fees and analytics, with AI insights layered on top.' },
    { q: 'Is it only for schools?', a: 'Schools are fully live today. College and coaching editions are in active development and launching soon — you can register interest via the demo form.' },
    { q: 'How does pricing work?', a: 'A one-time licence fee plus a small per-student monthly rate. The rate drops automatically once you cross 1,500 students. No hidden charges.' },
    { q: 'Is there a free trial?', a: 'Yes — every institution gets a 14-day free trial with full access. No payment details needed to start.' },
    { q: 'Does it work on mobile?', a: 'Yes. QubeEx runs in any modern browser, and a dedicated mobile app keeps teachers and students connected on the go.' },
    { q: 'How is our data protected?', a: 'Role-based access control, full audit trails of every action, and encrypted storage. Your institution’s data stays yours.' },
];
