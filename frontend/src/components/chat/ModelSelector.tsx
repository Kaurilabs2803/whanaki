"use client";

import { useState } from "react";
import { ChevronDown, Shield, Zap, Scale, Brain, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelOption } from "@/lib/api";

const SPEED_CONFIG = {
  fast: { icon: Zap, label: "Fast", cls: "text-[var(--primary)] bg-[rgba(200,230,201,0.72)]" },
  balanced: { icon: Scale, label: "Balanced", cls: "text-[var(--foreground)] bg-[rgba(240,233,224,0.95)]" },
  thorough: { icon: Brain, label: "Thorough", cls: "text-[var(--primary-foreground)] bg-[rgba(46,125,50,0.72)]" },
} as const;

interface ModelSelectorProps {
  models: ModelOption[];
  selected: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ModelSelector({
  models,
  selected,
  onChange,
  disabled = false,
  compact = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.model_id === selected);
  const cfg = current ? SPEED_CONFIG[current.speed] : null;
  const Icon = cfg?.icon ?? Scale;

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.64)] transition-colors hover:border-[rgba(46,125,50,0.18)] disabled:opacity-40",
          compact ? "px-3 py-2" : "px-4 py-3"
        )}
      >
        <span className="flex items-center gap-2">
          {cfg && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", cfg.cls)}>
              <Icon className="h-3 w-3" />
              {!compact && cfg.label}
            </span>
          )}
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {current?.display_name ?? selected}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="surface-card absolute right-0 top-full z-30 mt-2 w-80 rounded-[1.4rem] p-2">
            <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Choose model
            </p>
            {models.map((m) => {
              const mc = SPEED_CONFIG[m.speed];
              const MI = mc.icon;
              const isSelected = m.model_id === selected;

              return (
                <button
                  key={m.model_id}
                  onClick={() => {
                    onChange(m.model_id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[1rem] px-3 py-3 text-left transition-colors",
                    isSelected ? "bg-[rgba(200,230,201,0.58)]" : "hover:bg-[rgba(255,255,255,0.58)]"
                  )}
                >
                  <span className={cn("mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", mc.cls)}>
                    <MI className="h-3 w-3" />
                    {mc.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">{m.display_name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{m.description}</p>
                    {m.parameter_count && <span className="mt-1 block text-[10px] text-[var(--muted-foreground)]">{m.parameter_count} params</span>}
                  </div>
                </button>
              );
            })}
            <div className="mt-1 border-t border-[var(--border)] px-3 pb-2 pt-3">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                <Shield className="h-3 w-3 text-[var(--primary)]" />
                Regional processing only
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
