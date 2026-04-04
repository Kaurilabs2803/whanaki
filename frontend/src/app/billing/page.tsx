"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, CreditCard, Zap, ExternalLink } from "lucide-react";
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
    features: ["All models incl. Tūī", "Citation panel", "Dedicated support", "SLA", "Custom branding"],
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? "Failed"); }
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? "Failed"); }
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
        description="All plans include a 14-day free trial. NZD pricing."
        action={
          <Button variant="secondary" icon={<CreditCard className="w-4 h-4" />} loading={portalLoading} onClick={handlePortal}>
            Manage billing
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && <Alert variant="error" onDismiss={() => setError("")} className="mb-5">{error}</Alert>}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "rounded-2xl border p-6 flex flex-col",
                plan.highlight
                  ? "bg-gray-900 border-gray-800 text-white"
                  : "bg-white border-gray-200"
              )}
            >
              <div className="mb-4">
                <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2", plan.highlight ? "text-[#9fe1cb]" : "text-[#0f6e56]")}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1">
                  <span className={cn("text-3xl font-bold", plan.highlight ? "text-white" : "text-gray-900")}>{plan.price}</span>
                  <span className={cn("text-sm mb-0.5", plan.highlight ? "text-gray-400" : "text-gray-400")}>{plan.period}</span>
                </div>
              </div>

              <div className="space-y-1.5 mb-5">
                <p className={cn("text-sm font-medium", plan.highlight ? "text-white" : "text-gray-900")}>{plan.queries}</p>
                <p className={cn("text-sm", plan.highlight ? "text-gray-400" : "text-gray-500")}>{plan.pages}</p>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className={cn("w-3.5 h-3.5 shrink-0", plan.highlight ? "text-[#9fe1cb]" : "text-[#0f6e56]")} />
                    <span className={cn("text-sm", plan.highlight ? "text-gray-300" : "text-gray-600")}>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlight ? "primary" : "secondary"}
                loading={loading === plan.id}
                onClick={() => handleUpgrade(plan.id)}
                className="w-full justify-center"
              >
                {plan.highlight ? <><Zap className="w-3.5 h-3.5" />Upgrade to {plan.name}</> : `Choose ${plan.name}`}
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-xl space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Common questions</h3>
          {[
            { q: "What counts as a query?", a: "Each message you send in a conversation counts as one query, regardless of document length or model used." },
            { q: "What happens if I hit my limit?", a: "Queries are paused until the next calendar month. You'll see a warning at 80% usage." },
            { q: "Can I cancel anytime?", a: "Yes. Cancel from the billing portal and you keep access until the end of your current period." },
            { q: "Where is my data stored?", a: "All data is stored and processed in DigitalOcean's Sydney region. Nothing leaves New Zealand." },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900 mb-1">{q}</p>
              <p className="text-sm text-gray-500">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
