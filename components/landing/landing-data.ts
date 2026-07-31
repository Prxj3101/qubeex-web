import {
    CalendarCheck, Brain, Wallet, ShieldCheck, BarChart3, StickyNote,
    School, Building2, Users, type LucideIcon,
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
        desc: 'Every classroom generates signals. QubeEx turns them into clear, actionable insights - flagging falling attendance, learning gaps and at-risk students before they become problems.',
        accent: '#7C3AED', accentSoft: '#F1EBFD', span: true,
    },
    {
        icon: CalendarCheck,
        title: 'Effortless attendance',
        desc: 'Daily marking, holidays, short-attendance alerts and month-wise trends - exportable in one click.',
        accent: '#0D9488', accentSoft: '#E6F7F5',
    },
    {
        icon: Wallet,
        title: 'Fees, simplified',
        desc: 'Payment schedules, breakdowns and rules - visible to the right people at the right time.',
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
        desc: 'To-dos, sticky notes and a personal notepad - the little things that make daily work lighter.',
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
    { icon: School, title: 'Schools', desc: 'Complete day-to-day management - live now.', live: true },
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
        tag: 'For Admins',
        title: 'The whole campus, at a glance',
        desc: 'From enrollment growth to subscription usage - admins see it all, and can delegate scoped access to subadmins for day-to-day work.',
        points: ['Campus, classes and teacher management', 'Subadmin roles with granular, per-module permissions', 'AI-powered analytics and enrollment trends', 'Plan usage: storage, users, AI tokens', 'Full audit logs'],
        accent: '#DA7756',
    },
    {
        tag: 'For Teachers',
        title: 'A classroom command centre',
        desc: 'Everything a teacher touches in a day - one calm dashboard.',
        points: ['AI Smartboard - AI-assisted live teaching', 'Daily & overall attendance with smart alerts', 'Tasks, tests, marks & AI question generation', 'Student profiles, fee visibility & personal notes'],
        accent: '#7C3AED',
    },
    {
        tag: 'For Students',
        title: 'Learning, in their pocket',
        desc: 'A companion app that keeps students connected and on track.',
        points: ['Campus feed, tasks, AI-generated tests & course material', 'Marksheets & report cards with progress tracking', 'Fee visibility for students & parents', 'Available on web and mobile'],
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
        rate: 29,
        rateBulk: 24,
        highlight: false,
        points: [
            'Student, teacher & course management',
            'Attendance & campus feed',
            'AI question & test generation',
            'Marksheets & fee tracking',
            'Student mobile app',
            'Audit logs',
            '10M AI tokens included',
        ],
    },
    {
        name: 'Pro',
        tagline: 'Everything in Basic, plus the works.',
        licence: 59999,
        rate: 39,
        rateBulk: 33,
        highlight: true,
        points: [
            'Everything in Basic',
            'Automatic timetable generation',
            'Parent portal',
            'Performance insights & analytics',
            'Student leaderboard',
            'Whitelabelling',
            'Priority support',
        ],
    },
];

/* ---------------- Testimonials ---------------- */
export interface Testimonial {
    quote: string;
    name: string;
    role: string;
}

// NOTE: intentionally empty — previous array held fabricated quotes from institutions
// that don't exist yet. Re-populate with real quotes once pilot schools go live
// (see Launch Plan doc, Section 6: "fake testimonials hatao ... pilot se real aane tak").
export const TESTIMONIALS: Testimonial[] = [];

/* ---------------- FAQ ---------------- */
export interface Faq { q: string; a: string }

export const FAQS: Faq[] = [
    { q: 'What exactly is QubeEx?', a: 'QubeEx is an AI-powered Student Assessment System (SAS) - a single platform where institutions manage attendance, assessments, fees and analytics, with AI insights layered on top.' },
    { q: 'Is it only for schools?', a: 'Schools are fully live today. College and coaching editions are in active development and launching soon - you can register interest via the demo form.' },
    { q: 'How does pricing work?', a: 'A one-time licence fee plus a small monthly rate per active user (admins, teachers and students). The rate drops automatically once your institution crosses 1,500 users. No hidden charges.' },
    { q: 'Is there a free trial?', a: 'Yes - every institution gets a 14-day free trial with full access. No payment details needed to start.' },
    { q: 'We have multiple branches - how does that work?', a: 'Each branch runs as its own account with its own licence, since principals, class structures and staff differ per branch. With 2 or more branches, every licence gets a flat 20% discount. Monthly per-user billing stays standard for each branch.' },
    { q: 'What is SmartBoard AI?', a: 'SmartBoard lets teachers run live teaching material on the class blackboard with an AI assist panel alongside - explanations, questions and material on demand. It ships as an addon that is free for the first year on every plan.' },
    { q: 'Does it work on mobile?', a: 'Yes. QubeEx runs in any modern browser, and a dedicated mobile app keeps teachers and students connected on the go.' },
    { q: 'How is our data protected?', a: 'Role-based access control, full audit trails of every action, and encrypted storage - built to align with India’s DPDP Act. Since much of the data involves minors, we treat it with extra care: your institution remains the data fiduciary, QubeEx acts only as processor, and data is never shared or sold. On exit, your institution’s data can be exported and deleted on request.' },
];
