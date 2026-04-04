"use client";

import { useRef, useEffect } from "react";
import { Send, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Ask a question about your documents…",
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="bg-white border-t border-gray-100 px-4 py-3">
      <div className={cn(
        "flex items-end gap-2 bg-gray-50 border rounded-2xl px-4 py-3 transition-colors",
        "focus-within:border-[#0f6e56] focus-within:ring-1 focus-within:ring-[#0f6e56]/20",
        disabled ? "border-gray-100 opacity-60" : "border-gray-200"
      )}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none leading-relaxed disabled:cursor-not-allowed"
          style={{ maxHeight: "160px" }}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          className={cn(
            "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
            canSend
              ? "bg-[#0f6e56] text-white hover:bg-[#0a5441]"
              : "bg-gray-100 text-gray-300 cursor-not-allowed"
          )}
        >
          {disabled
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-1">
        <p className="text-[10px] text-gray-400 flex items-center gap-1">
          <Shield className="w-3 h-3 text-[#0f6e56]" />
          All processing on NZ servers · Enter to send · Shift+Enter for new line
        </p>
        {value.length > 200 && (
          <p className="text-[10px] text-gray-400">{value.length} chars</p>
        )}
      </div>
    </div>
  );
}
