"use client";

import { useState } from "react";
import { Plus, Trash2, Search, MessageSquare } from "lucide-react";
import { cn, truncate, formatRelative } from "@/lib/utils";
import type { Conversation } from "@/lib/api";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    (c.title ?? "New conversation").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] p-4">
        <button
          onClick={onNew}
          className="w-full rounded-[1.25rem] bg-[var(--primary)] px-4 py-3 text-left text-sm font-semibold text-[var(--primary-foreground)] shadow-soft transition hover:brightness-95"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New conversation
          </span>
        </button>
      </div>

      {conversations.length > 4 && (
        <div className="px-4 pb-1 pt-4">
          <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.55)] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads"
              className="flex-1 bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-[rgba(200,230,201,0.45)] text-[var(--primary)]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-[var(--foreground)]">No conversations yet</p>
            <p className="mt-1 max-w-[14rem] text-xs leading-5 text-[var(--muted-foreground)]">
              Start a new thread once your first question is ready.
            </p>
          </div>
        )}

        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "group rounded-[1.25rem] border px-3 py-3 transition-all cursor-pointer",
              c.id === activeId
                ? "border-[rgba(46,125,50,0.18)] bg-[rgba(200,230,201,0.58)] shadow-soft"
                : "border-transparent bg-[rgba(255,255,255,0.42)] hover:border-[rgba(46,125,50,0.12)] hover:bg-[rgba(255,255,255,0.68)]"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {truncate(c.title ?? "New conversation", 38)}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  {formatRelative(c.updated_at)} / {c.message_count} msg
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="opacity-0 transition-all group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
