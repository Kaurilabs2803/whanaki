"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Settings, Users, Cpu, AlertTriangle, Save, Loader2, Check, Shield } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Alert, Badge } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { api, type ModelOption, type Member, type TenantInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Tab shell ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "workspace",  label: "Workspace",    icon: Settings },
  { id: "models",     label: "AI models",    icon: Cpu      },
  { id: "team",       label: "Team",         icon: Users    },
  { id: "danger",     label: "Danger zone",  icon: AlertTriangle },
] as const;

type Tab = typeof TABS[number]["id"];

// ── Workspace tab ──────────────────────────────────────────────────────────────

function WorkspaceTab({ tenant, onTenantUpdate }: { tenant: TenantInfo | null; onTenantUpdate: (t: TenantInfo) => void }) {
  const { getToken } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [primaryColour, setPrimaryColour] = useState("#0f6e56");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from tenant when data loads
  useEffect(() => {
    if (tenant) {
      setOrgName(tenant.name);
      setPrimaryColour(tenant.primary_color);
    }
  }, [tenant]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const updated = await api.tenant.update(token, {
        name: orgName,
        primary_color: primaryColour,
      });
      onTenantUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {error && <Alert variant="warning">{error}</Alert>}

      {/* Org details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Organisation details</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Organisation name</label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Smith Legal Ltd"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0f6e56] focus:ring-1 focus:ring-[#0f6e56]/20 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColour}
                onChange={(e) => setPrimaryColour(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <span className="text-sm text-gray-500 font-mono">{primaryColour}</span>
              <button onClick={() => setPrimaryColour("#0f6e56")} className="text-xs text-gray-400 hover:text-gray-600">Reset to Pounamu</button>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
          <Button loading={saving} onClick={handleSave} icon={saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}>
            {saved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Data sovereignty */}
      <div className="bg-[#e1f5ee] border border-[#9fe1cb] rounded-xl p-4">
        <p className="text-sm font-medium text-[#0f6e56] mb-1 flex items-center gap-1.5">
          <Shield className="w-4 h-4" />Data sovereignty
        </p>
        <p className="text-sm text-[#0a5441]">
          All your documents and conversation history are stored on DigitalOcean Sydney (SYD1). AI processing happens on your dedicated GPU droplet — no data is sent to OpenAI, Anthropic, or any third-party AI provider.
        </p>
      </div>
    </div>
  );
}

// ── Models tab ─────────────────────────────────────────────────────────────────

function ModelsTab() {
  const { getToken } = useAuth();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultModel, setDefaultModel] = useState("llama3.1:8b");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const ms = await api.models.list(token);
        setModels(ms);
        const def = ms.find((m) => m.is_default);
        if (def) setDefaultModel(def.model_id);
      } catch { /* silent */ } finally { setLoading(false); }
    })();
  }, [getToken]);

  const SPEED_COLOUR: Record<string, string> = {
    fast:     "bg-green-50 text-green-700",
    balanced: "bg-blue-50 text-blue-700",
    thorough: "bg-purple-50 text-purple-700",
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {models.map((m) => (
          <div key={m.model_id} className="flex items-start gap-4 p-4">
            <input
              type="radio"
              name="default-model"
              value={m.model_id}
              checked={defaultModel === m.model_id}
              onChange={() => setDefaultModel(m.model_id)}
              className="mt-1 accent-[#0f6e56]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{m.display_name}</span>
                <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", SPEED_COLOUR[m.speed])}>{m.speed}</span>
                {m.parameter_count && <span className="text-[10px] text-gray-400">{m.parameter_count} params</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
            </div>
            {m.is_default && <Badge variant="success">Default</Badge>}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button icon={<Save className="w-4 h-4" />}>Save default model</Button>
      </div>
      <p className="text-xs text-gray-400">
        Users can override this per conversation. The default applies to new conversations only.
      </p>
    </div>
  );
}

// ── Team tab ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; variant: "success" | "info" | "default" }> = {
  tenant_admin: { label: "Admin",  variant: "success" },
  editor:       { label: "Editor", variant: "info"    },
  viewer:       { label: "Viewer", variant: "default" },
};

function TeamTab() {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const users = await api.users.list(token);
      setMembers(users);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await api.users.remove(token, userId);
      setMembers((ms) => ms.filter((m) => m.id !== userId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      {error && <Alert variant="warning">{error}</Alert>}

      {/* Invite — coming soon */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Invite team member</h3>
        <p className="text-xs text-gray-500 mb-3">
          Email invitations are coming in the next release. To add a team member now, ask them to sign up and share your workspace slug with them.
        </p>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <span className="text-xs text-gray-400 italic">Email invitations — coming soon</span>
        </div>
        <div className="mt-3 text-xs text-gray-400 space-y-0.5">
          <p><strong>Viewer</strong> — can chat and read documents</p>
          <p><strong>Editor</strong> — can also upload and delete documents</p>
          <p><strong>Admin</strong> — full access including billing and team management</p>
        </div>
      </div>

      {/* Member list */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {members.map((m) => {
            const roleCfg = ROLE_LABELS[m.role] ?? { label: m.role, variant: "default" as const };
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-gray-500">
                    {(m.full_name ?? m.email).split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.full_name ?? "—"}</p>
                  <p className="text-xs text-gray-400">{m.email}</p>
                </div>
                <Badge variant={roleCfg.variant}>{roleCfg.label}</Badge>
                {m.role !== "tenant_admin" && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    disabled={removing === m.id}
                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {removing === m.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <span className="text-xs text-gray-400 hover:text-red-500">Remove</span>
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Danger zone tab ────────────────────────────────────────────────────────────

function DangerTab({ tenant }: { tenant: TenantInfo | null }) {
  const { getToken, signOut } = useAuth();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState("");
  const [confirmWorkspace, setConfirmWorkspace] = useState("");
  const [deletingDocs, setDeletingDocs] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgSlug = tenant?.slug ?? "my-workspace";

  const handleDeleteAllDocs = async () => {
    setDeletingDocs(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const result = await api.documents.deleteAll(token);
      setConfirmDelete("");
      alert(`Deleted ${result.deleted} document${result.deleted !== 1 ? "s" : ""}${result.failed > 0 ? ` (${result.failed} failed to remove from RAGFlow)` : ""}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete documents");
    } finally {
      setDeletingDocs(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    setDeletingWorkspace(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await api.tenant.delete(token);
      await signOut();
      router.push("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete workspace");
      setDeletingWorkspace(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <Alert variant="warning">
        Actions on this page are irreversible. Proceed with caution.
      </Alert>

      {error && <Alert variant="warning">{error}</Alert>}

      {/* Delete all documents */}
      <div className="bg-white rounded-xl border border-red-200 p-5">
        <h3 className="text-sm font-semibold text-red-700 mb-1">Delete all documents</h3>
        <p className="text-xs text-gray-500 mb-3">
          Permanently removes all documents and their embeddings from your knowledge base. Your conversations are not affected.
        </p>
        <p className="text-xs text-gray-600 mb-2">
          Type <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">delete</code> to confirm:
        </p>
        <div className="flex gap-2">
          <input
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder="delete"
            className="flex-1 px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:border-red-400 transition"
          />
          <Button
            variant="danger"
            loading={deletingDocs}
            disabled={confirmDelete !== "delete"}
            onClick={handleDeleteAllDocs}
          >
            Delete all documents
          </Button>
        </div>
      </div>

      {/* Delete workspace */}
      <div className="bg-white rounded-xl border border-red-200 p-5">
        <h3 className="text-sm font-semibold text-red-700 mb-1">Delete workspace</h3>
        <p className="text-xs text-gray-500 mb-3">
          Permanently deletes your organisation, all documents, all conversations, and cancels your subscription. This cannot be undone.
        </p>
        <p className="text-xs text-gray-600 mb-2">
          Type <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{orgSlug}</code> to confirm:
        </p>
        <div className="flex gap-2">
          <input
            value={confirmWorkspace}
            onChange={(e) => setConfirmWorkspace(e.target.value)}
            placeholder={orgSlug}
            className="flex-1 px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:border-red-400 transition"
          />
          <Button
            variant="danger"
            loading={deletingWorkspace}
            disabled={confirmWorkspace !== orgSlug}
            onClick={handleDeleteWorkspace}
          >
            Delete workspace
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("workspace");
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const t = await api.tenant.get(token);
        setTenant(t);
      } catch { /* ignore — tabs handle their own error states */ }
    })();
  }, [getToken]);

  const tabProps = { tenant, onTenantUpdate: setTenant };

  const TabContent = {
    workspace: () => <WorkspaceTab {...tabProps} />,
    models:    () => <ModelsTab />,
    team:      () => <TeamTab />,
    danger:    () => <DangerTab tenant={tenant} />,
  }[activeTab];

  return (
    <AppShell>
      <PageHeader title="Settings" description="Manage your workspace, models, and team." />
      <div className="flex flex-1 min-h-0">
        {/* Tab nav */}
        <nav className="w-44 shrink-0 border-r border-gray-100 bg-white p-3 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                activeTab === id
                  ? id === "danger"
                    ? "bg-red-50 text-red-700 font-medium"
                    : "bg-[#e1f5ee] text-[#0a5441] font-medium"
                  : id === "danger"
                    ? "text-red-400 hover:bg-red-50"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          <TabContent />
        </div>
      </div>
    </AppShell>
  );
}
