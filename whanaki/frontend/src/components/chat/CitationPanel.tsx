"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/api";

interface CitationPanelProps {
  citations: Citation[];
}

function CitationItem({ citation, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-5 h-5 rounded-md bg-[#e1f5ee] text-[#0f6e56] text-[10px] font-semibold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-xs font-medium text-gray-800 truncate">{citation.filename}</span>
            {citation.page && (
              <span className="text-[10px] text-gray-400 shrink-0">p.{citation.page}</span>
            )}
          </div>
          {citation.section && (
            <p className="text-[10px] text-[#0f6e56] mt-0.5 font-medium">{citation.section}</p>
          )}
          {expanded && (
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed border-l-2 border-[#9fe1cb] pl-2">
              {citation.excerpt}
            </p>
          )}
        </div>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
        }
      </div>
    </button>
  );
}

export function CitationPanel({ citations }: CitationPanelProps) {
  if (!citations.length) {
    return (
      <div className="w-64 shrink-0 border-l border-gray-100 bg-white flex items-center justify-center">
        <p className="text-xs text-gray-300 px-4 text-center">
          Sources will appear here when the AI cites documents
        </p>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-l border-gray-100 bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Sources · {citations.length}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {citations.map((c, i) => (
          <CitationItem key={`${c.doc_id}-${i}`} citation={c} index={i} />
        ))}
      </div>
    </div>
  );
}
