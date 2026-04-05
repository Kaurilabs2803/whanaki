import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="surface-card w-full max-w-lg rounded-[2rem] p-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[rgba(200,230,201,0.62)] text-[var(--primary)]">
          <CheckCircle className="h-8 w-8" />
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Billing update</p>
        <h1 className="mt-3 text-4xl font-bold text-[var(--foreground)]">Plan updated successfully</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
          Your new workspace allowance is active immediately. You can return to the dashboard and continue working.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-soft transition hover:brightness-95"
        >
          Back to dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
