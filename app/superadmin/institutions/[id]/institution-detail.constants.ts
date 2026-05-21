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
} from "lucide-react";

export const PRICING = {
  SCHOOL: {
    BASIC: {
      licence: 39999,
      tiers: [
        { min: 200, max: 1499, rate: 20 },
        { min: 1500, max: Infinity, rate: 17 },
      ],
    },
    PRO: {
      licence: 69999,
      tiers: [
        { min: 200, max: 1499, rate: 25 },
        { min: 1500, max: Infinity, rate: 22 },
      ],
    },
    TRIAL: { licence: 0, tiers: [{ min: 0, max: Infinity, rate: 0 }] },
  },
  COLLEGE: {
    BASIC: {
      licence: 59999,
      tiers: [
        { min: 200, max: 1499, rate: 30 },
        { min: 1500, max: Infinity, rate: 27 },
      ],
    },
    PRO: {
      licence: 89999,
      tiers: [
        { min: 200, max: 1499, rate: 35 },
        { min: 1500, max: Infinity, rate: 32 },
      ],
    },
    TRIAL: { licence: 0, tiers: [{ min: 0, max: Infinity, rate: 0 }] },
  },
  COACHING: {
    BASIC: {
      licence: 39999,
      tiers: [
        { min: 200, max: 1499, rate: 20 },
        { min: 1500, max: Infinity, rate: 17 },
      ],
    },
    PRO: {
      licence: 69999,
      tiers: [
        { min: 200, max: 1499, rate: 25 },
        { min: 1500, max: Infinity, rate: 22 },
      ],
    },
    TRIAL: { licence: 0, tiers: [{ min: 0, max: Infinity, rate: 0 }] },
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
}[] = [
  { key: "student_mgmt", label: "Student Management", desc: "Enroll & manage students", icon: Users, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "teacher_mgmt", label: "Teacher Management", desc: "Add & assign teachers", icon: User, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "course_mgmt", label: "Course Management", desc: "Manage subjects & courses", icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "attendance", label: "Attendance Tracking", desc: "Student attendance management", icon: ClipboardList, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "tests", label: "Question & Test Generation", desc: "Create & conduct assessments", icon: FileText, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "results", label: "Results & Marksheet", desc: "Generate result reports", icon: BarChart2, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "calendar", label: "Academic Calendar", desc: "Schedule academic events", icon: CalendarIcon, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "announcements", label: "Announcements & Feed", desc: "Post notices & updates", icon: Bell, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "submissions", label: "Submissions & Resource Sharing", desc: "Homework & material sharing", icon: BookMarked, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "flags", label: "Remarks: Flags & Warning", desc: "Student disciplinary tracking", icon: Flag, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "fees", label: "Fees Management", desc: "Track fee payments", icon: Wallet, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "timetable_manual", label: "Timetable Scheduling (Manual)", desc: "Manual timetable management", icon: CalendarIcon, inBasic: true, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "student_app", label: "Student's App", desc: "Mobile app for students", icon: Users, inBasic: true, inPro: false, addOnBasic: false, addOnPro: false },
  { key: "student_app_pro", label: "Student App with Parent Portal", desc: "Mobile app + parent access", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "leaderboard", label: "Leaderboard System", desc: "Student ranking & gamification", icon: Users, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "whitelabeling", label: "Whitelabelling (logo+brandname)", desc: "Custom logo & brand name", icon: ShieldCheck, inBasic: false, inPro: true, addOnBasic: false, addOnPro: false },
  { key: "timetable_auto", label: "Timetable Scheduling (Auto)", desc: "AI-powered auto scheduling", icon: Cpu, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
  { key: "analytics", label: "Performance Insights & Analytics", desc: "Advanced insights & reports", icon: BarChart2, inBasic: true, inPro: true, addOnBasic: true, addOnPro: false },
  { key: "smart_board", label: "Smart Board Screen with AI", desc: "Interactive AI smart board", icon: Sparkles, inBasic: true, inPro: true, addOnBasic: true, addOnPro: true },
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
