import { cn } from "@/lib/utils";

// ── Badge ──────────────────────────────────────────────────────────────────────

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "error" | "info";
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const badgeVariants = {
  default: "bg-gray-100 text-gray-600",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  error:   "bg-red-50 text-red-600",
  info:    "bg-blue-50 text-blue-600",
};

export function Badge({ variant = "default", children, className, icon }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md",
      badgeVariants[variant],
      className
    )}>
      {icon}
      {children}
    </span>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className, onClick, hover }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border border-gray-200",
        hover && "hover:border-[#9fe1cb] transition-colors cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-300">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-5">{description}</p>
      {action}
    </div>
  );
}

// ── PageHeader ─────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 bg-white">
      <div>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#0f6e56] rounded-full animate-spin" />
    </div>
  );
}

// ── Alert ──────────────────────────────────────────────────────────────────────

interface AlertProps {
  variant?: "error" | "warning" | "success" | "info";
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const alertVariants = {
  error:   "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  success: "bg-green-50 border-green-200 text-green-700",
  info:    "bg-blue-50 border-blue-200 text-blue-700",
};

export function Alert({ variant = "error", children, className, onDismiss }: AlertProps) {
  return (
    <div className={cn(
      "flex items-start gap-2 border rounded-xl px-4 py-3 text-sm",
      alertVariants[variant],
      className
    )}>
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 text-lg leading-none mt-[-1px]">×</button>
      )}
    </div>
  );
}
