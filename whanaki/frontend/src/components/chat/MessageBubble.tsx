"use client";

import { useState } from "react";
import { Shield, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/api";

// Inline citation chip that shows a tooltip on click
function InlineCitation({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="citation-marker align-middle"
      >
        {index + 1}
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute bottom-7 left-0 z-20 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-[#0f6e56] shrink-0" />
              <span className="text-xs font-medium text-gray-900 truncate">{citation.filename}</span>
              {citation.page && (
                <span className="text-[10px] text-gray-400 ml-auto shrink-0">p.{citation.page}</span>
              )}
            </span>
            {citation.section && (
              <p className="text-[10px] text-[#0f6e56] font-semibold mb-1">{citation.section}</p>
            )}
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-5">{citation.excerpt}</p>
          </span>
        </>
      )}
    </span>
  );
}

// Render assistant content with citation chips injected inline
function AssistantContent({ content, citations }: { content: string; citations: Citation[] }) {
  if (!citations.length) return <>{content}</>;

  // Split on citation patterns and inject chips
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
        // Render paragraph breaks
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
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-[72%] bg-[#0f6e56] text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-1 max-w-[85%]">
      <div className="bg-white border border-gray-100 shadow-sm px-4 py-3.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed text-gray-800">
        <AssistantContent content={message.content} citations={message.citations} />
        {message.isStreaming && <span className="streaming-cursor" />}
      </div>

      {!message.isStreaming && (
        <div className="flex items-center gap-2 px-1 text-[10px] text-gray-400">
          <Shield className="w-3 h-3 text-[#0f6e56]" />
          <span>NZ server</span>
          {message.model_used && (
            <>
              <span>·</span>
              <span>{message.model_used.split(":")[0]}</span>
            </>
          )}
          {message.generation_ms && (
            <>
              <span>·</span>
              <span>{(message.generation_ms / 1000).toFixed(1)}s</span>
            </>
          )}
          {message.citations.length > 0 && (
            <>
              <span>·</span>
              <span>{message.citations.length} source{message.citations.length !== 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export type { LocalMessage };
