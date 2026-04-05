"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, CreditCard, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Alert } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    period: "/mo NZD",
    queries: "200 queries / month",
    pages: "500 document pages",
    features: ["3 AI models", "Citation panel", "Email support"],
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: "$299",
    period: "/mo NZD",
    queries: "1,000 queries / month",
    pages: "2,000 document pages",
    features: ["3 AI models", "Citation panel", "Priority support", "Usage analytics"],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$799",
    period: "/mo NZD",
    queries: "Unlimited queries",
    pages: "Unlimited document pages",
    features: ["All models incl. Tui", "Citation panel", "Dedicated support", "SLA", "Custom branding"],
    highlight: false,
  },
] as const;

export default function BillingPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/backend/billing/checkout?plan=${planId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "Failed");
      }
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch (e: any) {
      setError(e.message);
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/backend/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "Failed");
      }
      const { portal_url } = await res.json();
      window.location.href = portal_url;
    } catch (e: any) {
      setError(e.message);
      setPortalLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Choose the plan shape that matches your document volume, query cadence, and team maturity."
        action={<Button variant="secondary" icon={<CreditCard className="h-4 w-4" />} loading={portalLoading} onClick={handlePortal}>Manage billing</Button>}
      />

      <div className="flex-1 overflow-y-auto p-8">
        {error && <Alert variant="error" onDismiss={() => setError("")} className="mb-5">{error}</Alert>}

        <div className="grid max-w-6xl gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.id} className={cn("rounded-[2rem] border p-7", plan.highlight ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-soft" : "surface-card")}>
              <p className={cn("text-xs uppercase tracking-[0.24em]", plan.highlight ? "text-[rgba(255,255,255,0.72)]" : "text-[var(--muted-foreground)]")}>{plan.name}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className={cn("mb-1 text-sm", plan.highlight ? "text-[rgba(255,255,255,0.72)]" : "text-[var(--muted-foreground)]")}>{plan.period}</span>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold">{plan.queries}</p>
                <p className={cn("text-sm", plan.highlight ? "text-[rgba(255,255,255,0.78)]" : "text-[var(--muted-foreground)]")}>{plan.pages}</p>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className={cn("h-4 w-4 shrink-0", plan.highlight ? "text-[rgba(255,255,255,0.85)]" : "text-[var(--primary)]")} />
                    <span className={cn("text-sm", plan.highlight ? "text-[rgba(255,255,255,0.86)]" : "text-[var(--foreground)]")}>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlight ? "secondary" : "primary"}
                loading={loading === plan.id}
                onClick={() => handleUpgrade(plan.id)}
                className="mt-8 w-full justify-center"
              >
                {plan.highlight ? <><Zap className="h-3.5 w-3.5" />Upgrade to {plan.name}</> : `Choose ${plan.name}`}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-8 max-w-3xl space-y-4">
          {[
            { q: "What counts as a query?", a: "Each message you send in a conversation counts as one query, regardless of the model or document volume involved." },
            { q: "What happens if I hit the limit?", a: "Queries pause until the next calendar month unless you move to a higher plan." },
            { q: "Can I cancel at any time?", a: "Yes. Billing is managed through the Stripe portal and your access continues until the end of the current period." },
          ].map(({ q, a }) => (
            <div key={q} className="surface-card rounded-[1.5rem] p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">{q}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
