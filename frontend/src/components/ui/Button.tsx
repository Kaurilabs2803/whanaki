import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-95 disabled:bg-[rgba(46,125,50,0.45)] shadow-soft",
  secondary:
    "bg-[rgba(255,255,255,0.72)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] hover:border-[rgba(46,125,50,0.18)]",
  ghost:
    "text-[var(--muted-foreground)] hover:bg-[rgba(255,255,255,0.56)] hover:text-[var(--foreground)]",
  danger:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-95 shadow-soft",
};

const sizes = {
  sm: "text-xs px-3 py-2 rounded-xl gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-xl gap-2",
  lg: "text-sm px-5 py-3 rounded-2xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
