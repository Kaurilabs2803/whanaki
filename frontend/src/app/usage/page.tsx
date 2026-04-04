"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { BarChart2, Zap, Scale, Brain, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui";
import { Spinner } from "@/components/ui";
import { api, type UsageSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const MODEL_LABELS: Record<string, { label: string; icon: React.ReactNode; colour: string }> = {
  "llama3.2:3b":  { label: "Pōtiki (Fast)",      icon: <Zap className="w-3.5 h-3.5" />,   colour: "bg-green-100 text-green-700"  },
  "llama3.1:8b":  { label: "Kahurangi (Balanced)", icon: <Scale className="w-3.5 h-3.5" />, colour: "bg-blue-100 text-blue-700"    },
  "qwen2.5:14b":  { label: "Tūī (Thorough)",      icon: <Brain className="w-3.5 h-3.5" />, colour: "bg-purple-100 text-purple-700" },
};

function UsageBar({ value, max, colour = "bg-[#0f6e56]" }: { value: number; max: number; colour?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const warn = pct >= 80;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={cn("h-2 rounded-full transition-all", warn ? "bg-amber-500" : colour)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
      try { setUsage(await api.usage.summary(token)); }
      catch { /* silent */ } finally { setLoading(false); }
    })();
  }, [getToken]);

  const planLabel = usage ? ({ starter: "Starter", professional: "Professional", enterprise: "Enterprise" }[usage.plan] ?? usage.plan) : "";
  const pctUsed = usage ? Math.round(usage.percentage_used) : 0;
  const remaining = usage?.queries_remaining === -1 ? "Unlimited" : usage?.queries_remaining ?? 0;
  const limitLabel = usage?.queries_included === -1 ? "Unlimited" : usage?.queries_included ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Usage"
        description={`${new Date().toLocaleString("en-NZ", { month: "long", year: "numeric" })} · ${planLabel} plan`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <Spinner className="py-20" />
        ) : !usage ? (
          <p className="text-gray-400 text-sm text-center py-20">Could not load usage data.</p>
        ) : (
          <div className="max-w-2xl space-y-6">

            {/* Query quota */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">Monthly queries</p>
                <span className={cn("text-sm font-semibold", pctUsed >= 80 ? "text-amber-600" : "text-gray-900")}>
                  {usage.query_count} / {limitLabel === "Unlimited" ? "∞" : limitLabel}
                </span>
              </div>
              <UsageBar value={usage.query_count} max={usage.queries_included === -1 ? usage.query_count : usage.queries_included} />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-400">{pctUsed}% used</p>
                <p className="text-xs text-gray-400">
                  {remaining === "Unlimited" ? "Unlimited remaining" : `${remaining} remaining`}
                </p>
              </div>
              {pctUsed >= 80 && pctUsed < 100 && (
                <p className="mt-2 text-xs text-amber-600 font-medium">
                  ⚠ Approaching your monthly limit. Consider upgrading your plan.
                </p>
              )}
              {pctUsed >= 100 && (
                <p className="mt-2 text-xs text-red-600 font-medium">
                  Monthly limit reached. Additional queries are paused until next month.
                </p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Queries this month" value={usage.query_count} />
              <StatCard label="Total tokens in"  value={usage.total_input_tokens.toLocaleString()} sub="prompt tokens" />
              <StatCard label="Total tokens out" value={usage.total_output_tokens.toLocaleString()} sub="generated tokens" />
            </div>

            {/* Model breakdown */}
            {Object.keys(usage.model_breakdown).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-700 mb-4">Queries by model</p>
                <div className="space-y-3">
                  {Object.entries(usage.model_breakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([model, count]) => {
                      const cfg = MODEL_LABELS[model] ?? { label: model, icon: <BarChart2 className="w-3.5 h-3.5" />, colour: "bg-gray-100 text-gray-600" };
                      const pct = usage.query_count > 0 ? Math.round((count / usage.query_count) * 100) : 0;
                      return (
                        <div key={model}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md", cfg.colour)}>
                              {cfg.icon}{cfg.label}
                            </span>
                            <span className="text-sm text-gray-600">{count} queries <span className="text-gray-400">({pct}%)</span></span>
                          </div>
                          <UsageBar value={count} max={usage.query_count} />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Upgrade CTA */}
            {usage.plan !== "enterprise" && (
              <div className="bg-gray-900 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium mb-0.5">Need more queries?</p>
                  <p className="text-gray-400 text-sm">Upgrade to Professional for 1,000/mo or Enterprise for unlimited.</p>
                </div>
                <a href="/billing" className="shrink-0 bg-[#0f6e56] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#0a5441] transition-colors flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />Upgrade
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
