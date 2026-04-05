"use client";

import { useState } from "react";
import { Shield, FileText } from "lucide-react";
import type { Citation } from "@/lib/api";

function InlineCitation({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="citation-marker align-middle">
        {index + 1}
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="surface-card absolute bottom-8 left-0 z-20 block w-80 rounded-[1.2rem] p-3 text-left">
            <span className="mb-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
              <span className="truncate text-xs font-semibold text-[var(--foreground)]">{citation.filename}</span>
              {citation.page && (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]">p.{citation.page}</span>
              )}
            </span>
            {citation.section && (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-foreground)]">
                {citation.section}
              </p>
            )}
            <p className="text-xs leading-6 text-[var(--muted-foreground)]">{citation.excerpt}</p>
          </span>
        </>
      )}
    </span>
  );
}

function AssistantContent({ content, citations }: { content: string; citations: Citation[] }) {
  if (!citations.length) return <>{content}</>;

  const parts = content.split(/(\[Doc:[^\]]+\]|\[RTA[^\]]*\]|\[IRD:[^\]]*\]|\[TAA[^\]]*\])/g);
  let citIdx = 0;

  return (
    <>
      {parts.map((part, i) => {
        if (/^\[(Doc:|RTA|IRD:|TAA)/.test(part)) {
          const cit = citations[citIdx];
          const idx = citIdx;
          citIdx = Math.min(citIdx + 1, citations.length - 1);
          return cit ? <InlineCitation key={i} citation={cit} index={idx} /> : <span key={i}>{part}</span>;
        }

        return (
          <span key={i}>
            {part.split("\n").map((line, li, arr) => (
              <span key={li}>
                {line}
                {li < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  model_used?: string | null;
  generation_ms?: number | null;
  isStreaming?: boolean;
}

interface MessageBubbleProps {
  message: LocalMessage;
  onCitationClick?: (citation: Citation) => void;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end px-5 py-2">
        <div className="max-w-[72%] rounded-[1.6rem] rounded-tr-md bg-[var(--primary)] px-5 py-4 text-sm leading-7 text-[var(--primary-foreground)] shadow-soft">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[88%] flex-col gap-2 px-5 py-2">
      <div className="surface-card rounded-[1.8rem] rounded-tl-md px-5 py-4 text-sm leading-7 text-[var(--foreground)]">
        <AssistantContent content={message.content} citations={message.citations} />
        {message.isStreaming && <span className="streaming-cursor" />}
      </div>

      {!message.isStreaming && (
        <div className="flex flex-wrap items-center gap-2 px-2 text-[11px] text-[var(--muted-foreground)]">
          <Shield className="h-3 w-3 text-[var(--primary)]" />
          <span>Regional processing</span>
          {message.model_used && <span>/ {message.model_used.split(":")[0]}</span>}
          {message.generation_ms && <span>/ {(message.generation_ms / 1000).toFixed(1)}s</span>}
          {message.citations.length > 0 && (
            <span>/ {message.citations.length} source{message.citations.length !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}
    </div>
  );
}

export type { LocalMessage };
