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
    ready:      { label: "Ready",      variant: "success" as const, icon: <CheckCircle className="w-3 h-3" /> },
    processing: { label: "Processing", variant: "info" as const,    icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    uploading:  { label: "Uploading",  variant: "default" as const, icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    failed:     { label: "Failed",     variant: "error" as const,   icon: <AlertCircle className="w-3 h-3" /> },
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
    try { setDocuments(await api.documents.list(token)); }
    catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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
      } catch (e: any) { setUploadError(e.message || "Upload failed"); }
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
        description="Upload documents to your knowledge base. AI will cite them in answers."
        action={
          <Button icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()} loading={uploading}>
            Upload files
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={(e) => handleUpload(e.target.files)} />

        {documents.length > 0 && (
          <div className="flex items-center gap-4 mb-5">
            <span className="text-2xl font-bold text-gray-900">{ready}</span>
            <span className="text-sm text-gray-500">documents ready</span>
            {processing > 0 && <span className="text-sm text-blue-600 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{processing} processing</span>}
            <button onClick={load} className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw className="w-4 h-4" /></button>
          </div>
        )}

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          className={cn("border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors mb-5",
            dragOver ? "border-[#0f6e56] bg-[#e1f5ee]" : "border-gray-200 hover:border-[#9fe1cb] hover:bg-gray-50")}
        >
          <div className="flex flex-col items-center gap-2">
            {uploading ? <Loader2 className="w-7 h-7 text-[#0f6e56] animate-spin" /> : <Upload className="w-7 h-7 text-gray-300" />}
            <p className="text-sm font-medium text-gray-600">{uploading ? "Uploading…" : dragOver ? "Drop to upload" : "Drop files or click to browse"}</p>
            <p className="text-xs text-gray-400">PDF, DOCX, TXT, MD · Max 50 MB</p>
          </div>
        </div>

        {uploadError && <Alert variant="error" onDismiss={() => setUploadError("")} className="mb-4">{uploadError}</Alert>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No documents yet"
            description="Upload PDFs, Word documents, or text files to get started."
            action={<Button onClick={() => fileRef.current?.click()} icon={<Upload className="w-4 h-4" />}>Upload first document</Button>}
          />
        ) : (
          <Card>
            {documents.map((doc, i) => (
              <div key={doc.id} className={cn("flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors", i < documents.length - 1 && "border-b border-gray-100")}>
                <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.original_filename}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatBytes(doc.size_bytes)}</span>
                    {doc.page_count && <><span className="text-gray-200">·</span><span className="text-xs text-gray-400">{doc.page_count}p</span></>}
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                    {doc.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        <Tag className="w-2.5 h-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                  {doc.status === "failed" && doc.error_message && <p className="text-xs text-red-500 mt-1">{doc.error_message}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <DocStatus status={doc.status} />
                  <button onClick={() => handleDelete(doc.id)} disabled={doc.status === "processing"} className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {processing > 0 && <p className="text-xs text-gray-400 mt-3 text-center">Processing takes 1–3 minutes. This page auto-refreshes.</p>}
      </div>
    </AppShell>
  );
}
