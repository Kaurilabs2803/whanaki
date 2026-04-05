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
  placeholder = "Ask a question about your documents",
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

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
    <div className="surface-panel border-t border-[var(--border)] px-5 py-4">
      <div
        className={cn(
          "rounded-[1.6rem] border bg-[rgba(255,255,255,0.72)] px-4 py-4 transition-colors",
          "focus-within:border-[rgba(46,125,50,0.22)] focus-within:ring-1 focus-within:ring-[rgba(46,125,50,0.16)]",
          disabled ? "opacity-60" : "border-[var(--border)]"
        )}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm leading-7 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none disabled:cursor-not-allowed"
            style={{ maxHeight: "160px" }}
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors",
              canSend
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-soft hover:brightness-95"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
            )}
          >
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between px-1">
        <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          <Shield className="h-3 w-3 text-[var(--primary)]" />
          Regional processing / Enter to send
        </p>
        {value.length > 200 && <p className="text-[10px] text-[var(--muted-foreground)]">{value.length} chars</p>}
      </div>
    </div>
  );
}
