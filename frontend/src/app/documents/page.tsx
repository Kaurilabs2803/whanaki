"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { Upload, FileText, Trash2, CheckCircle, Loader2, AlertCircle, RefreshCw, Tag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader, Alert } from "@/components/ui";
import { api, type Document } from "@/lib/api";
import { formatBytes, formatDate, cn } from "@/lib/utils";

function DocStatus({ status }: { status: Document["status"] }) {
  const cfg = {
    ready: { label: "Ready", variant: "success" as const, icon: <CheckCircle className="h-3 w-3" /> },
    processing: { label: "Processing", variant: "info" as const, icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    uploading: { label: "Uploading", variant: "default" as const, icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    failed: { label: "Failed", variant: "error" as const, icon: <AlertCircle className="h-3 w-3" /> },
  }[status];

  return <Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge>;
}

export default function DocumentsPage() {
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setDocuments(await api.documents.list(token));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const polling = documents.some((d) => d.status === "processing" || d.status === "uploading");
    if (!polling) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [documents]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const token = await getToken();
    if (!token) return;
    setUploading(true);
    setUploadError("");
    for (const file of Array.from(files)) {
      try {
        const doc = await api.documents.upload(token, file);
        setDocuments((prev) => [doc, ...prev]);
      } catch (e: any) {
        setUploadError(e.message || "Upload failed");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Remove this document from your knowledge base?")) return;
    const token = await getToken();
    if (!token) return;
    await api.documents.delete(token, docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const ready = documents.filter((d) => d.status === "ready").length;
  const processing = documents.filter((d) => d.status === "processing").length;

  return (
    <AppShell>
      <PageHeader
        title="Documents"
        description="Curate the materials that shape retrieval, citations, and answer quality across the workspace."
        action={<Button icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()} loading={uploading}>Upload files</Button>}
      />
      <div className="flex-1 overflow-y-auto p-8">
        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={(e) => handleUpload(e.target.files)} />

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            className={cn(
              "surface-card cursor-pointer rounded-[1.9rem] border-2 border-dashed p-8 transition-colors",
              dragOver ? "border-[var(--primary)] bg-[rgba(200,230,201,0.46)]" : "border-[rgba(46,125,50,0.16)] hover:border-[rgba(46,125,50,0.26)]"
            )}
          >
            <div className="flex flex-col items-start gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[rgba(200,230,201,0.62)] text-[var(--primary)]">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">{uploading ? "Uploading in progress" : "Drop files into the workspace"}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                  Add PDFs, Word documents, or plain text and Whanaki will prepare them for retrieval and citation.
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">PDF / DOCX / DOC / TXT / MD / Max 50 MB</p>
            </div>
          </div>

          <div className="surface-card rounded-[1.9rem] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Corpus status</p>
                <h3 className="mt-2 text-3xl font-bold text-[var(--foreground)]">{ready}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">documents ready for retrieval</p>
              </div>
              <button onClick={load} className="rounded-full bg-[var(--muted)] p-3 text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.35rem] bg-[rgba(200,230,201,0.55)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-foreground)]">Ready</p>
                <p className="mt-2 text-2xl font-bold">{ready}</p>
              </div>
              <div className="rounded-[1.35rem] bg-[rgba(240,233,224,0.95)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Processing</p>
                <p className="mt-2 text-2xl font-bold">{processing}</p>
              </div>
            </div>
          </div>
        </section>

        {uploadError && <Alert variant="error" onDismiss={() => setUploadError("")} className="mb-5">{uploadError}</Alert>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" /></div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="No documents yet"
            description="Upload your first set of source material to give chat grounded context and visible citations."
            action={<Button onClick={() => fileRef.current?.click()} icon={<Upload className="h-4 w-4" />}>Upload first document</Button>}
          />
        ) : (
          <Card>
            {documents.map((doc, i) => (
              <div key={doc.id} className={cn("flex items-center gap-4 px-6 py-5 transition-colors hover:bg-[rgba(255,255,255,0.42)]", i < documents.length - 1 && "border-b border-[var(--border)]")}>
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[rgba(200,230,201,0.42)] text-[var(--primary)]">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{doc.original_filename}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>{formatBytes(doc.size_bytes)}</span>
                    {doc.page_count && <span>/ {doc.page_count} pages</span>}
                    <span>/ {formatDate(doc.created_at)}</span>
                    {doc.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-1 text-[10px] font-semibold">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  {doc.status === "failed" && doc.error_message && <p className="mt-1 text-xs text-[var(--destructive)]">{doc.error_message}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <DocStatus status={doc.status} />
                  <button onClick={() => handleDelete(doc.id)} disabled={doc.status === "processing"} className="text-[var(--muted-foreground)] transition hover:text-[var(--destructive)] disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
