import {
  Users,
  User,
  BookMarked,
  ClipboardList,
  FileText,
  BarChart2,
  Calendar as CalendarIcon,
  Bell,
  Flag,
  Wallet,
  ShieldCheck,
  Cpu,
  Sparkles,
  MessageSquare,
} from "lucide-react";

// Pricing is uniform across all institution types.
// Volume tier is MARGINAL — only users beyond 1500 pay the lower rate.
// Committed plan option gives 15% off monthly bill; Flexible is full rate.
// AI tokens: BASIC = 10M/month, PRO = 15M/month, TRIAL = 2M.
export const PLAN_BASE = {
  BASIC: {
    licence: 39999,
    baseRate: 29,           // per user, up to 1500
    marginalRate: 24,       // per user, beyond 1500 (marginal)
    aiTokens: 10,           // millions/month
    storage: "500GB",
  },
  PRO: {
    licence: 59999,
    baseRate: 39,
    marginalRate: 33,
    aiTokens: 15,
    storage: "1TB",
  },
  TRIAL: {
    licence: 0,
    baseRate: 0,
    marginalRate: 0,
    aiTokens: 2,
    storage: "100GB",
  },
} as const;

export const COMMITTED_DISCOUNT = 0.15; // 15% off monthly bill
export const VOLUME_THRESHOLD = 1500;    // marginal rate kicks in beyond this

// Legacy tiers shape kept for backward compat with getRate() calls
const makeTiers = (base: number, marginal: number) => [
  { min: 1,    max: 1499,    rate: base     },
  { min: 1500, max: Infinity, rate: marginal },
] as const;

export const PRICING = {
  SCHOOL: {
    BASIC:  { licence: PLAN_BASE.BASIC.licence,  tiers: makeTiers(PLAN_BASE.BASIC.baseRate,  PLAN_BASE.BASIC.marginalRate)  },
    PRO:    { licence: PLAN_BASE.PRO.licence,     tiers: makeTiers(PLAN_BASE.PRO.baseRate,    PLAN_BASE.PRO.marginalRate)    },
    TRIAL:  { licence: 0, tiers: [{ min: 0, max: Infinity, rate: 0 }] as const },
  },
  COLLEGE: {
    BASIC:  { licence: PLAN_BASE.BASIC.licence,  tiers: makeTiers(PLAN_BASE.BASIC.baseRate,  PLAN_BASE.BASIC.marginalRate)  },
    PRO:    { licence: PLAN_BASE.PRO.licence,     tiers: makeTiers(PLAN_BASE.PRO.baseRate,    PLAN_BASE.PRO.marginalRate)    },
    TRIAL:  { licence: 0, tiers: [{ min: 0, max: Infinity, rate: 0 }] as const },
  },
  COACHING: {
    BASIC:  { licence: PLAN_BASE.BASIC.licence,  tiers: makeTiers(PLAN_BASE.BASIC.baseRate,  PLAN_BASE.BASIC.marginalRate)  },
    PRO:    { licence: PLAN_BASE.PRO.licence,     tiers: makeTiers(PLAN_BASE.PRO.baseRate,    PLAN_BASE.PRO.marginalRate)    },
    TRIAL:  { licence: 0, tiers: [{ min: 0, max: Infinity, rate: 0 }] as const },
  },
} as const;

export const ALL_FEATURES: {
  key: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  inBasic: boolean;
  inPro: boolean;
  addOnBasic: boolean;
  addOnPro: boolean;
  comingSoon?: boolean;
}[] = [
  { key: "student_mgmt", label: "Student Management", desc: "Enroll & manage students", icon: Users, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "teacher_mgmt", label: "Teacher Management", desc: "Add & assign teachers", icon: User, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "course_mgmt", label: "Course Management", desc: "Manage subjects & courses", icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "attendance", label: "Attendance Tracking", desc: "Student attendance management", icon: ClipboardList, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "tests", label: "AI Question & Test Generation", desc: "Create & conduct assessments", icon: FileText, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "results", label: "Results & Marksheet", desc: "Generate result reports", icon: BarChart2, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "calendar", label: "Academic Calendar", desc: "Schedule academic events", icon: CalendarIcon, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "announcements", label: "Announcements & Feed", desc: "Post notices & updates", icon: Bell, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "submissions", label: "Submissions & Resource Sharing", desc: "Homework & material sharing", icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "flags", label: "Remarks: Flags & Warning", desc: "Student disciplinary tracking", icon: Flag, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "fees", label: "Fees Management", desc: "Track fee payments", icon: Wallet, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "staffroom", label: "Staffroom & Direct Messaging", desc: "Staff feed and 1-on-1 chats", icon: MessageSquare, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "timetable_manual", label: "Timetable Publishing", desc: "Manual timetable management", icon: CalendarIcon, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "student_app", label: "Student's App", desc: "Mobile app for students", icon: Users, inBasic: true, inPro: false, addOnBasic: false, addOnPro: false },
  { key: "student_app_pro", label: "Student App with Parent Portal", desc: "Mobile app + parent access", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "leaderboard", label: "Leaderboard System", desc: "Student ranking & gamification", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "whitelabeling", label: "Whitelabelling (logo+brandname)", desc: "Custom logo & brand name", icon: ShieldCheck, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "analytics", label: "AI Performance Insights & Analytics", desc: "Advanced insights & reports", icon: BarChart2, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
  { key: "timetable_auto", label: "AI Timetable Scheduling", desc: "AI-powered auto scheduling", icon: Cpu, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false, comingSoon: true },
  { key: "smart_board", label: "AI Smart Board", desc: "Interactive AI smart board", icon: Sparkles, inBasic: true, inPro: true, addOnBasic: true, addOnPro: true },
];

export const statusCfg: Record<string, { label: string; cls: string }> = {
  ACTIVE: {
    label: "Active",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  PENDING: {
    label: "Pending",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  SUSPENDED: {
    label: "Suspended",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
};
