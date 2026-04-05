import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "error" | "info";
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const badgeVariants = {
  default: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  success: "bg-[rgba(76,175,80,0.14)] text-[var(--primary)]",
  warning: "bg-[rgba(109,76,65,0.14)] text-[var(--foreground)]",
  error: "bg-[rgba(198,40,40,0.12)] text-[var(--destructive)]",
  info: "bg-[rgba(200,230,201,0.82)] text-[var(--accent-foreground)]",
};

export function Badge({ variant = "default", children, className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        badgeVariants[variant],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

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
        "surface-card rounded-[1.5rem]",
        hover && "hover:-translate-y-0.5 hover:border-[rgba(46,125,50,0.18)] transition-all cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[rgba(200,230,201,0.56)] text-[var(--primary)] shadow-soft">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="surface-panel border-b px-8 py-6">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">{title}</h1>
          {description && <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="h-6 w-6 rounded-full border-2 border-[rgba(46,125,50,0.18)] border-t-[var(--primary)] animate-spin" />
    </div>
  );
}

interface AlertProps {
  variant?: "error" | "warning" | "success" | "info";
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const alertVariants = {
  error: "bg-[rgba(198,40,40,0.08)] border-[rgba(198,40,40,0.18)] text-[var(--destructive)]",
  warning: "bg-[rgba(109,76,65,0.1)] border-[rgba(109,76,65,0.16)] text-[var(--foreground)]",
  success: "bg-[rgba(76,175,80,0.12)] border-[rgba(76,175,80,0.18)] text-[var(--primary)]",
  info: "bg-[rgba(200,230,201,0.46)] border-[rgba(46,125,50,0.16)] text-[var(--accent-foreground)]",
};

export function Alert({ variant = "error", children, className, onDismiss }: AlertProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[1.25rem] border px-4 py-3 text-sm shadow-soft",
        alertVariants[variant],
        className
      )}
    >
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-lg leading-none opacity-60 hover:opacity-100">
          x
        </button>
      )}
    </div>
  );
}
