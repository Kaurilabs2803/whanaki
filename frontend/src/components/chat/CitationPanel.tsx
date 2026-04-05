"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";
import type { Citation } from "@/lib/api";

interface CitationPanelProps {
  citations: Citation[];
}

function CitationItem({ citation, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="w-full border-b border-[var(--border)] px-4 py-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.5)] last:border-0"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(200,230,201,0.72)] text-[10px] font-bold text-[var(--accent-foreground)]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            <span className="truncate text-xs font-semibold text-[var(--foreground)]">{citation.filename}</span>
            {citation.page && (
              <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">p.{citation.page}</span>
            )}
          </div>
          {citation.section && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-foreground)]">
              {citation.section}
            </p>
          )}
          {expanded && (
            <p className="mt-2 border-l-2 border-[rgba(46,125,50,0.22)] pl-3 text-xs leading-6 text-[var(--muted-foreground)]">
              {citation.excerpt}
            </p>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
        )}
      </div>
    </button>
  );
}

export function CitationPanel({ citations }: CitationPanelProps) {
  if (!citations.length) {
    return (
      <div className="surface-panel flex w-72 shrink-0 items-center justify-center border-l border-[var(--border)]">
        <p className="max-w-[12rem] text-center text-xs leading-6 text-[var(--muted-foreground)]">
          Source references will collect here as the assistant cites documents.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-panel flex w-72 shrink-0 flex-col border-l border-[var(--border)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Sources</p>
        <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{citations.length} references in view</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {citations.map((c, i) => (
          <CitationItem key={`${c.doc_id}-${i}`} citation={c} index={i} />
        ))}
      </div>
    </div>
  );
}
