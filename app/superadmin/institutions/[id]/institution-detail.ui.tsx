import { X, Check, ArrowUpRight } from "lucide-react";

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
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

export function InfoBox({
  label,
  value,
  sub,
  highlight,
  onAction,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  onAction?: () => void;
}) {
  return (
    <div
      className={`relative rounded-xl p-3 ${highlight ? "bg-[#DA7756]/10 border border-[#DA7756]/20" : "bg-muted/40"}`}
    >
      {onAction && (
        <button
          onClick={onAction}
          className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-sm hover:scale-105 active:scale-95 transition-all"
          style={{ background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" }}
          title="View users"
        >
          <ArrowUpRight size={13} />
        </button>
      )}
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${highlight ? "text-[#DA7756]" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function SectionCard({
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
      <div className="px-5 pt-2 pb-5">{children}</div>
    </div>
  );
}

export function InfoRow({
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
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground flex-1">{value}</span>
    </div>
  );
}

export function EditableField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal"
      />
    </div>
  );
}

export function InlineEditActions({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex gap-1.5">
      <button
        onClick={onCancel}
        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all"
      >
        <X size={11} /> Cancel
      </button>
      <button
        onClick={onSave}
        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all"
        style={{ background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" }}
      >
        <Check size={11} /> Save
      </button>
    </div>
  );
}
