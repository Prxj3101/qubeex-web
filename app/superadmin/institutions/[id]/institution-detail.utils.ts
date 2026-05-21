import { ALL_FEATURES } from "./institution-detail.constants";
import type { ApiBill, Bill, BillItem } from "./institution-detail.types";

export function toIST(iso?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  });
}

export function mapApiBillToUiBill(bill: ApiBill): Bill {
  const generated = new Date(bill.generatedAt);
  const monthLabel = bill.billingMonth
    ? new Date(`${bill.billingMonth}-01T00:00:00`).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })
    : generated.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  const parsedItems = Array.isArray(bill.items)
    ? bill.items
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          label: String(item.label ?? "Bill Item"),
          desc: String(item.desc ?? ""),
          amount: Number(item.amount ?? 0),
          type: ["base", "addon", "licence", "discount", "metadata"].includes(String(item.type))
            ? (String(item.type) as BillItem["type"])
            : "base",
        }))
    : [];

  return {
    id: bill.id,
    type: bill.type === "LICENCE" || bill.type === "UPGRADE_PRORATION" ? bill.type : "MONTHLY",
    month: monthLabel,
    dateRange: bill.dueDate ? `Due ${toIST(bill.dueDate)}` : toIST(bill.generatedAt),
    items: parsedItems,
    total: bill.totalAmount,
    status: bill.status,
    generatedOn: toIST(bill.generatedAt),
  };
}

export function getRate(
  tiers: readonly { min: number; max: number; rate: number }[],
  users: number,
) {
  return tiers.find((t) => users >= t.min && users <= t.max)?.rate ?? tiers[0].rate;
}

export function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function getDefaultFeatures(plan: "BASIC" | "PRO" | "TRIAL"): Record<string, boolean> {
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

export function getPlanFeatures(plan: "BASIC" | "PRO" | "TRIAL") {
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
