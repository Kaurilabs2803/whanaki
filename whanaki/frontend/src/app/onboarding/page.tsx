"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your workspace</h1>
          <p className="text-gray-500 text-sm">This takes 30 seconds. You can change everything later.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Smith"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#0f6e56] focus:ring-1 focus:ring-[#0f6e56]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organisation name</label>
            <input
              type="text"
              value={form.organisation_name}
              onChange={(e) => handleOrgName(e.target.value)}
              placeholder="Smith Legal Ltd"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#0f6e56] focus:ring-1 focus:ring-[#0f6e56]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workspace URL</label>
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden focus-within:border-[#0f6e56] focus-within:ring-1 focus-within:ring-[#0f6e56]">
              <span className="px-3 py-2 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 shrink-0">
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
                className="flex-1 px-3 py-2 text-sm bg-white focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !form.organisation_name || !form.slug || !form.full_name}
            className="w-full bg-[#0f6e56] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#0a5441] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating workspace…" : "Create workspace →"}
          </button>
        </div>
      </div>
    </div>
  );
}
