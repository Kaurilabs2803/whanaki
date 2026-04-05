"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { BarChart2, Zap, Scale, Brain, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Spinner } from "@/components/ui";
import { api, type UsageSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const MODEL_LABELS: Record<string, { label: string; icon: React.ReactNode; colour: string }> = {
  "llama3.2:3b": { label: "Potiki", icon: <Zap className="h-3.5 w-3.5" />, colour: "bg-[rgba(200,230,201,0.72)] text-[var(--primary)]" },
  "llama3.1:8b": { label: "Kahurangi", icon: <Scale className="h-3.5 w-3.5" />, colour: "bg-[rgba(240,233,224,0.95)] text-[var(--foreground)]" },
  "qwen2.5:14b": { label: "Tui", icon: <Brain className="h-3.5 w-3.5" />, colour: "bg-[var(--primary)] text-[var(--primary-foreground)]" },
};

function UsageBar({ value, max, colour = "bg-[var(--primary)]" }: { value: number; max: number; colour?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const warn = pct >= 80;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
      <div className={cn("h-2.5 rounded-full transition-all", warn ? "bg-[var(--destructive)]" : colour)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="surface-card rounded-[1.6rem] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">{value.toLocaleString()}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}

export default function UsagePage() {
  const { getToken } = useAuth();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        setUsage(await api.usage.summary(token));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const planLabel = usage ? ({ starter: "Starter", professional: "Professional", enterprise: "Enterprise" }[usage.plan] ?? usage.plan) : "";
  const pctUsed = usage ? Math.round(usage.percentage_used) : 0;
  const remaining = usage?.queries_remaining === -1 ? "Unlimited" : usage?.queries_remaining ?? 0;
  const limitLabel = usage?.queries_included === -1 ? "Unlimited" : usage?.queries_included ?? 0;

  return (
    <AppShell>
      <PageHeader title="Usage" description={`${new Date().toLocaleString("en-NZ", { month: "long", year: "numeric" })} / ${planLabel} plan`} />

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <Spinner className="py-20" />
        ) : !usage ? (
          <p className="py-20 text-center text-sm text-[var(--muted-foreground)]">Could not load usage data.</p>
        ) : (
          <div className="max-w-5xl space-y-6">
            <div className="surface-card rounded-[1.8rem] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Monthly queries</p>
                  <p className="mt-2 text-4xl font-bold text-[var(--foreground)]">{usage.query_count} / {limitLabel}</p>
                </div>
                <div className={cn("rounded-full px-4 py-2 text-sm font-semibold", pctUsed >= 80 ? "bg-[rgba(198,40,40,0.1)] text-[var(--destructive)]" : "bg-[rgba(200,230,201,0.7)] text-[var(--accent-foreground)]")}>
                  {pctUsed}% used
                </div>
              </div>
              <div className="mt-5">
                <UsageBar value={usage.query_count} max={usage.queries_included === -1 ? usage.query_count : usage.queries_included} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <p>{remaining === "Unlimited" ? "Unlimited remaining" : `${remaining} remaining`}</p>
                <p>{usage.plan !== "enterprise" ? "Upgrade anytime from billing" : "Unlimited workspace"}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <StatCard label="Queries this month" value={usage.query_count} />
              <StatCard label="Input tokens" value={usage.total_input_tokens.toLocaleString()} sub="Prompt side total" />
              <StatCard label="Output tokens" value={usage.total_output_tokens.toLocaleString()} sub="Generated text total" />
            </div>

            {Object.keys(usage.model_breakdown).length > 0 && (
              <div className="surface-card rounded-[1.8rem] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Model distribution</p>
                <div className="mt-5 space-y-4">
                  {Object.entries(usage.model_breakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([model, count]) => {
                      const cfg = MODEL_LABELS[model] ?? { label: model, icon: <BarChart2 className="h-3.5 w-3.5" />, colour: "bg-[var(--muted)] text-[var(--foreground)]" };
                      const pct = usage.query_count > 0 ? Math.round((count / usage.query_count) * 100) : 0;
                      return (
                        <div key={model}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", cfg.colour)}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                            <span className="text-sm text-[var(--muted-foreground)]">{count} queries ({pct}%)</span>
                          </div>
                          <UsageBar value={count} max={usage.query_count} colour="bg-[var(--chart-2)]" />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {usage.plan !== "enterprise" && (
              <div className="rounded-[1.8rem] bg-[var(--primary)] p-6 text-[var(--primary-foreground)] shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgba(255,255,255,0.72)]">Growth path</p>
                    <p className="mt-2 text-2xl font-bold">Need a wider monthly allowance?</p>
                    <p className="mt-2 text-sm leading-7 text-[rgba(255,255,255,0.8)]">
                      Move to Professional for a larger working range or Enterprise for uncapped query volume.
                    </p>
                  </div>
                  <a href="/billing" className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.16)] px-5 py-3 text-sm font-semibold transition hover:bg-[rgba(255,255,255,0.24)]">
                    <TrendingUp className="h-4 w-4" />
                    Upgrade
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
