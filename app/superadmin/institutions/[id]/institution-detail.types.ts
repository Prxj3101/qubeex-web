export type BillItem = {
  label: string;
  desc: string;
  amount: number;
  type: "base" | "addon" | "licence" | "discount" | "metadata";
};

export type Bill = {
  id: string;
  type: "LICENCE" | "MONTHLY" | "UPGRADE_PRORATION";
  month: string;
  dateRange: string;
  items: BillItem[];
  total: number;
  status: "PAID" | "PENDING" | "FAILED";
  generatedOn: string;
};

export type ApiBill = {
  id: string;
  type: string;
  billingMonth?: string | null;
  totalAmount: number;
  status: "PAID" | "PENDING" | "FAILED";
  items: unknown;
  generatedAt: string;
  dueDate?: string | null;
};

export type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  prefix?: string | null;
  title?: string | null;
  displayId?: string | null;
};

export type InstData = {
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
  adminAvatarUrl?: string | null;
  establishedOn?: string | null;
  adminPhone?: string | null;
  adminDob?: string | null;
  adminGender?: string | null;
  adminPrefix?: string | null;
  adminTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  users?: AdminUser[];
  admin?: AdminUser | null;
  teacherCount?: number;
  studentCount?: number;
  staffCount?: number;
  subscription?: {
    plan?: { name: string };
    status?: string;
    paymentStatus?: string;
    discount?: number;
    activationDate?: string | null;
    features?: Record<string, boolean>;
    addons?: Record<string, unknown>;
    startDate?: string;
    endDate?: string;
    trialDays?: number | null;
    trialOutcome?: string | null;
    planOption?: string | null;
    commitmentEndDate?: string | null;
  } | null;
};

export type TrialUsage = {
  users: { used: number; limit: number };
  storageGb: { used: number; limit: number };
  aiTokens: { used: number; limit: number };
  daysRemaining: number | null;
  trialEndDate: string | null;
  status: string | null;
};

export type PlanDashboardResponse = {
  userBreakdown: {
    admin: number;
    teachers: number;
    students: number;
    total: number;
  };
  planDetails: {
    planName: string;
    activationDate: string | null;
    nextBillingDate: string | null;
    status: string;
  };
  billingStatus: {
    currentMonthBillId: string;
    amount: number;
    status: "PAID" | "PENDING" | "FAILED";
    dueDate: string | null;
    generatedAt: string;
  } | null;
  addonStatus: Record<string, unknown>;
  usageMeters: {
    aiTokens: { used: number; total: number };
    storageGb: { used: number; total: number };
  };
};
