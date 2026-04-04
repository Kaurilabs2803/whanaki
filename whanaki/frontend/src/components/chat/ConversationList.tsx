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
    <div className="flex flex-col h-full">
      {/* New conversation */}
      <div className="p-3 border-b border-gray-100">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#0f6e56] hover:bg-[#e1f5ee] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New conversation
        </button>
      </div>

      {/* Search */}
      {conversations.length > 4 && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <MessageSquare className="w-6 h-6 text-gray-200 mb-2" />
            <p className="text-xs text-gray-400">No conversations yet</p>
          </div>
        )}

        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
              c.id === activeId
                ? "bg-[#e1f5ee] text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-xs font-medium truncate leading-snug">
                {truncate(c.title ?? "New conversation", 38)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {formatRelative(c.updated_at)} · {c.message_count} msg
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all mt-0.5 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
