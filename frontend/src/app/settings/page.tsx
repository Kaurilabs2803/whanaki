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

const TABS = [
  { id: "workspace", label: "Workspace", icon: Settings },
  { id: "models", label: "AI models", icon: Cpu },
  { id: "team", label: "Team", icon: Users },
  { id: "danger", label: "Danger zone", icon: AlertTriangle },
] as const;

type Tab = typeof TABS[number]["id"];

function WorkspaceTab({ tenant, onTenantUpdate }: { tenant: TenantInfo | null; onTenantUpdate: (t: TenantInfo) => void }) {
  const { getToken } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [primaryColour, setPrimaryColour] = useState("#2e7d32");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="max-w-3xl space-y-6">
      {error && <Alert variant="warning">{error}</Alert>}
      <div className="surface-card rounded-[1.8rem] p-6">
        <h3 className="text-2xl font-bold text-[var(--foreground)]">Workspace details</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_auto]">
          <div>
            <label className="block text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Organisation name</label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Smith Legal Ltd"
              className="mt-2 w-full rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.65)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[rgba(46,125,50,0.24)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Brand colour</label>
            <div className="mt-2 flex items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.65)] px-3 py-2.5">
              <input type="color" value={primaryColour} onChange={(e) => setPrimaryColour(e.target.value)} className="h-9 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
              <span className="font-mono text-sm text-[var(--muted-foreground)]">{primaryColour}</span>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button loading={saving} onClick={handleSave} icon={saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}>
            {saved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="rounded-[1.8rem] bg-[rgba(200,230,201,0.56)] p-6">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[var(--accent-foreground)]">
          <Shield className="h-4 w-4" />
          Data posture
        </p>
        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
          Documents and conversations remain positioned as controlled workspace assets. The UI reinforces that by keeping the product calmer, warmer, and more document first.
        </p>
      </div>
    </div>
  );
}

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
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" /></div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="surface-card rounded-[1.8rem] divide-y divide-[var(--border)]">
        {models.map((m) => (
          <div key={m.model_id} className="flex items-start gap-4 p-5">
            <input type="radio" name="default-model" value={m.model_id} checked={defaultModel === m.model_id} onChange={() => setDefaultModel(m.model_id)} className="mt-1 accent-[var(--primary)]" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">{m.display_name}</span>
                <Badge variant="info">{m.speed}</Badge>
                {m.parameter_count && <span className="text-xs text-[var(--muted-foreground)]">{m.parameter_count}</span>}
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{m.description}</p>
            </div>
            {m.is_default && <Badge variant="success">Default</Badge>}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button icon={<Save className="h-4 w-4" />}>Save default model</Button>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, { label: string; variant: "success" | "info" | "default" }> = {
  tenant_admin: { label: "Admin", variant: "success" },
  editor: { label: "Editor", variant: "info" },
  viewer: { label: "Viewer", variant: "default" },
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
      setMembers(await api.users.list(token));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

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
    <div className="max-w-3xl space-y-5">
      {error && <Alert variant="warning">{error}</Alert>}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" /></div>
      ) : (
        <div className="surface-card rounded-[1.8rem] divide-y divide-[var(--border)]">
          {members.map((m) => {
            const roleCfg = ROLE_LABELS[m.role] ?? { label: m.role, variant: "default" as const };
            return (
              <div key={m.id} className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--muted)] text-sm font-bold text-[var(--foreground)]">
                  {(m.full_name ?? m.email).split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{m.full_name ?? "Workspace member"}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">{m.email}</p>
                </div>
                <Badge variant={roleCfg.variant}>{roleCfg.label}</Badge>
                {m.role !== "tenant_admin" && (
                  <button onClick={() => handleRemove(m.id)} disabled={removing === m.id} className="text-xs font-semibold text-[var(--muted-foreground)] transition hover:text-[var(--destructive)]">
                    {removing === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
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
      await api.documents.deleteAll(token);
      setConfirmDelete("");
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
    <div className="max-w-3xl space-y-5">
      <Alert variant="warning">These actions are irreversible and should be used with care.</Alert>
      {error && <Alert variant="warning">{error}</Alert>}

      <div className="rounded-[1.8rem] border border-[rgba(198,40,40,0.22)] bg-[rgba(198,40,40,0.05)] p-6">
        <h3 className="text-xl font-bold text-[var(--foreground)]">Delete all documents</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">This removes the entire document layer from the workspace while leaving the account itself in place.</p>
        <div className="mt-4 flex gap-3">
          <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="delete" className="flex-1 rounded-[1rem] border border-[rgba(198,40,40,0.22)] bg-[rgba(255,255,255,0.7)] px-4 py-3 text-sm focus:outline-none" />
          <Button variant="danger" loading={deletingDocs} disabled={confirmDelete !== "delete"} onClick={handleDeleteAllDocs}>Delete documents</Button>
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-[rgba(198,40,40,0.22)] bg-[rgba(198,40,40,0.05)] p-6">
        <h3 className="text-xl font-bold text-[var(--foreground)]">Delete workspace</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">This removes the organisation, conversations, documents, and associated workspace history.</p>
        <div className="mt-4 flex gap-3">
          <input value={confirmWorkspace} onChange={(e) => setConfirmWorkspace(e.target.value)} placeholder={orgSlug} className="flex-1 rounded-[1rem] border border-[rgba(198,40,40,0.22)] bg-[rgba(255,255,255,0.7)] px-4 py-3 text-sm focus:outline-none" />
          <Button variant="danger" loading={deletingWorkspace} disabled={confirmWorkspace !== orgSlug} onClick={handleDeleteWorkspace}>Delete workspace</Button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("workspace");
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        setTenant(await api.tenant.get(token));
      } catch {
        // ignore
      }
    })();
  }, [getToken]);

  const tabProps = { tenant, onTenantUpdate: setTenant };

  const TabContent = {
    workspace: () => <WorkspaceTab {...tabProps} />,
    models: () => <ModelsTab />,
    team: () => <TeamTab />,
    danger: () => <DangerTab tenant={tenant} />,
  }[activeTab];

  return (
    <AppShell>
      <PageHeader title="Settings" description="Manage workspace identity, model defaults, team membership, and account level actions." />
      <div className="flex flex-1 min-h-0">
        <nav className="surface-panel w-64 shrink-0 border-r border-[var(--border)] p-4 space-y-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full rounded-[1.2rem] px-4 py-3 text-left text-sm transition-colors",
                activeTab === id
                  ? id === "danger"
                    ? "bg-[rgba(198,40,40,0.1)] text-[var(--destructive)]"
                    : "bg-[rgba(200,230,201,0.68)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[rgba(255,255,255,0.52)] hover:text-[var(--foreground)]"
              )}
            >
              <span className="flex items-center gap-3 font-semibold">
                <Icon className="h-4 w-4" />
                {label}
              </span>
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-8">
          <TabContent />
        </div>
      </div>
    </AppShell>
  );
}
