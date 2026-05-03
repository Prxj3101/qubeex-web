"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  ArrowLeft,
  Landmark,
  LayoutGrid,
  SlidersHorizontal,
  Building2,
  Mail,
  Calendar,
  Phone,
  MapPin,
  User,
  Send,
  ToggleLeft,
  ToggleRight,
  Hash,
  Globe,
  IndianRupee,
  BookOpen,
  School,
  GraduationCap,
  HardDrive,
  Sparkles,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  ShieldCheck,
  FileText,
  ChevronRight,
  Pencil,
  X,
  Check,
  BookMarked,
  ClipboardList,
  Bell,
  Trophy,
  Upload,
  Camera,
  Play,
  Pause,
  Flag,
  Wallet,
  BarChart2,
  Calendar as CalendarIcon,
  Cpu,
} from "lucide-react";
import { Institution } from "@/types";
import api from "@/lib/api";
import { toast } from "sonner";
import { TrialManagementSection } from "@/components/superadmin/TrialManagementSection";

type BillItem = {
  label: string;
  desc: string;
  amount: number;
  type: "base" | "addon" | "licence";
};
type Bill = {
  id: string;
  type: "LICENCE" | "MONTHLY";
  month: string;
  dateRange: string;
  items: BillItem[];
  total: number;
  status: "PAID" | "PENDING";
  generatedOn: string;
};

// ─── Types ─────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};
type InstData = {
  id: string;
  institutionCode?: string;
  name: string;
  email: string;
  type: "SCHOOL" | "COLLEGE" | "COACHING";
  status: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  pincode?: string | null;
  country?: string | null;
  board?: string | null;
  medium?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  users?: AdminUser[];
  admin?: AdminUser | null;
  teacherCount?: number;
  studentCount?: number;
  subscription?: {
    plan?: { name: string };
    status?: string;
    startDate?: string;
    endDate?: string;
    trialDays?: number | null;
    trialOutcome?: string | null;
  } | null;
};

/** Format UTC ISO → IST */
function toIST(iso?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  });
}

const PRICING = {
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
};

function getRate(
  tiers: { min: number; max: number; rate: number }[],
  users: number,
) {
  return (
    tiers.find((t) => users >= t.min && users <= t.max)?.rate ?? tiers[0].rate
  );
}
function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const ALL_FEATURES: {
  key: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  inBasic: boolean;
  inPro: boolean;
  addOnBasic: boolean;
  addOnPro: boolean;
}[] = [
  {
    key: "student_mgmt",
    label: "Student Management",
    desc: "Enroll & manage students",
    icon: Users,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "teacher_mgmt",
    label: "Teacher Management",
    desc: "Add & assign teachers",
    icon: User,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "course_mgmt",
    label: "Course Management",
    desc: "Manage subjects & courses",
    icon: BookMarked,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "attendance",
    label: "Attendance Tracking",
    desc: "Student attendance management",
    icon: ClipboardList,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "tests",
    label: "Question & Test Generation",
    desc: "Create & conduct assessments",
    icon: FileText,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "results",
    label: "Results & Marksheet",
    desc: "Generate result reports",
    icon: BarChart2,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "calendar",
    label: "Academic Calendar",
    desc: "Schedule academic events",
    icon: CalendarIcon,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "announcements",
    label: "Announcements & Feed",
    desc: "Post notices & updates",
    icon: Bell,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "submissions",
    label: "Submissions & Resource Sharing",
    desc: "Homework & material sharing",
    icon: BookMarked,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "flags",
    label: "Remarks: Flags & Warning",
    desc: "Student disciplinary tracking",
    icon: Flag,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "fees",
    label: "Fees Management",
    desc: "Track fee payments",
    icon: Wallet,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "timetable_manual",
    label: "Timetable Scheduling (Manual)",
    desc: "Manual timetable management",
    icon: CalendarIcon,
    inBasic: true,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "student_app",
    label: "Student's App",
    desc: "Mobile app for students",
    icon: Upload,
    inBasic: true,
    inPro: false,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "student_app_pro",
    label: "Student App with Parent Portal",
    desc: "Mobile app + parent access",
    icon: Users,
    inBasic: false,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "leaderboard",
    label: "Leaderboard System",
    desc: "Student ranking & gamification",
    icon: Trophy,
    inBasic: false,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "whitelabeling",
    label: "Whitelabelling (logo+brandname)",
    desc: "Custom logo & brand name",
    icon: ShieldCheck,
    inBasic: false,
    inPro: true,
    addOnBasic: false,
    addOnPro: false,
  },
  {
    key: "timetable_auto",
    label: "Timetable Scheduling (Auto)",
    desc: "AI-powered auto scheduling",
    icon: Cpu,
    inBasic: true,
    inPro: true,
    addOnBasic: true,
    addOnPro: false,
  },
  {
    key: "analytics",
    label: "Performance Insights & Analytics",
    desc: "Advanced insights & reports",
    icon: BarChart2,
    inBasic: true,
    inPro: true,
    addOnBasic: true,
    addOnPro: false,
  },
  {
    key: "smart_board",
    label: "Smart Board Screen with AI",
    desc: "Interactive AI smart board",
    icon: Sparkles,
    inBasic: true,
    inPro: true,
    addOnBasic: true,
    addOnPro: true,
  },
];

function getDefaultFeatures(
  plan: "BASIC" | "PRO" | "TRIAL",
): Record<string, boolean> {
  if (plan === "TRIAL") return {};
  return ALL_FEATURES.reduce(
    (acc, f) => {
      const inPlan = plan === "PRO" ? f.inPro : f.inBasic;
      if (inPlan) acc[f.key] = true;
      return acc;
    },
    {} as Record<string, boolean>,
  );
}

function getPlanFeatures(plan: "BASIC" | "PRO" | "TRIAL") {
  if (plan === "TRIAL") return { defaults: [], addons: [] };
  return {
    defaults: ALL_FEATURES.filter((f) =>
      plan === "PRO" ? f.inPro && !f.addOnPro : f.inBasic && !f.addOnBasic,
    ),
    addons: ALL_FEATURES.filter((f) =>
      plan === "PRO" ? f.inPro && f.addOnPro : f.inBasic && f.addOnBasic,
    ),
  };
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 rounded-full transition-colors duration-200 shrink-0 ${on ? "bg-[#DA7756]" : "bg-muted-foreground/30"}`}
      style={{ height: "22px" }}
    >
      <div
        className={`absolute top-0.5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0.5"}`}
        style={{ width: "18px", height: "18px" }}
      />
    </button>
  );
}

function InfoBox({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${highlight ? "bg-[#DA7756]/10 border border-[#DA7756]/20" : "bg-muted/40"}`}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-bold mt-0.5 ${highlight ? "text-[#DA7756]" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const statusCfg: Record<string, { label: string; cls: string }> = {
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

function SectionCard({
  title,
  children,
  editBtn,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  editBtn?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        {editBtn}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
      <Icon size={14} className="text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-xs text-muted-foreground w-28 shrink-0">
        {label}
      </span>
      <span className="text-xs font-medium text-foreground flex-1">
        {value}
      </span>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
      <span className="text-xs text-muted-foreground w-28 shrink-0">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all"
      />
    </div>
  );
}

function ViewDetailsTab({
  inst,
  onStatusToggle,
  onResendInvite,
}: {
  inst: InstData;
  onStatusToggle: () => void;
  onResendInvite: () => void;
}) {
  const status = statusCfg[inst.status] ?? statusCfg["PENDING"];
  const TypeIcon =
    inst.type === "SCHOOL"
      ? School
      : inst.type === "COLLEGE"
        ? GraduationCap
        : BookOpen;
  const initials = inst.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const joinDate = toIST(inst.createdAt);
  const [logoErr, setLogoErr] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(inst.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Only PNG, JPG, or WEBP images are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      return;
    }
    try {
      setLogoUploading(true);
      const uploadRes = await api.post("/superadmin/institutions/logo", file, {
        headers: { "Content-Type": file.type },
      });
      const newLogoUrl: string = uploadRes.data?.data?.logoUrl;
      await api.put(`/superadmin/institutions/${inst.id}`, { logoUrl: newLogoUrl });
      setCurrentLogoUrl(newLogoUrl);
      setLogoErr(false);
      toast.success("Logo updated");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to upload logo");
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  };

  // Enrich admin info from either dedicated field or users array
  const adminUser =
    inst.admin ?? inst.users?.find((u) => u.role === "ADMIN") ?? null;
  const adminName = adminUser?.name ?? adminUser?.email?.split("@")[0] ?? "—";
  const studentCount = inst.studentCount ?? 0;
  const teacherCount = inst.teacherCount ?? 0;
  const planName = inst.subscription?.plan?.name ?? "—";
  const instCode = inst.institutionCode ?? null;
  const logoUrl = inst.logoUrl ?? null;

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [instDraft, setInstDraft] = useState({
    name: inst.name,
    email: inst.email,
    phone: inst.phone ?? "",
    board: inst.board ?? "",
    medium: inst.medium ?? "",
  });
  const [instSaved, setInstSaved] = useState({ ...instDraft });
  const [locDraft, setLocDraft] = useState({
    address: inst.address ?? "",
    city: inst.city ?? "",
    state: inst.state ?? "",
    country: inst.country ?? "",
    pincode: inst.pincode ?? "",
  });
  const [locSaved, setLocSaved] = useState({ ...locDraft });
  const [adminDraft, setAdminDraft] = useState({ adminName });
  const [adminSaved, setAdminSaved] = useState({ adminName });

  const cancelEdit = (s: string) => {
    if (s === "inst") setInstDraft({ ...instSaved });
    if (s === "loc") setLocDraft({ ...locSaved });
    if (s === "admin") setAdminDraft({ ...adminSaved });
    setEditingSection(null);
  };
  const saveEdit = (s: string) => {
    if (s === "inst") setInstSaved({ ...instDraft });
    if (s === "loc") setLocSaved({ ...locDraft });
    if (s === "admin") setAdminSaved({ ...adminDraft });
    setEditingSection(null);
    toast.success("Changes saved");
  };
  const editBtns = (s: string) =>
    editingSection === s ? (
      <div className="flex gap-1.5">
        <button
          onClick={() => cancelEdit(s)}
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all"
        >
          <X size={11} /> Cancel
        </button>
        <button
          onClick={() => saveEdit(s)}
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all"
          style={{
            background:
              "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
          }}
        >
          <Check size={11} /> Save
        </button>
      </div>
    ) : (
      <button
        onClick={() => setEditingSection(s)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
      >
        <Pencil size={11} /> Edit
      </button>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="bg-card border border-border/50 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          {/* Logo / initials — click to upload */}
          <div
            onClick={() => !logoUploading && logoFileRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl bg-muted ring-2 ring-border shrink-0 overflow-hidden flex items-center justify-center cursor-pointer group"
            title="Click to change logo"
          >
            {currentLogoUrl && !logoErr ? (
              <img
                src={currentLogoUrl}
                alt={inst.name}
                className="w-full h-full object-cover"
                onError={() => setLogoErr(true)}
              />
            ) : (
              <span className="text-xl font-bold text-muted-foreground select-none">
                {initials}
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
              {logoUploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Camera size={14} className="text-white" />
                  <span className="text-[9px] text-white font-medium leading-none">Change</span>
                </>
              )}
            </div>
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold leading-tight">
                  {instSaved.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    <TypeIcon size={11} />
                    {inst.type}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${status.cls}`}
                  >
                    {status.label}
                  </span>
                  {planName !== "—" && (
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        background:
                          planName === "PRO" ? "#DA775620" : "#7C3AED20",
                        color: planName === "PRO" ? "#DA7756" : "#7C3AED",
                      }}
                    >
                      {planName}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onResendInvite}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <Send size={12} /> Resend Invite
                </button>
                <button
                  onClick={onStatusToggle}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${inst.status === "ACTIVE" ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"}`}
                >
                  {inst.status === "ACTIVE" ? (
                    <>
                      <ToggleLeft size={13} /> Suspend
                    </>
                  ) : (
                    <>
                      <ToggleRight size={13} /> Activate
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
              {[
                { label: "Students", value: studentCount },
                { label: "Teachers", value: teacherCount },
                { label: "Joined", value: joinDate },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-lg font-bold leading-tight">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Institution Info" editBtn={editBtns("inst")}>
          {editingSection === "inst" ? (
            <>
              <EditableField
                label="Name"
                value={instDraft.name}
                onChange={(v) => setInstDraft((d) => ({ ...d, name: v }))}
              />
              <EditableField
                label="Email"
                value={instDraft.email}
                onChange={(v) => setInstDraft((d) => ({ ...d, email: v }))}
              />
              <EditableField
                label="Phone"
                value={instDraft.phone}
                onChange={(v) => setInstDraft((d) => ({ ...d, phone: v }))}
              />
              <EditableField
                label="Board"
                value={instDraft.board}
                onChange={(v) => setInstDraft((d) => ({ ...d, board: v }))}
              />
              <EditableField
                label="Medium"
                value={instDraft.medium}
                onChange={(v) => setInstDraft((d) => ({ ...d, medium: v }))}
              />
            </>
          ) : (
            <>
              <InfoRow
                icon={Hash}
                label="Institute ID"
                value={
                  instCode ? (
                    <span
                      className="font-mono text-xs font-semibold tracking-wider"
                      style={{ color: "#DA7756" }}
                    >
                      {instCode}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/50 text-[11px]">
                      —
                    </span>
                  )
                }
              />
              <InfoRow icon={Building2} label="Name" value={instSaved.name} />
              <InfoRow icon={TypeIcon} label="Type" value={inst.type} />
              <InfoRow icon={Mail} label="Email" value={instSaved.email} />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={instSaved.phone || "—"}
              />
              <InfoRow
                icon={BookOpen}
                label="Board"
                value={instSaved.board || "—"}
              />
              <InfoRow
                icon={Globe}
                label="Medium"
                value={instSaved.medium || "—"}
              />
              <InfoRow icon={Calendar} label="Joined (IST)" value={joinDate} />
            </>
          )}
        </SectionCard>
        <SectionCard title="Location" editBtn={editBtns("loc")}>
          {editingSection === "loc" ? (
            <>
              <EditableField
                label="Address"
                value={locDraft.address}
                onChange={(v) => setLocDraft((d) => ({ ...d, address: v }))}
              />
              <EditableField
                label="City"
                value={locDraft.city}
                onChange={(v) => setLocDraft((d) => ({ ...d, city: v }))}
              />
              <EditableField
                label="State"
                value={locDraft.state}
                onChange={(v) => setLocDraft((d) => ({ ...d, state: v }))}
              />
              <EditableField
                label="Country"
                value={locDraft.country}
                onChange={(v) => setLocDraft((d) => ({ ...d, country: v }))}
              />
              <EditableField
                label="Pincode"
                value={locDraft.pincode}
                onChange={(v) => setLocDraft((d) => ({ ...d, pincode: v }))}
              />
            </>
          ) : (
            <>
              <InfoRow
                icon={MapPin}
                label="Address"
                value={locSaved.address || "—"}
              />
              <InfoRow
                icon={MapPin}
                label="City"
                value={locSaved.city || "—"}
              />
              <InfoRow
                icon={MapPin}
                label="State"
                value={locSaved.state || "—"}
              />
              <InfoRow
                icon={Globe}
                label="Country"
                value={locSaved.country || "—"}
              />
              <InfoRow
                icon={Hash}
                label="Pincode"
                value={locSaved.pincode || "—"}
              />
            </>
          )}
        </SectionCard>
        <SectionCard title="Admin Info" editBtn={editBtns("admin")}>
          {adminUser ? (
            <div>
              {editingSection === "admin" ? (
                <EditableField
                  label="Admin Name"
                  value={adminDraft.adminName}
                  onChange={(v) =>
                    setAdminDraft((d) => ({ ...d, adminName: v }))
                  }
                />
              ) : (
                <InfoRow
                  icon={User}
                  label="Admin Name"
                  value={adminSaved.adminName || "—"}
                />
              )}
              <InfoRow
                icon={Mail}
                label="Admin Email"
                value={adminUser.email}
              />
              <InfoRow icon={ShieldCheck} label="Role" value={adminUser.role} />
              <InfoRow
                icon={CheckCircle}
                label="Account Active"
                value={adminUser.isActive ? "Yes" : "Pending setup"}
              />
              <InfoRow
                icon={Calendar}
                label="Created (IST)"
                value={toIST(adminUser.createdAt)}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No admin assigned yet
            </p>
          )}
        </SectionCard>
        <SectionCard title="Platform Stats">
          <InfoRow icon={Users} label="Total Students" value={studentCount} />
          <InfoRow icon={User} label="Total Teachers" value={teacherCount} />
          <InfoRow icon={FileText} label="Tests Conducted" value="—" />
          <InfoRow icon={Zap} label="Last Active" value="—" />
          <InfoRow
            icon={Calendar}
            label="Last Updated (IST)"
            value={toIST(inst.updatedAt)}
          />
        </SectionCard>
      </div>
    </motion.div>
  );
}

function ManagePlanTab({ inst, hideTrial = false }: { inst: InstData; hideTrial?: boolean }) {
  const instType =
    (inst.type as keyof typeof PRICING) in PRICING
      ? (inst.type as keyof typeof PRICING)
      : "SCHOOL";
  const pricing = PRICING[instType];
  const initialPlan =
    (inst.subscription?.plan?.name as "BASIC" | "PRO" | "TRIAL") ?? "BASIC";
  const [planActive, setPlanActive] = useState(false);
  const [plan, setPlan] = useState<"BASIC" | "PRO" | "TRIAL">(initialPlan);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("0");
  const [discount, setDiscount] = useState(0);
  const [licencePaid, setLicencePaid] = useState(false);
  const [activating, setActivating] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>(
    getDefaultFeatures("BASIC"),
  );
  const [storageAddGb, setStorageAddGb] = useState(0);
  const [storageAddInput, setStorageAddInput] = useState("0");
  const [storagePricePerGb, setStoragePricePerGb] = useState<number | "">("");
  const [storageAdded, setStorageAdded] = useState(false);
  const [tokenAddK, setTokenAddK] = useState(0);
  const [tokenAddInput, setTokenAddInput] = useState("0");
  const [tokenPricePer10k, setTokenPricePer10k] = useState<number | "">("");
  const [tokenAdded, setTokenAdded] = useState(false);
  const [planPaused, setPlanPaused] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<
    "deactivate" | "pause" | "resume" | "upgrade" | "enable_addon" | null
  >(null);
  const [upgradePaid, setUpgradePaid] = useState(false);
  const [upgradeDate, setUpgradeDate] = useState<Date | null>(null);
  const [upgradeModalTab, setUpgradeModalTab] = useState<"current" | "after">(
    "current",
  );
  const [addonExpiries, setAddonExpiries] = useState<Record<string, Date>>({});
  const [pendingEnableKey, setPendingEnableKey] = useState<string | null>(null);
  const [addonExtraBill, setAddonExtraBill] = useState(0);
  const [billModal, setBillModal] = useState<Bill | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [activationDate] = useState(new Date("2024-11-14")); // Plan change pe — sirf non-active state mein
  useEffect(() => {
    if (!planActive) {
      setFeatures(getDefaultFeatures(plan));
      return;
    }
    const today2 = new Date();
    const basicExpiry = new Date(activationDate);
    basicExpiry.setFullYear(basicExpiry.getFullYear() + 1);

    setFeatures((prev) => {
      const updated = { ...getDefaultFeatures(plan) };
      ALL_FEATURES.filter((f) =>
        plan === "PRO" ? f.inPro && f.addOnPro : f.inBasic && f.addOnBasic,
      ).forEach((f) => {
        const finalExpiry = addonExpiries[f.key] ?? basicExpiry;
        updated[f.key] = today2 <= finalExpiry;
      });
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planActive, plan]);

  const activeUsers = (inst.studentCount ?? 0) + (inst.teacherCount ?? 0) + 1;
  const planPricing = pricing[plan] ?? pricing.BASIC;
  const currentRate = getRate(planPricing.tiers, activeUsers);
  const licenceCost = planPricing.licence;
  const discountAmt = Math.round(licenceCost * (discount / 100));
  const finalLicence = licenceCost - discountAmt;
  const billedUsers = Math.max(200, activeUsers);
  const monthlyBill = billedUsers * currentRate;
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const canActivate = plan === "TRIAL" || licencePaid;

  const handleActivate = async () => {
    setActivating(true);
    await new Promise((r) => setTimeout(r, 1000));
    setPlanActive(true);
    setActivating(false);
    toast.success(`${plan} plan activated!`);
  };

  const PLAN_OPTS = [
    {
      key: "BASIC" as const,
      label: "Basic",
      activeColor: "text-primary",
      dot: "bg-primary",
      border: "border-primary bg-primary/5",
      features: [
        {
          icon: IndianRupee,
          label: `₹${pricing.BASIC.tiers[0].rate}/user/mo (200–1499 users)`,
        },
        {
          icon: IndianRupee,
          label: `₹${pricing.BASIC.tiers[1].rate}/user/mo (1500+ users)`,
        },
        { icon: Users, label: "Min. 200 users" },
        { icon: Sparkles, label: "10M AI Tokens/month" },
        { icon: HardDrive, label: "500GB Storage" },
        { icon: Sparkles, label: "13 Default Features" },
        { icon: XCircle, label: "No Whitelabeling" },
      ],
    },
    {
      key: "PRO" as const,
      label: "Pro",
      activeColor: "text-[#DA7756]",
      dot: "bg-[#DA7756]",
      border: "border-[#DA7756] bg-[#DA7756]/5",
      features: [
        {
          icon: IndianRupee,
          label: `₹${pricing.PRO.tiers[0].rate}/user/mo (200–1499 users)`,
        },
        {
          icon: IndianRupee,
          label: `₹${pricing.PRO.tiers[1].rate}/user/mo (1500+ users)`,
        },
        { icon: Users, label: "Min. 200 users" },
        { icon: Sparkles, label: "10M AI Tokens/month" },
        { icon: HardDrive, label: "1TB Storage" },
        { icon: Sparkles, label: "16 Default Features" },
        { icon: CheckCircle, label: "Whitelabeling" },
      ],
    },
    {
      key: "TRIAL" as const,
      label: "Trial",
      activeColor: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
      border: "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
      features: [],
    },
  ];

  // ── ACTIVE VIEW ──
  if (planActive) {
    const basicExpiryDate = new Date(activationDate);
    basicExpiryDate.setFullYear(basicExpiryDate.getFullYear() + 1);
    const today2 = new Date();
    const isExpired = (date: Date) => today2 > date;
    const daysLeft = (date: Date) =>
      Math.max(
        0,
        Math.ceil((date.getTime() - today2.getTime()) / (1000 * 60 * 60 * 24)),
      );

    const isAfter12Months = upgradeDate
      ? upgradeDate.getTime() - activationDate.getTime() >
        365 * 24 * 60 * 60 * 1000
      : false;

    const getFeatureExpiry = (key: string) => {
      const proOnlyKeys = ["leaderboard", "whitelabeling", "student_app_pro"];
      if (proOnlyKeys.includes(key) && upgradeDate && isAfter12Months) {
        const exp = new Date(upgradeDate);
        exp.setFullYear(exp.getFullYear() + 1);
        return exp;
      }

      return basicExpiryDate;
    };

    // Upgrade modal calculations
    const upgradeActivationDate = new Date("2024-11-14"); // 12+ months used
    const today3 = new Date();
    const monthsUsed = Math.min(
      12,
      Math.floor(
        (today3.getTime() - upgradeActivationDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      ),
    );
    const monthsRemaining = Math.max(0, 12 - monthsUsed);
    const proLicence = pricing.PRO.licence;
    const basicLicence = pricing.BASIC.licence;
    const remainingCredit = Math.round((monthsRemaining / 12) * basicLicence);
    const upgradeIsAfter12 = monthsUsed >= 12;
    const loyaltyDiscount = upgradeIsAfter12 ? Math.round(proLicence * 0.1) : 0;
    const finalUpgradeCharge = upgradeIsAfter12
      ? proLicence - loyaltyDiscount
      : proLicence - remainingCredit;
    const newMonthlyRate = getRate(pricing.PRO.tiers, activeUsers);

    // Basic features for "Current" tab
    const basicDefaults = ALL_FEATURES.filter(
      (f) => f.inBasic && !f.addOnBasic,
    );
    const basicAddons = ALL_FEATURES.filter((f) => f.inBasic && f.addOnBasic);
    // PRO new features for "After" tab
    const proNewFeatures = ALL_FEATURES.filter((f) => f.inPro && !f.inBasic);
    const proNewAddons = ALL_FEATURES.filter(
      (f) => f.inPro && f.addOnPro && !f.addOnBasic,
    );

    const paymentHistory = [
      {
        date: "14 Apr 2026",
        amount: licenceCost,
        type: "One-time Licence",
        status: "PAID",
      },
      {
        date: "01 Apr 2026",
        amount: monthlyBill,
        type: "Monthly Bill",
        status: "PAID",
      },
      {
        date: "01 Mar 2026",
        amount: monthlyBill,
        type: "Monthly Bill",
        status: "PAID",
      },
    ];

    const CustomTooltip = ({ active, payload }: any) => {
      if (!active || !payload?.length) return null;
      const { name, value } = payload[0];
      const colorMap: Record<string, string> = {
        Admin: "#7C3AED",
        Teachers: "#F59E0B",
        Students: "#10B981",
      };
      return (
        <div
          className="px-3 py-2 rounded-xl shadow-xl"
          style={{ background: "#1A1030", border: "1px solid #2D1F50" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: colorMap[name] }}
            />
            <span style={{ color: "#F1F5F9", fontSize: 12, fontWeight: 600 }}>
              {name}
            </span>
          </div>
          <p
            style={{
              color: "#F1F5F9",
              fontSize: 13,
              fontWeight: 800,
              marginTop: 2,
            }}
          >
            {value}
          </p>
        </div>
      );
    };

    const tierBreakdown = planPricing.tiers.map((tier) => ({
      ...tier,
      label:
        tier.max === Infinity
          ? `${tier.min}+ users`
          : `${tier.min}–${tier.max} users`,
      isActive: activeUsers >= tier.min && activeUsers <= tier.max,
    }));

    const storageBase = plan === "PRO" ? 1024 : 500;
    const storageUsed = 312;
    const storageUsedPct = Math.min(
      100,
      Math.round((storageUsed / storageBase) * 100),
    );
    const storagePriceNum =
      typeof storagePricePerGb === "number" ? storagePricePerGb : 0;
    const storageAddTotal = storageAddGb * storagePriceNum;
    const tokenBase = 10000000;
    const tokenUsed = plan === "PRO" ? 180000 : 44000;
    const tokenUsedPct = Math.min(
      100,
      Math.round((tokenUsed / tokenBase) * 100),
    );
    const tokenPriceNum =
      typeof tokenPricePer10k === "number" ? tokenPricePer10k : 0;
    const tokenAddTotal = tokenAddK * tokenPriceNum;
    const addonBill =
      (storageAdded ? storageAddTotal : 0) +
      (tokenAdded ? tokenAddTotal : 0) +
      addonExtraBill;
    const { defaults: defFeatures, addons: addonFeatures } =
      getPlanFeatures(plan);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const currentMonthDateRange = `${monthStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${monthEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

    const currentMonthItems: BillItem[] = [
      {
        label: "Monthly User Bill",
        desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
        amount: monthlyBill,
        type: "base",
      },
      ...(storageAdded
        ? [
            {
              label: "Storage Add-On",
              desc: `${storageAddGb}GB × ₹${storagePricePerGb}/GB`,
              amount: storageAddTotal,
              type: "addon" as const,
            },
          ]
        : []),
      ...(tokenAdded
        ? [
            {
              label: "AI Tokens Add-On",
              desc: `${tokenAddK}M tokens × ₹${tokenPricePer10k}/1M`,
              amount: tokenAddTotal,
              type: "addon" as const,
            },
          ]
        : []),
      ...(addonExtraBill > 0
        ? [
            {
              label: "Feature Re-enable Charges",
              desc: "Expired add-on features renewed",
              amount: addonExtraBill,
              type: "addon" as const,
            },
          ]
        : []),
    ];
    const currentMonthTotal = currentMonthItems.reduce(
      (sum, i) => sum + i.amount,
      0,
    );

    const mockBills: Bill[] = [
      {
        id: "b6",
        type: "MONTHLY",
        month: "Mar 2026",
        dateRange: "01 Mar – 31 Mar 2026",
        items: [
          {
            label: "Monthly User Bill",
            desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
            amount: monthlyBill,
            type: "base" as const,
          },
        ],
        total: monthlyBill,
        status: "PAID" as const,
        generatedOn: "31 Mar 2026",
      },
      {
        id: "b5",
        type: "MONTHLY",
        month: "Feb 2026",
        dateRange: "01 Feb – 28 Feb 2026",
        items: [
          {
            label: "Monthly User Bill",
            desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
            amount: monthlyBill,
            type: "base" as const,
          },
        ],
        total: monthlyBill,
        status: "PAID" as const,
        generatedOn: "28 Feb 2026",
      },
      {
        id: "b4",
        type: "MONTHLY",
        month: "Jan 2026",
        dateRange: "01 Jan – 31 Jan 2026",
        items: [
          {
            label: "Monthly User Bill",
            desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
            amount: monthlyBill,
            type: "base" as const,
          },
        ],
        total: monthlyBill,
        status: "PENDING" as const,
        generatedOn: "31 Jan 2026",
      },
      {
        id: "b3",
        type: "MONTHLY",
        month: "Dec 2025",
        dateRange: "01 Dec – 31 Dec 2025",
        items: [
          {
            label: "Monthly User Bill",
            desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
            amount: monthlyBill,
            type: "base" as const,
          },
        ],
        total: monthlyBill,
        status: "PAID" as const,
        generatedOn: "31 Dec 2025",
      },
      {
        id: "b2",
        type: "MONTHLY",
        month: "Nov 2025",
        dateRange: "01 Nov – 30 Nov 2025",
        items: [
          {
            label: "Monthly User Bill",
            desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
            amount: monthlyBill,
            type: "base" as const,
          },
        ],
        total: monthlyBill,
        status: "PAID" as const,
        generatedOn: "30 Nov 2025",
      },
      {
        id: "b1",
        type: "MONTHLY",
        month: "Dec 2024",
        dateRange: "01 Dec – 31 Dec 2024",
        items: [
          {
            label: "Monthly User Bill",
            desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
            amount: monthlyBill,
            type: "base" as const,
          },
        ],
        total: monthlyBill,
        status: "PAID" as const,
        generatedOn: "31 Dec 2024",
      },
      {
        id: "b0",
        type: "LICENCE",
        month: "Nov 2024",
        dateRange: "14 Nov 2024",
        items: [
          {
            label: "One-time Licence Fee",
            desc: `${plan} Plan — ${instType}`,
            amount: licenceCost,
            type: "licence" as const,
          },
        ],
        total: licenceCost,
        status: "PAID" as const,
        generatedOn: "14 Nov 2024",
      },
    ];
    const allBills = bills.length > 0 ? bills : mockBills;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {/* Active Banner */}
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Plan Active
                </span>
              </div>
              <h2
                className="text-2xl font-black"
                style={{ color: plan === "PRO" ? "#DA7756" : "#7C3AED" }}
              >
                {plan}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {instType} · Monthly Billing · {fmt(currentRate)}/user
              </p>

              {/* Dates */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CalendarIcon size={11} /> Activated:{" "}
                  <span className="font-medium text-foreground ml-1">
                    {activationDate.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
                {upgradeDate && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Zap size={11} className="text-[#DA7756]" /> Upgraded to
                    PRO:{" "}
                    <span className="font-medium text-[#DA7756] ml-1">
                      {upgradeDate.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                )}
              </div>

              {planPaused && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-full mt-1">
                  <Pause size={10} /> Operations Paused
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {plan === "BASIC" && (
                <button
                  onClick={() => {
                    setUpgradeModalTab("current");
                    setConfirmDialog("upgrade");
                  }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                  }}
                >
                  <Zap size={13} /> Upgrade to Pro
                </button>
              )}
              <button
                onClick={() =>
                  setConfirmDialog(planPaused ? "resume" : "pause")
                }
                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${planPaused ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"}`}
              >
                {planPaused ? (
                  <>
                    <Play size={13} /> Resume
                  </>
                ) : (
                  <>
                    <Pause size={13} /> Pause
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirmDialog("deactivate")}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs font-semibold hover:opacity-80 transition-all"
              >
                <XCircle size={13} /> Deactivate
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <div
              className="relative w-[90px] h-[90px] shrink-0"
              style={{ overflow: "visible" }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Admin", value: 1 },
                      { name: "Teachers", value: inst.teacherCount ?? 0 },
                      { name: "Students", value: inst.studentCount ?? 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={42}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    paddingAngle={3}
                    minAngle={8}
                  >
                    <Cell fill="#7C3AED" />
                    <Cell fill="#F59E0B" />
                    <Cell fill="#10B981" />
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    position={{ x: 95, y: 0 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-sm font-black leading-none">{activeUsers}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Total</p>
              </div>
            </div><div className="space-y-2 shrink-0">
              {[
                {
                  label: "Admin",
                  value: 1,
                  color: "text-violet-600 dark:text-violet-400",
                  dot: "bg-violet-500",
                },
                {
                  label: "Teachers",
                  value: inst.teacherCount ?? 0,
                  color: "text-amber-600 dark:text-amber-400",
                  dot: "bg-amber-500",
                },
                {
                  label: "Students",
                  value: inst.studentCount ?? 0,
                  color: "text-emerald-600 dark:text-emerald-400",
                  dot: "bg-emerald-500",
                },
              ].map(({ label, value, color, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div>
                    <p className={`text-sm font-black leading-none ${color}`}>
                      {value}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Billing Summary */}
        <SectionCard title="Billing Summary">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <InfoBox
                label="Active Users"
                value={String(activeUsers)}
                sub="billed this month"
              />
              <InfoBox
                label="Current Rate"
                value={fmt(currentRate)}
                sub="per user / month"
              />
              <InfoBox
                label="Next Bill"
                value={fmt(monthlyBill + addonBill)}
                sub={nextMonth.toLocaleDateString("en-IN")}
                highlight
              />
            </div>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Pricing Tiers
                </p>
              </div>
              <div className="divide-y divide-border/30">
                {tierBreakdown.map((tier, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 ${tier.isActive ? "bg-[#DA7756]/5" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {tier.isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756]" />
                      )}
                      <span
                        className={`text-xs ${tier.isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {tier.label}
                      </span>
                      {tier.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#DA7756]/15 text-[#DA7756] font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold ${tier.isActive ? "text-[#DA7756]" : "text-muted-foreground"}`}
                    >
                      {fmt(tier.rate)}/user
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200/50 dark:border-violet-900/50">
              <p className="text-[11px] text-violet-600 dark:text-violet-400">
                💡 Minimum 200 users billed per month. Current active:{" "}
                {activeUsers} users — billed as {billedUsers} users.{" "}
                {fmt(monthlyBill)} est. next bill.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Add-Ons */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Sparkles size={15} />
              Add-Ons
              {addonBill > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  +{fmt(addonBill)} this month
                </span>
              )}
            </span>
          }
        >
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} className="text-muted-foreground" />
                  <p className="text-xs font-semibold">Storage</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {storageUsed}GB / {storageBase}GB used
                </span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${storageUsedPct}%`,
                    background:
                      storageUsedPct > 85
                        ? "#ef4444"
                        : storageUsedPct > 70
                          ? "#f59e0b"
                          : "#7C3AED",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{storageUsedPct}% used</span>
                <span>{storageBase - storageUsed}GB remaining</span>
              </div>
              <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold">Add Storage</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={10}
                    value={storageAddGb}
                    onChange={(e) => {
                      setStorageAddGb(Number(e.target.value));
                      setStorageAddInput(e.target.value);
                    }}
                    className="flex-1 accent-[#7C3AED] h-1.5 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={storageAddInput}
                      onChange={(e) => {
                        setStorageAddInput(e.target.value);
                        setStorageAddGb(
                          Math.max(0, Number(e.target.value) || 0),
                        );
                      }}
                      className="w-16 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">GB</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Rate ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={storagePricePerGb}
                    onChange={(e) =>
                      setStoragePricePerGb(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Enter rate"
                    className="w-28 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">/ GB</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <InfoBox
                    label="Add"
                    value={`${storageAddGb} GB`}
                    sub="one-time"
                  />
                  <InfoBox
                    label="Rate"
                    value={
                      storagePricePerGb !== ""
                        ? `₹${storagePricePerGb}/GB`
                        : "—"
                    }
                    sub="per GB"
                  />
                  <InfoBox
                    label="This Month"
                    value={
                      storagePricePerGb !== "" ? fmt(storageAddTotal) : "—"
                    }
                    highlight
                  />
                </div>
                <button
                  disabled={
                    storageAddGb === 0 ||
                    storagePricePerGb === "" ||
                    storageAdded
                  }
                  onClick={() => {
                    setStorageAdded(true);
                    toast.success(
                      `${storageAddGb}GB storage added — added to this month's bill`,
                    );
                  }}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                  }}
                >
                  {storageAdded
                    ? "✅ Storage Added to Bill"
                    : "Add Storage to This Month's Bill"}
                </button>
              </div>
            </div>
            <div className="h-px bg-border/50" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-muted-foreground" />
                  <p className="text-xs font-semibold">AI Tokens</p>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    Monthly limit
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {(tokenUsed / 1000000).toFixed(1)}M /{" "}
                  {(tokenBase / 1000000).toFixed(0)}M used
                </span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${tokenUsedPct}%`,
                    background:
                      tokenUsedPct > 85
                        ? "#ef4444"
                        : tokenUsedPct > 70
                          ? "#f59e0b"
                          : "#DA7756",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{tokenUsedPct}% used this month</span>
                <span>
                  {((tokenBase - tokenUsed) / 1000000).toFixed(1)}M remaining
                </span>
              </div>
              <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold">Add AI Tokens</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={tokenAddK}
                    onChange={(e) => {
                      setTokenAddK(Number(e.target.value));
                      setTokenAddInput(e.target.value);
                    }}
                    className="flex-1 accent-[#DA7756] h-1.5 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tokenAddInput}
                      onChange={(e) => {
                        setTokenAddInput(e.target.value);
                        setTokenAddK(Math.max(0, Number(e.target.value) || 0));
                      }}
                      className="w-16 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">×1M</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Rate ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={tokenPricePer10k}
                    onChange={(e) =>
                      setTokenPricePer10k(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Enter rate"
                    className="w-28 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    / 1M tokens
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <InfoBox
                    label="Add"
                    value={`${tokenAddK}M tokens`}
                    sub="this month"
                  />
                  <InfoBox
                    label="Rate"
                    value={
                      tokenPricePer10k !== "" ? `₹${tokenPricePer10k}/1M` : "—"
                    }
                    sub="per 1M tokens"
                  />
                  <InfoBox
                    label="This Month"
                    value={tokenPricePer10k !== "" ? fmt(tokenAddTotal) : "—"}
                    highlight
                  />
                </div>
                <button
                  disabled={
                    tokenAddK === 0 || tokenPricePer10k === "" || tokenAdded
                  }
                  onClick={() => {
                    setTokenAdded(true);
                    toast.success(
                      `${tokenAddK}M tokens added — added to this month's bill`,
                    );
                  }}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                  }}
                >
                  {tokenAdded
                    ? "✅ Tokens Added to Bill"
                    : "Add Tokens to This Month's Bill"}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Bill Modal */}
        {billModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                <div>
                  <h3 className="text-base font-bold">
                    Invoice — {billModal.month}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {billModal.dateRange}
                  </p>
                </div>
                <button
                  onClick={() => setBillModal(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-6 space-y-4" id="bill-print-area">
                {/* Institution info */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold">{inst.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {inst.type} · {instType}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {inst.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Plan</p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: plan === "PRO" ? "#DA7756" : "#7C3AED" }}
                    >
                      {plan}
                    </p>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${billModal.status === "PAID" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"}`}
                    >
                      {billModal.status}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Line items */}
                {billModal.items.length > 0 ? (
                  <div className="space-y-2">
                    {billModal.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.desc}
                          </p>
                        </div>
                        <p className="text-xs font-bold">{fmt(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Monthly Bill
                    </p>
                    <p className="text-xs font-bold">{fmt(billModal.total)}</p>
                  </div>
                )}

                <div className="h-px bg-border/50" />

                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Total Amount</p>
                  <p
                    className="text-lg font-black"
                    style={{ color: "#DA7756" }}
                  >
                    {fmt(billModal.total)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                <button
                  onClick={() => setBillModal(null)}
                  className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      toast.success(
                        `Bill resent to admin for ${billModal.month}`,
                      );
                    }}
                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                  >
                    Resend to Admin
                  </button>
                  <button
                    onClick={() => {
                      // TODO: backend PDF endpoint
                      window.print();
                    }}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                    }}
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Payment History */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <FileText size={15} /> Bills & Payments
            </span>
          }
        >
          <div className="space-y-4">
            {/* Current Month */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Current Month
                <span className="text-[10px] font-normal normal-case ml-2 text-violet-600 dark:text-violet-400">
                  {now.toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · Generates{" "}
                  {monthEnd.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                <span>📅 {currentMonthDateRange}</span>
                <span className="font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  Generates on{" "}
                  {monthEnd.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Bill Breakdown
                  </p>
                </div>
                <div className="divide-y divide-border/30">
                  {currentMonthItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.type === "addon" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            Add-On
                          </span>
                        )}
                        <span className="text-xs font-bold">
                          {fmt(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 border-t border-border/50">
                  <p className="text-xs font-bold">Total</p>
                  <p
                    className="text-sm font-black"
                    style={{ color: "#DA7756" }}
                  >
                    {fmt(currentMonthTotal)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-muted-foreground">
                  💡 Bill will be sent to admin dashboard on{" "}
                  {new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    1,
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <button
                  onClick={() =>
                    setBillModal({
                      id: "current",
                      type: "MONTHLY" as const,
                      month: now.toLocaleDateString("en-IN", {
                        month: "long",
                        year: "numeric",
                      }),
                      dateRange: currentMonthDateRange,
                      items: currentMonthItems,
                      total: currentMonthTotal,
                      status: "PENDING" as const,
                      generatedOn: monthEnd.toLocaleDateString("en-IN"),
                    })
                  }
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all"
                >
                  <FileText size={11} /> View Bill
                </button>
              </div>
            </div>
            <div className="h-px bg-border/50" />

            {/* Bill History */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Bill History
              </p>
              <div className="divide-y divide-border/40 max-h-[300px] overflow-y-auto">
                {allBills.map((bill, idx) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{bill.month}</p>
                        {bill.type === "LICENCE" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                            Licence
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {bill.dateRange}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{fmt(bill.total)}</p>
                      {/* Status toggle */}
                      <button
                        onClick={() => {
                          const updated = allBills.map((b) =>
                            b.id === bill.id
                              ? {
                                  ...b,
                                  status:
                                    b.status === "PAID"
                                      ? ("PENDING" as const)
                                      : ("PAID" as const),
                                }
                              : b,
                          );
                          setBills(updated);
                          toast.success(
                            `Bill marked as ${bill.status === "PAID" ? "Pending" : "Paid"}`,
                          );
                        }}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                          bill.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 hover:bg-emerald-200"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 hover:bg-amber-200"
                        }`}
                      >
                        {bill.status}
                      </button>
                      <button
                        onClick={() => setBillModal(bill)}
                        className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all"
                      >
                        View
                      </button>
                      <button
                        onClick={() =>
                          toast.success(
                            `Bill resent to admin for ${bill.month}`,
                          )
                        }
                        className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-white transition-all hover:opacity-90"
                        style={{
                          background:
                            "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                        }}
                      >
                        Resend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Bill Modal */}
        {billModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                <div>
                  <h3 className="text-base font-bold">
                    Invoice — {billModal.month}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {billModal.dateRange}
                  </p>
                </div>
                <button
                  onClick={() => setBillModal(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold">{inst.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {inst.type} · {instType}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {inst.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Plan</p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: plan === "PRO" ? "#DA7756" : "#7C3AED" }}
                    >
                      {plan}
                    </p>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${billModal.status === "PAID" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"}`}
                    >
                      {billModal.status}
                    </span>
                  </div>
                </div>
                <div className="h-px bg-border/50" />
                <div className="space-y-2.5">
                  {billModal.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                      <p className="text-xs font-bold">{fmt(item.amount)}</p>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Total Amount</p>
                  <p
                    className="text-lg font-black"
                    style={{ color: "#DA7756" }}
                  >
                    {fmt(billModal.total)}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Generated: {billModal.generatedOn}
                </p>
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                <button
                  onClick={() => setBillModal(null)}
                  className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      toast.success(
                        `Bill resent to admin for ${billModal.month}`,
                      )
                    }
                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                  >
                    Resend to Admin
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                    }}
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Feature Controls */}
        <SectionCard title="Feature Controls">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Default Features
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
            {defFeatures.map(({ key, label, desc, icon: Icon }) => (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${features[key] ? "border-[#DA7756]/30 bg-[#DA7756]/5" : "border-border/50 bg-muted/20"}`}
              >
                <div className="flex items-center gap-2 min-w-0 mr-3">
                  <Icon size={13} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    Default
                  </span>
                  <Toggle
                    on={features[key] ?? true}
                    onToggle={() =>
                      setFeatures((p) => ({ ...p, [key]: !p[key] }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          {addonFeatures.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Add-On Features
                <span className="text-[10px] text-amber-600 dark:text-amber-400 normal-case font-normal ml-2">
                  Year 1 free · Year 2+ billed monthly if enabled
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {addonFeatures.map(({ key, label, desc, icon: Icon }) => {
                  const featureExpiry =
                    addonExpiries[key] ?? getFeatureExpiry(key);
                  const expired = isExpired(featureExpiry);
                  const days = daysLeft(featureExpiry);
                  const enabled = features[key] ?? false;
                  return (
                    <div
                      key={key}
                      className={`flex items-start justify-between p-3 rounded-xl border transition-all ${expired && !enabled ? "border-red-200/50 bg-red-50/30 dark:bg-red-950/10 opacity-70" : enabled ? "border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-muted/20"}`}
                    >
                      <div className="flex items-start gap-2 min-w-0 mr-3">
                        <Icon
                          size={13}
                          className="text-muted-foreground shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {desc}
                          </p>
                          {expired ? (
                            <p className="text-[10px] text-red-500 font-semibold mt-0.5">
                              ⚠ Expired — ₹10,000/yr to enable
                            </p>
                          ) : (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              Free until{" "}
                              {featureExpiry.toLocaleDateString("en-IN")} (
                              {days}d)
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          Add-On
                        </span>
                        <Toggle
                          on={enabled}
                          onToggle={() => {
                            const newVal = !enabled;
                            if (newVal && expired) {
                              setPendingEnableKey(key);
                              setConfirmDialog("enable_addon");
                            } else {
                              setFeatures((p) => ({ ...p, [key]: newVal }));
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SectionCard>

        {/* ── Confirm Dialog ── */}
        {confirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden max-w-2xl w-full mx-4 shadow-2xl"
            >
              {confirmDialog === "upgrade" ? (
                <>
                  {/* Upgrade modal header */}
                  <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                    <div>
                      <h3 className="text-base font-bold">⚡ Upgrade to PRO</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Review your current plan and what you'll get after
                        upgrading
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-muted/50 p-1 mx-6 mt-4 rounded-xl border border-border/50 w-fit">
                    {[
                      { key: "current" as const, label: "📋 Current (Basic)" },
                      {
                        key: "after" as const,
                        label: "⚡ After Upgrade (PRO)",
                      },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setUpgradeModalTab(tab.key)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${upgradeModalTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                    {upgradeModalTab === "current" ? (
                      <>
                        {/* Plan info */}
                        <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Plan Info
                          </p>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Plan</span>
                            <span className="font-semibold text-primary">
                              BASIC
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Activated
                            </span>
                            <span className="font-medium">14 Nov 2025</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Months used
                            </span>
                            <span className="font-medium">
                              {monthsUsed} months
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Months remaining
                            </span>
                            <span className="font-medium">
                              {monthsRemaining} months
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Monthly rate
                            </span>
                            <span className="font-medium">
                              {fmt(getRate(pricing.BASIC.tiers, activeUsers))}
                              /user
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Storage
                            </span>
                            <span className="font-medium">500GB</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              AI Tokens
                            </span>
                            <span className="font-medium">10M/month</span>
                          </div>
                        </div>

                        {/* Default features */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Default Features (always on)
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {basicDefaults.map((f) => (
                              <div
                                key={f.key}
                                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40"
                              >
                                <f.icon
                                  size={12}
                                  className="text-muted-foreground shrink-0"
                                />
                                <span className="text-[11px] font-medium truncate">
                                  {f.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Add-on features — Basic add-ons with expiry */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Add-On Features
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 normal-case font-normal ml-2">
                              Free until{" "}
                              {basicExpiryDate.toLocaleDateString("en-IN")}
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {basicAddons.map((f) => {
                              const expired = isExpired(basicExpiryDate);
                              const days = daysLeft(basicExpiryDate);
                              return (
                                <div
                                  key={f.key}
                                  className={`flex items-center gap-2 p-2 rounded-lg border ${expired ? "border-red-200/50 bg-red-50/30 dark:bg-red-950/10" : "border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10"}`}
                                >
                                  <f.icon
                                    size={12}
                                    className="text-muted-foreground shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium truncate">
                                      {f.label}
                                    </p>
                                    <p
                                      className={`text-[10px] ${expired ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}
                                    >
                                      {expired
                                        ? "⚠ Expired"
                                        : `${days}d remaining`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Upgrade charge */}
                        <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Upgrade Charge
                          </p>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">PRO upgrade charge</span>
                            <span className="font-bold text-[#DA7756]">{fmt(finalUpgradeCharge)}</span>
                          </div>
                          <div className="h-px bg-border/50 my-1" />
                          <div className="flex justify-between text-xs font-bold">
                            <span>Total due now</span>
                            <span className="text-[#DA7756]">{fmt(finalUpgradeCharge)}</span>
                          </div>
                        </div>
                        {/* Add-on — only smart_board */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Add-On Features
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {ALL_FEATURES.filter(
                              (f) => f.inPro && f.addOnPro,
                            ).map((f) => {
                              const exp = upgradeIsAfter12
                                ? new Date(
                                    new Date().setFullYear(
                                      new Date().getFullYear() + 1,
                                    ),
                                  )
                                : basicExpiryDate;
                              const days = daysLeft(exp);
                              const expired = isExpired(exp);
                              return (
                                <div
                                  key={f.key}
                                  className={`flex items-center gap-2 p-2 rounded-lg border ${expired ? "border-red-200/50 bg-red-50/30 dark:bg-red-950/10" : "border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10"}`}
                                >
                                  <f.icon
                                    size={12}
                                    className="text-muted-foreground shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium truncate">
                                      {f.label}
                                    </p>
                                    <p
                                      className={`text-[10px] ${expired ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}
                                    >
                                      {expired
                                        ? "⚠ Expired"
                                        : `Free until ${exp.toLocaleDateString("en-IN")} (${days}d)`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Feature expiry info */}
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200/50 dark:border-amber-900/50">
                          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">
                            Feature Free Period
                          </p>
                          {!upgradeIsAfter12 ? (
                            <p className="text-[11px] text-amber-600 dark:text-amber-500">
                              All features (Basic + PRO) free until{" "}
                              <span className="font-semibold">
                                {basicExpiryDate.toLocaleDateString("en-IN")}
                              </span>{" "}
                              (original activation + 1 year)
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-600 dark:text-amber-500">
                              Basic add-ons expired. New PRO features free for 1
                              year from upgrade date.
                            </p>
                          )}
                        </div>

                        {/* Payment toggle */}
                        <div
                          className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${upgradePaid ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border/50 bg-card"}`}
                        >
                          <div>
                            <p className="text-xs font-semibold">
                              Upgrade Payment Received
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Mark once upgrade charge of{" "}
                              {fmt(finalUpgradeCharge)} is confirmed
                            </p>
                          </div>
                          <Toggle
                            on={upgradePaid}
                            onToggle={() => setUpgradePaid((v) => !v)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <div className="flex items-center gap-2">
                      {upgradeModalTab === "current" && (
                        <button
                          onClick={() => setUpgradeModalTab("after")}
                          className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: "#7C3AED" }}
                        >
                          See After Upgrade →
                        </button>
                      )}
                      {upgradeModalTab === "after" && (
                        <button
                          disabled={!upgradePaid}
                          onClick={() => {
                            setPlan("PRO");
                            setFeatures(getDefaultFeatures("PRO"));
                            setUpgradeDate(new Date());
                            toast.success("Upgraded to PRO! Features updated.");
                            setConfirmDialog(null);
                            setUpgradePaid(false);
                          }}
                          className="h-9 px-5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background:
                              "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                          }}
                        >
                          Confirm Upgrade — {fmt(finalUpgradeCharge)}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : confirmDialog === "enable_addon" && pendingEnableKey ? (
                <div className="p-6">
                  <h3 className="text-base font-bold mb-2">
                    🔓 Enable Add-On Feature?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">
                      {
                        ALL_FEATURES.find((f) => f.key === pendingEnableKey)
                          ?.label
                      }
                    </span>{" "}
                    ka free period expire ho gaya hai.
                  </p>
                  <div className="bg-muted/40 rounded-xl p-3 mb-4 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Annual charge
                      </span>
                      <span className="font-bold text-[#DA7756]">
                        ₹10,000/year
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">New expiry</span>
                      <span className="font-medium">
                        {new Date(
                          new Date().setFullYear(new Date().getFullYear() + 1),
                        ).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Added to this month's bill
                      </span>
                      <span className="font-bold">₹10,000</span>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setConfirmDialog(null);
                        setPendingEnableKey(null);
                      }}
                      className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!pendingEnableKey) return;
                        setFeatures((p) => ({
                          ...p,
                          [pendingEnableKey]: true,
                        }));
                        const newExpiry = new Date();
                        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
                        setAddonExpiries((p) => ({
                          ...p,
                          [pendingEnableKey]: newExpiry,
                        }));
                        setAddonExtraBill((p) => p + 10000);
                        toast.success(
                          `Feature enabled — ₹10,000 added to this month's bill`,
                        );
                        setConfirmDialog(null);
                        setPendingEnableKey(null);
                      }}
                      className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{
                        background:
                          "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                      }}
                    >
                      Yes, Enable & Add to Bill
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h3 className="text-base font-bold mb-2">
                    {confirmDialog === "deactivate"
                      ? "⚠️ Deactivate Plan?"
                      : confirmDialog === "pause"
                        ? "⏸ Pause Operations?"
                        : "▶️ Resume Operations?"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    {confirmDialog === "deactivate"
                      ? "This will permanently deactivate the plan. Institution will lose access immediately."
                      : confirmDialog === "pause"
                        ? "Institution access will be temporarily suspended. All data will be preserved. You can resume anytime."
                        : "Institution access will be restored immediately."}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (confirmDialog === "deactivate") {
                          setPlanActive(false);
                          toast.success("Plan deactivated");
                        } else if (confirmDialog === "pause") {
                          setPlanPaused(true);
                          toast.success("Operations paused");
                        } else {
                          setPlanPaused(false);
                          toast.success("Operations resumed");
                        }
                        setConfirmDialog(null);
                      }}
                      className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{
                        background:
                          confirmDialog === "deactivate"
                            ? "#ef4444"
                            : confirmDialog === "pause"
                              ? "#f59e0b"
                              : "#10b981",
                      }}
                    >
                      {confirmDialog === "deactivate"
                        ? "Yes, Deactivate"
                        : confirmDialog === "pause"
                          ? "Yes, Pause"
                          : "Yes, Resume"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </motion.div>
    );
  }

  // ── SETUP VIEW ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Plan Not Activated
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
            Configure below and activate to get started.
          </p>
        </div>
      </div>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <LayoutGrid size={15} />
            Select Plan
          </span>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          {(hideTrial ? PLAN_OPTS.filter((p) => p.key !== "TRIAL") : PLAN_OPTS).map((p) => {
            const isActive = plan === p.key;
            const price = p.key !== "TRIAL" ? pricing[p.key] : null;
            return (
              <button
                key={p.key}
                onClick={() => setPlan(p.key)}
                className={`flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all ${isActive ? p.border : "border-border/50 bg-muted/30 hover:border-border"}`}
              >
                <div className="flex items-center justify-between w-full">
                  <p
                    className={`text-sm font-bold ${isActive ? p.activeColor : "text-foreground"}`}
                  >
                    {p.label}
                  </p>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? "border-current" : "border-muted-foreground/40"}`}
                  >
                    {isActive && (
                      <div className={`w-2 h-2 rounded-full ${p.dot}`} />
                    )}
                  </div>
                </div>
                {price ? (
                  <p className="text-xs font-bold">
                    {fmt(price.licence)}{" "}
                    <span className="font-normal text-muted-foreground">
                      one-time
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Free — no charge
                  </p>
                )}
                {p.features.length > 0 && (
                  <div className="space-y-1.5 mt-1 pt-2 border-t border-border/40 w-full">
                    {p.features.map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <Icon
                          size={11}
                          className={`shrink-0 ${label.startsWith("No") ? "text-muted-foreground/50" : isActive ? "text-current" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`text-[11px] ${label.startsWith("No") ? "text-muted-foreground/50" : ""}`}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {plan !== "TRIAL" && (
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <IndianRupee size={15} />
              Monthly Billing
            </span>
          }
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40">
                <p className="text-xs font-semibold">Pricing Tiers — {plan}</p>
              </div>
              <div className="divide-y divide-border/30">
                {planPricing.tiers.map((tier, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-xs text-muted-foreground">
                      {tier.max === Infinity
                        ? `${tier.min}+ users`
                        : `${tier.min}–${tier.max} users`}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      {fmt(tier.rate)}/user/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <InfoBox label="Min. Users" value="200" sub="minimum billed" />
              <InfoBox
                label="Base Rate"
                value={`${fmt(planPricing.tiers[0].rate)}/user`}
                sub="200–1499 users"
              />
              <InfoBox
                label="Min. First Bill"
                value={fmt(200 * planPricing.tiers[0].rate)}
                sub="minimum amount"
                highlight
              />
            </div>
            <p className="text-[11px] text-muted-foreground px-1">
              💡 Min. 200 users billed. Rate drops automatically as your
              institution grows.
            </p>
          </div>
        </SectionCard>
      )}

      {plan !== "TRIAL" && (
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <span
                onDoubleClick={() => setShowDiscount((v) => !v)}
                className="cursor-default select-none"
              >
                <Landmark
                  size={15}
                  className="text-muted-foreground/100 hover:text-muted-foreground/70 transition-colors"
                />
              </span>
              One-time Licence Fee
            </span>
          }
        >
          <div className="bg-muted/40 rounded-xl p-4">
            <p className="text-xs font-semibold">Licence Cost</p>
            <p className="text-xl font-black mt-0.5">{fmt(finalLicence)}</p>
            {showDiscount && (
              <div className="border-t border-border/50 pt-3 mt-3">
                <div className="flex items-center gap-3 mb-1">
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={discount}
                    onChange={(e) => {
                      setDiscount(Number(e.target.value));
                      setDiscountInput(e.target.value);
                    }}
                    className="flex-1 accent-[#DA7756] h-1.5 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={discountInput}
                      onChange={(e) => {
                        setDiscountInput(e.target.value);
                        setDiscount(
                          Math.min(
                            50,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        );
                      }}
                      className="w-14 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-[#DA7756]"
                    />
                    <span className="text-xs text-muted-foreground">% off</span>
                  </div>
                </div>
                {discount > 0 && (
                  <p className="text-[11px] text-[#DA7756] font-medium">
                    Saving {fmt(discountAmt)} · Final: {fmt(finalLicence)}
                  </p>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={15} />
            Feature Controls
          </span>
        }
      >
        {(() => {
          const { defaults: defFeatures, addons: addonFeatures } =
            getPlanFeatures(plan);
          return (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Default Features
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 normal-case font-normal ml-2">
                  Year 1 — all enabled
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
                {defFeatures.map(({ key, label, desc, icon: Icon }) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${features[key] ? "border-[#DA7756]/30 bg-[#DA7756]/5" : "border-border/50 bg-muted/20"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 mr-3">
                      <Icon
                        size={13}
                        className="text-muted-foreground shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {desc}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        Default
                      </span>
                      <Toggle
                        on={features[key] ?? true}
                        onToggle={() =>
                          setFeatures((p) => ({ ...p, [key]: !p[key] }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              {addonFeatures.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Add-On Features
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 normal-case font-normal ml-2">
                      (Year 2 onwards — billed separately)
                    </span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {addonFeatures.map(({ key, label, desc, icon: Icon }) => (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${features[key] ? "border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-muted/20"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 mr-3">
                          <Icon
                            size={13}
                            className="text-muted-foreground shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {label}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {desc}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            Add-On
                          </span>
                          <Toggle
                            on={features[key] ?? false}
                            onToggle={() =>
                              setFeatures((p) => ({ ...p, [key]: !p[key] }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </SectionCard>

      <div
        className={`p-5 rounded-2xl border-2 transition-all mb-6 ${canActivate ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border/50 bg-muted/20"}`}
      >
        {plan !== "TRIAL" && (
          <div className="mb-4">
            <div
              className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${licencePaid ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border/50 bg-card"}`}
            >
              <div>
                <p className="text-xs font-semibold">
                  Licence Payment Received
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Mark once one-time licence payment confirmed
                </p>
              </div>
              <Toggle
                on={licencePaid}
                onToggle={() => setLicencePaid((v) => !v)}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">
              {canActivate
                ? "✅ Ready to Activate"
                : "⏳ Complete steps to activate"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {!licencePaid && plan !== "TRIAL"
                ? "Mark licence payment as received"
                : canActivate
                  ? `${plan} · Monthly billing · ${fmt(currentRate)}/user`
                  : ""}
            </p>
          </div>
          <button
            onClick={handleActivate}
            disabled={!canActivate || activating}
            className="flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canActivate
                ? "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)"
                : "hsl(var(--muted))",
            }}
          >
            {activating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{" "}
                Activating...
              </>
            ) : (
              <>
                <Zap size={15} /> Activate Plan
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function InstitutionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [institution, setInstitution] = useState<InstData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "plan">("details");
  const [showPlanSelection, setShowPlanSelection] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "plan") setActiveTab("plan");
    }
  }, []);

  const fetchInstitution = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get(`/superadmin/institutions/${id}`);
      const data: InstData = res.data.data;
      const admin = data.users?.find((u) => u.role === "ADMIN") ?? null;
      const teacherCount =
        data.users?.filter((u) => u.role === "TEACHER").length ?? 0;
      const studentCount =
        data.users?.filter((u) => u.role === "STUDENT").length ?? 0;
      setInstitution({ ...data, admin, teacherCount, studentCount });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInstitution();
  }, [fetchInstitution]);

  const handleStatusToggle = async () => {
    if (!institution) return;
    const newStatus = institution.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await api.patch(`/superadmin/institutions/${id}/status`, {
        status: newStatus,
      });
      setInstitution((prev) => (prev ? { ...prev, status: newStatus } : prev));
      toast.success(
        `Institution ${newStatus === "ACTIVE" ? "activated" : "suspended"}`,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to update status");
    }
  };

  const handleResendInvite = async () => {
    if (!institution) return;
    const adminEmail =
      institution.admin?.email ??
      institution.users?.find((u) => u.role === "ADMIN")?.email;
    try {
      await api.post(`/superadmin/institutions/${id}/resend-invite`, {
        email: adminEmail,
      });
      toast.success("Invite resent successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to resend invite");
    }
  };

  if (loading)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-xl" />
        <div className="h-40 w-full bg-muted rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 size={40} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Failed to load institution
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-xs text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );

  if (!institution)
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 size={40} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Institution not found
        </p>
      </div>
    );

  const TABS = [
    { key: "details" as const, label: "View Details" },
    { key: "plan" as const, label: "Manage Plan" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{institution.name}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Institutions <ChevronRight size={11} /> {institution.name}
          </p>
        </div>
      </div>
      <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative"
            >
              {isActive && (
                <motion.div
                  layoutId="instDetailTab"
                  className="absolute inset-0 rounded-4xl bg-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <div
                className={`relative z-10 px-5 py-2 text-sm font-medium rounded-4xl transition-colors ${isActive ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </div>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {activeTab === "details" ? (
          <ViewDetailsTab
            key="details"
            inst={institution}
            onStatusToggle={handleStatusToggle}
            onResendInvite={handleResendInvite}
          />
        ) : (() => {
          const isTrialLifecycle =
            institution.subscription?.status === "TRIAL" ||
            institution.subscription?.status === "LOCKED";

          if (isTrialLifecycle && !showPlanSelection) {
            return (
              <TrialManagementSection
                key="trial"
                institutionId={institution.id}
                institutionName={institution.name}
                institutionStatus={institution.status as "PENDING" | "ACTIVE" | "SUSPENDED"}
                subscription={{
                  status: institution.subscription?.status ?? "",
                  endDate: institution.subscription?.endDate ?? null,
                  trialDays: institution.subscription?.trialDays ?? null,
                  trialOutcome: institution.subscription?.trialOutcome ?? null,
                }}
                onRefresh={fetchInstitution}
                onSelectPlan={() => setShowPlanSelection(true)}
              />
            );
          }

          if (isTrialLifecycle && showPlanSelection) {
            return (
              <motion.div
                key="plan-select"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {institution.subscription?.status === "TRIAL" && (
                  <button
                    onClick={() => setShowPlanSelection(false)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft size={14} /> Back to Trial
                  </button>
                )}
                <ManagePlanTab key="plan" inst={institution} hideTrial />
              </motion.div>
            );
          }

          return <ManagePlanTab key="plan" inst={institution} />;
        })()}
      </AnimatePresence>
    </div>
  );
}
