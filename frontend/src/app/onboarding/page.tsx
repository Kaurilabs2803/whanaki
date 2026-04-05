"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Shield } from "lucide-react";

export default function OnboardingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    organisation_name: "",
    slug: "",
    full_name: "",
  });

  const handleOrgName = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);
    setForm((f) => ({ ...f, organisation_name: val, slug }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/backend/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Onboarding failed");
      }

      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card rounded-[2rem] p-8 lg:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-soft">
            <Shield className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Workspace setup</p>
          <h1 className="mt-3 text-4xl font-bold text-[var(--foreground)]">Create the first room for your knowledge base.</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
            This establishes the workspace identity that sits behind documents, citations, and team access. You can refine the details later in settings.
          </p>
          <div className="mt-8 rounded-[1.5rem] bg-[rgba(200,230,201,0.55)] p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-foreground)]">What happens next</p>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
              We create the workspace, prepare its knowledge base, and bring you straight into the dashboard.
            </p>
          </div>
        </div>

        <div className="surface-card rounded-[2rem] p-8 lg:p-10">
          <div className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Your name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Jane Smith"
                className="mt-2 w-full rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[rgba(46,125,50,0.24)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Organisation name</label>
              <input
                type="text"
                value={form.organisation_name}
                onChange={(e) => handleOrgName(e.target.value)}
                placeholder="Smith Legal Ltd"
                className="mt-2 w-full rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[rgba(46,125,50,0.24)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Workspace URL</label>
              <div className="mt-2 flex items-center overflow-hidden rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.72)]">
                <span className="shrink-0 border-r border-[var(--border)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                  whanaki.kaurilabs.kiwi/
                </span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  placeholder="smith-legal"
                  className="flex-1 bg-transparent px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-[1rem] border border-[rgba(198,40,40,0.18)] bg-[rgba(198,40,40,0.08)] px-4 py-3 text-sm text-[var(--destructive)]">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !form.organisation_name || !form.slug || !form.full_name}
              className="w-full rounded-full bg-[var(--primary)] py-3.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Creating workspace..." : "Create workspace"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
